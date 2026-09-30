<?php
/**
 * API DE COMBOS (MENU DE CAJA)
 * -----------------------------------------------------------------
 * GET    /api/combos.php                    -> lista el menu, con recetas
 * GET    /api/combos.php?id=5               -> detalle completo de un combo
 * POST   /api/combos.php                    -> crear (receta + opcionales)
 * PUT    /api/combos.php                    -> editar (reemplaza la receta)
 * DELETE /api/combos.php                    -> eliminar (desactiva si ya se vendio)
 *
 * Cada combo tiene:
 *   - ingredientes (combo_productos): lo que CONSUME de inventario y se
 *     descuenta del stock al venderlo (p. ej. hamburguesa = pan, carne...).
 *   - opcionales (combo_opcionales): extra que el cliente puede pedir y
 *     su precio adicional ("agregar tocineta +0,75").
 *
 * Permisos: ver=1, crear/editar=4, eliminar=8.
 */

require_once __DIR__ . '/nucleo.php';

$metodo = $_SERVER['REQUEST_METHOD'];

switch ($metodo) {
    case 'GET':    listarCombos();    break;
    case 'POST':   crearCombo();      break;
    case 'PUT':    actualizarCombo(); break;
    case 'DELETE': eliminarCombo();   break;
    default:
        error(405, 'Metodo no permitido');
}

// ----------------------------------------------------------------------

function listarCombos()
{
    exigir_permiso(1, 'ver el menu');

    $id   = entero($_GET['id'] ?? 0);
    $tipo = (string) ($_GET['tipo'] ?? '');
    $q    = trim((string) ($_GET['q'] ?? ''));
    $estado = (string) ($_GET['estado'] ?? 'activos');

    // Detalle de un solo combo (con receta completa)
    if ($id > 0) {
        $combo = consultar_uno(
            'SELECT c.*,
                    (SELECT COALESCE(SUM(cp.cantidad * p.precio_compra),0)
                       FROM combo_productos cp
                       INNER JOIN productos p ON p.id = cp.producto_id
                      WHERE cp.combo_id = c.id) AS costo_estimado
             FROM combos c WHERE c.id = ? LIMIT 1',
            [$id]
        );

        if (!$combo) {
            error(404, 'El combo no existe');
        }

        $combo['ingredientes'] = consultar(
            'SELECT cp.producto_id, p.codigo, p.nombre, p.unidad_medida,
                    p.precio_compra, cp.cantidad
             FROM combo_productos cp
             INNER JOIN productos p ON p.id = cp.producto_id
             WHERE cp.combo_id = ?
             ORDER BY p.nombre',
            [$id]
        );

        $combo['opcionales'] = consultar(
            'SELECT co.producto_id, p.codigo, p.nombre, p.unidad_medida,
                    co.cantidad, co.precio_extra
             FROM combo_opcionales co
             INNER JOIN productos p ON p.id = co.producto_id
             WHERE co.combo_id = ?
             ORDER BY p.nombre',
            [$id]
        );

        foreach ($combo['opcionales'] as &$o) {
            $o['precio_extra'] = (float) $o['precio_extra'];
        }
        unset($o);

        $combo['id'] = (int) $combo['id'];
        $combo['precio_venta'] = (float) $combo['precio_venta'];
        $combo['costo_estimado'] = (float) $combo['costo_estimado'];
        $combo['requiere_cocina'] = (int) $combo['requiere_cocina'];
        $combo['activo'] = (int) $combo['activo'];

        responder(200, $combo);
        return;
    }

    $donde  = [];
    $params = [];

    if ($tipo !== '' && in_array($tipo, ['comida', 'snack', 'bebida'], true)) {
        $donde[] = 'c.tipo = ?';
        $params[] = $tipo;
    }
    if ($q !== '') {
        $donde[] = '(c.nombre LIKE ? OR c.codigo LIKE ?)';
        $params[] = "%$q%";
        $params[] = "%$q%";
    }
    if ($estado === 'activos') {
        $donde[] = 'c.activo = 1';
    }
    $filtro = empty($donde) ? '' : 'WHERE ' . implode(' AND ', $donde);

    $filas = consultar(
        "SELECT c.id, c.codigo, c.nombre, c.descripcion, c.tipo,
                c.precio_venta, c.requiere_cocina, c.activo, c.creado_en,
                (SELECT COALESCE(SUM(cp.cantidad * p.precio_compra),0)
                   FROM combo_productos cp
                   INNER JOIN productos p ON p.id = cp.producto_id
                  WHERE cp.combo_id = c.id) AS costo_estimado,
                (SELECT COUNT(*) FROM combo_productos cp WHERE cp.combo_id = c.id) AS n_ingredientes,
                (SELECT COUNT(*) FROM combo_opcionales co WHERE co.combo_id = c.id) AS n_opcionales,
                (SELECT COALESCE(SUM(vi.cantidad),0)
                   FROM venta_items vi
                   INNER JOIN ventas v ON v.id = vi.venta_id AND v.estado = 'completada'
                  WHERE vi.combo_id = c.id) AS veces_vendido
         FROM combos c
         $filtro
         ORDER BY FIELD(c.tipo, 'comida', 'snack', 'bebida'), c.nombre",
        $params
    );

    foreach ($filas as &$f) {
        $f['id'] = (int) $f['id'];
        $f['precio_venta'] = (float) $f['precio_venta'];
        $f['costo_estimado'] = (float) $f['costo_estimado'];
        $f['n_ingredientes'] = (int) $f['n_ingredientes'];
        $f['n_opcionales'] = (int) $f['n_opcionales'];
        $f['veces_vendido'] = (int) $f['veces_vendido'];
        $f['requiere_cocina'] = (int) $f['requiere_cocina'];
        $f['activo'] = (int) $f['activo'];
    }
    unset($f);

    responder(200, ['combos' => $filas]);
}

// ----------------------------------------------------------------------

function crearCombo()
{
    exigir_permiso(4, 'crear combos');

    $datos = validarCombo();

    $repetido = consultar_uno('SELECT id, nombre FROM combos WHERE codigo = ?', [$datos['codigo']]);
    if ($repetido) {
        error(409, 'Ya existe un combo con el codigo ' . $datos['codigo'] . ' (' . $repetido['nombre'] . ')');
    }

    $conexion = bd();
    $conexion->begin_transaction();

    try {
        $id = ejecutar(
            'INSERT INTO combos
             (codigo, nombre, descripcion, tipo, precio_venta, requiere_cocina, activo)
             VALUES (?,?,?,?,?,?,?)',
            [
                $datos['codigo'], $datos['nombre'], $datos['descripcion'], $datos['tipo'],
                $datos['precio_venta'], $datos['requiere_cocina'], $datos['activo'],
            ]
        );

        guardarReceta($id, $datos['ingredientes'], $datos['opcionales']);

        $conexion->commit();
    } catch (Throwable $e) {
        $conexion->rollback();
        error_log('Error creando combo: ' . $e->getMessage());
        error(500, 'No se pudo guardar el combo. Se revirtieron los cambios.');
    }

    auditar('crear', 'combos', $id, null, $datos);
    responder(201, ['id' => $id, 'mensaje' => 'Combo creado con su receta']);
}

// ----------------------------------------------------------------------

function actualizarCombo()
{
    exigir_permiso(4, 'editar combos');

    $id = entero(entrada('id'));
    if ($id <= 0) {
        error(400, 'Falta el id del combo');
    }

    $anterior = consultar_uno('SELECT * FROM combos WHERE id = ?', [$id]);
    if (!$anterior) {
        error(404, 'El combo no existe');
    }

    $datos = validarCombo();

    $repetido = consultar_uno('SELECT id FROM combos WHERE codigo = ? AND id <> ?', [$datos['codigo'], $id]);
    if ($repetido) {
        error(409, 'Ya existe otro combo con el codigo ' . $datos['codigo']);
    }

    $conexion = bd();
    $conexion->begin_transaction();

    try {
        ejecutar(
            'UPDATE combos SET
               codigo = ?, nombre = ?, descripcion = ?, tipo = ?,
               precio_venta = ?, requiere_cocina = ?, activo = ?
             WHERE id = ?',
            [
                $datos['codigo'], $datos['nombre'], $datos['descripcion'], $datos['tipo'],
                $datos['precio_venta'], $datos['requiere_cocina'], $datos['activo'], $id,
            ]
        );

        // La receta se reemplaza completa (borra + inserta), siempre en la
        // misma transaccion para que nunca quede un combo sin receta.
        ejecutar('DELETE FROM combo_productos  WHERE combo_id = ?', [$id]);
        ejecutar('DELETE FROM combo_opcionales WHERE combo_id = ?', [$id]);
        guardarReceta($id, $datos['ingredientes'], $datos['opcionales']);

        $conexion->commit();
    } catch (Throwable $e) {
        $conexion->rollback();
        error_log('Error actualizando combo: ' . $e->getMessage());
        error(500, 'No se pudo actualizar el combo. Se revirtieron los cambios.');
    }

    auditar('editar', 'combos', $id, $anterior, $datos);
    responder(200, ['id' => $id, 'mensaje' => 'Combo actualizado']);
}

// ----------------------------------------------------------------------

function eliminarCombo()
{
    exigir_permiso(8, 'eliminar combos');

    $id = entero(entrada('id'));
    if ($id <= 0) {
        error(400, 'Falta el id del combo');
    }

    $combo = consultar_uno('SELECT * FROM combos WHERE id = ?', [$id]);
    if (!$combo) {
        error(404, 'El combo no existe');
    }

    $vendidos = consultar_uno('SELECT COUNT(*) AS n FROM venta_items WHERE combo_id = ?', [$id]);

    if ((int) $vendidos['n'] > 0) {
        ejecutar('UPDATE combos SET activo = 0 WHERE id = ?', [$id]);
        auditar('eliminar', 'combos', $id, $combo, ['desactivado' => true]);
        responder(200, [
            'mensaje' => 'Combo desactivado (aparece en ' . $vendidos['n'] . ' ventas, su historial se conserva)',
            'desactivado' => true,
        ]);
        return;
    }

    $conexion = bd();
    $conexion->begin_transaction();
    try {
        ejecutar('DELETE FROM combo_productos  WHERE combo_id = ?', [$id]);
        ejecutar('DELETE FROM combo_opcionales WHERE combo_id = ?', [$id]);
        ejecutar('DELETE FROM combos WHERE id = ?', [$id]);
        $conexion->commit();
    } catch (Throwable $e) {
        $conexion->rollback();
        error_log('Error eliminando combo: ' . $e->getMessage());
        error(500, 'No se pudo eliminar el combo.');
    }

    auditar('eliminar', 'combos', $id, $combo, null);
    responder(200, ['mensaje' => 'Combo eliminado']);
}

// ----------------------------------------------------------------------
//  Receta y validaciones
// ----------------------------------------------------------------------

/**
 * Inserta ingredientes y opcionales de un combo. Se llama dentro de una
 * transaccion ya abierta (nunca fuera de ella).
 */
function guardarReceta($combo_id, $ingredientes, $opcionales)
{
    foreach ($ingredientes as $ing) {
        ejecutar(
            'INSERT INTO combo_productos (combo_id, producto_id, cantidad) VALUES (?,?,?)',
            [$combo_id, $ing['producto_id'], $ing['cantidad']]
        );
    }

    foreach ($opcionales as $op) {
        ejecutar(
            'INSERT INTO combo_opcionales (combo_id, producto_id, cantidad, precio_extra) VALUES (?,?,?,?)',
            [$combo_id, $op['producto_id'], $op['cantidad'], $op['precio_extra']]
        );
    }
}

function validarCombo()
{
    $codigo  = trim((string) entrada('codigo', ''));
    $nombre  = trim((string) entrada('nombre', ''));
    $tipo    = (string) entrada('tipo', 'comida');

    if ($codigo === '')  error(400, 'El codigo del combo es obligatorio');
    if ($nombre === '')  error(400, 'El nombre del combo es obligatorio');
    if (strlen($codigo) > 20) error(400, 'El codigo no puede pasar de 20 caracteres');
    if (strlen($nombre) > 120) error(400, 'El nombre no puede pasar de 120 caracteres');
    if (!in_array($tipo, ['comida', 'snack', 'bebida'], true)) {
        error(400, 'Tipo de combo no valido (use: comida, snack o bebida)');
    }

    $precio = decimal(entrada('precio_venta', 0));
    if ($precio < 0) error(400, 'El precio no puede ser negativo');

    // Ingredientes: lista de {producto_id, cantidad}
    $ingredientes = [];
    $ingresados = entrada('ingredientes', []);
    if (!is_array($ingresados) || count($ingresados) === 0) {
        error(400, 'El combo debe tener al menos un ingrediente en su receta');
    }

    $vistos = [];
    foreach ($ingresados as $ing) {
        $pid = entero($ing['producto_id'] ?? 0);
        $cant = entero($ing['cantidad'] ?? 1);

        if ($pid <= 0) error(400, 'Hay un ingrediente sin producto');
        if ($cant < 1) error(400, 'Las cantidades de la receta deben ser mayores que cero');
        if (isset($vistos[$pid])) error(400, 'El producto ' . $pid . ' esta repetido en la receta');
        $vistos[$pid] = true;

        $producto = consultar_uno('SELECT id, nombre FROM productos WHERE id = ?', [$pid]);
        if (!$producto) error(400, 'El producto ' . $pid . ' de la receta no existe');

        $ingredientes[] = ['producto_id' => $pid, 'cantidad' => $cant];
    }

    // Opcionales: lista de {producto_id, cantidad, precio_extra}
    $opcionales = [];
    $opcionales_entrada = entrada('opcionales', []);
    if (is_array($opcionales_entrada)) {
        $vistos_op = [];
        foreach ($opcionales_entrada as $op) {
            $pid = entero($op['producto_id'] ?? 0);
            $cant = entero($op['cantidad'] ?? 1);
            $precio_extra = decimal($op['precio_extra'] ?? 0);

            if ($pid <= 0) error(400, 'Hay un ingrediente opcional sin producto');
            if ($cant < 1) error(400, 'La cantidad de un opcional debe ser mayor que cero');
            if ($precio_extra < 0) error(400, 'El precio extra no puede ser negativo');
            if (isset($vistos_op[$pid])) error(400, 'El producto ' . $pid . ' esta repetido en los opcionales');
            $vistos_op[$pid] = true;

            $producto = consultar_uno('SELECT id, nombre FROM productos WHERE id = ?', [$pid]);
            if (!$producto) error(400, 'El producto opcional ' . $pid . ' no existe');

            $opcionales[] = ['producto_id' => $pid, 'cantidad' => $cant, 'precio_extra' => $precio_extra];
        }
    }

    $activo = entrada('activo', 1);
    $activo = ($activo === 0 || $activo === '0' || $activo === false) ? 0 : 1;

    return [
        'codigo'           => $codigo,
        'nombre'           => $nombre,
        'descripcion'      => trim((string) entrada('descripcion', '')) ?: null,
        'tipo'             => $tipo,
        'precio_venta'     => $precio,
        'requiere_cocina'  => entrada('requiere_cocina', 0) ? 1 : 0,
        'activo'           => $activo,
        'ingredientes'     => $ingredientes,
        'opcionales'       => $opcionales,
    ];
}