<?php
declare(strict_types=1);

require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../core/AuthMiddleware.php';
require_once __DIR__ . '/../../core/ElectronicInvoiceService.php';
require_once __DIR__ . '/../../core/MailerService.php';
require_once __DIR__ . '/../../core/Response.php';

$session   = AuthMiddleware::authenticate();
$negocioId = (int)$session['negocio_id'];
$db        = Database::getConnection();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $ventaId = (int)($_GET['venta_id'] ?? 0);
    if ($ventaId <= 0) {
        Response::json(['error' => 'ID de venta requerido.'], 422);
    }

    $stmtVenta = $db->prepare("
        SELECT id, cliente_id, metodo_pago, comprobante_transferencia, subtotal, impuesto, total, monto_recibido, vuelto, created_at, origen
        FROM ventas
        WHERE id = :vid AND negocio_id = :nid
        LIMIT 1
    ");
    $stmtVenta->execute(['vid' => $ventaId, 'nid' => $negocioId]);
    $venta = $stmtVenta->fetch();

    if (!$venta) {
        Response::json(['error' => 'La venta no existe en tu negocio.'], 404);
    }

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
    $items = $stmtDet->fetchAll();

    $stmtNeg = $db->prepare("SELECT id, nombre, ruc_nit, telefono, direccion, logo_url FROM negocios WHERE id = :nid");
    $stmtNeg->execute(['nid' => $negocioId]);
    $negocio = $stmtNeg->fetch();

    $cliente = [
        'documento' => '9999999999999',
        'nombre'    => 'CONSUMIDOR FINAL',
        'email'     => '',
        'telefono'  => '',
        'direccion' => '',
    ];
    if ($venta['cliente_id']) {
        $stmtCli = $db->prepare("SELECT id, documento, nombre, email, telefono, direccion FROM clientes WHERE id = :cid AND negocio_id = :nid");
        $stmtCli->execute(['cid' => $venta['cliente_id'], 'nid' => $negocioId]);
        if ($rowCli = $stmtCli->fetch()) {
            $cliente = array_merge($cliente, array_filter($rowCli));
        }
    }

    $stmtSri = $db->prepare("SELECT * FROM configuracion_sri WHERE negocio_id = :nid LIMIT 1");
    $stmtSri->execute(['nid' => $negocioId]);
    $sriConfig = $stmtSri->fetch() ?: null;

    $stmtFact = $db->prepare("
        SELECT id, numero_comprobante, clave_acceso, estado_sri, ambiente_sri, fecha_emision, email_enviado
        FROM facturas_electronicas
        WHERE venta_id = :vid AND negocio_id = :nid
        LIMIT 1
    ");
    $stmtFact->execute(['vid' => $ventaId, 'nid' => $negocioId]);
    $factura = $stmtFact->fetch() ?: null;

    Response::json([
        'success'   => true,
        'venta'     => $venta,
        'items'     => $items,
        'cliente'   => $cliente,
        'negocio'   => $negocio,
        'sri'       => $sriConfig,
        'factura'   => $factura,
    ]);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    Response::json(['error' => 'Método no permitido'], 405);
}

$input        = json_decode(file_get_contents('php://input'), true) ?? [];
$ventaId      = (int)($input['venta_id'] ?? 0);
$clienteId    = !empty($input['cliente_id']) ? (int)$input['cliente_id'] : null;
$emailDestino = strtolower(trim($input['email'] ?? ''));

if ($ventaId <= 0) {
    Response::json(['error' => 'ID de venta requerido.'], 422);
}

$stmtVenta = $db->prepare("
    SELECT id, cliente_id, subtotal, impuesto, total, created_at
    FROM ventas
    WHERE id = :vid AND negocio_id = :nid
    LIMIT 1
");
$stmtVenta->execute(['vid' => $ventaId, 'nid' => $negocioId]);
$venta = $stmtVenta->fetch();

if (!$venta) {
    Response::json(['error' => 'La venta no existe en tu negocio.'], 404);
}

$stmtDet = $db->prepare("
    SELECT producto_id, nombre_producto, cantidad, precio_unitario, subtotal
    FROM venta_detalles
    WHERE venta_id = :vid AND negocio_id = :nid
");
$stmtDet->execute(['vid' => $ventaId, 'nid' => $negocioId]);
$detalles = $stmtDet->fetchAll();

$stmtNeg = $db->prepare("SELECT id, nombre, ruc_nit, telefono, direccion, logo_url FROM negocios WHERE id = :nid");
$stmtNeg->execute(['nid' => $negocioId]);
$negocio = $stmtNeg->fetch();

$cidFinal = $clienteId ?: $venta['cliente_id'];
$cliente = ['documento' => '99999999', 'nombre' => 'Consumidor Final', 'email' => $emailDestino, 'direccion' => ''];
if ($cidFinal) {
    $stmtCli = $db->prepare("SELECT id, documento, nombre, email, direccion FROM clientes WHERE id = :cid AND negocio_id = :nid");
    $stmtCli->execute(['cid' => $cidFinal, 'nid' => $negocioId]);
    if ($rowCli = $stmtCli->fetch()) {
        $cliente = $rowCli;
        if ($emailDestino !== '') {
            $cliente['email'] = $emailDestino;
        }
    }
}

$stmtCorr = $db->prepare("
    SELECT COALESCE(MAX(correlativo), 0) + 1 
    FROM facturas_electronicas 
    WHERE negocio_id = :nid AND serie = 'F001'
");
$stmtCorr->execute(['nid' => $negocioId]);
$correlativo = (int)$stmtCorr->fetchColumn();

$comprobante = ElectronicInvoiceService::buildXmlAndJson(
    $negocio,
    $cliente,
    $venta,
    $detalles,
    'F001',
    $correlativo
);

$emailEnviado = false;
if (!empty($cliente['email']) && filter_var($cliente['email'], FILTER_VALIDATE_EMAIL)) {
    $emailEnviado = MailerService::sendInvoiceEmail(
        $cliente['email'],
        $cliente['nombre'],
        $negocio,
        $comprobante['numero_comprobante'],
        (float)$venta['total'],
        $comprobante['xml'],
        $comprobante['json']
    );
}

$ins = $db->prepare("
    INSERT INTO facturas_electronicas
        (negocio_id, venta_id, cliente_id, serie, correlativo, numero_comprobante, cufe_hash, xml_content, json_content, email_enviado)
    VALUES
        (:nid, :vid, :cid, 'F001', :corr, :num, :hash, :xml, :json, :enviado)
    ON DUPLICATE KEY UPDATE
        email_enviado = VALUES(email_enviado)
");
$ins->execute([
    'nid'     => $negocioId,
    'vid'     => $ventaId,
    'cid'     => $cidFinal,
    'corr'    => $correlativo,
    'num'     => $comprobante['numero_comprobante'],
    'hash'    => $comprobante['cufe_hash'],
    'xml'     => $comprobante['xml'],
    'json'    => $comprobante['json'],
    'enviado' => $emailEnviado ? 1 : 0
]);

$updVenta = $db->prepare("UPDATE ventas SET comprobante_xml_json = :json WHERE id = :vid AND negocio_id = :nid");
$updVenta->execute(['json' => $comprobante['json'], 'vid' => $ventaId, 'nid' => $negocioId]);

Response::json([
    'message'            => $emailEnviado
        ? "Factura {$comprobante['numero_comprobante']} generada y enviada a {$cliente['email']}"
        : "Factura {$comprobante['numero_comprobante']} generada correctamente.",
    'numero_comprobante' => $comprobante['numero_comprobante'],
    'cufe_hash'          => $comprobante['cufe_hash'],
    'email_enviado'      => $emailEnviado,
    'xml'                => $comprobante['xml'],
    'json'               => json_decode($comprobante['json'], true)
]);
