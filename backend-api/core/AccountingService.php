<?php
declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';

class AccountingService {
    /**
     * Instancia el Plan de Cuentas Básico NIIF para PYMES Ecuador para un negocio específico
     */
    public static function seedBasicPlan(int $negocioId): int {
        $db = Database::getConnection();

        // Verificar si ya tiene cuentas
        $stmtCheck = $db->prepare("SELECT COUNT(*) FROM plan_cuentas WHERE negocio_id = :nid");
        $stmtCheck->execute(['nid' => $negocioId]);
        if ((int)$stmtCheck->fetchColumn() > 0) {
            return 0; // Ya existe el plan
        }

        $cuentas = [
            // 1. ACTIVO
            ['codigo' => '1', 'nombre' => 'ACTIVO', 'tipo' => 'ACTIVO', 'naturaleza' => 'DEUDORA', 'nivel' => 1, 'padre' => null, 'mov' => 0, 'sis' => null],
            ['codigo' => '1.1', 'nombre' => 'ACTIVO CORRIENTE', 'tipo' => 'ACTIVO', 'naturaleza' => 'DEUDORA', 'nivel' => 2, 'padre' => '1', 'mov' => 0, 'sis' => null],
            ['codigo' => '1.1.01', 'nombre' => 'Efectivo y Equivalentes de Efectivo', 'tipo' => 'ACTIVO', 'naturaleza' => 'DEUDORA', 'nivel' => 3, 'padre' => '1.1', 'mov' => 0, 'sis' => null],
            ['codigo' => '1.1.01.01', 'nombre' => 'Caja General', 'tipo' => 'ACTIVO', 'naturaleza' => 'DEUDORA', 'nivel' => 4, 'padre' => '1.1.01', 'mov' => 1, 'sis' => 'CAJA_GENERAL'],
            ['codigo' => '1.1.01.02', 'nombre' => 'Bancos e Instituciones Financieras', 'tipo' => 'ACTIVO', 'naturaleza' => 'DEUDORA', 'nivel' => 4, 'padre' => '1.1.01', 'mov' => 1, 'sis' => 'BANCOS'],
            ['codigo' => '1.1.02', 'nombre' => 'Cuentas y Documentos por Cobrar Comerciales', 'tipo' => 'ACTIVO', 'naturaleza' => 'DEUDORA', 'nivel' => 3, 'padre' => '1.1', 'mov' => 0, 'sis' => null],
            ['codigo' => '1.1.02.01', 'nombre' => 'Clientes Locales (Crédito Directo)', 'tipo' => 'ACTIVO', 'naturaleza' => 'DEUDORA', 'nivel' => 4, 'padre' => '1.1.02', 'mov' => 1, 'sis' => 'CLIENTES_CXC'],
            ['codigo' => '1.1.03', 'nombre' => 'Inventarios de Mercaderías', 'tipo' => 'ACTIVO', 'naturaleza' => 'DEUDORA', 'nivel' => 3, 'padre' => '1.1', 'mov' => 0, 'sis' => null],
            ['codigo' => '1.1.03.01', 'nombre' => 'Inventario de Mercadería para la Venta', 'tipo' => 'ACTIVO', 'naturaleza' => 'DEUDORA', 'nivel' => 4, 'padre' => '1.1.03', 'mov' => 1, 'sis' => 'INVENTARIO'],
            ['codigo' => '1.1.04', 'nombre' => 'Anticipo de Impuestos y Retenciones a Favor', 'tipo' => 'ACTIVO', 'naturaleza' => 'DEUDORA', 'nivel' => 3, 'padre' => '1.1', 'mov' => 0, 'sis' => null],
            ['codigo' => '1.1.04.01', 'nombre' => 'Crédito Tributario IVA Compras 15%', 'tipo' => 'ACTIVO', 'naturaleza' => 'DEUDORA', 'nivel' => 4, 'padre' => '1.1.04', 'mov' => 1, 'sis' => 'IVA_COMPRAS_15'],
            ['codigo' => '1.1.04.02', 'nombre' => 'Retención en la Fuente IR Clientes (1.75%)', 'tipo' => 'ACTIVO', 'naturaleza' => 'DEUDORA', 'nivel' => 4, 'padre' => '1.1.04', 'mov' => 1, 'sis' => 'RET_RENTA_175'],
            ['codigo' => '1.1.04.03', 'nombre' => 'Retención IVA en Ventas Clientes (30%)', 'tipo' => 'ACTIVO', 'naturaleza' => 'DEUDORA', 'nivel' => 4, 'padre' => '1.1.04', 'mov' => 1, 'sis' => 'RET_IVA_VENTAS_30'],
            ['codigo' => '1.1.04.04', 'nombre' => 'Retención IVA en Ventas Clientes (70%)', 'tipo' => 'ACTIVO', 'naturaleza' => 'DEUDORA', 'nivel' => 4, 'padre' => '1.1.04', 'mov' => 1, 'sis' => 'RET_IVA_VENTAS_70'],
            ['codigo' => '1.1.04.05', 'nombre' => 'Retención IVA en Ventas Clientes (100%)', 'tipo' => 'ACTIVO', 'naturaleza' => 'DEUDORA', 'nivel' => 4, 'padre' => '1.1.04', 'mov' => 1, 'sis' => 'RET_IVA_VENTAS_100'],

            // 2. PASIVO
            ['codigo' => '2', 'nombre' => 'PASIVO', 'tipo' => 'PASIVO', 'naturaleza' => 'ACREEDORA', 'nivel' => 1, 'padre' => null, 'mov' => 0, 'sis' => null],
            ['codigo' => '2.1', 'nombre' => 'PASIVO CORRIENTE', 'tipo' => 'PASIVO', 'naturaleza' => 'ACREEDORA', 'nivel' => 2, 'padre' => '2', 'mov' => 0, 'sis' => null],
            ['codigo' => '2.1.01', 'nombre' => 'Cuentas y Documentos por Pagar Comerciales', 'tipo' => 'PASIVO', 'naturaleza' => 'ACREEDORA', 'nivel' => 3, 'padre' => '2.1', 'mov' => 0, 'sis' => null],
            ['codigo' => '2.1.01.01', 'nombre' => 'Proveedores Locales', 'tipo' => 'PASIVO', 'naturaleza' => 'ACREEDORA', 'nivel' => 4, 'padre' => '2.1.01', 'mov' => 1, 'sis' => 'PROVEEDORES_CXP'],
            ['codigo' => '2.1.02', 'nombre' => 'Obligaciones Tributarias Fiscales (SRI)', 'tipo' => 'PASIVO', 'naturaleza' => 'ACREEDORA', 'nivel' => 3, 'padre' => '2.1', 'mov' => 0, 'sis' => null],
            ['codigo' => '2.1.02.01', 'nombre' => 'IVA Ventas por Pagar (15%)', 'tipo' => 'PASIVO', 'naturaleza' => 'ACREEDORA', 'nivel' => 4, 'padre' => '2.1.02', 'mov' => 1, 'sis' => 'IVA_VENTAS_15'],
            ['codigo' => '2.1.02.02', 'nombre' => 'Retenciones en la Fuente IR por Pagar (Compras)', 'tipo' => 'PASIVO', 'naturaleza' => 'ACREEDORA', 'nivel' => 4, 'padre' => '2.1.02', 'mov' => 1, 'sis' => 'RET_RENTA_POR_PAGAR'],
            ['codigo' => '2.1.02.03', 'nombre' => 'Retenciones de IVA por Pagar (Compras)', 'tipo' => 'PASIVO', 'naturaleza' => 'ACREEDORA', 'nivel' => 4, 'padre' => '2.1.02', 'mov' => 1, 'sis' => 'RET_IVA_POR_PAGAR'],

            // 3. PATRIMONIO
            ['codigo' => '3', 'nombre' => 'PATRIMONIO NETO', 'tipo' => 'PATRIMONIO', 'naturaleza' => 'ACREEDORA', 'nivel' => 1, 'padre' => null, 'mov' => 0, 'sis' => null],
            ['codigo' => '3.1', 'nombre' => 'Capital', 'tipo' => 'PATRIMONIO', 'naturaleza' => 'ACREEDORA', 'nivel' => 2, 'padre' => '3', 'mov' => 0, 'sis' => null],
            ['codigo' => '3.1.01', 'nombre' => 'Capital Social / Aportes Propios', 'tipo' => 'PATRIMONIO', 'naturaleza' => 'ACREEDORA', 'nivel' => 3, 'padre' => '3.1', 'mov' => 1, 'sis' => 'CAPITAL_SOCIAL'],
            ['codigo' => '3.2', 'nombre' => 'Resultados Acumulados', 'tipo' => 'PATRIMONIO', 'naturaleza' => 'ACREEDORA', 'nivel' => 2, 'padre' => '3', 'mov' => 0, 'sis' => null],
            ['codigo' => '3.2.01', 'nombre' => 'Utilidad / Pérdida del Ejercicio', 'tipo' => 'PATRIMONIO', 'naturaleza' => 'ACREEDORA', 'nivel' => 3, 'padre' => '3.2', 'mov' => 1, 'sis' => 'RESULTADO_EJERCICIO'],

            // 4. INGRESOS
            ['codigo' => '4', 'nombre' => 'INGRESOS', 'tipo' => 'INGRESOS', 'naturaleza' => 'ACREEDORA', 'nivel' => 1, 'padre' => null, 'mov' => 0, 'sis' => null],
            ['codigo' => '4.1', 'nombre' => 'Ingresos Operacionales', 'tipo' => 'INGRESOS', 'naturaleza' => 'ACREEDORA', 'nivel' => 2, 'padre' => '4', 'mov' => 0, 'sis' => null],
            ['codigo' => '4.1.01', 'nombre' => 'Ventas de Mercadería', 'tipo' => 'INGRESOS', 'naturaleza' => 'ACREEDORA', 'nivel' => 3, 'padre' => '4.1', 'mov' => 0, 'sis' => null],
            ['codigo' => '4.1.01.01', 'nombre' => 'Ventas de Mercadería Tarifa 15% IVA', 'tipo' => 'INGRESOS', 'naturaleza' => 'ACREEDORA', 'nivel' => 4, 'padre' => '4.1.01', 'mov' => 1, 'sis' => 'VENTAS_GRAVADAS_15'],
            ['codigo' => '4.1.01.02', 'nombre' => 'Ventas de Mercadería Tarifa 0% IVA', 'tipo' => 'INGRESOS', 'naturaleza' => 'ACREEDORA', 'nivel' => 4, 'padre' => '4.1.01', 'mov' => 1, 'sis' => 'VENTAS_TARIFA_0'],

            // 5. COSTOS
            ['codigo' => '5', 'nombre' => 'COSTOS', 'tipo' => 'COSTOS', 'naturaleza' => 'DEUDORA', 'nivel' => 1, 'padre' => null, 'mov' => 0, 'sis' => null],
            ['codigo' => '5.1', 'nombre' => 'Costo de Ventas y Producción', 'tipo' => 'COSTOS', 'naturaleza' => 'DEUDORA', 'nivel' => 2, 'padre' => '5', 'mov' => 0, 'sis' => null],
            ['codigo' => '5.1.01', 'nombre' => 'Costo de Mercaderías Vendidas', 'tipo' => 'COSTOS', 'naturaleza' => 'DEUDORA', 'nivel' => 3, 'padre' => '5.1', 'mov' => 1, 'sis' => 'COSTO_VENTAS'],

            // 6. GASTOS
            ['codigo' => '6', 'nombre' => 'GASTOS', 'tipo' => 'GASTOS', 'naturaleza' => 'DEUDORA', 'nivel' => 1, 'padre' => null, 'mov' => 0, 'sis' => null],
            ['codigo' => '6.1', 'nombre' => 'Gastos Operacionales de Administración', 'tipo' => 'GASTOS', 'naturaleza' => 'DEUDORA', 'nivel' => 2, 'padre' => '6', 'mov' => 0, 'sis' => null],
            ['codigo' => '6.1.01', 'nombre' => 'Sueldos y Salarios', 'tipo' => 'GASTOS', 'naturaleza' => 'DEUDORA', 'nivel' => 3, 'padre' => '6.1', 'mov' => 1, 'sis' => null],
            ['codigo' => '6.1.02', 'nombre' => 'Servicios Básicos (Agua, Luz, Internet)', 'tipo' => 'GASTOS', 'naturaleza' => 'DEUDORA', 'nivel' => 3, 'padre' => '6.1', 'mov' => 1, 'sis' => null],
            ['codigo' => '6.1.03', 'nombre' => 'Arriendos y Alquileres de Local', 'tipo' => 'GASTOS', 'naturaleza' => 'DEUDORA', 'nivel' => 3, 'padre' => '6.1', 'mov' => 1, 'sis' => null],
            ['codigo' => '6.2', 'nombre' => 'Gastos Financieros', 'tipo' => 'GASTOS', 'naturaleza' => 'DEUDORA', 'nivel' => 2, 'padre' => '6', 'mov' => 0, 'sis' => null],
            ['codigo' => '6.2.01', 'nombre' => 'Comisiones Bancarias y de Pasarelas de Pago', 'tipo' => 'GASTOS', 'naturaleza' => 'DEUDORA', 'nivel' => 3, 'padre' => '6.2', 'mov' => 1, 'sis' => null],
        ];

        $db->beginTransaction();
        try {
            $insertedMap = []; // codigo => id
            $stmtIns = $db->prepare("
                INSERT INTO plan_cuentas 
                    (negocio_id, codigo, nombre, tipo, naturaleza, nivel, padre_id, acepta_movimiento, es_sistema, activo)
                VALUES 
                    (:nid, :cod, :nom, :tipo, :nat, :niv, :padre_id, :mov, :sis, 1)
            ");

            foreach ($cuentas as $c) {
                $padreId = null;
                if ($c['padre'] !== null && isset($insertedMap[$c['padre']])) {
                    $padreId = $insertedMap[$c['padre']];
                }

                $stmtIns->execute([
                    'nid'      => $negocioId,
                    'cod'      => $c['codigo'],
                    'nom'      => $c['nombre'],
                    'tipo'     => $c['tipo'],
                    'nat'      => $c['naturaleza'],
                    'niv'      => $c['nivel'],
                    'padre_id' => $padreId,
                    'mov'      => $c['mov'],
                    'sis'      => $c['sis']
                ]);
                $insertedMap[$c['codigo']] = (int)$db->lastInsertId();
            }

            $db->commit();
            return count($cuentas);
        } catch (Throwable $e) {
            $db->rollBack();
            throw new RuntimeException("Error al instanciar plan de cuentas: " . $e->getMessage());
        }
    }

    /**
     * Obtiene o abre automáticamente el período contable mensual para una fecha dada
     */
    public static function getOrCreatePeriod(int $negocioId, string $fecha): array {
        $db = Database::getConnection();
        $dt = new DateTimeImmutable($fecha);
        $anio = (int)$dt->format('Y');
        $mes  = (int)$dt->format('m');

        $stmt = $db->prepare("
            SELECT id, anio, mes, fecha_inicio, fecha_fin, estado 
            FROM periodos_contables 
            WHERE negocio_id = :nid AND anio = :anio AND mes = :mes 
            LIMIT 1
        ");
        $stmt->execute(['nid' => $negocioId, 'anio' => $anio, 'mes' => $mes]);
        $periodo = $stmt->fetch();

        if ($periodo) {
            if ($periodo['estado'] === 'cerrado') {
                throw new DomainException("El período contable {$mes}/{$anio} se encuentra CERRADO. No se pueden registrar movimientos.");
            }
            return $periodo;
        }

        // Crear período abierto
        $fechaInicio = $dt->modify('first day of this month')->format('Y-m-d');
        $fechaFin    = $dt->modify('last day of this month')->format('Y-m-d');

        $ins = $db->prepare("
            INSERT INTO periodos_contables 
                (negocio_id, anio, mes, fecha_inicio, fecha_fin, estado) 
            VALUES 
                (:nid, :anio, :mes, :ini, :fin, 'abierto')
        ");
        $ins->execute([
            'nid'  => $negocioId,
            'anio' => $anio,
            'mes'  => $mes,
            'ini'  => $fechaInicio,
            'fin'  => $fechaFin
        ]);

        return [
            'id'           => (int)$db->lastInsertId(),
            'anio'         => $anio,
            'mes'          => $mes,
            'fecha_inicio' => $fechaInicio,
            'fecha_fin'    => $fechaFin,
            'estado'       => 'abierto'
        ];
    }

    /**
     * Crea un Asiento Contable aplicando validación estricta de Partida Doble
     */
    public static function createAsiento(int $negocioId, int $usuarioId, array $data): array {
        $db = Database::getConnection();

        $fecha       = trim((string)($data['fecha'] ?? date('Y-m-d')));
        $concepto    = trim((string)($data['concepto'] ?? ''));
        $tipoAsiento = strtoupper(trim((string)($data['tipo_asiento'] ?? 'DIARIO')));
        $origen      = trim((string)($data['origen'] ?? 'manual'));
        $origenId    = !empty($data['origen_id']) ? (int)$data['origen_id'] : null;
        $detalles    = (array)($data['detalles'] ?? []);

        if ($concepto === '') {
            throw new InvalidArgumentException("La glosa/concepto del asiento contable es obligatoria.");
        }
        if (count($detalles) < 2) {
            throw new InvalidArgumentException("Un asiento contable requiere al menos dos partidas (una en el Debe y una en el Haber).");
        }

        // 1. Validar período contable abierto
        $periodo = self::getOrCreatePeriod($negocioId, $fecha);
        $periodoId = (int)$periodo['id'];

        // 2. Validar cuentas y calcular totales Debe y Haber
        $totalDebe = 0.0;
        $totalHaber = 0.0;
        $detallesVerificados = [];

        $stmtCuenta = $db->prepare("
            SELECT id, codigo, nombre, acepta_movimiento, activo 
            FROM plan_cuentas 
            WHERE id = :cid AND negocio_id = :nid 
            LIMIT 1
        ");

        foreach ($detalles as $idx => $d) {
            $cuentaId = (int)($d['cuenta_id'] ?? 0);
            $debe     = round((float)($d['debe'] ?? 0.0), 2);
            $haber    = round((float)($d['haber'] ?? 0.0), 2);
            $glosa    = trim((string)($d['concepto'] ?? ''));
            $refDoc   = trim((string)($d['referencia_documento'] ?? ''));

            if ($cuentaId <= 0) {
                throw new InvalidArgumentException("Línea #" . ($idx + 1) . ": Cuenta contable inválida.");
            }
            if ($debe < 0 || $haber < 0) {
                throw new InvalidArgumentException("Línea #" . ($idx + 1) . ": Los importes no pueden ser negativos.");
            }
            if ($debe == 0 && $haber == 0) {
                continue; // Saltar líneas vacías
            }
            if ($debe > 0 && $haber > 0) {
                throw new InvalidArgumentException("Línea #" . ($idx + 1) . ": Una misma línea no puede tener valores simultáneos en el Debe y el Haber.");
            }

            $stmtCuenta->execute(['cid' => $cuentaId, 'nid' => $negocioId]);
            $cuenta = $stmtCuenta->fetch();

            if (!$cuenta) {
                throw new DomainException("La cuenta ID {$cuentaId} no existe en este negocio.");
            }
            if ((int)$cuenta['activo'] !== 1) {
                throw new DomainException("La cuenta {$cuenta['codigo']} - {$cuenta['nombre']} está inactiva.");
            }
            if ((int)$cuenta['acepta_movimiento'] !== 1) {
                throw new DomainException("La cuenta {$cuenta['codigo']} - {$cuenta['nombre']} es de agrupación y no acepta movimientos directos.");
            }

            $totalDebe  += $debe;
            $totalHaber += $haber;

            $detallesVerificados[] = [
                'cuenta_id' => $cuentaId,
                'codigo'    => $cuenta['codigo'],
                'nombre'    => $cuenta['nombre'],
                'debe'      => $debe,
                'haber'     => $haber,
                'concepto'  => $glosa ?: $concepto,
                'ref_doc'   => $refDoc ?: null
            ];
        }

        $totalDebe  = round($totalDebe, 2);
        $totalHaber = round($totalHaber, 2);

        // 3. Regla Suprema Contable: Partida Doble
        if (abs($totalDebe - $totalHaber) >= 0.01 || $totalDebe <= 0.0) {
            throw new DomainException("Asiento descuadrado: La suma del Debe (\${$totalDebe}) debe ser igual a la suma del Haber (\${$totalHaber}).");
        }

        // 4. Inserción atómica en Base de Datos
        $db->beginTransaction();
        try {
            // Obtener correlativo anual
            $stmtCorr = $db->prepare("
                SELECT COALESCE(MAX(numero_asiento), 0) + 1 
                FROM asientos_contables 
                WHERE negocio_id = :nid AND YEAR(fecha) = YEAR(:fecha)
            ");
            $stmtCorr->execute(['nid' => $negocioId, 'fecha' => $fecha]);
            $numeroAsiento = (int)$stmtCorr->fetchColumn();

            $stmtAsiento = $db->prepare("
                INSERT INTO asientos_contables 
                    (negocio_id, periodo_id, numero_asiento, fecha, tipo_asiento, concepto, origen, origen_id, total_debe, total_haber, estado, creado_por)
                VALUES 
                    (:nid, :pid, :num, :fecha, :tipo, :concepto, :origen, :orig_id, :debe, :haber, 'mayorizado', :uid)
            ");
            $stmtAsiento->execute([
                'nid'      => $negocioId,
                'pid'      => $periodoId,
                'num'      => $numeroAsiento,
                'fecha'    => $fecha,
                'tipo'     => $tipoAsiento,
                'concepto' => $concepto,
                'origen'   => $origen,
                'orig_id'  => $origenId,
                'debe'     => $totalDebe,
                'haber'    => $totalHaber,
                'uid'      => $usuarioId
            ]);
            $asientoId = (int)$db->lastInsertId();

            $stmtDet = $db->prepare("
                INSERT INTO detalles_asiento 
                    (asiento_id, cuenta_id, linea, concepto, debe, haber, referencia_documento)
                VALUES 
                    (:aid, :cid, :lin, :con, :debe, :haber, :ref)
            ");

            foreach ($detallesVerificados as $linea => $d) {
                $stmtDet->execute([
                    'aid'   => $asientoId,
                    'cid'   => $d['cuenta_id'],
                    'lin'   => $linea + 1,
                    'con'   => $d['concepto'],
                    'debe'  => $d['debe'],
                    'haber' => $d['haber'],
                    'ref'   => $d['ref_doc']
                ]);
            }

            $db->commit();

            return [
                'asiento_id'     => $asientoId,
                'numero_asiento' => $numeroAsiento,
                'fecha'          => $fecha,
                'total'          => $totalDebe,
                'concepto'       => $concepto,
                'detalles'       => $detallesVerificados
            ];
        } catch (Throwable $e) {
            $db->rollBack();
            throw $e;
        }
    }

    /**
     * Anulación inmutable de un Asiento Contable mediante Asiento de Reversión
     */
    public static function reverseAsiento(int $negocioId, int $asientoId, int $usuarioId, string $motivo): array {
        $db = Database::getConnection();

        $stmt = $db->prepare("
            SELECT * FROM asientos_contables 
            WHERE id = :id AND negocio_id = :nid 
            LIMIT 1
        ");
        $stmt->execute(['id' => $asientoId, 'nid' => $negocioId]);
        $asiento = $stmt->fetch();

        if (!$asiento) {
            throw new DomainException("El asiento contable no existe.");
        }
        if ($asiento['estado'] === 'anulado') {
            throw new DomainException("El asiento #{$asiento['numero_asiento']} ya fue anulado previamente.");
        }

        // Obtener líneas originales para invertirlas
        $stmtDet = $db->prepare("SELECT * FROM detalles_asiento WHERE asiento_id = :aid ORDER BY linea ASC");
        $stmtDet->execute(['aid' => $asientoId]);
        $lineas = $stmtDet->fetchAll();

        // Construir detalle invertido (Debe <-> Haber)
        $nuevasLineas = [];
        foreach ($lineas as $l) {
            $nuevasLineas[] = [
                'cuenta_id'            => $l['cuenta_id'],
                'debe'                 => (float)$l['haber'], // Invertir
                'haber'                => (float)$l['debe'],  // Invertir
                'concepto'             => "REVERSIÓN: " . ($l['concepto'] ?: $asiento['concepto']),
                'referencia_documento' => "ANULA ASIENTO #{$asiento['numero_asiento']}"
            ];
        }

        $nuevoConcepto = "ANULACIÓN Y REVERSIÓN DE ASIENTO #{$asiento['numero_asiento']}: " . $motivo;

        // Crear asiento de reversión
        $asientoReverso = self::createAsiento($negocioId, $usuarioId, [
            'fecha'        => date('Y-m-d'),
            'tipo_asiento' => 'AJUSTE',
            'concepto'     => $nuevoConcepto,
            'origen'       => 'manual',
            'origen_id'    => $asientoId,
            'detalles'     => $nuevasLineas
        ]);

        // Marcar el original como ANULADO y vincular al reverso
        $upd = $db->prepare("
            UPDATE asientos_contables 
            SET estado = 'anulado', asiento_reversion_id = :revid 
            WHERE id = :id
        ");
        $upd->execute(['revid' => $asientoReverso['asiento_id'], 'id' => $asientoId]);

        return [
            'asiento_original_id' => $asientoId,
            'asiento_reverso_id'  => $asientoReverso['asiento_id'],
            'numero_reverso'      => $asientoReverso['numero_asiento'],
            'mensaje'             => "Asiento #{$asiento['numero_asiento']} anulado correctamente mediante asiento de reversión #{$asientoReverso['numero_asiento']}."
        ];
    }

    /**
     * Obtiene una cuenta del sistema por su clave (ej. CAJA_GENERAL, IVA_VENTAS_15)
     */
    public static function getAccountBySystemKey(int $negocioId, string $key): ?array {
        $db = Database::getConnection();
        $stmt = $db->prepare("SELECT id, codigo, nombre FROM plan_cuentas WHERE negocio_id = :nid AND es_sistema = :sis AND activo = 1 LIMIT 1");
        $stmt->execute(['nid' => $negocioId, 'sis' => $key]);
        return $stmt->fetch() ?: null;
    }

    /**
     * Genera automáticamente el Asiento Contable de una Venta POS/Web
     * Cumple con la regla de partida doble estricta:
     * DEBE: Caja / Bancos / Clientes CxC
     * HABER: Ingresos por Ventas (Gravadas 15% o 0%) + IVA Ventas (15%)
     * DEBE: Costo de Ventas (si hay costo)
     * HABER: Inventario (si hay costo)
     */
    public static function recordSaleEntry(
        int $negocioId,
        int $usuarioId,
        int $ventaId,
        string $numeroComprobante,
        string $metodoPago,
        float $subtotal,
        float $impuesto,
        float $total,
        array $detalles,
        ?string $comprobanteTransferencia = null
    ): ?int {
        self::seedBasicPlan($negocioId);

        $cuentaCobroKey = 'CAJA_GENERAL';
        if ($metodoPago === 'transferencia') {
            $cuentaCobroKey = 'BANCOS';
        } elseif ($metodoPago === 'fiado') {
            $cuentaCobroKey = 'CLIENTES_CXC';
        }

        $ctaCobro = self::getAccountBySystemKey($negocioId, $cuentaCobroKey) 
                 ?: self::getAccountBySystemKey($negocioId, 'CAJA_GENERAL');

        if (!$ctaCobro) {
            return null;
        }

        $lineas = [];

        $refCobro = $numeroComprobante;
        $conceptoCobro = "Cobro de venta {$numeroComprobante} ({$metodoPago})";
        if ($metodoPago === 'transferencia' && !empty($comprobanteTransferencia)) {
            $refCobro = "Transf/Depósito #{$comprobanteTransferencia}";
            $conceptoCobro = "Cobro venta {$numeroComprobante} vía Transferencia/Depósito #{$comprobanteTransferencia}";
        }

        // 1. DEBE: Cobro de la Venta (Bancos si transferencia, Caja si efectivo, Clientes CxC si fiado)
        $lineas[] = [
            'cuenta_id' => (int)$ctaCobro['id'],
            'debe'      => $total,
            'haber'     => 0.00,
            'concepto'  => $conceptoCobro,
            'ref_doc'   => $refCobro
        ];

        // 2. HABER: Ingresos y discriminación de impuestos
        $subtotal15 = 0.0;
        $subtotal0  = 0.0;
        $costoTotal = 0.0;

        foreach ($detalles as $det) {
            $tarifa  = (float)($det['tarifa_iva'] ?? 15.00);
            $sub     = (float)($det['subtotal'] ?? 0.0);
            $cant    = (int)($det['cantidad'] ?? 1);
            $pcompra = (float)($det['precio_compra_unitario'] ?? 0.0);

            $costoTotal += round($cant * $pcompra, 2);

            $base = ($tarifa > 0) ? round($sub / (1 + ($tarifa / 100)), 2) : $sub;
            if ($tarifa > 0) {
                $subtotal15 += $base;
            } else {
                $subtotal0 += $base;
            }
        }

        $subtotal15 = round($subtotal15, 2);
        $subtotal0  = round($subtotal0, 2);
        $costoTotal = round($costoTotal, 2);

        if ($subtotal15 > 0) {
            $ctaVentas15 = self::getAccountBySystemKey($negocioId, 'VENTAS_GRAVADAS_15');
            if ($ctaVentas15) {
                $lineas[] = [
                    'cuenta_id' => (int)$ctaVentas15['id'],
                    'debe'      => 0.00,
                    'haber'     => $subtotal15,
                    'concepto'  => "Venta {$numeroComprobante} tarifa IVA 15%",
                    'ref_doc'   => $numeroComprobante
                ];
            }
        }

        if ($subtotal0 > 0) {
            $ctaVentas0 = self::getAccountBySystemKey($negocioId, 'VENTAS_TARIFA_0');
            if ($ctaVentas0) {
                $lineas[] = [
                    'cuenta_id' => (int)$ctaVentas0['id'],
                    'debe'      => 0.00,
                    'haber'     => $subtotal0,
                    'concepto'  => "Venta {$numeroComprobante} tarifa 0% IVA",
                    'ref_doc'   => $numeroComprobante
                ];
            }
        }

        if ($impuesto > 0) {
            $ctaIva = self::getAccountBySystemKey($negocioId, 'IVA_VENTAS_15');
            if ($ctaIva) {
                $lineas[] = [
                    'cuenta_id' => (int)$ctaIva['id'],
                    'debe'      => 0.00,
                    'haber'     => $impuesto,
                    'concepto'  => "IVA generado en venta {$numeroComprobante}",
                    'ref_doc'   => $numeroComprobante
                ];
            }
        }

        // Ajustar centavo de redondeo en caso de diferencias mínimas
        $sumaHaber = 0.0;
        foreach ($lineas as $l) {
            $sumaHaber += $l['haber'];
        }
        $diff = round($total - $sumaHaber, 2);
        if (abs($diff) > 0 && abs($diff) <= 0.05) {
            for ($i = count($lineas) - 1; $i >= 0; $i--) {
                if ($lineas[$i]['haber'] > 0) {
                    $lineas[$i]['haber'] = round($lineas[$i]['haber'] + $diff, 2);
                    break;
                }
            }
        }

        // 3. Asiento simultáneo de Costo de Ventas e Inventario (si costo > 0)
        if ($costoTotal > 0) {
            $ctaCosto = self::getAccountBySystemKey($negocioId, 'COSTO_VENTAS');
            $ctaInv   = self::getAccountBySystemKey($negocioId, 'INVENTARIO');

            if ($ctaCosto && $ctaInv) {
                $lineas[] = [
                    'cuenta_id' => (int)$ctaCosto['id'],
                    'debe'      => $costoTotal,
                    'haber'     => 0.00,
                    'concepto'  => "Costo de mercadería vendida en {$numeroComprobante}",
                    'ref_doc'   => $numeroComprobante
                ];
                $lineas[] = [
                    'cuenta_id' => (int)$ctaInv['id'],
                    'debe'      => 0.00,
                    'haber'     => $costoTotal,
                    'concepto'  => "Salida de inventario por venta {$numeroComprobante}",
                    'ref_doc'   => $numeroComprobante
                ];
            }
        }

        $conceptoAsiento = "Venta de mercaderías comprobante #{$numeroComprobante}";
        if ($metodoPago === 'transferencia' && !empty($comprobanteTransferencia)) {
            $conceptoAsiento .= " (Transf/Depósito #{$comprobanteTransferencia})";
        }

        try {
            $asiento = self::createAsiento($negocioId, $usuarioId, [
                'fecha'        => date('Y-m-d'),
                'tipo_asiento' => 'INGRESO',
                'concepto'     => $conceptoAsiento,
                'origen'       => 'venta_pos',
                'origen_id'    => $ventaId,
                'detalles'     => $lineas
            ]);

            return (int)$asiento['asiento_id'];
        } catch (Throwable $e) {
            error_log("Error al generar asiento automático de venta ID {$ventaId}: " . $e->getMessage());
            return null;
        }
    }

    /**
     * Genera automáticamente el Asiento Contable de una Compra a Proveedor
     * DEBE: Inventario (Base imponible neta)
     * DEBE: Crédito Tributario IVA Compras (15%)
     * HABER: Retención en la Fuente IR por Pagar (si aplica)
     * HABER: Retención de IVA por Pagar (si aplica)
     * HABER: Caja / Bancos / Proveedores Locales por Pagar
     */
    public static function recordPurchaseEntry(
        int $negocioId,
        int $usuarioId,
        int $compraId,
        string $numeroFactura,
        string $metodoPago,
        float $subtotal15,
        float $subtotal0,
        float $iva,
        float $retRenta,
        float $retIva,
        float $totalPagar,
        string $proveedorNombre
    ): ?int {
        self::seedBasicPlan($negocioId);

        $ctaInv     = self::getAccountBySystemKey($negocioId, 'INVENTARIO');
        $ctaIvaComp = self::getAccountBySystemKey($negocioId, 'IVA_COMPRAS_15');
        
        $lineas = [];

        // 1. DEBE: Ingreso al Inventario
        $subtotalNeto = round($subtotal15 + $subtotal0, 2);
        if ($subtotalNeto > 0 && $ctaInv) {
            $lineas[] = [
                'cuenta_id' => (int)$ctaInv['id'],
                'debe'      => $subtotalNeto,
                'haber'     => 0.00,
                'concepto'  => "Inventario recibido Factura #{$numeroFactura} ({$proveedorNombre})",
                'ref_doc'   => $numeroFactura
            ];
        }

        // 2. DEBE: Crédito Tributario IVA Compras
        if ($iva > 0 && $ctaIvaComp) {
            $lineas[] = [
                'cuenta_id' => (int)$ctaIvaComp['id'],
                'debe'      => $iva,
                'haber'     => 0.00,
                'concepto'  => "Crédito tributario IVA 15% s/f #{$numeroFactura}",
                'ref_doc'   => $numeroFactura
            ];
        }

        // 3. HABER: Retenciones si aplican
        if ($retRenta > 0) {
            $ctaRetRenta = self::getAccountBySystemKey($negocioId, 'RET_RENTA_POR_PAGAR');
            if ($ctaRetRenta) {
                $lineas[] = [
                    'cuenta_id' => (int)$ctaRetRenta['id'],
                    'debe'      => 0.00,
                    'haber'     => $retRenta,
                    'concepto'  => "Retención en la Fuente IR s/f #{$numeroFactura}",
                    'ref_doc'   => $numeroFactura
                ];
            }
        }

        if ($retIva > 0) {
            $ctaRetIva = self::getAccountBySystemKey($negocioId, 'RET_IVA_POR_PAGAR');
            if ($ctaRetIva) {
                $lineas[] = [
                    'cuenta_id' => (int)$ctaRetIva['id'],
                    'debe'      => 0.00,
                    'haber'     => $retIva,
                    'concepto'  => "Retención de IVA s/f #{$numeroFactura}",
                    'ref_doc'   => $numeroFactura
                ];
            }
        }

        // 4. HABER: Medio de Pago o Pasivo Proveedores
        $cuentaPagoKey = 'PROVEEDORES_CXP';
        if ($metodoPago === 'efectivo') {
            $cuentaPagoKey = 'CAJA_GENERAL';
        } elseif ($metodoPago === 'transferencia') {
            $cuentaPagoKey = 'BANCOS';
        }

        $ctaPago = self::getAccountBySystemKey($negocioId, $cuentaPagoKey) 
                ?: self::getAccountBySystemKey($negocioId, 'PROVEEDORES_CXP');

        if ($ctaPago && $totalPagar > 0) {
            $lineas[] = [
                'cuenta_id' => (int)$ctaPago['id'],
                'debe'      => 0.00,
                'haber'     => $totalPagar,
                'concepto'  => "Obligación de pago compra s/f #{$numeroFactura} ({$metodoPago})",
                'ref_doc'   => $numeroFactura
            ];
        }

        // Ajustar posible centavo de redondeo
        $sumaDebe = 0.0;
        $sumaHaber = 0.0;
        foreach ($lineas as $l) {
            $sumaDebe += $l['debe'];
            $sumaHaber += $l['haber'];
        }
        $diff = round($sumaDebe - $sumaHaber, 2);
        if (abs($diff) > 0 && abs($diff) <= 0.05) {
            for ($i = count($lineas) - 1; $i >= 0; $i--) {
                if ($lineas[$i]['haber'] > 0) {
                    $lineas[$i]['haber'] = round($lineas[$i]['haber'] + $diff, 2);
                    break;
                }
            }
        }

        try {
            $asiento = self::createAsiento($negocioId, $usuarioId, [
                'fecha'        => date('Y-m-d'),
                'tipo_asiento' => 'EGRESO',
                'concepto'     => "Compra de mercaderías Factura #{$numeroFactura} - {$proveedorNombre}",
                'origen'       => 'compra',
                'origen_id'    => $compraId,
                'detalles'     => $lineas
            ]);

            return (int)$asiento['asiento_id'];
        } catch (Throwable $e) {
            error_log("Error al generar asiento automático de compra ID {$compraId}: " . $e->getMessage());
            return null;
        }
    }

    /**
     * Registra el Asiento Contable de una Retención Entrante emitida por un Cliente (Agente de Retención)
     * Cuadra el cobro de la cuenta por cobrar:
     * DEBE: Anticipo IR Retención en la Fuente Clientes (1.1.04.02)
     * DEBE: Anticipo IVA Retención en Ventas Clientes (1.1.04.03)
     * DEBE: Caja / Bancos (si el cliente pagó la diferencia en efectivo/transferencia)
     * HABER: Clientes Cuentas por Cobrar (1.1.02.01) por el total liquidado
     */
    public static function recordIncomingRetentionEntry(
        int $negocioId,
        int $usuarioId,
        int $retencionId,
        int $ventaId,
        string $numeroRetencion,
        string $numeroFacturaVenta,
        string $clienteNombre,
        float $retRenta,
        float $retIva,
        float $pagoEfectivo,
        string $metodoPago = 'efectivo'
    ): ?int {
        self::seedBasicPlan($negocioId);

        $ctaRetRenta = self::getAccountBySystemKey($negocioId, 'RET_RENTA_175');
        $ctaRetIva   = self::getAccountBySystemKey($negocioId, 'RET_IVA_VENTAS_30');
        $ctaCxc      = self::getAccountBySystemKey($negocioId, 'CLIENTES_CXC');

        $lineas = [];
        $totalDebe = 0.0;

        // 1. DEBE: Anticipo de Impuestos Retención IR
        if ($retRenta > 0 && $ctaRetRenta) {
            $lineas[] = [
                'cuenta_id' => (int)$ctaRetRenta['id'],
                'debe'      => $retRenta,
                'haber'     => 0.00,
                'concepto'  => "Retención IR 1.75% recibida s/f #{$numeroFacturaVenta} Comprobante #{$numeroRetencion}",
                'ref_doc'   => $numeroRetencion
            ];
            $totalDebe += $retRenta;
        }

        // 2. DEBE: Anticipo de Impuestos Retención IVA
        if ($retIva > 0 && $ctaRetIva) {
            $lineas[] = [
                'cuenta_id' => (int)$ctaRetIva['id'],
                'debe'      => $retIva,
                'haber'     => 0.00,
                'concepto'  => "Retención IVA recibida s/f #{$numeroFacturaVenta} Comprobante #{$numeroRetencion}",
                'ref_doc'   => $numeroRetencion
            ];
            $totalDebe += $retIva;
        }

        // 3. DEBE: Pago complementario si se cobró en caja o bancos
        if ($pagoEfectivo > 0) {
            $cuentaPagoKey = ($metodoPago === 'transferencia') ? 'BANCOS' : 'CAJA_GENERAL';
            $ctaPago = self::getAccountBySystemKey($negocioId, $cuentaPagoKey) 
                    ?: self::getAccountBySystemKey($negocioId, 'CAJA_GENERAL');

            if ($ctaPago) {
                $lineas[] = [
                    'cuenta_id' => (int)$ctaPago['id'],
                    'debe'      => $pagoEfectivo,
                    'haber'     => 0.00,
                    'concepto'  => "Cobro complementario s/f #{$numeroFacturaVenta} ({$metodoPago})",
                    'ref_doc'   => $numeroRetencion
                ];
                $totalDebe += $pagoEfectivo;
            }
        }

        $totalDebe = round($totalDebe, 2);

        // 4. HABER: Cancelación / Disminución de Cuentas por Cobrar Clientes
        if ($totalDebe > 0 && $ctaCxc) {
            $lineas[] = [
                'cuenta_id' => (int)$ctaCxc['id'],
                'debe'      => 0.00,
                'haber'     => $totalDebe,
                'concepto'  => "Cancelación CxC por retención recibida de {$clienteNombre} s/f #{$numeroFacturaVenta}",
                'ref_doc'   => $numeroRetencion
            ];
        }

        try {
            $asiento = self::createAsiento($negocioId, $usuarioId, [
                'fecha'        => date('Y-m-d'),
                'tipo_asiento' => 'INGRESO',
                'concepto'     => "Retención recibida de cliente {$clienteNombre} s/f #{$numeroFacturaVenta} Ret #{$numeroRetencion}",
                'origen'       => 'cobro_retencion',
                'origen_id'    => $retencionId,
                'detalles'     => $lineas
            ]);

            return (int)$asiento['asiento_id'];
        } catch (Throwable $e) {
            error_log("Error al generar asiento de retención de cliente ID {$retencionId}: " . $e->getMessage());
            return null;
        }
    }

    /**
     * Registra el Asiento Contable de una Nota de Crédito Electrónica SRI (Anulación / Devolución)
     * DEBE: Ventas (Gravadas 15% o 0%)
     * DEBE: IVA en Ventas (15%)
     * HABER: Caja / Bancos / Clientes CxC
     * Simultaniedad de Inventario:
     * DEBE: Inventario (reingreso)
     * HABER: Costo de Ventas
     */
    public static function recordCreditNoteEntry(
        int $negocioId,
        int $usuarioId,
        int $notaCreditoId,
        string $numeroNotaCredito,
        string $numeroFacturaModificada,
        string $clienteNombre,
        float $subtotal15,
        float $subtotal0,
        float $iva,
        float $total,
        float $costoMercaderiaDevuelta = 0.0,
        string $medioDevolucion = 'efectivo'
    ): ?int {
        self::seedBasicPlan($negocioId);

        $ctaVentas15 = self::getAccountBySystemKey($negocioId, 'VENTAS_GRAVADAS_15');
        $ctaVentas0  = self::getAccountBySystemKey($negocioId, 'VENTAS_TARIFA_0');
        $ctaIva      = self::getAccountBySystemKey($negocioId, 'IVA_VENTAS_15');
        
        $cuentaPagoKey = 'CAJA_GENERAL';
        if ($medioDevolucion === 'transferencia') {
            $cuentaPagoKey = 'BANCOS';
        } elseif ($medioDevolucion === 'cxc' || $medioDevolucion === 'fiado') {
            $cuentaPagoKey = 'CLIENTES_CXC';
        }
        $ctaPago = self::getAccountBySystemKey($negocioId, $cuentaPagoKey)
                ?: self::getAccountBySystemKey($negocioId, 'CAJA_GENERAL');

        $lineas = [];

        // 1. DEBE: Reversión de Ingresos por Ventas
        if ($subtotal15 > 0 && $ctaVentas15) {
            $lineas[] = [
                'cuenta_id' => (int)$ctaVentas15['id'],
                'debe'      => $subtotal15,
                'haber'     => 0.00,
                'concepto'  => "Nota de Crédito #{$numeroNotaCredito} s/f #{$numeroFacturaModificada}",
                'ref_doc'   => $numeroNotaCredito
            ];
        }

        if ($subtotal0 > 0 && $ctaVentas0) {
            $lineas[] = [
                'cuenta_id' => (int)$ctaVentas0['id'],
                'debe'      => $subtotal0,
                'haber'     => 0.00,
                'concepto'  => "Nota de Crédito #{$numeroNotaCredito} tarifa 0% s/f #{$numeroFacturaModificada}",
                'ref_doc'   => $numeroNotaCredito
            ];
        }

        // 2. DEBE: Reversión de IVA por Pagar
        if ($iva > 0 && $ctaIva) {
            $lineas[] = [
                'cuenta_id' => (int)$ctaIva['id'],
                'debe'      => $iva,
                'haber'     => 0.00,
                'concepto'  => "Reversión de IVA en Nota de Crédito #{$numeroNotaCredito}",
                'ref_doc'   => $numeroNotaCredito
            ];
        }

        // 3. HABER: Devolución de dinero o disminución de cuenta por cobrar
        if ($total > 0 && $ctaPago) {
            $lineas[] = [
                'cuenta_id' => (int)$ctaPago['id'],
                'debe'      => 0.00,
                'haber'     => $total,
                'concepto'  => "Devolución/Compensación por Nota de Crédito #{$numeroNotaCredito} a {$clienteNombre}",
                'ref_doc'   => $numeroNotaCredito
            ];
        }

        // 4. Reingreso de mercaderías al inventario (si hubo costo de mercadería devuelta)
        if ($costoMercaderiaDevuelta > 0) {
            $ctaInv   = self::getAccountBySystemKey($negocioId, 'INVENTARIO');
            $ctaCosto = self::getAccountBySystemKey($negocioId, 'COSTO_VENTAS');

            if ($ctaInv && $ctaCosto) {
                $lineas[] = [
                    'cuenta_id' => (int)$ctaInv['id'],
                    'debe'      => $costoMercaderiaDevuelta,
                    'haber'     => 0.00,
                    'concepto'  => "Reingreso a inventario por devolución Nota de Crédito #{$numeroNotaCredito}",
                    'ref_doc'   => $numeroNotaCredito
                ];
                $lineas[] = [
                    'cuenta_id' => (int)$ctaCosto['id'],
                    'debe'      => 0.00,
                    'haber'     => $costoMercaderiaDevuelta,
                    'concepto'  => "Reversión de costo de ventas por Nota de Crédito #{$numeroNotaCredito}",
                    'ref_doc'   => $numeroNotaCredito
                ];
            }
        }

        try {
            $asiento = self::createAsiento($negocioId, $usuarioId, [
                'fecha'        => date('Y-m-d'),
                'tipo_asiento' => 'AJUSTE',
                'concepto'     => "Nota de Crédito #{$numeroNotaCredito} s/f #{$numeroFacturaModificada} - {$clienteNombre}",
                'origen'       => 'manual',
                'origen_id'    => $notaCreditoId,
                'detalles'     => $lineas
            ]);

            return (int)$asiento['asiento_id'];
        } catch (Throwable $e) {
            error_log("Error al generar asiento de Nota de Crédito ID {$notaCreditoId}: " . $e->getMessage());
            return null;
        }
    }
}
