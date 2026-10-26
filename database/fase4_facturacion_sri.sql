-- =========================================================================
-- PYMEWEB ERP - FASE 4: FACTURACIÓN ELECTRÓNICA LEGAL SRI (ECUADOR)
-- =========================================================================

USE pymeweb;

-- 1. Tabla Unificada de Comprobantes Electrónicos Emitidos al SRI (Facturas, Notas de Crédito, Retenciones)
CREATE TABLE IF NOT EXISTS comprobantes_electronicos_sri (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    negocio_id INT UNSIGNED NOT NULL,
    tipo_documento ENUM('01', '04', '07') NOT NULL COMMENT '01=Factura, 04=Nota de Crédito, 07=Retención',
    origen_tipo ENUM('venta', 'compra', 'devolucion') NOT NULL DEFAULT 'venta',
    origen_id INT UNSIGNED NOT NULL COMMENT 'ID de venta o compra asociada',
    serie VARCHAR(6) NOT NULL DEFAULT '001001',
    secuencial INT UNSIGNED NOT NULL,
    numero_comprobante VARCHAR(20) NOT NULL COMMENT '001-001-000000001',
    clave_acceso CHAR(49) NOT NULL UNIQUE,
    fecha_emision DATE NOT NULL,
    ambiente TINYINT NOT NULL DEFAULT 1 COMMENT '1=Pruebas, 2=Producción',
    estado_sri ENUM('PENDIENTE', 'RECIBIDA', 'AUTORIZADO', 'NO_AUTORIZADO', 'DEVUELTA', 'ANULADO') NOT NULL DEFAULT 'PENDIENTE',
    mensaje_sri TEXT NULL,
    numero_autorizacion VARCHAR(49) NULL,
    fecha_autorizacion DATETIME NULL,
    xml_firmado LONGTEXT NOT NULL,
    xml_autorizado LONGTEXT NULL,
    pdf_ride_path VARCHAR(255) NULL,
    email_enviado TINYINT(1) NOT NULL DEFAULT 0,
    asiento_id INT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_comp_negocio_tipo (negocio_id, tipo_documento, estado_sri),
    INDEX idx_comp_clave (clave_acceso),
    CONSTRAINT fk_ces_negocio FOREIGN KEY (negocio_id) REFERENCES negocios(id) ON DELETE CASCADE,
    CONSTRAINT fk_ces_asiento FOREIGN KEY (asiento_id) REFERENCES asientos_contables(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- 2. Tabla para Retenciones Recibidas de Clientes (Agentes de Retención SRI)
CREATE TABLE IF NOT EXISTS retenciones_clientes (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    negocio_id INT UNSIGNED NOT NULL,
    venta_id INT UNSIGNED NOT NULL,
    cliente_id INT UNSIGNED NOT NULL,
    numero_retencion VARCHAR(50) NOT NULL COMMENT 'Número del comprobante emitido por el cliente agente de retención',
    fecha_emision DATE NOT NULL,
    retencion_renta DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    porcentaje_renta DECIMAL(5,2) NOT NULL DEFAULT 1.75,
    retencion_iva DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    porcentaje_iva DECIMAL(5,2) NOT NULL DEFAULT 30.00,
    total_retenido DECIMAL(12,2) NOT NULL,
    asiento_id INT UNSIGNED NULL COMMENT 'Asiento contable que alimenta Anticipo de Impuestos y cancela CxC',
    observaciones VARCHAR(255) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_ret_cliente_negocio (negocio_id, venta_id),
    CONSTRAINT fk_rc_negocio FOREIGN KEY (negocio_id) REFERENCES negocios(id) ON DELETE CASCADE,
    CONSTRAINT fk_rc_venta FOREIGN KEY (venta_id) REFERENCES ventas(id) ON DELETE CASCADE,
    CONSTRAINT fk_rc_cliente FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE,
    CONSTRAINT fk_rc_asiento FOREIGN KEY (asiento_id) REFERENCES asientos_contables(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- 3. Tabla para Notas de Crédito SRI (Anulaciones o Devoluciones de Ventas)
CREATE TABLE IF NOT EXISTS notas_credito (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    negocio_id INT UNSIGNED NOT NULL,
    venta_id INT UNSIGNED NOT NULL,
    cliente_id INT UNSIGNED NULL,
    numero_nota_credito VARCHAR(20) NOT NULL COMMENT '001-001-000000001',
    clave_acceso CHAR(49) NOT NULL UNIQUE,
    numero_factura_modificada VARCHAR(20) NOT NULL,
    fecha_emision_factura_modificada DATE NOT NULL,
    motivo VARCHAR(255) NOT NULL,
    subtotal_15 DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    subtotal_0 DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    iva DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    total DECIMAL(12,2) NOT NULL,
    estado_sri ENUM('PENDIENTE', 'RECIBIDA', 'AUTORIZADO', 'NO_AUTORIZADO', 'DEVUELTA') NOT NULL DEFAULT 'PENDIENTE',
    mensaje_sri TEXT NULL,
    fecha_autorizacion DATETIME NULL,
    xml_firmado LONGTEXT NOT NULL,
    asiento_id INT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_nc_negocio (negocio_id, venta_id),
    CONSTRAINT fk_nc_negocio FOREIGN KEY (negocio_id) REFERENCES negocios(id) ON DELETE CASCADE,
    CONSTRAINT fk_nc_venta FOREIGN KEY (venta_id) REFERENCES ventas(id) ON DELETE CASCADE,
    CONSTRAINT fk_nc_asiento FOREIGN KEY (asiento_id) REFERENCES asientos_contables(id) ON DELETE SET NULL
) ENGINE=InnoDB;
