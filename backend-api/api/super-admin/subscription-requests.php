<?php
declare(strict_types=1);

require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../core/AuthMiddleware.php';
require_once __DIR__ . '/../../core/Response.php';

$adminSession = AuthMiddleware::authenticate(true);
$adminId = (int)($adminSession['sub'] ?? 1);
$db = Database::getConnection();
$method = $_SERVER['REQUEST_METHOD'];

// Asegurar existencia de tabla
$db->exec("
    CREATE TABLE IF NOT EXISTS solicitudes_suscripcion (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        negocio_id INT UNSIGNED NOT NULL,
        plan_tipo ENUM('mensual', 'anual') NOT NULL DEFAULT 'mensual',
        dias INT NOT NULL DEFAULT 30,
        monto DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        banco_origen VARCHAR(100) NULL,
        numero_comprobante VARCHAR(100) NOT NULL,
        fecha_transferencia DATE NULL,
        comprobante_url VARCHAR(255) NULL,
        estado ENUM('pendiente', 'aprobado', 'rechazado') NOT NULL DEFAULT 'pendiente',
        motivo_rechazo VARCHAR(255) NULL,
        revisado_por INT UNSIGNED NULL,
        revisado_en DATETIME NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX (negocio_id),
        INDEX (estado)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
");

if ($method === 'GET') {
    $estado = trim((string)($_GET['estado'] ?? ''));

    $sql = "
        SELECT 
            s.*,
            n.nombre AS negocio_nombre,
            n.slug AS negocio_slug,
            n.ruc_nit AS negocio_ruc,
            n.telefono AS negocio_telefono,
            n.estado AS negocio_estado,
            n.fecha_expiracion AS negocio_expiracion,
            DATEDIFF(n.fecha_expiracion, NOW()) AS negocio_dias_restantes,
            u.nombre AS dueno_nombre,
            u.email AS dueno_email
        FROM solicitudes_suscripcion s
        JOIN negocios n ON n.id = s.negocio_id
        LEFT JOIN usuarios u ON u.negocio_id = n.id AND u.rol = 'admin_negocio'
        WHERE 1=1
    ";
    $params = [];
    if (!empty($estado) && in_array($estado, ['pendiente', 'aprobado', 'rechazado'], true)) {
        $sql .= " AND s.estado = :est";
        $params['est'] = $estado;
    }
    $sql .= " ORDER BY CASE WHEN s.estado = 'pendiente' THEN 1 ELSE 2 END, s.id DESC LIMIT 100";

    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    $solicitudes = $stmt->fetchAll();

    // Historial de pagos aprobados (pagos_saas)
    $stmtPagos = $db->query("
        SELECT p.*, n.nombre AS negocio_nombre, n.slug AS negocio_slug
        FROM pagos_saas p
        JOIN negocios n ON n.id = p.negocio_id
        ORDER BY p.id DESC
        LIMIT 50
    ");
    $pagos = $stmtPagos->fetchAll();

    // Métricas de suscripciones
    $stmtMet = $db->query("
        SELECT 
            COUNT(CASE WHEN estado = 'pendiente' THEN 1 END) AS pendientes_count,
            COALESCE(SUM(CASE WHEN estado = 'aprobado' THEN monto ELSE 0 END), 0) AS total_recaudado,
            COALESCE(SUM(CASE WHEN estado = 'aprobado' AND MONTH(created_at) = MONTH(NOW()) AND YEAR(created_at) = YEAR(NOW()) THEN monto ELSE 0 END), 0) AS recaudado_mes_actual
        FROM solicitudes_suscripcion
    ");
    $metricas = $stmtMet->fetch();

    Response::json([
        'success'     => true,
        'solicitudes' => $solicitudes,
        'pagos'       => $pagos,
        'metricas'    => $metricas
    ]);
}

if ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true) ?? [];
    $action = trim((string)($input['action'] ?? ''));

    // 1. APROBAR SOLICITUD DE TRANSFERENCIA
    if ($action === 'aprobar') {
        $solicitudId = (int)($input['id'] ?? 0);
        if ($solicitudId <= 0) {
            Response::json(['error' => 'ID de solicitud requerido.'], 422);
        }

        $stmtSol = $db->prepare("SELECT * FROM solicitudes_suscripcion WHERE id = :id LIMIT 1");
        $stmtSol->execute(['id' => $solicitudId]);
        $solicitud = $stmtSol->fetch();

        if (!$solicitud) {
            Response::json(['error' => 'Solicitud no encontrada.'], 404);
        }

        if ($solicitud['estado'] !== 'pendiente') {
            Response::json(['error' => 'Esta solicitud ya fue procesada anteriormente.'], 400);
        }

        $negocioId = (int)$solicitud['negocio_id'];
        $dias = (int)$solicitud['dias'];
        $monto = (float)$solicitud['monto'];

        $stmtNeg = $db->prepare("SELECT id, nombre, fecha_expiracion FROM negocios WHERE id = :nid LIMIT 1");
        $stmtNeg->execute(['nid' => $negocioId]);
        $negocio = $stmtNeg->fetch();

        if (!$negocio) {
            Response::json(['error' => 'Negocio no encontrado.'], 404);
        }

        try {
            $db->beginTransaction();

            $ahora = new DateTimeImmutable('now');
            $expPrev = new DateTimeImmutable($negocio['fecha_expiracion']);
            $base = ($expPrev > $ahora) ? $expPrev : $ahora;
            $nuevaExp = $base->modify("+{$dias} days")->format('Y-m-d H:i:s');

            // Actualizar negocio
            $upNeg = $db->prepare("
                UPDATE negocios 
                SET estado = 'activo', fecha_expiracion = :exp 
                WHERE id = :nid
            ");
            $upNeg->execute(['exp' => $nuevaExp, 'nid' => $negocioId]);

            // Registrar en pagos_saas
            $insPago = $db->prepare("
                INSERT INTO pagos_saas 
                    (negocio_id, aprobado_por, dias_agregados, monto, metodo_pago, notas, fecha_expiracion_previa, fecha_expiracion_nueva)
                VALUES 
                    (:nid, :aprob, :dias, :monto, 'transferencia', :notas, :prev, :nueva)
            ");
            $insPago->execute([
                'nid'   => $negocioId,
                'aprob' => $adminId,
                'dias'  => $dias,
                'monto' => $monto,
                'notas' => "Plan {$solicitud['plan_tipo']} (Comprobante #{$solicitud['numero_comprobante']} - Banco: {$solicitud['banco_origen']})",
                'prev'  => $negocio['fecha_expiracion'],
                'nueva' => $nuevaExp
            ]);

            // Actualizar solicitud
            $upSol = $db->prepare("
                UPDATE solicitudes_suscripcion
                SET estado = 'aprobado',
                    revisado_por = :uid,
                    revisado_en = NOW()
                WHERE id = :id
            ");
            $upSol->execute(['uid' => $adminId, 'id' => $solicitudId]);

            $db->commit();

            Response::json([
                'success' => true,
                'message' => "Solicitud aprobada con éxito. Se activó el plan {$solicitud['plan_tipo']} (+{$dias} días) para '{$negocio['nombre']}'.",
                'nueva_expiracion' => $nuevaExp
            ]);
        } catch (Throwable $e) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }
            Response::json(['error' => 'Error al aprobar solicitud: ' . $e->getMessage()], 500);
        }
    }

    // 2. RECHAZAR SOLICITUD DE TRANSFERENCIA
    if ($action === 'rechazar') {
        $solicitudId = (int)($input['id'] ?? 0);
        $motivo = trim((string)($input['motivo'] ?? 'Comprobante no válido o pago no acreditado.'));

        if ($solicitudId <= 0) {
            Response::json(['error' => 'ID de solicitud requerido.'], 422);
        }

        $upSol = $db->prepare("
            UPDATE solicitudes_suscripcion
            SET estado = 'rechazado',
                motivo_rechazo = :motivo,
                revisado_por = :uid,
                revisado_en = NOW()
            WHERE id = :id
        ");
        $upSol->execute([
            'motivo' => $motivo,
            'uid'    => $adminId,
            'id'     => $solicitudId
        ]);

        Response::json([
            'success' => true,
            'message' => 'Solicitud marcada como rechazada.'
        ]);
    }

    // 3. REGISTRAR PAGO DIRECTO / MANUAL DE TRANSFERENCIA
    if ($action === 'manual') {
        $negocioId = (int)($input['negocio_id'] ?? 0);
        $planTipo  = in_array($input['plan_tipo'] ?? '', ['mensual', 'anual'], true) ? $input['plan_tipo'] : 'mensual';
        $dias      = ($planTipo === 'anual') ? 365 : 30;
        $monto     = max(0.0, (float)($input['monto'] ?? 0.0));
        $banco     = trim((string)($input['banco_origen'] ?? 'Transferencia Bancaria Directa'));
        $comprob   = trim((string)($input['numero_comprobante'] ?? 'DIRECTO-' . date('YmdHis')));
        $notas     = trim((string)($input['notas'] ?? ''));

        if ($negocioId <= 0) {
            Response::json(['error' => 'Debes seleccionar un negocio.'], 422);
        }

        $stmtNeg = $db->prepare("SELECT id, nombre, fecha_expiracion FROM negocios WHERE id = :nid LIMIT 1");
        $stmtNeg->execute(['nid' => $negocioId]);
        $negocio = $stmtNeg->fetch();

        if (!$negocio) {
            Response::json(['error' => 'Negocio no encontrado.'], 404);
        }

        try {
            $db->beginTransaction();

            $ahora = new DateTimeImmutable('now');
            $expPrev = new DateTimeImmutable($negocio['fecha_expiracion']);
            $base = ($expPrev > $ahora) ? $expPrev : $ahora;
            $nuevaExp = $base->modify("+{$dias} days")->format('Y-m-d H:i:s');

            // Actualizar negocio
            $db->prepare("UPDATE negocios SET estado = 'activo', fecha_expiracion = :exp WHERE id = :nid")
               ->execute(['exp' => $nuevaExp, 'nid' => $negocioId]);

            // Guardar en solicitudes
            $insSol = $db->prepare("
                INSERT INTO solicitudes_suscripcion
                    (negocio_id, plan_tipo, dias, monto, banco_origen, numero_comprobante, estado, revisado_por, revisado_en)
                VALUES
                    (:nid, :plan, :dias, :monto, :banco, :comp, 'aprobado', :uid, NOW())
            ");
            $insSol->execute([
                'nid'   => $negocioId,
                'plan'  => $planTipo,
                'dias'  => $dias,
                'monto' => $monto,
                'banco' => $banco,
                'comp'  => $comprob,
                'uid'   => $adminId
            ]);

            // Guardar en pagos_saas
            $insPago = $db->prepare("
                INSERT INTO pagos_saas 
                    (negocio_id, aprobado_por, dias_agregados, monto, metodo_pago, notas, fecha_expiracion_previa, fecha_expiracion_nueva)
                VALUES 
                    (:nid, :aprob, :dias, :monto, 'transferencia', :notas, :prev, :nueva)
            ");
            $insPago->execute([
                'nid'   => $negocioId,
                'aprob' => $adminId,
                'dias'  => $dias,
                'monto' => $monto,
                'notas' => "Aprobación manual SuperAdmin: Plan {$planTipo} - Comprobante #{$comprob} - {$notas}",
                'prev'  => $negocio['fecha_expiracion'],
                'nueva' => $nuevaExp
            ]);

            $db->commit();

            Response::json([
                'success' => true,
                'message' => "Suscripción activada con éxito para '{$negocio['nombre']}' (+{$dias} días).",
                'nueva_expiracion' => $nuevaExp
            ]);
        } catch (Throwable $e) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }
            Response::json(['error' => 'Error al registrar suscripción: ' . $e->getMessage()], 500);
        }
    }

    Response::json(['error' => 'Acción no soportada.'], 400);
}

Response::json(['error' => 'Método no permitido.'], 405);
