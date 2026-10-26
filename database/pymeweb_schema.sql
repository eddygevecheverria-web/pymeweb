CREATE DATABASE IF NOT EXISTS pymeweb CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE pymeweb;

-- ==========================================================
-- FASE 1: Negocios (Tenants), Usuarios, Roles y Recuperación
-- ==========================================================
CREATE TABLE IF NOT EXISTS negocios (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    slug VARCHAR(150) NOT NULL UNIQUE COMMENT 'Identificador para URL pública /[nombre-negocio]',
    ruc_nit VARCHAR(30) DEFAULT NULL,
    telefono VARCHAR(30) DEFAULT NULL,
    direccion VARCHAR(255) DEFAULT NULL,
    logo_url VARCHAR(255) DEFAULT NULL,
    estado ENUM('activo', 'inactivo', 'prueba') NOT NULL DEFAULT 'prueba',
    fecha_registro DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_expiracion DATETIME NOT NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_slug (slug),
    INDEX idx_estado_expiracion (estado, fecha_expiracion)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS usuarios (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    negocio_id INT UNSIGNED DEFAULT NULL COMMENT 'NULL exclusivamente para super_admin',
    nombre VARCHAR(120) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    rol ENUM('super_admin', 'admin_negocio', 'vendedor') NOT NULL DEFAULT 'admin_negocio',
    activo TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_usuario_negocio FOREIGN KEY (negocio_id) 
        REFERENCES negocios(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS password_resets (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT UNSIGNED NOT NULL,
    token_hash CHAR(64) NOT NULL COMMENT 'SHA-256 del token enviado por correo',
    expira_en DATETIME NOT NULL,
    usado TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_token_hash (token_hash),
    CONSTRAINT fk_reset_usuario FOREIGN KEY (usuario_id) 
        REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS categorias (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    negocio_id INT UNSIGNED NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    descripcion VARCHAR(255) DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_categorias_negocio (negocio_id),
    CONSTRAINT fk_categoria_negocio FOREIGN KEY (negocio_id) 
        REFERENCES negocios(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS productos (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    negocio_id INT UNSIGNED NOT NULL,
    categoria_id INT UNSIGNED DEFAULT NULL,
    codigo_barra VARCHAR(64) DEFAULT NULL,
    nombre VARCHAR(150) NOT NULL,
    descripcion TEXT DEFAULT NULL,
    precio_compra DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    precio_venta DECIMAL(12,2) NOT NULL,
    stock INT NOT NULL DEFAULT 0,
    imagen_url VARCHAR(255) DEFAULT NULL,
    activo TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_productos_negocio (negocio_id),
    INDEX idx_productos_categoria (categoria_id),
    CONSTRAINT fk_producto_negocio FOREIGN KEY (negocio_id) 
        REFERENCES negocios(id) ON DELETE CASCADE,
    CONSTRAINT fk_producto_categoria FOREIGN KEY (categoria_id) 
        REFERENCES categorias(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS clientes (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    negocio_id INT UNSIGNED NOT NULL,
    documento VARCHAR(30) DEFAULT NULL,
    nombre VARCHAR(150) NOT NULL,
    email VARCHAR(150) DEFAULT NULL,
    telefono VARCHAR(30) DEFAULT NULL,
    direccion VARCHAR(255) DEFAULT NULL,
    saldo_pendiente DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT 'Control de fiados / cuentas por cobrar',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_clientes_negocio (negocio_id),
    CONSTRAINT fk_cliente_negocio FOREIGN KEY (negocio_id) 
        REFERENCES negocios(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ==========================================================
-- FASE 2: Historial de Pagos de Suscripciones (Super Admin)
-- ==========================================================
CREATE TABLE IF NOT EXISTS pagos_saas (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    negocio_id INT UNSIGNED NOT NULL,
    aprobado_por INT UNSIGNED NOT NULL COMMENT 'ID del usuario super_admin',
    dias_agregados INT NOT NULL COMMENT 'Ej. 30, 180, 365',
    monto DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    metodo_pago VARCHAR(50) DEFAULT 'transferencia',
    notas VARCHAR(255) DEFAULT NULL,
    fecha_expiracion_previa DATETIME NOT NULL,
    fecha_expiracion_nueva DATETIME NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_pagos_negocio (negocio_id),
    CONSTRAINT fk_pago_negocio FOREIGN KEY (negocio_id) 
        REFERENCES negocios(id) ON DELETE CASCADE,
    CONSTRAINT fk_pago_admin FOREIGN KEY (aprobado_por) 
        REFERENCES usuarios(id)
) ENGINE=InnoDB;

-- ==========================================================
-- FASE 3: Ventas y Detalles del Punto de Venta (POS / Web)
-- ==========================================================
CREATE TABLE IF NOT EXISTS ventas (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    negocio_id INT UNSIGNED NOT NULL,
    usuario_id INT UNSIGNED DEFAULT NULL COMMENT 'Vendedor o admin que registró la venta',
    cliente_id INT UNSIGNED DEFAULT NULL COMMENT 'NULL para Consumidor Final',
    origen ENUM('pos', 'web') NOT NULL DEFAULT 'pos',
    metodo_pago ENUM('efectivo', 'tarjeta', 'transferencia', 'fiado') NOT NULL DEFAULT 'efectivo',
    subtotal DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    impuesto DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    total DECIMAL(12,2) NOT NULL,
    monto_recibido DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    vuelto DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    estado ENUM('completada', 'pendiente', 'anulada') NOT NULL DEFAULT 'completada',
    comprobante_xml_json LONGTEXT DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_ventas_negocio_fecha (negocio_id, created_at),
    CONSTRAINT fk_venta_negocio FOREIGN KEY (negocio_id) 
        REFERENCES negocios(id) ON DELETE CASCADE,
    CONSTRAINT fk_venta_cliente FOREIGN KEY (cliente_id) 
        REFERENCES clientes(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS venta_detalles (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    venta_id INT UNSIGNED NOT NULL,
    negocio_id INT UNSIGNED NOT NULL,
    producto_id INT UNSIGNED DEFAULT NULL,
    nombre_producto VARCHAR(150) NOT NULL,
    cantidad INT NOT NULL,
    precio_compra_unitario DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    precio_unitario DECIMAL(12,2) NOT NULL,
    subtotal DECIMAL(12,2) NOT NULL,
    INDEX idx_detalle_venta (venta_id),
    INDEX idx_detalle_negocio (negocio_id),
    CONSTRAINT fk_detalle_venta FOREIGN KEY (venta_id) 
        REFERENCES ventas(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ==========================================================
-- FASE 4: Abonos de Fiados y Facturación Electrónica UBL 2.1
-- ==========================================================
CREATE TABLE IF NOT EXISTS abonos_clientes (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    negocio_id INT UNSIGNED NOT NULL,
    cliente_id INT UNSIGNED NOT NULL,
    usuario_id INT UNSIGNED NOT NULL,
    monto DECIMAL(12,2) NOT NULL,
    metodo_pago ENUM('efectivo', 'transferencia', 'tarjeta') NOT NULL DEFAULT 'efectivo',
    notas VARCHAR(255) DEFAULT NULL,
    saldo_anterior DECIMAL(12,2) NOT NULL,
    saldo_nuevo DECIMAL(12,2) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_abonos_cliente (negocio_id, cliente_id),
    CONSTRAINT fk_abono_negocio FOREIGN KEY (negocio_id) 
        REFERENCES negocios(id) ON DELETE CASCADE,
    CONSTRAINT fk_abono_cliente FOREIGN KEY (cliente_id) 
        REFERENCES clientes(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS facturas_electronicas (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    negocio_id INT UNSIGNED NOT NULL,
    venta_id INT UNSIGNED NOT NULL UNIQUE,
    cliente_id INT UNSIGNED DEFAULT NULL,
    serie VARCHAR(10) NOT NULL DEFAULT 'F001',
    correlativo INT UNSIGNED NOT NULL,
    numero_comprobante VARCHAR(25) NOT NULL,
    cufe_hash CHAR(64) NOT NULL,
    xml_content LONGTEXT NOT NULL,
    json_content LONGTEXT NOT NULL,
    email_enviado TINYINT(1) NOT NULL DEFAULT 0,
    fecha_emision DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_factura_negocio (negocio_id, serie, correlativo),
    CONSTRAINT fk_factura_negocio FOREIGN KEY (negocio_id) 
        REFERENCES negocios(id) ON DELETE CASCADE,
    CONSTRAINT fk_factura_venta FOREIGN KEY (venta_id) 
        REFERENCES ventas(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ==========================================================
-- FASE 5: Pedidos Web (Storefront B2C)
-- ==========================================================
CREATE TABLE IF NOT EXISTS pedidos_web (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    negocio_id INT UNSIGNED NOT NULL,
    venta_id INT UNSIGNED NOT NULL,
    cliente_nombre VARCHAR(150) NOT NULL,
    cliente_telefono VARCHAR(30) NOT NULL,
    cliente_email VARCHAR(150) DEFAULT NULL,
    direccion_entrega VARCHAR(255) DEFAULT NULL,
    modalidad_pago ENUM('online', 'transferencia') NOT NULL DEFAULT 'transferencia',
    comprobante_url VARCHAR(255) DEFAULT NULL,
    referencia_pago VARCHAR(100) DEFAULT NULL,
    estado_pedido ENUM('recibido', 'preparando', 'entregado', 'cancelado') NOT NULL DEFAULT 'recibido',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_pedidos_negocio (negocio_id, created_at),
    CONSTRAINT fk_pedido_negocio FOREIGN KEY (negocio_id) 
        REFERENCES negocios(id) ON DELETE CASCADE,
    CONSTRAINT fk_pedido_venta FOREIGN KEY (venta_id) 
        REFERENCES ventas(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ==========================================================
-- FASE 7: Asistente WhatsApp e Integración con IA
-- ==========================================================
CREATE TABLE IF NOT EXISTS whatsapp_configs (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    negocio_id INT UNSIGNED NOT NULL UNIQUE,
    provider ENUM('meta_official', 'evolution_api', 'generic_webhook') NOT NULL DEFAULT 'meta_official',
    phone_number_id VARCHAR(100) DEFAULT NULL COMMENT 'Meta Phone Number ID o Instance Name en Evolution API',
    api_token TEXT DEFAULT NULL COMMENT 'Access token Meta o API key Evolution API',
    webhook_secret VARCHAR(100) DEFAULT NULL COMMENT 'Verify Token para Meta Webhook',
    ai_provider ENUM('gemini', 'openai') NOT NULL DEFAULT 'gemini',
    ai_api_key TEXT DEFAULT NULL COMMENT 'API Key de Gemini u OpenAI (opcional si usa global)',
    ai_model VARCHAR(50) NOT NULL DEFAULT 'gemini-1.5-flash',
    system_prompt_extra TEXT DEFAULT NULL COMMENT 'Instrucciones personalizadas del negocio',
    activo TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_wacfg_negocio FOREIGN KEY (negocio_id) REFERENCES negocios(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS whatsapp_mensajes (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    negocio_id INT UNSIGNED NOT NULL,
    cliente_telefono VARCHAR(50) NOT NULL,
    cliente_nombre VARCHAR(150) DEFAULT NULL,
    direccion ENUM('entrante', 'saliente') NOT NULL,
    mensaje TEXT NOT NULL,
    tipo_mensaje VARCHAR(30) NOT NULL DEFAULT 'text',
    raw_payload LONGTEXT DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_wa_negocio_telefono (negocio_id, cliente_telefono, created_at),
    CONSTRAINT fk_wamsg_negocio FOREIGN KEY (negocio_id) REFERENCES negocios(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Semilla inicial: Usuario Super Admin (Password por defecto: password)
INSERT INTO usuarios (negocio_id, nombre, email, password_hash, rol)
VALUES (
    NULL, 
    'Super Administrador', 
    'admin@pymeweb.com', 
    '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
    'super_admin'
) ON DUPLICATE KEY UPDATE nombre = VALUES(nombre);

