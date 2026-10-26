-- =========================================================================
-- PYMEWEB ERP - FASE 6: MINI TIENDA ONLINE (STOREFRONT B2C) Y PEDIDOS WEB
-- =========================================================================

USE pymeweb;

-- 1. Ampliar Negocios con Configuración de Tienda Online B2C y Datos Bancarios
ALTER TABLE negocios
    ADD COLUMN IF NOT EXISTS descripcion TEXT NULL AFTER nombre,
    ADD COLUMN IF NOT EXISTS datos_bancarios TEXT NULL AFTER logo_url,
    ADD COLUMN IF NOT EXISTS whatsapp_contacto VARCHAR(30) NULL AFTER datos_bancarios,
    ADD COLUMN IF NOT EXISTS costo_envio_fijo DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER whatsapp_contacto,
    ADD COLUMN IF NOT EXISTS tienda_online_activa TINYINT(1) NOT NULL DEFAULT 1 AFTER costo_envio_fijo;

-- 2. Tabla de Pedidos Web B2C
CREATE TABLE IF NOT EXISTS pedidos_web (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    negocio_id INT UNSIGNED NOT NULL,
    numero_pedido VARCHAR(30) NOT NULL UNIQUE COMMENT 'Formato WEB-YYYYMM-0001',
    cliente_nombre VARCHAR(150) NOT NULL,
    cliente_documento VARCHAR(20) NOT NULL COMMENT 'Cédula o RUC para facturación',
    cliente_email VARCHAR(150) NOT NULL,
    cliente_telefono VARCHAR(30) NOT NULL,
    cliente_direccion VARCHAR(255) NOT NULL,
    cliente_ciudad VARCHAR(100) NOT NULL DEFAULT 'Quito',
    metodo_pago ENUM('transferencia', 'tarjeta', 'contra_entrega') NOT NULL DEFAULT 'transferencia',
    comprobante_pago_url VARCHAR(255) NULL COMMENT 'Ruta de la foto o captura del comprobante bancario',
    subtotal DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    costo_envio DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    impuesto DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    total DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    estado ENUM('pendiente', 'confirmado', 'enviado', 'entregado', 'cancelado') NOT NULL DEFAULT 'pendiente',
    venta_id INT UNSIGNED NULL COMMENT 'Venta vinculada pre-generada en estado pendiente/completada',
    asiento_id INT UNSIGNED NULL COMMENT 'Asiento contable borrador hasta confirmación de pago',
    factura_id INT UNSIGNED NULL COMMENT 'Factura electrónica SRI emitida tras la confirmación',
    notas TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_pedidos_negocio (negocio_id, estado),
    INDEX idx_pedidos_numero (numero_pedido),
    CONSTRAINT fk_pedidos_negocio FOREIGN KEY (negocio_id) REFERENCES negocios(id) ON DELETE CASCADE,
    CONSTRAINT fk_pedidos_venta FOREIGN KEY (venta_id) REFERENCES ventas(id) ON DELETE SET NULL,
    CONSTRAINT fk_pedidos_asiento FOREIGN KEY (asiento_id) REFERENCES asientos_contables(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- 3. Tabla de Detalles de Pedidos Web
CREATE TABLE IF NOT EXISTS pedido_web_detalles (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    pedido_id INT UNSIGNED NOT NULL,
    producto_id INT UNSIGNED NOT NULL,
    nombre_producto VARCHAR(200) NOT NULL,
    cantidad DECIMAL(10,2) NOT NULL,
    precio_unitario DECIMAL(12,2) NOT NULL,
    subtotal DECIMAL(12,2) NOT NULL,
    costo_unitario DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_pwd_pedido (pedido_id),
    CONSTRAINT fk_pwd_pedido FOREIGN KEY (pedido_id) REFERENCES pedidos_web(id) ON DELETE CASCADE,
    CONSTRAINT fk_pwd_producto FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE RESTRICT
) ENGINE=InnoDB;
