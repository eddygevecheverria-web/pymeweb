<?php
declare(strict_types=1);

require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../core/AuthMiddleware.php';
require_once __DIR__ . '/../../core/Response.php';

$session   = AuthMiddleware::authenticate();
$negocioId = (int)$session['negocio_id'];
$db        = Database::getConnection();

$stmtKpi = $db->prepare("
    SELECT
        COALESCE(SUM(CASE WHEN DATE(v.created_at) = CURRENT_DATE() THEN vd.subtotal ELSE 0 END), 0) AS ventas_hoy,
        COALESCE(SUM(CASE WHEN DATE(v.created_at) = CURRENT_DATE() 
            THEN (vd.precio_unitario - vd.precio_compra_unitario) * vd.cantidad ELSE 0 END), 0) AS ganancia_hoy,
        COALESCE(SUM(CASE WHEN YEAR(v.created_at) = YEAR(CURRENT_DATE()) AND MONTH(v.created_at) = MONTH(CURRENT_DATE()) 
            THEN vd.subtotal ELSE 0 END), 0) AS ventas_mes,
        COALESCE(SUM(CASE WHEN YEAR(v.created_at) = YEAR(CURRENT_DATE()) AND MONTH(v.created_at) = MONTH(CURRENT_DATE()) 
            THEN (vd.precio_unitario - vd.precio_compra_unitario) * vd.cantidad ELSE 0 END), 0) AS ganancia_mes
    FROM ventas v
    INNER JOIN venta_detalles vd ON vd.venta_id = v.id
    WHERE v.negocio_id = :nid AND v.estado = 'completada'
");
$stmtKpi->execute(['nid' => $negocioId]);
$kpis = $stmtKpi->fetch();

$stmtChart = $db->prepare("
    SELECT
        DATE(v.created_at) AS fecha,
        COALESCE(SUM(vd.subtotal), 0) AS ventas,
        COALESCE(SUM((vd.precio_unitario - vd.precio_compra_unitario) * vd.cantidad), 0) AS ganancia
    FROM ventas v
    INNER JOIN venta_detalles vd ON vd.venta_id = v.id
    WHERE v.negocio_id = :nid
      AND v.estado = 'completada'
      AND v.created_at >= DATE_SUB(CURRENT_DATE(), INTERVAL 6 DAY)
    GROUP BY DATE(v.created_at)
    ORDER BY fecha ASC
");
$stmtChart->execute(['nid' => $negocioId]);
$chartRows = $stmtChart->fetchAll();

$stmtTop = $db->prepare("
    SELECT
        vd.nombre_producto,
        SUM(vd.cantidad) AS unidades_vendidas,
        SUM(vd.subtotal) AS ingresos_totales,
        SUM((vd.precio_unitario - vd.precio_compra_unitario) * vd.cantidad) AS ganancia_generada
    FROM venta_detalles vd
    INNER JOIN ventas v ON v.id = vd.venta_id
    WHERE vd.negocio_id = :nid
      AND v.estado = 'completada'
      AND v.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    GROUP BY vd.producto_id, vd.nombre_producto
    ORDER BY unidades_vendidas DESC
    LIMIT 5
");
$stmtTop->execute(['nid' => $negocioId]);
$topProductos = $stmtTop->fetchAll();

$stmtAlertas = $db->prepare("
    SELECT
        (SELECT COUNT(*) FROM productos WHERE negocio_id = :nid1 AND activo = 1 AND stock <= 5) AS productos_stock_bajo,
        (SELECT COALESCE(SUM(saldo_pendiente), 0) FROM clientes WHERE negocio_id = :nid2) AS total_fiados
");
$stmtAlertas->execute(['nid1' => $negocioId, 'nid2' => $negocioId]);
$alertas = $stmtAlertas->fetch();

Response::json([
    'kpis' => [
        'ventas_hoy'           => round((float)$kpis['ventas_hoy'], 2),
        'ganancia_hoy'         => round((float)$kpis['ganancia_hoy'], 2),
        'ventas_mes'           => round((float)$kpis['ventas_mes'], 2),
        'ganancia_mes'         => round((float)$kpis['ganancia_mes'], 2),
        'productos_stock_bajo' => (int)$alertas['productos_stock_bajo'],
        'total_fiados'         => round((float)$alertas['total_fiados'], 2),
    ],
    'serie_7_dias'  => $chartRows,
    'top_productos' => $topProductos
]);
