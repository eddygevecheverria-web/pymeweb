<?php
declare(strict_types=1);

require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../core/AuthMiddleware.php';
require_once __DIR__ . '/../../core/Response.php';

$session   = AuthMiddleware::authenticate();
$negocioId = (int)$session['negocio_id'];
$db        = Database::getConnection();
$method    = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $stmt = $db->prepare("
        SELECT 
            c.id, 
            c.nombre, 
            c.descripcion, 
            c.cuenta_inventario_id,
            ci.codigo AS cuenta_inventario_codigo,
            ci.nombre AS cuenta_inventario_nombre,
            c.cuenta_ingreso_id,
            cr.codigo AS cuenta_ingreso_codigo,
            cr.nombre AS cuenta_ingreso_nombre,
            c.cuenta_costo_id,
            cc.codigo AS cuenta_costo_codigo,
            cc.nombre AS cuenta_costo_nombre,
            c.created_at, 
            COUNT(p.id) AS total_productos
        FROM categorias c
        LEFT JOIN plan_cuentas ci ON ci.id = c.cuenta_inventario_id
        LEFT JOIN plan_cuentas cr ON cr.id = c.cuenta_ingreso_id
        LEFT JOIN plan_cuentas cc ON cc.id = c.cuenta_costo_id
        LEFT JOIN productos p ON p.categoria_id = c.id AND p.activo = 1
        WHERE c.negocio_id = :nid
        GROUP BY c.id
        ORDER BY c.nombre ASC
    ");
    $stmt->execute(['nid' => $negocioId]);
    Response::json(['categories' => $stmt->fetchAll()]);
}

if ($method === 'POST') {
    $input             = json_decode(file_get_contents('php://input'), true) ?? [];
    $id                = (int)($input['id'] ?? 0);
    $nombre            = trim($input['nombre'] ?? '');
    $descripcion       = trim($input['descripcion'] ?? '');
    $cuentaInventarioId= !empty($input['cuenta_inventario_id']) ? (int)$input['cuenta_inventario_id'] : null;
    $cuentaIngresoId   = !empty($input['cuenta_ingreso_id']) ? (int)$input['cuenta_ingreso_id'] : null;
    $cuentaCostoId     = !empty($input['cuenta_costo_id']) ? (int)$input['cuenta_costo_id'] : null;

    if ($nombre === '') {
        Response::json(['error' => 'El nombre de la categoría es obligatorio.'], 422);
    }

    if ($id > 0) {
        $stmt = $db->prepare("
            UPDATE categorias 
            SET nombre = :nombre, 
                descripcion = :desc,
                cuenta_inventario_id = :ci,
                cuenta_ingreso_id = :cr,
                cuenta_costo_id = :cc
            WHERE id = :id AND negocio_id = :nid
        ");
        $stmt->execute([
            'nombre' => $nombre,
            'desc'   => $descripcion ?: null,
            'ci'     => $cuentaInventarioId,
            'cr'     => $cuentaIngresoId,
            'cc'     => $cuentaCostoId,
            'id'     => $id,
            'nid'    => $negocioId
        ]);
        Response::json(['message' => 'Categoría y mapeo contable actualizados exitosamente.']);
    } else {
        $stmt = $db->prepare("
            INSERT INTO categorias 
                (negocio_id, nombre, descripcion, cuenta_inventario_id, cuenta_ingreso_id, cuenta_costo_id)
            VALUES 
                (:nid, :nombre, :desc, :ci, :cr, :cc)
        ");
        $stmt->execute([
            'nid'    => $negocioId,
            'nombre' => $nombre,
            'desc'   => $descripcion ?: null,
            'ci'     => $cuentaInventarioId,
            'cr'     => $cuentaIngresoId,
            'cc'     => $cuentaCostoId
        ]);
        Response::json([
            'message'      => 'Categoría y cuentas contables creadas exitosamente.',
            'categoria_id' => (int)$db->lastInsertId()
        ], 201);
    }
}

if ($method === 'DELETE') {
    $id = (int)($_GET['id'] ?? 0);
    if ($id <= 0) {
        Response::json(['error' => 'ID de categoría no válido.'], 400);
    }

    $stmt = $db->prepare("DELETE FROM categorias WHERE id = :id AND negocio_id = :nid");
    $stmt->execute(['id' => $id, 'nid' => $negocioId]);

    Response::json(['message' => 'Categoría eliminada. Los productos han sido desvinculados sin eliminarse.']);
}

Response::json(['error' => 'Método no permitido.'], 405);
