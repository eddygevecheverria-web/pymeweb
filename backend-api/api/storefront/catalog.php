<?php
declare(strict_types=1);

require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../core/Response.php';

$slug = strtolower(trim($_GET['slug'] ?? ''));
if ($slug === '') {
    Response::json(['error' => 'Slug de tienda requerido.'], 400);
}

$db = Database::getConnection();
$stmt = $db->prepare("
    SELECT id, nombre, slug, telefono, direccion, logo_url, estado, fecha_expiracion
    FROM negocios
    WHERE slug = :slug
    LIMIT 1
");
$stmt->execute(['slug' => $slug]);
$negocio = $stmt->fetch();

if (!$negocio) {
    Response::json(['error' => 'Tienda no encontrada.', 'code' => 'STORE_NOT_FOUND'], 404);
}

$ahora      = new DateTimeImmutable('now');
$expiracion = new DateTimeImmutable($negocio['fecha_expiracion']);

if ($negocio['estado'] === 'inactivo' || $ahora > $expiracion) {
    if ($negocio['estado'] !== 'inactivo' && $ahora > $expiracion) {
        $upd = $db->prepare("UPDATE negocios SET estado = 'inactivo' WHERE id = :id");
        $upd->execute(['id' => $negocio['id']]);
    }

    Response::json([
        'available'      => false,
        'code'           => 'STORE_UNAVAILABLE',
        'negocio_nombre' => $negocio['nombre'],
        'logo_url'       => $negocio['logo_url'],
        'message'        => 'Tienda temporalmente fuera de servicio.'
    ], 403);
}

$stmtProd = $db->prepare("
    SELECT p.id, p.categoria_id, c.nombre AS categoria_nombre, p.nombre, p.descripcion, p.precio_venta, p.stock, p.imagen_url
    FROM productos p
    LEFT JOIN categorias c ON c.id = p.categoria_id
    WHERE p.negocio_id = :nid AND p.activo = 1 AND p.stock > 0
    ORDER BY c.nombre ASC, p.nombre ASC
");
$stmtProd->execute(['nid' => $negocio['id']]);

$stmtCat = $db->prepare("
    SELECT id, nombre, descripcion 
    FROM categorias 
    WHERE negocio_id = :nid 
    ORDER BY nombre ASC
");
$stmtCat->execute(['nid' => $negocio['id']]);

Response::json([
    'available'  => true,
    'store'      => [
        'id'        => (int)$negocio['id'],
        'nombre'    => $negocio['nombre'],
        'slug'      => $negocio['slug'],
        'telefono'  => $negocio['telefono'],
        'direccion' => $negocio['direccion'],
        'logo_url'  => $negocio['logo_url'],
    ],
    'categories' => $stmtCat->fetchAll(),
    'products'   => $stmtProd->fetchAll()
]);
