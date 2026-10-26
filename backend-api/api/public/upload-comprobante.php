<?php
declare(strict_types=1);

require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../core/Response.php';

$db = Database::getConnection();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    Response::json(['error' => 'Método no permitido'], 405);
}

$numeroPedido = trim((string)($_POST['numero_pedido'] ?? ''));
$pedidoId     = (int)($_POST['pedido_id'] ?? 0);

if (empty($numeroPedido) && $pedidoId <= 0) {
    Response::json(['error' => 'Identificador o número de pedido requerido.'], 400);
}

if (!isset($_FILES['comprobante']) || $_FILES['comprobante']['error'] !== UPLOAD_ERR_OK) {
    Response::json(['error' => 'Debes adjuntar un archivo de comprobante válido.'], 422);
}

$file = $_FILES['comprobante'];
$allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
$fileMime = mime_content_type($file['tmp_name']);

if (!in_array($fileMime, $allowedTypes, true)) {
    Response::json(['error' => 'Formato no permitido. Solo se aceptan imágenes (JPG, PNG, WEBP) o documentos PDF.'], 422);
}

if ($file['size'] > 5 * 1024 * 1024) {
    Response::json(['error' => 'El comprobante excede el tamaño máximo permitido (5 MB).'], 422);
}

// Buscar pedido
$stmt = $db->prepare("
    SELECT id, negocio_id, numero_pedido, estado, comprobante_pago_url
    FROM pedidos_web
    WHERE (id = :pid OR numero_pedido = :num)
    LIMIT 1
");
$stmt->execute([
    'pid' => $pedidoId,
    'num' => $numeroPedido ?: '---'
]);
$pedido = $stmt->fetch();

if (!$pedido) {
    Response::json(['error' => 'Pedido no encontrado.'], 404);
}

// Preparar directorio de destino
$uploadDir = __DIR__ . '/../../uploads/comprobantes_pedidos';
if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0755, true);
}

// Generar nombre seguro
$ext = pathinfo($file['name'], PATHINFO_EXTENSION);
if (empty($ext)) {
    $ext = ($fileMime === 'application/pdf') ? 'pdf' : 'jpg';
}
$cleanNum = preg_replace('/[^A-Za-z0-9_-]/', '', $pedido['numero_pedido']);
$filename = sprintf('comp_%s_%s.%s', $cleanNum, time(), strtolower($ext));
$targetPath = $uploadDir . '/' . $filename;

if (!move_uploaded_file($file['tmp_name'], $targetPath)) {
    Response::json(['error' => 'Error al guardar el archivo en el servidor.'], 500);
}

$comprobanteUrl = '/uploads/comprobantes_pedidos/' . $filename;

// Actualizar pedido
$update = $db->prepare("
    UPDATE pedidos_web
    SET comprobante_pago_url = :url
    WHERE id = :id
");
$update->execute([
    'url' => $comprobanteUrl,
    'id'  => $pedido['id']
]);

Response::json([
    'success'         => true,
    'mensaje'         => 'Comprobante de pago recibido y guardado con éxito.',
    'pedido_id'       => (int)$pedido['id'],
    'numero_pedido'   => $pedido['numero_pedido'],
    'comprobante_url' => $comprobanteUrl
]);
