<?php
declare(strict_types=1);

/**
 * =========================================================================
 * PYMEWEB ERP - CRON JOB 2: REINTENTO AUTOMÁTICO DE COMPROBANTES SRI
 * =========================================================================
 * Frecuencia recomendada: Cada 10 o 15 minutos.
 * Comando Cron (Linux crontab):
 *   * /15 * * * * /usr/bin/php /var/www/pymeweb/backend-api/cron/reintentar_comprobantes_sri.php >> /var/www/pymeweb/backend-api/cron/cron.log 2>&1
 *
 * Tarea Programada (Windows Task Scheduler):
 *   Acción: Iniciar un programa
 *   Programa: C:\xampp\php\php.exe
 *   Argumentos: -f "d:\WEBCOMP\APP EMPRENDE\backend-api\cron\reintentar_comprobantes_sri.php"
 */

$isCli = (PHP_SAPI === 'cli');
$cronSecret = $_ENV['CRON_SECRET'] ?? 'pymeweb_cron_secret_2026';

if (!$isCli && ($_GET['key'] ?? '') !== $cronSecret) {
    http_response_code(403);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Acceso denegado al cron de reintentos SRI.']);
    exit;
}

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../core/sri/SriSoapClient.php';
require_once __DIR__ . '/../core/sri/SriRideGenerator.php';
require_once __DIR__ . '/../core/MailerService.php';

$db = Database::getConnection();
$ahora = date('Y-m-d H:i:s');
$logFile = __DIR__ . '/cron.log';

echo "====================================================================\n";
echo "[{$ahora}] INICIO CRON: Reintento de Comprobantes Electrónicos SRI\n";
echo "====================================================================\n";

try {
    // 1. Consultar comprobantes en comprobantes_electronicos_sri con estado pendiente o en proceso
    $stmt = $db->query("
        SELECT c.*, n.nombre AS negocio_nombre, n.ruc_nit AS negocio_ruc
        FROM comprobantes_electronicos_sri c
        JOIN negocios n ON n.id = c.negocio_id
        WHERE c.estado_sri IN ('PENDIENTE', 'RECIBIDA')
        ORDER BY c.id ASC
        LIMIT 25
    ");
    $comprobantes = $stmt->fetchAll();

    $totalReintentar = count($comprobantes);
    echo "Comprobantes pendientes de confirmación SRI: {$totalReintentar}\n";

    $autorizados = 0;
    $fallidos = 0;

    foreach ($comprobantes as $comp) {
        $compId = (int)$comp['id'];
        $claveAcceso = $comp['clave_acceso'];
        $ambiente = (int)$comp['ambiente'];
        $xmlFirmado = $comp['xml_firmado'];

        echo " -> Procesando {$comp['numero_comprobante']} (Tipo: {$comp['tipo_documento']}, Clave: {$claveAcceso})...\n";

        $soapClient = new SriSoapClient($ambiente);

        // A. Consultar autorización directa al SRI (por si el SRI ya lo procesó tras la caída)
        $resAut = $soapClient->consultarAutorizacion($claveAcceso);

        if ($resAut['success'] && $resAut['estado'] === 'AUTORIZADO') {
            echo "    [¡AUTORIZADO EN SRI!]: {$resAut['numero_autorizacion']}\n";

            $xmlAutorizado = $resAut['xml_autorizado'] ?: $xmlFirmado;
            $numAut = $resAut['numero_autorizacion'];
            $fecAut = $resAut['fecha_autorizacion'] ?: date('Y-m-d H:i:s');

            // Generar RIDE PDF si no existía
            $ridePath = $comp['pdf_ride_path'];
            if (empty($ridePath) || !file_exists(__DIR__ . '/../' . ltrim($ridePath, '/'))) {
                try {
                    $rideGenerator = new SriRideGenerator();
                    $ridePath = $rideGenerator->generarRide($xmlAutorizado, $claveAcceso);
                } catch (Throwable $eRide) {
                    error_log("Error al generar RIDE en cron para {$claveAcceso}: " . $eRide->getMessage());
                }
            }

            // Actualizar registro en BD
            $upd = $db->prepare("
                UPDATE comprobantes_electronicos_sri
                SET estado_sri = 'AUTORIZADO',
                    numero_autorizacion = :naut,
                    fecha_autorizacion = :faut,
                    xml_autorizado = :xmla,
                    pdf_ride_path = :ride,
                    mensaje_sri = 'Autorizado por el SRI mediante proceso programado de reintento.'
                WHERE id = :id
            ");
            $upd->execute([
                'naut' => $numAut,
                'faut' => $fecAut,
                'xmla' => $xmlAutorizado,
                'ride' => $ridePath,
                'id'   => $compId,
            ]);

            // Enviar por correo al cliente si tiene email y no se había enviado
            if ((int)$comp['email_enviado'] === 0) {
                // Obtener email del cliente según el origen
                $emailCliente = null;
                $nombreCliente = null;
                if ($comp['origen_tipo'] === 'venta') {
                    $stmtCli = $db->prepare("
                        SELECT c.email, c.nombre 
                        FROM ventas v 
                        JOIN clientes c ON c.id = v.cliente_id 
                        WHERE v.id = :vid
                    ");
                    $stmtCli->execute(['vid' => $comp['origen_id']]);
                    if ($rowCli = $stmtCli->fetch()) {
                        $emailCliente = $rowCli['email'];
                        $nombreCliente = $rowCli['nombre'];
                    }
                }

                if (!empty($emailCliente) && filter_var($emailCliente, FILTER_VALIDATE_EMAIL)) {
                    try {
                        MailerService::enviarComprobante(
                            $emailCliente,
                            $nombreCliente ?: 'Estimado Cliente',
                            $comp['numero_comprobante'],
                            $comp['tipo_documento'],
                            $xmlAutorizado,
                            $ridePath
                        );
                        $db->prepare("UPDATE comprobantes_electronicos_sri SET email_enviado = 1 WHERE id = :id")
                           ->execute(['id' => $compId]);
                        echo "    [EMAIL ENVIADO]: Se envió RIDE y XML a {$emailCliente}\n";
                    } catch (Throwable $eMail) {
                        error_log("Error al enviar email en cron: " . $eMail->getMessage());
                    }
                }
            }

            $autorizados++;
            continue;
        }

        // B. Si el SRI responde que no existe o error de conexión, intentar re-enviar la recepción
        if ($comp['estado_sri'] === 'PENDIENTE' && !empty($xmlFirmado)) {
            $resRecep = $soapClient->enviarComprobante($xmlFirmado);

            if ($resRecep['success']) {
                echo "    [RECIBIDO POR SRI]: Se reintentará autorización en la siguiente corrida.\n";
                $db->prepare("
                    UPDATE comprobantes_electronicos_sri
                    SET estado_sri = 'RECIBIDA', mensaje_sri = 'Recibido por el SRI, pendiente de consulta.'
                    WHERE id = :id
                ")->execute(['id' => $compId]);
            } else {
                echo "    [FALLO DE ENVÍO]: {$resRecep['mensaje']}\n";
                $nuevoEstado = ($resRecep['estado'] === 'DEVUELTA') ? 'DEVUELTA' : 'PENDIENTE';
                $db->prepare("
                    UPDATE comprobantes_electronicos_sri
                    SET estado_sri = :est, mensaje_sri = :msg
                    WHERE id = :id
                ")->execute([
                    'est' => $nuevoEstado,
                    'msg' => substr($resRecep['mensaje'] ?? 'Error de recepción SRI', 0, 500),
                    'id'  => $compId,
                ]);
                $fallidos++;
            }
        }
    }

    $summaryMsg = "[{$ahora}] FIN CRON SRI: {$totalReintentar} evaluados, {$autorizados} autorizados con éxito, {$fallidos} pendientes/reintentables.\n";
    echo $summaryMsg;
    file_put_contents($logFile, $summaryMsg, FILE_APPEND);

    if (!$isCli) {
        header('Content-Type: application/json');
        echo json_encode([
            'success'     => true,
            'total'       => $totalReintentar,
            'autorizados' => $autorizados,
            'fallidos'    => $fallidos,
        ]);
    }

} catch (Throwable $e) {
    $errMsg = "[{$ahora}] ERROR CRON SRI: " . $e->getMessage() . PHP_EOL;
    file_put_contents($logFile, $errMsg, FILE_APPEND);
    echo $errMsg;

    if (!$isCli) {
        http_response_code(500);
        header('Content-Type: application/json');
        echo json_encode(['error' => $e->getMessage()]);
    }
    exit(1);
}
