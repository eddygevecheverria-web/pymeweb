<?php
declare(strict_types=1);

require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../core/AuthMiddleware.php';
require_once __DIR__ . '/../../core/AccountingService.php';
require_once __DIR__ . '/../../core/Response.php';

$session   = AuthMiddleware::authenticate();
$negocioId = (int)$session['negocio_id'];
$usuarioId = (int)$session['user_id'];
$db        = Database::getConnection();

$method = $_SERVER['REQUEST_METHOD'];

// =========================================================================
// GET: Listar retenciones de clientes recibidas
// =========================================================================
if ($method === 'GET') {
    $ventaId = isset($_GET['venta_id']) ? (int)$_GET['venta_id'] : 0;
    
    $sql = "
        SELECT 
            rc.*,
            c.nombre AS cliente_nombre,
            c.documento AS cliente_documento,
            v.total AS venta_total,
            v.metodo_pago AS venta_metodo_pago,
            ac.numero_asiento
        FROM retenciones_clientes rc
        JOIN clientes c ON c.id = rc.cliente_id
        JOIN ventas v ON v.id = rc.venta_id
        LEFT JOIN asientos_contables ac ON ac.id = rc.asiento_id
        WHERE rc.negocio_id = :nid
    ";
    $params = ['nid' => $negocioId];

    if ($ventaId > 0) {
        $sql .= " AND rc.venta_id = :vid";
        $params['vid'] = $ventaId;
    }

    $sql .= " ORDER BY rc.id DESC LIMIT 100";
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    $retenciones = $stmt->fetchAll();

    Response::json([
        'success' => true,
        'data'    => $retenciones
    ]);
}

// =========================================================================
// POST: Registrar nueva retención recibida de un cliente
// =========================================================================
if ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true) ?? [];

    $ventaId         = (int)($input['venta_id'] ?? 0);
    $numeroRetencion = trim((string)($input['numero_retencion'] ?? ''));
    $fechaEmision    = trim((string)($input['fecha_emision'] ?? date('Y-m-d')));
    $retRenta        = round((float)($input['retencion_renta'] ?? 0.0), 2);
    $porcRenta       = round((float)($input['porcentaje_renta'] ?? 1.75), 2);
    $retIva          = round((float)($input['retencion_iva'] ?? 0.0), 2);
    $porcIva         = round((float)($input['porcentaje_iva'] ?? 30.0), 2);
    $pagoComplementario = round((float)($input['pago_complementario'] ?? 0.0), 2);
    $metodoPagoComp  = trim((string)($input['metodo_pago'] ?? 'efectivo'));
    $observaciones   = trim((string)($input['observaciones'] ?? ''));

    if ($ventaId <= 0) {
        Response::json(['error' => 'Debe especificar la venta asociada a la retención.'], 422);
    }
    if (empty($numeroRetencion)) {
        Response::json(['error' => 'El número de comprobante de retención emitido por el cliente es obligatorio.'], 422);
    }
    if ($retRenta <= 0 && $retIva <= 0) {
        Response::json(['error' => 'Debe ingresar al menos un valor de retención (Renta o IVA).'], 422);
    }

    // 1. Obtener la venta
    $stmtVenta = $db->prepare("
        SELECT v.*, c.nombre AS cliente_nombre, c.documento AS cliente_documento
        FROM ventas v
        LEFT JOIN clientes c ON c.id = v.cliente_id
        WHERE v.id = :vid AND v.negocio_id = :nid
        LIMIT 1
    ");
    $stmtVenta->execute(['vid' => $ventaId, 'nid' => $negocioId]);
    $venta = $stmtVenta->fetch();

    if (!$venta) {
        Response::json(['error' => 'La venta no existe en este negocio.'], 404);
    }
    if (empty($venta['cliente_id'])) {
        Response::json(['error' => 'No se puede registrar retención para consumidor final sin cliente registrado.'], 422);
    }

    $totalRetenido = round($retRenta + $retIva, 2);

    // 2. Verificar que no se duplique el número de retención para el mismo cliente
    $stmtDup = $db->prepare("
        SELECT id FROM retenciones_clientes 
        WHERE negocio_id = :nid AND numero_retencion = :num AND cliente_id = :cid
        LIMIT 1
    ");
    $stmtDup->execute([
        'nid' => $negocioId,
        'num' => $numeroRetencion,
        'cid' => $venta['cliente_id']
    ]);
    if ($stmtDup->fetch()) {
        Response::json(['error' => "El comprobante de retención #{$numeroRetencion} ya fue registrado previamente para este cliente."], 422);
    }

    // 3. Buscar número de factura de venta asociada
    $stmtFac = $db->prepare("
        SELECT numero_comprobante FROM comprobantes_electronicos_sri 
        WHERE origen_id = :vid AND negocio_id = :nid AND tipo_documento = '01'
        LIMIT 1
    ");
    $stmtFac->execute(['vid' => $ventaId, 'nid' => $negocioId]);
    $numFacturaVenta = $stmtFac->fetchColumn() ?: sprintf('VTA-%06d', $ventaId);

    // 4. Inserción en la base de datos
    $ins = $db->prepare("
        INSERT INTO retenciones_clientes
            (negocio_id, venta_id, cliente_id, numero_retencion, fecha_emision, retencion_renta, porcentaje_renta, retencion_iva, porcentaje_iva, total_retenido, observaciones)
        VALUES
            (:nid, :vid, :cid, :num, :fec, :r_renta, :p_renta, :r_iva, :p_iva, :tot, :obs)
    ");
    $ins->execute([
        'nid'     => $negocioId,
        'vid'     => $ventaId,
        'cid'     => $venta['cliente_id'],
        'num'     => $numeroRetencion,
        'fec'     => $fechaEmision,
        'r_renta' => $retRenta,
        'p_renta' => $porcRenta,
        'r_iva'   => $retIva,
        'p_iva'   => $porcIva,
        'tot'     => $totalRetenido,
        'obs'     => $observaciones ?: null,
    ]);
    $retencionId = (int)$db->lastInsertId();

    // 5. Asiento Contable Automático (Anticipo de Impuestos vs Cuentas por Cobrar)
    $asientoId = AccountingService::recordIncomingRetentionEntry(
        $negocioId,
        $usuarioId,
        $retencionId,
        $ventaId,
        $numeroRetencion,
        $numFacturaVenta,
        $venta['cliente_nombre'] ?? 'Cliente',
        $retRenta,
        $retIva,
        $pagoComplementario,
        $metodoPagoComp
    );

    if ($asientoId) {
        $db->prepare("UPDATE retenciones_clientes SET asiento_id = :aid WHERE id = :rid")
           ->execute(['aid' => $asientoId, 'rid' => $retencionId]);
    }

    Response::json([
        'success'          => true,
        'mensaje'          => "Retención del cliente #{$numeroRetencion} registrada con éxito.",
        'retencion_id'     => $retencionId,
        'asiento_id'       => $asientoId,
        'total_retenido'   => $totalRetenido,
        'anticipo_renta'   => $retRenta,
        'anticipo_iva'     => $retIva,
    ], 201);
}

Response::json(['error' => 'Método no permitido'], 405);
