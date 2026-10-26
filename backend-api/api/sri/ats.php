<?php
declare(strict_types=1);

require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../core/AuthMiddleware.php';
require_once __DIR__ . '/../../core/FinancialReportsService.php';
require_once __DIR__ . '/../../core/Response.php';

$session   = AuthMiddleware::authenticate();
$negocioId = (int)$session['negocio_id'];
$db        = Database::getConnection();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    Response::json(['error' => 'Método no permitido'], 405);
}

$anio   = (int)($_GET['anio'] ?? date('Y'));
$mes    = (int)($_GET['mes'] ?? date('m'));
$action = trim((string)($_GET['action'] ?? 'resumen'));

if ($mes < 1 || $mes > 12) {
    Response::json(['error' => 'Mes inválido. Debe ser un valor entre 1 y 12.'], 400);
}
if ($anio < 2020 || $anio > 2035) {
    Response::json(['error' => 'Año inválido.'], 400);
}

// 1. Acción: Descargar XML del Anexo Transaccional Simplificado
if ($action === 'download_xml' || $action === 'view_xml') {
    try {
        $xmlContent = FinancialReportsService::generarAtsXml($negocioId, $anio, $mes);

        // Obtener RUC para el nombre del archivo
        $stmtRuc = $db->prepare("
            SELECT COALESCE(cs.ruc, n.ruc_nit, '1790011122001') AS ruc
            FROM negocios n
            LEFT JOIN configuracion_sri cs ON cs.negocio_id = n.id
            WHERE n.id = :nid
            LIMIT 1
        ");
        $stmtRuc->execute(['nid' => $negocioId]);
        $ruc = preg_replace('/\D/', '', (string)$stmtRuc->fetchColumn());
        $filename = sprintf('ATS_%s_%04d_%02d.xml', $ruc, $anio, $mes);

        header('Content-Type: application/xml; charset=utf-8');
        if ($action === 'download_xml') {
            header('Content-Disposition: attachment; filename="' . $filename . '"');
        } else {
            header('Content-Disposition: inline; filename="' . $filename . '"');
        }
        echo $xmlContent;
        exit;
    } catch (Throwable $e) {
        Response::json(['error' => 'Error al generar el XML del ATS: ' . $e->getMessage()], 500);
        exit;
    }
}

// 2. Acción: Resumen analítico del ATS (Pre-visualización antes de exportar)
$fechaInicio = sprintf('%04d-%02d-01', $anio, $mes);
$fechaFin    = date('Y-m-t', strtotime($fechaInicio));

// Resumen Compras
$stmtComp = $db->prepare("
    SELECT 
        COUNT(*) AS total_compras,
        COALESCE(SUM(subtotal_15 + subtotal_0), 0.0) AS subtotal_compras,
        COALESCE(SUM(iva), 0.0) AS iva_compras,
        COALESCE(SUM(total), 0.0) AS total_pagado
    FROM compras
    WHERE negocio_id = :nid 
      AND fecha_emision BETWEEN :desde AND :hasta 
      AND estado != 'anulada'
");
$stmtComp->execute(['nid' => $negocioId, 'desde' => $fechaInicio, 'hasta' => $fechaFin]);
$resumenCompras = $stmtComp->fetch();

// Resumen Ventas
$stmtVta = $db->prepare("
    SELECT 
        COUNT(*) AS total_ventas,
        COALESCE(SUM(subtotal), 0.0) AS subtotal_ventas,
        COALESCE(SUM(impuesto), 0.0) AS iva_ventas,
        COALESCE(SUM(total), 0.0) AS total_facturado
    FROM ventas
    WHERE negocio_id = :nid 
      AND DATE(created_at) BETWEEN :desde AND :hasta 
      AND estado != 'ANULADA'
");
$stmtVta->execute(['nid' => $negocioId, 'desde' => $fechaInicio, 'hasta' => $fechaFin]);
$resumenVentas = $stmtVta->fetch();

// Resumen Retenciones de Clientes Recibidas
$stmtRetCli = $db->prepare("
    SELECT 
        COUNT(*) AS total_retenciones,
        COALESCE(SUM(retencion_renta), 0.0) AS total_ret_renta,
        COALESCE(SUM(retencion_iva), 0.0) AS total_ret_iva,
        COALESCE(SUM(total_retenido), 0.0) AS total_retenido
    FROM retenciones_clientes
    WHERE negocio_id = :nid 
      AND fecha_emision BETWEEN :desde AND :hasta
");
$stmtRetCli->execute(['nid' => $negocioId, 'desde' => $fechaInicio, 'hasta' => $fechaFin]);
$resumenRetCli = $stmtRetCli->fetch();

// Resumen Comprobantes Electrónicos SRI emitidos en el mes
$stmtCes = $db->prepare("
    SELECT 
        COUNT(*) AS total_emitidos,
        SUM(CASE WHEN tipo_documento = '01' THEN 1 ELSE 0 END) AS facturas_emitidas,
        SUM(CASE WHEN tipo_documento = '04' THEN 1 ELSE 0 END) AS notas_credito_emitidas,
        SUM(CASE WHEN tipo_documento = '07' THEN 1 ELSE 0 END) AS retenciones_emitidas,
        SUM(CASE WHEN estado_sri = 'AUTORIZADO' THEN 1 ELSE 0 END) AS autorizados_sri
    FROM comprobantes_electronicos_sri
    WHERE negocio_id = :nid 
      AND fecha_emision BETWEEN :desde AND :hasta
");
$stmtCes->execute(['nid' => $negocioId, 'desde' => $fechaInicio, 'hasta' => $fechaFin]);
$resumenCes = $stmtCes->fetch();

Response::json([
    'success' => true,
    'periodo' => [
        'anio'         => $anio,
        'mes'          => $mes,
        'fecha_inicio' => $fechaInicio,
        'fecha_fin'    => $fechaFin,
    ],
    'compras' => [
        'cantidad' => (int)($resumenCompras['total_compras'] ?? 0),
        'subtotal' => round((float)($resumenCompras['subtotal_compras'] ?? 0), 2),
        'iva'      => round((float)($resumenCompras['iva_compras'] ?? 0), 2),
        'total'    => round((float)($resumenCompras['total_pagado'] ?? 0), 2),
    ],
    'ventas' => [
        'cantidad' => (int)($resumenVentas['total_ventas'] ?? 0),
        'subtotal' => round((float)($resumenVentas['subtotal_ventas'] ?? 0), 2),
        'iva'      => round((float)($resumenVentas['iva_ventas'] ?? 0), 2),
        'total'    => round((float)($resumenVentas['total_facturado'] ?? 0), 2),
    ],
    'retenciones_recibidas' => [
        'cantidad'  => (int)($resumenRetCli['total_retenciones'] ?? 0),
        'ret_renta' => round((float)($resumenRetCli['total_ret_renta'] ?? 0), 2),
        'ret_iva'   => round((float)($resumenRetCli['total_ret_iva'] ?? 0), 2),
        'total'     => round((float)($resumenRetCli['total_retenido'] ?? 0), 2),
    ],
    'comprobantes_sri' => [
        'total_emitidos'  => (int)($resumenCes['total_emitidos'] ?? 0),
        'facturas'        => (int)($resumenCes['facturas_emitidas'] ?? 0),
        'notas_credito'   => (int)($resumenCes['notas_credito_emitidas'] ?? 0),
        'retenciones'     => (int)($resumenCes['retenciones_emitidas'] ?? 0),
        'autorizados_sri' => (int)($resumenCes['autorizados_sri'] ?? 0),
    ],
]);
