<?php
declare(strict_types=1);

require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../core/ImageUploader.php';
require_once __DIR__ . '/../../core/Response.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    Response::json(['error' => 'Método no permitido'], 405);
}

$slug             = strtolower(trim($_POST['slug'] ?? ''));
$clienteNombre    = trim($_POST['cliente_nombre'] ?? '');
$clienteTelefono  = trim($_POST['cliente_telefono'] ?? '');
$clienteEmail     = strtolower(trim($_POST['cliente_email'] ?? ''));
$direccionEntrega = trim($_POST['direccion_entrega'] ?? '');
$modalidadPago    = $_POST['modalidad_pago'] ?? 'transferencia';
$referenciaPago   = trim($_POST['referencia_pago'] ?? '');
$itemsJson        = $_POST['items'] ?? '[]';
$items            = json_decode($itemsJson, true);

if (!$slug || !$clienteNombre || !$clienteTelefono || empty($items) || !is_array($items)) {
    Response::json(['error' => 'Completa tus datos de contacto y agrega al menos un producto.'], 422);
}

$db = Database::getConnection();

$stmtNeg = $db->prepare("
    SELECT n.id, n.nombre, n.telefono, n.estado, n.fecha_expiracion, u.email AS dueno_email
    FROM negocios n
    LEFT JOIN usuarios u ON u.negocio_id = n.id AND u.rol = 'admin_negocio'
    WHERE n.slug = :slug
    LIMIT 1
");
$stmtNeg->execute(['slug' => $slug]);
$negocio = $stmtNeg->fetch();

if (!$negocio) {
    Response::json(['error' => 'Tienda no encontrada.'], 404);
}

if ($negocio['estado'] === 'inactivo' || new DateTimeImmutable('now') > new DateTimeImmutable($negocio['fecha_expiracion'])) {
    Response::json(['error' => 'Tienda temporalmente fuera de servicio.'], 403);
}

$negocioId = (int)$negocio['id'];

$comprobanteUrl = null;
if ($modalidadPago === 'transferencia' && !empty($_FILES['comprobante']['name'])) {
    try {
        $comprobanteUrl = ImageUploader::uploadAndOptimize($_FILES['comprobante'], "comprobantes/{$negocioId}", 800);
    } catch (Throwable $e) {
        Response::json(['error' => $e->getMessage()], 422);
    }
}

try {
    $db->beginTransaction();

    $totalPedido        = 0.0;
    $detallesPreparados = [];

    $stmtProd = $db->prepare("
        SELECT id, nombre, precio_compra, precio_venta, stock
        FROM productos
        WHERE id = :id AND negocio_id = :nid AND activo = 1
        FOR UPDATE
    ");

    foreach ($items as $item) {
        $prodId   = (int)($item['producto_id'] ?? 0);
        $cantidad = (int)($item['cantidad'] ?? 0);

        if ($prodId <= 0 || $cantidad <= 0) {
            throw new RuntimeException('Cantidad inválida en el pedido.');
        }

        $stmtProd->execute(['id' => $prodId, 'nid' => $negocioId]);
        $prod = $stmtProd->fetch();

        if (!$prod || (int)$prod['stock'] < $cantidad) {
            $disp = $prod ? $prod['stock'] : 0;
            $nom  = $prod ? $prod['nombre'] : "#{$prodId}";
            throw new RuntimeException("Stock insuficiente para '{$nom}' (Disponible: {$disp}).");
        }

        $precioUnit   = (float)$prod['precio_venta'];
        $subtotalItem = round($precioUnit * $cantidad, 2);
        $totalPedido += $subtotalItem;

        $detallesPreparados[] = [
            'producto_id'            => (int)$prod['id'],
            'nombre_producto'        => $prod['nombre'],
            'cantidad'               => $cantidad,
            'precio_compra_unitario' => (float)$prod['precio_compra'],
            'precio_unitario'        => $precioUnit,
            'subtotal'               => $subtotalItem
        ];
    }

    $totalPedido = round($totalPedido, 2);
    $subtotal    = round($totalPedido / 1.18, 2);
    $impuesto    = round($totalPedido - $subtotal, 2);
    $metodoVenta = $modalidadPago === 'online' ? 'tarjeta' : 'transferencia';

    $stmtVenta = $db->prepare("
        INSERT INTO ventas
            (negocio_id, origen, metodo_pago, subtotal, impuesto, total, monto_recibido, vuelto, estado)
        VALUES
            (:nid, 'web', :metodo, :sub, :imp, :tot, :recibido, 0.00, 'completada')
    ");
    $stmtVenta->execute([
        'nid'      => $negocioId,
        'metodo'   => $metodoVenta,
        'sub'      => $subtotal,
        'imp'      => $impuesto,
        'tot'      => $totalPedido,
        'recibido' => $totalPedido
    ]);
    $ventaId = (int)$db->lastInsertId();

    $stmtDet = $db->prepare("
        INSERT INTO venta_detalles
            (venta_id, negocio_id, producto_id, nombre_producto, cantidad, precio_compra_unitario, precio_unitario, subtotal)
        VALUES
            (:vid, :nid, :pid, :nom, :cant, :pcompra, :pventa, :sub)
    ");
    $stmtStock = $db->prepare("
        UPDATE productos
        SET stock = stock - :cant
        WHERE id = :pid AND negocio_id = :nid
    ");

    foreach ($detallesPreparados as $det) {
        $stmtDet->execute([
            'vid'     => $ventaId,
            'nid'     => $negocioId,
            'pid'     => $det['producto_id'],
            'nom'     => $det['nombre_producto'],
            'cant'    => $det['cantidad'],
            'pcompra' => $det['precio_compra_unitario'],
            'pventa'  => $det['precio_unitario'],
            'sub'     => $det['subtotal']
        ]);

        $stmtStock->execute([
            'cant' => $det['cantidad'],
            'pid'  => $det['producto_id'],
            'nid'  => $negocioId
        ]);
    }

    $stmtPed = $db->prepare("
        INSERT INTO pedidos_web
            (negocio_id, venta_id, cliente_nombre, cliente_telefono, cliente_email, direccion_entrega, modalidad_pago, comprobante_url, referencia_pago)
        VALUES
            (:nid, :vid, :nom, :tel, :email, :dir, :mod, :comp, :ref)
    ");
    $stmtPed->execute([
        'nid'   => $negocioId,
        'vid'   => $ventaId,
        'nom'   => $clienteNombre,
        'tel'   => $clienteTelefono,
        'email' => $clienteEmail ?: null,
        'dir'   => $direccionEntrega ?: null,
        'mod'   => $modalidadPago,
        'comp'  => $comprobanteUrl,
        'ref'   => $referenciaPago ?: null
    ]);
    $pedidoId = (int)$db->lastInsertId();

    $db->commit();

    if (!empty($negocio['dueno_email'])) {
        $asunto = "Nuevo Pedido Web #{$pedidoId} en {$negocio['nombre']} ($" . number_format($totalPedido, 2) . ")";
        $cuerpo = "Hola,\n\nHas recibido el Pedido Web #{$pedidoId} de {$clienteNombre} ({$clienteTelefono}).\nTotal: $" . number_format($totalPedido, 2) . "\nModalidad: {$modalidadPago}\nEl stock de tu inventario ya fue descontado automáticamente.";
        @mail($negocio['dueno_email'], $asunto, $cuerpo, "From: notificaciones@pymeweb.com");
    }

    Response::json([
        'message'        => '¡Pedido recibido con éxito! El stock ha sido reservado.',
        'pedido_id'      => $pedidoId,
        'venta_id'       => $ventaId,
        'total'          => $totalPedido,
        'store_telefono' => $negocio['telefono']
    ], 201);
} catch (Throwable $e) {
    $db->rollBack();
    Response::json(['error' => $e->getMessage()], 400);
}
