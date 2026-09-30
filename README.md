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

| | |
|---|---|
| **Correo** | `admin@inventario.com` |
| **Contrasena** | `Admin123!` |

> **Cambia esta clave apenas entres.** Ve a **Usuarios**, edita el
> administrador y pon una contrasena propia.

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

Verifica 142 casos: autenticacion, permisos, CRUD, stock, transferencias y
ventas. Se limpian solas al terminar, asi que se pueden repetir.

---

## Roles incluidos

| Rol | Puede hacer |
|---|---|
| Administrador | Todo |
| Supervisor | Ver, crear, editar, borrar y registrar movimientos |
| Operador | Ver, crear, editar y registrar movimientos |
| Vendedor | Ver y crear (caja) |
| Cocina | Ver y crear (mover pedidos) |
| Consulta | Solo ver |

---

## Estructura del proyecto

```
api/                 API PHP (un archivo por recurso)
  auth/              login.php, logout.php, yo.php
  nucleo.php         Base comun: conexion, sesiones, permisos, helpers
  config.php         Conexion a la base de datos (SIN secretos)
  pruebas.php        Suite de 142 pruebas automaticas
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
