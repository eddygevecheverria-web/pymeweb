<?php
declare(strict_types=1);

require_once __DIR__ . '/../../../config/cors.php';
require_once __DIR__ . '/../../../config/database.php';
require_once __DIR__ . '/../../../core/AuthMiddleware.php';
require_once __DIR__ . '/../../../core/AccountingService.php';
require_once __DIR__ . '/../../../core/Response.php';

$session   = AuthMiddleware::authenticate();
$negocioId = (int)$session['negocio_id'];
$usuarioId = (int)$session['user_id'];
$db        = Database::getConnection();
$method    = $_SERVER['REQUEST_METHOD'];

// GET: Consulta del Libro Diario
if ($method === 'GET') {
    $desde = trim($_GET['desde'] ?? '');
    $hasta = trim($_GET['hasta'] ?? '');
    $num   = !empty($_GET['numero']) ? (int)$_GET['numero'] : null;

    $query = "
        SELECT 
            a.id, a.numero_asiento, a.fecha, a.tipo_asiento, a.concepto, a.origen, a.origen_id,
            a.total_debe, a.total_haber, a.estado, a.asiento_reversion_id, a.created_at,
            u.nombre AS creador_nombre
        FROM asientos_contables a
        LEFT JOIN usuarios u ON u.id = a.creado_por
        WHERE a.negocio_id = :nid
    ";
    $params = ['nid' => $negocioId];

    if ($num) {
        $query .= " AND a.numero_asiento = :num";
        $params['num'] = $num;
    } else {
        if ($desde !== '') {
            $query .= " AND a.fecha >= :desde";
            $params['desde'] = $desde;
        }
        if ($hasta !== '') {
            $query .= " AND a.fecha <= :hasta";
            $params['hasta'] = $hasta;
        }
    }

    $query .= " ORDER BY a.fecha DESC, a.numero_asiento DESC LIMIT 100";

    $stmt = $db->prepare($query);
    $stmt->execute($params);
    $asientos = $stmt->fetchAll();

    // Cargar detalles de cada asiento
    if (!empty($asientos)) {
        $asientoIds = array_column($asientos, 'id');
        $placeholders = implode(',', array_fill(0, count($asientoIds), '?'));

        $stmtDet = $db->prepare("
            SELECT 
                d.asiento_id, d.linea, d.cuenta_id, d.concepto, d.debe, d.haber, d.referencia_documento,
                c.codigo AS cuenta_codigo, c.nombre AS cuenta_nombre
            FROM detalles_asiento d
            INNER JOIN plan_cuentas c ON c.id = d.cuenta_id
            WHERE d.asiento_id IN ($placeholders)
            ORDER BY d.asiento_id ASC, d.linea ASC
        ");
        $stmtDet->execute($asientoIds);
        $allDetalles = $stmtDet->fetchAll();

        $detMap = [];
        foreach ($allDetalles as $det) {
            $detMap[$det['asiento_id']][] = $det;
        }

        foreach ($asientos as &$as) {
            $as['lineas'] = $detMap[$as['id']] ?? [];
        }
        unset($as);
    }

    Response::json([
        'total'    => count($asientos),
        'asientos' => $asientos
    ]);
}

// POST: Registrar Asiento Contable Manual (Doble Partida)
if ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true) ?? [];

    try {
        $resultado = AccountingService::createAsiento($negocioId, $usuarioId, [
            'fecha'        => $input['fecha'] ?? date('Y-m-d'),
            'tipo_asiento' => $input['tipo_asiento'] ?? 'DIARIO',
            'concepto'     => $input['concepto'] ?? '',
            'origen'       => 'manual',
            'detalles'     => $input['detalles'] ?? []
        ]);

        Response::json([
            'message'        => "Asiento contable #{$resultado['numero_asiento']} registrado y mayorizado exitosamente.",
            'asiento_id'     => $resultado['asiento_id'],
            'numero_asiento' => $resultado['numero_asiento'],
            'total'          => $resultado['total']
        ], 201);
    } catch (InvalidArgumentException | DomainException $e) {
        Response::json(['error' => $e->getMessage()], 422);
    } catch (Throwable $e) {
        Response::json(['error' => 'Error al procesar el asiento contable: ' . $e->getMessage()], 500);
    }
}

// PATCH: Anular un Asiento Contable mediante Reversión (Principio de Inmutabilidad)
if ($method === 'PATCH') {
    $input     = json_decode(file_get_contents('php://input'), true) ?? [];
    $asientoId = (int)($input['asiento_id'] ?? 0);
    $motivo    = trim((string)($input['motivo'] ?? 'Error de digitación'));

    if ($asientoId <= 0) {
        Response::json(['error' => 'ID de asiento requerido.'], 422);
    }

    try {
        $resultado = AccountingService::reverseAsiento($negocioId, $asientoId, $usuarioId, $motivo);
        Response::json($resultado);
    } catch (DomainException $e) {
        Response::json(['error' => $e->getMessage()], 422);
    } catch (Throwable $e) {
        Response::json(['error' => 'Error al anular el asiento: ' . $e->getMessage()], 500);
    }
}

Response::json(['error' => 'Método no permitido.'], 405);
