<?php
declare(strict_types=1);

require_once __DIR__ . '/../../../config/cors.php';
require_once __DIR__ . '/../../../config/database.php';
require_once __DIR__ . '/../../../core/AuthMiddleware.php';
require_once __DIR__ . '/../../../core/FinancialReportsService.php';
require_once __DIR__ . '/../../../core/Response.php';

$session   = AuthMiddleware::authenticate();
$negocioId = (int)$session['negocio_id'];

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    Response::json(['error' => 'Método no permitido'], 405);
}

$report = trim((string)($_GET['report'] ?? 'balance_comprobacion'));
$desde  = isset($_GET['desde']) && !empty($_GET['desde']) ? trim((string)$_GET['desde']) : null;
$hasta  = isset($_GET['hasta']) && !empty($_GET['hasta']) ? trim((string)$_GET['hasta']) : null;
$corte  = isset($_GET['fecha_corte']) && !empty($_GET['fecha_corte']) ? trim((string)$_GET['fecha_corte']) : $hasta;
$format = trim((string)($_GET['format'] ?? 'json'));

try {
    switch ($report) {
        case 'balance_comprobacion':
            $data = FinancialReportsService::getBalanceComprobacion($negocioId, $desde, $hasta);
            break;

        case 'estado_resultados':
        case 'pnl':
            $data = FinancialReportsService::getEstadoResultados($negocioId, $desde, $hasta);
            break;

        case 'balance_general':
            $data = FinancialReportsService::getBalanceGeneral($negocioId, $corte);
            break;

        case 'metricas_financieras':
        case 'dashboard':
            $data = FinancialReportsService::getFinancialMetrics($negocioId, $desde, $hasta);
            break;

        default:
            Response::json(['error' => "Reporte '{$report}' no válido. Opciones: balance_comprobacion, estado_resultados, balance_general, metricas_financieras."], 400);
            exit;
    }

    // Exportación CSV si se solicita format=csv
    if ($format === 'csv') {
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="' . $report . '_' . date('Ymd_His') . '.csv"');
        $output = fopen('php://output', 'w');
        fputs($output, "\xEF\xBB\xBF"); // BOM UTF-8

        if ($report === 'balance_comprobacion') {
            fputcsv($output, ['Código', 'Nombre de Cuenta', 'Nivel', 'Tipo', 'Saldo Inicial', 'Debe', 'Haber', 'Saldo Deudor', 'Saldo Acreedor']);
            foreach ($data['cuentas'] as $c) {
                fputcsv($output, [
                    $c['codigo'],
                    $c['nombre'],
                    $c['nivel'],
                    $c['tipo'],
                    number_format($c['saldo_inicial'], 2),
                    number_format($c['debe'], 2),
                    number_format($c['haber'], 2),
                    number_format($c['saldo_deudor'], 2),
                    number_format($c['saldo_acreedor'], 2),
                ]);
            }
            fputcsv($output, []);
            fputcsv($output, ['TOTALES', '', '', '', '', number_format($data['totales']['total_debe'], 2), number_format($data['totales']['total_haber'], 2), number_format($data['totales']['total_saldo_deudor'], 2), number_format($data['totales']['total_saldo_acreedor'], 2)]);
        } elseif ($report === 'estado_resultados') {
            fputcsv($output, ['Código', 'Concepto', 'Monto']);
            fputcsv($output, ['4', 'INGRESOS TOTALES', number_format($data['ingresos']['total'], 2)]);
            foreach ($data['ingresos']['items'] as $i) {
                fputcsv($output, [$i['codigo'], $i['nombre'], number_format($i['saldo'], 2)]);
            }
            fputcsv($output, ['5', 'COSTOS TOTALES', number_format($data['costos']['total'], 2)]);
            foreach ($data['costos']['items'] as $c) {
                fputcsv($output, [$c['codigo'], $c['nombre'], number_format($c['saldo'], 2)]);
            }
            fputcsv($output, ['', 'UTILIDAD BRUTA', number_format($data['utilidad_bruta'], 2)]);
            fputcsv($output, ['6', 'GASTOS TOTALES', number_format($data['gastos']['total'], 2)]);
            foreach ($data['gastos']['items'] as $g) {
                fputcsv($output, [$g['codigo'], $g['nombre'], number_format($g['saldo'], 2)]);
            }
            fputcsv($output, ['', 'UTILIDAD OPERACIONAL', number_format($data['utilidad_operacional'], 2)]);
            fputcsv($output, ['', '15% PARTICIPACIÓN TRABAJADORES', number_format($data['participacion_15_trab'], 2)]);
            fputcsv($output, ['', '25% IMPUESTO A LA RENTA', number_format($data['impuesto_renta_25'], 2)]);
            fputcsv($output, ['', 'UTILIDAD NETA DEL EJERCICIO', number_format($data['utilidad_neta_ejercicio'], 2)]);
        } elseif ($report === 'balance_general') {
            fputcsv($output, ['Código', 'Cuenta', 'Saldo']);
            fputcsv($output, ['1', 'TOTAL ACTIVO', number_format($data['activos']['total'], 2)]);
            foreach ($data['activos']['items'] as $a) {
                fputcsv($output, [$a['codigo'], $a['nombre'], number_format($a['saldo'], 2)]);
            }
            fputcsv($output, ['2', 'TOTAL PASIVO', number_format($data['pasivos']['total'], 2)]);
            foreach ($data['pasivos']['items'] as $p) {
                fputcsv($output, [$p['codigo'], $p['nombre'], number_format($p['saldo'], 2)]);
            }
            fputcsv($output, ['3', 'TOTAL PATRIMONIO', number_format($data['patrimonio']['total'], 2)]);
            foreach ($data['patrimonio']['items'] as $pat) {
                fputcsv($output, [$pat['codigo'], $pat['nombre'], number_format($pat['saldo'], 2)]);
            }
        }
        fclose($output);
        exit;
    }

    Response::json([
        'success' => true,
        'report'  => $report,
        'data'    => $data,
    ]);

} catch (Throwable $e) {
    Response::json([
        'error' => 'Error al generar reporte financiero: ' . $e->getMessage()
    ], 500);
}
