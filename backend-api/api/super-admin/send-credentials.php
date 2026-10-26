<?php
declare(strict_types=1);

require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../core/AuthMiddleware.php';
require_once __DIR__ . '/../../core/Response.php';
require_once __DIR__ . '/../../core/MailerService.php';

AuthMiddleware::authenticate(true);
$db = Database::getConnection();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true) ?? [];
    $negocioId = (int)($input['negocio_id'] ?? 0);
    $newPassword = trim($input['new_password'] ?? '');
    $sendEmail = !empty($input['send_email']);
    $origin = trim($input['origin'] ?? '');

    if ($negocioId <= 0) {
        Response::json(['error' => 'ID de negocio inválido.'], 422);
    }

    if (!$origin) {
        $origin = $_SERVER['HTTP_ORIGIN'] ?? 'http://localhost:3005';
    }
    $origin = rtrim($origin, '/');

    // Consultar información del negocio y usuario administrador
    $stmt = $db->prepare("
        SELECT 
            n.id, n.nombre, n.slug, n.ruc_nit, n.telefono, n.estado,
            n.fecha_registro, n.fecha_expiracion,
            DATEDIFF(n.fecha_expiracion, NOW()) AS dias_restantes,
            u.id AS usuario_id, u.nombre AS dueno_nombre, u.email AS dueno_email
        FROM negocios n
        LEFT JOIN usuarios u ON u.negocio_id = n.id AND u.rol = 'admin_negocio'
        WHERE n.id = :id
        LIMIT 1
    ");
    $stmt->execute(['id' => $negocioId]);
    $tenant = $stmt->fetch();

    if (!$tenant) {
        Response::json(['error' => 'Negocio no encontrado.'], 404);
    }

    // Si se especificó una nueva contraseña, actualizarla
    $passwordToShare = $newPassword;
    if ($newPassword !== '') {
        if (strlen($newPassword) < 6) {
            Response::json(['error' => 'La nueva contraseña debe tener al menos 6 caracteres.'], 422);
        }

        $stmtUpd = $db->prepare("
            UPDATE usuarios 
            SET password_hash = :hash 
            WHERE negocio_id = :nid AND rol = 'admin_negocio'
        ");
        $stmtUpd->execute([
            'hash' => password_hash($newPassword, PASSWORD_DEFAULT),
            'nid'  => $negocioId,
        ]);
    }

    $loginUrl = "{$origin}/login";
    $storeUrl = "{$origin}/{$tenant['slug']}";
    $diasRestantes = max(0, (int)($tenant['dias_restantes'] ?? 0));
    $expDateFormatted = !empty($tenant['fecha_expiracion'])
        ? date('d/m/Y', strtotime($tenant['fecha_expiracion']))
        : 'Indefinido';

    // Generar texto para WhatsApp
    $passSection = $passwordToShare !== ''
        ? "🔑 *Contraseña:* {$passwordToShare}\n"
        : "🔑 *Contraseña:* (La contraseña establecida al crear la cuenta)\n";

    $whatsappText = "¡Hola *{$tenant['dueno_nombre']}*! 👋\n\n"
        . "Te damos la bienvenida a *PymeWeb ERP* para tu negocio *{$tenant['nombre']}*.\n\n"
        . "Aquí tienes tus credenciales y accesos oficiales a la plataforma:\n\n"
        . "🌐 *Plataforma de Acceso:* {$loginUrl}\n"
        . "👤 *Usuario / Email:* {$tenant['dueno_email']}\n"
        . $passSection
        . "🏪 *Tu Tienda Virtual:* {$storeUrl}\n"
        . "⏳ *Acceso válido:* {$diasRestantes} días (hasta {$expDateFormatted})\n\n"
        . "✨ Podrás emitir Facturas Electrónicas SRI, usar el Punto de Venta POS y gestionar pedidos de tu tienda online.\n\n"
        . "¡Éxitos con tu negocio! Si necesitas soporte estamos a tu disposición.";

    // Limpiar teléfono para WhatsApp (Ecuador: si empieza con 0, reemplazar por 593)
    $cleanPhone = preg_replace('/\D/', '', (string)($tenant['telefono'] ?? ''));
    if ($cleanPhone !== '') {
        if (!str_starts_with($cleanPhone, '593') && str_starts_with($cleanPhone, '0')) {
            $cleanPhone = '593' . substr($cleanPhone, 1);
        }
    }
    $whatsappUrl = $cleanPhone !== ''
        ? "https://wa.me/{$cleanPhone}?text=" . rawurlencode($whatsappText)
        : "https://wa.me/?text=" . rawurlencode($whatsappText);

    // Envío por correo si fue solicitado
    $emailSent = false;
    if ($sendEmail && !empty($tenant['dueno_email'])) {
        $emailSent = MailerService::sendCredentialsEmail(
            $tenant['dueno_email'],
            $tenant['dueno_nombre'] ?: 'Estimado Cliente',
            $tenant['nombre'],
            $loginUrl,
            $storeUrl,
            $passwordToShare ?: '(Tu contraseña actual)',
            $diasRestantes,
            $expDateFormatted
        );
    }

    Response::json([
        'success' => true,
        'message' => 'Credenciales preparadas con éxito.',
        'credentials' => [
            'negocio_id'       => $tenant['id'],
            'negocio_nombre'   => $tenant['nombre'],
            'slug'             => $tenant['slug'],
            'telefono'         => $tenant['telefono'],
            'clean_phone'      => $cleanPhone,
            'dueno_nombre'     => $tenant['dueno_nombre'],
            'dueno_email'      => $tenant['dueno_email'],
            'password'         => $passwordToShare,
            'dias_restantes'   => $diasRestantes,
            'fecha_expiracion' => $expDateFormatted,
            'login_url'        => $loginUrl,
            'store_url'        => $storeUrl,
            'whatsapp_text'    => $whatsappText,
            'whatsapp_url'     => $whatsappUrl,
            'email_sent'       => $emailSent,
        ]
    ]);
}

Response::json(['error' => 'Método no soportado.'], 405);
