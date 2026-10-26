<?php
declare(strict_types=1);

require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../core/AuthMiddleware.php';
require_once __DIR__ . '/../../core/ElectronicInvoiceService.php';
require_once __DIR__ . '/../../core/PdfInvoiceGenerator.php';
require_once __DIR__ . '/../../core/Response.php';

$session   = AuthMiddleware::authenticate();
$negocioId = (int)$session['negocio_id'];
$db        = Database::getConnection();

$clienteId = (int)($_GET['cliente_id'] ?? 0);
if ($clienteId <= 0) {
    Response::json(['error' => 'ID de cliente requerido.'], 400);
}

// 1. Verificar cliente
$stmtCli = $db->prepare("SELECT id, documento, nombre, email, telefono, direccion, saldo_pendiente FROM clientes WHERE id = :cid AND negocio_id = :nid LIMIT 1");
$stmtCli->execute(['cid' => $clienteId, 'nid' => $negocioId]);
$cliente = $stmtCli->fetch();

if (!$cliente) {
    Response::json(['error' => 'Cliente no encontrado.'], 404);
}

// 2. Obtener historial de compras del cliente
$stmtVentas = $db->prepare("
    SELECT 
        v.id AS venta_id,
        v.created_at AS fecha,
        v.metodo_pago,
        v.subtotal,
        v.impuesto,
        v.total,
        v.estado,
        f.id AS factura_id,
        f.numero_comprobante,
        f.cufe_hash,
        f.xml_content
    FROM ventas v
    LEFT JOIN facturas_electronicas f ON f.venta_id = v.id
    WHERE v.negocio_id = :nid AND v.cliente_id = :cid
    ORDER BY v.created_at DESC
");
$stmtVentas->execute(['nid' => $negocioId, 'cid' => $clienteId]);
$ventas = $stmtVentas->fetchAll();

// 3. Para cada venta, obtener sus productos y generar el PDF base64 si tiene factura
$stmtNeg = $db->prepare("SELECT id, nombre, ruc_nit, telefono, direccion, logo_url FROM negocios WHERE id = :nid LIMIT 1");
$stmtNeg->execute(['nid' => $negocioId]);
$negocio = $stmtNeg->fetch();

$comprasConDetalle = [];
$stmtDetalles = $db->prepare("
    SELECT producto_id, nombre_producto, cantidad, precio_unitario, subtotal
    FROM venta_detalles
    WHERE venta_id = :vid AND negocio_id = :nid
");

foreach ($ventas as $v) {
    $stmtDetalles->execute(['vid' => $v['venta_id'], 'nid' => $negocioId]);
    $detalles = $stmtDetalles->fetchAll();

    $pdfBase64 = null;
    if (!empty($v['numero_comprobante'])) {
        try {
            $pdfBin = PdfInvoiceGenerator::generate(
                $negocio,
                $cliente,
                $v['numero_comprobante'],
                $v['fecha'],
                (float)$v['subtotal'],
                (float)$v['impuesto'],
                (float)$v['total'],
                $v['metodo_pago'],
                $detalles
            );
            $pdfBase64 = base64_encode($pdfBin);
        } catch (Throwable $e) {
            $pdfBase64 = null;
        }
    }

    $comprasConDetalle[] = [
        'venta_id'           => (int)$v['venta_id'],
        'fecha'              => $v['fecha'],
        'metodo_pago'        => $v['metodo_pago'],
        'subtotal'           => (float)$v['subtotal'],
        'impuesto'           => (float)$v['impuesto'],
        'total'              => (float)$v['total'],
        'estado'             => $v['estado'],
        'numero_comprobante' => $v['numero_comprobante'],
        'pdf_base64'         => $pdfBase64,
        'detalles'           => $detalles
    ];
}

Response::json([
    'cliente' => $cliente,
    'compras' => $comprasConDetalle
]);
