-- ======================================================================
--  SISTEMA DE CAFETERIA - ESQUEMA DE BASE DE DATOS  (v2)
--  Compatible con: MySQL 5.7+ / MariaDB 10.3+
--  Motor: InnoDB (transacciones y claves foraneas)
--
--  IMPORTANTE:
--    Este archivo crea TODAS las tablas. NO crea la base de datos ni el
--    usuario MySQL: eso lo haces en cPanel (PASO 2 del manual).
--    En phpMyAdmin selecciona primero tu base y luego importa este archivo.
--
--  NOVEDADES v2 (cafeteria):
--    * productos.fecha_vencimiento  -> vencimiento de perecederos
--    * combos / combo_productos / combo_opcionales -> menu con recetas
--    * ventas / venta_items  -> punto de caja (descuenta stock por receta)
--    * pedidos  -> pantalla de cocina
--
--  Las ventas historicas de DEMO no vienen aqui: genera datos de ejemplo
--  con  php api/semilla_ventas.php  despues de importar (ver MANUAL).
-- ======================================================================

SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';

-- ----------------------------------------------------------------------
-- 1. ROLES  --  Permisos por tipo de usuario
-- ----------------------------------------------------------------------

DROP TABLE IF EXISTS `roles`;
CREATE TABLE `roles` (
  `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `nombre`        VARCHAR(50)  NOT NULL,
  `descripcion`   VARCHAR(150) NULL,
  -- Permisos como flags de bits (bitwise). Ver src/api/README-permisos.md
  -- 1=ver 2=crear 4=editar 8=eliminar 16=movimientos 32=usuarios 64=config
  -- 128=ventas 256=caja 512=cocina  (a que modulo puede entrar)
  `permisos`      INT UNSIGNED NOT NULL DEFAULT 1,
  `activo`        TINYINT(1)   NOT NULL DEFAULT 1,
  `creado_en`     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_roles_nombre` (`nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------
-- 2. USUARIOS  --  Quien entra al sistema
-- ----------------------------------------------------------------------

DROP TABLE IF EXISTS `usuarios`;
CREATE TABLE `usuarios` (
  `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `nombre`        VARCHAR(100) NOT NULL,
  `email`         VARCHAR(150) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL COMMENT 'Hash bcrypt generado por PHP password_hash()',
  `rol_id`        INT UNSIGNED NOT NULL,
  `telefono`      VARCHAR(30)  NULL,
  `activo`        TINYINT(1)   NOT NULL DEFAULT 1,
  `ultimo_acceso` DATETIME     NULL,
  `creado_en`     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en` TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_usuarios_email` (`email`),
  KEY `ix_usuarios_rol` (`rol_id`),
  KEY `ix_usuarios_activo` (`activo`),
  CONSTRAINT `fk_usuarios_rol` FOREIGN KEY (`rol_id`) REFERENCES `roles` (`id`)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------
-- 3. ALMACENES  --  Sedes donde se guarda el inventario
-- ----------------------------------------------------------------------

DROP TABLE IF EXISTS `almacenes`;
CREATE TABLE `almacenes` (
  `id`             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `codigo`         VARCHAR(10)  NOT NULL COMMENT 'Siglas ej: DES, BAR, REF',
  `nombre`         VARCHAR(100) NOT NULL,
  `direccion`      VARCHAR(200) NULL,
  `ciudad`         VARCHAR(80)  NULL,
  `telefono`       VARCHAR(30)  NULL,
  `responsable`    VARCHAR(100) NULL,
  `activo`         TINYINT(1)   NOT NULL DEFAULT 1,
  `creado_en`      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_almacenes_codigo` (`codigo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------
-- 4. CATEGORIAS
-- ----------------------------------------------------------------------

DROP TABLE IF EXISTS `categorias`;
CREATE TABLE `categorias` (
  `id`             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `nombre`         VARCHAR(80)  NOT NULL,
  `descripcion`    VARCHAR(200) NULL,
  `activo`         TINYINT(1)   NOT NULL DEFAULT 1,
  `creado_en`      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_categorias_nombre` (`nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------
-- 5. PRODUCTOS  --  Catalogo maestro (NO tiene cantidad: eso va en stock)
-- ----------------------------------------------------------------------

DROP TABLE IF EXISTS `productos`;
CREATE TABLE `productos` (
  `id`              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `codigo`          VARCHAR(30)  NOT NULL COMMENT 'SKU / codigo interno',
  `nombre`          VARCHAR(150) NOT NULL,
  `descripcion`     TEXT         NULL,
  `categoria_id`    INT UNSIGNED NULL,
  `unidad_medida`   VARCHAR(10)  NOT NULL DEFAULT 'UND' COMMENT 'UND, KG, LT, POR...',
  `precio_compra`   DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `precio_venta`    DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `stock_minimo`    INT          NOT NULL DEFAULT 0 COMMENT 'Alerta cuando el total este por debajo',
  `stock_maximo`    INT          NOT NULL DEFAULT 0 COMMENT '0 = sin tope',
  `controla_serial` TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '1 = maneja numeros de serie',
  `perecedero`      TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '1 = tiene fecha de vencimiento',
  `fecha_vencimiento` DATE       NULL COMMENT 'Vence el dia indicado (solo perecederos)',
  `activo`          TINYINT(1)   NOT NULL DEFAULT 1,
  `creado_en`       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en`  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_productos_codigo` (`codigo`),
  KEY `ix_productos_nombre` (`nombre`),
  KEY `ix_productos_categoria` (`categoria_id`),
  KEY `ix_productos_activo` (`activo`),
  KEY `ix_productos_vencimiento` (`fecha_vencimiento`),
  FULLTEXT KEY `ft_productos_busqueda` (`nombre`, `descripcion`),
  CONSTRAINT `fk_productos_categoria` FOREIGN KEY (`categoria_id`) REFERENCES `categorias` (`id`)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------
-- 6. STOCK  --  Cantidad de cada producto EN cada almacen
-- ----------------------------------------------------------------------

DROP TABLE IF EXISTS `stock`;
CREATE TABLE `stock` (
  `id`             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `producto_id`    INT UNSIGNED NOT NULL,
  `almacen_id`     INT UNSIGNED NOT NULL,
  `cantidad`       INT          NOT NULL DEFAULT 0,
  `ultima_entrada` DATETIME     NULL,
  `ultima_salida`  DATETIME     NULL,
  `actualizado_en` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_stock_producto_almacen` (`producto_id`, `almacen_id`),
  KEY `ix_stock_almacen` (`almacen_id`),
  KEY `ix_stock_cantidad` (`cantidad`),
  CONSTRAINT `fk_stock_producto` FOREIGN KEY (`producto_id`) REFERENCES `productos` (`id`)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `fk_stock_almacen` FOREIGN KEY (`almacen_id`) REFERENCES `almacenes` (`id`)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------
-- 7. MOVIMIENTOS  --  Bitacora: TODA entrada, salida y venta queda registrada
-- ----------------------------------------------------------------------

DROP TABLE IF EXISTS `movimientos`;
CREATE TABLE `movimientos` (
  `id`              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tipo`            ENUM('entrada','salida','ajuste','transferencia') NOT NULL,
  `producto_id`     INT UNSIGNED  NOT NULL,
  `almacen_id`      INT UNSIGNED  NOT NULL,
  `cantidad`        INT           NOT NULL COMMENT 'Negativa cuando sale (salida/venta)',
  `stock_anterior`  INT           NOT NULL,
  `stock_nuevo`     INT           NOT NULL,
  `costo_unitario`  DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `referencia`      VARCHAR(60)   NULL COMMENT 'Nro de factura, VTA-xxxxx, guia',
  `notas`           VARCHAR(255)  NULL,
  `usuario_id`      INT UNSIGNED  NOT NULL,
  `creado_en`       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ix_mov_prod_fecha` (`producto_id`, `creado_en`),
  KEY `ix_mov_almacen_fecha` (`almacen_id`, `creado_en`),
  KEY `ix_mov_tipo` (`tipo`),
  KEY `ix_mov_usuario` (`usuario_id`),
  CONSTRAINT `fk_mov_producto` FOREIGN KEY (`producto_id`) REFERENCES `productos` (`id`)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT `fk_mov_almacen` FOREIGN KEY (`almacen_id`) REFERENCES `almacenes` (`id`)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT `fk_mov_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------
-- 8. TRANSFERENCIAS  --  Mover stock entre almacenes (2 movimientos)
-- ----------------------------------------------------------------------

DROP TABLE IF EXISTS `transferencias`;
CREATE TABLE `transferencias` (
  `id`                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `codigo`              VARCHAR(20)   NOT NULL COMMENT 'TRF-00001',
  `producto_id`         INT UNSIGNED  NOT NULL,
  `almacen_origen_id`   INT UNSIGNED  NOT NULL,
  `almacen_destino_id`  INT UNSIGNED  NOT NULL,
  `cantidad`            INT           NOT NULL,
  `estado`              ENUM('pendiente','en_transito','recibida','cancelada') NOT NULL DEFAULT 'pendiente',
  `notas`               VARCHAR(255)  NULL,
  `enviado_por`         INT UNSIGNED  NULL,
  `recibido_por`        INT UNSIGNED  NULL,
  `fecha_envio`         DATETIME      NULL,
  `fecha_recepcion`     DATETIME      NULL,
  `creado_en`           TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_transferencias_codigo` (`codigo`),
  KEY `ix_trf_origen` (`almacen_origen_id`),
  KEY `ix_trf_destino` (`almacen_destino_id`),
  KEY `ix_trf_estado` (`estado`),
  CONSTRAINT `fk_trf_producto` FOREIGN KEY (`producto_id`) REFERENCES `productos` (`id`)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT `fk_trf_origen` FOREIGN KEY (`almacen_origen_id`) REFERENCES `almacenes` (`id`)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT `fk_trf_destino` FOREIGN KEY (`almacen_destino_id`) REFERENCES `almacenes` (`id`)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT `fk_trf_enviado` FOREIGN KEY (`enviado_por`) REFERENCES `usuarios` (`id`)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT `fk_trf_recibido` FOREIGN KEY (`recibido_por`) REFERENCES `usuarios` (`id`)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------
-- 9. COMBOS  --  El menu de caja (comida, snacks y bebidas)
--     Cada combo es una receta: los ingredientes van en combo_productos.
-- ----------------------------------------------------------------------

DROP TABLE IF EXISTS `combos`;
CREATE TABLE `combos` (
  `id`              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `codigo`          VARCHAR(20)    NOT NULL COMMENT 'HMB-001',
  `nombre`          VARCHAR(120)   NOT NULL,
  `descripcion`     VARCHAR(255)   NULL,
  `tipo`            ENUM('comida','snack','bebida') NOT NULL DEFAULT 'comida',
  `precio_venta`    DECIMAL(12,2)  NOT NULL DEFAULT 0.00,
  `requiere_cocina` TINYINT(1)     NOT NULL DEFAULT 0 COMMENT '1 = genera pedido en cocina',
  `activo`          TINYINT(1)     NOT NULL DEFAULT 1,
  `creado_en`       TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en`  TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_combos_codigo` (`codigo`),
  KEY `ix_combos_tipo` (`tipo`, `activo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------
-- 10. COMBO_PRODUCTOS  --  Receta base de cada combo (ingredientes incluidos)
--     La cantidad esta en unidades de porcion: 1 pan, 6 nuggets, 1 porcion.
-- ----------------------------------------------------------------------

DROP TABLE IF EXISTS `combo_productos`;
CREATE TABLE `combo_productos` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `combo_id`    INT UNSIGNED  NOT NULL,
  `producto_id` INT UNSIGNED  NOT NULL,
  `cantidad`    INT           NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_cp_combo_producto` (`combo_id`, `producto_id`),
  KEY `ix_cp_producto` (`producto_id`),
  CONSTRAINT `fk_cp_combo` FOREIGN KEY (`combo_id`) REFERENCES `combos` (`id`)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `fk_cp_producto` FOREIGN KEY (`producto_id`) REFERENCES `productos` (`id`)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------
-- 11. COMBO_OPCIONALES  --  Ingredientes extra que el cliente puede pedir
--     Ej: "agregar tocineta (+0,75)" a una hamburguesa.
-- ----------------------------------------------------------------------

DROP TABLE IF EXISTS `combo_opcionales`;
CREATE TABLE `combo_opcionales` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `combo_id`    INT UNSIGNED     NOT NULL,
  `producto_id` INT UNSIGNED     NOT NULL,
  `cantidad`    INT              NOT NULL DEFAULT 1,
  `precio_extra` DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_co_combo_producto` (`combo_id`, `producto_id`),
  KEY `ix_co_producto` (`producto_id`),
  CONSTRAINT `fk_co_combo` FOREIGN KEY (`combo_id`) REFERENCES `combos` (`id`)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `fk_co_producto` FOREIGN KEY (`producto_id`) REFERENCES `productos` (`id`)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------
-- 12. VENTAS  --  Cada cobro de caja. No se borran nunca.
-- ----------------------------------------------------------------------

DROP TABLE IF EXISTS `ventas`;
CREATE TABLE `ventas` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `codigo`        VARCHAR(20)    NOT NULL COMMENT 'VTA-00001',
  `almacen_id`    INT UNSIGNED   NOT NULL COMMENT 'Almacen del que se descuenta stock',
  `usuario_id`    INT UNSIGNED   NOT NULL COMMENT 'Vendedor que cobro',
  `cliente_nombre` VARCHAR(100)  NULL,
  `metodo_pago`   ENUM('efectivo','tarjeta','transferencia','otro') NOT NULL DEFAULT 'efectivo',
  `subtotal`      DECIMAL(12,2)  NOT NULL,
  `descuento`     DECIMAL(12,2)  NOT NULL DEFAULT 0.00,
  `total`         DECIMAL(12,2)  NOT NULL,
  `costo_total`   DECIMAL(12,2)  NOT NULL DEFAULT 0.00 COMMENT 'Suma de costos de ingredientes (ganancia real)',
  `estado`        ENUM('completada','cancelada') NOT NULL DEFAULT 'completada',
  `notas`         VARCHAR(255)   NULL,
  `creado_en`     TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_ventas_codigo` (`codigo`),
  KEY `ix_ventas_fecha` (`creado_en`),
  KEY `ix_ventas_usuario` (`usuario_id`),
  KEY `ix_ventas_almacen` (`almacen_id`),
  CONSTRAINT `fk_ventas_almacen` FOREIGN KEY (`almacen_id`) REFERENCES `almacenes` (`id`)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT `fk_ventas_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------
-- 13. VENTA_ITEMS  --  Lineas de cada venta (snapshot de nombre y precios)
--     ingredientes = JSON con la receta REAL despues de las
--     personalizaciones del cliente (incluidos, quitados y agregados).
-- ----------------------------------------------------------------------

DROP TABLE IF EXISTS `venta_items`;
CREATE TABLE `venta_items` (
  `id`             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `venta_id`       BIGINT UNSIGNED NOT NULL,
  `combo_id`       INT UNSIGNED    NOT NULL,
  `nombre`         VARCHAR(120)    NOT NULL,
  `cantidad`       INT             NOT NULL DEFAULT 1,
  `precio_unitario` DECIMAL(12,2)  NOT NULL COMMENT 'Precio base del combo',
  `extra_precio`   DECIMAL(12,2)   NOT NULL DEFAULT 0.00 COMMENT 'Suma de ingredientes agregados',
  `costo_unitario` DECIMAL(12,2)   NOT NULL DEFAULT 0.00 COMMENT 'Costo de la receta usada',
  `ingredientes`   JSON            NULL,
  `subtotal`       DECIMAL(12,2)   NOT NULL,
  `necesita_cocina` TINYINT(1)     NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `ix_vi_venta` (`venta_id`),
  KEY `ix_vi_combo` (`combo_id`),
  CONSTRAINT `fk_vi_venta` FOREIGN KEY (`venta_id`) REFERENCES `ventas` (`id`)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `fk_vi_combo` FOREIGN KEY (`combo_id`) REFERENCES `combos` (`id`)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------
-- 14. PEDIDOS  --  Cola de cocina. Uno por venta con items que cocinar.
-- ----------------------------------------------------------------------

DROP TABLE IF EXISTS `pedidos`;
CREATE TABLE `pedidos` (
  `id`             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `codigo`         VARCHAR(20)    NOT NULL COMMENT 'PED-00001',
  `venta_id`       BIGINT UNSIGNED NOT NULL,
  `cliente_nombre` VARCHAR(100)   NULL,
  `estado`         ENUM('pendiente','en_preparacion','listo','entregado','cancelado') NOT NULL DEFAULT 'pendiente',
  `notas`          VARCHAR(255)   NULL,
  `creado_en`      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en` TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_pedidos_codigo` (`codigo`),
  KEY `ix_pedidos_estado` (`estado`, `creado_en`),
  CONSTRAINT `fk_pedidos_venta` FOREIGN KEY (`venta_id`) REFERENCES `ventas` (`id`)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------
-- 15. NUMEROS_SERIE  --  Para productos que controlan serial
-- ----------------------------------------------------------------------

DROP TABLE IF EXISTS `numeros_serie`;
CREATE TABLE `numeros_serie` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `producto_id`   INT UNSIGNED NOT NULL,
  `almacen_id`    INT UNSIGNED NOT NULL,
  `serial`        VARCHAR(80) NOT NULL,
  `estado`        ENUM('disponible','vendido','en_reparacion','perdido') NOT NULL DEFAULT 'disponible',
  `observacion`   VARCHAR(200) NULL,
  `creado_en`     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_serial` (`serial`),
  KEY `ix_ns_producto` (`producto_id`),
  CONSTRAINT `fk_ns_producto` FOREIGN KEY (`producto_id`) REFERENCES `productos` (`id`)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `fk_ns_almacen` FOREIGN KEY (`almacen_id`) REFERENCES `almacenes` (`id`)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------
-- 16. AUDITORIA  --  Quien cambio que y cuando
-- ----------------------------------------------------------------------

DROP TABLE IF EXISTS `auditoria`;
CREATE TABLE `auditoria` (
  `id`             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `usuario_id`     INT UNSIGNED  NULL,
  `accion`         ENUM('crear','editar','eliminar','login','logout','transferir','ajustar') NOT NULL,
  `tabla`          VARCHAR(40)   NOT NULL,
  `registro_id`    INT UNSIGNED  NULL,
  `datos_antes`    JSON          NULL,
  `datos_despues`  JSON          NULL,
  `ip`             VARCHAR(45)   NULL,
  `creado_en`      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ix_aud_fecha` (`creado_en`),
  KEY `ix_aud_usuario` (`usuario_id`),
  KEY `ix_aud_tabla` (`tabla`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------
-- VISTAS
-- ----------------------------------------------------------------------

-- Stock con todos los datos del producto y almacen en una sola fila
DROP VIEW IF EXISTS `v_stock_detallado`;
CREATE VIEW `v_stock_detallado` AS
SELECT
  st.id              AS stock_id,
  st.producto_id,
  st.almacen_id,
  p.codigo           AS producto_codigo,
  p.nombre           AS producto_nombre,
  p.unidad_medida,
  p.precio_compra,
  p.precio_venta,
  p.stock_minimo,
  p.perecedero,
  p.fecha_vencimiento,
  p.activo           AS producto_activo,
  c.nombre           AS categoria,
  a.codigo           AS almacen_codigo,
  a.nombre           AS almacen_nombre,
  st.cantidad,
  (st.cantidad * p.precio_compra) AS valor_costo,
  (st.cantidad * p.precio_venta)  AS valor_venta,
  CASE
    WHEN p.stock_minimo = 0 THEN 'normal'
    WHEN st.cantidad = 0 THEN 'agotado'
    WHEN st.cantidad <= p.stock_minimo THEN 'bajo'
    WHEN p.stock_maximo > 0 AND st.cantidad >= p.stock_maximo THEN 'exceso'
    ELSE 'normal'
  END AS estado_stock,
  st.actualizado_en
FROM `stock` st
INNER JOIN `productos` p ON p.id = st.producto_id
INNER JOIN `almacenes` a ON a.id = st.almacen_id
LEFT  JOIN `categorias` c ON c.id = p.categoria_id;

-- Solo lo que necesita atencion: agotado, bajo o en exceso
DROP VIEW IF EXISTS `v_alertas_stock`;
CREATE VIEW `v_alertas_stock` AS
SELECT *
FROM `v_stock_detallado`
WHERE estado_stock IN ('agotado', 'bajo', 'exceso');

-- Total de cada producto sumando todos los almacenes
DROP VIEW IF EXISTS `v_stock_total_producto`;
CREATE VIEW `v_stock_total_producto` AS
SELECT
  p.id              AS producto_id,
  p.codigo,
  p.nombre,
  p.unidad_medida,
  p.stock_minimo,
  p.perecedero,
  p.fecha_vencimiento,
  COALESCE(SUM(st.cantidad), 0) AS cantidad_total,
  COUNT(DISTINCT CASE WHEN st.cantidad > 0 THEN st.almacen_id END) AS almacenes_con_stock
FROM `productos` p
LEFT JOIN `stock` st ON st.producto_id = p.id
WHERE p.activo = 1
GROUP BY p.id, p.codigo, p.nombre, p.unidad_medida, p.stock_minimo, p.perecedero, p.fecha_vencimiento;

-- ----------------------------------------------------------------------
-- DATOS INICIALES
-- ----------------------------------------------------------------------

-- Roles. Permisos bitwise: 1=ver 2=crear 4=editar 8=eliminar
--                          16=movimientos 32=usuarios 64=config
--                          128=ventas 256=caja 512=cocina
--
-- Los tres ultimos bits separan los trabajos: quien cobra no ve las cifras
-- de ventas y quien cocina no puede cobrar.
--
-- El ADMINISTRADOR tiene los tres modulos: al ser el dueno puede relevar un
-- turno y entrar tanto a la Caja como a la Cocina ademas de ver los numeros.
-- Por eso sus permisos son la suma de todo (1023). El control fino esta en
-- los otros roles, que si cada uno solo entra a lo suyo.
--
--   Administrador 127  = 1+2+4+8+16+32+64
--                      | 128+256+512          -> 1023 (entra a todo)
--   Supervisor    31   = 1+2+4+8
--                      | 128+512              ->  671 (ve ventas y cocina)
--   Operador      19   = 1+2+4
--                      | 128+256+512          ->  915 (inventario y caja)
--   Consulta       1   = 1
--                      | 128+256+512          ->  897 (solo mira, en todo)
--   Vendedor       3   = 1+2
--                      | 256                  ->  259 (solo la Caja)
--   Cocina         3   = 1+2
--                      | 512                  ->  515 (solo Cocina)
INSERT INTO `roles` (`id`, `nombre`, `descripcion`, `permisos`) VALUES
  (1, 'Administrador', 'Control total del sistema',        1023),
  (2, 'Supervisor',    'Opera inventarios y ve reportes',   671),
  (3, 'Operador',      'Registra entradas y salidas',       915),
  (4, 'Consulta',      'Solo puede ver',                    897),
  (5, 'Vendedor',      'Atiende la caja y registra ventas',  259),
  (6, 'Cocina',        'Ve los pedidos y los prepara',       515);

-- Categorias de cafeteria
INSERT INTO `categorias` (`id`, `nombre`, `descripcion`) VALUES
  (1, 'Bebidas',            'Jugos naturales, cafes y refrescos'),
  (2, 'Comida Principal',   'Hamburguesas, perros, nuggets y sandwiches'),
  (3, 'Snacks y Fritos',    'Papas, tequeños, yuquitas y aros'),
  (4, 'Panaderia',          'Panes y productos de panaderia'),
  (5, 'Lacteos y Charcuteria', 'Queso, jamon, leche y embutidos'),
  (6, 'Frutas y Verduras',  'Verduras frescas para la cocina'),
  (7, 'Abarrotes',          'Insumos secos y empaques');

-- Almacenes de la cafeteria: de ahi sale el stock en cada venta
INSERT INTO `almacenes` (`id`, `codigo`, `nombre`, `direccion`, `ciudad`, `responsable`) VALUES
  (1, 'DES', 'Despensa Principal',   'Zona de almacen',  'Caracas', 'Por asignar'),
  (2, 'BAR', 'Barra de Bebidas',     'Area de barra',    'Caracas', 'Por asignar'),
  (3, 'REF', 'Refrigeracion y Cocina','Area de cocina',  'Caracas', 'Por asignar');

-- Productos de cafeteria. Las porciones (POR) se cuentan en unidades de uso:
-- 1 porcion de jugo, 1 taza de cafe, 1 porcion de papas, etc.
INSERT INTO `productos`
  (`codigo`, `nombre`, `descripcion`, `categoria_id`, `unidad_medida`, `precio_compra`, `precio_venta`, `stock_minimo`, `stock_maximo`, `controla_serial`, `perecedero`, `fecha_vencimiento`) VALUES
  ('JGO-NAR-01',  'Concentrado de Naranja',  'Base para jugo natural (porcion)',       1, 'POR',  0.60, 2.20, 25, 200, 0, 1, DATE_ADD(CURDATE(), INTERVAL 6 DAY)),
  ('JGO-FRS-02',  'Concentrado de Fresa',    'Base para jugo de fresa (porcion)',      1, 'POR',  0.70, 2.40, 20, 150, 0, 1, DATE_ADD(CURDATE(), INTERVAL 8 DAY)),
  ('LEC-POR-03',  'Leche Entera (porcion)',  'Porcion de 250 ml para cafe y batidos',  5, 'POR',  0.35, 0.90, 40, 300, 0, 1, DATE_ADD(CURDATE(), INTERVAL 5 DAY)),
  ('CAF-POR-04',  'Cafe Molido (porcion)',   'Porcion para una taza de cafe',          1, 'POR',  0.40, 1.00, 30, 200, 0, 0, NULL),
  ('AZU-POR-05',  'Azucar (porcion)',        'Sobre de azucar por taza',               7, 'POR',  0.05, 0.20, 40, 500, 0, 0, NULL),
  ('PAN-HAM-06',  'Pan de Hamburguesa',      'Pan artesanal redondo',                  4, 'UND',  0.30, 0.80, 30, 200, 0, 0, NULL),
  ('PAN-PER-07',  'Pan para Perro Caliente', 'Pan alargado suave',                     4, 'UND',  0.25, 0.70, 30, 200, 0, 0, NULL),
  ('CAR-RES-08',  'Carne de Res 120g',       'Medallon de carne molida',               2, 'UND',  1.40, 2.80, 25, 150, 0, 1, DATE_ADD(CURDATE(), INTERVAL 3 DAY)),
  ('POL-PEC-09',  'Pechuga de Pollo (porcion)','Porcion de pechuga grillada',          2, 'POR',  1.20, 2.40, 20, 120, 0, 1, DATE_ADD(CURDATE(), INTERVAL 2 DAY)),
  ('SAL-CHO-10',  'Salchicha Ranchera',      'Salchicha para perro caliente',          2, 'UND',  0.55, 1.10, 25, 150, 0, 1, DATE_ADD(CURDATE(), INTERVAL 5 DAY)),
  ('NAC-TRG-11',  'Nuggets de Pollo',        'Nuggets (unidad)',                       2, 'UND',  0.18, 0.40, 40, 400, 0, 1, DATE_ADD(CURDATE(), INTERVAL 5 DAY)),
  ('TOC-BAC-12',  'Tocineta Ahumada (tira)', 'Tira de tocineta crocante',              2, 'UND',  0.45, 0.90, 20, 120, 0, 1, DATE_ADD(CURDATE(), INTERVAL 8 DAY)),
  ('QUE-LAM-13',  'Queso Amarillo (lamina)', 'Lamina de queso semi duro',              5, 'UND',  0.30, 0.65, 40, 300, 0, 1, DATE_ADD(CURDATE(), INTERVAL 6 DAY)),
  ('JAM-PIA-14',  'Jamon de Pierna (lamina)','Lamina de jamon',                        5, 'UND',  0.35, 0.75, 30, 200, 0, 1, DATE_ADD(CURDATE(), INTERVAL 6 DAY)),
  ('LEC-HOJ-15',  'Lechuga (hoja)',          'Hoja de lechuga lavada',                 6, 'UND',  0.10, 0.25, 40, 300, 0, 1, DATE_ADD(CURDATE(), INTERVAL 2 DAY)),
  ('TOM-RDJ-16',  'Tomate (rodaja)',         'Rodaja de tomate',                       6, 'UND',  0.08, 0.20, 40, 300, 0, 1, DATE_ADD(CURDATE(), INTERVAL 1 DAY)),
  ('CEB-RDJ-17',  'Cebolla (rodaja)',        'Rodaja de cebolla',                      6, 'UND',  0.06, 0.15, 40, 300, 0, 1, DATE_ADD(CURDATE(), INTERVAL 4 DAY)),
  ('PAP-POR-18',  'Papas Fritas (porcion)',  'Porcion de papas a la francesa',         3, 'POR',  0.50, 1.20, 25, 200, 0, 0, NULL),
  ('ARO-UND-19',  'Aros de Cebolla',         'Aro de cebolla empanizado (unidad)',     3, 'UND',  0.15, 0.35, 30, 200, 0, 0, NULL),
  ('TEQ-UND-20',  'Tequeños',                'Tequeño precocido (unidad)',             3, 'UND',  0.28, 0.60, 30, 250, 0, 1, DATE_ADD(CURDATE(), INTERVAL 15 DAY)),
  ('YUQ-POR-21',  'Yuquitas Fritas (porcion)','Porcion de yuca frita',                 3, 'POR',  0.55, 1.30, 20, 150, 0, 0, NULL),
  ('MAZ-POR-22',  'Rositas de Maiz (porcion)','Porcion de maiz tostado',               3, 'POR',  0.30, 0.80, 20, 150, 0, 0, NULL),
  ('VAS-ECO-23',  'Vasos Ecologicos (paq)',  'Paquete de vasos desechables',           7, 'PAQ',  1.00, 2.00, 10, 80,  0, 0, NULL),
  ('PAP-SER-24',  'Servilletas (paquete)',   'Paquete de servilletas',                 7, 'PAQ',  0.80, 1.50, 10, 80,  0, 0, NULL);

-- Stock inicial: producto_id, almacen_id, cantidad
-- Despensa (1) tiene TODO: es el almacen desde donde vende la caja,
-- por eso todos los ingredientes de los combos deben estar aqui.
-- Barra (2) y Refrigeracion (3) son bodegas auxiliares para la grafica.
INSERT INTO `stock` (`producto_id`, `almacen_id`, `cantidad`) VALUES
  (1,  1, 70),  (1, 2, 40),
  (2,  1, 60),  (2, 2, 30),
  (3,  1, 80),  (3, 3, 60),
  (4,  1, 60),  (4, 2, 30),
  (5,  1, 80),  (5, 2, 20),
  (6,  1, 120), (6, 2, 40),
  (7,  1, 80), (7, 2, 30),
  (8,  1, 70), (8, 3, 50),
  (9,  1, 50), (9, 3, 30),
  (10, 1, 70), (10, 3, 50),
  (11, 1, 80), (11, 3, 60),
  (12, 1, 40), (12, 3, 30),
  (13, 1, 120), (13, 3, 80),
  (14, 1, 70), (14, 3, 50),
  (15, 1, 60), (15, 3, 45),
  (16, 1, 90), (16, 3, 60),
  (17, 1, 90), (17, 3, 60),
  (18, 1, 60), (18, 2, 25),
  (19, 1, 80), (19, 2, 40),
  (20, 1, 80), (20, 2, 40),
  (21, 1, 60), (21, 2, 30),
  (22, 1, 60), (22, 2, 30),
  (23, 1, 50), (23, 2, 30),
  (24, 1, 50), (24, 2, 30);

-- Movimientos de apertura (cuadra la bitacora con el stock inicial)
INSERT INTO `movimientos`
  (`tipo`, `producto_id`, `almacen_id`, `cantidad`, `stock_anterior`, `stock_nuevo`, `costo_unitario`, `referencia`, `notas`, `usuario_id`)
SELECT 'entrada', s.producto_id, s.almacen_id, s.cantidad, 0, s.cantidad, p.precio_compra,
       'APERTURA', 'Carga inicial del sistema', 1
FROM `stock` s
INNER JOIN `productos` p ON p.id = s.producto_id;

-- ----------------------------------------------------------------------
-- COMBOS  --  El menu de la cafeteria
-- ----------------------------------------------------------------------

INSERT INTO `combos` (`id`, `codigo`, `nombre`, `descripcion`, `tipo`, `precio_venta`, `requiere_cocina`) VALUES
  (1,  'HMB-001', 'Hamburguesa Clasica',    'Pan, carne 120g, doble queso, lechuga, tomate y cebolla', 'comida', 4.50, 1),
  (2,  'HMB-002', 'Hamburguesa Doble Queso','Pan, doble carne, triple queso, lechuga y tomate',       'comida', 6.00, 1),
  (3,  'PER-001', 'Perro Caliente Especial','Pan, salchicha ranchera, queso, cebolla y papas',        'comida', 3.50, 1),
  (4,  'NUG-001', 'Nuggets con Papas',      'Seis nuggets con porcion de papas',                       'comida', 4.00, 1),
  (5,  'SAN-001', 'Sandwich de Pollo',      'Pechuga grillada, queso, lechuga y tomate',               'comida', 4.80, 1),
  (6,  'TEQ-001', 'Tequeños (6 unidades)',  'Seis tequeños dorados',                                   'snack',  2.80, 1),
  (7,  'YUQ-001', 'Yuquitas Fritas',        'Porcion de yuca frita',                                   'snack',  2.50, 1),
  (8,  'ARO-001', 'Aros de Cebolla',        'Ocho aros de cebolla empanizados',                       'snack',  2.60, 1),
  (9,  'MAZ-001', 'Rositas de Maiz',        'Porcion de maiz tostado',                                 'snack',  2.20, 0),
  (10, 'JGO-001', 'Jugo de Naranja Natural','Jugo natural 400 ml',                                     'bebida', 2.00, 0),
  (11, 'JGO-002', 'Jugo de Fresa',          'Jugo de fresa 400 ml',                                    'bebida', 2.20, 0),
  (12, 'CAF-001', 'Cafe con Leche',         'Cafe con leche y azucar',                                 'bebida', 1.80, 0);

-- Recetas base (combo_id, producto_id, cantidad). En unidades de porcion.
INSERT INTO `combo_productos` (`combo_id`, `producto_id`, `cantidad`) VALUES
  (1,  6, 1),  (1,  8, 1),  (1, 13, 2), (1, 15, 1), (1, 16, 1), (1, 17, 1),
  (2,  6, 1),  (2,  8, 2),  (2, 13, 3), (2, 15, 1), (2, 16, 1),
  (3,  7, 1),  (3, 10, 1), (3, 13, 1), (3, 17, 1), (3, 18, 1),
  (4, 11, 6),  (4, 18, 1),
  (5,  6, 1),  (5,  9, 1),  (5, 13, 1), (5, 15, 1), (5, 16, 1),
  (6, 20, 6),
  (7, 21, 1),
  (8, 19, 8),
  (9, 22, 1),
  (10, 1, 1),
  (11, 2, 1),
  (12, 4, 1),  (12, 3, 1),  (12, 5, 1);

-- Ingredientes extra: "agregar X (+Y)" al personalizar
INSERT INTO `combo_opcionales` (`combo_id`, `producto_id`, `cantidad`, `precio_extra`) VALUES
  (1, 12, 1, 0.75),  -- tocineta extra
  (1, 13, 1, 0.35),  -- queso extra
  (1, 14, 1, 0.40),  -- jamon extra
  (2, 12, 1, 0.75),
  (2, 13, 1, 0.35),
  (3, 12, 1, 0.50),
  (3, 14, 1, 0.40),
  (3, 13, 1, 0.35),
  (4, 13, 1, 0.35),
  (5, 12, 1, 0.75),
  (5, 14, 1, 0.40);

SET FOREIGN_KEY_CHECKS = 1;

-- ======================================================================
--  USUARIOS INICIALES
--
--  Tres cuentas separadas, una por trabajo. El administrador entra a todo
--  (Resumen, Caja, Cocina y los modulos de control); el cajero solo cobra
--  y el de cocina solo prepara pedidos.
--
--    admin@inventario.com   Administrador   Admin123!
--    caja@inventario.com    Vendedor        Caja123!
--    cocina@inventario.com  Cocina          Cocina123!
--
--  >>> CAMBIA LAS TRES CLAVES DESPUES DEL PRIMER INGRESO <<<
--  (menu Usuarios -> editar la cuenta -> nueva contrasena)
-- ======================================================================

INSERT INTO `usuarios` (`nombre`, `email`, `password_hash`, `rol_id`, `telefono`, `activo`) VALUES
  ('Administrador', 'admin@inventario.com', '$2y$10$qgIY.TJ8Pf23bKZklIqZf.jnHtxhhd4tM/m7bmH8dtoonls8zX0C6', 1, NULL, 1),
  ('Caja',          'caja@inventario.com',  '$2y$10$LiBcewgL69TjyTarQyTare9.nDsMg6340qCOS5NuOm.9m2b01PGXK', 5, NULL, 1),
  ('Cocina',        'cocina@inventario.com','$2y$10$6y0YEqP64F.CXpWGz9TZGeskWr7V5cIOS9Aj1Rt942RbdCdhqt.lm', 6, NULL, 1);

-- Datos de ventas de ejemplo (opcional):  php api/semilla_ventas.php
-- Ver manual: MANUEL_INSTALACION.md