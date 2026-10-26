-- ==============================================================
-- FASE 7: MÓDULO DE SUSCRIPCIONES Y TRANSFERENCIAS BANCARIAS
-- ==============================================================

USE pymeweb;

-- 1. Tabla de Configuración Global de SaaS y Tarifas
CREATE TABLE IF NOT EXISTS `configuracion_saas` (
  `id` INT(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `precio_mensual` DECIMAL(10,2) NOT NULL DEFAULT 15.00,
  `precio_anual` DECIMAL(10,2) NOT NULL DEFAULT 130.00,
  `dias_prueba` INT(11) NOT NULL DEFAULT 7,
  `datos_bancarios` TEXT DEFAULT NULL,
  `whatsapp_soporte` VARCHAR(50) DEFAULT NULL,
  `email_soporte` VARCHAR(150) DEFAULT NULL,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP() ON UPDATE CURRENT_TIMESTAMP(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Insertar configuración inicial por defecto si no existe
INSERT INTO `configuracion_saas` (`id`, `precio_mensual`, `precio_anual`, `dias_prueba`, `datos_bancarios`, `whatsapp_soporte`, `email_soporte`)
VALUES (1, 15.00, 130.00, 7, 'Banco Pichincha - Cuenta Corriente # 2100458921\nTitular: PymeWeb ERP S.A.S.\nRUC: 1793148921001\nTipo: Transferencia Directa o Interbancaria', '0985559516', 'soporte@pymeweb.com')
ON DUPLICATE KEY UPDATE `updated_at` = NOW();

-- 2. Tabla de Solicitudes de Suscripción y Comprobantes de Transferencia
CREATE TABLE IF NOT EXISTS `solicitudes_suscripcion` (
  `id` INT(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `negocio_id` INT(10) UNSIGNED NOT NULL,
  `plan_tipo` ENUM('mensual','anual') NOT NULL DEFAULT 'mensual',
  `dias` INT(11) NOT NULL DEFAULT 30,
  `monto` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `banco_origen` VARCHAR(100) DEFAULT NULL,
  `numero_comprobante` VARCHAR(100) NOT NULL,
  `fecha_transferencia` DATE DEFAULT NULL,
  `comprobante_url` VARCHAR(255) DEFAULT NULL,
  `estado` ENUM('pendiente','aprobado','rechazado') NOT NULL DEFAULT 'pendiente',
  `motivo_rechazo` VARCHAR(255) DEFAULT NULL,
  `revisado_por` INT(10) UNSIGNED DEFAULT NULL,
  `revisado_en` DATETIME DEFAULT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP(),
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP() ON UPDATE CURRENT_TIMESTAMP(),
  PRIMARY KEY (`id`),
  KEY `negocio_id` (`negocio_id`),
  KEY `estado` (`estado`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
