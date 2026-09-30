<?php
/**
 * API DEL DASHBOARD
 * -----------------------------------------------------------------
 * GET /api/dashboard.php            -> todas las metricas
 * GET /api/dashboard.php?tipo=graficas -> solo las series de las graficas
 *
 * Alimenta las tarjetas de resumen y las graficas de la pantalla principal.
 */

require_once __DIR__ . '/nucleo.php';

$usuario = exigir_permiso(1, 'ver el dashboard');
$tipo = (string) ($_GET['tipo'] ?? 'todo');

if ($tipo === 'graficas') {
    responder(200, obtenerGraficas());
}

responder(200, [
    'metricas'   => obtenerMetricas($usuario),
    'graficas'   => obtenerGraficas(),
    'alertas'    => obtenerAlertas(),
    'ultimos'    => obtenerUltimosMovimientos(),
    'top'        => obtenerTopProductos(),
]);

// ----------------------------------------------------------------------
//  Tarjetas de resumen
// ----------------------------------------------------------------------

function obtenerMetricas($usuario)
{
    $general = consultar_uno(
        "SELECT
            (SELECT COUNT(*) FROM productos WHERE activo = 1) AS productos_activos,
            (SELECT COUNT(*) FROM almacenes WHERE activo = 1) AS almacenes_activos,
            (SELECT COALESCE(SUM(cantidad),0) FROM stock) AS unidades_totales,
            (SELECT COALESCE(SUM(valor_costo),0) FROM v_stock_detallado) AS valor_costo,
            (SELECT COALESCE(SUM(valor_venta),0) FROM v_stock_detallado) AS valor_venta,
            (SELECT COUNT(*) FROM v_alertas_stock) AS alertas_stock,
            (SELECT COUNT(*) FROM v_alertas_stock WHERE estado_stock = 'agotado') AS agotados,
            (SELECT COUNT(*) FROM usuarios WHERE activo = 1) AS usuarios_activos,
            (SELECT COUNT(*) FROM pedidos WHERE estado IN ('pendiente','en_preparacion')) AS pedidos_pendientes,
            (SELECT COUNT(DISTINCT p.id) FROM productos p
              WHERE p.activo = 1 AND p.perecedero = 1 AND p.fecha_vencimiento IS NOT NULL
                AND p.fecha_vencimiento <= DATE_ADD(CURDATE(), INTERVAL 7 DAY)) AS proximos_vencer"
    );

    // Movimientos del mes en curso
    $mes = consultar_uno(
        "SELECT
            SUM(CASE WHEN tipo = 'entrada' THEN cantidad ELSE 0 END) AS entradas,
            SUM(CASE WHEN tipo = 'salida'  THEN ABS(cantidad) ELSE 0 END) AS salidas,
            COUNT(*) AS total
         FROM movimientos
         WHERE YEAR(creado_en) = YEAR(NOW()) AND MONTH(creado_en) = MONTH(NOW())"
    );

    // Movimientos de hoy, para la tarjeta de actividad
    $hoy = consultar_uno(
        "SELECT COUNT(*) AS total,
                SUM(CASE WHEN tipo = 'entrada' THEN cantidad ELSE 0 END) AS entradas,
                SUM(CASE WHEN tipo = 'salida'  THEN ABS(cantidad) ELSE 0 END) AS salidas
         FROM movimientos
         WHERE DATE(creado_en) = CURDATE()"
    );

    // --- Modulo de ventas / caja ---
    $ventas_hoy = consultar_uno(
        "SELECT COUNT(*) AS ventas, COALESCE(SUM(total),0) AS total,
                COALESCE(SUM(subtotal - costo_total),0) AS ganancia
         FROM ventas WHERE estado = 'completada' AND DATE(creado_en) = CURDATE()"
    );
    $ventas_mes = consultar_uno(
        "SELECT COUNT(*) AS ventas, COALESCE(SUM(total),0) AS total,
                COALESCE(SUM(subtotal - costo_total),0) AS ganancia
         FROM ventas WHERE estado = 'completada'
           AND YEAR(creado_en) = YEAR(NOW()) AND MONTH(creado_en) = MONTH(NOW())"
    );
    $ganancia = consultar_uno(
        "SELECT COALESCE(SUM(total),0) AS total, COALESCE(SUM(total - costo_total),0) AS ganancia
         FROM ventas WHERE estado = 'completada'"
    );

    $costo = (float) $general['valor_costo'];
    $venta = (float) $general['valor_venta'];

    return [
        'productos_activos'   => (int) $general['productos_activos'],
        'almacenes_activos'   => (int) $general['almacenes_activos'],
        'unidades_totales'    => (int) $general['unidades_totales'],
        'valor_costo'         => $costo,
        'valor_venta'         => $venta,
        'utilidad_potencial'  => $venta - $costo,
        'margen_porcentaje'   => $costo > 0 ? round((($venta - $costo) / $venta) * 100, 1) : 0,
        'alertas_stock'       => (int) $general['alertas_stock'],
        'agotados'            => (int) $general['agotados'],
        'usuarios_activos'    => (int) $general['usuarios_activos'],
        'pedidos_pendientes'  => (int) $general['pedidos_pendientes'],
        'proximos_vencer'     => (int) $general['proximos_vencer'],
        'ventas_hoy' => [
            'ventas'  => (int) $ventas_hoy['ventas'],
            'total'   => (float) $ventas_hoy['total'],
            'ganancia'=> (float) $ventas_hoy['ganancia'],
        ],
        'ventas_mes' => [
            'ventas'  => (int) $ventas_mes['ventas'],
            'total'   => (float) $ventas_mes['total'],
            'ganancia'=> (float) $ventas_mes['ganancia'],
        ],
        'ganancia_real'        => (float) $ganancia['ganancia'],
        'ventas_totales'       => (float) $ganancia['total'],
        'margen_venta_real'    => (float) $ganancia['total'] > 0
            ? round(($ganancia['ganancia'] / $ganancia['total']) * 100, 1) : 0,
        'mes' => [
            'entradas' => (int) ($mes['entradas'] ?? 0),
            'salidas'  => (int) ($mes['salidas'] ?? 0),
            'total'    => (int) ($mes['total'] ?? 0),
        ],
        'hoy' => [
            'entradas' => (int) ($hoy['entradas'] ?? 0),
            'salidas'  => (int) ($hoy['salidas'] ?? 0),
            'total'    => (int) ($hoy['total'] ?? 0),
        ],
    ];
}

// ----------------------------------------------------------------------
//  Series para las graficas
// ----------------------------------------------------------------------

function obtenerGraficas()
{
    // Movimientos por dia (ultimos 30 dias)
    $movimientos_dia = consultar(
        "SELECT DATE(creado_en) AS fecha,
                SUM(CASE WHEN tipo = 'entrada' THEN cantidad ELSE 0 END) AS entradas,
                SUM(CASE WHEN tipo = 'salida'  THEN ABS(cantidad) ELSE 0 END) AS salidas
         FROM movimientos
         WHERE creado_en >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
         GROUP BY DATE(creado_en)
         ORDER BY fecha"
    );

    // Ventas por dia (ultimos 30 dias, con ceros para los dias sin venta)
    $ventas_por_dia = consultar(
        "SELECT DATE(v.creado_en) AS fecha,
                COUNT(*) AS ventas,
                COALESCE(SUM(v.total), 0) AS total
         FROM ventas v
         WHERE v.estado = 'completada' AND v.creado_en >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
         GROUP BY DATE(v.creado_en)"
    );
    $ventas_diarias = array_fill(0, 30, ['fecha' => '', 'ventas' => 0, 'total' => 0]);
    $mapa_ventas = [];
    foreach ($ventas_por_dia as $vd) {
        $mapa_ventas[$vd['fecha']] = [
            'ventas' => (int) $vd['ventas'],
            'total'  => (float) $vd['total'],
        ];
    }
    for ($i = 29; $i >= 0; $i--) {
        $fecha = date('Y-m-d', strtotime("-$i days"));
        $ventas_diarias[29 - $i] = [
            'fecha'  => $fecha,
            'ventas' => $mapa_ventas[$fecha]['ventas'] ?? 0,
            'total'  => $mapa_ventas[$fecha]['total'] ?? 0,
        ];
    }

    // Ventas por semana (ultimas 8): se agrupan desde el lunes
    $ventas_por_dia_56 = consultar(
        "SELECT DATE(v.creado_en) AS fecha,
                COUNT(*) AS ventas,
                COALESCE(SUM(v.total), 0) AS total
         FROM ventas v
         WHERE v.estado = 'completada' AND v.creado_en >= DATE_SUB(CURDATE(), INTERVAL 56 DAY)
         GROUP BY DATE(v.creado_en)"
    );
    $dias_ventas = [];
    foreach ($ventas_por_dia_56 as $vd) {
        $dias_ventas[$vd['fecha']] = [
            'ventas' => (int) $vd['ventas'],
            'total'  => (float) $vd['total'],
        ];
    }
    $ventas_semanales = [];
    $hoy = new DateTime('today');
    $lunes_actual = (clone $hoy)->modify('monday this week');
    for ($w = 8; $w >= 1; $w--) {
        $inicio = (clone $lunes_actual)->modify('-' . ($w - 1) . ' weeks');
        $fin = (clone $inicio)->modify('+6 days');
        $totales = ['ventas' => 0, 'total' => 0.0];
        for ($d = 0; $d < 7; $d++) {
            $f = $inicio->format('Y-m-d');
            if ($f > date('Y-m-d')) break;
            if (isset($dias_ventas[$f])) {
                $totales['ventas'] += $dias_ventas[$f]['ventas'];
                $totales['total']  += $dias_ventas[$f]['total'];
            }
            $inicio->modify('+1 day');
        }
        $ventas_semanales[] = [
            'semana' => $fin->format('d/m'),
            'ventas' => $totales['ventas'],
            'total'  => round($totales['total'], 2),
        ];
    }

    // Top 5 combos mas vendidos de la historia
    $top_combos = consultar(
        "SELECT c.id, c.nombre, c.tipo,
                SUM(vi.cantidad) AS unidades,
                SUM(vi.subtotal) AS venta_total
         FROM venta_items vi
         INNER JOIN combos c ON c.id = vi.combo_id
         INNER JOIN ventas v ON v.id = vi.venta_id AND v.estado = 'completada'
         GROUP BY c.id, c.nombre, c.tipo
         ORDER BY unidades DESC
         LIMIT 5"
    );

    // Top 10 ingredientes/productos consumidos (desglosando las recetas
    // personalizadas). MariaDB 10.4 no tiene JSON_TABLE, asi que el desglose
    // se hace aqui en PHP con los snapshots de ingredientess.
    $top_productos = [];
    $items_recientes = consultar(
        "SELECT vi.ingredientes, vi.cantidad AS veces
         FROM venta_items vi
         INNER JOIN ventas v ON v.id = vi.venta_id AND v.estado = 'completada'
         WHERE vi.ingredientes IS NOT NULL AND vi.ingredientes <> ''
           AND v.creado_en >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)
         ORDER BY v.creado_en DESC
         LIMIT 300"
    );
    $acumulado = [];
    foreach ($items_recientes as $item) {
        $snapshot = json_decode($item['ingredientes'], true);
        $lista = (is_array($snapshot) && isset($snapshot['ingredientes'])) ? $snapshot['ingredientes'] : [];
        foreach ($lista as $ing) {
            $clave = (string) ($ing['producto_id'] ?? 0);
            $nombre = (string) ($ing['nombre'] ?? ('Producto ' . $clave));
            if ($clave === '0') continue;
            $acumulado[$clave]['nombre'] = $nombre;
            $acumulado[$clave]['cantidad'] = ($acumulado[$clave]['cantidad'] ?? 0) + ((int) $ing['cantidad'] * (int) $item['veces']);
        }
    }

    // Se ordena por cantidad consumida de mayor a menor
    $lista_productos = [];
    foreach ($acumulado as $pid => $tp) {
        $lista_productos[] = ['producto_id' => (int) $pid, 'nombre' => $tp['nombre'], 'cantidad' => (int) $tp['cantidad']];
    }
    usort($lista_productos, fn ($a, $b) => $b['cantidad'] <=> $a['cantidad']);
    $top_productos = array_slice($lista_productos, 0, 10);

    // Stock por almacen
    $por_almacen = consultar(
        "SELECT a.nombre, a.codigo,
                COALESCE(SUM(s.cantidad), 0) AS unidades,
                COALESCE(SUM(s.cantidad * p.precio_venta), 0) AS valor
         FROM almacenes a
         LEFT JOIN stock s ON s.almacen_id = a.id
         LEFT JOIN productos p ON p.id = s.producto_id
         WHERE a.activo = 1
         GROUP BY a.id, a.nombre, a.codigo
         ORDER BY valor DESC"
    );

    // Productos por categoria (top 8)
    $por_categoria = consultar(
        "SELECT COALESCE(c.nombre, 'Sin categoria') AS categoria,
                COALESCE(SUM(st.cantidad), 0) AS unidades
         FROM productos p
         LEFT JOIN categorias c ON c.id = p.categoria_id
         LEFT JOIN stock st ON st.producto_id = p.id
         WHERE p.activo = 1
         GROUP BY c.id, c.nombre
         ORDER BY unidades DESC
         LIMIT 8"
    );

    // Top 5 productos con mas movimiento
    // Nota: MySQL no permite ordenar por un alias de agregacion, asi que
    // primero calculamos en una subconsulta y ordenamos por el resultado.
    $top_movimientos = consultar(
        "SELECT nombre, codigo, entradas, salidas
         FROM (
            SELECT p.nombre, p.codigo,
                   SUM(CASE WHEN m.tipo = 'entrada' THEN m.cantidad ELSE 0 END) AS entradas,
                   SUM(CASE WHEN m.tipo = 'salida'  THEN ABS(m.cantidad) ELSE 0 END) AS salidas
            FROM movimientos m
            INNER JOIN productos p ON p.id = m.producto_id
            GROUP BY p.id, p.nombre, p.codigo
         ) AS t
         ORDER BY (entradas + salidas) DESC
         LIMIT 5"
    );
    foreach ($por_almacen as &$a) {
        $a['unidades'] = (int) $a['unidades'];
        $a['valor'] = (float) $a['valor'];
    }
    foreach ($por_categoria as &$c) {
        $c['unidades'] = (int) $c['unidades'];
    }
    foreach ($top_movimientos as &$t) {
        $t['entradas'] = (int) $t['entradas'];
        $t['salidas'] = (int) $t['salidas'];
    }
    foreach ($movimientos_dia as &$m) {
        $m['entradas'] = (int) $m['entradas'];
        $m['salidas'] = (int) $m['salidas'];
    }
    $top_combos_lista = [];
    foreach ($top_combos as &$tc) {
        $tc['id'] = (int) $tc['id'];
        $tc['unidades'] = (int) $tc['unidades'];
        $tc['venta_total'] = (float) $tc['venta_total'];
        $top_combos_lista[] = $tc;
    }
    unset($tc);
    $top_productos_lista = $top_productos;

    return [
        'movimientos_diarios' => $movimientos_dia,
        'stock_por_almacen'  => $por_almacen,
        'por_categoria'      => $por_categoria,
        'top_movimientos'    => $top_movimientos,
        'ventas_diarias'     => $ventas_diarias,
        'ventas_semanales'   => $ventas_semanales,
        'top_combos'         => $top_combos_lista,
        'top_productos'      => $top_productos_lista,
    ];
}

// ----------------------------------------------------------------------
//  Alertas de stock
// ----------------------------------------------------------------------

function obtenerAlertas()
{
    return consultar(
        "SELECT producto_id, producto_codigo, producto_nombre, unidad_medida,
                almacen_id, almacen_codigo, almacen_nombre,
                cantidad, stock_minimo, estado_stock
         FROM v_alertas_stock
         ORDER BY
            CASE estado_stock WHEN 'agotado' THEN 0 WHEN 'bajo' THEN 1 ELSE 2 END,
            producto_codigo
         LIMIT 12"
    );
}

// ----------------------------------------------------------------------
//  Actividad reciente
// ----------------------------------------------------------------------

function obtenerUltimosMovimientos()
{
    return consultar(
        "SELECT m.id, m.tipo, m.cantidad, m.referencia, m.creado_en,
                p.nombre AS producto_nombre, p.codigo AS producto_codigo,
                a.nombre AS almacen_nombre, a.codigo AS almacen_codigo,
                u.nombre AS usuario_nombre
         FROM movimientos m
         INNER JOIN productos p ON p.id = m.producto_id
         INNER JOIN almacenes a ON a.id = m.almacen_id
         INNER JOIN usuarios  u ON u.id = m.usuario_id
         ORDER BY m.creado_en DESC, m.id DESC
         LIMIT 8"
    );
}

// ----------------------------------------------------------------------
//  Productos con stock mas bajo (para la seccion de reposicion rapida)
// ----------------------------------------------------------------------

function obtenerTopProductos()
{
    return consultar(
        "SELECT producto_id, producto_codigo, producto_nombre, unidad_medida,
                almacen_id, almacen_codigo, almacen_nombre,
                cantidad, stock_minimo,
                (stock_minimo - cantidad) AS faltante,
                estado_stock
         FROM v_alertas_stock
         WHERE estado_stock IN ('agotado', 'bajo')
         ORDER BY
            CASE estado_stock WHEN 'agotado' THEN 0 ELSE 1 END,
            (stock_minimo - cantidad) DESC
         LIMIT 10"
    );
}
