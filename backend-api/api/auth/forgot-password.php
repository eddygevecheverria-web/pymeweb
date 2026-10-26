<?php
declare(strict_types=1);

require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../core/Response.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    Response::json(['error' => 'Método no permitido'], 405);
}

$input = json_decode(file_get_contents('php://input'), true) ?? [];
$email = strtolower(trim($input['email'] ?? ''));

$db = Database::getConnection();
$stmt = $db->prepare("SELECT id, nombre FROM usuarios WHERE email = :email LIMIT 1");
$stmt->execute(['email' => $email]);
$user = $stmt->fetch();

if ($user) {
    $rawToken  = bin2hex(random_bytes(32));
    $tokenHash = hash('sha256', $rawToken);
    $expiraEn  = (new DateTimeImmutable('+30 minutes'))->format('Y-m-d H:i:s');

    $ins = $db->prepare("
        INSERT INTO password_resets (usuario_id, token_hash, expira_en)
        VALUES (:uid, :hash, :exp)
    ");
    $ins->execute([
        'uid'  => $user['id'],
        'hash' => $tokenHash,
        'exp'  => $expiraEn
    ]);

    $frontendUrl = $_ENV['FRONTEND_URL'] ?? 'http://localhost:3000';
    $resetLink   = "{$frontendUrl}/reset-password?token={$rawToken}";
}

Response::json([
    'message'        => 'Si el correo está registrado, recibirás un enlace para restablecer tu contraseña.',
    'dev_reset_link' => $resetLink ?? null
]);
