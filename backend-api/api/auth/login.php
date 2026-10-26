<?php
declare(strict_types=1);

require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../core/JwtHandler.php';
require_once __DIR__ . '/../../core/Response.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    Response::json(['error' => 'Método no permitido'], 405);
}

$input    = json_decode(file_get_contents('php://input'), true) ?? [];
$email    = strtolower(trim($input['email'] ?? ''));
$password = $input['password'] ?? '';

$db = Database::getConnection();
$stmt = $db->prepare("
    SELECT u.id, u.negocio_id, u.nombre, u.email, u.password_hash, u.rol, u.activo,
           n.nombre AS negocio_nombre, n.slug AS negocio_slug, n.estado AS negocio_estado, 
           n.fecha_expiracion, n.logo_url
    FROM usuarios u
    LEFT JOIN negocios n ON u.negocio_id = n.id
    WHERE u.email = :email
    LIMIT 1
");
$stmt->execute(['email' => $email]);
$user = $stmt->fetch();

if (!$user || !password_verify($password, $user['password_hash'])) {
    Response::json(['error' => 'Credenciales inválidas.'], 401);
}

if ((int)$user['activo'] !== 1) {
    Response::json(['error' => 'Tu usuario ha sido deshabilitado.'], 403);
}

if ($user['rol'] !== 'super_admin') {
    $ahora      = new DateTimeImmutable('now');
    $expiracion = new DateTimeImmutable($user['fecha_expiracion']);

    if ($user['negocio_estado'] === 'inactivo' || $ahora > $expiracion) {
        if ($user['negocio_estado'] !== 'inactivo' && $ahora > $expiracion) {
            $upd = $db->prepare("UPDATE negocios SET estado = 'inactivo' WHERE id = :id");
            $upd->execute(['id' => $user['negocio_id']]);
        }

        Response::json([
            'error'            => 'Payment Required',
            'code'             => 'SUBSCRIPTION_EXPIRED',
            'message'          => 'Tu suscripción o periodo de prueba de 5 días ha expirado.',
            'negocio_nombre'   => $user['negocio_nombre'],
            'fecha_expiracion' => $user['fecha_expiracion']
        ], 403);
    }
}

$token = JwtHandler::encode([
    'sub'        => (int)$user['id'],
    'negocio_id' => $user['negocio_id'] ? (int)$user['negocio_id'] : null,
    'rol'        => $user['rol'],
    'email'      => $user['email']
]);

Response::json([
    'token' => $token,
    'user'  => [
        'id'               => (int)$user['id'],
        'nombre'           => $user['nombre'],
        'email'            => $user['email'],
        'rol'              => $user['rol'],
        'negocio_id'       => $user['negocio_id'] ? (int)$user['negocio_id'] : null,
        'negocio_nombre'   => $user['negocio_nombre'],
        'negocio_slug'     => $user['negocio_slug'],
        'estado'           => $user['negocio_estado'],
        'fecha_expiracion' => $user['fecha_expiracion'],
        'logo_url'         => $user['logo_url']
    ]
]);
