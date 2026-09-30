# Manual de instalación — Sistema de Cafetería (POS + Inventario)

Aplicación **React + Vite** (frontend) con **API PHP/MySQL** (backend). Incluye
punto de caja (POS) con descuento de stock por receta, cola de cocina,
inventario con fechas de vencimiento, transferencias entre almacenes y
gestión de usuarios con roles.

---

## 1. Requisitos

| Componente | Versión mínima                       |
| ---------- | ------------------------------------ |
| PHP        | 8.1+                                 |
| MySQL      | 5.7+ / MariaDB 10.3+                 |
| Node.js    | 20+ (solo para **compilar** el front) |
| Hosting    | Cualquier cPanel (o XAMPP local)     |

El frontend se compila a archivos **estáticos** (`dist/`) que puedes subir a
cualquier hosting; el único requisito de ejecución en el servidor es **PHP +
MySQL**, porque el backend (carpeta `api/`) corre ahí.

---

## 2. Estructura del proyecto

```
material-kit-react-main/
├── api/                   ← Backend PHP (subir al hosting)
│   ├── config.php           (UNICA config: credenciales de la BD)
│   ├── nucleo.php           Conexion, sesiones, permisos, respuestas
│   ├── auth/                 Login / logout / sesión (subcarpeta)
│   │   ├── login.php           POST  → inicia sesión
│   │   ├── logout.php          POST  → cierra sesión
│   │   └── yo.php              GET   → usuario de la sesión
│   ├── productos.php        Inventario CRUD (vencimientos, seriales)
│   ├── categorias.php       Categorias
│   ├── almacenes.php        Almacenes + resumen de valor
│   ├── movimientos.php      Entradas/salidas/ajustes de stock
│   ├── transferencias.php   Traslados entre almacenes
│   ├── combos.php           Menu con recetas (base + extras opcionales)
│   ├── ventas.php           Caja: cobra y descuenta stock por receta
│   ├── pedidos.php          Cola de cocina (estados de preparacion)
│   ├── usuarios.php         Cuentas y roles
│   ├── dashboard.php        Metricas y graficas (ventas, top ventas)
│   ├── semilla_ventas.php   Genera ventas de DEMO (opcional)
│   └── README-permisos.md   Que permiso pide cada endpoint
├── sql/
│   └── inventario_db.sql    Esquema + datos base + usuario admin inicial
├── src/                    ← Frontend React (fuente)
└── …resto del template (build, configuracion)
```

---

## 3. Instalación local (XAMPP, para desarrollo)

### 3.1 Base de datos

1. Arranca **Apache** y **MySQL** en el panel de XAMPP.
2. Crea la base (desde phpMyAdmin o consola):

```sql
CREATE DATABASE inventario_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

3. Importa el esquema. **Importante:** el archivo usa `utf8mb4`; si lo
   importas por consola, indica el charset o los acentos se romperán:

```bash
C:\xampp\mysql\bin\mysql.exe -u root --default-character-set=utf8mb4 inventario_db < sql\inventario_db.sql
```

   Desde **phpMyAdmin**: pestaña *Importar* → selecciona
   `sql/inventario_db.sql`. Antes de importar, en *Caracteres del archivo*
   elige `utf8mb4` si tu phpMyAdmin no lo detecta.

### 3.2 Backend PHP

1. Copia la carpeta `api/` a un directorio servido por Apache (p. ej.
   `C:\xampp\htdocs\inventario\api\`) o usa `php -S`:

```bash
cd api
C:\xampp\php\php.exe -S 127.0.0.1:8080
```

2. Edita `api/config.php` con tus credenciales locales:

```php
define('DB_HOST', 'localhost');
define('DB_USER', 'root');
define('DB_PASS', '');
define('DB_NAME', 'inventario_db');
```

### 3.3 Frontend React

```bash
npm install
npm run dev          # abre http://localhost:3039
```

El servidor de Vite ya trae un **proxy**: `/api/*` se reenvía a
`http://127.0.0.1:8080/*` (configurable con la variable `API_URL`). Gracias al
proxy, el navegador ve un solo origen y la cookie de sesión PHP viaja sin
CORS.

### 3.4 Primer ingreso

Entra con el usuario administrador que ya viene en el SQL:

> **Correo:** `admin@inventario.com` **Clave:** `Admin123!`

**Cambia esa clave cuanto antes** (menú *Usuarios* → editar tu cuenta).

### 3.5 Datos de ventas de ejemplo (opcional)

Para ver el dashboard con ventas, ganancias y top de combos:

```bash
C:\xampp\php\php.exe api\semilla_ventas.php
```

Genera ~30 ventas históricas con pedidos en distintos estados. Puedes
ejecutarlo las veces que quieras.

---

## 4. Instalación en cPanel (producción)

### 4.1 Crear base de datos y usuario

1. En cPanel: **MySQL® Databases**.
2. Crea la base (p. ej. `miemp_inventario`) con charset `utf8mb4`.
3. Crea el usuario y **asígnalo a la base con TODOS los privilegios**.
4. En **phpMyAdmin**, selecciona tu base e importa `sql/inventario_db.sql`
   (igual que en 3.1, verificando `utf8mb4`).

### 4.2 Subir el backend

1. Sube **todo el contenido de `api/`** a `public_html/api/` (por FTP o el
   Administrador de archivos de cPanel).
2. Edita `public_html/api/config.php`:

```php
define('DB_HOST', 'localhost');
define('DB_USER', 'tu_usuario_mysql');
define('DB_PASS', 'tu_clave_fuerte');
define('DB_NAME', 'tu_nombre_de_base');
```

3. Comprueba que el API responde. Abre en el navegador:

```
https://tudominio.com/api/auth/yo.php
```

Debe devolver **JSON** (no HTML, no un archivo descargado):

```json
{"ok":false,"error":"No hay sesion activa o la sesion expiro"}
```

Si ves HTML o un error en texto plano, tu hosting está mostrando el código
PHP: revisa que los archivos `.php` se ejecuten y que hayas subido todo el
contenido de `api/` (incluida la subcarpeta `auth/`).

Para probar el login desde la terminal:

```bash
curl -X POST https://tudominio.com/api/auth/login.php \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@inventario.com","password":"Admin123!"}'
```

Respuesta correcta (200):

```json
{"ok":true,"datos":{"id":1,"nombre":"Administrador","rol":"Administrador","permisos":127}}
```

> **CORS:** si el frontend y el API viven en el mismo dominio, no hace falta
> tocar nada (`CORS_ORIGENES` puede quedarse en `*`). Si los pones en
> dominios distintos, lista ahí los orígenes reales separados por coma.

### 4.3 Compilar y subir el frontend

```bash
npm install
npm run build          # genera la carpeta dist/
```

El `BASE` del cliente es **relativo** (`/api`), pensado para que el frontend
se sirva desde `public_html/` (raíz del dominio) y el API esté en
`public_html/api/`:

```
public_html/
├── index.html        ← dist/ completo
├── assets/…
└── api/              ← backend PHP
```

Si prefieres servir la app en una subcarpeta, abre
`src/api/client.ts` y cambia `const BASE = '/api'` por la ruta completa
(p. ej. `const BASE = 'https://tudominio.com/api'`), y recompila.

---

## 5. Roles y permisos

Los roles se guardan como **flags de bits** en la columna `permisos`:

| Bit | Permiso        |
| --- | -------------- |
| 1   | Ver            |
| 2   | Crear (cobra)  |
| 4   | Editar         |
| 8   | Eliminar       |
| 16  | Movimientos / transferencias |
| 32  | Usuarios       |
| 64  | Config         |

Roles incluidos: **Administrador** (127), **Supervisor** (31), **Operador**
(19), **Consulta** (1), **Vendedor** (3) y **Cocina** (3). Los bits se suman:
un Supervisor suma 1+2+4+8+16 = 31.

La lista exacta de permisos por endpoint está en
[`api/README-permisos.md`](api/README-permisos.md).

---

## 6. Solución de problemas

| Síntoma                                            | Causa / solución                                                                 |
| -------------------------------------------------- | -------------------------------------------------------------------------------- |
| Los acentos salen como `Ã©`                        | La importación no usó `utf8mb4`. Reimporta con `--default-character-set=utf8mb4` (o elige el charset en phpMyAdmin). |
| `El servidor devolvio una respuesta ilegible`      | El API no está accesible desde el frontend: revisa el proxy en dev o el `BASE` en producción y que `config.php` apunte bien. |
| Todo falla con 401 / te saca al login              | La sesión expiró o la cookie no viaja: en dev usa el proxy (no CORS directo).      |
| 500 en `auth/login.php`                             | Mala credencial de BD en `config.php`, o el SQL no se importó completo.           |
| `MODO_DEBUG`                                       | Ponlo en `0` en producción para ocultar detalles internos en las respuestas.      |

---

## 7. Seguridad (lista de verificación)

- [ ] `api/config.php` con credenciales reales y **fuera del alcance del navegador** (los `.php` se ejecutan, no se muestran).
- [ ] Clave del admin cambiada después del primer ingreso.
- [ ] `MODO_DEBUG` en `0`.
- [ ] Usuarios con el rol mínimo necesario (principio de menor privilegio).
- [ ] Backup programado de la base de datos.