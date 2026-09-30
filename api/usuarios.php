<?php
/**
 * API DE USUARIOS
 * -----------------------------------------------------------------
 * GET    /api/usuarios.php          -> lista (requiere permiso 'usuarios')
 * POST   /api/usuarios.php          -> crear
 * PUT    /api/usuarios.php          -> editar
 * DELETE /api/usuarios.php          -> desactivar
 *
 * Las contrasenas SIEMPRE se guardan cifradas con bcrypt.
 * Nunca se devuelve una contrasena ni un hash por la API.
 */

require_once __DIR__ . '/nucleo.php';

$metodo = $_SERVER['REQUEST_METHOD'];

switch ($metodo) {
    case 'GET':    listarUsuarios();   break;
    case 'POST':   crearUsuario();    break;
    case 'PUT':    editarUsuario();    break;
    case 'DELETE': desactivarUsuario(); break;
    default: error(405, 'Metodo no permitido');
}

// ----------------------------------------------------------------------

function listarUsuarios()
{
    exigir_permiso(32, 'ver usuarios');

    $filas = consultar(
        'SELECT u.id, u.nombre, u.email, u.telefono, u.activo, u.ultimo_acceso, u.creado_en,
                r.nombre AS rol, r.permisos,
                (SELECT COUNT(*) FROM movimientos m WHERE m.usuario_id = u.id) AS movimientos
         FROM usuarios u
         INNER JOIN roles r ON r.id = u.rol_id
         ORDER BY u.activo DESC, u.nombre'
    );

    foreach ($filas as &$f) {
        $f['id'] = (int) $f['id'];
        $f['activo'] = (int) $f['activo'];
        $f['permisos'] = (int) $f['permisos'];
        $f['movimientos'] = (int) $f['movimientos'];
    }

    $roles = consultar('SELECT id, nombre, descripcion, permisos FROM roles WHERE activo = 1 ORDER BY nombre');
    foreach ($roles as &$r) {
        $r['id'] = (int) $r['id'];
        $r['permisos'] = (int) $r['permisos'];
    }

    responder(200, ['usuarios' => $filas, 'roles' => $roles]);
}

// ----------------------------------------------------------------------

function crearUsuario()
{
    exigir_permiso(32, 'crear usuarios');

    $nombre  = trim((string) entrada('nombre', ''));
    $email   = trim((string) entrada('email', ''));
    $clave   = (string) entrada('password', '');
    $rol_id  = entero(entrada('rol_id'));

    if ($nombre === '') error(400, 'El nombre es obligatorio');
    if ($email === '') error(400, 'El correo es obligatorio');
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) error(400, 'El correo no tiene un formato valido');
    if ($rol_id <= 0) error(400, 'Debes indicar el rol del usuario');

    // Reglas minimas de contrasena
    if (strlen($clave) < 8) error(400, 'La contrasena debe tener al menos 8 caracteres');
    if (!preg_match('/[A-Za-z]/', $clave) || !preg_match('/[0-9]/', $clave)) {
        error(400, 'La contrasena debe combinar letras y numeros');
    }

    $existe = consultar_uno('SELECT id FROM usuarios WHERE email = ?', [$email]);
    if ($existe) error(409, 'Ya existe un usuario con ese correo');

    // Traemos el nombre del rol porque se audita mas abajo.
    $rol = consultar_uno('SELECT id, nombre FROM roles WHERE id = ? AND activo = 1', [$rol_id]);
    if (!$rol) error(400, 'El rol indicado no existe o esta inactivo');

    $id = ejecutar(
        'INSERT INTO usuarios (nombre, email, password_hash, rol_id, telefono, activo)
         VALUES (?,?,?,?,?,1)',
        [$nombre, $email, password_hash($clave, PASSWORD_DEFAULT), $rol_id,
         trim((string) entrada('telefono', '')) ?: null]
    );

    auditar('crear', 'usuarios', $id, null, ['nombre' => $nombre, 'email' => $email, 'rol' => $rol['nombre']]);
    responder(201, ['id' => $id, 'mensaje' => 'Usuario creado']);
}

// ----------------------------------------------------------------------

function editarUsuario()
{
    $usuario_actual = exigir_permiso(32, 'editar usuarios');

    $id = entero(entrada('id'));
    if ($id <= 0) error(400, 'Falta el id del usuario');

    $anterior = consultar_uno(
        'SELECT u.id, u.nombre, u.email, u.rol_id, u.activo, r.nombre AS rol
         FROM usuarios u INNER JOIN roles r ON r.id = u.rol_id
         WHERE u.id = ?',
        [$id]
    );
    if (!$anterior) error(404, 'Usuario no encontrado');

    $nombre = trim((string) entrada('nombre'));
    $email  = trim((string) entrada('email'));
    $rol_id = entero(entrada('rol_id'));
    $telefono = trim((string) entrada('telefono', '')) ?: null;
    $activo  = entrada('activo', 1);
    $activo  = ($activo === 0 || $activo === '0' || $activo === false) ? 0 : 1;

    if ($nombre === '') error(400, 'El nombre es obligatorio');
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) error(400, 'El correo no tiene un formato valido');

    $repetido = consultar_uno('SELECT id FROM usuarios WHERE email = ? AND id <> ?', [$email, $id]);
    if ($repetido) error(409, 'Ya existe otro usuario con ese correo');

    $rol = consultar_uno('SELECT id, nombre FROM roles WHERE id = ? AND activo = 1', [$rol_id]);
    if (!$rol) error(400, 'El rol indicado no existe o esta inactivo');

    // --- Reglas de seguridad para no dejar el sistema sin admins ---
    $es_admin_actual = ((int) $usuario_actual['permisos'] & 32) === 32;

    if ($anterior['rol'] === 'Administrador' && ($rol['nombre'] !== 'Administrador' || !$activo)) {
        // Hay que verificar que quede al menos un admin activo
        $otros_admins = consultar_uno(
            "SELECT COUNT(*) AS n FROM usuarios
             INNER JOIN roles r ON r.id = usuarios.rol_id
             WHERE r.nombre = 'Administrador' AND usuarios.activo = 1 AND usuarios.id <> ?",
            [$id]
        );
        if ((int) $otros_admins['n'] === 0) {
            error(400, 'No puedes quitar el rol de administrador al unico administrador activo del sistema');
        }
    }

    ejecutar(
        'UPDATE usuarios SET nombre=?, email=?, rol_id=?, telefono=?, activo=? WHERE id=?',
        [$nombre, $email, $rol_id, $telefono, $activo, $id]
    );

    // Cambio de contrasena (opcional, solo si viene en blanco no se toca)
    $clave = (string) entrada('password', '');
    if ($clave !== '') {
        if (strlen($clave) < 8) error(400, 'La contrasena debe tener al menos 8 caracteres');
        if (!preg_match('/[A-Za-z]/', $clave) || !preg_match('/[0-9]/', $clave)) {
            error(400, 'La contrasena debe combinar letras y numeros');
        }
        ejecutar('UPDATE usuarios SET password_hash = ? WHERE id = ?', [
            password_hash($clave, PASSWORD_DEFAULT), $id,
        ]);
    }

    auditar('editar', 'usuarios', $id, $anterior, ['nombre' => $nombre, 'email' => $email, 'rol' => $rol['nombre']]);
    responder(200, ['id' => $id, 'mensaje' => 'Usuario actualizado']);
}

// ----------------------------------------------------------------------

function desactivarUsuario()
{
    $usuario_actual = exigir_permiso(32, 'eliminar usuarios');

    $id = entero(entrada('id'));
    if ($id <= 0) error(400, 'Falta el id del usuario');

    if ($id === (int) $usuario_actual['id']) {
        error(400, 'No puedes desactivar tu propia cuenta');
    }

    $objetivo = consultar_uno(
        'SELECT u.id, u.nombre, r.nombre AS rol
         FROM usuarios u INNER JOIN roles r ON r.id = u.rol_id
         WHERE u.id = ?',
        [$id]
    );
    if (!$objetivo) error(404, 'Usuario no encontrado');

    // No dejar el sistema sin administradores
    if ($objetivo['rol'] === 'Administrador') {
        $otros = consultar_uno(
            "SELECT COUNT(*) AS n FROM usuarios
             INNER JOIN roles r ON r.id = usuarios.rol_id
             WHERE r.nombre = 'Administrador' AND usuarios.activo = 1 AND usuarios.id <> ?",
            [$id]
        );
        if ((int) $otros['n'] === 0) {
            error(400, 'No puedes desactivar al unico administrador activo del sistema');
        }
    }

    ejecutar('UPDATE usuarios SET activo = 0 WHERE id = ?', [$id]);
    auditar('eliminar', 'usuarios', $id, $objetivo, ['desactivado' => true]);

    responder(200, ['mensaje' => 'Usuario desactivado. Ya no puede entrar al sistema.']);
}
