<?php
/**
 * NUCLEO DEL API
 * -----------------------------------------------------------------
 * Funciones de base que usan todos los endpoints:
 *   - Conexion a la base de datos
 *   - Respuestas JSON
 *   - CORS
 *   - Verificacion de sesion y permisos
 *   - Registro de auditoria
 *
 * No llames este archivo directamente desde el navegador.
 */

require_once __DIR__ . '/config.php';

// ----------------------------------------------------------------------
//  POLITICA DE ERRORES
// ----------------------------------------------------------------------
//  Un API debe responder SIEMPRE JSON valido. Si PHP imprime un warning
//  dentro del cuerpo (por ejemplo "<br />Warning: Undefined array key"),
//  el fetch() del navegador y el json_decode() de PHP fallan por completo.
//
//  Con display_errors apagado los avisos van al log del servidor y la
//  respuesta sigue siendo JSON parseable, pero no se oculta ningun error
//  fatal. MODO_DEBUG solo controla si el detalle se incluye en la respuesta.

ini_set('display_errors', '0');
ini_set('log_errors', '1');
error_reporting(E_ALL);

// ----------------------------------------------------------------------
//  BASE DE DATOS
// ----------------------------------------------------------------------

/** Conexion mysqli reutilizable. */
function bd()
{
    static $conexion = null;

    if ($conexion === null) {
        // Silence deprecation de mysqli_init en PHP 8.1+ se maneja con new mysqli
        $conexion = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);

        if ($conexion->connect_errno) {
            error_log('Error de conexion MySQL: ' . $conexion->connect_error);
            responder(500, 'No se pudo conectar con la base de datos');
        }

        $conexion->set_charset('utf8mb4');
    }

    return $conexion;
}

// ----------------------------------------------------------------------
//  RESPUESTAS JSON
// ----------------------------------------------------------------------

/** Envia JSON y termina la ejecucion. */
function responder($codigo, $datos = null, $error = null)
{
    http_response_code($codigo);
    header('Content-Type: application/json; charset=utf-8');

    $respuesta = ['ok' => $codigo >= 200 && $codigo < 300];

    if ($error !== null) {
        $respuesta['error'] = $error;
    }
    if ($datos !== null) {
        $respuesta['datos'] = $datos;
    }

    // En desarrollo incluimos el detalle del error
    if (MODO_DEBUG && isset($respuesta['error']) && $error instanceof Exception) {
        $respuesta['detalle'] = $error->getMessage();
    }

    echo json_encode($respuesta, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

/** Atajo para errores. */
function error($codigo, $mensaje)
{
    responder($codigo, null, $mensaje);
}

// ----------------------------------------------------------------------
//  CORS  (para que la app React pueda llamar a este API)
// ----------------------------------------------------------------------

header('Access-Control-Allow-Origin: ' . CORS_ORIGENES);
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Access-Control-Max-Age: 86400');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// ----------------------------------------------------------------------
//  PETICIONES
// ----------------------------------------------------------------------

/** Lee el cuerpo JSON de la peticion. */
function cuerpo()
{
    $datos = json_decode(file_get_contents('php://input'), true);
    return is_array($datos) ? $datos : [];
}

/** Valor de un campo del cuerpo o del query string. */
function entrada($campo, $defecto = null)
{
    $cuerpo = cuerpo();
    if (array_key_exists($campo, $cuerpo)) {
        return $cuerpo[$campo];
    }
    if (array_key_exists($campo, $_GET)) {
        return $_GET[$campo];
    }
    return $defecto;
}

/** Entero seguro. */
function entero($valor, $defecto = 0)
{
    return is_numeric($valor) ? (int) $valor : $defecto;
}

/** Decimal seguro. */
function decimal($valor, $defecto = 0.0)
{
    return is_numeric($valor) ? (float) $valor : $defecto;
}

// ----------------------------------------------------------------------
//  SESION Y PERMISOS
// ----------------------------------------------------------------------

/**
 * Inicia la sesion si no esta iniciada.
 * La app envia el token en la cabecera Authorization: Bearer <token>
 */
function iniciar_sesion()
{
    // En CLI (scripts de datos demo) no hay navegador ni cookies.
    if (PHP_SAPI === 'cli') {
        return;
    }

    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    session_set_cookie_params([
        'lifetime' => SESSION_DURACION,
        'path'     => '/',
        'httponly' => true,
        'samesite' => 'Lax',
        'secure'   => !empty($_SERVER['HTTPS']),
    ]);
    session_start();
}

/** Devuelve el usuario autenticado, o null si no hay sesion valida. */
function usuario_actual()
{
    iniciar_sesion();

    if (empty($_SESSION['usuario_id'])) {
        return null;
    }

    // Verificamos que el usuario siga existiendo y activo en la base.
    // Si un admin lo desactiva, su sesion muere en la siguiente llamada.
    $fila = consultar_uno(
        'SELECT u.id, u.nombre, u.email, u.activo, r.nombre AS rol, r.permisos
         FROM usuarios u
         INNER JOIN roles r ON r.id = u.rol_id
         WHERE u.id = ? LIMIT 1',
        [$_SESSION['usuario_id']]
    );

    if (!$fila || !$fila['activo']) {
        destruir_sesion();
        return null;
    }

    // Renovacion: si ya paso la mitad del tiempo, alargamos la sesion
    if (!isset($_SESSION['ultima_actividad'])
        || time() - $_SESSION['ultima_actividad'] > SESSION_DURACION / 2) {
        $_SESSION['ultima_actividad'] = time();
    }

    $fila['id'] = (int) $fila['id'];
    $fila['activo'] = (int) $fila['activo'];
    $fila['permisos'] = (int) $fila['permisos'];

    return $fila;
}

/** Exige sesion activa. Termina con 401 si no la hay. */
function exigir_sesion()
{
    $usuario = usuario_actual();
    if (!$usuario) {
        error(401, 'Sesion no valida o expirada');
    }
    return $usuario;
}

/**
 * Exige un permiso especifico.
 * Los permisos son flags de bits, asi que se pueden exigir varios a la vez
 * pasando el resultado de un "or": exigir_permiso(2 | 256, 'cobrar').
 *
 *   ver=1, crear=2, editar=4, eliminar=8, movimientos=16, usuarios=32,
 *   config=64
 *
 * Los tres ultimos bits no dicen QUE haces, sino DONDE te dejan entrar:
 *
 *   ventas=128  ver el Resumen con las cifras y el historial de ventas
 *   caja=256    abrir la Caja y registrar ventas
 *   cocina=512  abrir la pantalla de Cocina y mover pedidos
 */
function exigir_permiso($bit, $nombre)
{
    $usuario = exigir_sesion();

    if (!(($usuario['permisos'] & $bit) === $bit)) {
        error(403, 'No tienes permiso para: ' . $nombre);
    }
    return $usuario;
}

/** Cierra la sesion del usuario. */
function destruir_sesion()
{
    iniciar_sesion();
    $_SESSION = [];
    session_destroy();
}

// ----------------------------------------------------------------------
//  CONSULTAS SQL
// ----------------------------------------------------------------------

/** Ejecuta una consulta con parametros. Devuelve el resultado. */
function consultar($sql, $parametros = [])
{
    $sentencia = bd()->prepare($sql);

    if (!empty($parametros)) {
        $tipos = '';
        foreach ($parametros as $p) {
            $tipos .= is_int($p) ? 'i' : (is_float($p) ? 'd' : 's');
        }
        $sentencia->bind_param($tipos, ...$parametros);
    }

    $sentencia->execute();
    $resultado = $sentencia->get_result();
    $filas = $resultado ? $resultado->fetch_all(MYSQLI_ASSOC) : [];
    $sentencia->close();

    return $filas;
}

/** Igual que consultar() pero devuelve solo la primera fila. */
function consultar_uno($sql, $parametros = [])
{
    $filas = consultar($sql, $parametros);
    return $filas ? $filas[0] : null;
}

/** Ejecuta INSERT/UPDATE/DELETE. Devuelve el id insertado o filas afectadas. */
function ejecutar($sql, $parametros = [])
{
    $sentencia = bd()->prepare($sql);

    if (!empty($parametros)) {
        $tipos = '';
        foreach ($parametros as $p) {
            $tipos .= is_int($p) ? 'i' : (is_float($p) ? 'd' : 's');
        }
        $sentencia->bind_param($tipos, ...$parametros);
    }

    $sentencia->execute();
    $id = bd()->insert_id;
    $filas = $sentencia->affected_rows;
    $sentencia->close();

    return $id > 0 ? $id : $filas;
}

// ----------------------------------------------------------------------
//  AUDITORIA
// ----------------------------------------------------------------------

/** Deja rastro de una accion. Las fallas aqui NO deben romper la operacion. */
function auditar($accion, $tabla, $registro_id = null, $antes = null, $despues = null)
{
    try {
        iniciar_sesion();
        $usuario = $_SESSION['usuario_id'] ?? null;

        ejecutar(
            'INSERT INTO auditoria (usuario_id, accion, tabla, registro_id, datos_antes, datos_despues, ip)
             VALUES (?, ?, ?, ?, ?, ?, ?)',
            [
                $usuario,
                $accion,
                $tabla,
                $registro_id,
                $antes ? json_encode($antes, JSON_UNESCAPED_UNICODE) : null,
                $despues ? json_encode($despues, JSON_UNESCAPED_UNICODE) : null,
                $_SERVER['REMOTE_ADDR'] ?? null,
            ]
        );
    } catch (Exception $e) {
        // La auditoria es un plus, no un bloqueante.
        error_log('Auditoria fallo: ' . $e->getMessage());
    }
}

// ----------------------------------------------------------------------
//  UTILIDADES
// ----------------------------------------------------------------------

/** Escapa texto para mostrar (por si lo usas en HTML). */
function limpiar($texto)
{
    return htmlspecialchars((string) $texto, ENT_QUOTES, 'UTF-8');
}

/** Genera un codigo correlativo tipo TRF-00001 */
function generar_codigo($prefijo, $tabla, $columna)
{
    $ultimo = consultar_uno("SELECT `$columna` AS c FROM `$tabla` ORDER BY id DESC LIMIT 1");
    $numero = $ultimo ? (int) substr($ultimo['c'], strlen($prefijo) + 1) + 1 : 1;
    return $prefijo . '-' . str_pad((string) $numero, 5, '0', STR_PAD_LEFT);
}
