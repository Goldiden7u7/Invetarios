/**
 * Prepara la version COMPILADA para poder usarla sin Node ni Vite.
 *
 * Ejecutar despues de `vite build`:
 *
 *     npm run build:listo
 *
 * Que hace:
 *   1) Copia la API PHP dentro de dist/ para que la app compilada y el
 *      backend vivan en el mismo origen (igual que en un hosting real).
 *   2) Copia el .htaccess de seguridad.
 *   3) Copia el archivo SQL de la base de datos para tener todo a mano.
 *   4) Escribe un LEEME.txt con el comando exacto para arrancar.
 *
 * El resultado es la carpeta dist/, que se puede servir tal cual:
 *     php -S 127.0.0.1:8080 -t dist
 */

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(raiz, 'dist');

// ----------------------------------------------------------------------

if (!existsSync(dist)) {
  console.error('ERROR: no existe la carpeta dist/. Ejecuta primero:  npm run build');
  process.exit(1);
}

/** Copia una carpeta completa, avisando si no existe el origen. */
function copiarCarpeta(origen, destino) {
  const desde = join(raiz, origen);

  if (!existsSync(desde)) {
    console.warn(`  aviso: no existe ${origen}, se omite`);
    return false;
  }

  mkdirSync(destino, { recursive: true });
  cpSync(desde, destino, { recursive: true });
  console.log(`  + ${destino.replace(raiz, '.').replaceAll('\\', '/')}`);

  return true;
}

/** Copia un archivo suelto, si existe. */
function copiarArchivo(origen, destino) {
  const desde = join(raiz, origen);

  if (!existsSync(desde)) {
    console.warn(`  aviso: no existe ${origen}, se omite`);
    return false;
  }

  cpSync(desde, destino);
  console.log(`  + ${destino.replace(raiz, '.').replaceAll('\\', '/')}`);

  return true;
}

// ----------------------------------------------------------------------

console.log('Preparando la version compilada...\n');

// La API va DENTRO de dist: asi /api/... resuelve en el mismo origen y la
// cookie de sesion viaja sin problemas, tal cual funciona en un hosting.
copiarCarpeta('api', join(dist, 'api'));
copiarCarpeta('sql', join(dist, 'sql'));
copiarArchivo('MANUEL_INSTALACION.md', join(dist, 'MANUEL_INSTALACION.md'));

// ----------------------------------------------------------------------

const leeme = `COMO USAR ESTA VERSION COMPILADA
====================================

No necesitas Node.js ni Vite. Solo PHP y MySQL (por ejemplo XAMPP).

PASO 1 - Crear la base de datos
-------------------------------
Abre phpMyAdmin (http://localhost/phpmyadmin), crea la base de datos
llamada  inventario_db  con cotejamiento  utf8mb4_unicode_ci,
seleccionala e importa el archivo:

    sql/inventario_db.sql

PASO 2 - Arrancar el servidor
-----------------------------
Desde esta carpeta (dist) ejecuta:

    Windows:  C:\\xampp\\php\\php.exe -S 127.0.0.1:8080 -t .
    Linux:    php -S 127.0.0.1:8080 -t .

Deja esa terminal abierta.

PASO 3 - Entrar
---------------
Abre  http://127.0.0.1:8080

    Administrador   admin@inventario.com    Admin123!
    Caja            caja@inventario.com     Caja123!
    Cocina          cocina@inventario.com   Cocina123!

Cada usuario entra a su modulo: el de caja cobra pero NO ve las cifras de
ventas, y el de cocina prepara pedidos pero NO puede cobrar. El
administrador entra a TODO: mira los numeros, administra el catalogo y
tambien puede cobrar o mover la cocina si hace falta. El dinero de cada
venta (lo que ENTRO) y los pagos de servicios (lo que SALIO: trabajadores,
transporte, local y servicios) los mira en Movimientos -> pestana "Caja".

CAMBIA LAS TRES CONTRASENAS apenas entres (menu Usuarios).

NOTA - Si tu MySQL no es el de XAMPP
------------------------------------
Crea el archivo  api/config.local.php  con tus datos:

    <?php
    define('DB_HOST', 'localhost');
    define('DB_USER', 'root');
    define('DB_PASS', 'tu_contrasena');
    define('DB_NAME', 'inventario_db');

PRUEBAS DEL BACKEND
-------------------
Con el servidor del paso 2 corriendo, abre:

    http://127.0.0.1:8080/pruebas.php

Debe decir "176 correctas, 0 fallidas".

VENTAS DE EJEMPLO
-----------------
    http://127.0.0.1:8080/semilla_ventas.php

`;

writeFileSync(join(dist, 'LEEME.txt'), leeme, 'utf8');
console.log('  + dist/LEEME.txt');

console.log('\nListo. La carpeta dist/ ya se puede servir tal cual.');
console.log('Arrancala con:  php -S 127.0.0.1:8080 -t dist');
