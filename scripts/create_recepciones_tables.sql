-- ========================================================
-- Script DDL: Creación de tablas de Recepciones de Facturas
-- Esquema Maestro-Detalle (Cabecera y Partidas)
-- ========================================================

CREATE TABLE IF NOT EXISTS `recepciones_facturas` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `folio_factura` VARCHAR(50) NOT NULL,
  `uuid_sat` VARCHAR(60) NULL,
  `rfc_proveedor` VARCHAR(20) NOT NULL,
  `nombre_proveedor` VARCHAR(255) NOT NULL,
  `sucursal_destino` VARCHAR(50) NOT NULL,
  `almacen_sae` INT NULL,
  `fecha_factura` DATE NULL,
  `fecha_subida` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `subido_por` VARCHAR(100) NULL,
  `fecha_recepcion` DATETIME NULL,
  `recibido_por` VARCHAR(100) NULL,
  `estatus` ENUM(
    'PENDIENTE',
    'EN_RECEPCION',
    'RECIBIDO_COMPLETO',
    'RECIBIDO_CON_INCIDENCIA',
    'OC_GENERADA',
    'CANCELADO'
  ) NOT NULL DEFAULT 'PENDIENTE',
  `total_partidas` INT NOT NULL,
  `total_piezas_facturadas` DECIMAL(12,2) NOT NULL,
  `total_piezas_recibidas` DECIMAL(12,2) NULL DEFAULT 0.00,
  `tiene_incidencias` TINYINT(1) NOT NULL DEFAULT 0,
  `observaciones_generales` TEXT NULL,
  `xml_original` MEDIUMTEXT NULL,
  INDEX `idx_folio` (`folio_factura`),
  INDEX `idx_uuid` (`uuid_sat`),
  INDEX `idx_sucursal` (`sucursal_destino`),
  INDEX `idx_estatus` (`estatus`),
  INDEX `idx_rfc` (`rfc_proveedor`),
  INDEX `idx_fecha_subida` (`fecha_subida`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `recepciones_facturas_partidas` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `recepcion_id` INT NOT NULL,
  `numero_partida` INT NOT NULL,
  `clave_proveedor` VARCHAR(100) NOT NULL,
  `clave_interna` VARCHAR(100) NULL,
  `descripcion` VARCHAR(500) NULL,
  `cantidad_facturada` DECIMAL(12,2) NOT NULL,
  `cantidad_recibida` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `precio_unitario` DECIMAL(14,4) NOT NULL,
  `importe` DECIMAL(14,4) NOT NULL,
  `descuento_porcentaje` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `estatus_partida` ENUM(
    'PENDIENTE',
    'COMPLETA',
    'INCOMPLETA',
    'DANADA',
    'NO_RECIBIDA'
  ) NOT NULL DEFAULT 'PENDIENTE',
  `observacion` VARCHAR(500) NULL,
  INDEX `idx_partida_recepcion` (`recepcion_id`),
  INDEX `idx_partida_cve_prov` (`clave_proveedor`),
  INDEX `idx_partida_cve_int` (`clave_interna`),
  CONSTRAINT `fk_recepciones_partidas_cabecera`
    FOREIGN KEY (`recepcion_id`)
    REFERENCES `recepciones_facturas` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
