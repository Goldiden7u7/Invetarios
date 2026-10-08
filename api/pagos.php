<?php
/**
 * API DE PAGOS DE SERVICIOS
 * -----------------------------------------------------------------
 * GET  /api/pagos.php                 -> lista de pagos + resumen por rubro
 *      ?categoria=trabajadores        (transporte, local, servicios)
 *      ?desde=YYYY-MM-DD  ?hasta=YYYY-MM-DD
 *      ?pagina=1  ?por_pagina=50
 *
 * POST /api/pagos.php                 -> registrar un pago (retiro de la caja)
 *      Body: { categoria, monto, descripcion }
 *
 * DONDE VIVE: dentro de Movimientos > Caja, la seleccion de dinero del
 * dueno. Por eso pide el permiso de ventas (128): retirar plata de la caja
 * es una decision del negocio, no del que mueve mercaderia, y el cajero del
 * modulo Caja (256) no debe entrar. El administrador (1023) si, porque ve
 * los numeros y es quien responde por ese dinero.
 */

require_once __DIR__ . '/nucleo.php';

/** Los cuatro rubros de pago. El mismo orden se usa en la pestana del front. */
const CATEGORIAS_PAGO = ['trabajadores', 'transporte', 'local', 'servicios'];

const NOMBRES_CATEGORIA = [
    'trabajadores' => 'Pago de trabajadores',
    'transporte'   => 'Pago de transporte',
    'local'        => 'Pago del local',
    'servicios'    => 'Pago de servicios',
];

$metodo = $_SERVER['REQUEST_METHOD'];

switch ($metodo) {
    case 'GET':  listarPagos();  break;
    case 'POST': registrarPago(); break;
    default:     error(405, 'Metodo no permitido');
}

// ----------------------------------------------------------------------
//  LISTAR PAGOS
// ----------------------------------------------------------------------

function listarPagos()
{
    exigir_permiso(128, 'ver los pagos de servicios');

    $categoria  = (string) ($_GET['categoria'] ?? '');
    $desde      = (string) ($_GET['desde'] ?? '');
    $hasta      = (string) ($_GET['hasta'] ?? '');
    $pagina     = max(1, entero($_GET['pagina'] ?? 1, 1));
    $por_pagina = min(200, max(10, entero($_GET['por_pagina'] ?? 50, 50)));

    $donde = [];
    $params = [];

    if (in_array($categoria, CATEGORIAS_PAGO, true)) {
        $donde[] = 'p.categoria = ?';
        $params[] = $categoria;
    }
    if ($desde !== '') { $donde[] = 'p.creado_en >= ?'; $params[] = $desde . ' 00:00:00'; }
    if ($hasta !== '') { $donde[] = 'p.creado_en <= ?'; $params[] = $hasta . ' 23:59:59'; }

    $filtro = empty($donde) ? '' : 'WHERE ' . implode(' AND ', $donde);

    // Para los resumenes siempre hay una condicion extra (hoy / mes), asi
    // que si la lista no tenia filtros hay que abrir el WHERE.
    $prefijo = $filtro === '' ? 'WHERE ' : $filtro . ' AND ';

    $total  = consultar_uno("SELECT COUNT(*) AS n FROM pagos_servicios p $filtro", $params);
    $total  = (int) $total['n'];
    $offset = ($pagina - 1) * $por_pagina;

    $filas = consultar(
        "SELECT p.id, p.codigo, p.categoria, p.monto, p.descripcion, p.creado_en,
                u.nombre AS usuario_nombre
         FROM pagos_servicios p
         INNER JOIN usuarios u ON u.id = p.usuario_id
         $filtro
         ORDER BY p.creado_en DESC, p.id DESC
         LIMIT $por_pagina OFFSET $offset",
        $params
    );

    foreach ($filas as &$f) {
        $f['id'] = (int) $f['id'];
        $f['monto'] = (float) $f['monto'];
        $f['descripcion'] = (string) $f['descripcion'];
    }
    unset($f);

    // --- Cuanto se retiro HOY (con el mismo filtro de la lista) --------
    $hoy = consultar_uno(
        "SELECT COUNT(*) AS pagos, COALESCE(SUM(p.monto),0) AS total
         FROM pagos_servicios p $prefijo DATE(p.creado_en) = CURDATE()",
        $params
    );

    // --- Cuanto lleva el MES --------------------------------------------
    $mes = consultar_uno(
        "SELECT COUNT(*) AS pagos, COALESCE(SUM(p.monto),0) AS total
         FROM pagos_servicios p $prefijo YEAR(p.creado_en) = YEAR(NOW()) AND MONTH(p.creado_en) = MONTH(NOW())",
        $params
    );

    // --- Cuanto va por rubro --------------------------------------------
    $por_categoria = consultar(
        "SELECT p.categoria, COUNT(*) AS pagos, COALESCE(SUM(p.monto),0) AS total
         FROM pagos_servicios p $filtro
         GROUP BY p.categoria
         ORDER BY total DESC",
        $params
    );

    foreach ($por_categoria as &$c) {
        $c['pagos'] = (int) $c['pagos'];
        $c['total'] = (float) $c['total'];
    }
    unset($c);

    responder(200, [
        'pagos' => $filas,
        'resumen' => [
            'hoy' => [
                'pagos' => (int) ($hoy['pagos'] ?? 0),
                'total' => (float) ($hoy['total'] ?? 0),
            ],
            'mes' => [
                'pagos' => (int) ($mes['pagos'] ?? 0),
                'total' => (float) ($mes['total'] ?? 0),
            ],
            'por_categoria' => $por_categoria,
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
//  REGISTRAR PAGO
// ----------------------------------------------------------------------

function registrarPago()
{
    $usuario = exigir_permiso(2 | 128, 'retirar dinero de la caja');

    $categoria   = (string) entrada('categoria', '');
    $monto       = decimal(entrada('monto'));
    $descripcion = trim((string) entrada('descripcion', ''));

    if (!in_array($categoria, CATEGORIAS_PAGO, true)) {
        error(400, 'Categoria no valida (use: trabajadores, transporte, local o servicios)');
    }
    if ($monto <= 0) {
        error(400, 'El monto debe ser mayor que cero');
    }
    if ($descripcion === '') {
        error(400, 'Escribe una descripcion de para que fue el pago');
    }
    if (mb_strlen($descripcion) > 255) {
        error(400, 'La descripcion no puede pasar de 255 caracteres');
    }

    $codigo = generar_codigo('PGS', 'pagos_servicios', 'codigo');

    $id = ejecutar(
        'INSERT INTO pagos_servicios (codigo, categoria, monto, descripcion, usuario_id)
         VALUES (?, ?, ?, ?, ?)',
        [$codigo, $categoria, $monto, $descripcion, $usuario['id']]
    );

    auditar('crear', 'pagos_servicios', $id, null, [
        'codigo' => $codigo,
        'categoria' => $categoria,
        'monto' => $monto,
        'descripcion' => $descripcion,
    ]);

    responder(201, [
        'id' => $id,
        'codigo' => $codigo,
        'mensaje' => NOMBRES_CATEGORIA[$categoria] . ' retirado: ' . number_format($monto, 2),
    ]);
}