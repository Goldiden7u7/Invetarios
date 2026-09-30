<?php
/**
 * API DE MOVIMIENTOS DE INVENTARIO
 * -----------------------------------------------------------------
 * GET    /api/movimientos.php                  -> lista con filtros
 * POST   /api/movimientos.php                  -> registrar movimiento
 *        Body: { producto_id, almacen_id, tipo, cantidad, referencia, notas }
 *        tipo: entrada | salida | ajuste
 *
 * ESTE ES EL CORAZON DEL SISTEMA.
 *
 * Hay tres tipos de movimiento:
 *
 *   ENTRADA   Suma stock.   Stock nunca baja con este tipo.
 *   SALIDA    Resta stock.   Falla si no hay suficiente (no permite negativo).
 *   AJUSTE    Fija el stock a una cantidad exacta. Se usa para contar fisico
 *             o corregir un error. Ej: el conteo fisico dio 47, pero el
 *             sistema decia 50 -> ajuste a 47.
 *
 * SEGURIDAD DE DATOS:
 *   - Usa TRANSACCIONES: si algo falla a mitad, no queda nada a medias.
 *   - Bloquea la fila de stock con SELECT ... FOR UPDATE para que dos
 *     usuarios que entran al mismo tiempo no calculen mal.
 *   - Nunca deja el stock en negativo.
 *   - Deja constancia en la tabla de movimientos SIEMPRE.
 */

require_once __DIR__ . '/nucleo.php';

$metodo = $_SERVER['REQUEST_METHOD'];

switch ($metodo) {
    case 'GET':  listarMovimientos();  break;
    case 'POST': registrarMovimiento(); break;
    default:
        error(405, 'Metodo no permitido');
}

// ----------------------------------------------------------------------
//  LISTAR MOVIMIENTOS
// ----------------------------------------------------------------------

function listarMovimientos()
{
    exigir_permiso(1, 'ver movimientos');

    $producto_id  = entero($_GET['producto_id'] ?? 0);
    $almacen_id   = entero($_GET['almacen_id'] ?? 0);
    $tipo         = (string) ($_GET['tipo'] ?? '');
    $desde        = (string) ($_GET['desde'] ?? '');
    $hasta        = (string) ($_GET['hasta'] ?? '');
    $usuario_id   = entero($_GET['usuario_id'] ?? 0);
    $pagina       = max(1, entero($_GET['pagina'] ?? 1, 1));
    $por_pagina   = min(200, max(10, entero($_GET['por_pagina'] ?? 50, 50)));

    $donde = [];
    $params = [];

    if ($producto_id > 0) { $donde[] = 'm.producto_id = ?'; $params[] = $producto_id; }
    if ($almacen_id > 0)  { $donde[] = 'm.almacen_id = ?';  $params[] = $almacen_id; }
    if ($usuario_id > 0)  { $donde[] = 'm.usuario_id = ?';  $params[] = $usuario_id; }
    if (in_array($tipo, ['entrada', 'salida', 'ajuste', 'transferencia'], true)) {
        $donde[] = 'm.tipo = ?';
        $params[] = $tipo;
    }
    if ($desde !== '') { $donde[] = 'm.creado_en >= ?'; $params[] = $desde . ' 00:00:00'; }
    if ($hasta !== '') { $donde[] = 'm.creado_en <= ?'; $params[] = $hasta . ' 23:59:59'; }

    $filtro = empty($donde) ? '' : 'WHERE ' . implode(' AND ', $donde);

    $total = consultar_uno("SELECT COUNT(*) AS n FROM movimientos m $filtro", $params);
    $total = (int) $total['n'];
    $offset = ($pagina - 1) * $por_pagina;

    $filas = consultar(
        "SELECT m.*,
                p.codigo AS producto_codigo, p.nombre AS producto_nombre, p.unidad_medida,
                a.codigo AS almacen_codigo, a.nombre AS almacen_nombre,
                u.nombre AS usuario_nombre
         FROM movimientos m
         INNER JOIN productos p ON p.id = m.producto_id
         INNER JOIN almacenes a ON a.id = m.almacen_id
         INNER JOIN usuarios  u ON u.id = m.usuario_id
         $filtro
         ORDER BY m.creado_en DESC, m.id DESC
         LIMIT $por_pagina OFFSET $offset",
        $params
    );

    foreach ($filas as &$f) {
        $f['id'] = (int) $f['id'];
        $f['cantidad'] = (int) $f['cantidad'];
        $f['stock_anterior'] = (int) $f['stock_anterior'];
        $f['stock_nuevo'] = (int) $f['stock_nuevo'];
        $f['costo_unitario'] = (float) $f['costo_unitario'];
    }
    unset($f);

    // Resumen para las tarjetas del dashboard
    $resumen = consultar_uno(
        "SELECT
            SUM(CASE WHEN m.tipo = 'entrada' THEN m.cantidad ELSE 0 END) AS total_entradas,
            SUM(CASE WHEN m.tipo = 'salida'  THEN ABS(m.cantidad) ELSE 0 END) AS total_salidas,
            COUNT(*) AS total_movimientos
         FROM movimientos m $filtro",
        $params
    );

    responder(200, [
        'movimientos' => $filas,
        'resumen' => [
            'total_entradas'     => (int) ($resumen['total_entradas'] ?? 0),
            'total_salidas'      => (int) ($resumen['total_salidas'] ?? 0),
            'total_movimientos'  => (int) ($resumen['total_movimientos'] ?? 0),
        ],
        'paginacion' => [
            'pagina' => $pagina,
            'por_pagina' => $por_pagina,
            'total' => $total,
            'total_paginas' => (int) ceil($total / $por_pagina),
        ],
    ]);
}

// ----------------------------------------------------------------------
//  REGISTRAR MOVIMIENTO
// ----------------------------------------------------------------------

function registrarMovimiento()
{
    $usuario = exigir_permiso(16, 'registrar movimientos');

    $producto_id = entero(entrada('producto_id'));
    $almacen_id  = entero(entrada('almacen_id'));
    $tipo        = (string) entrada('tipo', '');
    $cantidad    = entero(entrada('cantidad'));
    $referencia  = trim((string) entrada('referencia', '')) ?: null;
    $notas       = trim((string) entrada('notas', '')) ?: null;

    // --------------------------------------------------------------
    //  Validaciones de entrada
    // --------------------------------------------------------------

    if ($producto_id <= 0) error(400, 'Falta el producto');
    if ($almacen_id <= 0)  error(400, 'Falta el almacen');
    if (!in_array($tipo, ['entrada', 'salida', 'ajuste'], true)) {
        error(400, 'Tipo de movimiento no valido (use: entrada, salida o ajuste)');
    }
    if ($cantidad < 0) {
        error(400, 'La cantidad no puede ser negativa');
    }
    if ($tipo !== 'ajuste' && $cantidad <= 0) {
        error(400, 'La cantidad debe ser mayor que cero');
    }

    $producto = consultar_uno('SELECT * FROM productos WHERE id = ?', [$producto_id]);
    if (!$producto) {
        error(404, 'El producto no existe');
    }
    if (!$producto['activo']) {
        error(400, 'El producto "' . $producto['nombre'] . '" esta desactivado. Activalo antes de mover stock.');
    }

    $almacen = consultar_uno('SELECT * FROM almacenes WHERE id = ?', [$almacen_id]);
    if (!$almacen) {
        error(404, 'El almacen no existe');
    }
    if (!$almacen['activo']) {
        error(400, 'El almacen "' . $almacen['nombre'] . '" esta desactivado');
    }

    // --------------------------------------------------------------
    //  TRANSACCION
    //  A partir de aqui, o se guarda todo o no se guarda nada.
    // --------------------------------------------------------------

    $conexion = bd();
    $conexion->begin_transaction();

    try {
        // Bloqueamos la fila de stock para evitar condiciones de carrera.
        // Si la fila no existe todavia (producto nunca estuvo en este
        // almacen), la creamos en cero.
        $conexion->query("INSERT IGNORE INTO stock (producto_id, almacen_id, cantidad) VALUES ($producto_id, $almacen_id, 0)");

        $stock = consultar_uno(
            'SELECT cantidad FROM stock WHERE producto_id = ? AND almacen_id = ? FOR UPDATE',
            [$producto_id, $almacen_id]
        );

        $stock_actual = (int) $stock['cantidad'];

        // Calculamos el nuevo stock segun el tipo
        switch ($tipo) {
            case 'entrada':
                $stock_nuevo = $stock_actual + $cantidad;
                break;

            case 'salida':
                $stock_nuevo = $stock_actual - $cantidad;
                // Aqui esta la regla que protege la operacion:
                if ($stock_nuevo < 0) {
                    $conexion->rollback();
                    error(400, sprintf(
                        'Stock insuficiente en %s. Disponible: %d %s, solicitaste: %d',
                        $almacen['nombre'],
                        $stock_actual,
                        $producto['unidad_medida'],
                        $cantidad
                    ));
                }
                break;

            case 'ajuste':
                // En ajuste, la cantidad es el stock FINAL deseado
                $stock_nuevo = $cantidad;
                if ($stock_nuevo < 0) {
                    $conexion->rollback();
                    error(400, 'El stock ajustado no puede ser negativo');
                }
                break;
        }

        // Guardamos la cantidad con signo en el movimiento, para que el
        // historial se lea solo: -5 significa que salio.
        $cantidad_movimiento = match ($tipo) {
            'entrada' => $cantidad,
            'salida'  => -$cantidad,
            'ajuste'  => $stock_nuevo - $stock_actual,
        };

        // --------------------------------------------------------------
        //  Escribimos el movimiento en la bitacora
        // --------------------------------------------------------------

        $columnas_fecha = match ($tipo) {
            'entrada' => ', ultima_entrada = NOW()',
            'salida'  => ', ultima_salida = NOW()',
            default   => '',
        };

        $sentencia = $conexion->prepare(
            "INSERT INTO movimientos
             (tipo, producto_id, almacen_id, cantidad, stock_anterior, stock_nuevo,
              costo_unitario, referencia, notas, usuario_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        );

        $sentencia->bind_param(
            'ssiiidssii',
            $tipo,
            $producto_id,
            $almacen_id,
            $cantidad_movimiento,
            $stock_actual,
            $stock_nuevo,
            $producto['precio_compra'],
            $referencia,
            $notas,
            $usuario['id']
        );
        $sentencia->execute();

        $movimiento_id = $conexion->insert_id;
        $sentencia->close();

        // --------------------------------------------------------------
        //  Actualizamos el stock
        // --------------------------------------------------------------

        $sentencia = $conexion->prepare(
            "UPDATE stock SET cantidad = ? $columnas_fecha
             WHERE producto_id = ? AND almacen_id = ?"
        );
        $sentencia->bind_param('iii', $stock_nuevo, $producto_id, $almacen_id);
        $sentencia->execute();
        $sentencia->close();

        $conexion->commit();

        // --------------------------------------------------------------
        //  Aviso de stock bajo (no es un error, solo informacion)
        // --------------------------------------------------------------

        $aviso = null;
        if ((int) $producto['stock_minimo'] > 0 && $stock_nuevo <= (int) $producto['stock_minimo']) {
            $aviso = sprintf(
                'Atencion: %s quedo en %d %s (minimo: %d)',
                $producto['nombre'],
                $stock_nuevo,
                $producto['unidad_medida'],
                (int) $producto['stock_minimo']
            );
        }

        auditar('ajustar', 'movimientos', $movimiento_id, null, [
            'tipo' => $tipo,
            'producto_id' => $producto_id,
            'almacen_id' => $almacen_id,
            'cantidad' => $cantidad,
            'stock_anterior' => $stock_actual,
            'stock_nuevo' => $stock_nuevo,
        ]);

        responder(201, [
            'id' => $movimiento_id,
            'stock_anterior' => $stock_actual,
            'stock_nuevo' => $stock_nuevo,
            'mensaje' => match ($tipo) {
                'entrada' => 'Entrada registrada: +' . $cantidad . ' ' . $producto['unidad_medida'],
                'salida'  => 'Salida registrada: -' . $cantidad . ' ' . $producto['unidad_medida'],
                default   => 'Ajuste aplicado: stock ahora es ' . $stock_nuevo . ' ' . $producto['unidad_medida'],
            },
            'aviso' => $aviso,
        ]);
    } catch (Exception $e) {
        $conexion->rollback();
        error_log('Error en movimiento: ' . $e->getMessage());
        error(500, 'No se pudo registrar el movimiento. Se revirtieron todos los cambios.');
    }
}
