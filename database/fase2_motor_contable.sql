-- ==========================================================
-- PYMEWEB ERP - FASE 2: MOTOR CONTABLE DE DOBLE PARTIDA
-- ==========================================================
USE pymeweb;

-- 1. Catálogo / Plan de Cuentas Contable Multi-Tenant
CREATE TABLE IF NOT EXISTS plan_cuentas (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    negocio_id INT UNSIGNED NOT NULL,
    codigo VARCHAR(30) NOT NULL COMMENT 'Código jerárquico tipo 1.1.01.001',
    nombre VARCHAR(150) NOT NULL,
    tipo ENUM('ACTIVO', 'PASIVO', 'PATRIMONIO', 'INGRESOS', 'COSTOS', 'GASTOS') NOT NULL,
    naturaleza ENUM('DEUDORA', 'ACREEDORA') NOT NULL,
    nivel TINYINT UNSIGNED NOT NULL DEFAULT 1 COMMENT '1=Clase, 2=Grupo, 3=Cuenta, 4=Subcuenta, 5=Auxiliar',
    padre_id INT UNSIGNED DEFAULT NULL COMMENT 'ID de la cuenta superior en la jerarquía',
    acepta_movimiento TINYINT(1) NOT NULL DEFAULT 0 COMMENT '0=Cuenta de título/agrupación, 1=Cuenta de detalle con movimiento',
    es_sistema VARCHAR(50) DEFAULT NULL COMMENT 'Identificador de sistema para asientos automáticos',
    activo TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_cuenta_negocio (negocio_id, codigo),
    INDEX idx_plan_negocio_tipo (negocio_id, tipo),
    INDEX idx_plan_negocio_sistema (negocio_id, es_sistema),
    CONSTRAINT fk_plan_negocio FOREIGN KEY (negocio_id) 
        REFERENCES negocios(id) ON DELETE CASCADE,
    CONSTRAINT fk_plan_padre FOREIGN KEY (padre_id) 
        REFERENCES plan_cuentas(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- 2. Periodos Contables Mensuales
CREATE TABLE IF NOT EXISTS periodos_contables (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    negocio_id INT UNSIGNED NOT NULL,
    anio SMALLINT UNSIGNED NOT NULL,
    mes TINYINT UNSIGNED NOT NULL COMMENT '1 al 12',
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    estado ENUM('abierto', 'cerrado') NOT NULL DEFAULT 'abierto',
    cerrado_por INT UNSIGNED DEFAULT NULL,
    fecha_cierre DATETIME DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_periodo_negocio (negocio_id, anio, mes),
    INDEX idx_periodo_fechas (negocio_id, fecha_inicio, fecha_fin),
    CONSTRAINT fk_periodo_negocio FOREIGN KEY (negocio_id) 
        REFERENCES negocios(id) ON DELETE CASCADE,
    CONSTRAINT fk_periodo_usuario FOREIGN KEY (cerrado_por) 
        REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- 3. Cabecera de Asientos Contables (Libro Diario)
CREATE TABLE IF NOT EXISTS asientos_contables (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    negocio_id INT UNSIGNED NOT NULL,
    periodo_id INT UNSIGNED NOT NULL,
    numero_asiento INT UNSIGNED NOT NULL COMMENT 'Correlativo secuencial anual por negocio',
    fecha DATE NOT NULL,
    tipo_asiento ENUM('DIARIO', 'INGRESO', 'EGRESO', 'AJUSTE', 'CIERRE') NOT NULL DEFAULT 'DIARIO',
    concepto TEXT NOT NULL COMMENT 'Glosa o descripción de la transacción',
    origen ENUM('manual', 'venta_pos', 'compra', 'cobro_retencion', 'cierre') NOT NULL DEFAULT 'manual',
    origen_id INT UNSIGNED DEFAULT NULL COMMENT 'ID de la venta o compra vinculada',
    total_debe DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    total_haber DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    estado ENUM('borrador', 'mayorizado', 'anulado') NOT NULL DEFAULT 'mayorizado',
    asiento_reversion_id INT UNSIGNED DEFAULT NULL COMMENT 'Apunta al asiento inverso en caso de anulación',
    creado_por INT UNSIGNED NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_asiento_num (negocio_id, periodo_id, numero_asiento),
    INDEX idx_asientos_negocio_fecha (negocio_id, fecha),
    INDEX idx_asientos_origen (negocio_id, origen, origen_id),
    CONSTRAINT fk_asiento_negocio FOREIGN KEY (negocio_id) 
        REFERENCES negocios(id) ON DELETE CASCADE,
    CONSTRAINT fk_asiento_periodo FOREIGN KEY (periodo_id) 
        REFERENCES periodos_contables(id),
    CONSTRAINT fk_asiento_usuario FOREIGN KEY (creado_por) 
        REFERENCES usuarios(id),
    CONSTRAINT fk_asiento_reversion FOREIGN KEY (asiento_reversion_id) 
        REFERENCES asientos_contables(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- 4. Detalles de Asiento (Doble Partida: Debe y Haber)
CREATE TABLE IF NOT EXISTS detalles_asiento (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    asiento_id INT UNSIGNED NOT NULL,
    cuenta_id INT UNSIGNED NOT NULL,
    linea TINYINT UNSIGNED NOT NULL COMMENT 'Orden correlativo en el comprobante',
    concepto VARCHAR(255) DEFAULT NULL COMMENT 'Glosa particular del movimiento',
    debe DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    haber DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    referencia_documento VARCHAR(100) DEFAULT NULL COMMENT 'No. Factura, Cheque o Transferencia',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_detalle_asiento (asiento_id),
    INDEX idx_detalle_cuenta (cuenta_id),
    -- Regla de Inmutabilidad: No se puede borrar detalles si el asiento existe
    CONSTRAINT fk_detalle_asiento FOREIGN KEY (asiento_id) 
        REFERENCES asientos_contables(id) ON DELETE RESTRICT,
    CONSTRAINT fk_detalle_cuenta FOREIGN KEY (cuenta_id) 
        REFERENCES plan_cuentas(id) ON DELETE RESTRICT
) ENGINE=InnoDB;
