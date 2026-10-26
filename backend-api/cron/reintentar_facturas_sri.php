<?php
declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../core/sri/SriSoapClient.php';
require_once __DIR__ . '/../core/sri/SriRideGenerator.php';
require_once __DIR__ . '/../core/MailerService.php';

$secret = $_GET['secret'] ?? ($argv[1] ?? '');
$expectedSecret = $_ENV['CRON_SECRET'] ?? 'cron_secret_pymeweb_2026';

if ($secret !== $expectedSecret && php_sapi_name() !== 'cli') {
    http_response_code(403);
    echo "Acceso denegado al cron de reintentos SRI.\n";
    exit;
}

$db = Database::getConnection();
echo "[" . date('Y-m-d H:i:s') . "] Ejecutando proceso en background para reintentos del SRI...\n";

// Buscar facturas pendientes o con error de conexión cuyo tiempo de reintento haya llegado
$stmt = $db->query("
    SELECT c.*, s.ambiente, s.razon_social, s.ruc, s.dir_matriz,
           v.subtotal, v.impuesto, v.total, v.metodo_pago, v.cliente_id
    FROM sri_cola_recepcion c
    INNER JOIN configuracion_sri s ON s.negocio_id = c.negocio_id
    INNER JOIN ventas v ON v.id = c.venta_id
    WHERE c.estado IN ('PENDIENTE', 'ERROR_CONEXION')
      AND c.proximo_reintento <= NOW()
      AND c.intentos < 10
    LIMIT 20
");
$pendientes = $stmt->fetchAll();

echo "Comprobantes encontrados para reintentar: " . count($pendientes) . "\n";

foreach ($pendientes as $p) {
    $colaId = (int)$p['id'];
    $negocioId = (int)$p['negocio_id'];
    $ventaId = (int)$p['venta_id'];
    $claveAcceso = $p['clave_acceso'];
    $xml = $p['xml_firmado'];
    $ambiente = (int)$p['ambiente'];

    $soap = new SriSoapClient($ambiente);
    $intentos = (int)$p['intentos'] + 1;

    // Primero consultar si por casualidad ya fue autorizada
    $aut = $soap->consultarAutorizacion($claveAcceso);

    if ($aut['success'] && $aut['estado'] === 'AUTORIZADO') {
        echo " - [AUTORIZADA EN SRI]: {$claveAcceso}\n";

        $upd = $db->prepare("
            UPDATE sri_cola_recepcion 
            SET estado = 'AUTORIZADO', 
                numero_autorizacion = :num, 
                fecha_autorizacion = :fec, 
                intentos = :intentos 
            WHERE id = :id
        ");
        $upd->execute([
            'num' => $aut['numero_autorizacion'],
            'fec' => $aut['fecha_autorizacion'],
            'intentos' => $intentos,
            'id' => $colaId,
        ]);

        $updFac = $db->prepare("
            UPDATE facturas_electronicas 
            SET estado_sri = 'AUTORIZADO', 
                mensaje_error_sri = NULL 
            WHERE venta_id = :vid AND negocio_id = :nid
        ");
        $updFac->execute(['vid' => $ventaId, 'nid' => $negocioId]);
        continue;
    }

    // Reenviar a recepción
    $rec = $soap->enviarComprobante($xml);

    if ($rec['success']) {
        usleep(1500000);
        $aut2 = $soap->consultarAutorizacion($claveAcceso);

        if ($aut2['success'] && $aut2['estado'] === 'AUTORIZADO') {
            echo " - [REINTENTO EXITOSO - AUTORIZADA]: {$claveAcceso}\n";
            $upd = $db->prepare("
                UPDATE sri_cola_recepcion 
                SET estado = 'AUTORIZADO', 
                    numero_autorizacion = :num, 
                    fecha_autorizacion = :fec, 
                    intentos = :intentos 
                WHERE id = :id
            ");
            $upd->execute([
                'num' => $aut2['numero_autorizacion'],
                'fec' => $aut2['fecha_autorizacion'],
                'intentos' => $intentos,
                'id' => $colaId,
            ]);

            $updFac = $db->prepare("
                UPDATE facturas_electronicas 
                SET estado_sri = 'AUTORIZADO', 
                    mensaje_error_sri = NULL 
                WHERE venta_id = :vid AND negocio_id = :nid
            ");
            $updFac->execute(['vid' => $ventaId, 'nid' => $negocioId]);
        } else {
            echo " - [RECIBIDA PERO NO AUTORIZADA]: {$claveAcceso}\n";
            $upd = $db->prepare("
                UPDATE sri_cola_recepcion 
                SET estado = 'PENDIENTE', 
                    intentos = :intentos,
                    ultimo_error = :err,
                    proximo_reintento = DATE_ADD(NOW(), INTERVAL 15 MINUTE)
                WHERE id = :id
            ");
            $upd->execute([
                'intentos' => $intentos,
                'err' => $aut2['mensaje'] ?? 'Pendiente de autorización',
                'id' => $colaId,
            ]);
        }
    } else {
        echo " - [FALLO DE CONEXION REINTENTO]: {$claveAcceso} ({$rec['mensaje']})\n";
        $upd = $db->prepare("
            UPDATE sri_cola_recepcion 
            SET estado = 'ERROR_CONEXION', 
                intentos = :intentos,
                ultimo_error = :err,
                proximo_reintento = DATE_ADD(NOW(), INTERVAL 15 MINUTE)
            WHERE id = :id
        ");
        $upd->execute([
            'intentos' => $intentos,
            'err' => $rec['mensaje'],
            'id' => $colaId,
        ]);
    }
}

echo "Proceso finalizado con éxito.\n";
