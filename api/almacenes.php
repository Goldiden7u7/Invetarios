<?php
/**
 * API DE ALMACENES
 * -----------------------------------------------------------------
 * GET    /api/almacenes.php          -> lista
 * GET    /api/almacenes.php?id=1     -> uno con su stock
 * POST   /api/almacenes.php          -> crear
 * PUT    /api/almacenes.php          -> editar
 * DELETE /api/almacenes.php          -> eliminar (desactiva)
 */

require_once __DIR__ . '/nucleo.php';

$metodo = $_SERVER['REQUEST_METHOD'];

switch ($metodo) {
    case 'GET':    listarAlmacenes();    break;
    case 'POST':   crearAlmacen();      break;
    case 'PUT':    actualizarAlmacen();  break;
    case 'DELETE': eliminarAlmacen();    break;
    default: error(405, 'Metodo no permitido');
}

// ----------------------------------------------------------------------

function listarAlmacenes()
{
    exigir_permiso(1, 'ver almacenes');

    $id = entero($_GET['id'] ?? 0);

    if ($id > 0) {
        $almacen = consultar_uno('SELECT * FROM almacenes WHERE id = ?', [$id]);
        if (!$almacen) {
            error(404, 'Almacen no encontrado');
        }

        $almacen['stock_detalle'] = consultar(
            'SELECT producto_id, producto_codigo, producto_nombre, unidad_medida,
                    cantidad, stock_minimo, estado_stock, valor_costo, valor_venta
             FROM v_stock_detallado
             WHERE almacen_id = ?
             ORDER BY producto_codigo',
            [$id]
        );

        $resumen = consultar_uno(
            "SELECT COUNT(*) AS productos, COALESCE(SUM(cantidad),0) AS unidades,
                    COALESCE(SUM(valor_costo),0) AS valor_costo, COALESCE(SUM(valor_venta),0) AS valor_venta,
                    SUM(CASE WHEN estado_stock IN ('agotado','bajo') THEN 1 ELSE 0 END) AS alertas
             FROM v_stock_detallado WHERE almacen_id = ?",
            [$id]
        );

        $almacen['id'] = (int) $almacen['id'];
        $almacen['activo'] = (int) $almacen['activo'];
        $almacen['resumen'] = [
            'productos'    => (int) $resumen['productos'],
            'unidades'     => (int) $resumen['unidades'],
            'valor_costo'  => (float) $resumen['valor_costo'],
            'valor_venta'  => (float) $resumen['valor_venta'],
            'alertas'      => (int) $resumen['alertas'],
        ];

        responder(200, $almacen);
    }

    // Por defecto solo los activos. Pide estado=inactivos para verlos todos.
    $estado = (string) ($_GET['estado'] ?? 'activos');
    $donde = match ($estado) {
        'activos'   => 'WHERE a.activo = 1',
        'inactivos' => 'WHERE a.activo = 0',
        default     => '',
    };

    $filas = consultar(
        "SELECT a.*,
                COUNT(st.id) AS productos,
                COALESCE(SUM(st.cantidad), 0) AS unidades,
                COALESCE(SUM(st.cantidad * p.precio_compra), 0) AS valor_costo,
                COALESCE(SUM(st.cantidad * p.precio_venta), 0) AS valor_venta,
                COALESCE(SUM(CASE
                    WHEN p.stock_minimo > 0 AND st.cantidad <= p.stock_minimo THEN 1
                    ELSE 0 END), 0) AS alertas
         FROM almacenes a
         LEFT JOIN stock st ON st.almacen_id = a.id
         LEFT JOIN productos p ON p.id = st.producto_id
         $donde
         GROUP BY a.id
         ORDER BY a.nombre"
    );

    foreach ($filas as &$f) {
        $f['id'] = (int) $f['id'];
        $f['activo'] = (int) $f['activo'];
        $f['productos'] = (int) $f['productos'];
        $f['unidades'] = (int) $f['unidades'];
        $f['valor_costo'] = (float) $f['valor_costo'];
        $f['valor_venta'] = (float) $f['valor_venta'];
        $f['alertas'] = (int) $f['alertas'];
    }

    responder(200, $filas);
}

// ----------------------------------------------------------------------

function crearAlmacen()
{
    exigir_permiso(2, 'crear almacenes');

    $d = validarAlmacen();

    $id = ejecutar(
        'INSERT INTO almacenes (codigo, nombre, direccion, ciudad, telefono, responsable, activo)
         VALUES (?,?,?,?,?,?,1)',
        [$d['codigo'], $d['nombre'], $d['direccion'], $d['ciudad'], $d['telefono'], $d['responsable']]
    );

    auditar('crear', 'almacenes', $id, null, $d);
    responder(201, ['id' => $id, 'mensaje' => 'Almacen creado']);
}

// ----------------------------------------------------------------------

function actualizarAlmacen()
{
    exigir_permiso(4, 'editar almacenes');

    $id = entero(entrada('id'));
    if ($id <= 0) error(400, 'Falta el id del almacen');

    $anterior = consultar_uno('SELECT * FROM almacenes WHERE id = ?', [$id]);
    if (!$anterior) error(404, 'Almacen no encontrado');

    // Excluimos el propio id para no "encontrar" al almacen consigo mismo
    $d = validarAlmacen($id);

    ejecutar(
        'UPDATE almacenes SET codigo=?, nombre=?, direccion=?, ciudad=?,
                              telefono=?, responsable=?, activo=?
         WHERE id = ?',
        [$d['codigo'], $d['nombre'], $d['direccion'], $d['ciudad'],
         $d['telefono'], $d['responsable'], $d['activo'], $id]
    );

    auditar('editar', 'almacenes', $id, $anterior, $d);
    responder(200, ['id' => $id, 'mensaje' => 'Almacen actualizado']);
}

// ----------------------------------------------------------------------

function eliminarAlmacen()
{
    exigir_permiso(8, 'eliminar almacenes');

    $id = entero(entrada('id'));
    if ($id <= 0) error(400, 'Falta el id del almacen');

    $almacen = consultar_uno('SELECT * FROM almacenes WHERE id = ?', [$id]);
    if (!$almacen) error(404, 'Almacen no encontrado');

    // Con stock o movimientos jamas se borra: se desactiva.
    $tiene_datos = consultar_uno(
        'SELECT (SELECT COUNT(*) FROM stock WHERE almacen_id = ?) AS stock,
                (SELECT COUNT(*) FROM movimientos WHERE almacen_id = ?) AS movs',
        [$id, $id]
    );

    if ((int) $tiene_datos['stock'] > 0 || (int) $tiene_datos['movs'] > 0) {
        ejecutar('UPDATE almacenes SET activo = 0 WHERE id = ?', [$id]);
        auditar('eliminar', 'almacenes', $id, $almacen, ['desactivado' => true]);
        responder(200, ['mensaje' => 'Almacen desactivado (tiene datos historicos, por eso se conserva)', 'desactivado' => true]);
    }

    ejecutar('DELETE FROM almacenes WHERE id = ?', [$id]);
    auditar('eliminar', 'almacenes', $id, $almacen, null);
    responder(200, ['mensaje' => 'Almacen eliminado']);
}

// ----------------------------------------------------------------------

function validarAlmacen($excluir = 0)
{
    $codigo = strtoupper(trim((string) entrada('codigo', '')));
    $nombre = trim((string) entrada('nombre', ''));

    if ($codigo === '') error(400, 'El codigo del almacen es obligatorio');
    if ($nombre === '') error(400, 'El nombre del almacen es obligatorio');
    if (strlen($codigo) > 10) error(400, 'El codigo no puede pasar de 10 caracteres');

    // Solo letras, numeros, guion y guion bajo
    if (!preg_match('/^[A-Z0-9_-]+$/', $codigo)) {
        error(400, 'El codigo solo admite letras, numeros, guion y guion bajo (ej: CEN, N-1)');
    }

    // El codigo debe ser unico entre almacenes.
    // $excluir se usa al editar, para no comparar consigo mismo.
    $existe = consultar_uno(
        'SELECT id, nombre FROM almacenes WHERE codigo = ? AND id <> ?',
        [$codigo, $excluir]
    );
    if ($existe) {
        error(409, 'Ya existe un almacen con el codigo ' . $codigo . ' (' . $existe['nombre'] . ')');
    }

    $activo = entrada('activo', 1);
    $activo = ($activo === 0 || $activo === '0' || $activo === false) ? 0 : 1;

    return [
        'codigo'      => $codigo,
        'nombre'      => $nombre,
        'direccion'   => trim((string) entrada('direccion', '')) ?: null,
        'ciudad'      => trim((string) entrada('ciudad', '')) ?: null,
        'telefono'    => trim((string) entrada('telefono', '')) ?: null,
        'responsable' => trim((string) entrada('responsable', '')) ?: null,
        'activo'      => $activo,
    ];
}
