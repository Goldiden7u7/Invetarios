<?php
/**
 * API DE PEDIDOS (COCINA)
 * -----------------------------------------------------------------
 * GET  /api/pedidos.php?estado=pendiente,en_preparacion   -> lista de la cola
 * GET  /api/pedidos.php?id=5                              -> detalle
 * POST /api/pedidos.php  { id, estado }                   -> avanzar estado
 *
 * Estados: pendiente -> en_preparacion -> listo -> entregado
 *          pendiente -> cancelado
 *
 * Un pedido nace al registrar una venta con items que requieren cocina.
 * La cocina ve los items y los ingredientes que pidio el cliente (incluye
 * lo que pidio "sin" y los extra que agrego).
 *
 * Permisos: ver cola = 1; mover un pedido = 2. En ambos hace falta ademas
 *           el bit de modulo Cocina (512), para que solo quien trabaja en
 *           cocina vea la cola y la mueva.
 */

require_once __DIR__ . '/nucleo.php';

$metodo = $_SERVER['REQUEST_METHOD'];

switch ($metodo) {
    case 'GET':  listarPedidos();  break;
    case 'POST': cambiarEstado();  break;
    default:
        error(405, 'Metodo no permitido');
}

// ----------------------------------------------------------------------

function listarPedidos()
{
    exigir_permiso(1 | 512, 'ver la cola de cocina');

    $id = entero($_GET['id'] ?? 0);

    if ($id > 0) {
        $pedido = consultar_uno(
            'SELECT p.*, u.nombre AS usuario_nombre
             FROM pedidos p
             INNER JOIN ventas v ON v.id = p.venta_id
             INNER JOIN usuarios u ON u.id = v.usuario_id
             WHERE p.id = ? LIMIT 1',
            [$id]
        );
        if (!$pedido) {
            error(404, 'El pedido no existe');
        }
        $pedido['items'] = itemsDelPedido($pedido['venta_id']);
        $pedido['id'] = (int) $pedido['id'];
        responder(200, $pedido);
        return;
    }

    // Estados: por defecto toda la cola activa. Se puede filtrar con
    // estado=pendiente,en_preparacion (separados por coma).
    $estados = (string) ($_GET['estado'] ?? 'pendiente,en_preparacion,listo');
    $lista = array_values(array_filter(array_map('trim', explode(',', $estados))));

    $permitidos = ['pendiente', 'en_preparacion', 'listo', 'entregado', 'cancelado'];
    $donde = [];
    $params = [];
    foreach ($lista as $e) {
        if (in_array($e, $permitidos, true)) {
            $donde[] = 'p.estado = ?';
            $params[] = $e;
        }
    }
    $filtro = empty($donde) ? '' : 'WHERE ' . implode(' OR ', $donde);

    $filas = consultar(
        "SELECT p.id, p.codigo, p.venta_id, p.cliente_nombre, p.estado,
                p.notas, p.creado_en, p.actualizado_en,
                u.nombre AS usuario_nombre,
                (SELECT COUNT(*) FROM venta_items vi
                  WHERE vi.venta_id = p.venta_id AND vi.necesita_cocina = 1) AS n_items
         FROM pedidos p
         INNER JOIN ventas v ON v.id = p.venta_id
         INNER JOIN usuarios u ON u.id = v.usuario_id
         $filtro
         ORDER BY
            CASE p.estado
              WHEN 'pendiente' THEN 0
              WHEN 'en_preparacion' THEN 1
              WHEN 'listo' THEN 2
              ELSE 3
            END,
            p.creado_en ASC",
        $params
    );

    foreach ($filas as &$f) {
        $f['id'] = (int) $f['id'];
        $f['n_items'] = (int) $f['n_items'];
        $f['items'] = itemsDelPedido($f['venta_id']);
        $f['espera_minutos'] = max(0, (int) round((time() - strtotime($f['creado_en'])) / 60));
    }
    unset($f);

    responder(200, ['pedidos' => $filas]);
}

/** Items de cocina de una venta: los que requieren coccion, con su receta. */
function itemsDelPedido($venta_id)
{
    $items = consultar(
        'SELECT vi.id, vi.nombre, vi.cantidad, vi.ingredientes
         FROM venta_items vi
         WHERE vi.venta_id = ? AND vi.necesita_cocina = 1
         ORDER BY vi.id',
        [$venta_id]
    );

    foreach ($items as &$it) {
        $raw = json_decode((string) $it['ingredientes'], true) ?: [];
        $it['ingredientes'] = $raw['ingredientes'] ?? [];
        $it['quitados'] = $raw['quitados'] ?? [];
        $it['id'] = (int) $it['id'];
        $it['cantidad'] = (int) $it['cantidad'];
    }
    unset($it);

    return $items;
}

// ----------------------------------------------------------------------

function cambiarEstado()
{
    exigir_permiso(2 | 512, 'avanzar pedidos de cocina');

    $id = entero(entrada('id'));
    $nuevo = (string) entrada('estado', '');

    if ($id <= 0) error(400, 'Falta el id del pedido');

    $pedido = consultar_uno('SELECT * FROM pedidos WHERE id = ?', [$id]);
    if (!$pedido) {
        error(404, 'El pedido no existe');
    }

    $actual = $pedido['estado'];

    // Maquina de estados admitida
    $permitidos = [
        'pendiente'      => ['en_preparacion', 'cancelado'],
        'en_preparacion' => ['listo'],
        'listo'          => ['entregado'],
        'entregado'      => [],
        'cancelado'      => [],
    ];

    if (!in_array($nuevo, array_keys($permitidos), true)) {
        error(400, 'Estado de pedido no valido');
    }
    if (!in_array($nuevo, $permitidos[$actual], true)) {
        error(400, 'No se puede pasar el pedido de "' . $actual . '" a "' . $nuevo . '"');
    }

    ejecutar('UPDATE pedidos SET estado = ? WHERE id = ?', [$nuevo, $id]);

    auditar('editar', 'pedidos', $id, ['estado' => $actual], ['estado' => $nuevo]);

    responder(200, [
        'id' => $id,
        'codigo' => $pedido['codigo'],
        'estado' => $nuevo,
        'mensaje' => 'Pedido ' . $pedido['codigo'] . ' ahora esta "' . $nuevo . '"',
    ]);
}