/**
 * GUARDAR Y SUBIR A GITHUB en un solo paso.
 *
 * Uso:
 *     npm run guardar
 *     npm run guardar -- "mensaje de lo que cambie"
 *
 * Que hace, en orden:
 *   1. Revisa si hay cambios (y si los hay, de que tipo).
 *   2. Los anota con `git add`.
 *   3. Crea un commit con el mensaje que le des.
 *   4. Sube el commit a GitHub.
 *
 * No sube nunca tus datos de base de datos: `api/config.local.php` y
 * `node_modules` estan en .gitignore y se saltan automaticamente.
 */

import { execSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

// ----------------------------------------------------------------------

/** Ejecuta un comando de git y devuelve su salida sin los ruidos de PowerShell. */
function git(args, { mostra = false } = {}) {
  const salida = execSync(`git ${args}`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });

  if (mostra && salida.trim()) {
    console.log(salida.trim());
  }

  return salida.trim();
}

// ----------------------------------------------------------------------

console.log('\n=== Guardar y subir a GitHub ===\n');

const rama = git('rev-parse --abbrev-ref HEAD');

// ----------------------------------------------------------------------
//  1. Hay cambios?
// ----------------------------------------------------------------------

let cambios = '';

try {
  cambios = git('status --porcelain');
} catch {
  console.error('ERROR: esta carpeta no es un repositorio de git.');
  process.exit(1);
}

if (!cambios) {
  console.log('No hay ningun cambio pendiente.');
  console.log(`Ya estas al dia con GitHub (rama "${rama}").`);
  process.exit(0);
}

// ----------------------------------------------------------------------
//  2. Resumen de lo que cambio (para verlo antes de confirmar)
// ----------------------------------------------------------------------

const lineas = cambios.split('\n').filter(Boolean);

const nuevos = lineas.filter((l) => l.startsWith('A'));
const editados = lineas.filter((l) => l.startsWith('M'));
const borrados = lineas.filter((l) => l.startsWith('D'));

console.log('Cambios detectados:');
if (nuevos.length) console.log(`  ${nuevos.length} nuevo(s)`);
if (editados.length) console.log(`  ${editados.length} modificado(s)`);
if (borrados.length) console.log(`  ${borrados.length} borrado(s)`);

// Aviso util: si tocan el codigo de la app, la version compilada queda
// desactualizada y conviene regenerarla con `npm run build:listo`.
const tocaCodigo = lineas.some((l) => /^(A|M|D)\s+(src|api)\//.test(l.trim()) && !l.includes('config.local'));

if (tocaCodigo) {
  console.log('\nAviso: cambiaste codigo de la aplicacion.');
  console.log('  Recuerda recompilar la version compilada antes de subir:');
  console.log('      npm run build:listo');
}

// ----------------------------------------------------------------------
//  3. Mensaje del commit
// ----------------------------------------------------------------------

let mensaje = process.argv[2];

// El prompt solo funciona en una terminal real. Cuando el comando se lanza
// desde un script o un servicio (sin teclado), se usa un mensaje generico
// en vez de quedarse esperando una respuesta que nunca llegara.
const hayTeclado = Boolean(input.isTTY);

if (!mensaje && hayTeclado) {
  const rl = createInterface({ input, output });

  mensaje = (await rl.question('\nDescribe el cambio (ej: "arregle el color del boton"): ')).trim();

  rl.close();
}

if (!mensaje) {
  mensaje = 'Actualizacion del proyecto';
  console.log(`\nSin teclado: se usara el mensaje "${mensaje}".`);
  console.log('Para escribirlo tu mismo:  npm run guardar -- "tu mensaje"');
}

if (!mensaje) {
  console.error('\nCancelado: el mensaje del commit no puede estar vacio.');
  process.exit(1);
}

// ----------------------------------------------------------------------
//  4. Commit
// ----------------------------------------------------------------------

git('add -A');
git(`commit -m "${mensaje.replaceAll('"', '\\"')}"`);

const commit = git('log -1 --format=%h');

// ----------------------------------------------------------------------
//  5. Push
// ----------------------------------------------------------------------

try {
  git('push origin HEAD', { mostra: false });

  console.log(`\nListo. Commit ${commit} subido a GitHub.`);
  console.log(`Ver en: https://github.com/Goldiden7u7/Invetarios/commit/${commit}\n`);
} catch (e) {
  console.error(`\nEl commit ${commit} se creo localmente, pero NO se pudo subir.`);
  console.error('Revisa tu conexion a internet o que tengas sesion iniciada en GitHub.');
  console.error(`Para reintentarlo despues:  git push\n`);
  process.exit(1);
}