# Sistema de Inventario, Caja y Cocina

Aplicacion web para administrar una cafeteria o un negocio de alimentos:
controla el inventario, cobra las ventas y envia los pedidos a la cocina.

- **Frontend:** React 18 + TypeScript + Vite + Material UI
- **Backend:** PHP 8 (API REST) + MySQL / MariaDB
- **Idioma:** toda la interfaz esta en espanol

---

## Que incluye

| Modulo | Para que sirve |
|---|---|
| **Resumen** | Ventas del dia y del mes, ganancia real, margen, productos que mas se venden y que hay que reponer |
| **Caja** | Punto de venta: menu de combos, personalizacion de ingredientes, cobro y descuentos |
| **Cocina** | Cola de pedidos en 3 estados (pendiente / en preparacion / listo). Cada pedido se abre para ver exactamente que preparar y que NO preparar |
| **Inventario** | Productos con stock por almacen, fecha de vencimiento, nivel minimo y alertas |
| **Movimientos** | Entradas, salidas y ajustes de stock, con auditoria |
| **Transferencias** | Traslado de stock entre almacenes, con recepcion |
| **Almacenes** | Puntos de stock (despensa, barra, refrigeracion) |
| **Categorias** | Clasificacion de los productos |
| **Usuarios** | Cuentas con roles y permisos (6 roles preconfigurados) |

### Detalle del menu (combinado con cocina)

Cada combo tiene una **receta**: los productos que consume. Al cobrar, el
sistema descuenta el stock automaticamente segun esa receta.

- **Agregar extra:** suma `precio_extra` y descuenta ese producto del stock.
- **Quitar ingrediente:** el cliente lo pide sin ese ingrediente, la cocina lo
  ve marcado como **NO PREPARAR** y ese producto **no** se descuenta.
- Cada linea guardada guarda la receta completa mas una lista de lo quitado,
  para que el detalle de la venta sea auditable.

---

## Requisitos

- **Node.js 18 o superior** ([nodejs.org](https://nodejs.org))
- **PHP 8 o superior** (viene incluido en [XAMPP](https://www.apachefriends.org))
- **MySQL 5.7+ o MariaDB 10.4+** (viene incluido en XAMPP)

---

## Elige como quieres usar el proyecto

Hay **tres formas** de trabajar con este repositorio. Elige la que necesitas:

| | Opcion | Para quien es | Necesitas Node |
|---|---|---|---|
| **1** | [Usar la version compilada](#opcion-1-usar-la-version-compilada) | Solo quieres que **funcione**, sin programar | No |
| **2** | [Modificar el codigo](#opcion-2-modificar-el-codigo) | Vas a **cambiar cosas** en la app | Si |
| **3** | [Publicar en un hosting](#opcion-3-publicar-en-un-hosting-cpanel) | Vas a ponerlo **en internet** para tus clientes | No |

---

## Opcion 1: Usar la version compilada

**La mas facil.** No necesitas Node.js, ni Vite, ni compilar nada.
La carpeta `dist/` ya viene armada con la API adentro.

**1. Crea la base de datos**

Abre **phpMyAdmin** (<http://localhost/phpmyadmin>), crea la base
`inventario_db` con cotejamiento `utf8mb4_unicode_ci`, seleccionala e
importa el archivo `sql/inventario_db.sql` (pestana **Importar**).

**2. Arranca el servidor** (desde la carpeta `dist`)

```bash
# Windows
C:\xampp\php\php.exe -S 127.0.0.1:8080 -t dist

# Linux / Mac
php -S 127.0.0.1:8080 -t dist
```

**3. Entra** en <http://127.0.0.1:8080>

| | |
|---|---|
| **Correo** | `admin@inventario.com` |
| **Contrasena** | `Admin123!` |

Eso es todo. Hay un `LEEME.txt` dentro de `dist/` con estas mismas
instrucciones, por si se la pasas a otra persona.

---

## Opcion 2: Modificar el codigo

**Para desarrollar.** Con recarga en caliente: cambias un archivo, se
actualiza solo en el navegador.

**1. Instala las dependencias**

```bash
npm install
```

**2. Arranca la API** (en una terminal, desde la raiz del proyecto)

```bash
C:\xampp\php\php.exe -S 127.0.0.1:8080 -t api
```

*(Linux/Mac: `php -S 127.0.0.1:8080 -t api`)*

**3. Arranca la app** (en **otra** terminal)

```bash
npm run dev
```

Abre <http://localhost:3039>.

> **Por que dos servidores?** En desarrollo el frontend y el API viven en
> puertos distintos. Vite hace de intermediario (proxy) y por eso la
> sesion con cookies funciona igual que en produccion. En la Opcion 1 no
> hace falta porque todo va en el mismo puerto.

**4. Regenerar la version compilada** cuando quieras publicarla

```bash
npm run build:listo
```

Esto compila la app **y** deja la API copiada adentro de `dist/`, listo
para subir a un hosting o para entregarselo a alguien.

### Comandos utiles

| Comando | Que hace |
|---|---|
| `npm run dev` | Servidor de desarrollo con recarga en caliente |
| `npm run build:listo` | Compila y arma `dist/` completo |
| `npm run lint` | Revisa errores de codigo |
| `npm run lint:fix` | Corrige los errores automatiquement |
| `npm run fm:fix` | Formatea el codigo |

---

## Tu rutina diaria de trabajo

Si estas haciendo cambios con la **Opcion 2**, el ciclo es siempre el mismo:

```
   1. ABRIR        Arranca la API y el servidor de desarrollo
        |
   2. MODIFICAR    Edita archivos; el navegador se actualiza solo
        |
   3. GUARDAR      Un comando y ya esta en GitHub
```

### 1. Abrir (dos terminales)

Terminal 1 — la API:
```bash
C:\xampp\php\php.exe -S 127.0.0.1:8080 -t api
```

Terminal 2 — la app:
```bash
npm run dev
```

Abre <http://localhost:3039> y trabaja.

### 2. Modificar

Edita lo que quieras en `src/` o `api/`. Guarda el archivo y la pagina se
actualiza sola. No hace falta recargar a mano ni reiniciar nada.

### 3. Guardar y subir

Cuando quieras subir tus cambios a GitHub:

```bash
npm run guardar
```

Te preguntara **que cambiaste**. Escribe algo corto y claro, por ejemplo:

```
arregle el color del boton de cobrar
```

Y eso es todo: el comando hace el `add`, el `commit` y el `push`. En unos
segundos tu cambio ya esta en <https://github.com/Goldiden7u7/Invetarios>.

> **Atajo:** si prefieres que no te pregunte, escribe el mensaje directo:
> ```bash
> npm run guardar -- "arregle el color del boton"
> ```

### 4. Si cambiaste codigo de la app

Antes de subir, regenera la version compilada para que no quede desfasada:

```bash
npm run build:listo
npm run guardar
```

> El comando `npm run guardar` te avisa con un mensaje cuando detecta que
> tocaste `src/` o `api/`, para que no se te olvide este paso.

### Si prefieres hacerlo a mano

Son tres comandos, en la carpeta del proyecto:

```bash
git add .                              # preparar los cambios
git commit -m "mensaje corto"          # guardarlos con una descripcion
git push                               # subirlos a GitHub
```

### Que NUNCA se sube a GitHub

Esto esta en `.gitignore`, asi que es imposible subirlo por accidente:

| | |
|---|---|
| `api/config.local.php` | Tus datos reales de base de datos |
| `node_modules/` | Dependencias (se reinstalan con `npm install`) |

---

## Opcion 3: Publicar en un hosting (cPanel)

1. Compila: `npm run build:listo`
2. Sube **todo el contenido de `dist/`** a `public_html/` de tu hosting.
   Como la API ya viene dentro, te queda asi:
   ```
   public_html/
     index.html
     assets/
     api/          <- ya incluido
   ```
3. Crea la base de datos en cPanel e importa `sql/inventario_db.sql`.
4. Crea el archivo **`public_html/api/config.local.php`** con los datos de
   tu cPanel, o define las variables de entorno `DB_HOST`, `DB_USER`,
   `DB_PASS` y `DB_NAME`.
5. En `api/config.php` pon `MODO_DEBUG` en `0` y ajusta `CORS_ORIGENES`
   con tu dominio.
6. **Cambia la contrasena del administrador.**

Mas detalle en **[MANUEL_INSTALACION.md](MANUEL_INSTALACION.md)**.

---

## Configurar la conexion a la base de datos

El archivo **`api/config.php`** ya trae los valores locales de XAMPP
(`localhost`, usuario `root`, sin contrasena, `inventario_db`), asi que en
un XAMPP recien instalado no hay nada que tocar.

Si tu MySQL es distinto, hay dos formas:

**Opcion A — Crear `api/config.local.php`** (recomendada; ese archivo **no**
se sube a GitHub):

```php
<?php
define('DB_HOST', 'localhost');
define('DB_USER', 'root');
define('DB_PASS', 'tu_contrasena');
define('DB_NAME', 'inventario_db');
```

**Opcion B — Variables de entorno**, sin tocar el codigo: define `DB_HOST`,
`DB_USER`, `DB_PASS` y `DB_NAME` antes de arrancar PHP.

---

## Entrar al sistema

Empieza por el administrador:

| | |
|---|---|
| **Correo** | `admin@inventario.com` |
| **Contrasena** | `Admin123!` |

> **Cambia esta clave apenas entres.** Ve a **Usuarios**, edita el
> administrador y pon una contrasena propia.

Tambien hay una cuenta de **caja** y una de **cocina** para probar como
queda separado el sistema.estan explicadas justo despues.

### Cargar ventas de ejemplo (opcional)

Para ver el dashboard con datos realistas en vez de en cero:

```bash
C:\xampp\php\php.exe api/semilla_ventas.php
```

Crea ventas de los ultimos 30 dias y deja pedidos pendientes en cocina.

### Correr las pruebas del backend

```bash
C:\xampp\php\php.exe api/pruebas.php
```

Verifica 163 casos: autenticacion, permisos, CRUD, stock, transferencias,
ventas y la separacion de caja/cocina. Se limpian solas al terminar, asi que
se pueden repetir.

---

## Las tres cuentas y a que modulo entran

La base de datos viene con **tres usuarios separados**, uno por trabajo.
Cada uno entra por su modulo y **no ve lo que no le corresponde**:

| Correo | Clave | Ve el menu | **NO** puede |
|---|---|---|---|
| `admin@inventario.com` | `Admin123!` | **Todo**: Resumen, Caja, Cocina, Inventario, Movimientos, Transferencias, Almacenes, Categorias, Usuarios | — |
| `caja@inventario.com` | `Caja123!` | **Caja** e Inventario | Ver el Resumen con las cifras, ver el historial de ventas, entrar a Cocina, gestionar usuarios |
| `cocina@inventario.com` | `Cocina123!` | **Cocina** e Inventario | Ver cifras o historial de ventas, cobrar, entrar a Caja |

El administrador es el **dueño** y entra a todo: administra el catalogo, ve
los numeros y, si hace falta relevar un turno, tambien puede cobrar en la
Caja o mover la Cocina. Los roles Vendedor y Cocina son para los empleados,
que cada uno entra solo a lo suyo.

La separacion va en dos capas, no solo en el menu:

- **El menu** esconde lo que no te toca. Si abres a mano una seccion que no
  te corresponde, la app te manda sola a la primera que si puedes usar.
- **El API lo rechaza con 403.** Aunque alguien escriba la direccion a mano,
  el servidor no le devuelve los datos.

Asi, por ejemplo, el de cocina **no puede registrar una venta** ni aunque
intente hacerlo directamente contra el API, porque esa accion exige a la vez
el permiso de *crear* y el de *Caja*.

### El dinero de cada venta, en Movimientos → Caja

Adentro de **Movimientos** hay dos pestanas:

- **Stock** — las entradas, salidas y ajustes del inventario (lo que entra y
  sale del almacen).
- **Caja** — el dinero de cada venta: cuanto entro, quien cobro, con que
  metodo de pago y cuanta ganancia dejo. Arriba van tres tarjetas: lo que
  entro **hoy**, lo que quedo **en efectivo** (que es lo que sigue en la
  gaveta) y el **acumulado del mes** con su ganancia.

Esta segunda pestana pide el permiso de *ventas*, asi que la ve el
administrador (y los roles de control), no el cajero ni el de cocina: las
cifras del negocio no son de quien cobra.

### Para darle una cuenta nueva a un empleado

En **Usuarios → Crear usuario**, elige el rol que corresponde a su trabajo
(`Vendedor` para quien cobra, `Cocina` para quien cocina). Los permisos de
cada rol estan documentados en
[`api/README-permisos.md`](api/README-permisos.md).

> **Cambia las tres claves** de ejemplo cuando crees la base de datos: la de
> `Admin123!` esta escrita en el README, asi que cualquiera que lo lea la
> sabe. Menu **Usuarios → editar → nueva contrasena**.

---

## Estructura del proyecto

```
api/                 API PHP (un archivo por recurso)
  auth/              login.php, logout.php, yo.php
  nucleo.php         Base comun: conexion, sesiones, permisos, helpers
  config.php         Conexion a la base de datos (SIN secretos)
  pruebas.php        Suite de 163 pruebas automaticas
  README-permisos.md Que permiso exige cada endpoint
  semilla_ventas.php Genera ventas de ejemplo
sql/
  inventario_db.sql  Esquema + datos de ejemplo
src/                 Codigo fuente de la app (React + TypeScript)
  sections/          Una carpeta por modulo (caja, cocina, inventario...)
  layouts/           Estructura general y menu lateral
  theme/             Colores y estilos
  types/             Tipos de TypeScript del dominio
scripts/
  preparar-compilado.mjs   Arma dist/ con la API incluida
dist/                Version COMPILADA, lista para usar (no necesita Node)
  index.html         Se sube tal cual a un hosting
  assets/            Archivos optimizados
  api/               Copia de la API, para servir todo desde un solo origen
  LEEME.txt          Instrucciones de uso sin Node
```

---

## Publicar en un hosting (cPanel)

> Ya esta explicado arriba en la **Opcion 3**. Los pasos completos, con
> seguridad y archivos `.htaccess`, estan en
> **[MANUEL_INSTALACION.md](MANUEL_INSTALACION.md)**.

---

## Problemas frecuentes

**"No se pudo conectar con la API"**
La terminal donde arrancaste el servidor esta cerrada, o MySQL no esta
arrancado en XAMPP.

**"El puerto 8080 esta ocupado"**
Cambia el puerto del comando y, si usas la Opcion 2, define `API_URL` con
el mismo valor antes de correr `npm run dev`.

**"Access denied for user"**
Los datos en `api/config.local.php` no coinciden con los de tu MySQL.
Verifica usuario, contrasena y que la base se llame `inventario_db`.

**La pagina se ve sin estilos**
Se instalaron mal las dependencias. Borra `node_modules`, ejecuta `npm install`
de nuevo y reinicia `npm run dev`.

**Cambie un archivo y no se refleja**
Para: `Ctrl+C` para detener el servidor y volver a correr `npm run dev`.
