<?php
declare(strict_types=1);

require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../core/AuthMiddleware.php';
require_once __DIR__ . '/../../core/SriCrypto.php';
require_once __DIR__ . '/../../core/sri/SriDocumentoFactory.php';
require_once __DIR__ . '/../../core/sri/SriSigner.php';
require_once __DIR__ . '/../../core/sri/SriSoapClient.php';
require_once __DIR__ . '/../../core/sri/SriRideGenerator.php';
require_once __DIR__ . '/../../core/AccountingService.php';
require_once __DIR__ . '/../../core/MailerService.php';
require_once __DIR__ . '/../../core/Response.php';

$session   = AuthMiddleware::authenticate();
$negocioId = (int)$session['negocio_id'];
$usuarioId = (int)($session['user_id'] ?? $session['sub'] ?? 0);
$db        = Database::getConnection();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    Response::json(['error' => 'Método no permitido'], 405);
}

$input   = json_decode(file_get_contents('php://input'), true) ?? [];
$ventaId = (int)($input['venta_id'] ?? 0);

if ($ventaId <= 0) {
    Response::json(['error' => 'ID de venta requerido.'], 422);
}

// 1. Obtener configuración SRI del negocio
$stmtCfg = $db->prepare("SELECT * FROM configuracion_sri WHERE negocio_id = :nid LIMIT 1");
$stmtCfg->execute(['nid' => $negocioId]);
$sriConfig = $stmtCfg->fetch();

if (!$sriConfig) {
    Response::json(['error' => 'No has configurado los datos de Facturación Electrónica SRI en tu negocio.'], 400);
}

// 2. Obtener datos de la venta
$stmtVenta = $db->prepare("
    SELECT id, cliente_id, metodo_pago, comprobante_transferencia, subtotal, impuesto, total, asiento_id, created_at
    FROM ventas
    WHERE id = :vid AND negocio_id = :nid
    LIMIT 1
");
$stmtVenta->execute(['vid' => $ventaId, 'nid' => $negocioId]);
$venta = $stmtVenta->fetch();

if (!$venta) {
    Response::json(['error' => 'La venta no existe en este negocio.'], 404);
}

// 3. Obtener detalles de la venta con impuestos dinámicos de la tabla de productos
$stmtDet = $db->prepare("
    SELECT 
        vd.producto_id,
        vd.nombre_producto,
        vd.cantidad,
        vd.precio_unitario,
        vd.subtotal,
        COALESCE(p.sri_codigo_impuesto, '4') AS sri_codigo_impuesto,
        COALESCE(p.sri_tarifa_iva, 15.00) AS sri_tarifa_iva
    FROM venta_detalles vd
    LEFT JOIN productos p ON p.id = vd.producto_id
    WHERE vd.venta_id = :vid AND vd.negocio_id = :nid
");
$stmtDet->execute(['vid' => $ventaId, 'nid' => $negocioId]);
$detalles = $stmtDet->fetchAll();

if (empty($detalles)) {
    Response::json(['error' => 'La venta no contiene ningún ítem para facturar.'], 422);
}

// 4. Obtener datos del cliente
$cliente = [
    'documento' => '9999999999999',
    'nombre'    => 'CONSUMIDOR FINAL',
    'email'     => '',
    'telefono'  => '',
    'direccion' => '',
];
if ($venta['cliente_id']) {
    $stmtCli = $db->prepare("SELECT documento, nombre, email, telefono, direccion FROM clientes WHERE id = :cid AND negocio_id = :nid");
    $stmtCli->execute(['cid' => $venta['cliente_id'], 'nid' => $negocioId]);
    if ($rowCli = $stmtCli->fetch()) {
        $cliente = array_merge($cliente, array_filter($rowCli));
    }
}

// 5. Determinar serie y secuencial correlativo
$serie = sprintf('%03d%03d', (int)$sriConfig['codigo_establecimiento'], (int)$sriConfig['punto_emision']);

$stmtPrev = $db->prepare("
    SELECT * FROM comprobantes_electronicos_sri 
    WHERE origen_id = :vid AND tipo_documento = '01' AND negocio_id = :nid 
    ORDER BY id ASC LIMIT 1
");
$stmtPrev->execute(['vid' => $ventaId, 'nid' => $negocioId]);
$compPrevio = $stmtPrev->fetch();

if ($compPrevio) {
    $secuencial = (int)$compPrevio['secuencial'];
    $serie = $compPrevio['serie'];
} else {
    $stmtCorr = $db->prepare("
        SELECT COALESCE(MAX(secuencial), 0) + 1 
        FROM comprobantes_electronicos_sri 
        WHERE negocio_id = :nid AND tipo_documento = '01' AND serie = :serie
    ");
    $stmtCorr->execute(['nid' => $negocioId, 'serie' => $serie]);
    $secuencial = (int)$stmtCorr->fetchColumn();
}

// 6. Construir objeto Factura SRI mediante Factory Pattern
$factura = SriDocumentoFactory::crearFactura(
    $sriConfig,
    $cliente,
    $venta,
    $detalles,
    $serie,
    $secuencial,
    (int)$sriConfig['ambiente'],
    (int)$sriConfig['tipo_emision']
);

$xmlGenerado = $factura->generarXml();
$claveAcceso = $factura->getClaveAcceso();
$numComprobante = $factura->getNumeroComprobante();

// 7. Firmar XML con certificado .p12 (si está configurado)
$xmlFinalParaEnviar = $xmlGenerado;
$firmadoConCertificado = false;

if (!empty($sriConfig['firma_p12_path']) && file_exists($sriConfig['firma_p12_path']) && !empty($sriConfig['firma_password_enc'])) {
    $p12Password = SriCrypto::decrypt($sriConfig['firma_password_enc']);
    try {
        $xmlFinalParaEnviar = SriSigner::signXml($xmlGenerado, $sriConfig['firma_p12_path'], $p12Password);
        $firmadoConCertificado = true;
    } catch (Throwable $e) {
        Response::json(['error' => 'Error al firmar documento con el certificado digital: ' . $e->getMessage()], 422);
    }
}

// 8. Consumir Web Service SOAP del SRI (Recepción y Autorización)
$soapClient = new SriSoapClient((int)$sriConfig['ambiente']);
$estadoSri = 'PENDIENTE';
$mensajeSri = '';
$numeroAutorizacion = null;
$fechaAutorizacion = null;

if ($firmadoConCertificado) {
    // A. Enviar a Recepción
    $recepcion = $soapClient->enviarComprobante($xmlFinalParaEnviar);

    if ($recepcion['success']) {
        // Comprobante RECIBIDO por el SRI. Esperar 1.5s y consultar autorización
        usleep(1500000);
        $autorizacion = $soapClient->consultarAutorizacion($claveAcceso);

        if ($autorizacion['success']) {
            $estadoSri = 'AUTORIZADO';
            $numeroAutorizacion = $autorizacion['numero_autorizacion'];
            $fechaAutorizacion = $autorizacion['fecha_autorizacion'];
            $mensajeSri = 'Factura AUTORIZADA legalmente por el SRI.';
        } else {
            $estadoSri = $autorizacion['estado'] ?: 'EN_PROCESAMIENTO';
            $mensajeSri = $autorizacion['mensaje'] ?: 'Comprobante en procesamiento en el SRI.';
        }
    } else {
        $estadoSri = $recepcion['estado']; // DEVUELTA o ERROR_CONEXION
        $mensajeSri = $recepcion['mensaje'];
    }
} else {
    // Si no tiene certificado subido, se genera en modo simulación de pruebas
    $estadoSri = 'AUTORIZADO';
    $numeroAutorizacion = $claveAcceso;
    $fechaAutorizacion = date('Y-m-d H:i:s');
    $mensajeSri = 'Factura generada en modo Pruebas internas (sin firma .p12 cargada).';
}

// 9. Si el servicio del SRI está caído o con error de conexión, guardar en la COLA de reintentos automáticos
if ($estadoSri === 'ERROR_CONEXION' || $estadoSri === 'PENDIENTE') {
    $insCola = $db->prepare("
        INSERT INTO sri_cola_recepcion 
            (negocio_id, venta_id, clave_acceso, estado, xml_firmado, ultimo_error, proximo_reintento)
        VALUES 
            (:nid, :vid, :clave, 'ERROR_CONEXION', :xml, :err, DATE_ADD(NOW(), INTERVAL 15 MINUTE))
        ON DUPLICATE KEY UPDATE 
            estado = VALUES(estado),
            ultimo_error = VALUES(ultimo_error),
            proximo_reintento = VALUES(proximo_reintento)
    ");
    $insCola->execute([
        'nid'   => $negocioId,
        'vid'   => $ventaId,
        'clave' => $claveAcceso,
        'xml'   => $xmlFinalParaEnviar,
        'err'   => $mensajeSri,
    ]);
}

// 10. Generar RIDE (PDF) con datos normativos del SRI
$pdfContent = SriRideGenerator::generate(
    $sriConfig,
    $cliente,
    $numComprobante,
    $claveAcceso,
    $fechaAutorizacion ?: date('Y-m-d H:i:s'),
    $numeroAutorizacion ?: $claveAcceso,
    (int)$sriConfig['ambiente'],
    (float)$venta['subtotal'],
    (float)$venta['impuesto'],
    (float)$venta['total'],
    $venta['metodo_pago'],
    $detalles,
    $estadoSri
);

// 11. Enviar por correo electrónico si está autorizada y tiene email
$emailEnviado = false;
if (!empty($cliente['email']) && filter_var($cliente['email'], FILTER_VALIDATE_EMAIL)) {
    try {
        $emailEnviado = MailerService::sendInvoiceEmail(
            $cliente['email'],
            $cliente['nombre'],
            [
                'nombre'    => $sriConfig['razon_social'],
                'ruc_nit'   => $sriConfig['ruc'],
                'logo_url'  => null,
                'direccion' => $sriConfig['dir_matriz'],
            ],
            $numComprobante,
            (float)$venta['total'],
            $xmlFinalParaEnviar,
            json_encode(['clave_acceso' => $claveAcceso, 'estado' => $estadoSri]),
            $pdfContent
        );
    } catch (Throwable $e) {
        error_log("Error al enviar email SRI: " . $e->getMessage());
    }
}

// 12. Asiento Contable Automático en el Libro Diario (Principio de Partida Doble)
$asientoId = !empty($venta['asiento_id']) ? (int)$venta['asiento_id'] : null;
if (!$asientoId) {
    $costoTotalVenta = 0.0;
    foreach ($detalles as $d) {
        $costoTotalVenta += (float)($d['cantidad'] ?? 1) * (float)($d['costo_unitario'] ?? 0.0);
    }
    $asientoId = AccountingService::recordSaleEntry(
        $negocioId,
        $usuarioId,
        $ventaId,
        $numComprobante,
        $venta['metodo_pago'],
        (float)$venta['subtotal'],
        (float)$venta['impuesto'],
        (float)$venta['total'],
        $detalles,
        $venta['comprobante_transferencia'] ?? null
    );
    if ($asientoId) {
        $db->prepare("UPDATE ventas SET asiento_id = :aid WHERE id = :vid AND negocio_id = :nid")
           ->execute(['aid' => $asientoId, 'vid' => $ventaId, 'nid' => $negocioId]);
    }
}

// 13. Guardar o actualizar registro en facturas_electronicas
$insFac = $db->prepare("
    INSERT INTO facturas_electronicas
        (negocio_id, venta_id, cliente_id, serie, correlativo, numero_comprobante, cufe_hash, clave_acceso, xml_content, json_content, email_enviado, estado_sri, ambiente_sri, mensaje_error_sri)
    VALUES
        (:nid, :vid, :cid, :serie, :corr, :num, :hash, :clave, :xml, :json, :enviado, :estado_sri, :amb, :err)
    ON DUPLICATE KEY UPDATE
        numero_comprobante = VALUES(numero_comprobante),
        clave_acceso = VALUES(clave_acceso),
        xml_content = VALUES(xml_content),
        email_enviado = VALUES(email_enviado),
        estado_sri = VALUES(estado_sri),
        mensaje_error_sri = VALUES(mensaje_error_sri)
");

$insFac->execute([
    'nid'        => $negocioId,
    'vid'        => $ventaId,
    'cid'        => $venta['cliente_id'],
    'serie'      => $serie,
    'corr'       => $secuencial,
    'num'        => $numComprobante,
    'hash'       => hash('sha256', $claveAcceso),
    'clave'      => $claveAcceso,
    'xml'        => $xmlFinalParaEnviar,
    'json'       => json_encode([
        'clave_acceso'        => $claveAcceso,
        'numero_autorizacion' => $numeroAutorizacion,
        'fecha_autorizacion'  => $fechaAutorizacion,
        'estado_sri'          => $estadoSri,
    ]),
    'enviado'    => $emailEnviado ? 1 : 0,
    'estado_sri' => $estadoSri,
    'amb'        => (int)$sriConfig['ambiente'],
    'err'        => $estadoSri !== 'AUTORIZADO' ? $mensajeSri : null,
]);

// 14. Guardar o actualizar en la tabla unificada de comprobantes SRI
if ($compPrevio) {
    $updCes = $db->prepare("
        UPDATE comprobantes_electronicos_sri
        SET estado_sri = :est, mensaje_sri = :msg, numero_autorizacion = :num_aut, fecha_autorizacion = :fec_aut, xml_firmado = :xml, xml_autorizado = :xml_aut, email_enviado = :email, asiento_id = :aid
        WHERE id = :cid AND negocio_id = :nid
    ");
    $updCes->execute([
        'cid'     => $compPrevio['id'],
        'nid'     => $negocioId,
        'est'     => $estadoSri,
        'msg'     => $mensajeSri,
        'num_aut' => $numeroAutorizacion,
        'fec_aut' => $fechaAutorizacion,
        'xml'     => $xmlFinalParaEnviar,
        'xml_aut' => $estadoSri === 'AUTORIZADO' ? $xmlFinalParaEnviar : null,
        'email'   => $emailEnviado ? 1 : 0,
        'aid'     => $asientoId,
    ]);
} else {
    $insCes = $db->prepare("
        INSERT INTO comprobantes_electronicos_sri
            (negocio_id, tipo_documento, origen_tipo, origen_id, serie, secuencial, numero_comprobante, clave_acceso, fecha_emision, ambiente, estado_sri, mensaje_sri, numero_autorizacion, fecha_autorizacion, xml_firmado, xml_autorizado, email_enviado, asiento_id)
        VALUES
            (:nid, '01', 'venta', :vid, :serie, :sec, :num, :clave, :fec, :amb, :est, :msg, :num_aut, :fec_aut, :xml, :xml_aut, :email, :aid)
    ");
    $insCes->execute([
        'nid'      => $negocioId,
        'vid'      => $ventaId,
        'serie'    => $serie,
        'sec'      => $secuencial,
        'num'      => $numComprobante,
        'clave'    => $claveAcceso,
        'fec'      => date('Y-m-d'),
        'amb'      => (int)$sriConfig['ambiente'],
        'est'      => $estadoSri,
        'msg'      => $mensajeSri,
        'num_aut'  => $numeroAutorizacion,
        'fec_aut'  => $fechaAutorizacion,
        'xml'      => $xmlFinalParaEnviar,
        'xml_aut'  => $estadoSri === 'AUTORIZADO' ? $xmlFinalParaEnviar : null,
        'email'    => $emailEnviado ? 1 : 0,
        'aid'      => $asientoId,
    ]);
}

Response::json([
    'success'             => $estadoSri === 'AUTORIZADO',
    'estado_sri'          => $estadoSri,
    'mensaje'             => $mensajeSri,
    'clave_acceso'        => $claveAcceso,
    'numero_comprobante'  => $numComprobante,
    'numero_autorizacion' => $numeroAutorizacion,
    'fecha_autorizacion'  => $fechaAutorizacion,
    'asiento_id'          => $asientoId,
    'email_enviado'       => $emailEnviado,
    'pdf_base64'          => base64_encode($pdfContent),
    'xml_firmado'         => $xmlFinalParaEnviar,
]);
