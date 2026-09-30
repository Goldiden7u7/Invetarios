<?php
/**
 * POST /api/auth/logout
 * -----------------------------------------------------------------
 * Cierra la sesion actual.
 */

require_once __DIR__ . '/../nucleo.php';

iniciar_sesion();

if (!empty($_SESSION['usuario_id'])) {
    auditar('logout', 'usuarios', $_SESSION['usuario_id']);
}

destruir_sesion();
responder(200, ['mensaje' => 'Sesion cerrada']);
