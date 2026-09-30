<?php
/**
 * API DE VENTAS (CAJA)
 * -----------------------------------------------------------------
 * POST /api/ventas.php                         -> registrar una venta
 *       Body: {
 *         almacen_id, cliente_nombre?, metodo_pago, descuento?,
 *         notas?, items: [
 *           { combo_id, cantidad,
 *             opcionales: [ {producto_id, cantidad?} ],   // agregar extra
 *             quitar:     [ {producto_id, cantidad?} ],   // quitar de la receta
 *             quitados:   [ {producto_id, cantidad?} ]    // alias de 'quitar'
 *           }
 *         ]
 *       }
 * GET /api/ventas.php?desde=&hasta=&pagina=     -> lista + resumen
 * GET /api/ventas.php?id=5                       -> detalle con items
 *
 * QUE PASA AL VENDER:
 *   1. Se calcula la receta REAL de cada item (base + agregados - quitados).
 *   2. Se valida que el almacen tenga TODOS los ingredientes (bloqueo FOR
 *      UPDATE para que dos cajeros a la vez no se pisen).
 *   3. Si falta algo se REVIERTE TODO y se avisa que falta (y cuanto).
 *   4. Se descuenta cada ingrediente del stock y queda en la bitacora
 *      (movimientos tipo salida, referencia = codigo de venta).
 *   5. Se guarda el snapshot en venta_items (precio y costo de la receta).
 *   6. Si algun item requiere cocina, se crea el pedido para la pantalla
 *      de cocina.
 *
 * Permisos: registrar venta = crear (2); ver = ver (1).
 */

require_once __DIR__ . '/nucleo.php';

$metodo = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if (PHP_SAPI !== 'cli') {
    switch ($metodo) {
        case 'GET':  listarVentas();  break;
        case 'POST':
            $usuario = exigir_permiso(2, 'registrar ventas');
            $respuesta = crear_venta($usuario, cuerpo());
            responder(201, $respuesta);
            break;
        default:
            error(405, 'Metodo no permitido');
    }
}

// ----------------------------------------------------------------------

function listarVentas()
{
    exigir_permiso(1, 'ver ventas');

    $id = entero($_GET['id'] ?? 0);

    // Detalle de una venta: items con los ingredientes que se consumieron
    if ($id > 0) {
        $venta = consultar_uno(
            'SELECT v.*, a.nombre AS almacen_nombre, u.nombre AS usuario_nombre,
                    (SELECT COUNT(*) FROM venta_items vi WHERE vi.venta_id = v.id) AS n_items
             FROM ventas v
             INNER JOIN almacenes a ON a.id = v.almacen_id
             INNER JOIN usuarios  u ON u.id = v.usuario_id
             WHERE v.id = ? LIMIT 1',
            [$id]
        );

        if (!$venta) {
            fallo_venta(404, 'La venta no existe');
        }

        $items = consultar(
            'SELECT vi.*, c.tipo AS combo_tipo
             FROM venta_items vi
             INNER JOIN combos c ON c.id = vi.combo_id
             WHERE vi.venta_id = ?
             ORDER BY vi.id',
            [$id]
        );

        $venta['id'] = (int) $venta['id'];
        $venta['subtotal'] = (float) $venta['subtotal'];
        $venta['descuento'] = (float) $venta['descuento'];
        $venta['total'] = (float) $venta['total'];
        $venta['costo_total'] = (float) $venta['costo_total'];
        $venta['ganancia'] = round($venta['total'] - $venta['costo_total'], 2);
        $venta['n_items'] = (int) $venta['n_items'];

        foreach ($items as &$it) {
            $it['id'] = (int) $it['id'];
            $it['cantidad'] = (int) $it['cantidad'];
            $it['precio_unitario'] = (float) $it['precio_unitario'];
            $it['extra_precio'] = (float) $it['extra_precio'];
            $it['costo_unitario'] = (float) $it['costo_unitario'];
            $it['subtotal'] = (float) $it['subtotal'];
            $it['necesita_cocina'] = (int) $it['necesita_cocina'];
            $it['ingredientes'] = json_decode((string) $it['ingredientes'], true);
        }
        unset($it);

        $venta['items'] = $items;
        responder(200, $venta);
        return;
    }

    // Lista con filtros
    $desde     = (string) ($_GET['desde'] ?? '');
    $hasta     = (string) ($_GET['hasta'] ?? '');
    $almacen   = entero($_GET['almacen_id'] ?? 0);
    $usuario   = entero($_GET['usuario_id'] ?? 0);
    $metodo_pago = (string) ($_GET['metodo_pago'] ?? '');
    $pagina    = max(1, entero($_GET['pagina'] ?? 1, 1));
    $por_pagina = min(100, max(10, entero($_GET['por_pagina'] ?? 25, 25)));

    $donde = [];
    $params = [];

    if ($almacen > 0) { $donde[] = 'v.almacen_id = ?'; $params[] = $almacen; }
    if ($usuario > 0) { $donde[] = 'v.usuario_id = ?'; $params[] = $usuario; }
    if ($desde !== '') { $donde[] = 'v.creado_en >= ?'; $params[] = $desde . ' 00:00:00'; }
    if ($hasta !== '') { $donde[] = 'v.creado_en <= ?'; $params[] = $hasta . ' 23:59:59'; }
    if (in_array($metodo_pago, ['efectivo', 'tarjeta', 'transferencia', 'otro'], true)) {
        $donde[] = 'v.metodo_pago = ?';
        $params[] = $metodo_pago;
    }

    $filtro = empty($donde) ? '' : 'WHERE ' . implode(' AND ', $donde);

    $total = consultar_uno("SELECT COUNT(*) AS n FROM ventas v $filtro", $params);
    $total = (int) $total['n'];
    $offset = ($pagina - 1) * $por_pagina;

    $filas = consultar(
        "SELECT v.id, v.codigo, v.cliente_nombre, v.metodo_pago, v.subtotal,
                v.descuento, v.total, v.costo_total, v.estado, v.creado_en,
                a.nombre AS almacen_nombre, u.nombre AS usuario_nombre,
                (SELECT COUNT(*) FROM venta_items vi WHERE vi.venta_id = v.id) AS n_items
         FROM ventas v
         INNER JOIN almacenes a ON a.id = v.almacen_id
         INNER JOIN usuarios  u ON u.id = v.usuario_id
         $filtro
         ORDER BY v.creado_en DESC, v.id DESC
         LIMIT $por_pagina OFFSET $offset",
        $params
    );

    foreach ($filas as &$f) {
        $f['id'] = (int) $f['id'];
        $f['subtotal'] = (float) $f['subtotal'];
        $f['descuento'] = (float) $f['descuento'];
        $f['total'] = (float) $f['total'];
        $f['costo_total'] = (float) $f['costo_total'];
        $f['n_items'] = (int) $f['n_items'];
    }
    unset($f);

    // Resumen para tarjetas (hoy, mes y total)
    $hoy = consultar_uno(
        "SELECT COUNT(*) AS ventas, COALESCE(SUM(total),0) AS total
         FROM ventas WHERE estado = 'completada' AND DATE(creado_en) = CURDATE()"
    );
    $mes = consultar_uno(
        "SELECT COUNT(*) AS ventas, COALESCE(SUM(total),0) AS total
         FROM ventas WHERE estado = 'completada'
           AND YEAR(creado_en) = YEAR(NOW()) AND MONTH(creado_en) = MONTH(NOW())"
    );

    responder(200, [
        'ventas' => $filas,
        'resumen' => [
            'hoy' => ['ventas' => (int) $hoy['ventas'], 'total' => (float) $hoy['total']],
            'mes' => ['ventas' => (int) $mes['ventas'], 'total' => (float) $mes['total']],
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

/**
 * Registra una venta completa (validacion + stock + bitacora + cocina).
 *
 * `$usuario` es el usuario que cobra y `$peticion` el cuerpo de la venta.
 * Fuera del modo HTTP (script CLI de datos demo) los campos se inyectan en
 * $_GET para que la lectura unificada `entrada()` funcione igual.
 */
function crear_venta($usuario, $peticion)
{
    // En CLI (api/semilla_ventas.php) no hay cuerpo HTTP: pasamos los
    // campos por el superglobal para reutilizar la misma lectura. El cuerpo
    // gana sobre lo que pueda venir en el query string (misma precedencia
    // que entrada()).
    $_GET = array_merge($_GET, (array) $peticion);

    $almacen_id = entero(entrada('almacen_id'));
    $cliente    = trim((string) entrada('cliente_nombre', '')) ?: null;
    $metodo     = (string) entrada('metodo_pago', 'efectivo');
    $descuento  = decimal(entrada('descuento', 0));
    $notas      = trim((string) entrada('notas', '')) ?: null;

    if ($almacen_id <= 0) fallo_venta(400, 'Indica el almacen desde donde vendes');
    if (!in_array($metodo, ['efectivo', 'tarjeta', 'transferencia', 'otro'], true)) {
        fallo_venta(400, 'Metodo de pago no valido');
    }
    if ($descuento < 0) fallo_venta(400, 'El descuento no puede ser negativo');

    $items = entrada('items', []);
    if (!is_array($items) || count($items) === 0) {
        fallo_venta(400, 'La venta debe tener al menos un item');
    }
    if (count($items) > 50) {
        fallo_venta(400, 'Demasiados items en una sola venta');
    }

    $almacen = consultar_uno('SELECT * FROM almacenes WHERE id = ?', [$almacen_id]);
    if (!$almacen) fallo_venta(404, 'El almacen no existe');
    if (!$almacen['activo']) fallo_venta(400, 'El almacen "' . $almacen['nombre'] . '" esta desactivado');

    // --------------------------------------------------------------
    //  ARMADO DE LOS ITEMS
    //  Cada item se convierte en: combos verificados, receta real (los
    //  productos que consume), precio con extras y costo de la receta.
    // --------------------------------------------------------------

    $lineas = [];
    $consumo = [];   // producto_id => cantidad total a descontar

    foreach ($items as $item) {
        $combo_id   = entero($item['combo_id'] ?? 0);
        $cantidad   = entero($item['cantidad'] ?? 1);
        $opcionales = $item['opcionales'] ?? [];

        // Ingredientes que el cliente quito. Aceptamos las dos claves para
        // no depender del cliente: 'quitar' es el nombre del contrato
        // documentado (lo usan el generador de datos y las pruebas) y
        // 'quitados' es el que manda la app web. Si vienen las dos, se suman.
        $quitar = array_merge(
            is_array($item['quitar'] ?? null) ? $item['quitar'] : [],
            is_array($item['quitados'] ?? null) ? $item['quitados'] : []
        );

        if ($combo_id <= 0) fallo_venta(400, 'Hay un item sin combo');
        if ($cantidad < 1 || $cantidad > 100) fallo_venta(400, 'Cantidad de item no valida');

        $combo = consultar_uno('SELECT * FROM combos WHERE id = ?', [$combo_id]);
        if (!$combo) fallo_venta(404, 'El combo con id ' . $combo_id . ' no existe');
        if (!$combo['activo']) fallo_venta(400, 'El combo "' . $combo['nombre'] . '" esta desactivado');

        $receta = consultar('SELECT producto_id, cantidad FROM combo_productos WHERE combo_id = ?', [$combo_id]);
        if (count($receta) === 0) {
            fallo_venta(400, 'El combo "' . $combo['nombre'] . '" no tiene receta. Editalo primero.');
        }

        $catalogo_op = [];
        foreach (consultar('SELECT producto_id, cantidad, precio_extra FROM combo_opcionales WHERE combo_id = ?', [$combo_id]) as $op) {
            $catalogo_op[$op['producto_id']] = $op;
        }

        // Neto por producto (por 1 unidad del combo)
        $neto = [];
        $fila_ingredientes = [];   // snapshot para el ticket de cocina

        foreach ($receta as $ing) {
            $neto[$ing['producto_id']] = $ing['cantidad'];
            $fila_ingredientes[] = [
                'producto_id' => (int) $ing['producto_id'],
                'nombre' => null,   // se llena al pedir el precio
                'cantidad' => (int) $ing['cantidad'],
                'accion' => 'incluido',
            ];
        }

        // Extra que pide el cliente (deben existir en el catalogo del combo)
        $extra_precio = 0.0;
        if (is_array($opcionales)) {
            foreach ($opcionales as $op) {
                $pid = entero($op['producto_id'] ?? 0);
                $op_cant = max(1, entero($op['cantidad'] ?? 1));

                if (!isset($catalogo_op[$pid])) {
                    fallo_venta(400, '"' . $combo['nombre'] . '" no ofrece el extra que pediste (producto ' . $pid . ')');
                }
                $neto[$pid] = ($neto[$pid] ?? 0) + $op_cant;
                $extra_precio += $catalogo_op[$pid]['precio_extra'] * $op_cant;
                $fila_ingredientes[] = [
                    'producto_id' => (int) $pid,
                    'nombre' => null,
                    'cantidad' => (int) $op_cant,
                    'accion' => 'extra',
                ];
            }
        }

        // Quitar ingredientes de la receta base
        $quitados = [];
        if (is_array($quitar)) {
            foreach ($quitar as $qt) {
                $pid = entero($qt['producto_id'] ?? 0);
                $qt_cant = max(1, entero($qt['cantidad'] ?? 1));

                if (!isset($neto[$pid]) || $neto[$pid] <= 0) {
                    fallo_venta(400, 'No puedes quitar un ingrediente que "' . $combo['nombre'] . '" no incluye o ya quitaste');
                }
                if ($qt_cant > $neto[$pid]) {
                    fallo_venta(400, 'Solo puedes quitar lo que incluye la receta (max ' . $neto[$pid] . ' de ese ingrediente)');
                }
                $neto[$pid] -= $qt_cant;
                // Guardamos CUANTO se quito, no solo que se quito: asi la
                // pantalla de cocina puede restarlo de la receta y mostrar
                // al cocinero exactamente lo que debe preparar.
                $quitados[] = [
                    'producto_id' => (int) $pid,
                    'cantidad'    => (int) $qt_cant,
                    'nombre'      => null,
                ];
            }
        }

        // Costo de la receta real: sumamos el precio de compra de cada
        // producto neto. Los quitados por completo no se descuentan (no se usan).
        $costo_unitario = 0.0;
        $precios = [];
        if (count($neto) > 0) {
            $ids = array_keys($neto);
            $marcas = implode(',', array_fill(0, count($ids), '?'));
            $filas_p = consultar("SELECT id, nombre, precio_compra FROM productos WHERE id IN ($marcas)", $ids);
            foreach ($filas_p as $p) {
                $precios[$p['id']] = $p;
            }
        }

        foreach ($fila_ingredientes as &$fing) {
            $info = $precios[$fing['producto_id']] ?? null;
            $fing['nombre'] = $info['nombre'] ?? 'Producto ' . $fing['producto_id'];
        }
        unset($fing);
        foreach ($quitados as &$q) {
            $info = $precios[$q['producto_id']] ?? null;
            $q['nombre'] = $info['nombre'] ?? 'Producto ' . $q['producto_id'];
        }
        unset($q);

        foreach ($neto as $pid => $n) {
            if ($n <= 0) continue;   // quitado por completo: no se consume
            $consumo[$pid] = ($consumo[$pid] ?? 0) + ($n * $cantidad);
            $costo_unitario += $n * (float) ($precios[$pid]['precio_compra'] ?? 0);
        }

        $lineas[] = [
            'combo_id' => $combo_id,
            'nombre' => $combo['nombre'],
            'cantidad' => $cantidad,
            'precio_unitario' => (float) $combo['precio_venta'],
            'extra_precio' => round($extra_precio * $cantidad, 2),
            'costo_unitario' => round($costo_unitario, 2),
            'subtotal' => round(($combo['precio_venta'] + $extra_precio) * $cantidad, 2),
            'necesita_cocina' => (int) $combo['requiere_cocina'],
            'ingredientes' => $fila_ingredientes,
            'quitados' => $quitados,
        ];
    }

    // --------------------------------------------------------------
    //  TRANSACCION
    //  Primero validamos TODO el stock; si algo falta, se avisa con la
    //  lista completa (no solo el primer fallo) y no se toca nada.
    // --------------------------------------------------------------

    $conexion = bd();
    $conexion->begin_transaction();

    try {
        $faltantes = [];

        foreach ($consumo as $pid => $necesario) {
            // En un almacen donde nunca estuvo el producto, la fila nace en 0.
            consultar('INSERT IGNORE INTO stock (producto_id, almacen_id, cantidad) VALUES (?,?,0)', [$pid, $almacen_id]);

            $st = consultar_uno(
                'SELECT cantidad FROM stock WHERE producto_id = ? AND almacen_id = ? FOR UPDATE',
                [$pid, $almacen_id]
            );
            $disponible = (int) $st['cantidad'];

            if ($disponible < $necesario) {
                $producto = consultar_uno('SELECT nombre, unidad_medida FROM productos WHERE id = ?', [$pid]);
                $faltantes[] = [
                    'producto_id' => $pid,
                    'nombre' => $producto['nombre'] ?? ('Producto ' . $pid),
                    'unidad_medida' => $producto['unidad_medida'] ?? 'UND',
                    'disponible' => $disponible,
                    'necesario' => $necesario,
                ];
            }
        }

        if (!empty($faltantes)) {
            $conexion->rollback();
            $detalle = implode('; ', array_map(
                fn ($f) => $f['nombre'] . ' (disponible ' . $f['disponible'] . ', pide ' . $f['necesario'] . ')',
                $faltantes
            ));
            fallo_venta(400, 'Stock insuficiente para completar la venta: ' . $detalle, ['faltantes' => $faltantes]);
            return;
        }

        // ---- Guardamos la venta ----
        $subtotal = round(array_sum(array_column($lineas, 'subtotal')), 2);
        if ($descuento > $subtotal) {
            $conexion->rollback();
            fallo_venta(400, 'El descuento no puede ser mayor que el subtotal (' . $subtotal . ')');
        }
        $total = round($subtotal - $descuento, 2);
        $costo_total = round(array_sum(array_map(
            fn ($l) => $l['costo_unitario'] * $l['cantidad'],
            $lineas
        )), 2);

        $codigo = generar_codigo('VTA', 'ventas', 'codigo');

        $venta_id = ejecutar(
            'INSERT INTO ventas
             (codigo, almacen_id, usuario_id, cliente_nombre, metodo_pago,
              subtotal, descuento, total, costo_total, notas)
             VALUES (?,?,?,?,?,?,?,?,?,?)',
            [
                $codigo, $almacen_id, $usuario['id'], $cliente, $metodo,
                $subtotal, $descuento, $total, $costo_total, $notas,
            ]
        );

        // ---- Items con su snapshot ----
        $hay_cocina = false;
        foreach ($lineas as $l) {
            $json = json_encode(
                ['ingredientes' => $l['ingredientes'], 'quitados' => $l['quitados']],
                JSON_UNESCAPED_UNICODE
            );

            ejecutar(
                'INSERT INTO venta_items
                 (venta_id, combo_id, nombre, cantidad, precio_unitario,
                  extra_precio, costo_unitario, ingredientes, subtotal, necesita_cocina)
                 VALUES (?,?,?,?,?,?,?,?,?,?)',
                [
                    $venta_id, $l['combo_id'], $l['nombre'], $l['cantidad'],
                    $l['precio_unitario'], $l['extra_precio'], $l['costo_unitario'],
                    $json, $l['subtotal'], $l['necesita_cocina'],
                ]
            );

            if ($l['necesita_cocina']) $hay_cocina = true;
        }

        // ---- Descuento de stock + bitacora por ingrediente ----
        foreach ($consumo as $pid => $necesario) {
            $st = consultar_uno(
                'SELECT cantidad FROM stock WHERE producto_id = ? AND almacen_id = ? FOR UPDATE',
                [$pid, $almacen_id]
            );
            $stock_actual = (int) $st['cantidad'];
            $stock_nuevo = $stock_actual - $necesario;

            $producto = consultar_uno('SELECT precio_compra FROM productos WHERE id = ?', [$pid]);

            ejecutar(
                'INSERT INTO movimientos
                 (tipo, producto_id, almacen_id, cantidad, stock_anterior, stock_nuevo,
                  costo_unitario, referencia, notas, usuario_id)
                 VALUES (?,?,?,?,?,?,?,?,?,?)',
                [
                    'salida', $pid, $almacen_id, -$necesario, $stock_actual, $stock_nuevo,
                    (float) $producto['precio_compra'], $codigo, 'Venta ' . $codigo, $usuario['id'],
                ]
            );
            ejecutar(
                'UPDATE stock SET cantidad = ?, ultima_salida = NOW()
                 WHERE producto_id = ? AND almacen_id = ?',
                [$stock_nuevo, $pid, $almacen_id]
            );
        }

        // ---- Pedido para cocina ----
        $pedido = null;
        if ($hay_cocina) {
            $codigo_pedido = generar_codigo('PED', 'pedidos', 'codigo');
            $pedido_id = ejecutar(
                'INSERT INTO pedidos (codigo, venta_id, cliente_nombre) VALUES (?,?,?)',
                [$codigo_pedido, $venta_id, $cliente]
            );
            $pedido = ['id' => $pedido_id, 'codigo' => $codigo_pedido, 'estado' => 'pendiente'];
        }

        // Descuentos por stock bajo, solo informativos
        $avisos = [];
        foreach ($consumo as $pid => $necesario) {
            $st = consultar_uno(
                'SELECT cantidad, ultima_salida FROM stock WHERE producto_id = ? AND almacen_id = ?',
                [$pid, $almacen_id]
            );
            $prod = consultar_uno('SELECT nombre, stock_minimo FROM productos WHERE id = ?', [$pid]);
            if ((int) $prod['stock_minimo'] > 0 && (int) $st['cantidad'] <= (int) $prod['stock_minimo']) {
                $avisos[] = $prod['nombre'] . ' quedo en ' . $st['cantidad'];
            }
        }

        $conexion->commit();

        auditar('crear', 'ventas', $venta_id, null, [
            'codigo' => $codigo,
            'total' => $total,
            'items' => count($lineas),
            'pedido_cocina' => $pedido ? $pedido['codigo'] : null,
        ]);

        return [
            'id' => $venta_id,
            'codigo' => $codigo,
            'subtotal' => $subtotal,
            'descuento' => $descuento,
            'total' => $total,
            'costo_total' => $costo_total,
            'pedido' => $pedido,
            'avisos' => $avisos,
            'mensaje' => 'Venta ' . $codigo . ' registrada. Stock actualizado.',
        ];
    } catch (Throwable $e) {
        $conexion->rollback();
        error_log('Error en venta: ' . $e->getMessage());
        if (defined('VENTAS_CLI') && VENTAS_CLI) {
            throw $e;
        }
        error(500, 'No se pudo registrar la venta. Se revirtieron todos los cambios.');
    }
}

/**
 * Emite un fallo de venta. En modo normal responde el JSON al navegador;
 * en modo CLI (semilla de datos demo) lanza una excepcion para que el
 * script pueda continuar con la siguiente venta.
 */
function fallo_venta($codigo, $mensaje, $datos = null)
{
    if (defined('VENTAS_CLI') && VENTAS_CLI) {
        throw new RuntimeException($mensaje, (int) $codigo);
    }
    responder($codigo, $datos, $mensaje);
}