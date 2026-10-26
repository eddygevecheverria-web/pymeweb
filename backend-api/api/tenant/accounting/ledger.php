<?php
declare(strict_types=1);

require_once __DIR__ . '/../../../config/cors.php';
require_once __DIR__ . '/../../../config/database.php';
require_once __DIR__ . '/../../../core/AuthMiddleware.php';
require_once __DIR__ . '/../../../core/Response.php';

$session   = AuthMiddleware::authenticate();
$negocioId = (int)$session['negocio_id'];
$db        = Database::getConnection();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    Response::json(['error' => 'Método no permitido.'], 405);
}

$cuentaId = !empty($_GET['cuenta_id']) ? (int)$_GET['cuenta_id'] : null;
$desde    = trim($_GET['desde'] ?? '');
$hasta    = trim($_GET['hasta'] ?? '');

// 1. Obtener cuentas con movimiento
$queryCuentas = "
    SELECT id, codigo, nombre, tipo, naturaleza 
    FROM plan_cuentas 
    WHERE negocio_id = :nid AND acepta_movimiento = 1
";
$paramsCuentas = ['nid' => $negocioId];

if ($cuentaId) {
    $queryCuentas .= " AND id = :cid";
    $paramsCuentas['cid'] = $cuentaId;
}
$queryCuentas .= " ORDER BY codigo ASC";

$stmtCuentas = $db->prepare($queryCuentas);
$stmtCuentas->execute($paramsCuentas);
$cuentas = $stmtCuentas->fetchAll();

$ledger = [];

$queryMovs = "
    SELECT 
        d.id, d.asiento_id, d.cuenta_id, d.debe, d.haber, d.concepto, d.referencia_documento,
        a.numero_asiento, a.fecha, a.tipo_asiento, a.estado
    FROM detalles_asiento d
    INNER JOIN asientos_contables a ON a.id = d.asiento_id
    WHERE a.negocio_id = :nid AND d.cuenta_id = :cid AND a.estado = 'mayorizado'
";

if ($desde !== '') {
    $queryMovs .= " AND a.fecha >= :desde";
}
if ($hasta !== '') {
    $queryMovs .= " AND a.fecha <= :hasta";
}
$queryMovs .= " ORDER BY a.fecha ASC, a.numero_asiento ASC, d.linea ASC";

$stmtMovs = $db->prepare($queryMovs);

foreach ($cuentas as $c) {
    $p = ['nid' => $negocioId, 'cid' => $c['id']];
    if ($desde !== '') $p['desde'] = $desde;
    if ($hasta !== '') $p['hasta'] = $hasta;

    $stmtMovs->execute($p);
    $movimientos = $stmtMovs->fetchAll();

    $totalDebe = 0.0;
    $totalHaber = 0.0;
    $saldo = 0.0;
    $movsConSaldo = [];

    foreach ($movimientos as $m) {
        $debe = (float)$m['debe'];
        $haber = (float)$m['haber'];
        $totalDebe += $debe;
        $totalHaber += $haber;

        if ($c['naturaleza'] === 'DEUDORA') {
            $saldo += ($debe - $haber);
        } else {
            $saldo += ($haber - $debe);
        }

        $movsConSaldo[] = [
            'asiento_id'     => $m['asiento_id'],
            'numero_asiento' => $m['numero_asiento'],
            'fecha'          => $m['fecha'],
            'tipo_asiento'   => $m['tipo_asiento'],
            'concepto'       => $m['concepto'],
            'referencia'     => $m['referencia_documento'],
            'debe'           => $debe,
            'haber'          => $haber,
            'saldo'          => round($saldo, 2)
        ];
    }

    // Incluir solo cuentas que tengan movimientos o si fue solicitada específicamente
    if (!empty($movimientos) || $cuentaId) {
        $ledger[] = [
            'cuenta_id'   => $c['id'],
            'codigo'      => $c['codigo'],
            'nombre'      => $c['nombre'],
            'tipo'        => $c['tipo'],
            'naturaleza'  => $c['naturaleza'],
            'total_debe'  => round($totalDebe, 2),
            'total_haber' => round($totalHaber, 2),
            'saldo_final' => round($saldo, 2),
            'movimientos' => $movsConSaldo
        ];
    }
}

Response::json([
    'total_cuentas_con_movimiento' => count($ledger),
    'libro_mayor'                  => $ledger
]);
