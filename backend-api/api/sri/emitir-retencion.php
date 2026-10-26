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
require_once __DIR__ . '/../../core/Response.php';

$session   = AuthMiddleware::authenticate();
$negocioId = (int)$session['negocio_id'];
$usuarioId = (int)$session['user_id'];
$db        = Database::getConnection();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    Response::json(['error' => 'Método no permitido'], 405);
}

$input     = json_decode(file_get_contents('php://input'), true) ?? [];
$compraId  = (int)($input['compra_id'] ?? 0);
$retList   = (array)($input['retenciones'] ?? []);

if ($compraId <= 0) {
    Response::json(['error' => 'ID de compra requerido para emitir el Comprobante de Retención.'], 422);
}

// 1. Configuración SRI
$stmtCfg = $db->prepare("SELECT * FROM configuracion_sri WHERE negocio_id = :nid LIMIT 1");
$stmtCfg->execute(['nid' => $negocioId]);
$sriConfig = $stmtCfg->fetch();

if (!$sriConfig) {
    Response::json(['error' => 'No has configurado los datos de Facturación Electrónica SRI.'], 400);
}

// 2. Obtener compra y proveedor
$stmtCompra = $db->prepare("
    SELECT c.*, p.razon_social, p.ruc_cedula, p.email, p.direccion
    FROM compras c
    LEFT JOIN proveedores p ON p.id = c.proveedor_id
    WHERE c.id = :cid AND c.negocio_id = :nid
    LIMIT 1
");
$stmtCompra->execute(['cid' => $compraId, 'nid' => $negocioId]);
$compra = $stmtCompra->fetch();

if (!$compra) {
    Response::json(['error' => 'La compra especificada no existe en este negocio.'], 404);
}

// Si no enviaron desglose manual de retenciones, autocalcular con base en la compra
if (empty($retList)) {
    $baseRenta = (float)$compra['subtotal'];
    $baseIva   = (float)$compra['iva'];
    $retList   = [];

    // Retención Renta 1.75% por defecto para bienes
    if ($baseRenta > 0) {
        $retList[] = [
            'codigo_impuesto'  => 1, // 1 = Renta
            'codigo_retencion' => '312', // Transferencia de bienes muebles
            'base_imponible'   => $baseRenta,
            'porcentaje'       => 1.75,
            'valor_retenido'   => round($baseRenta * 0.0175, 2)
        ];
    }
    // Retención IVA 30% si hubo IVA
    if ($baseIva > 0) {
        $retList[] = [
            'codigo_impuesto'  => 2, // 2 = IVA
            'codigo_retencion' => '1', // 30% retención IVA en bienes
            'base_imponible'   => $baseIva,
            'porcentaje'       => 30.00,
            'valor_retenido'   => round($baseIva * 0.30, 2)
        ];
    }
}

$totalRetenido = 0.0;
foreach ($retList as $r) {
    $totalRetenido += (float)($r['valor_retenido'] ?? 0.0);
}
$totalRetenido = round($totalRetenido, 2);

// 3. Sujeto retenido (Proveedor)
$sujeto = [
    'razon_social' => $compra['razon_social'] ?? 'PROVEEDOR',
    'ruc'          => $compra['ruc_cedula'] ?? '1790011122001',
    'email'        => $compra['email'] ?? '',
    'direccion'    => $compra['direccion'] ?? 'Ecuador',
];

// Transacción sustento
$transaccion = [
    'created_at'     => date('Y-m-d H:i:s'),
    'numero_factura' => $compra['numero_factura'] ?? '001-001-000000001',
    'fecha_emision'  => $compra['fecha_emision'] ?? date('Y-m-d'),
];

// 4. Secuencial correlativo para Retención ('07')
$serie = sprintf('%03d%03d', (int)$sriConfig['codigo_establecimiento'], (int)$sriConfig['punto_emision']);
$stmtSec = $db->prepare("
    SELECT COALESCE(MAX(secuencial), 0) + 1 
    FROM comprobantes_electronicos_sri 
    WHERE negocio_id = :nid AND tipo_documento = '07' AND serie = :serie
");
$stmtSec->execute(['nid' => $negocioId, 'serie' => $serie]);
$secuencial = (int)$stmtSec->fetchColumn();

// 5. Instanciar Comprobante de Retención SRI mediante Factory
$retencionSRI = SriDocumentoFactory::crearRetencion(
    $sriConfig,
    $sujeto,
    $transaccion,
    $retList,
    $serie,
    $secuencial,
    (int)$sriConfig['ambiente'],
    (int)$sriConfig['tipo_emision']
);

$xmlGenerado = $retencionSRI->generarXml();
$claveAcceso = $retencionSRI->getClaveAcceso();
$numRet      = $retencionSRI->getNumeroComprobante();

// 6. Firmar XML con certificado .p12 (si está configurado)
$xmlFinalParaEnviar = $xmlGenerado;
$firmadoConCertificado = false;

if (!empty($sriConfig['firma_p12_path']) && file_exists($sriConfig['firma_p12_path']) && !empty($sriConfig['firma_password_enc'])) {
    $p12Password = SriCrypto::decrypt($sriConfig['firma_password_enc']);
    try {
        $xmlFinalParaEnviar = SriSigner::signXml($xmlGenerado, $sriConfig['firma_p12_path'], $p12Password);
        $firmadoConCertificado = true;
    } catch (Throwable $e) {
        Response::json(['error' => 'Error al firmar Comprobante de Retención con certificado: ' . $e->getMessage()], 422);
    }
}

// 7. Enviar a Web Service SOAP del SRI
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
            $mensajeSri = 'Comprobante de Retención AUTORIZADO legalmente por el SRI.';
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
    $mensajeSri = 'Comprobante de Retención generado en modo Pruebas internas (sin firma .p12).';
}

// 8. Guardar en comprobantes_electronicos_sri
$insCes = $db->prepare("
    INSERT INTO comprobantes_electronicos_sri
        (negocio_id, tipo_documento, origen_tipo, origen_id, serie, secuencial, numero_comprobante, clave_acceso, fecha_emision, ambiente, estado_sri, mensaje_sri, numero_autorizacion, fecha_autorizacion, xml_firmado, xml_autorizado, email_enviado)
    VALUES
        (:nid, '07', 'compra', :cid, :serie, :sec, :num, :clave, :fec, :amb, :est, :msg, :num_aut, :fec_aut, :xml, :xml_aut, 0)
    ON DUPLICATE KEY UPDATE
        estado_sri = VALUES(estado_sri),
        mensaje_sri = VALUES(mensaje_sri),
        numero_autorizacion = VALUES(numero_autorizacion),
        fecha_autorizacion = VALUES(fecha_autorizacion),
        xml_autorizado = VALUES(xml_autorizado)
");
$insCes->execute([
    'nid'      => $negocioId,
    'cid'      => $compraId,
    'serie'    => $serie,
    'sec'      => $secuencial,
    'num'      => $numRet,
    'clave'    => $claveAcceso,
    'fec'      => date('Y-m-d'),
    'amb'      => (int)$sriConfig['ambiente'],
    'est'      => $estadoSri,
    'msg'      => $mensajeSri,
    'num_aut'  => $numeroAutorizacion,
    'fec_aut'  => $fechaAutorizacion,
    'xml'      => $xmlFinalParaEnviar,
    'xml_aut'  => $estadoSri === 'AUTORIZADO' ? $xmlFinalParaEnviar : null,
]);

// 9. Generar RIDE PDF
$pdfContent = SriRideGenerator::generateRetencion(
    $sriConfig,
    $sujeto,
    $numRet,
    $claveAcceso,
    $fechaAutorizacion ?: date('Y-m-d H:i:s'),
    $numeroAutorizacion ?: $claveAcceso,
    (int)$sriConfig['ambiente'],
    $transaccion['numero_factura'],
    $transaccion['fecha_emision'],
    $retList,
    $totalRetenido,
    $estadoSri
);

Response::json([
    'success'             => $estadoSri === 'AUTORIZADO',
    'estado_sri'          => $estadoSri,
    'mensaje'             => $mensajeSri,
    'clave_acceso'        => $claveAcceso,
    'numero_comprobante'  => $numRet,
    'numero_autorizacion' => $numeroAutorizacion,
    'fecha_autorizacion'  => $fechaAutorizacion,
    'total_retenido'      => $totalRetenido,
    'detalles_retencion'  => $retList,
    'pdf_base64'          => base64_encode($pdfContent),
    'xml_firmado'         => $xmlFinalParaEnviar,
]);
