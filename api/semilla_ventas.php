<?php
/**
 * SEMILLA DE DATOS DEMO (VENTAS)
 * =====================================================================
 * Genera ~35 ventas de cafeteria repartidas en los ultimos 21 dias usando
 * EXACTAMENTE el mismo motor de ventas del sistema (api/ventas.php):
 * con esto el stock, la bitacora, los pedidos de cocina y los ingresos
 * quedan consistentes, como si la cafeteria hubiera estado vendiendo.
 *
 * Ejecutar (despues de importar inventario_db.sql):
 *     php api/semilla_ventas.php
 *
 * Se puede repetir cuantas veces sea: al inicio limpia las ventas demo y
 * deja el stock como si la semilla no se hubiera corrido nunca.
 *
 * SOLO para desarrollo/demo. NO subir a produccion.
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit('Este script solo se ejecuta por linea de comandos (CLI).');
}

define('VENTAS_CLI', true);

require_once __DIR__ . '/nucleo.php';
require_once __DIR__ . '/ventas.php';   // define crear_venta()

// ----------------------------------------------------------------------
//  1. LIMPIEZA: quita ventas/pedidos demo y recalcula el stock desde la
//     bitacora (los movimientos de venta se borran con las ventas).
// ----------------------------------------------------------------------

ejecutar('DELETE FROM pedidos');
ejecutar('DELETE FROM ventas');                      // cascada a venta_items
ejecutar("DELETE FROM movimientos WHERE referencia LIKE 'VTA-%'");

ejecutar('DELETE FROM stock');
$filas = consultar(
    'SELECT producto_id, almacen_id, SUM(cantidad) AS total
     FROM movimientos
     GROUP BY producto_id, almacen_id'
);
if (count($filas) > 0) {
    $valores = [];
    $params = [];
    foreach ($filas as $f) {
        $valores[] = '(?,?,?)';
        array_push($params, $f['producto_id'], $f['almacen_id'], $f['total']);
    }
    ejecutar(
        'INSERT INTO stock (producto_id, almacen_id, cantidad) VALUES ' . implode(',', $valores),
        $params
    );
}

echo "Limpieza lista. Stock restaurado desde la bitacora.\n";

// ----------------------------------------------------------------------
//  2. PLAN DE VENTAS
// ----------------------------------------------------------------------

mt_srand(20250929);   // semilla fija: el demo es reproducible

$clientes = ['María G.', 'José R.', null, 'Carla T.', null, 'Andrés P.', 'Luis M.', null, 'Pedro S.', 'Ana V.'];

// Items: combo_id, cantidad, chance de extra, chance de quitar cebolla
$catalogo_items = [
    [1, 1, 0.35, 0.25],  // hamburguesa clasica
    [2, 1, 0.25, 0.15],  // doble queso
    [3, 1, 0.25, 0.30],  // perro especial
    [4, 1, 0.15, 0.00],  // nuggets con papas
    [5, 1, 0.15, 0.10],  // sandwich de pollo
    [6, 1, 0.25, 0.00],  // tequeños
    [7, 1, 0.20, 0.00],  // yuquitas
    [8, 1, 0.15, 0.00],  // aros
    [9, 1, 0.25, 0.00],  // rositas
    [10, 1, 0.30, 0.00], // jugo naranja
    [11, 1, 0.20, 0.00], // jugo fresa
    [12, 1, 0.25, 0.00], // cafe con leche
];

// Extras disponibles segun el combo (producto_id, cantidad)
$extras_por_combo = [
    1 => [[12, 1], [13, 1]],
    2 => [[12, 1], [13, 1]],
    3 => [[12, 1]],
    5 => [[14, 1]],
];

$metodos = ['efectivo', 'efectivo', 'tarjeta', 'transferencia', 'efectivo'];

/** Arma un item aleatorio de la caja. */
function item_demo($lista)
{
    [$combo, $cant, $prob_extra, $prob_quitar] = $lista[array_rand($lista)];
    $item = ['combo_id' => $combo, 'cantidad' => $cant];

    global $extras_por_combo;
    if (mt_rand(0, 99) / 100 <= $prob_extra && isset($extras_por_combo[$combo])) {
        $elegido = $extras_por_combo[$combo][array_rand($extras_por_combo[$combo])];
        $item['opcionales'][] = ['producto_id' => $elegido[0], 'cantidad' => $elegido[1]];
    }
    // Quitar cebolla (producto 17) en platos que la incluyen
    if (mt_rand(0, 99) / 100 <= $prob_quitar && in_array($combo, [1, 2, 3], true)) {
        $item['quitar'][] = ['producto_id' => 17, 'cantidad' => 1];
    }
    return $item;
}

$creadas = 0;
$omitidas = 0;
$recientes = [];   // codigos de las ultimas ventas para graduar la cocina

// 21 dias hacia atras + hoy (idemas 2 ventas hoy para ver la caja viva)
for ($dia = 21; $dia >= 0; $dia--) {
    $n_ventas = ($dia === 0) ? 2 : mt_rand(1, 2);

    for ($v = 0; $v < $n_ventas; $v++) {
        // 1 a 3 items por venta
        $items = [];
        $n_items = mt_rand(1, 3);

        // Hoy y ayer: al menos un plato que requiera cocina, para que la
        // cola de cocina muestre pedidos pendientes y listos de verdad.
        if ($dia <= 1) {
            $n_items = max($n_items, 2);
            $items[] = item_demo([$catalogo_items[mt_rand(0, 4)]]);
            $n_items--;
        }

        for ($i = 0; $i < $n_items; $i++) {
            $items[] = item_demo($catalogo_items);
        }

        // Fecha de la venta dentro del horario de la cafeteria
        $hora = mt_rand(10, 19);
        $minuto = str_pad((string) mt_rand(0, 59), 2, '0', STR_PAD_LEFT);
        $fecha_sql = date('Y-m-d', strtotime("-$dia days")) . " $hora:$minuto:00";

        $respuesta = null;
        try {
            $respuesta = crear_venta(
                ['id' => 1, 'nombre' => 'Admin Demo'],
                [
                    'almacen_id'     => 1,
                    'cliente_nombre' => $clientes[array_rand($clientes)],
                    'metodo_pago'    => $metodos[array_rand($metodos)],
                    'descuento'      => 0,
                    'items'          => $items,
                ]
            );
        } catch (Throwable $e) {
            echo "  ! Venta del dia -$dia omitida: " . $e->getMessage() . "\n";
            $omitidas++;
            continue;
        }

        // Retro-datificar la venta, su bitacora y su pedido de cocina
        $codigo = $respuesta['codigo'];
        $venta_id = $respuesta['id'];

        ejecutar('UPDATE ventas SET creado_en = ? WHERE id = ?', [$fecha_sql, $venta_id]);
        ejecutar('UPDATE movimientos SET creado_en = ? WHERE referencia = ?', [$fecha_sql, $codigo]);

        if (!empty($respuesta['pedido'])) {
            ejecutar(
                'UPDATE pedidos SET creado_en = ? WHERE id = ?',
                [$fecha_sql, $respuesta['pedido']['id']]
            );
            $recientes[] = ['id' => $respuesta['pedido']['id'], 'dia' => $dia];
        }

        $creadas++;
    }

    if ($dia % 7 === 0) {
        echo "  ...dias procesados: día -$dia\n";
    }
}

// ----------------------------------------------------------------------
//  3. ESTADOS DE COCINA: los pedidos viejos ya se entregaron; los de
//     ayer estan listos y los de hoy pendientes/en preparacion.
// ----------------------------------------------------------------------

$por_estado = ['entregado' => 0, 'listo' => 0, 'en_preparacion' => 0, 'pendiente' => 0];

foreach ($recientes as $r) {
    if ($r['dia'] >= 2) {
        $e = 'entregado';
    } elseif ($r['dia'] === 1) {
        $e = 'listo';
    } else {
        $e = (mt_rand(0, 1) === 0) ? 'pendiente' : 'en_preparacion';
    }
    ejecutar('UPDATE pedidos SET estado = ? WHERE id = ?', [$e, $r['id']]);
    $por_estado[$e]++;
}

// ----------------------------------------------------------------------

$resumen_ventas = consultar_uno(
    "SELECT COUNT(*) AS ventas, COALESCE(SUM(total),0) AS ingresos, COALESCE(SUM(costo_total),0) AS costos
     FROM ventas WHERE estado = 'completada'"
);
$ganancia = round((float) $resumen_ventas['ingresos'] - (float) $resumen_ventas['costos'], 2);

echo "\n==============================================\n";
echo "Semilla de ventas terminada\n";
echo "  Ventas creadas : $creadas\n";
echo "  Omitidas       : $omitidas (stock insuficiente)\n";
echo "  Total historico: {$resumen_ventas['ventas']} ventas\n";
echo "  Ingresos       : " . number_format((float) $resumen_ventas['ingresos'], 2, ',', '.') . "\n";
echo "  Costo de ventas: " . number_format((float) $resumen_ventas['costos'], 2, ',', '.') . " (ganancia real " . number_format($ganancia, 2, ',', '.') . ")\n";
echo "  Pedidos cocina : entregado={$por_estado['entregado']}, listo={$por_estado['listo']}, "
   . "en_preparacion={$por_estado['en_preparacion']}, pendiente={$por_estado['pendiente']}\n";
echo "  Ingresa al sistema (admin@inventario.com / Admin123!) y mira el Resumen.\n";
echo "==============================================\n";