<?php
/**
 * GET /api/auth/yo
 * -----------------------------------------------------------------
 * Devuelve el usuario de la sesion actual.
 * La app lo llama al arrancar para saber si ya hay sesion guardada.
 *   Devuelve 200 con { "usuario": null } si no hay sesion.
 */

require_once __DIR__ . '/../nucleo.php';

$usuario = usuario_actual();

if (!$usuario) {
    responder(200, ['usuario' => null]);
}

responder(200, [
    'usuario' => [
        'id'       => (int) $usuario['id'],
        'nombre'   => $usuario['nombre'],
        'email'    => $usuario['email'],
        'rol'      => $usuario['rol'],
        'permisos' => (int) $usuario['permisos'],
    ],
]);
