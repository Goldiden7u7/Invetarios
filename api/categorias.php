<?php
/**
 * API DE CATEGORIAS
 * -----------------------------------------------------------------
 * GET    /api/categorias.php         -> lista
 * POST   /api/categorias.php         -> crear
 * PUT    /api/categorias.php         -> editar
 * DELETE /api/categorias.php         -> eliminar
 */

require_once __DIR__ . '/nucleo.php';

$metodo = $_SERVER['REQUEST_METHOD'];

switch ($metodo) {
    case 'GET':    listarCategorias();    break;
    case 'POST':   crearCategoria();     break;
    case 'PUT':    editarCategoria();     break;
    case 'DELETE': eliminarCategoria();   break;
    default: error(405, 'Metodo no permitido');
}

// ----------------------------------------------------------------------

function listarCategorias()
{
    exigir_permiso(1, 'ver categorias');

    // Por defecto solo las activas. Pide estado=inactivos para verlas todas.
    $estado = (string) ($_GET['estado'] ?? 'activos');
    $filtro = in_array($estado, ['activos', 'inactivos', 'todos'], true) ? $estado : 'activos';

    $donde = match ($filtro) {
        'activos'   => 'WHERE c.activo = 1',
        'inactivos' => 'WHERE c.activo = 0',
        default     => '',
    };

    $filas = consultar(
        "SELECT c.*,
                COUNT(DISTINCT p.id) AS productos,
                COALESCE(SUM(st.cantidad), 0) AS unidades
         FROM categorias c
         LEFT JOIN productos p ON p.categoria_id = c.id AND p.activo = 1
         LEFT JOIN stock st ON st.producto_id = p.id
         $donde
         GROUP BY c.id
         ORDER BY c.nombre"
    );

    foreach ($filas as &$f) {
        $f['id'] = (int) $f['id'];
        $f['activo'] = (int) $f['activo'];
        $f['productos'] = (int) $f['productos'];
        $f['unidades'] = (int) $f['unidades'];
    }

    responder(200, $filas);
}

// ----------------------------------------------------------------------

function crearCategoria()
{
    exigir_permiso(2, 'crear categorias');

    $nombre = trim((string) entrada('nombre', ''));
    if ($nombre === '') error(400, 'El nombre de la categoria es obligatorio');
    if (strlen($nombre) > 80) error(400, 'El nombre no puede pasar de 80 caracteres');

    $existe = consultar_uno('SELECT id FROM categorias WHERE nombre = ?', [$nombre]);
    if ($existe) error(409, 'Ya existe una categoria con ese nombre');

    $id = ejecutar(
        'INSERT INTO categorias (nombre, descripcion, activo) VALUES (?,?,1)',
        [$nombre, trim((string) entrada('descripcion', '')) ?: null]
    );

    auditar('crear', 'categorias', $id, null, ['nombre' => $nombre]);
    responder(201, ['id' => $id, 'mensaje' => 'Categoria creada']);
}

// ----------------------------------------------------------------------

function editarCategoria()
{
    exigir_permiso(4, 'editar categorias');

    $id = entero(entrada('id'));
    if ($id <= 0) error(400, 'Falta el id de la categoria');

    $anterior = consultar_uno('SELECT * FROM categorias WHERE id = ?', [$id]);
    if (!$anterior) error(404, 'Categoria no encontrada');

    $nombre = trim((string) entrada('nombre'));
    if ($nombre === '') error(400, 'El nombre de la categoria es obligatorio');

    $repetida = consultar_uno('SELECT id FROM categorias WHERE nombre = ? AND id <> ?', [$nombre, $id]);
    if ($repetida) error(409, 'Ya existe otra categoria con ese nombre');

    $activo = entrada('activo', 1);
    $activo = ($activo === 0 || $activo === '0' || $activo === false) ? 0 : 1;

    ejecutar(
        'UPDATE categorias SET nombre=?, descripcion=?, activo=? WHERE id=?',
        [$nombre, trim((string) entrada('descripcion', '')) ?: null, $activo, $id]
    );

    auditar('editar', 'categorias', $id, $anterior, ['nombre' => $nombre]);
    responder(200, ['id' => $id, 'mensaje' => 'Categoria actualizada']);
}

// ----------------------------------------------------------------------

function eliminarCategoria()
{
    exigir_permiso(8, 'eliminar categorias');

    $id = entero(entrada('id'));
    if ($id <= 0) error(400, 'Falta el id de la categoria');

    $categoria = consultar_uno('SELECT * FROM categorias WHERE id = ?', [$id]);
    if (!$categoria) error(404, 'Categoria no encontrada');

    $productos = consultar_uno('SELECT COUNT(*) AS n FROM productos WHERE categoria_id = ?', [$id]);

    // Con productos no se borra: se desactiva. Los productos quedan sin
    // categoria (la FK es ON DELETE SET NULL, pero mejor no borrarla).
    if ((int) $productos['n'] > 0) {
        ejecutar('UPDATE categorias SET activo = 0 WHERE id = ?', [$id]);
        auditar('eliminar', 'categorias', $id, $categoria, ['desactivado' => true]);
        responder(200, [
            'mensaje' => 'Categoria desactivada (tiene ' . $productos['n'] . ' productos, por eso se conserva)',
            'desactivado' => true,
        ]);
    }

    ejecutar('DELETE FROM categorias WHERE id = ?', [$id]);
    auditar('eliminar', 'categorias', $id, $categoria, null);
    responder(200, ['mensaje' => 'Categoria eliminada']);
}
