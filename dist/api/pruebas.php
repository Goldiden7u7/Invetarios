<?php
/**
 * PRUEBA AUTOMATICA DEL BACKEND
 * Ejecutar:  C:\xampp\php\php.exe pruebas.php
 * (o desde el navegador: http://localhost:8080/pruebas.php)
 *
 * Verifica que todo el sistema funcione: login, permisos, CRUD, stock,
 * transferencias y las protecciones de seguridad.
 */

$API = 'http://127.0.0.1:8080';
$cookie = null;
$ok = 0;
$fallos = 0;
$errores = [];
$json_invalidas = [];   // respuestas que no son JSON (fallos silenciosos del API)

// Necesario solo para la limpieza final, que borra directo en la base:
// la API nunca borra un producto con movimientos (lo desactiva), asi que
// por HTTP los datos de prueba se acumulan para siempre.
require_once __DIR__ . '/nucleo.php';

/**
 * Borra por completo los rastros que dejo la suite, para que las pruebas
 * puedan repetirse cuantas veces sea sin ensuciar el catalogo.
 *
 * Respeta el orden de las claves foraneas (todas son RESTRICT) y se limita
 * a los datos de prueba: el producto creado con prefijo PRUEBA- y el
 * almacen de prueba. Nunca toca el catalogo real.
 */
function limpiar_rastros($producto_id = 0, $almacen_id = 0, $usuario_ids = 0, $categoria_id = 0)
{
    try {
        // Localizamos todos los productos de prueba, incluido el de esta
        // ejecucion y los que hayan podido quedar de corridas anteriores.
        $ids_producto = array_map('intval', array_column(consultar(
            "SELECT id FROM productos WHERE codigo LIKE 'PRUEBA-%'"
        ), 'id'));

        if ($producto_id > 0) {
            $ids_producto[] = $producto_id;
        }
        $ids_producto = array_values(array_unique(array_filter($ids_producto)));

        // Combos, ventas y pedidos de prueba (modulo caja): se purgan
        // ANTES que los productos porque las recetas (combo_productos)
        // los referencian con claves foraneas RESTRICT.
        $ids_combo = array_map('intval', array_column(
            consultar("SELECT id FROM combos WHERE codigo LIKE 'PRUEBA-%'"), 'id'));
        if (count($ids_combo) > 0) {
            $marcas = implode(',', array_fill(0, count($ids_combo), '?'));
            $ids_venta = array_map('intval', array_column(
                consultar(
                    "SELECT DISTINCT venta_id FROM venta_items WHERE combo_id IN ($marcas)",
                    $ids_combo
                ),
                'venta_id'
            ));

            foreach ($ids_venta as $vid) {
                ejecutar('DELETE FROM pedidos      WHERE venta_id = ?', [$vid]);
                ejecutar('DELETE FROM venta_items  WHERE venta_id = ?', [$vid]);
                ejecutar('DELETE FROM ventas       WHERE id = ?', [$vid]);
                ejecutar('DELETE FROM auditoria    WHERE tabla = ? AND registro_id = ?', ['ventas', $vid]);
            }

            foreach ($ids_combo as $cid) {
                ejecutar('DELETE FROM combos   WHERE id = ?', [$cid]);
                ejecutar('DELETE FROM auditoria WHERE tabla = ? AND registro_id = ?', ['combos', $cid]);
            }
        }

        foreach ($ids_producto as $pid) {
            // Los ids de los movimientos y transferencias del producto de
            // prueba, para borrar tambien sus rastros en la auditoria.
            $movs = array_map('intval', array_column(
                consultar('SELECT id FROM movimientos WHERE producto_id = ?', [$pid]), 'id'));
            $trfs = array_map('intval', array_column(
                consultar('SELECT id FROM transferencias WHERE producto_id = ?', [$pid]), 'id'));

            ejecutar('DELETE FROM numeros_serie WHERE producto_id = ?', [$pid]);
            ejecutar('DELETE FROM movimientos     WHERE producto_id = ?', [$pid]);
            ejecutar('DELETE FROM transferencias  WHERE producto_id = ?', [$pid]);
            ejecutar('DELETE FROM stock           WHERE producto_id = ?', [$pid]);
            ejecutar('DELETE FROM productos       WHERE id = ?', [$pid]);

            // La auditoria no tiene claves foraneas, asi que se limpia a mano.
            foreach ($movs as $mid) {
                ejecutar('DELETE FROM auditoria WHERE tabla = ? AND registro_id = ?', ['movimientos', $mid]);
            }
            foreach ($trfs as $tid) {
                ejecutar('DELETE FROM auditoria WHERE tabla = ? AND registro_id = ?', ['transferencias', $tid]);
            }
            ejecutar('DELETE FROM auditoria WHERE tabla = ? AND registro_id = ?', ['productos', $pid]);
        }

        if ($categoria_id > 0) {
            ejecutar('DELETE FROM auditoria WHERE tabla = ? AND registro_id = ?', ['categorias', $categoria_id]);
            ejecutar('DELETE FROM categorias   WHERE id = ?', [$categoria_id]);
        }

        // Los usuarios de prueba tienen roles restringidos, asi que su DELETE
        // por API los desactiva en vez de borrarlos. Purga directa tambien.
        foreach ((array) $usuario_ids as $uid) {
            if ($uid <= 0) continue;
            ejecutar('DELETE FROM movimientos    WHERE usuario_id = ?', [$uid]);
            ejecutar('DELETE FROM transferencias WHERE enviado_por = ? OR recibido_por = ?', [$uid, $uid]);
            ejecutar('DELETE FROM auditoria       WHERE usuario_id = ?', [$uid]);
            ejecutar('DELETE FROM usuarios        WHERE id = ?', [$uid]);
        }

        if ($almacen_id > 0) {
            ejecutar('DELETE FROM numeros_serie WHERE almacen_id = ?', [$almacen_id]);
            ejecutar('DELETE FROM movimientos     WHERE almacen_id = ?', [$almacen_id]);
            ejecutar('DELETE FROM transferencias  WHERE almacen_origen_id = ? OR almacen_destino_id = ?', [$almacen_id, $almacen_id]);
            ejecutar('DELETE FROM stock           WHERE almacen_id = ?', [$almacen_id]);
            ejecutar('DELETE FROM almacenes       WHERE id = ?', [$almacen_id]);
            ejecutar('DELETE FROM auditoria       WHERE tabla = ? AND registro_id = ?', ['almacenes', $almacen_id]);
        }

        return count($ids_producto);
    } catch (Throwable $e) {
        // La limpieza es un extra: si falla, el resto de las pruebas ya corrieron.
        echo "  [AVISO] No se pudo limpiar: " . $e->getMessage() . "\n";
        return 0;
    }
}

function pedir($url, $metodo = 'GET', $cuerpo = null)
{
    global $API, $cookie, $json_invalidas;

    $ch = curl_init($API . $url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST  => $metodo,
        CURLOPT_HEADER         => true,
    ]);
    if ($cuerpo !== null) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($cuerpo));
        // La app React SI envia este header; lo replicamos para probar igual.
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    }
    if ($cookie) {
        curl_setopt($ch, CURLOPT_COOKIE, $cookie);
    }
    $respuesta = curl_exec($ch);
    $codigo = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $tamanio = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
    curl_close($ch);

    $crudo = substr($respuesta, $tamanio);
    if (preg_match('/PHPSESSID=([^;]+)/', substr($respuesta, 0, $tamanio), $m)) {
        $cookie = 'PHPSESSID=' . $m[1];
    }
    $json = json_decode($crudo, true);

    // Toda respuesta del API debe ser JSON parseable. Si PHP se le escape un
    // warning dentro del cuerpo, el json_decode falla y el frontend entero se
    // rompe. Lo registramos para que la suite lo note de inmediato.
    if ($crudo !== '' && $json === null) {
        $json_invalidas[] = $metodo . ' ' . $url . ' -> ' . substr(trim($crudo), 0, 120);
    }

    return ['codigo' => $codigo, 'json' => $json, 'crudo' => $crudo];
}

function verificar($descripcion, $condicion, $detalle = '')
{
    global $ok, $fallos, $errores;
    if ($condicion) {
        $ok++;
        echo "  [OK]   $descripcion\n";
    } else {
        $fallos++;
        $errores[] = $descripcion . ($detalle ? " ($detalle)" : '');
        echo "  [FALLA] $descripcion" . ($detalle ? " -> $detalle" : '') . "\n";
    }
}

function seccion($titulo)
{
    echo "\n=== $titulo ===\n";
}

// ----------------------------------------------------------------------

seccion('1. AUTENTICACION');

$r = pedir('/auth/login.php', 'POST', ['email' => 'admin@inventario.com', 'password' => 'Admin123!']);
verificar('Login con credenciales correctas', $r['codigo'] === 200 && ($r['json']['ok'] ?? false));
verificar('Devuelve rol y permisos', isset($r['json']['datos']['rol'], $r['json']['datos']['permisos']));
verificar('Nunca devuelve el hash de la contrasena', !isset($r['json']['datos']['password_hash']));

$r = pedir('/auth/login.php', 'POST', ['email' => 'admin@inventario.com', 'password' => 'incorrecta']);
verificar('Rechaza contrasena incorrecta (401)', $r['codigo'] === 401);

$r = pedir('/auth/login.php', 'POST', ['email' => 'noexiste@inventario.com', 'password' => 'algo123']);
verificar('Rechaza correo inexistente (401)', $r['codigo'] === 401);
verificar('No revela si el correo existe', str_contains($r['json']['error'] ?? '', 'incorrectos'));

$r = pedir('/auth/yo.php');
verificar('Sesion activa devuelve el usuario', ($r['json']['datos']['usuario']['id'] ?? null) === 1);

// ----------------------------------------------------------------------

seccion('2. CONTROL DE ACCESO');

$guardar_cookie = $cookie;
$cookie = null; // sin sesion

$r = pedir('/productos.php');
verificar('Sin sesion no lista productos (401)', $r['codigo'] === 401);

$r = pedir('/movimientos.php', 'POST', ['producto_id' => 1, 'almacen_id' => 1, 'tipo' => 'entrada', 'cantidad' => 5]);
verificar('Sin sesion no registra movimientos (401)', $r['codigo'] === 401);

$cookie = $guardar_cookie;

// ----------------------------------------------------------------------

seccion('3. PRODUCTOS (CRUD)');

$r = pedir('/productos.php?por_pagina=5');
verificar('Lista productos', $r['codigo'] === 200 && count($r['json']['datos']['productos']) === 5);
verificar('Incluye paginacion', isset($r['json']['datos']['paginacion']['total']));
verificar('Total de productos > 0', $r['json']['datos']['paginacion']['total'] > 0);

$r = pedir('/productos.php?buscar=pan');
verificar('Busqueda por texto', $r['codigo'] === 200 && $r['json']['datos']['paginacion']['total'] >= 2);

$r = pedir('/productos.php?buscar=PAN-HAM-06');
verificar('Busqueda por codigo exacto', $r['json']['datos']['paginacion']['total'] === 1);

$r = pedir('/productos.php?orden=precio_venta&dir=desc&por_pagina=5');
verificar('Ordenar por precio descendente', $r['codigo'] === 200);

$r = pedir('/productos.php?id=1');
verificar('Detalle de producto', $r['codigo'] === 200 && isset($r['json']['datos']['stock_por_almacen']));
verificar('Sin seriales si el producto no los controla', !isset($r['json']['datos']['seriales']));

// Crear
$codigo_test = 'PRUEBA-' . rand(1000, 9999);
$r = pedir('/productos.php', 'POST', [
    'codigo' => $codigo_test,
    'nombre' => 'Producto de prueba automatica',
    'precio_compra' => 10,
    'precio_venta' => 20,
    'stock_minimo' => 5,
    'categoria_id' => 1,
    'controla_serial' => 1,
]);
verificar('Crear producto', $r['codigo'] === 201 && isset($r['json']['datos']['id']));
$nuevo_id = $r['json']['datos']['id'] ?? 0;

$r = pedir('/productos.php?id=' . $nuevo_id);
verificar('Detalle incluye seriales si aplica', isset($r['json']['datos']['seriales']) && is_array($r['json']['datos']['seriales']));

// Editar
$r = pedir('/productos.php', 'PUT', ['id' => $nuevo_id, 'codigo' => $codigo_test, 'nombre' => 'Producto editado', 'precio_compra' => 12, 'precio_venta' => 25, 'stock_minimo' => 5, 'categoria_id' => 1]);
verificar('Editar producto', $r['codigo'] === 200);
$r = pedir('/productos.php?id=' . $nuevo_id);
verificar('El cambio se guardo', ($r['json']['datos']['nombre'] ?? '') === 'Producto editado');

// Validaciones
$r = pedir('/productos.php', 'POST', ['codigo' => '', 'nombre' => 'Sin codigo']);
verificar('Rechaza producto sin codigo (400)', $r['codigo'] === 400);

$r = pedir('/productos.php', 'POST', ['codigo' => 'X-1', 'nombre' => 'Precio negativo', 'precio_compra' => -5]);
verificar('Rechaza precio negativo (400)', $r['codigo'] === 400);

$r = pedir('/productos.php', 'POST', ['codigo' => 'X-2', 'nombre' => 'Max menor que min', 'stock_minimo' => 10, 'stock_maximo' => 5]);
verificar('Rechaza maximo menor que minimo (400)', $r['codigo'] === 400);

$r = pedir('/productos.php', 'POST', ['codigo' => $codigo_test, 'nombre' => 'Duplicado', 'categoria_id' => 1]);
verificar('Rechaza codigo duplicado', in_array($r['codigo'], [400, 409], true));

// ----------------------------------------------------------------------

seccion('4. MOVIMIENTOS Y STOCK');

$r = pedir('/movimientos.php', 'POST', ['producto_id' => $nuevo_id, 'almacen_id' => 1, 'tipo' => 'entrada', 'cantidad' => 30]);
verificar('Entrada registra stock', $r['codigo'] === 201 && $r['json']['datos']['stock_nuevo'] === 30);

$r = pedir('/movimientos.php', 'POST', ['producto_id' => $nuevo_id, 'almacen_id' => 1, 'tipo' => 'salida', 'cantidad' => 10]);
verificar('Salida descuenta stock', $r['codigo'] === 201 && $r['json']['datos']['stock_nuevo'] === 20);

$r = pedir('/productos.php?id=' . $nuevo_id);
verificar('Stock coincide con la base de datos', $r['json']['datos']['stock_por_almacen'][0]['cantidad'] === 20);

// La proteccion mas importante del sistema
$r = pedir('/movimientos.php', 'POST', ['producto_id' => $nuevo_id, 'almacen_id' => 1, 'tipo' => 'salida', 'cantidad' => 9999]);
verificar('BLOQUEA stock insuficiente (400)', $r['codigo'] === 400);
verificar('El error explica cuanto hay disponible', str_contains($r['json']['error'] ?? '', 'Disponible'));

$r = pedir('/productos.php?id=' . $nuevo_id);
verificar('El stock NO cambio tras el fallo', $r['json']['datos']['stock_por_almacen'][0]['cantidad'] === 20);

$r = pedir('/movimientos.php', 'POST', ['producto_id' => $nuevo_id, 'almacen_id' => 1, 'tipo' => 'ajuste', 'cantidad' => 5]);
verificar('Ajuste fija el stock al valor indicado', $r['codigo'] === 201 && $r['json']['datos']['stock_nuevo'] === 5);

$r = pedir('/movimientos.php', 'POST', ['producto_id' => $nuevo_id, 'almacen_id' => 1, 'tipo' => 'salida', 'cantidad' => 0]);
verificar('Rechaza cantidad cero (400)', $r['codigo'] === 400);

$r = pedir('/movimientos.php', 'POST', ['producto_id' => $nuevo_id, 'almacen_id' => 1, 'tipo' => 'inventado', 'cantidad' => 5]);
verificar('Rechaza tipo de movimiento invalido (400)', $r['codigo'] === 400);

$r = pedir('/movimientos.php?producto_id=' . $nuevo_id);
verificar('El historial registra todos los movimientos', $r['json']['datos']['paginacion']['total'] === 3);
verificar('Los movimientos guardan el usuario que los hizo', isset($r['json']['datos']['movimientos'][0]['usuario_nombre']));

$r = pedir('/movimientos.php?producto_id=' . $nuevo_id . '&tipo=entrada');
verificar('Filtro por tipo de movimiento', $r['json']['datos']['paginacion']['total'] === 1);

$r = pedir('/movimientos.php?producto_id=' . $nuevo_id . '&tipo=salida');
verificar('Resumen de salidas es positivo', $r['json']['datos']['resumen']['total_salidas'] > 0);

// ----------------------------------------------------------------------

seccion('5. TRANSFERENCIAS');

$r = pedir('/transferencias.php', 'POST', [
    'producto_id' => $nuevo_id, 'almacen_origen_id' => 1,
    'almacen_destino_id' => 2, 'cantidad' => 3,
]);
verificar('Crear transferencia', $r['codigo'] === 201 && isset($r['json']['datos']['codigo']));
$trf = $r['json']['datos']['id'] ?? 0;

$r = pedir('/productos.php?id=' . $nuevo_id);
$cen = 0; $nor = 0;
foreach ($r['json']['datos']['stock_por_almacen'] as $f) {
    if ($f['almacen_id'] == 1) $cen = $f['cantidad'];
    if ($f['almacen_id'] == 2) $nor = $f['cantidad'];
}
verificar('La transferencia descuenta del origen', $cen === 2);
verificar('En transito NO suma al destino todavia', $nor === 0);

$r = pedir('/transferencias.php', 'PUT', ['id' => $trf, 'accion' => 'recibir']);
verificar('Recibir transferencia', $r['codigo'] === 200);

$r = pedir('/productos.php?id=' . $nuevo_id);
foreach ($r['json']['datos']['stock_por_almacen'] as $f) {
    if ($f['almacen_id'] == 2) $nor = $f['cantidad'];
}
verificar('Al recibir suma al destino', $nor === 3);

$r = pedir('/transferencias.php', 'PUT', ['id' => $trf, 'accion' => 'recibir']);
verificar('No permite recibir dos veces (400)', $r['codigo'] === 400);

$r = pedir('/transferencias.php', 'POST', [
    'producto_id' => $nuevo_id, 'almacen_origen_id' => 1,
    'almacen_destino_id' => 1, 'cantidad' => 1,
]);
verificar('Rechaza transferir al mismo almacen (400)', $r['codigo'] === 400);

$r = pedir('/transferencias.php', 'POST', [
    'producto_id' => $nuevo_id, 'almacen_origen_id' => 2,
    'almacen_destino_id' => 1, 'cantidad' => 999,
]);
verificar('Rechaza transferir mas de lo que hay (400)', $r['codigo'] === 400);

// Cancelar devuelve el stock
$r = pedir('/transferencias.php', 'POST', [
    'producto_id' => $nuevo_id, 'almacen_origen_id' => 2,
    'almacen_destino_id' => 3, 'cantidad' => 2,
]);
$trf2 = $r['json']['datos']['id'] ?? 0;
$r = pedir('/transferencias.php', 'PUT', ['id' => $trf2, 'accion' => 'cancelar']);
verificar('Cancelar transferencia', $r['codigo'] === 200);
$r = pedir('/productos.php?id=' . $nuevo_id);
foreach ($r['json']['datos']['stock_por_almacen'] as $f) {
    if ($f['almacen_id'] == 2) $nor = $f['cantidad'];
}
verificar('Al cancelar el stock vuelve al origen', $nor === 3);

// ----------------------------------------------------------------------

seccion('6. ALMACENES Y CATEGORIAS');

$r = pedir('/almacenes.php');
verificar('Lista almacenes', $r['codigo'] === 200 && count($r['json']['datos']) === 3);
verificar('Incluye valor del inventario', isset($r['json']['datos'][0]['valor_venta']));

$r = pedir('/almacenes.php?id=1');
verificar('Detalle de almacen con su stock', isset($r['json']['datos']['stock_detalle']));
verificar('Detalle incluye resumen', isset($r['json']['datos']['resumen']['unidades']));

$codigo_alm = 'PR' . rand(10, 99);
$r = pedir('/almacenes.php', 'POST', ['codigo' => $codigo_alm, 'nombre' => 'Almacen de prueba']);
verificar('Crear almacen', $r['codigo'] === 201);
$alm_id = $r['json']['datos']['id'] ?? 0;

$r = pedir('/almacenes.php', 'POST', ['codigo' => '!!!', 'nombre' => 'Codigo invalido']);
verificar('Rechaza codigo con caracteres invalidos (400)', $r['codigo'] === 400);

$r = pedir('/almacenes.php', 'POST', ['codigo' => $codigo_alm, 'nombre' => 'Duplicado']);
verificar('Rechaza codigo de almacen duplicado', in_array($r['codigo'], [400, 409], true));

$r = pedir('/categorias.php');
verificar('Lista categorias', $r['codigo'] === 200);

// Coherencia entre endpoints: la suma de productos por categoria debe igualar
// el total de productos activos. No usamos un numero fijo (16) porque la propia
// suite crea productos durante la ejecucion y ese total cambiaria.
$r_productos = pedir('/productos.php?por_pagina=100&estado=activos');
$total_activos = $r_productos['json']['datos']['paginacion']['total'] ?? 0;

$total_cat = 0;
foreach ($r['json']['datos'] as $c) $total_cat += $c['productos'];
verificar(
    'El conteo de productos por categoria es correcto',
    $total_cat === $total_activos,
    "categorias=$total_cat productos_activos=$total_activos"
);

$r = pedir('/categorias.php', 'POST', ['nombre' => 'Categoria de prueba ' . rand(1000, 9999)]);
verificar('Crear categoria', $r['codigo'] === 201);
$cat_prueba_id = $r['json']['datos']['id'] ?? 0;
pedir('/categorias.php', 'DELETE', ['id' => $cat_prueba_id]);

// ----------------------------------------------------------------------

seccion('7. USUARIOS Y PERMISOS');

$r = pedir('/usuarios.php');
verificar('Lista usuarios', $r['codigo'] === 200);
verificar('Incluye los roles disponibles', isset($r['json']['datos']['roles']));
verificar('Nunca expone password_hash', !str_contains(json_encode($r['json']), 'password_hash'));

$email_test = 'test' . rand(1000, 9999) . '@inventario.com';
$r = pedir('/usuarios.php', 'POST', [
    'nombre' => 'Usuario de prueba', 'email' => $email_test,
    'password' => 'Prueba123', 'rol_id' => 4,
]);
verificar('Crear usuario', $r['codigo'] === 201);
$user_id = $r['json']['datos']['id'] ?? 0;

$r = pedir('/usuarios.php', 'POST', [
    'nombre' => 'Clave corta', 'email' => 'corta@x.com', 'password' => '123', 'rol_id' => 4,
]);
verificar('Rechaza contrasena muy corta (400)', $r['codigo'] === 400);

$r = pedir('/usuarios.php', 'POST', [
    'nombre' => 'Sin numeros', 'email' => 'sin@x.com', 'password' => 'sololetras', 'rol_id' => 4,
]);
verificar('Rechaza contrasena solo con letras (400)', $r['codigo'] === 400);

$r = pedir('/usuarios.php', 'POST', [
    'nombre' => 'Correo malo', 'email' => 'no-es-correo', 'password' => 'Prueba123', 'rol_id' => 4,
]);
verificar('Rechaza correo invalido (400)', $r['codigo'] === 400);

$r = pedir('/usuarios.php', 'POST', [
    'nombre' => 'Rol inexistente', 'email' => 'rol@x.com', 'password' => 'Prueba123', 'rol_id' => 999,
]);
verificar('Rechaza rol inexistente (400)', $r['codigo'] === 400);

$r = pedir('/usuarios.php', 'DELETE', ['id' => 1]);
verificar('No deja desactivar al propio admin (400)', $r['codigo'] === 400);

$r = pedir('/usuarios.php', 'PUT', ['id' => 1, 'nombre' => 'Administrador', 'email' => 'admin@inventario.com', 'rol_id' => 4, 'activo' => 1]);
verificar('No deja quitar el rol al unico admin (400)', $r['codigo'] === 400);

// Con el rol Consulta, no puede crear usuarios
$cookie_admin = $cookie;
$cookie = null;
pedir('/auth/login.php', 'POST', ['email' => $email_test, 'password' => 'Prueba123']);
$r = pedir('/usuarios.php');
verificar('Rol Consulta NO puede ver usuarios (403)', $r['codigo'] === 403);

$r = pedir('/productos.php');
verificar('Rol Consulta SI puede ver productos (200)', $r['codigo'] === 200);

$r = pedir('/movimientos.php', 'POST', ['producto_id' => 1, 'almacen_id' => 1, 'tipo' => 'entrada', 'cantidad' => 1]);
verificar('Rol Consulta NO puede registrar movimientos (403)', $r['codigo'] === 403);

$cookie = $cookie_admin;

// El usuario de prueba se purga al final, junto con el resto de rastros.

// ----------------------------------------------------------------------

seccion('8. COMBOS (MENU)');

$r = pedir('/combos.php');
verificar('Lista el menu', $r['codigo'] === 200 && isset($r['json']['datos']['combos']));
verificar('El menu incluye comida, snack y bebida', count(array_unique(array_column($r['json']['datos']['combos'], 'tipo'))) === 3);
verificar('Hay mas de 10 combos en el menu', count($r['json']['datos']['combos']) > 10);

$r = pedir('/combos.php?id=1');
verificar('Detalle de combo con receta', $r['codigo'] === 200 && count($r['json']['datos']['ingredientes']) > 0);
verificar('Detalle incluye los opcionales', isset($r['json']['datos']['opcionales']));

$codigo_combo = 'PRUEBA-' . rand(1000, 9999);
$r = pedir('/combos.php', 'POST', [
    'codigo' => $codigo_combo,
    'nombre' => 'Combo de prueba automatica',
    'tipo' => 'comida',
    'precio_venta' => 12,
    'requiere_cocina' => 1,
    'ingredientes' => [['producto_id' => $nuevo_id, 'cantidad' => 2]],
    'opcionales' => [['producto_id' => $nuevo_id, 'cantidad' => 1, 'precio_extra' => 4]],
]);
verificar('Crear combo con receta', $r['codigo'] === 201 && isset($r['json']['datos']['id']));
$combo_test_id = $r['json']['datos']['id'] ?? 0;

$r = pedir('/combos.php?id=' . $combo_test_id);
verificar('La receta quedo guardada', count($r['json']['datos']['ingredientes'] ?? []) === 1);

$r = pedir('/combos.php', 'POST', [
    'codigo' => 'PRUEBA-X', 'nombre' => 'Sin receta', 'tipo' => 'comida', 'precio_venta' => 5,
]);
verificar('Rechaza combo sin receta (400)', $r['codigo'] === 400);

$r = pedir('/combos.php', 'POST', [
    'codigo' => 'PRUEBA-X', 'nombre' => 'Tipo invalido', 'tipo' => 'vehiculo',
    'ingredientes' => [['producto_id' => $nuevo_id, 'cantidad' => 1]],
]);
verificar('Rechaza tipo de combo invalido (400)', $r['codigo'] === 400);

$r = pedir('/combos.php', 'POST', [
    'codigo' => 'PRUEBA-DUP', 'nombre' => 'Con repetido',
    'ingredientes' => [['producto_id' => $nuevo_id, 'cantidad' => 1], ['producto_id' => $nuevo_id, 'cantidad' => 1]],
]);
verificar('Rechaza ingrediente repetido en la receta (400)', $r['codigo'] === 400);

$r = pedir('/combos.php', 'POST', [
    'codigo' => $codigo_combo, 'nombre' => 'Codigo ya usado', 'tipo' => 'snack',
    'ingredientes' => [['producto_id' => $nuevo_id, 'cantidad' => 1]],
]);
verificar('Rechaza codigo de combo repetido (409)', $r['codigo'] === 409);

// ----------------------------------------------------------------------

seccion('9. VENTAS (CAJA)');

// Producto y combo dedicados a las ventas de prueba, con numeros redondos:
// receta = 2 unidades, extra = 1 unidad a +4, precio de compra = 1.
$r = pedir('/productos.php', 'POST', [
    'codigo' => 'PRUEBA-VEN-' . rand(1000, 9999),
    'nombre' => 'Ingrediente de prueba caja',
    'precio_compra' => 1,
    'precio_venta' => 3,
    'stock_minimo' => 1,
    'categoria_id' => 4,
]);
verificar('Crea ingrediente dedicado para caja', $r['codigo'] === 201);
$prod_ven = $r['json']['datos']['id'] ?? 0;

$r = pedir('/movimientos.php', 'POST', ['producto_id' => $prod_ven, 'almacen_id' => 1, 'tipo' => 'entrada', 'cantidad' => 100]);
verificar('Deja 100 unidades para las ventas de prueba', $r['json']['datos']['stock_nuevo'] === 100);

$r = pedir('/combos.php', 'POST', [
    'codigo' => 'PRUEBA-CAJA-' . rand(1000, 9999),
    'nombre' => 'Combo de prueba caja',
    'tipo' => 'comida',
    'precio_venta' => 12,
    'requiere_cocina' => 1,
    'ingredientes' => [['producto_id' => $prod_ven, 'cantidad' => 2]],
    'opcionales' => [['producto_id' => $prod_ven, 'cantidad' => 1, 'precio_extra' => 4]],
]);
verificar('Crea combo dedicado para caja', $r['codigo'] === 201);
$combo_ven = $r['json']['datos']['id'] ?? 0;

// Venta A: 2 unidades + 1 extra por unidad (consume 6; subtotal 32; costo 3/udx2 = 6; ganancia 26)
$r = pedir('/ventas.php', 'POST', [
    'almacen_id' => 1,
    'cliente_nombre' => 'Cliente prueba',
    'metodo_pago' => 'efectivo',
    'items' => [[
        'combo_id' => $combo_ven,
        'cantidad' => 2,
        'opcionales' => [['producto_id' => $prod_ven, 'cantidad' => 1]],
    ]],
]);
verificar('Registra venta con caja', $r['codigo'] === 201 && isset($r['json']['datos']['codigo']));
$codigo_venta1 = $r['json']['datos']['codigo'] ?? '';
$venta1_id = $r['json']['datos']['id'] ?? 0;
verificar('Cobra el extra en el total', abs(($r['json']['datos']['total'] ?? 0) - 32.00) < 0.01);
verificar('Genera pedido para la cocina', ($r['json']['datos']['pedido']['estado'] ?? '') === 'pendiente');
$pedido1_codigo = $r['json']['datos']['pedido']['codigo'] ?? '';

$r = pedir('/productos.php?id=' . $prod_ven);
$stk = 0;
foreach ($r['json']['datos']['stock_por_almacen'] ?? [] as $f) if ($f['almacen_id'] == 1) $stk = $f['cantidad'];
verificar('La venta descuenta ingredientes del stock', $stk === 94, "stock=$stk");

$r = pedir('/movimientos.php?producto_id=' . $prod_ven . '&tipo=salida');
$hay_ref = false;
foreach ($r['json']['datos']['movimientos'] ?? [] as $m) {
    if (($m['referencia'] ?? '') === $codigo_venta1 && (int) $m['cantidad'] === -6) $hay_ref = true;
}
verificar('La venta queda en la bitacora con su referencia', $hay_ref);

$r = pedir('/ventas.php?id=' . $venta1_id);
verificar('Detalle de venta con items', $r['codigo'] === 200 && count($r['json']['datos']['items'] ?? []) === 1);
$item1 = $r['json']['datos']['items'][0] ?? [];
verificar('Guarda el snapshot de ingredientes usados', count($item1['ingredientes'] ?? []) === 2);
verificar('Guarda el costo de la receta (ganancia real)', abs(($item1['costo_unitario'] ?? 0) - 3.00) < 0.01);
verificar('Calcula la ganancia de la venta', abs(($r['json']['datos']['ganancia'] ?? 0) - 26.00) < 0.01);

// Venta B: quitar 1 de la receta (consume solo 1)
$r = pedir('/ventas.php', 'POST', [
    'almacen_id' => 1,
    'metodo_pago' => 'tarjeta',
    'items' => [[
        'combo_id' => $combo_ven,
        'cantidad' => 1,
        'quitar' => [['producto_id' => $prod_ven, 'cantidad' => 1]],
    ]],
]);
verificar('Acepta quitar ingredientes de la receta', $r['codigo'] === 201);
$venta2_id = $r['json']['datos']['id'] ?? 0;
$pedido2_codigo = $r['json']['datos']['pedido']['codigo'] ?? '';

$r = pedir('/productos.php?id=' . $prod_ven);
$stk = 0;
foreach ($r['json']['datos']['stock_por_almacen'] ?? [] as $f) if ($f['almacen_id'] == 1) $stk = $f['cantidad'];
verificar('Quitar ingrediente reduce lo consumido', $stk === 93, "stock=$stk");

$r = pedir('/ventas.php?id=' . $venta2_id);
$item2 = $r['json']['datos']['items'][0] ?? [];
verificar('El detalle guarda que aviso \"quitar\"', count($item2['ingredientes']['quitados'] ?? []) === 1);

// Validaciones de caja
$r = pedir('/ventas.php', 'POST', ['almacen_id' => 1, 'metodo_pago' => 'efectivo', 'items' => []]);
verificar('Rechaza venta sin items (400)', $r['codigo'] === 400);

$r = pedir('/ventas.php', 'POST', [
    'almacen_id' => 1,
    'items' => [['combo_id' => 999999, 'cantidad' => 1]],
]);
verificar('Rechaza combo inexistente (404)', $r['codigo'] === 404);

$r = pedir('/ventas.php', 'POST', [
    'almacen_id' => 1,
    'items' => [[
        'combo_id' => $combo_ven,
        'cantidad' => 1,
        'quitar' => [['producto_id' => 999999, 'cantidad' => 1]],
    ]],
]);
verificar('No deja quitar un ingrediente que no esta (400)', $r['codigo'] === 400);

// Stock insuficiente: se avisa que falta y NO se toca nada
// (cantidad 100: la receta pide 2 por unidad = 200, hay 93)
$r = pedir('/ventas.php', 'POST', [
    'almacen_id' => 1,
    'items' => [['combo_id' => $combo_ven, 'cantidad' => 100]],
]);
verificar('BLOQUEA venta con stock insuficiente (400)', $r['codigo'] === 400);
verificar('Explica que producto falta', str_contains($r['json']['error'] ?? '', 'Stock insuficiente'));
verificar('Detalla el faltante en datos', isset($r['json']['datos']['faltantes']) && count($r['json']['datos']['faltantes']) > 0);

$r = pedir('/productos.php?id=' . $prod_ven);
$stk = 0;
foreach ($r['json']['datos']['stock_por_almacen'] ?? [] as $f) if ($f['almacen_id'] == 1) $stk = $f['cantidad'];
verificar('El stock NO cambio tras el fallo', $stk === 93, "stock=$stk");

// ----------------------------------------------------------------------

seccion('10. PEDIDOS (COCINA)');

$r = pedir('/pedidos.php');
verificar('Lista la cola de cocina', $r['codigo'] === 200 && isset($r['json']['datos']['pedidos']));

$pedido1 = null;
foreach ($r['json']['datos']['pedidos'] as $p) if (($p['codigo'] ?? '') === $pedido1_codigo) $pedido1 = $p;
verificar('El pedido generado aparece en la cola', $pedido1 !== null);
verificar('La cola trae los items y sus ingredientes',
    $pedido1 !== null && count($pedido1['items'] ?? []) === 1 && count($pedido1['items'][0]['ingredientes'] ?? []) === 2);

$r = pedir('/pedidos.php', 'POST', ['id' => $pedido1['id'], 'estado' => 'en_preparacion']);
verificar('Pasa a en_preparacion', $r['codigo'] === 200 && ($r['json']['datos']['estado'] ?? '') === 'en_preparacion');

$r = pedir('/pedidos.php', 'POST', ['id' => $pedido1['id'], 'estado' => 'listo']);
verificar('Pasa a listo', $r['codigo'] === 200);

$r = pedir('/pedidos.php', 'POST', ['id' => $pedido1['id'], 'estado' => 'entregado']);
verificar('Pasa a entregado', $r['codigo'] === 200);

$r = pedir('/pedidos.php', 'POST', ['id' => $pedido1['id'], 'estado' => 'listo']);
verificar('No regresa de entregado a listo (400)', $r['codigo'] === 400);

$r = pedir('/pedidos.php', 'POST', ['id' => $pedido1['id'], 'estado' => 'hecho']);
verificar('Rechaza estado invalido (400)', $r['codigo'] === 400);

// Reconsultamos la cola (el listado anterior ya quedo desactualizado)
$r = pedir('/pedidos.php');
$pedido2 = null;
foreach ($r['json']['datos']['pedidos'] as $p) if (($p['codigo'] ?? '') === $pedido2_codigo) $pedido2 = $p;
$r = pedir('/pedidos.php', 'POST', ['id' => ($pedido2['id'] ?? 1), 'estado' => 'entregado']);
verificar('No salta de pendiente a entregado (400)', $r['codigo'] === 400);

// ----------------------------------------------------------------------

seccion('11. PERMISOS CAJA/COCINA');

$email_vend = 'vendedor' . rand(1000, 9999) . '@inventario.com';
$r = pedir('/usuarios.php', 'POST', [
    'nombre' => 'Vendedor de prueba', 'email' => $email_vend,
    'password' => 'Vende123', 'rol_id' => 5,
]);
verificar('Crea vendedor con rol de caja', $r['codigo'] === 201);
$vendedor_id = $r['json']['datos']['id'] ?? 0;

$cookie_admin = $cookie;
$cookie = null;
pedir('/auth/login.php', 'POST', ['email' => $email_vend, 'password' => 'Vende123']);

$r = pedir('/ventas.php', 'POST', [
    'almacen_id' => 1,
    'items' => [['combo_id' => $combo_ven, 'cantidad' => 1]],
]);
verificar('Vendedor SI puede registrar ventas (201)', $r['codigo'] === 201);

$r = pedir('/combos.php', 'PUT', ['id' => $combo_ven, 'codigo' => 'PRUEBA-CAJA-X', 'nombre' => 'Intento', 'precio_venta' => 1, 'ingredientes' => [['producto_id' => $prod_ven, 'cantidad' => 1]]]);
verificar('Vendedor NO puede editar el menu (403)', $r['codigo'] === 403);

$r = pedir('/movimientos.php', 'POST', ['producto_id' => $prod_ven, 'almacen_id' => 1, 'tipo' => 'entrada', 'cantidad' => 1]);
verificar('Vendedor NO mueve inventario (403)', $r['codigo'] === 403);

$r = pedir('/pedidos.php');
verificar('Vendedor SI ve la cocina (200)', $r['codigo'] === 200);

// El rol Consulta solo observa
$r = pedir('/auth/login.php', 'POST', ['email' => $email_test, 'password' => 'Prueba123']);
$r = pedir('/ventas.php');
verificar('Consulta SI ve el listado de ventas (200)', $r['codigo'] === 200);
$r = pedir('/ventas.php', 'POST', ['almacen_id' => 1, 'items' => [['combo_id' => $combo_ven, 'cantidad' => 1]]]);
verificar('Consulta NO registra ventas (403)', $r['codigo'] === 403);
$r = pedir('/pedidos.php', 'POST', ['id' => 1, 'estado' => 'listo']);
verificar('Consulta NO avanza pedidos (403)', $r['codigo'] === 403);

$cookie = $cookie_admin;

// ----------------------------------------------------------------------

seccion('12. DASHBOARD');

$r = pedir('/dashboard.php');
verificar('Dashboard responde', $r['codigo'] === 200);
verificar('Incluye metricas', isset($r['json']['datos']['metricas']['productos_activos']));
verificar('Incluye graficas', isset($r['json']['datos']['graficas']['stock_por_almacen']));
verificar('Incluye alertas', isset($r['json']['datos']['alertas']));
verificar('Incluye ultimos movimientos', isset($r['json']['datos']['ultimos']));
verificar('El valor total es consistente', $r['json']['datos']['metricas']['valor_venta'] >= $r['json']['datos']['metricas']['valor_costo']);
verificar('Calcula el margen de utilidad', $r['json']['datos']['metricas']['margen_porcentaje'] > 0);
verificar('Reporta ventas de hoy', isset($r['json']['datos']['metricas']['ventas_hoy']['total']));
verificar('Reporta ventas del mes', isset($r['json']['datos']['metricas']['ventas_mes']['total']));
verificar('Calcula la ganancia real de lo vendido', isset($r['json']['datos']['metricas']['ganancia_real']));
verificar('Cuenta los pedidos de cocina pendientes', isset($r['json']['datos']['metricas']['pedidos_pendientes']));
verificar('Cuenta los proximos a vencer', isset($r['json']['datos']['metricas']['proximos_vencer']));
verificar('Incluye la serie de ventas diarias', isset($r['json']['datos']['graficas']['ventas_diarias']));
verificar('Incluye la serie de ventas semanales', isset($r['json']['datos']['graficas']['ventas_semanales']));
verificar('Top de combos mas vendidos', isset($r['json']['datos']['graficas']['top_combos']));
verificar('Top de productos mas consumidos', isset($r['json']['datos']['graficas']['top_productos']));

// ----------------------------------------------------------------------

seccion('13. LIMPIEZA');

$r = pedir('/productos.php?por_pagina=100');
verificar('El sistema responde al final de las pruebas', $r['codigo'] === 200);

// Limpieza final del producto, almacen, combos y usuarios de prueba.
// El DELETE por API no basta: el producto tiene movimientos, asi que la API
// lo desactiva en vez de borrarlo. Purga directa para no dejar basura.
limpiar_rastros($nuevo_id, $alm_id, [$user_id, $vendedor_id], $cat_prueba_id);

// Comprobamos que la base quedo limpia y el catalogo real intacto.
// Miramos estado=todos: un producto de prueba desactivado tampoco puede
// quedar colgando, asi que revisar solo los activos no seria suficiente.
$r = pedir('/productos.php?por_pagina=100&estado=todos');
$restantes = consultar("SELECT codigo FROM productos WHERE codigo LIKE 'PRUEBA-%'");
verificar(
    'La limpieza no deja rastros de productos de prueba',
    empty($restantes) && !str_contains(json_encode($r['json']['datos']['productos'] ?? []), 'PRUEBA-'),
    'quedan: ' . implode(', ', array_column($restantes, 'codigo'))
);
verificar('El almacen de prueba fue eliminado', !in_array($alm_id, array_column(
    consultar('SELECT id FROM almacenes'), 'id'
), true));
verificar('El usuario de prueba fue eliminado', !in_array($user_id, array_column(
    consultar('SELECT id FROM usuarios'), 'id'
), true));

// ----------------------------------------------------------------------

// Nota: la tabla `auditoria` SI crece en cada corrida y esta bien. Es un log
// inmutable y lo correcto es que deje constancia de lo que hizo la suite.
// limpiar_rastros() borra solo los rastros de los datos de prueba; las
// acciones del admin (logins) se quedan, que es justo lo que auditamos.

seccion('14. INTEGRIDAD DE LAS RESPUESTAS');

// Un warning de PHP impreso dentro del cuerpo rompe el fetch() del navegador
// sin avisar nada. Lo comprobamos aqui para que nunca pase desapercibido.
verificar(
    'Todas las respuestas del API son JSON valido',
    empty($json_invalidas),
    count($json_invalidas) . ' respuesta(s) invalida(s)'
);

// El detalle se imprime siempre: sin esto no se sabe que endpoint rompio.
if (!empty($json_invalidas)) {
    echo "\nRESPUESTAS QUE NO SON JSON (revisar display_errors):\n";
    foreach ($json_invalidas as $e) echo "  - $e\n";
}

// ----------------------------------------------------------------------

echo "\n";
echo "==========================================\n";
echo "  RESULTADO: $ok correctas, $fallos fallidas\n";
echo "==========================================\n";
if ($fallos > 0) {
    echo "\nFALLOS:\n";
    foreach ($errores as $e) echo "  - $e\n";
    exit(1);
}
echo "\nTodo el backend funciona correctamente.\n";
