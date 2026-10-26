<?php
declare(strict_types=1);

require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../core/Response.php';

$db = Database::getConnection();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    Response::json(['error' => 'Método no permitido'], 405);
}

$slug = trim((string)($_GET['slug'] ?? ''));

if (empty($slug)) {
    Response::json(['error' => 'Identificador o slug del negocio requerido.'], 400);
}

// 1. Buscar negocio por slug (o id numérico como fallback)
$stmtNeg = $db->prepare("
    SELECT 
        id, nombre, slug, descripcion, ruc_nit, telefono, direccion, ciudad, logo_url,
        datos_bancarios, whatsapp_contacto, costo_envio_fijo, costo_envio_local, costo_envio_nacional, tienda_online_activa,
        estado, fecha_registro, fecha_expiracion
    FROM negocios
    WHERE slug = :slug OR id = :id_alt
    LIMIT 1
");
$stmtNeg->execute([
    'slug'   => $slug,
    'id_alt' => is_numeric($slug) ? (int)$slug : 0
]);
$negocio = $stmtNeg->fetch();

if (!$negocio) {
    Response::json([
        'activo'  => false,
        'motivo'  => 'no_encontrado',
        'mensaje' => 'La tienda solicitada no existe en PymeWeb ERP.'
    ], 404);
}

$negocioId = (int)$negocio['id'];
$ahora = date('Y-m-d H:i:s');
$expiracion = $negocio['fecha_expiracion'];

// 2. Validación de Estado de Suscripción SaaS (Muro de Pago)
if ($negocio['estado'] === 'inactivo') {
    Response::json([
        'activo'  => false,
        'motivo'  => 'suspendido',
        'mensaje' => 'Esta tienda se encuentra temporalmente suspendida por el administrador.',
        'negocio' => [
            'nombre'   => $negocio['nombre'],
            'logo_url' => $negocio['logo_url'],
        ]
    ], 403);
}

if ($expiracion && $ahora > $expiracion) {
    Response::json([
        'activo'  => false,
        'motivo'  => 'muro_pago',
        'mensaje' => 'El plan de suscripción de esta tienda ha expirado. Para reactivar el catálogo online, el dueño del negocio debe renovar su cuenta en PymeWeb ERP.',
        'negocio' => [
            'nombre'   => $negocio['nombre'],
            'logo_url' => $negocio['logo_url'],
        ]
    ], 403);
}

if ((int)$negocio['tienda_online_activa'] === 0) {
    Response::json([
        'activo'  => false,
        'motivo'  => 'inactiva',
        'mensaje' => 'La tienda online de este negocio está en mantenimiento momentáneamente.',
        'negocio' => [
            'nombre'   => $negocio['nombre'],
            'logo_url' => $negocio['logo_url'],
        ]
    ], 200);
}

// 3. Obtener categorías activas que tengan al menos 1 producto con stock
$stmtCat = $db->prepare("
    SELECT c.id, c.nombre, COUNT(p.id) AS total_productos
    FROM categorias c
    JOIN productos p ON p.categoria_id = c.id AND p.activo = 1 AND p.stock > 0
    WHERE c.negocio_id = :nid
    GROUP BY c.id
    ORDER BY c.nombre ASC
");
$stmtCat->execute(['nid' => $negocioId]);
$categorias = $stmtCat->fetchAll();

// 4. Obtener productos activos con stock disponible
$categoriaId = isset($_GET['categoria_id']) ? (int)$_GET['categoria_id'] : 0;
$sqlProd = "
    SELECT 
        p.id, p.categoria_id, c.nombre AS categoria_nombre,
        p.nombre, p.descripcion, p.codigo_barra,
        p.precio_venta, p.stock, p.imagen_url,
        COALESCE(p.sri_tarifa_iva, 15.00) AS tarifa_iva
    FROM productos p
    LEFT JOIN categorias c ON c.id = p.categoria_id
    WHERE p.negocio_id = :nid AND p.activo = 1 AND p.stock > 0
";
$paramsProd = ['nid' => $negocioId];

if ($categoriaId > 0) {
    $sqlProd .= " AND p.categoria_id = :cid";
    $paramsProd['cid'] = $categoriaId;
}

$sqlProd .= " ORDER BY p.nombre ASC";
$stmtProd = $db->prepare($sqlProd);
$stmtProd->execute($paramsProd);
$productos = $stmtProd->fetchAll();

Response::json([
    'activo'     => true,
    'motivo'     => 'ok',
    'negocio'    => [
        'id'                   => $negocioId,
        'nombre'               => $negocio['nombre'],
        'slug'                 => $negocio['slug'],
        'descripcion'          => $negocio['descripcion'] ?: 'Catálogo oficial de productos.',
        'logo_url'             => $negocio['logo_url'],
        'telefono'             => $negocio['telefono'],
        'whatsapp_contacto'    => $negocio['whatsapp_contacto'] ?: $negocio['telefono'],
        'direccion'            => $negocio['direccion'],
        'ciudad'               => $negocio['ciudad'] ?: 'Ibarra',
        'costo_envio_fijo'     => round((float)$negocio['costo_envio_fijo'], 2),
        'costo_envio_local'    => round((float)($negocio['costo_envio_local'] ?? 2.00), 2),
        'costo_envio_nacional' => round((float)($negocio['costo_envio_nacional'] ?? 5.00), 2),
        'datos_bancarios'      => $negocio['datos_bancarios'] ?: 'Transferencia bancaria directa a las cuentas del negocio.',
    ],
    'tienda'     => [
        'id'                   => $negocioId,
        'nombre'               => $negocio['nombre'],
        'slug'                 => $negocio['slug'],
        'descripcion'          => $negocio['descripcion'] ?: 'Catálogo oficial de productos.',
        'logo_url'             => $negocio['logo_url'],
        'telefono'             => $negocio['telefono'],
        'whatsapp_contacto'    => $negocio['whatsapp_contacto'] ?: $negocio['telefono'],
        'direccion'            => $negocio['direccion'],
        'ciudad'               => $negocio['ciudad'] ?: 'Ibarra',
        'costo_envio_fijo'     => round((float)$negocio['costo_envio_fijo'], 2),
        'costo_envio_local'    => round((float)($negocio['costo_envio_local'] ?? 2.00), 2),
        'costo_envio_nacional' => round((float)($negocio['costo_envio_nacional'] ?? 5.00), 2),
        'datos_bancarios'      => $negocio['datos_bancarios'] ?: 'Transferencia bancaria directa a las cuentas del negocio.',
    ],
    'categorias' => $categorias,
    'productos'  => array_map(function($p) {
        return [
            'id'               => (int)$p['id'],
            'categoria_id'     => $p['categoria_id'] ? (int)$p['categoria_id'] : null,
            'categoria_nombre' => $p['categoria_nombre'] ?? 'General',
            'nombre'           => $p['nombre'],
            'descripcion'      => $p['descripcion'] ?? '',
            'codigo_barra'     => $p['codigo_barra'] ?? '',
            'precio_venta'     => round((float)$p['precio_venta'], 2),
            'stock'            => (int)$p['stock'],
            'imagen_url'       => $p['imagen_url'],
            'tarifa_iva'       => (float)$p['tarifa_iva'],
        ];
    }, $productos),
]);
