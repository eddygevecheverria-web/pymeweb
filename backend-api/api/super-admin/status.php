<?php
declare(strict_types=1);

require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../core/AuthMiddleware.php';
require_once __DIR__ . '/../../core/Response.php';

AuthMiddleware::authenticate(true);

if ($_SERVER['REQUEST_METHOD'] !== 'PATCH') {
    Response::json(['error' => 'Método no permitido'], 405);
}

$input       = json_decode(file_get_contents('php://input'), true) ?? [];
$negocioId   = (int)($input['negocio_id'] ?? 0);
$nuevoEstado = $input['estado'] ?? '';

if ($negocioId <= 0 || !in_array($nuevoEstado, ['activo', 'inactivo', 'prueba'], true)) {
    Response::json(['error' => 'Parámetros inválidos.'], 422);
}

$db = Database::getConnection();
$stmt = $db->prepare("UPDATE negocios SET estado = :estado WHERE id = :id");
$stmt->execute([
    'estado' => $nuevoEstado,
    'id'     => $negocioId
]);

Response::json([
    'message' => $nuevoEstado === 'inactivo' 
        ? 'Cuenta suspendida manualmente.' 
        : 'Estado de la cuenta actualizado a ' . strtoupper($nuevoEstado)
]);
