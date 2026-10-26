<?php
declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/AccountingService.php';

class FinancialReportsService {
    /**
     * Genera el Balance de Comprobación (Sumas y Saldos)
     * para verificar la igualdad contable (Partida Doble)
     */
    public static function getBalanceComprobacion(int $negocioId, ?string $desde = null, ?string $hasta = null): array {
        $db = Database::getConnection();
        AccountingService::seedBasicPlan($negocioId);

        $desde = $desde ?: date('Y-01-01');
        $hasta = $hasta ?: date('Y-m-d');

        // 1. Obtener todas las cuentas del negocio
        $stmtCuentas = $db->prepare("
            SELECT id, codigo, nombre, tipo, naturaleza, nivel, padre_id, acepta_movimiento, es_sistema
            FROM plan_cuentas
            WHERE negocio_id = :nid AND activo = 1
            ORDER BY codigo ASC
        ");
        $stmtCuentas->execute(['nid' => $negocioId]);
        $cuentas = $stmtCuentas->fetchAll();

        // 2. Obtener movimientos acumulados previos (Saldo Inicial)
        $stmtInicial = $db->prepare("
            SELECT da.cuenta_id, SUM(da.debe) AS debe_inicial, SUM(da.haber) AS haber_inicial
            FROM detalles_asiento da
            JOIN asientos_contables ac ON ac.id = da.asiento_id
            WHERE ac.negocio_id = :nid AND ac.estado = 'mayorizado' AND ac.fecha < :desde
            GROUP BY da.cuenta_id
        ");
        $stmtInicial->execute(['nid' => $negocioId, 'desde' => $desde]);
        $movInicial = [];
        while ($row = $stmtInicial->fetch()) {
            $movInicial[(int)$row['cuenta_id']] = [
                'debe'  => (float)$row['debe_inicial'],
                'haber' => (float)$row['haber_inicial'],
            ];
        }

        // 3. Obtener movimientos del periodo seleccionado
        $stmtPeriodo = $db->prepare("
            SELECT da.cuenta_id, SUM(da.debe) AS debe_periodo, SUM(da.haber) AS haber_periodo
            FROM detalles_asiento da
            JOIN asientos_contables ac ON ac.id = da.asiento_id
            WHERE ac.negocio_id = :nid AND ac.estado = 'mayorizado' AND ac.fecha BETWEEN :desde AND :hasta
            GROUP BY da.cuenta_id
        ");
        $stmtPeriodo->execute(['nid' => $negocioId, 'desde' => $desde, 'hasta' => $hasta]);
        $movPeriodo = [];
        while ($row = $stmtPeriodo->fetch()) {
            $movPeriodo[(int)$row['cuenta_id']] = [
                'debe'  => (float)$row['debe_periodo'],
                'haber' => (float)$row['haber_periodo'],
            ];
        }

        $lineas = [];
        $totalDebePeriodo = 0.0;
        $totalHaberPeriodo = 0.0;
        $totalSaldoDeudor = 0.0;
        $totalSaldoAcreedor = 0.0;

        foreach ($cuentas as $cta) {
            $cid = (int)$cta['id'];
            $nat = $cta['naturaleza']; // DEUDORA o ACREEDORA

            $dIni = $movInicial[$cid]['debe'] ?? 0.0;
            $hIni = $movInicial[$cid]['haber'] ?? 0.0;
            $saldoInicial = ($nat === 'DEUDORA') ? ($dIni - $hIni) : ($hIni - $dIni);

            $dPer = $movPeriodo[$cid]['debe'] ?? 0.0;
            $hPer = $movPeriodo[$cid]['haber'] ?? 0.0;

            // Saldo final
            $saldoFinalNeto = ($nat === 'DEUDORA') 
                ? ($saldoInicial + $dPer - $hPer)
                : ($saldoInicial + $hPer - $dPer);

            $saldoDeudor = 0.0;
            $saldoAcreedor = 0.0;

            if ($nat === 'DEUDORA') {
                if ($saldoFinalNeto >= 0) {
                    $saldoDeudor = $saldoFinalNeto;
                } else {
                    $saldoAcreedor = abs($saldoFinalNeto);
                }
            } else {
                if ($saldoFinalNeto >= 0) {
                    $saldoAcreedor = $saldoFinalNeto;
                } else {
                    $saldoDeudor = abs($saldoFinalNeto);
                }
            }

            // Solo sumar a los totales generales las cuentas de movimiento directo
            if ((int)$cta['acepta_movimiento'] === 1) {
                $totalDebePeriodo   += $dPer;
                $totalHaberPeriodo  += $hPer;
                $totalSaldoDeudor   += $saldoDeudor;
                $totalSaldoAcreedor += $saldoAcreedor;
            }

            $lineas[] = [
                'id'                => $cid,
                'codigo'            => $cta['codigo'],
                'nombre'            => $cta['nombre'],
                'tipo'              => $cta['tipo'],
                'naturaleza'        => $nat,
                'nivel'             => (int)$cta['nivel'],
                'padre_id'          => $cta['padre_id'] ? (int)$cta['padre_id'] : null,
                'acepta_movimiento' => (bool)$cta['acepta_movimiento'],
                'saldo_inicial'     => round($saldoInicial, 2),
                'debe'              => round($dPer, 2),
                'haber'             => round($hPer, 2),
                'saldo_deudor'      => round($saldoDeudor, 2),
                'saldo_acreedor'    => round($saldoAcreedor, 2),
            ];
        }

        // Roll-up de saldos para cuentas de nivel superior (agrupadoras)
        self::rollupHierarchyBalances($lineas);

        $totalDebePeriodo   = round($totalDebePeriodo, 2);
        $totalHaberPeriodo  = round($totalHaberPeriodo, 2);
        $totalSaldoDeudor   = round($totalSaldoDeudor, 2);
        $totalSaldoAcreedor = round($totalSaldoAcreedor, 2);

        $cuadradoSumas  = abs($totalDebePeriodo - $totalHaberPeriodo) < 0.01;
        $cuadradoSaldos = abs($totalSaldoDeudor - $totalSaldoAcreedor) < 0.01;

        return [
            'periodo' => [
                'desde' => $desde,
                'hasta' => $hasta,
            ],
            'totales' => [
                'total_debe'           => $totalDebePeriodo,
                'total_haber'          => $totalHaberPeriodo,
                'total_saldo_deudor'   => $totalSaldoDeudor,
                'total_saldo_acreedor' => $totalSaldoAcreedor,
                'cuadrado_sumas'       => $cuadradoSumas,
                'cuadrado_saldos'      => $cuadradoSaldos,
                'diferencia_sumas'     => round(abs($totalDebePeriodo - $totalHaberPeriodo), 2),
                'diferencia_saldos'    => round(abs($totalSaldoDeudor - $totalSaldoAcreedor), 2),
            ],
            'cuentas' => $lineas,
        ];
    }

    /**
     * Genera el Estado de Resultados (Pérdidas y Ganancias / P&L)
     */
    public static function getEstadoResultados(int $negocioId, ?string $desde = null, ?string $hasta = null): array {
        $db = Database::getConnection();
        AccountingService::seedBasicPlan($negocioId);

        $desde = $desde ?: date('Y-01-01');
        $hasta = $hasta ?: date('Y-m-d');

        // Consultar movimientos agrupados por cuenta de Ingresos, Costos y Gastos
        $stmt = $db->prepare("
            SELECT 
                pc.id, pc.codigo, pc.nombre, pc.tipo, pc.nivel, pc.padre_id, pc.acepta_movimiento,
                COALESCE(SUM(da.debe), 0.0) AS total_debe,
                COALESCE(SUM(da.haber), 0.0) AS total_haber
            FROM plan_cuentas pc
            LEFT JOIN detalles_asiento da ON da.cuenta_id = pc.id
            LEFT JOIN asientos_contables ac ON ac.id = da.asiento_id 
                AND ac.negocio_id = :nid 
                AND ac.estado = 'mayorizado' 
                AND ac.fecha BETWEEN :desde AND :hasta
            WHERE pc.negocio_id = :nid 
              AND pc.activo = 1 
              AND pc.tipo IN ('INGRESOS', 'COSTOS', 'GASTOS')
            GROUP BY pc.id
            ORDER BY pc.codigo ASC
        ");
        $stmt->execute(['nid' => $negocioId, 'desde' => $desde, 'hasta' => $hasta]);
        $rows = $stmt->fetchAll();

        $ingresosList = [];
        $costosList   = [];
        $gastosList   = [];

        $totalIngresos = 0.0;
        $totalCostos   = 0.0;
        $totalGastos   = 0.0;

        foreach ($rows as $r) {
            $tipo = $r['tipo'];
            $debe = (float)$r['total_debe'];
            $haber = (float)$r['total_haber'];
            $acepta = (int)$r['acepta_movimiento'] === 1;

            $saldo = 0.0;
            if ($tipo === 'INGRESOS') {
                $saldo = $haber - $debe;
                if ($acepta) $totalIngresos += $saldo;
            } else {
                // Costos y Gastos son deudores
                $saldo = $debe - $haber;
                if ($acepta && $tipo === 'COSTOS') $totalCostos += $saldo;
                if ($acepta && $tipo === 'GASTOS') $totalGastos += $saldo;
            }

            $item = [
                'id'                => (int)$r['id'],
                'codigo'            => $r['codigo'],
                'nombre'            => $r['nombre'],
                'nivel'             => (int)$r['nivel'],
                'padre_id'          => $r['padre_id'] ? (int)$r['padre_id'] : null,
                'acepta_movimiento' => $acepta,
                'saldo'             => round($saldo, 2),
            ];

            if ($tipo === 'INGRESOS') $ingresosList[] = $item;
            elseif ($tipo === 'COSTOS') $costosList[] = $item;
            elseif ($tipo === 'GASTOS') $gastosList[] = $item;
        }

        // Roll-up de agrupadores para cada sección
        self::rollupHierarchyBalances($ingresosList);
        self::rollupHierarchyBalances($costosList);
        self::rollupHierarchyBalances($gastosList);

        $totalIngresos = round($totalIngresos, 2);
        $totalCostos   = round($totalCostos, 2);
        $totalGastos   = round($totalGastos, 2);

        // Utilidad Bruta
        $utilidadBruta = round($totalIngresos - $totalCostos, 2);

        // Utilidad Operacional
        $utilidadOperacional = round($utilidadBruta - $totalGastos, 2);

        // Deducciones laborales y tributarias de Ecuador
        $partTrabajadores15 = ($utilidadOperacional > 0) ? round($utilidadOperacional * 0.15, 2) : 0.0;
        $utilidadAntesIR    = round($utilidadOperacional - $partTrabajadores15, 2);
        $impuestoRenta25    = ($utilidadAntesIR > 0) ? round($utilidadAntesIR * 0.25, 2) : 0.0;
        $utilidadNeta       = round($utilidadAntesIR - $impuestoRenta25, 2);

        return [
            'periodo' => [
                'desde' => $desde,
                'hasta' => $hasta,
            ],
            'ingresos' => [
                'items' => $ingresosList,
                'total' => $totalIngresos,
            ],
            'costos' => [
                'items' => $costosList,
                'total' => $totalCostos,
            ],
            'utilidad_bruta' => $utilidadBruta,
            'gastos' => [
                'items' => $gastosList,
                'total' => $totalGastos,
            ],
            'utilidad_operacional'    => $utilidadOperacional,
            'participacion_15_trab'   => $partTrabajadores15,
            'utilidad_antes_impuestos'=> $utilidadAntesIR,
            'impuesto_renta_25'       => $impuestoRenta25,
            'utilidad_neta_ejercicio' => $utilidadNeta,
        ];
    }

    /**
     * Genera el Balance General (Estado de Situación Financiera)
     * Respetando la Ecuación Contable: ACTIVO = PASIVO + PATRIMONIO
     */
    public static function getBalanceGeneral(int $negocioId, ?string $fechaCorte = null): array {
        $db = Database::getConnection();
        AccountingService::seedBasicPlan($negocioId);

        $fechaCorte = $fechaCorte ?: date('Y-m-d');

        // 1. Obtener cuentas de Activo, Pasivo y Patrimonio
        $stmt = $db->prepare("
            SELECT 
                pc.id, pc.codigo, pc.nombre, pc.tipo, pc.naturaleza, pc.nivel, pc.padre_id, pc.acepta_movimiento,
                COALESCE(SUM(da.debe), 0.0) AS total_debe,
                COALESCE(SUM(da.haber), 0.0) AS total_haber
            FROM plan_cuentas pc
            LEFT JOIN detalles_asiento da ON da.cuenta_id = pc.id
            LEFT JOIN asientos_contables ac ON ac.id = da.asiento_id 
                AND ac.negocio_id = :nid 
                AND ac.estado = 'mayorizado' 
                AND ac.fecha <= :corte
            WHERE pc.negocio_id = :nid 
              AND pc.activo = 1 
              AND pc.tipo IN ('ACTIVO', 'PASIVO', 'PATRIMONIO')
            GROUP BY pc.id
            ORDER BY pc.codigo ASC
        ");
        $stmt->execute(['nid' => $negocioId, 'corte' => $fechaCorte]);
        $rows = $stmt->fetchAll();

        $activosList    = [];
        $pasivosList    = [];
        $patrimonioList = [];

        $totalActivo     = 0.0;
        $totalPasivo     = 0.0;
        $totalPatrimonio = 0.0;

        foreach ($rows as $r) {
            $tipo   = $r['tipo'];
            $nat    = $r['naturaleza'];
            $debe   = (float)$r['total_debe'];
            $haber  = (float)$r['total_haber'];
            $acepta = (int)$r['acepta_movimiento'] === 1;

            $saldo = ($nat === 'DEUDORA') ? ($debe - $haber) : ($haber - $debe);

            if ($acepta) {
                if ($tipo === 'ACTIVO') $totalActivo += $saldo;
                elseif ($tipo === 'PASIVO') $totalPasivo += $saldo;
                elseif ($tipo === 'PATRIMONIO') $totalPatrimonio += $saldo;
            }

            $item = [
                'id'                => (int)$r['id'],
                'codigo'            => $r['codigo'],
                'nombre'            => $r['nombre'],
                'tipo'              => $tipo,
                'naturaleza'        => $nat,
                'nivel'             => (int)$r['nivel'],
                'padre_id'          => $r['padre_id'] ? (int)$r['padre_id'] : null,
                'acepta_movimiento' => $acepta,
                'saldo'             => round($saldo, 2),
            ];

            if ($tipo === 'ACTIVO') $activosList[] = $item;
            elseif ($tipo === 'PASIVO') $pasivosList[] = $item;
            elseif ($tipo === 'PATRIMONIO') $patrimonioList[] = $item;
        }

        // 2. Calcular en tiempo real la Utilidad del Ejercicio hasta la fecha de corte
        $pnl = self::getEstadoResultados($negocioId, date('Y-01-01', strtotime($fechaCorte)), $fechaCorte);
        $utilidadPeriodo = (float)$pnl['utilidad_neta_ejercicio'];

        // Añadir la cuenta virtual de Utilidad del Ejercicio al Patrimonio si no está cerrada en un asiento formal
        $patrimonioList[] = [
            'id'                => 0,
            'codigo'            => '3.3.01.01',
            'nombre'            => 'Utilidad / (Pérdida) Neta del Ejercicio Actual',
            'tipo'              => 'PATRIMONIO',
            'naturaleza'        => 'ACREEDORA',
            'nivel'             => 4,
            'padre_id'          => null,
            'acepta_movimiento' => true,
            'saldo'             => round($utilidadPeriodo, 2),
        ];
        $totalPatrimonio += $utilidadPeriodo;

        self::rollupHierarchyBalances($activosList);
        self::rollupHierarchyBalances($pasivosList);
        self::rollupHierarchyBalances($patrimonioList);

        $totalActivo     = round($totalActivo, 2);
        $totalPasivo     = round($totalPasivo, 2);
        $totalPatrimonio = round($totalPatrimonio, 2);
        $totalPasivoPat  = round($totalPasivo + $totalPatrimonio, 2);

        $diferencia = round(abs($totalActivo - $totalPasivoPat), 2);
        $cuadrado = ($diferencia < 0.01);

        return [
            'fecha_corte' => $fechaCorte,
            'activos' => [
                'items' => $activosList,
                'total' => $totalActivo,
            ],
            'pasivos' => [
                'items' => $pasivosList,
                'total' => $totalPasivo,
            ],
            'patrimonio' => [
                'items' => $patrimonioList,
                'total' => $totalPatrimonio,
            ],
            'resumen' => [
                'total_activo'               => $totalActivo,
                'total_pasivo'               => $totalPasivo,
                'total_patrimonio'           => $totalPatrimonio,
                'total_pasivo_mas_patrimonio'=> $totalPasivoPat,
                'diferencia'                 => $diferencia,
                'cuadrado'                   => $cuadrado,
            ]
        ];
    }

    /**
     * Calcula métricas financieras en tiempo real (Liquidez, Capital de Trabajo, CxC, CxP)
     */
    public static function getFinancialMetrics(int $negocioId, ?string $desde = null, ?string $hasta = null): array {
        $desde = $desde ?: date('Y-m-01');
        $hasta = $hasta ?: date('Y-m-d');

        $bg  = self::getBalanceGeneral($negocioId, $hasta);
        $pnl = self::getEstadoResultados($negocioId, $desde, $hasta);

        $activos    = $bg['activos']['items'];
        $pasivos    = $bg['pasivos']['items'];
        $patrimonio = $bg['patrimonio']['items'];

        $activoCorriente = 0.0;
        $inventarios     = 0.0;
        $cxcClientes     = 0.0;
        $pasivoCorriente = 0.0;
        $cxpProveedores  = 0.0;

        foreach ($activos as $a) {
            if ($a['acepta_movimiento']) {
                if (str_starts_with($a['codigo'], '1.1')) {
                    $activoCorriente += $a['saldo'];
                }
                if (str_starts_with($a['codigo'], '1.1.03')) {
                    $inventarios += $a['saldo'];
                }
                if (str_starts_with($a['codigo'], '1.1.02')) {
                    $cxcClientes += $a['saldo'];
                }
            }
        }

        foreach ($pasivos as $p) {
            if ($p['acepta_movimiento']) {
                if (str_starts_with($p['codigo'], '2.1')) {
                    $pasivoCorriente += $p['saldo'];
                }
                if (str_starts_with($p['codigo'], '2.1.01')) {
                    $cxpProveedores += $p['saldo'];
                }
            }
        }

        $liquidezCorriente = ($pasivoCorriente > 0) ? round($activoCorriente / $pasivoCorriente, 2) : ($activoCorriente > 0 ? 99.99 : 1.0);
        $pruebaAcida       = ($pasivoCorriente > 0) ? round(($activoCorriente - $inventarios) / $pasivoCorriente, 2) : 1.0;
        $capitalTrabajo    = round($activoCorriente - $pasivoCorriente, 2);

        $ventasTotales = (float)$pnl['ingresos']['total'];
        $utilidadBruta = (float)$pnl['utilidad_bruta'];
        $utilidadNeta  = (float)$pnl['utilidad_neta_ejercicio'];

        $margenBruto = ($ventasTotales > 0) ? round(($utilidadBruta / $ventasTotales) * 100, 1) : 0.0;
        $margenNeto  = ($ventasTotales > 0) ? round(($utilidadNeta / $ventasTotales) * 100, 1) : 0.0;

        // Flujo neto de efectivo en el periodo
        $db = Database::getConnection();
        $stmtCajaBancos = $db->prepare("
            SELECT 
                COALESCE(SUM(da.debe), 0.0) AS entradas,
                COALESCE(SUM(da.haber), 0.0) AS salidas
            FROM detalles_asiento da
            JOIN asientos_contables ac ON ac.id = da.asiento_id
            JOIN plan_cuentas pc ON pc.id = da.cuenta_id
            WHERE ac.negocio_id = :nid 
              AND ac.estado = 'mayorizado' 
              AND ac.fecha BETWEEN :desde AND :hasta
              AND pc.codigo LIKE '1.1.01%'
        ");
        $stmtCajaBancos->execute(['nid' => $negocioId, 'desde' => $desde, 'hasta' => $hasta]);
        $flujo = $stmtCajaBancos->fetch();
        $entradasEfectivo = (float)$flujo['entradas'];
        $salidasEfectivo  = (float)$flujo['salidas'];
        $flujoNeto = round($entradasEfectivo - $salidasEfectivo, 2);

        return [
            'periodo' => [
                'desde' => $desde,
                'hasta' => $hasta,
            ],
            'liquidez_corriente'    => $liquidezCorriente,
            'prueba_acida'          => $pruebaAcida,
            'capital_de_trabajo'    => $capitalTrabajo,
            'activo_corriente'      => round($activoCorriente, 2),
            'pasivo_corriente'      => round($pasivoCorriente, 2),
            'cuentas_por_cobrar'    => round($cxcClientes, 2),
            'cuentas_por_pagar'     => round($cxpProveedores, 2),
            'inventario_valorizado' => round($inventarios, 2),
            'ventas_totales'        => $ventasTotales,
            'utilidad_neta'         => $utilidadNeta,
            'margen_bruto_pct'      => $margenBruto,
            'margen_neto_pct'       => $margenNeto,
            'flujo_efectivo' => [
                'entradas' => round($entradasEfectivo, 2),
                'salidas'  => round($salidasEfectivo, 2),
                'neto'     => $flujoNeto,
            ],
        ];
    }

    /**
     * Genera el XML compatible con el Anexo Transaccional Simplificado (ATS) del SRI Ecuador
     */
    public static function generarAtsXml(int $negocioId, int $anio, int $mes): string {
        $db = Database::getConnection();

        // 1. Obtener datos del negocio y configuración SRI
        $stmtCfg = $db->prepare("
            SELECT n.nombre, n.ruc_nit, cs.ruc, cs.razon_social, cs.codigo_establecimiento
            FROM negocios n
            LEFT JOIN configuracion_sri cs ON cs.negocio_id = n.id
            WHERE n.id = :nid
            LIMIT 1
        ");
        $stmtCfg->execute(['nid' => $negocioId]);
        $empresa = $stmtCfg->fetch();

        $ruc = preg_replace('/\D/', '', $empresa['ruc'] ?? $empresa['ruc_nit'] ?? '1790011122001');
        $ruc = str_pad(substr($ruc, 0, 13), 13, '0', STR_PAD_RIGHT);
        $razonSocial = substr($empresa['razon_social'] ?? $empresa['nombre'] ?? 'EMPRESA SA', 0, 300);
        $estab = str_pad($empresa['codigo_establecimiento'] ?? '001', 3, '0', STR_PAD_LEFT);

        $mesStr = sprintf('%02d', $mes);
        $fechaInicio = sprintf('%04d-%02d-01', $anio, $mes);
        $fechaFin    = date('Y-m-t', strtotime($fechaInicio));

        // 2. Obtener Compras del periodo
        $stmtCompras = $db->prepare("
            SELECT 
                c.id, c.numero_factura, c.fecha_emision, 
                (c.subtotal_15 + c.subtotal_0) AS subtotal,
                c.subtotal_15, c.subtotal_0, c.iva, c.total,
                p.ruc AS ruc_cedula, p.razon_social,
                ces.clave_acceso AS aut_sri_compra, ces.numero_comprobante AS ret_num,
                ces.clave_acceso AS ret_clave_acceso
            FROM compras c
            JOIN proveedores p ON p.id = c.proveedor_id
            LEFT JOIN comprobantes_electronicos_sri ces ON ces.origen_id = c.id 
                AND ces.tipo_documento = '07' 
                AND ces.negocio_id = c.negocio_id 
                AND ces.estado_sri = 'AUTORIZADO'
            WHERE c.negocio_id = :nid 
              AND c.fecha_emision BETWEEN :desde AND :hasta 
              AND c.estado != 'anulada'
            ORDER BY c.fecha_emision ASC
        ");
        $stmtCompras->execute(['nid' => $negocioId, 'desde' => $fechaInicio, 'hasta' => $fechaFin]);
        $compras = $stmtCompras->fetchAll();

        // 3. Obtener Ventas del periodo agrupadas por cliente
        $stmtVentas = $db->prepare("
            SELECT 
                v.id, v.cliente_id, v.created_at, v.subtotal, v.impuesto, v.total,
                c.documento, c.nombre,
                rc.numero_retencion, rc.retencion_renta, rc.retencion_iva
            FROM ventas v
            LEFT JOIN clientes c ON c.id = v.cliente_id
            LEFT JOIN retenciones_clientes rc ON rc.venta_id = v.id AND rc.negocio_id = v.negocio_id
            WHERE v.negocio_id = :nid 
              AND DATE(v.created_at) BETWEEN :desde AND :hasta 
              AND v.estado != 'ANULADA'
            ORDER BY v.created_at ASC
        ");
        $stmtVentas->execute(['nid' => $negocioId, 'desde' => $fechaInicio, 'hasta' => $fechaFin]);
        $ventas = $stmtVentas->fetchAll();

        // Calcular total global de ventas del periodo
        $totalVentasPeriodo = 0.0;
        foreach ($ventas as $v) {
            $totalVentasPeriodo += (float)$v['subtotal'];
        }
        $totalVentasPeriodo = round($totalVentasPeriodo, 2);

        // 4. Construcción del XML ATS Oficial del SRI
        $dom = new DOMDocument('1.0', 'UTF-8');
        $dom->formatOutput = true;

        $ivaNode = $dom->createElement('iva');
        $dom->appendChild($ivaNode);

        $ivaNode->appendChild($dom->createElement('TipoIDInformante', 'R'));
        $ivaNode->appendChild($dom->createElement('IdInformante', $ruc));
        $ivaNode->appendChild($dom->createElement('razonSocial', htmlspecialchars($razonSocial)));
        $ivaNode->appendChild($dom->createElement('Anio', (string)$anio));
        $ivaNode->appendChild($dom->createElement('Mes', $mesStr));
        $ivaNode->appendChild($dom->createElement('numEstabRuc', $estab));
        $ivaNode->appendChild($dom->createElement('totalVentas', number_format($totalVentasPeriodo, 2, '.', '')));
        $ivaNode->appendChild($dom->createElement('codigoOperativo', 'IVA'));

        // Seccion <compras>
        $comprasNode = $dom->createElement('compras');
        foreach ($compras as $c) {
            $detComp = $dom->createElement('detalleCompras');
            $detComp->appendChild($dom->createElement('codSustento', '01')); // 01 = Crédito tributario

            $docProv = preg_replace('/\D/', '', $c['ruc_cedula'] ?? '1790011122001');
            $tpIdProv = (strlen($docProv) === 13) ? '01' : ((strlen($docProv) === 10) ? '02' : '03');
            $detComp->appendChild($dom->createElement('tpIdProv', $tpIdProv));
            $detComp->appendChild($dom->createElement('idProv', $docProv));
            $detComp->appendChild($dom->createElement('tipoComprobante', '01')); // 01 = Factura
            $detComp->appendChild($dom->createElement('parteRel', 'NO'));

            $fecReg = date('d/m/Y', strtotime($c['fecha_emision']));
            $detComp->appendChild($dom->createElement('fechaRegistro', $fecReg));

            // Formato número de factura (001-001-000000001)
            $numFac = $c['numero_factura'] ?? '001-001-000000001';
            $partesFac = explode('-', $numFac);
            $estProv = $partesFac[0] ?? '001';
            $ptoProv = $partesFac[1] ?? '001';
            $secProv = str_pad($partesFac[2] ?? '1', 9, '0', STR_PAD_LEFT);

            $detComp->appendChild($dom->createElement('establecimiento', substr($estProv, 0, 3)));
            $detComp->appendChild($dom->createElement('puntoEmision', substr($ptoProv, 0, 3)));
            $detComp->appendChild($dom->createElement('secuencial', $secProv));
            $detComp->appendChild($dom->createElement('fechaEmision', $fecReg));
            $detComp->appendChild($dom->createElement('autorizacion', $c['aut_sri_compra'] ?? str_repeat('9', 49)));

            $subtotal = (float)$c['subtotal'];
            $iva = (float)$c['iva'];

            $detComp->appendChild($dom->createElement('baseNoGraIva', '0.00'));
            $detComp->appendChild($dom->createElement('baseImponible', '0.00'));
            $detComp->appendChild($dom->createElement('baseImpGrav', number_format($subtotal, 2, '.', '')));
            $detComp->appendChild($dom->createElement('baseImpExe', '0.00'));
            $detComp->appendChild($dom->createElement('montoIce', '0.00'));
            $detComp->appendChild($dom->createElement('montoIva', number_format($iva, 2, '.', '')));

            // Retenciones IVA aplicadas al proveedor
            $retBienes = ($iva > 0) ? round($iva * 0.30, 2) : 0.0;
            $detComp->appendChild($dom->createElement('valRetBien10', '0.00'));
            $detComp->appendChild($dom->createElement('valRetServ20', '0.00'));
            $detComp->appendChild($dom->createElement('valorRetBienes', number_format($retBienes, 2, '.', '')));
            $detComp->appendChild($dom->createElement('valRetServ50', '0.00'));
            $detComp->appendChild($dom->createElement('valorRetServicios', '0.00'));
            $detComp->appendChild($dom->createElement('valRetServ100', '0.00'));
            $detComp->appendChild($dom->createElement('valorRetencionNc', '0.00'));
            $detComp->appendChild($dom->createElement('totbasesImpReemb', '0.00'));

            // Pago exterior
            $pagoExt = $dom->createElement('pagoExterior');
            $pagoExt->appendChild($dom->createElement('pagoLocExt', '01')); // 01 = Pago local
            $pagoExt->appendChild($dom->createElement('paisEfecPago', 'NA'));
            $pagoExt->appendChild($dom->createElement('aplicConvDobTrib', 'NA'));
            $pagoExt->appendChild($dom->createElement('pagExtSujRetNorLeg', 'NA'));
            $detComp->appendChild($pagoExt);

            // Formas de pago
            $formasPago = $dom->createElement('formasDePago');
            $formasPago->appendChild($dom->createElement('formaPago', '01')); // 01 = Sin uso sistema financiero
            $detComp->appendChild($formasPago);

            // Retención en la Fuente IR (Código 312: Transferencia bienes muebles 1.75%)
            $detAirPadre = $dom->createElement('detalleAir');
            $detAirHijo  = $dom->createElement('detalleAir');
            $valRetAir   = round($subtotal * 0.0175, 2);
            $detAirHijo->appendChild($dom->createElement('codRetAir', '312'));
            $detAirHijo->appendChild($dom->createElement('baseImpAir', number_format($subtotal, 2, '.', '')));
            $detAirHijo->appendChild($dom->createElement('porcentajeAir', '1.75'));
            $detAirHijo->appendChild($dom->createElement('valRetAir', number_format($valRetAir, 2, '.', '')));
            $detAirPadre->appendChild($detAirHijo);
            $detComp->appendChild($detAirPadre);

            $comprasNode->appendChild($detComp);
        }
        $ivaNode->appendChild($comprasNode);

        // Seccion <ventas>
        $ventasNode = $dom->createElement('ventas');
        foreach ($ventas as $v) {
            $detVta = $dom->createElement('detalleVentas');

            $docCli = preg_replace('/\D/', '', $v['documento'] ?? '');
            $tpIdCli = '07'; // Consumidor final
            $idCli   = '9999999999999';

            if (strlen($docCli) === 13 && $docCli !== '9999999999999') {
                $tpIdCli = '04'; // RUC
                $idCli   = $docCli;
            } elseif (strlen($docCli) === 10) {
                $tpIdCli = '05'; // Cédula
                $idCli   = $docCli;
            }

            $detVta->appendChild($dom->createElement('tpIdCliente', $tpIdCli));
            $detVta->appendChild($dom->createElement('idCliente', $idCli));
            $detVta->appendChild($dom->createElement('parteRelVtas', 'NO'));
            $detVta->appendChild($dom->createElement('tipoComprobante', '18')); // 18 = Factura Electrónica
            $detVta->appendChild($dom->createElement('tipoEmision', 'E')); // E = Electrónica
            $detVta->appendChild($dom->createElement('numeroComprobantes', '1'));

            $subtotalVta = (float)$v['subtotal'];
            $ivaVta      = (float)$v['impuesto'];

            $detVta->appendChild($dom->createElement('baseNoGraIva', '0.00'));
            $detVta->appendChild($dom->createElement('baseImponible', '0.00'));
            $detVta->appendChild($dom->createElement('baseImpGrav', number_format($subtotalVta, 2, '.', '')));
            $detVta->appendChild($dom->createElement('montoIva', number_format($ivaVta, 2, '.', '')));
            $detVta->appendChild($dom->createElement('montoIce', '0.00'));

            $retIvaRecibida   = (float)($v['retencion_iva'] ?? 0.0);
            $retRentaRecibida = (float)($v['retencion_renta'] ?? 0.0);

            $detVta->appendChild($dom->createElement('valorRetIva', number_format($retIvaRecibida, 2, '.', '')));
            $detVta->appendChild($dom->createElement('valorRetRenta', number_format($retRentaRecibida, 2, '.', '')));

            $formasPagoVta = $dom->createElement('formasDePago');
            $formasPagoVta->appendChild($dom->createElement('formaPago', '01'));
            $detVta->appendChild($formasPagoVta);

            $ventasNode->appendChild($detVta);
        }
        $ivaNode->appendChild($ventasNode);

        // Seccion <ventasEstablecimiento>
        $ventasEstNode = $dom->createElement('ventasEstablecimiento');
        $ventaEstNode  = $dom->createElement('ventaEst');
        $ventaEstNode->appendChild($dom->createElement('codEst', $estab));
        $ventaEstNode->appendChild($dom->createElement('ventasEst', number_format($totalVentasPeriodo, 2, '.', '')));
        $ventaEstNode->appendChild($dom->createElement('ivaComp', '0.00'));
        $ventasEstNode->appendChild($ventaEstNode);
        $ivaNode->appendChild($ventasEstNode);

        return $dom->saveXML();
    }

    /**
     * Función recursiva auxiliar para calcular sumas de saldos en cuentas agrupadoras (padre)
     */
    private static function rollupHierarchyBalances(array &$lineas): void {
        // Mapear por ID para acceso O(1)
        $map = [];
        foreach ($lineas as $idx => $l) {
            $map[$l['id']] = $idx;
        }

        // Ordenar de mayor a menor nivel (desde cuentas detalle hacia clases principales)
        $indices = array_keys($lineas);
        usort($indices, function($a, $b) use ($lineas) {
            return $lineas[$b]['nivel'] <=> $lineas[$a]['nivel'];
        });

        foreach ($indices as $i) {
            $item = $lineas[$i];
            $padreId = $item['padre_id'];
            if ($padreId && isset($map[$padreId])) {
                $pIdx = $map[$padreId];
                if (isset($lineas[$pIdx]['debe'])) {
                    $lineas[$pIdx]['debe'] += $item['debe'];
                }
                if (isset($lineas[$pIdx]['haber'])) {
                    $lineas[$pIdx]['haber'] += $item['haber'];
                }
                if (isset($lineas[$pIdx]['saldo'])) {
                    $lineas[$pIdx]['saldo'] += $item['saldo'];
                }
                if (isset($lineas[$pIdx]['saldo_deudor'])) {
                    $lineas[$pIdx]['saldo_deudor'] += $item['saldo_deudor'];
                }
                if (isset($lineas[$pIdx]['saldo_acreedor'])) {
                    $lineas[$pIdx]['saldo_acreedor'] += $item['saldo_acreedor'];
                }
            }
        }
    }
}
