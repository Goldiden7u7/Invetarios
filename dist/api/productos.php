<?php
/**
 * GET /api/productos           -> lista con filtros
 * GET /api/productos.php?id=5   -> uno solo
 * POST /api/productos          -> crear
 * PUT /api/productos           -> editar
 * DELETE /api/productos        -> eliminar (desactiva)
 *
 * La app llama a /api/productos.php directamente para Simplificar las rutas.
 */

require_once __DIR__ . '/nucleo.php';

$metodo = $_SERVER['REQUEST_METHOD'];

switch ($metodo) {
    case 'GET':    listarProductos();    break;
    case 'POST':   crearProducto();     break;
    case 'PUT':    actualizarProducto(); break;
    case 'DELETE': eliminarProducto();  break;
    default:
        error(405, 'Metodo no permitido');
}

// ----------------------------------------------------------------------

function listarProductos()
{
    exigir_permiso(1, 'ver productos');

    $id = entero($_GET['id'] ?? 0);

    // Detalle de un producto
    if ($id > 0) {
        $producto = consultar_uno(
            'SELECT p.*, c.nombre AS categoria, c.id AS categoria_id
             FROM productos p
             LEFT JOIN categorias c ON c.id = p.categoria_id
             WHERE p.id = ? LIMIT 1',
            [$id]
        );

        if (!$producto) {
            error(404, 'Producto no encontrado');
        }

        // Stock desglosado por almacen
        $producto['stock_por_almacen'] = consultar(
            'SELECT st.almacen_id, a.codigo AS almacen_codigo, a.nombre AS almacen_nombre,
                    st.cantidad, st.ultima_entrada, st.ultima_salida
             FROM stock st
             INNER JOIN almacenes a ON a.id = st.almacen_id
             WHERE st.producto_id = ?
             ORDER BY a.nombre',
            [$id]
        );

        // Seriales si aplica
        if ($producto['controla_serial']) {
            $producto['seriales'] = consultar(
                'SELECT id, serial, estado, almacen_id, observacion
                 FROM numeros_serie WHERE producto_id = ? ORDER BY serial',
                [$id]
            );
        }

        $producto['id'] = (int) $producto['id'];
        $producto['categoria_id'] = $producto['categoria_id'] ? (int) $producto['categoria_id'] : null;
        $producto['precio_compra'] = (float) $producto['precio_compra'];
        $producto['precio_venta'] = (float) $producto['precio_venta'];

        responder(200, $producto);
    }

    // Lista con filtros
    $buscar = trim((string) ($_GET['buscar'] ?? ''));
    $categoria = entero($_GET['categoria'] ?? 0);
    $almacen = entero($_GET['almacen'] ?? 0);
    $estado = (string) ($_GET['estado'] ?? 'activos');   // activos | inactivos | todos
    $pagina = max(1, entero($_GET['pagina'] ?? 1, 1));
    $porPagina = min(100, max(5, entero($_GET['por_pagina'] ?? 25, 25)));
    $orden = (string) ($_GET['orden'] ?? 'nombre');
    $dir = strtoupper((string) ($_GET['dir'] ?? 'asc')) === 'DESC' ? 'DESC' : 'ASC';

    $donde = [];
    $params = [];

    if ($buscar !== '') {
        $donde[] = '(p.nombre LIKE ? OR p.codigo LIKE ? OR p.descripcion LIKE ?)';
        $like = "%$buscar%";
        array_push($params, $like, $like, $like);
    }
    if ($categoria > 0) {
        $donde[] = 'p.categoria_id = ?';
        $params[] = $categoria;
    }
    // Por defecto solo los activos, igual que almacenes y categorias: un
    // producto desactivado no debe ensuciar el catalogo del dia a dia.
    // Pide estado=inactivos o estado=todos para verlos.
    // Cualquier valor desconocido cae en 'activos' (igual que categorias.php)
    // para que un error de tipeo no exponga de golpe todo el catalogo.
    $filtroEstado = in_array($estado, ['activos', 'inactivos', 'todos', 'activo', 'inactivo'], true)
        ? $estado
        : 'activos';

    $dondeEstado = match ($filtroEstado) {
        'activos', 'activo'    => 'p.activo = 1',
        'inactivos', 'inactivo' => 'p.activo = 0',
        default                => null,   // todos
    };
    if ($dondeEstado !== null) {
        $donde[] = $dondeEstado;
    }
    if ($almacen > 0) {
        $donde[] = 'EXISTS (SELECT 1 FROM stock s WHERE s.producto_id = p.id AND s.almacen_id = ? AND s.cantidad > 0)';
        $params[] = $almacen;
    }

    $filtro = empty($donde) ? '' : 'WHERE ' . implode(' AND ', $donde);

    // Lista blanca para el orden: evita inyeccion SQL por parametro
    $columnas = [
        'nombre'      => 'p.nombre',
        'codigo'      => 'p.codigo',
        'precio_venta'=> 'p.precio_venta',
        'stock'       => 'cantidad_total',
        'categoria'   => 'c.nombre',
        'creado'      => 'p.creado_en',
    ];
    $columna = isset($columnas[$orden]) ? $columnas[$orden] : 'p.nombre';

    // Total para la paginacion
    $total = consultar_uno("SELECT COUNT(*) AS n FROM productos p $filtro", $params);
    $total = (int) $total['n'];

    $offset = ($pagina - 1) * $porPagina;

    // LEFT JOIN de la vista de totales para poder ordenar por stock
    $sql = "SELECT p.id, p.codigo, p.nombre, p.descripcion, p.categoria_id,
                   c.nombre AS categoria, p.unidad_medida,
                   p.precio_compra, p.precio_venta, p.stock_minimo, p.stock_maximo,
                   p.controla_serial, p.perecedero, p.fecha_vencimiento, p.activo, p.creado_en,
                   COALESCE(t.cantidad_total, 0) AS cantidad_total,
                   COALESCE(t.almacenes_con_stock, 0) AS almacenes_con_stock,
                   CASE
                     WHEN p.stock_minimo = 0 THEN 'normal'
                     WHEN COALESCE(t.cantidad_total,0) = 0 THEN 'agotado'
                     WHEN COALESCE(t.cantidad_total,0) <= p.stock_minimo THEN 'bajo'
                     ELSE 'normal'
                   END AS estado_stock
            FROM productos p
            LEFT JOIN categorias c ON c.id = p.categoria_id
            LEFT JOIN v_stock_total_producto t ON t.producto_id = p.id
            $filtro
            ORDER BY $columna $dir
            LIMIT $porPagina OFFSET $offset";

    $filas = consultar($sql, $params);

    foreach ($filas as &$f) {
        $f['id'] = (int) $f['id'];
        $f['precio_compra'] = (float) $f['precio_compra'];
        $f['precio_venta'] = (float) $f['precio_venta'];
        $f['cantidad_total'] = (int) $f['cantidad_total'];
        $f['almacenes_con_stock'] = (int) $f['almacenes_con_stock'];
        $f['activo'] = (int) $f['activo'];
        $f['controla_serial'] = (int) $f['controla_serial'];
        $f['perecedero'] = (int) $f['perecedero'];
        $f['fecha_vencimiento'] = $f['fecha_vencimiento'] ?? null;
        if ($f['fecha_vencimiento']) {
            $hoy = new DateTime('today');
            $venc = new DateTime($f['fecha_vencimiento']);
            $f['dias_para_vencer'] = $hoy->diff($venc)->days * (($venc < $hoy) ? -1 : 1);
        } else {
            $f['dias_para_vencer'] = null;
        }
    }

    responder(200, [
        'productos' => $filas,
        'paginacion' => [
            'pagina' => $pagina,
            'por_pagina' => $porPagina,
            'total' => $total,
            'total_paginas' => (int) ceil($total / $porPagina),
        ],
    ]);
}

// ----------------------------------------------------------------------

function crearProducto()
{
    $usuario = exigir_permiso(2, 'crear productos');

    $datos = validarProducto();

    // El codigo debe ser unico en todo el catalogo
    $repetido = consultar_uno('SELECT id, nombre FROM productos WHERE codigo = ?', [$datos['codigo']]);
    if ($repetido) {
        error(409, 'Ya existe un producto con el codigo ' . $datos['codigo']
            . ' (' . $repetido['nombre'] . ')');
    }

    $id = ejecutar(
        'INSERT INTO productos
         (codigo, nombre, descripcion, categoria_id, unidad_medida,
          precio_compra, precio_venta, stock_minimo, stock_maximo,
          controla_serial, perecedero, fecha_vencimiento, activo)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1)',
        [
            $datos['codigo'], $datos['nombre'], $datos['descripcion'],
            $datos['categoria_id'], $datos['unidad_medida'],
            $datos['precio_compra'], $datos['precio_venta'],
            $datos['stock_minimo'], $datos['stock_maximo'],
            $datos['controla_serial'], $datos['perecedero'],
            $datos['fecha_vencimiento'],
        ]
    );

    auditar('crear', 'productos', $id, null, $datos);
    responder(201, ['id' => $id, 'mensaje' => 'Producto creado']);
}

// ----------------------------------------------------------------------

function actualizarProducto()
{
    exigir_permiso(4, 'editar productos');

    $id = entero(entrada('id'));
    if ($id <= 0) {
        error(400, 'Falta el id del producto');
    }

    $anterior = consultar_uno('SELECT * FROM productos WHERE id = ?', [$id]);
    if (!$anterior) {
        error(404, 'Producto no encontrado');
    }

    $datos = validarProducto();

    // Si el codigo ya existe en otro producto, no dejamos duplicarlo
    $repetido = consultar_uno('SELECT id FROM productos WHERE codigo = ? AND id <> ?', [$datos['codigo'], $id]);
    if ($repetido) {
        error(409, 'Ya existe otro producto con el codigo ' . $datos['codigo']);
    }

    ejecutar(
        'UPDATE productos SET
           codigo = ?, nombre = ?, descripcion = ?, categoria_id = ?,
           unidad_medida = ?, precio_compra = ?, precio_venta = ?,
           stock_minimo = ?, stock_maximo = ?, controla_serial = ?,
           perecedero = ?, fecha_vencimiento = ?, activo = ?
         WHERE id = ?',
        [
            $datos['codigo'], $datos['nombre'], $datos['descripcion'],
            $datos['categoria_id'], $datos['unidad_medida'],
            $datos['precio_compra'], $datos['precio_venta'],
            $datos['stock_minimo'], $datos['stock_maximo'],
            $datos['controla_serial'], $datos['perecedero'],
            $datos['fecha_vencimiento'], $datos['activo'], $id,
        ]
    );

    auditar('editar', 'productos', $id, $anterior, $datos);
    responder(200, ['id' => $id, 'mensaje' => 'Producto actualizado']);
}

// ----------------------------------------------------------------------

function eliminarProducto()
{
    exigir_permiso(8, 'eliminar productos');

    $id = entero(entrada('id'));
    if ($id <= 0) {
        error(400, 'Falta el id del producto');
    }

    $producto = consultar_uno('SELECT * FROM productos WHERE id = ?', [$id]);
    if (!$producto) {
        error(404, 'Producto no encontrado');
    }

    // Si tiene movimientos NO se borra nunca (la bitacora es sagrada).
    // Se desactiva. El usuario ve el producto pero ya no opera con el.
    $movimientos = consultar_uno('SELECT COUNT(*) AS n FROM movimientos WHERE producto_id = ?', [$id]);

    // Si es ingrediente de una receta del menu tampoco se borra: romperia
    // la receta. Se desactiva igual, la cocina sigue pudiendo ver lo vendido.
    $en_receta = consultar_uno(
        'SELECT COUNT(*) AS n FROM combo_productos WHERE producto_id = ?',
        [$id]
    );

    if ((int) $movimientos['n'] > 0 || (int) $en_receta['n'] > 0) {
        ejecutar('UPDATE productos SET activo = 0 WHERE id = ?', [$id]);
        auditar('eliminar', 'productos', $id, $producto, ['desactivado' => true]);

        $motivo = (int) $movimientos['n'] > 0
            ? 'tiene ' . $movimientos['n'] . ' movimientos en su historial'
            : 'es ingrediente de ' . $en_receta['n'] . ' receta(s) del menu';

        responder(200, [
            'mensaje' => 'Producto desactivado (' . $motivo . ', por eso se conserva)',
            'desactivado' => true,
        ]);
    }

    // Sin movimientos: eliminacion definitiva
    ejecutar('DELETE FROM productos WHERE id = ?', [$id]);
    auditar('eliminar', 'productos', $id, $producto, null);

    responder(200, ['mensaje' => 'Producto eliminado']);
}

// ----------------------------------------------------------------------
//  Validacion comun
// ----------------------------------------------------------------------

function validarProducto()
{
    $codigo = trim((string) entrada('codigo', ''));
    $nombre = trim((string) entrada('nombre', ''));

    if ($codigo === '') {
        error(400, 'El codigo del producto es obligatorio');
    }
    if ($nombre === '') {
        error(400, 'El nombre del producto es obligatorio');
    }
    if (strlen($codigo) > 30) {
        error(400, 'El codigo no puede pasar de 30 caracteres');
    }
    if (strlen($nombre) > 150) {
        error(400, 'El nombre no puede pasar de 150 caracteres');
    }

    $precio_compra = decimal(entrada('precio_compra', 0));
    $precio_venta = decimal(entrada('precio_venta', 0));
    $stock_minimo = entero(entrada('stock_minimo', 0));
    $stock_maximo = entero(entrada('stock_maximo', 0));

    if ($precio_compra < 0 || $precio_venta < 0) {
        error(400, 'Los precios no pueden ser negativos');
    }
    if ($stock_minimo < 0 || $stock_maximo < 0) {
        error(400, 'El stock minimo y maximo no pueden ser negativos');
    }
    if ($stock_maximo > 0 && $stock_maximo < $stock_minimo) {
        error(400, 'El stock maximo no puede ser menor que el minimo');
    }

    $categoria_id = entrada('categoria_id');
    $categoria_id = $categoria_id ? entero($categoria_id) : null;

    // Verificamos que la categoria exista
    if ($categoria_id) {
        $existe = consultar_uno('SELECT id FROM categorias WHERE id = ?', [$categoria_id]);
        if (!$existe) {
            error(400, 'La categoria indicada no existe');
        }
    }

    $unidad = trim((string) entrada('unidad_medida', 'UND'));
    $permitidas = ['UND', 'KG', 'LT', 'CAJA', 'PAQ', 'MT', 'ROLLO', 'PAQUETE', 'POR'];
    if (!in_array($unidad, $permitidas, true)) {
        $unidad = 'UND';
    }

    $activo = entrada('activo', 1);
    $activo = ($activo === 0 || $activo === '0' || $activo === false) ? 0 : 1;

    // Fecha de vencimiento: solo para perecederos y en formato YYYY-MM-DD.
    $fecha_vencimiento = null;
    $perecedero = entrada('perecedero', 0) ? 1 : 0;
    $fecha_entrada = trim((string) entrada('fecha_vencimiento', ''));
    if ($perecedero && $fecha_entrada !== '') {
        $fecha = DateTime::createFromFormat('Y-m-d', $fecha_entrada);
        if (!$fecha || $fecha->format('Y-m-d') !== $fecha_entrada) {
            error(400, 'La fecha de vencimiento debe tener el formato AAAA-MM-DD');
        }
        $fecha_vencimiento = $fecha_entrada;
    }

    return [
        'codigo'          => $codigo,
        'nombre'          => $nombre,
        'descripcion'     => trim((string) entrada('descripcion', '')) ?: null,
        'categoria_id'    => $categoria_id,
        'unidad_medida'   => $unidad,
        'precio_compra'   => $precio_compra,
        'precio_venta'    => $precio_venta,
        'stock_minimo'    => $stock_minimo,
        'stock_maximo'    => $stock_maximo,
        'controla_serial' => entrada('controla_serial', 0) ? 1 : 0,
        'perecedero'      => $perecedero,
        'fecha_vencimiento' => $fecha_vencimiento,
        'activo'          => $activo,
    ];
}
