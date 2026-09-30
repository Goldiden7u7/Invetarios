<?php
/**
 * CONFIGURACION DE LA BASE DE DATOS
 * ==================================================================
 * Este archivo NO contiene contrasenas reales: todo se puede
 * sobrescribir con variables de entorno, y si no existen se usan
 * los valores locales de XAMPP.
 *
 * POR QUE ESTE ARCHIVO SE SUBE A GITHUB
 * -------------------------------------
 * Este es el unico punto de entrada a la base de datos de toda la
 * aplicacion. Si no se subiera, quien clone el proyecto no tendria
 * con que conectarse y la API no arrancaria. Al no haber ningun
 * dato sensible aqui, es seguro publicarlo.
 *
 * EN UN HOSTING REAL (cPanel)
 * ---------------------------
 * Opcion A (recomendada): define las variables de entorno en el
 * panel de tu hosting (cPanel -> "Variables de entorno" o en el
 * php.ini) y no toques este archivo.
 *
 * Opcion B: edita las constantes de abajo con los datos de tu
 * cPanel. Recuerda NO volver a subirlos a GitHub.
 *
 * Opcion C: crea un archivo `api/config.local.php` con tus datos
 * reales (ese archivo SI esta en .gitignore) y descomenta la
 * linea de abajo. Tiene prioridad sobre todo lo demas.
 */

// ----------------------------------------------------------------------
//  0) CONFIGURACION LOCAL (opcional, la mas comoda para no tocar el repo)
// ----------------------------------------------------------------------
// Copia este archivo como `api/config.local.php`, rellena tus datos y
// descomenta la siguiente linea. Ese archivo NUNCA se sube a GitHub.
if (file_exists(__DIR__ . '/config.local.php')) {
    require_once __DIR__ . '/config.local.php';
}

// ----------------------------------------------------------------------
//  1) DATOS DE CONEXION
// ----------------------------------------------------------------------
// Orden de prioridad:
//   1) Variable de entorno (DB_HOST, DB_USER, DB_PASS, DB_NAME)
//   2) Constante ya definida (por ejemplo, desde config.local.php)
//   3) Valor local de XAMPP (el de abajo)

/**
 * Devuelve el valor de una variable de entorno, o el de reserva si no existe.
 *
 * @param string $nombre   Nombre de la variable de entorno
 * @param string $respalda Valor a usar cuando no hay variable definida
 */
function config_valor(string $nombre, string $respalda): string
{
    $entorno = getenv($nombre);
    if ($entorno !== false && $entorno !== '') {
        return $entorno;
    }

    return $respalda;
}

if (!defined('DB_HOST')) {
    define('DB_HOST', config_valor('DB_HOST', 'localhost'));
}
if (!defined('DB_USER')) {
    define('DB_USER', config_valor('DB_USER', 'root'));
}
if (!defined('DB_PASS')) {
    define('DB_PASS', config_valor('DB_PASS', ''));
}
if (!defined('DB_NAME')) {
    define('DB_NAME', config_valor('DB_NAME', 'inventario_db'));
}

// ----------------------------------------------------------------------
//  2) CONFIGURACION GENERAL  (normalmente no la toques)
// ----------------------------------------------------------------------

// Zona horaria: define que horas se registran en los movimientos de stock.
if (!defined('ZONA_HORARIA')) {
    define('ZONA_HORARIA', config_valor('ZONA_HORARIA', 'America/Caracas'));
}
date_default_timezone_set(ZONA_HORARIA);

// MODO_DEBUG muestra los errores de PHP en pantalla.
// Ponlo en 0 antes de publicar en un hosting real.
if (!defined('MODO_DEBUG')) {
    define('MODO_DEBUG', (int) config_valor('MODO_DEBUG', '0'));
}

// Orígenes permitidos para CORS (la app React).
// While '*' te deja trabajar desde cualquier lado. En produccion pon tu
// dominio, por ejemplo: 'https://tudominio.com,https://www.tudominio.com'
if (!defined('CORS_ORIGENES')) {
    define('CORS_ORIGENES', config_valor('CORS_ORIGENES', '*'));
}

// Duración de la sesión en segundos (8 horas).
if (!defined('SESSION_DURACION')) {
    define('SESSION_DURACION', 8 * 60 * 60);
}
