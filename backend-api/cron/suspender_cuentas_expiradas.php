<?php
declare(strict_types=1);

/**
 * =========================================================================
 * PYMEWEB ERP - CRON JOB 1: SUSPENSIÓN DE CUENTAS SAAS CADUCADAS
 * =========================================================================
 * Frecuencia recomendada: Todos los días a la medianoche (00:00).
 * Comando Cron (Linux crontab):
 *   0 0 * * * /usr/bin/php /var/www/pymeweb/backend-api/cron/suspender_cuentas_expiradas.php >> /var/www/pymeweb/backend-api/cron/cron.log 2>&1
 *
 * Tarea Programada (Windows Task Scheduler):
 *   Acción: Iniciar un programa
 *   Programa: C:\xampp\php\php.exe
 *   Argumentos: -f "d:\WEBCOMP\APP EMPRENDE\backend-api\cron\suspender_cuentas_expiradas.php"
 */

$isCli = (PHP_SAPI === 'cli');
$cronSecret = $_ENV['CRON_SECRET'] ?? 'pymeweb_cron_secret_2026';

// Seguridad: si se invoca por HTTP (navegador o servicio externo tipo cron-job.org), exigir token secreto
if (!$isCli && ($_GET['key'] ?? '') !== $cronSecret) {
    http_response_code(403);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Acceso denegado. Token de seguridad inválido.']);
    exit;
}

require_once __DIR__ . '/../config/database.php';

$db = Database::getConnection();
$ahora = date('Y-m-d H:i:s');
$logFile = __DIR__ . '/cron.log';

echo "====================================================================\n";
echo "[{$ahora}] INICIO CRON: Suspensión de suscripciones SaaS caducadas\n";
echo "====================================================================\n";

try {
    $db->beginTransaction();

    // 1. Identificar negocios que expiran hoy o antes y no están inactivos
    $stmtFind = $db->prepare("
        SELECT id, nombre, slug, estado, fecha_expiracion
        FROM negocios
        WHERE estado IN ('prueba', 'activo')
          AND fecha_expiracion IS NOT NULL
          AND fecha_expiracion < :ahora
    ");
    $stmtFind->execute(['ahora' => $ahora]);
    $negociosVencidos = $stmtFind->fetchAll();

    $totalVencidos = count($negociosVencidos);
    echo "Negocios con suscripción vencida detectados: {$totalVencidos}\n";

    if ($totalVencidos > 0) {
        $stmtUpdate = $db->prepare("
            UPDATE negocios
            SET estado = 'inactivo'
            WHERE id = :id
        ");

        foreach ($negociosVencidos as $neg) {
            $stmtUpdate->execute(['id' => $neg['id']]);
            $msg = " - [SUSPENDIDO]: Negocio ID {$neg['id']} ('{$neg['nombre']}', slug: {$neg['slug']}) venció el {$neg['fecha_expiracion']}\n";
            echo $msg;
            file_put_contents($logFile, "[{$ahora}] " . trim($msg) . PHP_EOL, FILE_APPEND);
        }
    } else {
        echo "No hay negocios vencidos pendientes de suspensión.\n";
    }

    // 2. Limpieza de tokens de recuperación de contraseña caducados o usados
    $deletedTokens = $db->exec("
        DELETE FROM password_resets 
        WHERE expira_en < NOW() OR usado = 1
    ");
    if ($deletedTokens > 0) {
        echo "Tokens de recuperación de contraseña purgados: {$deletedTokens}\n";
    }

    $db->commit();

    $finMsg = "[{$ahora}] FIN CRON: Proceso completado exitosamente. Total suspendidos: {$totalVencidos}." . PHP_EOL;
    file_put_contents($logFile, $finMsg, FILE_APPEND);
    echo $finMsg;

    if (!$isCli) {
        header('Content-Type: application/json');
        echo json_encode([
            'success'          => true,
            'fecha'            => $ahora,
            'total_suspendidos' => $totalVencidos,
            'detalles'         => $negociosVencidos,
        ]);
    }

} catch (Throwable $e) {
    if ($db->inTransaction()) {
        $db->rollBack();
    }
    $errMsg = "[{$ahora}] ERROR CRON: " . $e->getMessage() . PHP_EOL;
    file_put_contents($logFile, $errMsg, FILE_APPEND);
    echo $errMsg;

    if (!$isCli) {
        http_response_code(500);
        header('Content-Type: application/json');
        echo json_encode(['error' => $e->getMessage()]);
    }
    exit(1);
}
