<?php
declare(strict_types=1);

require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../core/Response.php';

$db = Database::getConnection();

// Asegurar existencia de configuración
try {
    $stmt = $db->query("SELECT * FROM configuracion_saas LIMIT 1");
    $config = $stmt ? $stmt->fetch() : null;
} catch (Throwable $e) {
    $config = null;
}

if (!$config) {
    $config = [
        'precio_mensual'   => 15.00,
        'precio_anual'     => 130.00,
        'dias_prueba'      => 7,
        'datos_bancarios'  => "Banco Pichincha - Cta Corriente # 2100458921\nTitular: PymeWeb ERP S.A.S.\nRUC: 1793148921001\nTipo: Transferencia Directa o Interbancaria",
        'whatsapp_soporte' => '0985559516',
        'email_soporte'    => 'soporte@pymeweb.com'
    ];
}

Response::json([
    'success' => true,
    'planes'  => [
        'mensual' => [
            'tipo'        => 'mensual',
            'nombre'      => 'Plan Mensual',
            'dias'        => 30,
            'precio'      => round((float)$config['precio_mensual'], 2),
            'descripcion' => 'Acceso completo durante 30 días.'
        ],
        'anual'   => [
            'tipo'        => 'anual',
            'nombre'      => 'Paquete Anual (1 Año)',
            'dias'        => 365,
            'precio'      => round((float)$config['precio_anual'], 2),
            'descripcion' => 'Acceso completo durante 365 días con ahorro especial.'
        ]
    ],
    'dias_prueba'      => (int)($config['dias_prueba'] ?? 7),
    'datos_bancarios'  => $config['datos_bancarios'] ?? '',
    'whatsapp_soporte' => $config['whatsapp_soporte'] ?? '',
    'email_soporte'    => $config['email_soporte'] ?? ''
]);
