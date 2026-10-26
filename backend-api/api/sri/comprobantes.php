<?php
declare(strict_types=1);

require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../core/AuthMiddleware.php';
require_once __DIR__ . '/../../core/sri/SriSoapClient.php';
require_once __DIR__ . '/../../core/sri/SriRideGenerator.php';
require_once __DIR__ . '/../../core/Response.php';

$session   = AuthMiddleware::authenticate();
$negocioId = (int)$session['negocio_id'];
$db        = Database::getConnection();

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

// =========================================================================
// ACTION: Descargar XML del Comprobante
// =========================================================================
if ($method === 'GET' && $action === 'download_xml') {
    $claveAcceso = trim((string)($_GET['clave_acceso'] ?? ''));
    if (empty($claveAcceso)) {
        Response::json(['error' => 'Clave de acceso requerida.'], 400);
    }

    $stmt = $db->prepare("
        SELECT clave_acceso, xml_firmado, xml_autorizado, numero_comprobante 
        FROM comprobantes_electronicos_sri 
        WHERE clave_acceso = :clave AND negocio_id = :nid 
        LIMIT 1
    ");
    $stmt->execute(['clave' => $claveAcceso, 'nid' => $negocioId]);
    $row = $stmt->fetch();

    if (!$row) {
        Response::json(['error' => 'Comprobante no encontrado.'], 404);
    }

    $xml = !empty($row['xml_autorizado']) ? $row['xml_autorizado'] : $row['xml_firmado'];
    header('Content-Type: application/xml; charset=utf-8');
    header('Content-Disposition: attachment; filename="' . $row['numero_comprobante'] . '.xml"');
    echo $xml;
    exit;
}

// =========================================================================
// ACTION: Descargar RIDE PDF del Comprobante
// =========================================================================
if ($method === 'GET' && $action === 'download_pdf') {
    $claveAcceso = trim((string)($_GET['clave_acceso'] ?? ''));
    if (empty($claveAcceso)) {
        Response::json(['error' => 'Clave de acceso requerida.'], 400);
    }

    $stmt = $db->prepare("
        SELECT * FROM comprobantes_electronicos_sri 
        WHERE clave_acceso = :clave AND negocio_id = :nid 
        LIMIT 1
    ");
    $stmt->execute(['clave' => $claveAcceso, 'nid' => $negocioId]);
    $comp = $stmt->fetch();

    if (!$comp) {
        Response::json(['error' => 'Comprobante no encontrado.'], 404);
    }

    $stmtCfg = $db->prepare("SELECT * FROM configuracion_sri WHERE negocio_id = :nid LIMIT 1");
    $stmtCfg->execute(['nid' => $negocioId]);
    $sriConfig = $stmtCfg->fetch() ?: [];

    $pdf = '';
    $tipo = $comp['tipo_documento'];

    if ($tipo === '01') {
        // Factura
        $stmtVenta = $db->prepare("
            SELECT v.*, c.nombre, c.documento, c.email, c.telefono, c.direccion 
            FROM ventas v 
            LEFT JOIN clientes c ON c.id = v.cliente_id 
            WHERE v.id = :vid AND v.negocio_id = :nid 
            LIMIT 1
        ");
        $stmtVenta->execute(['vid' => $comp['origen_id'], 'nid' => $negocioId]);
        $v = $stmtVenta->fetch();

        $stmtDet = $db->prepare("SELECT * FROM venta_detalles WHERE venta_id = :vid AND negocio_id = :nid");
        $stmtDet->execute(['vid' => $comp['origen_id'], 'nid' => $negocioId]);
        $det = $stmtDet->fetchAll();

        $pdf = SriRideGenerator::generate(
            $sriConfig,
            [
                'nombre'    => $v['nombre'] ?? 'CONSUMIDOR FINAL',
                'documento' => $v['documento'] ?? '9999999999999',
                'email'     => $v['email'] ?? '',
                'telefono'  => $v['telefono'] ?? '',
                'direccion' => $v['direccion'] ?? 'S/N',
            ],
            $comp['numero_comprobante'],
            $comp['clave_acceso'],
            $comp['fecha_autorizacion'] ?? $comp['created_at'],
            $comp['numero_autorizacion'] ?? $comp['clave_acceso'],
            (int)$comp['ambiente'],
            (float)($v['subtotal'] ?? 0),
            (float)($v['impuesto'] ?? 0),
            (float)($v['total'] ?? 0),
            $v['metodo_pago'] ?? 'efectivo',
            $det,
            $comp['estado_sri']
        );
    } elseif ($tipo === '04') {
        // Nota de Crédito
        $stmtNC = $db->prepare("
            SELECT nc.*, c.nombre, c.documento, c.email 
            FROM notas_credito nc 
            LEFT JOIN clientes c ON c.id = nc.cliente_id 
            WHERE nc.id = :ncid AND nc.negocio_id = :nid 
            LIMIT 1
        ");
        $stmtNC->execute(['ncid' => $comp['origen_id'], 'nid' => $negocioId]);
        $nc = $stmtNC->fetch();

        $stmtDet = $db->prepare("SELECT * FROM venta_detalles WHERE venta_id = :vid AND negocio_id = :nid");
        $stmtDet->execute(['vid' => $nc['venta_id'] ?? 0, 'nid' => $negocioId]);
        $det = $stmtDet->fetchAll();

        $pdf = SriRideGenerator::generateNotaCredito(
            $sriConfig,
            [
                'nombre'    => $nc['nombre'] ?? 'CONSUMIDOR FINAL',
                'documento' => $nc['documento'] ?? '9999999999999',
                'email'     => $nc['email'] ?? '',
            ],
            $comp['numero_comprobante'],
            $comp['clave_acceso'],
            $comp['fecha_autorizacion'] ?? $comp['created_at'],
            $comp['numero_autorizacion'] ?? $comp['clave_acceso'],
            (int)$comp['ambiente'],
            $nc['numero_factura_modificada'] ?? '',
            $nc['motivo'] ?? 'Devolución',
            (float)($nc['subtotal_15'] ?? 0) + (float)($nc['subtotal_0'] ?? 0),
            (float)($nc['iva'] ?? 0),
            (float)($nc['total'] ?? 0),
            $det,
            $comp['estado_sri']
        );
    } elseif ($tipo === '07') {
        // Comprobante de Retención
        $stmtComp = $db->prepare("
            SELECT c.*, p.razon_social, p.ruc_cedula 
            FROM compras c 
            LEFT JOIN proveedores p ON p.id = c.proveedor_id 
            WHERE c.id = :cid AND c.negocio_id = :nid 
            LIMIT 1
        ");
        $stmtComp->execute(['cid' => $comp['origen_id'], 'nid' => $negocioId]);
        $c = $stmtComp->fetch();

        $subtotalRet = (float)($c['subtotal'] ?? 0);
        $ivaRet      = (float)($c['iva'] ?? 0);
        $impList = [
            [
                'codigo_impuesto'  => 1,
                'codigo_retencion' => '312',
                'base_imponible'   => $subtotalRet,
                'porcentaje'       => 1.75,
                'valor_retenido'   => round($subtotalRet * 0.0175, 2)
            ]
        ];
        if ($ivaRet > 0) {
            $impList[] = [
                'codigo_impuesto'  => 2,
                'codigo_retencion' => '1',
                'base_imponible'   => $ivaRet,
                'porcentaje'       => 30.00,
                'valor_retenido'   => round($ivaRet * 0.30, 2)
            ];
        }
        $totRet = 0.0;
        foreach ($impList as $i) $totRet += $i['valor_retenido'];

        $pdf = SriRideGenerator::generateRetencion(
            $sriConfig,
            [
                'razon_social' => $c['razon_social'] ?? 'PROVEEDOR',
                'ruc'          => $c['ruc_cedula'] ?? '1790011122001'
            ],
            $comp['numero_comprobante'],
            $comp['clave_acceso'],
            $comp['fecha_autorizacion'] ?? $comp['created_at'],
            $comp['numero_autorizacion'] ?? $comp['clave_acceso'],
            (int)$comp['ambiente'],
            $c['numero_factura'] ?? '001-001-000000001',
            $c['fecha_emision'] ?? date('Y-m-d'),
            $impList,
            $totRet,
            $comp['estado_sri']
        );
    }

    header('Content-Type: application/pdf');
    header('Content-Disposition: inline; filename="' . $comp['numero_comprobante'] . '.pdf"');
    echo $pdf;
    exit;
}

// =========================================================================
// ACTION: Reintentar Autorización de un Comprobante Pendiente (POST)
// =========================================================================
if ($method === 'POST' && ($action === 'retry' || isset($_GET['retry']))) {
    $input = json_decode(file_get_contents('php://input'), true) ?? [];
    $claveAcceso = trim((string)($input['clave_acceso'] ?? ''));

    if (empty($claveAcceso)) {
        Response::json(['error' => 'Clave de acceso requerida para reintentar.'], 400);
    }

    $stmt = $db->prepare("
        SELECT * FROM comprobantes_electronicos_sri 
        WHERE clave_acceso = :clave AND negocio_id = :nid 
        LIMIT 1
    ");
    $stmt->execute(['clave' => $claveAcceso, 'nid' => $negocioId]);
    $comp = $stmt->fetch();

    if (!$comp) {
        Response::json(['error' => 'Comprobante no encontrado.'], 404);
    }

    // Consultar autorización en SOAP del SRI
    $soapClient = new SriSoapClient((int)$comp['ambiente']);
    $res = $soapClient->consultarAutorizacion($claveAcceso);

    $nuevoEstado = $comp['estado_sri'];
    $nuevoMensaje = $comp['mensaje_sri'];
    $numAut = $comp['numero_autorizacion'];
    $fecAut = $comp['fecha_autorizacion'];

    if ($res['success']) {
        $nuevoEstado = 'AUTORIZADO';
        $numAut      = $res['numero_autorizacion'];
        $fecAut      = $res['fecha_autorizacion'];
        $nuevoMensaje = 'Comprobante AUTORIZADO con éxito por el SRI.';
    } else {
        $nuevoEstado  = $res['estado'] ?: 'PENDIENTE';
        $nuevoMensaje = $res['mensaje'] ?: 'Comprobante sigue en procesamiento.';
    }

    $upd = $db->prepare("
        UPDATE comprobantes_electronicos_sri
        SET estado_sri = :est, mensaje_sri = :msg, numero_autorizacion = :num, fecha_autorizacion = :fec
        WHERE clave_acceso = :clave AND negocio_id = :nid
    ");
    $upd->execute([
        'est'   => $nuevoEstado,
        'msg'   => $nuevoMensaje,
        'num'   => $numAut,
        'fec'   => $fecAut,
        'clave' => $claveAcceso,
        'nid'   => $negocioId,
    ]);

    Response::json([
        'success'             => $nuevoEstado === 'AUTORIZADO',
        'estado_sri'          => $nuevoEstado,
        'mensaje'             => $nuevoMensaje,
        'numero_autorizacion' => $numAut,
        'fecha_autorizacion'  => $fecAut,
    ]);
}

// =========================================================================
// ACTION: Listar ventas facturadas activas para emitir Nota de Crédito
// =========================================================================
if ($method === 'GET' && $action === 'ventas_facturadas') {
    $stmtVentas = $db->prepare("
        SELECT 
            v.id, v.cliente_id, v.metodo_pago, v.subtotal, v.impuesto, v.total, v.estado, v.created_at,
            COALESCE(c.nombre, 'CONSUMIDOR FINAL') AS cliente_nombre, 
            COALESCE(c.documento, '9999999999999') AS cliente_documento,
            ces.numero_comprobante, ces.clave_acceso, ces.estado_sri
        FROM ventas v
        LEFT JOIN clientes c ON c.id = v.cliente_id
        LEFT JOIN comprobantes_electronicos_sri ces ON ces.origen_id = v.id AND ces.tipo_documento = '01' AND ces.negocio_id = v.negocio_id
        LEFT JOIN notas_credito nc ON nc.venta_id = v.id AND nc.negocio_id = v.negocio_id AND nc.estado_sri = 'AUTORIZADO'
        WHERE v.negocio_id = :nid AND v.estado != 'ANULADA' AND nc.id IS NULL
        ORDER BY v.id DESC
        LIMIT 50
    ");
    $stmtVentas->execute(['nid' => $negocioId]);
    Response::json(['success' => true, 'data' => $stmtVentas->fetchAll()]);
}

// =========================================================================
// ACTION: Listar compras a proveedores para emitir Comprobante de Retención
// =========================================================================
if ($method === 'GET' && $action === 'compras_retencion') {
    $stmtCompras = $db->prepare("
        SELECT 
            c.id, c.numero_factura, c.fecha_emision, c.subtotal, c.iva, c.total, c.estado,
            COALESCE(p.razon_social, 'PROVEEDOR') AS proveedor_nombre, 
            COALESCE(p.ruc_cedula, '1790011122001') AS proveedor_ruc,
            ces.numero_comprobante AS retencion_numero, ces.estado_sri AS retencion_estado
        FROM compras c
        LEFT JOIN proveedores p ON p.id = c.proveedor_id
        LEFT JOIN comprobantes_electronicos_sri ces ON ces.origen_id = c.id AND ces.tipo_documento = '07' AND ces.negocio_id = c.negocio_id
        WHERE c.negocio_id = :nid AND c.estado != 'ANULADA'
        ORDER BY c.id DESC
        LIMIT 50
    ");
    $stmtCompras->execute(['nid' => $negocioId]);
    Response::json(['success' => true, 'data' => $stmtCompras->fetchAll()]);
}

// =========================================================================
// GET: Listado con filtros y paginación
// =========================================================================
if ($method === 'GET') {
    $tipoDoc   = trim((string)($_GET['tipo_documento'] ?? 'all'));
    $estadoSri = trim((string)($_GET['estado_sri'] ?? 'all'));
    $desde     = trim((string)($_GET['desde'] ?? ''));
    $hasta     = trim((string)($_GET['hasta'] ?? ''));
    $buscar    = trim((string)($_GET['buscar'] ?? ''));
    $page      = max(1, (int)($_GET['page'] ?? 1));
    $limit     = min(100, max(1, (int)($_GET['limit'] ?? 20)));
    $offset    = ($page - 1) * $limit;

    $where = ["ces.negocio_id = :nid"];
    $params = ['nid' => $negocioId];

    if ($tipoDoc !== 'all' && in_array($tipoDoc, ['01', '04', '07'], true)) {
        $where[] = "ces.tipo_documento = :tipo";
        $params['tipo'] = $tipoDoc;
    }
    if ($estadoSri !== 'all' && !empty($estadoSri)) {
        $where[] = "ces.estado_sri = :estado";
        $params['estado'] = $estadoSri;
    }
    if (!empty($desde)) {
        $where[] = "ces.fecha_emision >= :desde";
        $params['desde'] = $desde;
    }
    if (!empty($hasta)) {
        $where[] = "ces.fecha_emision <= :hasta";
        $params['hasta'] = $hasta;
    }
    if (!empty($buscar)) {
        $where[] = "(ces.numero_comprobante LIKE :q OR ces.clave_acceso LIKE :q)";
        $params['q'] = "%{$buscar}%";
    }

    $whereSql = implode(' AND ', $where);

    // Conteo total
    $stmtCount = $db->prepare("SELECT COUNT(*) FROM comprobantes_electronicos_sri ces WHERE {$whereSql}");
    $stmtCount->execute($params);
    $totalRecords = (int)$stmtCount->fetchColumn();

    // Registros
    $sql = "
        SELECT 
            ces.id,
            ces.tipo_documento,
            ces.origen_tipo,
            ces.origen_id,
            ces.serie,
            ces.secuencial,
            ces.numero_comprobante,
            ces.clave_acceso,
            ces.fecha_emision,
            ces.ambiente,
            ces.estado_sri,
            ces.mensaje_sri,
            ces.numero_autorizacion,
            ces.fecha_autorizacion,
            ces.email_enviado,
            ces.asiento_id,
            ces.created_at,
            CASE 
                WHEN ces.tipo_documento = '01' THEN 'Factura'
                WHEN ces.tipo_documento = '04' THEN 'Nota de Crédito'
                WHEN ces.tipo_documento = '07' THEN 'Comprobante de Retención'
                ELSE 'Comprobante'
            END AS tipo_nombre
        FROM comprobantes_electronicos_sri ces
        WHERE {$whereSql}
        ORDER BY ces.id DESC
        LIMIT :lim OFFSET :off
    ";

    $stmt = $db->prepare($sql);
    foreach ($params as $k => $v) {
        $stmt->bindValue(':' . $k, $v);
    }
    $stmt->bindValue(':lim', $limit, PDO::PARAM_INT);
    $stmt->bindValue(':off', $offset, PDO::PARAM_INT);
    $stmt->execute();
    $comprobantes = $stmt->fetchAll();

    // Contadores de resumen para badges superiores
    $stmtStats = $db->prepare("
        SELECT 
            COUNT(*) AS total_emitidos,
            SUM(CASE WHEN estado_sri = 'AUTORIZADO' THEN 1 ELSE 0 END) AS total_autorizados,
            SUM(CASE WHEN estado_sri = 'PENDIENTE' THEN 1 ELSE 0 END) AS total_pendientes,
            SUM(CASE WHEN estado_sri IN ('DEVUELTA', 'NO_AUTORIZADO') THEN 1 ELSE 0 END) AS total_rechazados
        FROM comprobantes_electronicos_sri
        WHERE negocio_id = :nid
    ");
    $stmtStats->execute(['nid' => $negocioId]);
    $stats = $stmtStats->fetch();

    Response::json([
        'success'    => true,
        'data'       => $comprobantes,
        'pagination' => [
            'total'       => $totalRecords,
            'page'        => $page,
            'limit'       => $limit,
            'total_pages' => ceil($totalRecords / $limit),
        ],
        'resumen'    => [
            'total_emitidos'    => (int)($stats['total_emitidos'] ?? 0),
            'total_autorizados' => (int)($stats['total_autorizados'] ?? 0),
            'total_pendientes'  => (int)($stats['total_pendientes'] ?? 0),
            'total_rechazados'  => (int)($stats['total_rechazados'] ?? 0),
        ]
    ]);
}

Response::json(['error' => 'Método no permitido'], 405);
