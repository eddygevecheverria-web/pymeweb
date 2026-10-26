<?php
declare(strict_types=1);

require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../core/Response.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    Response::json(['error' => 'Método no permitido'], 405);
}

$input       = json_decode(file_get_contents('php://input'), true) ?? [];
$rawToken    = trim($input['token'] ?? '');
$newPassword = $input['password'] ?? '';

if (!$rawToken || strlen($newPassword) < 6) {
    Response::json(['error' => 'Token inválido o la contraseña tiene menos de 6 caracteres.'], 422);
}

$tokenHash = hash('sha256', $rawToken);
$db = Database::getConnection();

$stmt = $db->prepare("
    SELECT id, usuario_id, expira_en, usado
    FROM password_resets
    WHERE token_hash = :hash
    ORDER BY id DESC LIMIT 1
");
$stmt->execute(['hash' => $tokenHash]);
$reset = $stmt->fetch();

if (!$reset || (int)$reset['usado'] === 1 || new DateTimeImmutable('now') > new DateTimeImmutable($reset['expira_en'])) {
    Response::json(['error' => 'El enlace de recuperación es inválido o ha expirado.'], 400);
}

$db->beginTransaction();
$updUser = $db->prepare("UPDATE usuarios SET password_hash = :hash WHERE id = :uid");
$updUser->execute([
    'hash' => password_hash($newPassword, PASSWORD_DEFAULT),
    'uid'  => $reset['usuario_id']
]);

$updToken = $db->prepare("UPDATE password_resets SET usado = 1 WHERE id = :id");
$updToken->execute(['id' => $reset['id']]);
$db->commit();

Response::json(['message' => 'Contraseña actualizada correctamente. Ya puedes iniciar sesión.']);
