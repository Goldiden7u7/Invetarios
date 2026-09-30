<?php
/**
 * API DE TRANSFERENCIAS ENTRE ALMACENES
 * -----------------------------------------------------------------
 * GET    /api/transferencias.php            -> lista
 * GET    /api/transferencias.php?id=1       -> detalle con movimientos
 * POST   /api/transferencias.php            -> crear y enviar
 *        Body: { producto_id, almacen_origen_id, almacen_destino_id, cantidad }
 * PUT    /api/transferencias.php            -> cambiar estado
 *        Body: { id, accion: 'enviar' | 'recibir' | 'cancelar' }
 *
 * FLUJO DE UNA TRANSFERENCIA:
 *
 *   1. CREAR  -> se genera el codigo, se DESCUENTA del origen y queda
 *                en estado 'en_transito'. El destino aun no lo tiene.
 *   2. ENVIAR -> (opcional) marca que salio fisicamente. Registra fecha.
 *   3. RECIBIR -> se SUMA al destino. Estado 'recibida'. Ahi el stock
 *                existe oficialmente en el destino.
 *   4. CANCELAR-> solo antes de recibir. Devuelve el stock al origen.
 *
 * Por que dos pasos y no uno: porque entre que el producto sale del almacen
 * central y llega al norte pasa tiempo. Durante ese tiempo el stock esta
 * "en la calle" y no debe aparecer en ninguno de los dos.
 */

require_once __DIR__ . '/nucleo.php';

$metodo = $_SERVER['REQUEST_METHOD'];

switch ($metodo) {
    case 'GET': listarTransferencias();      break;
    case 'POST': crearTransferencia();       break;
    case 'PUT':  cambiarEstado();            break;
    default: error(405, 'Metodo no permitido');
}

// ----------------------------------------------------------------------

function listarTransferencias()
{
    exigir_permiso(1, 'ver transferencias');

    $id = entero($_GET['id'] ?? 0);

    if ($id > 0) {
        $trf = consultar_uno(
            "SELECT t.*, p.codigo AS producto_codigo, p.nombre AS producto_nombre,
                    p.unidad_medida,
                    ao.nombre AS origen_nombre, ao.codigo AS origen_codigo,
                    ad.nombre AS destino_nombre, ad.codigo AS destino_codigo,
                    ue.nombre AS enviado_nombre, ur.nombre AS recibido_nombre
             FROM transferencias t
             INNER JOIN productos p ON p.id = t.producto_id
             INNER JOIN almacenes ao ON ao.id = t.almacen_origen_id
             INNER JOIN almacenes ad ON ad.id = t.almacen_destino_id
             LEFT JOIN usuarios ue ON ue.id = t.enviado_por
             LEFT JOIN usuarios ur ON ur.id = t.recibido_por
             WHERE t.id = ? LIMIT 1",
            [$id]
        );

        if (!$trf) error(404, 'Transferencia no encontrada');

        $trf['id'] = (int) $trf['id'];
        $trf['cantidad'] = (int) $trf['cantidad'];

        responder(200, $trf);
    }

    $estado = (string) ($_GET['estado'] ?? '');
    $almacen_id = entero($_GET['almacen_id'] ?? 0);

    $donde = [];
    $params = [];

    if (in_array($estado, ['pendiente', 'en_transito', 'recibida', 'cancelada'], true)) {
        $donde[] = 't.estado = ?';
        $params[] = $estado;
    }
    if ($almacen_id > 0) {
        $donde[] = '(t.almacen_origen_id = ? OR t.almacen_destino_id = ?)';
        array_push($params, $almacen_id, $almacen_id);
    }

    $filtro = empty($donde) ? '' : 'WHERE ' . implode(' AND ', $donde);

    $filas = consultar(
        "SELECT t.*, p.codigo AS producto_codigo, p.nombre AS producto_nombre,
                p.unidad_medida,
                ao.nombre AS origen_nombre, ao.codigo AS origen_codigo,
                ad.nombre AS destino_nombre, ad.codigo AS destino_codigo
         FROM transferencias t
         INNER JOIN productos p ON p.id = t.producto_id
         INNER JOIN almacenes ao ON ao.id = t.almacen_origen_id
         INNER JOIN almacenes ad ON ad.id = t.almacen_destino_id
         $filtro
         ORDER BY t.creado_en DESC, t.id DESC
         LIMIT 100",
        $params
    );

    foreach ($filas as &$f) {
        $f['id'] = (int) $f['id'];
        $f['cantidad'] = (int) $f['cantidad'];
        $f['producto_id'] = (int) $f['producto_id'];
    }

    responder(200, $filas);
}

// ----------------------------------------------------------------------

function crearTransferencia()
{
    $usuario = exigir_permiso(16, 'crear transferencias');

    $producto_id = entero(entrada('producto_id'));
    $origen_id   = entero(entrada('almacen_origen_id'));
    $destino_id  = entero(entrada('almacen_destino_id'));
    $cantidad    = entero(entrada('cantidad'));

    if ($producto_id <= 0) error(400, 'Falta el producto');
    if ($origen_id <= 0)  error(400, 'Falta el almacen de origen');
    if ($destino_id <= 0) error(400, 'Falta el almacen de destino');
    if ($cantidad <= 0)   error(400, 'La cantidad debe ser mayor que cero');

    if ($origen_id === $destino_id) {
        error(400, 'El almacen de origen y el de destino no pueden ser el mismo');
    }

    $producto = consultar_uno('SELECT * FROM productos WHERE id = ?', [$producto_id]);
    if (!$producto) error(404, 'El producto no existe');
    if (!$producto['activo']) error(400, 'El producto esta desactivado');

    $origen = consultar_uno('SELECT * FROM almacenes WHERE id = ?', [$origen_id]);
    if (!$origen || !$origen['activo']) error(400, 'El almacen de origen no existe o esta inactivo');

    $destino = consultar_uno('SELECT * FROM almacenes WHERE id = ?', [$destino_id]);
    if (!$destino || !$destino['activo']) error(400, 'El almacen de destino no existe o esta inactivo');

    $conexion = bd();
    $conexion->begin_transaction();

    try {
        $conexion->query("INSERT IGNORE INTO stock (producto_id, almacen_id, cantidad) VALUES ($producto_id, $origen_id, 0)");

        $stock = consultar_uno(
            'SELECT cantidad FROM stock WHERE producto_id = ? AND almacen_id = ? FOR UPDATE',
            [$producto_id, $origen_id]
        );
        $stock_actual = (int) $stock['cantidad'];

        if ($stock_actual < $cantidad) {
            $conexion->rollback();
            error(400, sprintf(
                'Stock insuficiente en %s. Disponible: %d %s, solicitaste: %d',
                $origen['nombre'], $stock_actual, $producto['unidad_medida'], $cantidad
            ));
        }

        $stock_nuevo = $stock_actual - $cantidad;

        // Codigo correlativo
        $ultimo = consultar_uno('SELECT codigo FROM transferencias ORDER BY id DESC LIMIT 1');
        $numero = $ultimo ? (int) substr($ultimo['codigo'], 4) + 1 : 1;
        $codigo = 'TRF-' . str_pad((string) $numero, 5, '0', STR_PAD_LEFT);

        $notas = trim((string) entrada('notas', '')) ?: null;

        $sentencia = $conexion->prepare(
            "INSERT INTO transferencias
             (codigo, producto_id, almacen_origen_id, almacen_destino_id, cantidad,
              estado, notas, enviado_por, fecha_envio)
             VALUES (?,?,?,?,?,'en_transito',?,?,NOW())"
        );
        $sentencia->bind_param(
            'siiiiis',
            $codigo, $producto_id, $origen_id, $destino_id, $cantidad, $notas, $usuario['id']
        );
        $sentencia->execute();
        $trf_id = $conexion->insert_id;
        $sentencia->close();

        // Movimiento de salida en el almacen origen.
        // bind_param exige variables, no expresiones: por eso la cantidad
        // con signo se calcula antes en su propia variable.
        $cantidad_salida = -$cantidad;
        $notas_salida = "Transferencia $codigo hacia " . $destino['nombre'];

        $sentencia = $conexion->prepare(
            "INSERT INTO movimientos
             (tipo, producto_id, almacen_id, cantidad, stock_anterior, stock_nuevo,
              costo_unitario, referencia, notas, usuario_id)
             VALUES ('transferencia', ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        );
        $sentencia->bind_param(
            'siiidssii',
            $producto_id, $origen_id, $cantidad_salida, $stock_actual, $stock_nuevo,
            $producto['precio_compra'], $codigo, $notas_salida, $usuario['id']
        );
        $sentencia->execute();
        $sentencia->close();

        // Descontamos del origen
        $sentencia = $conexion->prepare(
            'UPDATE stock SET cantidad = ?, ultima_salida = NOW()
             WHERE producto_id = ? AND almacen_id = ?'
        );
        $sentencia->bind_param('iii', $stock_nuevo, $producto_id, $origen_id);
        $sentencia->execute();
        $sentencia->close();

        $conexion->commit();

        auditar('transferir', 'transferencias', $trf_id, null, [
            'codigo' => $codigo,
            'producto' => $producto['nombre'],
            'origen' => $origen['nombre'],
            'destino' => $destino['nombre'],
            'cantidad' => $cantidad,
        ]);

        responder(201, [
            'id' => $trf_id,
            'codigo' => $codigo,
            'stock_origen' => $stock_nuevo,
            'mensaje' => sprintf(
                'Transferencia %s creada. Se descontaron %d %s de %s. Queda pendiente de recibir en %s.',
                $codigo, $cantidad, $producto['unidad_medida'], $origen['nombre'], $destino['nombre']
            ),
        ]);
    } catch (Exception $e) {
        $conexion->rollback();
        error_log('Error en transferencia: ' . $e->getMessage());
        error(500, 'No se pudo crear la transferencia. Se revirtieron todos los cambios.');
    }
}

// ----------------------------------------------------------------------

function cambiarEstado()
{
    $usuario = exigir_permiso(16, 'cambiar estado de transferencias');

    $id = entero(entrada('id'));
    $accion = (string) entrada('accion', '');

    if ($id <= 0) error(400, 'Falta el id de la transferencia');
    if (!in_array($accion, ['recibir', 'cancelar'], true)) {
        error(400, 'Accion no valida (use: recibir o cancelar)');
    }

    $trf = consultar_uno(
        "SELECT t.*, p.nombre AS producto_nombre, p.unidad_medida, p.precio_compra,
                ao.nombre AS origen_nombre, ad.nombre AS destino_nombre
         FROM transferencias t
         INNER JOIN productos p ON p.id = t.producto_id
         INNER JOIN almacenes ao ON ao.id = t.almacen_origen_id
         INNER JOIN almacenes ad ON ad.id = t.almacen_destino_id
         WHERE t.id = ? LIMIT 1",
        [$id]
    );

    if (!$trf) error(404, 'Transferencia no encontrada');

    if ($trf['estado'] === 'recibida') {
        error(400, 'Esta transferencia ya fue recibida, no se puede modificar');
    }
    if ($trf['estado'] === 'cancelada') {
        error(400, 'Esta transferencia fue cancelada, no se puede modificar');
    }

    $conexion = bd();
    $conexion->begin_transaction();

    try {
        $cantidad = (int) $trf['cantidad'];
        $producto_id = (int) $trf['producto_id'];
        $origen_id = (int) $trf['almacen_origen_id'];
        $destino_id = (int) $trf['almacen_destino_id'];

        if ($accion === 'recibir') {
            // El stock entra al destino
            $conexion->query("INSERT IGNORE INTO stock (producto_id, almacen_id, cantidad) VALUES ($producto_id, $destino_id, 0)");

            $stock_destino = consultar_uno(
                'SELECT cantidad FROM stock WHERE producto_id = ? AND almacen_id = ? FOR UPDATE',
                [$producto_id, $destino_id]
            );
            $anterior = (int) $stock_destino['cantidad'];
            $nuevo = $anterior + $cantidad;

            $sentencia = $conexion->prepare(
                "INSERT INTO movimientos
                 (tipo, producto_id, almacen_id, cantidad, stock_anterior, stock_nuevo,
                  costo_unitario, referencia, notas, usuario_id)
                 VALUES ('transferencia', ?, ?, ?, ?, ?, ?, ?, ?, ?)"
            );
            $notas_entrada = "Transferencia " . $trf['codigo'] . " desde " . $trf['origen_nombre'];
            $sentencia->bind_param(
                'siiidssii',
                $producto_id, $destino_id, $cantidad, $anterior, $nuevo,
                $trf['precio_compra'], $trf['codigo'], $notas_entrada, $usuario['id']
            );
            $sentencia->execute();
            $sentencia->close();

            $sentencia = $conexion->prepare(
                'UPDATE stock SET cantidad = ?, ultima_entrada = NOW()
                 WHERE producto_id = ? AND almacen_id = ?'
            );
            $sentencia->bind_param('iii', $nuevo, $producto_id, $destino_id);
            $sentencia->execute();
            $sentencia->close();

            $sentencia = $conexion->prepare(
                "UPDATE transferencias
                 SET estado = 'recibida', recibido_por = ?, fecha_recepcion = NOW()
                 WHERE id = ?"
            );
            $sentencia->bind_param('ii', $usuario['id'], $id);
            $sentencia->execute();
            $sentencia->close();

            $conexion->commit();

            auditar('transferir', 'transferencias', $id, ['estado' => $trf['estado']], ['estado' => 'recibida']);

            responder(200, [
                'id' => $id,
                'stock_destino' => $nuevo,
                'mensaje' => sprintf(
                    'Transferencia %s recibida. Se sumaron %d %s a %s.',
                    $trf['codigo'], $cantidad, $trf['unidad_medida'], $trf['destino_nombre']
                ),
            ]);
        }

        // ---- CANCELAR: el stock regresa al origen ----
        $conexion->query("INSERT IGNORE INTO stock (producto_id, almacen_id, cantidad) VALUES ($producto_id, $origen_id, 0)");

        $stock_origen = consultar_uno(
            'SELECT cantidad FROM stock WHERE producto_id = ? AND almacen_id = ? FOR UPDATE',
            [$producto_id, $origen_id]
        );
        $anterior = (int) $stock_origen['cantidad'];
        $nuevo = $anterior + $cantidad;

        $sentencia = $conexion->prepare(
            "INSERT INTO movimientos
             (tipo, producto_id, almacen_id, cantidad, stock_anterior, stock_nuevo,
              costo_unitario, referencia, notas, usuario_id)
             VALUES ('ajuste', ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        );
        $notas_dev = "Devolucion por cancelacion de " . $trf['codigo'];
        $sentencia->bind_param(
            'siiidssii',
            $producto_id, $origen_id, $cantidad, $anterior, $nuevo,
            $trf['precio_compra'], $trf['codigo'], $notas_dev, $usuario['id']
        );
        $sentencia->execute();
        $sentencia->close();

        $sentencia = $conexion->prepare(
            'UPDATE stock SET cantidad = ? WHERE producto_id = ? AND almacen_id = ?'
        );
        $sentencia->bind_param('iii', $nuevo, $producto_id, $origen_id);
        $sentencia->execute();
        $sentencia->close();

        $sentencia = $conexion->prepare(
            "UPDATE transferencias SET estado = 'cancelada' WHERE id = ?"
        );
        $sentencia->bind_param('i', $id);
        $sentencia->execute();
        $sentencia->close();

        $conexion->commit();

        auditar('transferir', 'transferencias', $id, ['estado' => $trf['estado']], ['estado' => 'cancelada']);

        responder(200, [
            'id' => $id,
            'stock_origen' => $nuevo,
            'mensaje' => sprintf(
                'Transferencia %s cancelada. Se devolvieron %d %s a %s.',
                $trf['codigo'], $cantidad, $trf['unidad_medida'], $trf['origen_nombre']
            ),
        ]);
    } catch (Exception $e) {
        $conexion->rollback();
        error_log('Error al cambiar estado de transferencia: ' . $e->getMessage());
        error(500, 'No se pudo completar la operacion. Se revirtieron todos los cambios.');
    }
}
