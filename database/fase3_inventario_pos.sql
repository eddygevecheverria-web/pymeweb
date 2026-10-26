-- =========================================================================
-- PYMEWEB ERP - FASE 3: INVENTARIO INTELIGENTE, MAPEO CONTABLE Y COMPRAS
-- =========================================================================

USE pymeweb;

-- 1. Ampliar Categorías con Mapeo Contable (Cuentas NIIF / SRI)
ALTER TABLE categorias
    ADD COLUMN cuenta_inventario_id INT UNSIGNED NULL AFTER descripcion,
    ADD COLUMN cuenta_ingreso_id INT UNSIGNED NULL AFTER cuenta_inventario_id,
    ADD COLUMN cuenta_costo_id INT UNSIGNED NULL AFTER cuenta_ingreso_id,
    ADD CONSTRAINT fk_cat_cta_inventario FOREIGN KEY (cuenta_inventario_id) REFERENCES plan_cuentas(id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_cat_cta_ingreso FOREIGN KEY (cuenta_ingreso_id) REFERENCES plan_cuentas(id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_cat_cta_costo FOREIGN KEY (cuenta_costo_id) REFERENCES plan_cuentas(id) ON DELETE SET NULL;

-- 2. Crear Tabla de Proveedores antes de vincular productos y compras
CREATE TABLE IF NOT EXISTS proveedores (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    negocio_id INT UNSIGNED NOT NULL,
    ruc VARCHAR(20) NOT NULL,
    razon_social VARCHAR(150) NOT NULL,
    nombre_comercial VARCHAR(150) DEFAULT NULL,
    email VARCHAR(150) DEFAULT NULL,
    telefono VARCHAR(30) DEFAULT NULL,
    direccion VARCHAR(255) DEFAULT NULL,
    cuenta_por_pagar_id INT UNSIGNED DEFAULT NULL COMMENT 'Mapeo a 2.1.01.01 Proveedores Locales',
    activo TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_proveedores_negocio (negocio_id),
    CONSTRAINT fk_prov_negocio FOREIGN KEY (negocio_id) REFERENCES negocios(id) ON DELETE CASCADE,
    CONSTRAINT fk_prov_cuenta_cxp FOREIGN KEY (cuenta_por_pagar_id) REFERENCES plan_cuentas(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- 3. Ampliar Productos con Mapeo Contable específico, Stock Mínimo y Proveedor
ALTER TABLE productos
    ADD COLUMN cuenta_inventario_id INT UNSIGNED NULL AFTER precio_venta,
    ADD COLUMN cuenta_ingreso_id INT UNSIGNED NULL AFTER cuenta_inventario_id,
    ADD COLUMN cuenta_costo_id INT UNSIGNED NULL AFTER cuenta_ingreso_id,
    ADD COLUMN stock_minimo INT NOT NULL DEFAULT 5 AFTER stock,
    ADD COLUMN proveedor_id INT UNSIGNED NULL AFTER stock_minimo,
    ADD CONSTRAINT fk_prod_cta_inventario FOREIGN KEY (cuenta_inventario_id) REFERENCES plan_cuentas(id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_prod_cta_ingreso FOREIGN KEY (cuenta_ingreso_id) REFERENCES plan_cuentas(id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_prod_cta_costo FOREIGN KEY (cuenta_costo_id) REFERENCES plan_cuentas(id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_prod_proveedor FOREIGN KEY (proveedor_id) REFERENCES proveedores(id) ON DELETE SET NULL;

-- 4. Crear Módulo de Compras a Proveedores
CREATE TABLE IF NOT EXISTS compras (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    negocio_id INT UNSIGNED NOT NULL,
    proveedor_id INT UNSIGNED NOT NULL,
    usuario_id INT UNSIGNED NOT NULL,
    numero_factura VARCHAR(50) NOT NULL COMMENT 'Formato SRI 001-001-000000001',
    fecha_emision DATE NOT NULL,
    metodo_pago ENUM('efectivo', 'transferencia', 'credito') NOT NULL DEFAULT 'transferencia',
    subtotal_15 DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    subtotal_0 DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    iva DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    total DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    retencion_renta DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    retencion_iva DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    total_pagar DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    estado ENUM('registrada', 'anulada') NOT NULL DEFAULT 'registrada',
    asiento_id INT UNSIGNED DEFAULT NULL COMMENT 'Asiento contable automático generado',
    observaciones VARCHAR(255) DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_compras_negocio (negocio_id, fecha_emision),
    CONSTRAINT fk_compra_negocio FOREIGN KEY (negocio_id) REFERENCES negocios(id) ON DELETE CASCADE,
    CONSTRAINT fk_compra_proveedor FOREIGN KEY (proveedor_id) REFERENCES proveedores(id) ON DELETE RESTRICT,
    CONSTRAINT fk_compra_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
    CONSTRAINT fk_compra_asiento FOREIGN KEY (asiento_id) REFERENCES asientos_contables(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- 5. Crear Detalles de Compras
CREATE TABLE IF NOT EXISTS compra_detalles (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    compra_id INT UNSIGNED NOT NULL,
    negocio_id INT UNSIGNED NOT NULL,
    producto_id INT UNSIGNED NOT NULL,
    nombre_producto VARCHAR(150) NOT NULL,
    cantidad INT NOT NULL,
    costo_unitario DECIMAL(12,4) NOT NULL,
    subtotal DECIMAL(12,2) NOT NULL,
    tarifa_iva DECIMAL(5,2) NOT NULL DEFAULT 15.00,
    valor_iva DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    total DECIMAL(12,2) NOT NULL,
    INDEX idx_compra_detalles (compra_id),
    CONSTRAINT fk_compra_det_compra FOREIGN KEY (compra_id) REFERENCES compras(id) ON DELETE CASCADE,
    CONSTRAINT fk_compra_det_negocio FOREIGN KEY (negocio_id) REFERENCES negocios(id) ON DELETE CASCADE,
    CONSTRAINT fk_compra_det_producto FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- 6. Vincular Ventas POS con Asientos Contables Inmutables
ALTER TABLE ventas
    ADD COLUMN asiento_id INT UNSIGNED NULL AFTER estado,
    ADD CONSTRAINT fk_venta_asiento FOREIGN KEY (asiento_id) REFERENCES asientos_contables(id) ON DELETE SET NULL;
