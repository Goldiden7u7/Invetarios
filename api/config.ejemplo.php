<?php
/**
 * PLANTILLA DE CONFIGURACION - COPIA ESTE ARCHIVO
 * -----------------------------------------------------------------
 * Esta es una PLANTILLA. No contiene datos reales y se puede subir
 * a GitHub sin riesgo.
 *
 * COMO USARLA:
 *   1) Copia este archivo como `config.php` DENTRO de la carpeta `api/`.
 *        En Windows: click derecho > Copiar > Pegar > renombrar a "config.php"
 *   2) Edita `config.php` con los datos REALES de tu hosting.
 *   3) NO vuelvas a subir `config.php` a GitHub (ya esta en .gitignore).
 *
 *asi cada persona del equipo configura su propio acceso a la base de datos
 * sin que las contrasenas queden en el repositorio.
 */

// ----------------------------------------------------------------------
//  DATOS DEL HOSTING  -->  EDITA SOLO ESTA SECCION
// ----------------------------------------------------------------------

define('DB_HOST', 'localhost');
define('DB_USER', 'TU_USUARIO_MYSQL');
define('DB_PASS', 'TU_CONTRASENA_MYSQL');
define('DB_NAME', 'TU_BASE_DE_DATOS');

// ----------------------------------------------------------------------
//  CONFIGURACION GENERAL  (normalmente no la toques)
// ----------------------------------------------------------------------

// Zona horaria (importante para que las fechas de movimientos sean correctas)
date_default_timezone_set('America/Caracas');

// Mostrar errores solo en desarrollo. En produccion dejalo en 0.
define('MODO_DEBUG', 0);

// Origenes permitidos para el CORS (la app React).
// Dejavalo en '*' mientras pruebas. Luego pon el dominio de tu app, ej:
//   'https://tudominio.com,https://www.tudominio.com'
define('CORS_ORIGENES', '*');

// Duracion de la sesion en segundos (8 horas)
define('SESSION_DURACION', 8 * 60 * 60);
