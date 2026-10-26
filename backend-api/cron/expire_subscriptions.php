<?php
declare(strict_types=1);

$isCli = (PHP_SAPI === 'cli');
$cronSecret = $_ENV['CRON_SECRET'] ?? 'cron_secret_pymeweb_2026';

if (!$isCli && ($_GET['key'] ?? '') !== $cronSecret) {
    http_response_code(403);
    exit('Acceso denegado al Cron Job.');
}

require_once __DIR__ . '/../config/database.php';

$db = Database::getConnection();

try {
    $db->beginTransaction();

    $stmtUpdate = $db->prepare("
        UPDATE negocios
        SET estado = 'inactivo'
        WHERE estado IN ('prueba', 'activo')
          AND fecha_expiracion < NOW()
    ");
    $stmtUpdate->execute();
    $afectados = $stmtUpdate->rowCount();

    $db->exec("DELETE FROM password_resets WHERE expira_en < NOW() OR usado = 1");

    $db->commit();

    $timestamp = date('Y-m-d H:i:s');
    $logMsg = "[{$timestamp}] CRON OK: {$afectados} negocios pasaron a estado 'inactivo'." . PHP_EOL;

    file_put_contents(__DIR__ . '/cron.log', $logMsg, FILE_APPEND);

    echo $logMsg;
} catch (Throwable $e) {
    if ($db->inTransaction()) {
        $db->rollBack();
    }
    $errorMsg = '[' . date('Y-m-d H:i:s') . '] CRON ERROR: ' . $e->getMessage() . PHP_EOL;
    file_put_contents(__DIR__ . '/cron.log', $errorMsg, FILE_APPEND);
    http_response_code(500);
    echo $errorMsg;
}
