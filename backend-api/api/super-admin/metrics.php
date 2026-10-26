<?php
declare(strict_types=1);

require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../core/AuthMiddleware.php';
require_once __DIR__ . '/../../core/Response.php';

AuthMiddleware::authenticate(true);

$db = Database::getConnection();

$db->exec("
    UPDATE negocios 
    SET estado = 'inactivo' 
    WHERE estado IN ('activo', 'prueba') AND fecha_expiracion < NOW()
");

$stmt = $db->query("
    SELECT
        COUNT(*) AS total_negocios,
        SUM(CASE WHEN estado = 'activo' AND fecha_expiracion >= NOW() THEN 1 ELSE 0 END) AS negocios_activos,
        SUM(CASE WHEN estado = 'prueba' AND fecha_expiracion >= NOW() THEN 1 ELSE 0 END) AS negocios_prueba,
        SUM(CASE WHEN estado = 'inactivo' OR fecha_expiracion < NOW() THEN 1 ELSE 0 END) AS negocios_inactivos,
        SUM(CASE 
            WHEN estado IN ('activo', 'prueba') 
             AND fecha_expiracion BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 3 DAY) 
            THEN 1 ELSE 0 
        END) AS proximos_expirar
    FROM negocios
");
$metrics = $stmt->fetch();

$stmtIngresos = $db->query("
    SELECT COALESCE(SUM(monto), 0) AS ingresos_mes
    FROM pagos_saas
    WHERE YEAR(created_at) = YEAR(CURRENT_DATE())
      AND MONTH(created_at) = MONTH(CURRENT_DATE())
");
$ingresos = $stmtIngresos->fetch();

Response::json([
    'total_negocios'     => (int)($metrics['total_negocios'] ?? 0),
    'negocios_activos'   => (int)($metrics['negocios_activos'] ?? 0),
    'negocios_prueba'    => (int)($metrics['negocios_prueba'] ?? 0),
    'negocios_inactivos' => (int)($metrics['negocios_inactivos'] ?? 0),
    'proximos_expirar'   => (int)($metrics['proximos_expirar'] ?? 0),
    'ingresos_mes'       => (float)($ingresos['ingresos_mes'] ?? 0.0)
]);
