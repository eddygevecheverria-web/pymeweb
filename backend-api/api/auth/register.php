<?php
declare(strict_types=1);

require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../core/JwtHandler.php';
require_once __DIR__ . '/../../core/Response.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    Response::json(['error' => 'Método no permitido'], 405);
}

$input = json_decode(file_get_contents('php://input'), true) ?? [];
$nombreNegocio = trim($input['nombre_negocio'] ?? '');
$nombreDueno   = trim($input['nombre_dueno'] ?? '');
$email         = strtolower(trim($input['email'] ?? ''));
$password      = $input['password'] ?? '';
$telefono      = trim($input['telefono'] ?? '');

if (!$nombreNegocio || !$nombreDueno || !filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($password) < 6) {
    Response::json(['error' => 'Completa todos los campos obligatorios (contraseña mín. 6 caracteres).'], 422);
}

$db = Database::getConnection();

$check = $db->prepare("SELECT id FROM usuarios WHERE email = :email LIMIT 1");
$check->execute(['email' => $email]);
if ($check->fetch()) {
    Response::json(['error' => 'Este correo electrónico ya está registrado.'], 409);
}

$baseSlug = strtolower(trim(preg_replace('/[^A-Za-z0-9-]+/', '-', iconv('UTF-8', 'ASCII//TRANSLIT', $nombreNegocio)), '-'));
$slug = $baseSlug ?: 'negocio-' . random_int(1000, 9999);
$stmtSlug = $db->prepare("SELECT COUNT(*) FROM negocios WHERE slug LIKE :slug");
$stmtSlug->execute(['slug' => "$slug%"]);
$count = (int)$stmtSlug->fetchColumn();
if ($count > 0) {
    $slug .= '-' . ($count + 1);
}

try {
    $db->beginTransaction();

    $diasPrueba = 7;
    try {
        $stmtCfg = $db->query("SELECT dias_prueba FROM configuracion_saas LIMIT 1");
        if ($stmtCfg) {
            $val = $stmtCfg->fetchColumn();
            if ($val !== false && (int)$val > 0) {
                $diasPrueba = (int)$val;
            }
        }
    } catch (Throwable $_) {}

    $fechaRegistro   = (new DateTimeImmutable('now'))->format('Y-m-d H:i:s');
    $fechaExpiracion = (new DateTimeImmutable("+{$diasPrueba} days"))->format('Y-m-d H:i:s');

    $stmtNegocio = $db->prepare("
        INSERT INTO negocios (nombre, slug, telefono, estado, fecha_registro, fecha_expiracion)
        VALUES (:nombre, :slug, :telefono, 'prueba', :registro, :expiracion)
    ");
    $stmtNegocio->execute([
        'nombre'     => $nombreNegocio,
        'slug'       => $slug,
        'telefono'   => $telefono,
        'registro'   => $fechaRegistro,
        'expiracion' => $fechaExpiracion
    ]);
    $negocioId = (int)$db->lastInsertId();

    $stmtUser = $db->prepare("
        INSERT INTO usuarios (negocio_id, nombre, email, password_hash, rol)
        VALUES (:negocio_id, :nombre, :email, :password_hash, 'admin_negocio')
    ");
    $stmtUser->execute([
        'negocio_id'    => $negocioId,
        'nombre'        => $nombreDueno,
        'email'         => $email,
        'password_hash' => password_hash($password, PASSWORD_DEFAULT)
    ]);
    $usuarioId = (int)$db->lastInsertId();

    $db->commit();

    $token = JwtHandler::encode([
        'sub'        => $usuarioId,
        'negocio_id' => $negocioId,
        'rol'        => 'admin_negocio',
        'email'      => $email
    ]);

    Response::json([
        'message' => "Negocio registrado exitosamente con {$diasPrueba} días de prueba gratuita.",
        'token'   => $token,
        'user'    => [
            'id'               => $usuarioId,
            'nombre'           => $nombreDueno,
            'email'            => $email,
            'rol'              => 'admin_negocio',
            'negocio_id'       => $negocioId,
            'negocio_nombre'   => $nombreNegocio,
            'negocio_slug'     => $slug,
            'estado'           => 'prueba',
            'fecha_expiracion' => $fechaExpiracion
        ]
    ], 201);
} catch (Throwable $e) {
    $db->rollBack();
    Response::json(['error' => 'Error interno al registrar el negocio.'], 500);
}
