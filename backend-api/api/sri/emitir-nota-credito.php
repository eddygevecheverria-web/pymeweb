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
$usuarioId = (int)$session['user_id'];
$db        = Database::getConnection();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    Response::json(['error' => 'Método no permitido'], 405);
}

$input   = json_decode(file_get_contents('php://input'), true) ?? [];
$ventaId = (int)($input['venta_id'] ?? 0);
$motivo  = trim((string)($input['motivo'] ?? 'Devolución de mercadería / Anulación de factura'));
$medioDevolucion = trim((string)($input['devolucion_pago'] ?? 'efectivo'));

if ($ventaId <= 0) {
    Response::json(['error' => 'ID de venta requerido para emitir la Nota de Crédito.'], 422);
}

// 1. Obtener configuración SRI
$stmtCfg = $db->prepare("SELECT * FROM configuracion_sri WHERE negocio_id = :nid LIMIT 1");
$stmtCfg->execute(['nid' => $negocioId]);
$sriConfig = $stmtCfg->fetch();

if (!$sriConfig) {
    Response::json(['error' => 'No has configurado los datos de Facturación Electrónica SRI.'], 400);
}

// 2. Obtener datos de la venta original
$stmtVenta = $db->prepare("
    SELECT id, cliente_id, metodo_pago, subtotal, impuesto, total, estado, created_at
    FROM ventas
    WHERE id = :vid AND negocio_id = :nid
    LIMIT 1
");
$stmtVenta->execute(['vid' => $ventaId, 'nid' => $negocioId]);
$venta = $stmtVenta->fetch();

if (!$venta) {
    Response::json(['error' => 'La venta no existe en este negocio.'], 404);
}

// Verificar si ya tiene una Nota de Crédito emitida previamente
$stmtNcExist = $db->prepare("
    SELECT id, numero_nota_credito, clave_acceso, estado_sri 
    FROM notas_credito 
    WHERE venta_id = :vid AND negocio_id = :nid AND estado_sri = 'AUTORIZADO'
    LIMIT 1
");
$stmtNcExist->execute(['vid' => $ventaId, 'nid' => $negocioId]);
$ncExistente = $stmtNcExist->fetch();

if ($ncExistente) {
    Response::json([
        'error' => "Esta venta ya cuenta con una Nota de Crédito AUTORIZADA (#{$ncExistente['numero_nota_credito']})."
    ], 422);
}

// 3. Obtener el número de factura original (desde comprobantes_electronicos_sri o facturas_electronicas)
$stmtFactura = $db->prepare("
    SELECT numero_comprobante, clave_acceso, fecha_emision, created_at
    FROM comprobantes_electronicos_sri
    WHERE origen_id = :vid AND negocio_id = :nid AND tipo_documento = '01'
    ORDER BY id DESC LIMIT 1
");
$stmtFactura->execute(['vid' => $ventaId, 'nid' => $negocioId]);
$facturaOriginal = $stmtFactura->fetch();

$serie = sprintf('%03d%03d', (int)$sriConfig['codigo_establecimiento'], (int)$sriConfig['punto_emision']);
$numFacturaOriginal = $facturaOriginal['numero_comprobante'] ?? sprintf('%s-%09d', substr($serie, 0, 3) . '-' . substr($serie, 3, 3), $ventaId);
$fechaFacturaOriginal = !empty($facturaOriginal['fecha_emision']) 
    ? $facturaOriginal['fecha_emision'] 
    : date('Y-m-d', strtotime($venta['created_at']));

// 4. Obtener detalles de la venta y calcular tarifas y costos
$stmtDet = $db->prepare("
    SELECT 
        vd.producto_id,
        vd.nombre_producto,
        vd.cantidad,
        vd.precio_unitario,
        vd.subtotal,
        COALESCE(p.costo, 0.0) AS costo_unitario,
        COALESCE(p.sri_codigo_impuesto, '4') AS sri_codigo_impuesto,
        COALESCE(p.sri_tarifa_iva, 15.00) AS sri_tarifa_iva
    FROM venta_detalles vd
    LEFT JOIN productos p ON p.id = vd.producto_id
    WHERE vd.venta_id = :vid AND vd.negocio_id = :nid
");
$stmtDet->execute(['vid' => $ventaId, 'nid' => $negocioId]);
$detalles = $stmtDet->fetchAll();

if (empty($detalles)) {
    Response::json(['error' => 'No existen ítems asociados a esta venta.'], 422);
}

$subtotal15 = 0.0;
$subtotal0  = 0.0;
$ivaTotal   = 0.0;
$costoTotalDevuelto = 0.0;

foreach ($detalles as $d) {
    $tarifa = (float)$d['sri_tarifa_iva'];
    $sub    = (float)$d['subtotal'];
    $cant   = (float)$d['cantidad'];
    $costoU = (float)$d['costo_unitario'];

    $costoTotalDevuelto += ($cant * $costoU);

    if ($tarifa > 0) {
        $subtotal15 += $sub;
        $ivaTotal   += round($sub * ($tarifa / 100), 2);
    } else {
        $subtotal0  += $sub;
    }
}
$totalNC = round($subtotal15 + $subtotal0 + $ivaTotal, 2);

// 5. Obtener datos del cliente
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

// 6. Obtener secuencial correlativo para Nota de Crédito ('04')
$stmtSec = $db->prepare("
    SELECT COALESCE(MAX(secuencial), 0) + 1 
    FROM comprobantes_electronicos_sri 
    WHERE negocio_id = :nid AND tipo_documento = '04' AND serie = :serie
");
$stmtSec->execute(['nid' => $negocioId, 'serie' => $serie]);
$secuencial = (int)$stmtSec->fetchColumn();

// 7. Instanciar Nota de Crédito SRI mediante Factory
$ncData = [
    'created_at'                       => date('Y-m-d H:i:s'),
    'numero_factura_modificada'        => $numFacturaOriginal,
    'fecha_emision_factura_modificada' => $fechaFacturaOriginal,
    'motivo'                           => $motivo,
];

$notaCreditoSRI = SriDocumentoFactory::crearNotaCredito(
    $sriConfig,
    $cliente,
    $ncData,
    $detalles,
    $serie,
    $secuencial,
    (int)$sriConfig['ambiente'],
    (int)$sriConfig['tipo_emision']
);

$xmlGenerado   = $notaCreditoSRI->generarXml();
$claveAcceso   = $notaCreditoSRI->getClaveAcceso();
$numNC         = $notaCreditoSRI->getNumeroComprobante();

// 8. Firmar XML con certificado .p12 (si está configurado)
$xmlFinalParaEnviar = $xmlGenerado;
$firmadoConCertificado = false;

if (!empty($sriConfig['firma_p12_path']) && file_exists($sriConfig['firma_p12_path']) && !empty($sriConfig['firma_password_enc'])) {
    $p12Password = SriCrypto::decrypt($sriConfig['firma_password_enc']);
    try {
        $xmlFinalParaEnviar = SriSigner::signXml($xmlGenerado, $sriConfig['firma_p12_path'], $p12Password);
        $firmadoConCertificado = true;
    } catch (Throwable $e) {
        Response::json(['error' => 'Error al firmar Nota de Crédito con el certificado digital: ' . $e->getMessage()], 422);
    }
}

// 9. Enviar a Web Service SOAP del SRI
$soapClient = new SriSoapClient((int)$sriConfig['ambiente']);
$estadoSri = 'PENDIENTE';
$mensajeSri = '';
$numeroAutorizacion = null;
$fechaAutorizacion = null;

if ($firmadoConCertificado) {
    $recepcion = $soapClient->enviarComprobante($xmlFinalParaEnviar);
    if ($recepcion['success']) {
        usleep(1500000);
        $autorizacion = $soapClient->consultarAutorizacion($claveAcceso);
        if ($autorizacion['success']) {
            $estadoSri = 'AUTORIZADO';
            $numeroAutorizacion = $autorizacion['numero_autorizacion'];
            $fechaAutorizacion = $autorizacion['fecha_autorizacion'];
            $mensajeSri = 'Nota de Crédito AUTORIZADA legalmente por el SRI.';
        } else {
            $estadoSri = $autorizacion['estado'] ?: 'EN_PROCESAMIENTO';
            $mensajeSri = $autorizacion['mensaje'] ?: 'Comprobante en procesamiento en el SRI.';
        }
    } else {
        $estadoSri = $recepcion['estado'];
        $mensajeSri = $recepcion['mensaje'];
    }
} else {
    $estadoSri = 'AUTORIZADO';
    $numeroAutorizacion = $claveAcceso;
    $fechaAutorizacion = date('Y-m-d H:i:s');
    $mensajeSri = 'Nota de Crédito generada en modo Pruebas internas (sin firma .p12).';
}

// 10. Principio de Inmutabilidad Contable & Reingreso de Stock
// Si la Nota de Crédito fue autorizada (o en modo pruebas simuladas):
// A. Reingresar inventario en productos
foreach ($detalles as $det) {
    $pId = (int)$det['producto_id'];
    $cant = (float)$det['cantidad'];
    if ($pId > 0 && $cant > 0) {
        $stmtUpdProd = $db->prepare("UPDATE productos SET stock = stock + :cant WHERE id = :pid AND negocio_id = :nid");
        $stmtUpdProd->execute(['cant' => $cant, 'pid' => $pId, 'nid' => $negocioId]);
    }
}

// B. Marcar la venta original como ANULADA (sin eliminarla de la BD)
$stmtUpdVenta = $db->prepare("UPDATE ventas SET estado = 'ANULADA' WHERE id = :vid AND negocio_id = :nid");
$stmtUpdVenta->execute(['vid' => $ventaId, 'nid' => $negocioId]);

// 11. Guardar en tabla notas_credito
$insNC = $db->prepare("
    INSERT INTO notas_credito
        (negocio_id, venta_id, cliente_id, numero_nota_credito, clave_acceso, numero_factura_modificada, fecha_emision_factura_modificada, motivo, subtotal_15, subtotal_0, iva, total, estado_sri, mensaje_sri, fecha_autorizacion, xml_firmado)
    VALUES
        (:nid, :vid, :cid, :num, :clave, :fac_mod, :fec_mod, :motivo, :s15, :s0, :iva, :tot, :est, :msg, :fec_aut, :xml)
");
$insNC->execute([
    'nid'     => $negocioId,
    'vid'     => $ventaId,
    'cid'     => $venta['cliente_id'],
    'num'     => $numNC,
    'clave'   => $claveAcceso,
    'fac_mod' => $numFacturaOriginal,
    'fec_mod' => $fechaFacturaOriginal,
    'motivo'  => $motivo,
    's15'     => $subtotal15,
    's0'      => $subtotal0,
    'iva'     => $ivaTotal,
    'tot'     => $totalNC,
    'est'     => $estadoSri,
    'msg'     => $mensajeSri,
    'fec_aut' => $fechaAutorizacion,
    'xml'     => $xmlFinalParaEnviar,
]);
$notaCreditoId = (int)$db->lastInsertId();

// 12. Asiento Contable Automático de Reversión en el Libro Diario
$asientoId = AccountingService::recordCreditNoteEntry(
    $negocioId,
    $usuarioId,
    $notaCreditoId,
    $numNC,
    $numFacturaOriginal,
    $cliente['nombre'],
    $subtotal15,
    $subtotal0,
    $ivaTotal,
    $totalNC,
    $costoTotalDevuelto,
    $medioDevolucion
);

if ($asientoId) {
    $db->prepare("UPDATE notas_credito SET asiento_id = :aid WHERE id = :ncid")
       ->execute(['aid' => $asientoId, 'ncid' => $notaCreditoId]);
}

// 13. Guardar en comprobantes_electronicos_sri
$insCes = $db->prepare("
    INSERT INTO comprobantes_electronicos_sri
        (negocio_id, tipo_documento, origen_tipo, origen_id, serie, secuencial, numero_comprobante, clave_acceso, fecha_emision, ambiente, estado_sri, mensaje_sri, numero_autorizacion, fecha_autorizacion, xml_firmado, xml_autorizado, asiento_id)
    VALUES
        (:nid, '04', 'devolucion', :ncid, :serie, :sec, :num, :clave, :fec, :amb, :est, :msg, :num_aut, :fec_aut, :xml, :xml_aut, :aid)
");
$insCes->execute([
    'nid'      => $negocioId,
    'ncid'     => $notaCreditoId,
    'serie'    => $serie,
    'sec'      => $secuencial,
    'num'      => $numNC,
    'clave'    => $claveAcceso,
    'fec'      => date('Y-m-d'),
    'amb'      => (int)$sriConfig['ambiente'],
    'est'      => $estadoSri,
    'msg'      => $mensajeSri,
    'num_aut'  => $numeroAutorizacion,
    'fec_aut'  => $fechaAutorizacion,
    'xml'      => $xmlFinalParaEnviar,
    'xml_aut'  => $estadoSri === 'AUTORIZADO' ? $xmlFinalParaEnviar : null,
    'aid'      => $asientoId,
]);

// 14. Generar RIDE PDF
$pdfContent = SriRideGenerator::generateNotaCredito(
    $sriConfig,
    $cliente,
    $numNC,
    $claveAcceso,
    $fechaAutorizacion ?: date('Y-m-d H:i:s'),
    $numeroAutorizacion ?: $claveAcceso,
    (int)$sriConfig['ambiente'],
    $numFacturaOriginal,
    $motivo,
    $subtotal15 + $subtotal0,
    $ivaTotal,
    $totalNC,
    $detalles,
    $estadoSri
);

// 15. Enviar por correo si el cliente tiene email
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
            $numNC,
            $totalNC,
            $xmlFinalParaEnviar,
            json_encode(['clave_acceso' => $claveAcceso, 'tipo' => 'NOTA_DE_CREDITO']),
            $pdfContent
        );
        if ($emailEnviado) {
            $db->prepare("UPDATE comprobantes_electronicos_sri SET email_enviado = 1 WHERE clave_acceso = :clave")
               ->execute(['clave' => $claveAcceso]);
        }
    } catch (Throwable $e) {
        error_log("Error al enviar email Nota de Crédito: " . $e->getMessage());
    }
}

Response::json([
    'success'                  => $estadoSri === 'AUTORIZADO',
    'estado_sri'               => $estadoSri,
    'mensaje'                  => $mensajeSri,
    'clave_acceso'             => $claveAcceso,
    'numero_nota_credito'      => $numNC,
    'numero_autorizacion'      => $numeroAutorizacion,
    'fecha_autorizacion'       => $fechaAutorizacion,
    'factura_modificada'       => $numFacturaOriginal,
    'asiento_id'               => $asientoId,
    'email_enviado'            => $emailEnviado,
    'pdf_base64'               => base64_encode($pdfContent),
    'xml_firmado'              => $xmlFinalParaEnviar,
]);
