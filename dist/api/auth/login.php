<?php
/**
 * POST /api/auth/login
 * -----------------------------------------------------------------
 * Inicia sesion.
 *   Body: { "email": "...", "password": "..." }
 *   Devuelve: los datos del usuario + su rol y permisos
 */

require_once __DIR__ . '/../nucleo.php';

$email = trim((string) entrada('email', ''));
$password = (string) entrada('password', '');

if ($email === '' || $password === '') {
    error(400, 'El correo y la contrasena son obligatorios');
}

$fila = consultar_uno(
    'SELECT u.id, u.nombre, u.email, u.password_hash, u.activo, u.telefono,
            r.nombre AS rol, r.permisos
     FROM usuarios u
     INNER JOIN roles r ON r.id = u.rol_id
     WHERE u.email = ? LIMIT 1',
    [$email]
);

// Mensaje generico a proposito: no revelamos si el correo existe o no.
if (!$fila) {
    error(401, 'Correo o contrasena incorrectos');
}

if (!password_verify($password, $fila['password_hash'])) {
    // Si el hash necesita rehash (PHP actualizó el algoritmo), lo arreglamos
    if (password_needs_rehash($fila['password_hash'], PASSWORD_DEFAULT)) {
        ejecutar('UPDATE usuarios SET password_hash = ? WHERE id = ?', [
            password_hash($password, PASSWORD_DEFAULT),
            $fila['id'],
        ]);
    }
    error(401, 'Correo o contrasena incorrectos');
}

if (!$fila['activo']) {
    error(403, 'Tu cuenta esta desactivada. Contacta al administrador.');
}

// Sesion iniciada
iniciar_sesion();
session_regenerate_id(true); // Proteccion contra fijacion de sesion
$_SESSION['usuario_id'] = $fila['id'];
$_SESSION['ultima_actividad'] = time();

ejecutar('UPDATE usuarios SET ultimo_acceso = NOW() WHERE id = ?', [$fila['id']]);
auditar('login', 'usuarios', $fila['id']);

responder(200, [
    'id'       => (int) $fila['id'],
    'nombre'   => $fila['nombre'],
    'email'    => $fila['email'],
    'telefono' => $fila['telefono'],
    'rol'      => $fila['rol'],
    'permisos' => (int) $fila['permisos'],
]);
