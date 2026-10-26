<?php
declare(strict_types=1);

require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../core/AuthMiddleware.php';
require_once __DIR__ . '/../../core/Response.php';

AuthMiddleware::authenticate(true);
$db = Database::getConnection();
$method = $_SERVER['REQUEST_METHOD'];

// Asegurar existencia de tabla y fila inicial
$db->exec("
    CREATE TABLE IF NOT EXISTS configuracion_saas (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        precio_mensual DECIMAL(10,2) NOT NULL DEFAULT 15.00,
        precio_anual DECIMAL(10,2) NOT NULL DEFAULT 130.00,
        dias_prueba INT NOT NULL DEFAULT 7,
        datos_bancarios TEXT NULL,
        whatsapp_soporte VARCHAR(50) NULL,
        email_soporte VARCHAR(150) NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
");

$stmt = $db->query("SELECT * FROM configuracion_saas LIMIT 1");
$config = $stmt->fetch();
if (!$config) {
    $db->exec("
        INSERT INTO configuracion_saas (id, precio_mensual, precio_anual, dias_prueba, datos_bancarios, whatsapp_soporte, email_soporte)
        VALUES (1, 15.00, 130.00, 7, 'Banco Pichincha - Cta Corriente # 2100458921\nTitular: PymeWeb ERP S.A.S.\nRUC: 1793148921001', '0985559516', 'soporte@pymeweb.com')
    ");
    $config = $db->query("SELECT * FROM configuracion_saas LIMIT 1")->fetch();
}

if ($method === 'GET') {
    Response::json([
        'success' => true,
        'config'  => [
            'id'               => (int)$config['id'],
            'precio_mensual'   => round((float)$config['precio_mensual'], 2),
            'precio_anual'     => round((float)$config['precio_anual'], 2),
            'dias_prueba'      => (int)$config['dias_prueba'],
            'datos_bancarios'  => $config['datos_bancarios'] ?? '',
            'whatsapp_soporte' => $config['whatsapp_soporte'] ?? '',
            'email_soporte'    => $config['email_soporte'] ?? '',
            'updated_at'       => $config['updated_at']
        ]
    ]);
}

if ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true) ?? [];

    $precioMensual   = max(1.0, (float)($input['precio_mensual'] ?? 15.00));
    $precioAnual     = max(1.0, (float)($input['precio_anual'] ?? 130.00));
    $diasPrueba      = max(1, (int)($input['dias_prueba'] ?? 7));
    $datosBancarios  = trim((string)($input['datos_bancarios'] ?? ''));
    $whatsappSoporte = trim((string)($input['whatsapp_soporte'] ?? ''));
    $emailSoporte    = trim((string)($input['email_soporte'] ?? ''));

    if (empty($datosBancarios)) {
        Response::json(['error' => 'Los datos bancarios para las transferencias son obligatorios.'], 422);
    }

    $stmtUp = $db->prepare("
        UPDATE configuracion_saas
        SET precio_mensual = :mensual,
            precio_anual = :anual,
            dias_prueba = :prueba,
            datos_bancarios = :bancos,
            whatsapp_soporte = :wsp,
            email_soporte = :email,
            updated_at = NOW()
        WHERE id = :id
    ");
    $stmtUp->execute([
        'mensual' => $precioMensual,
        'anual'   => $precioAnual,
        'prueba'  => $diasPrueba,
        'bancos'  => $datosBancarios,
        'wsp'     => $whatsappSoporte ?: null,
        'email'   => $emailSoporte ?: null,
        'id'      => $config['id']
    ]);

    Response::json([
        'success' => true,
        'message' => 'Configuración de suscripciones SaaS actualizada correctamente.',
        'config'  => [
            'precio_mensual'   => $precioMensual,
            'precio_anual'     => $precioAnual,
            'dias_prueba'      => $diasPrueba,
            'datos_bancarios'  => $datosBancarios,
            'whatsapp_soporte' => $whatsappSoporte,
            'email_soporte'    => $emailSoporte
        ]
    ]);
}

Response::json(['error' => 'Método no permitido.'], 405);
