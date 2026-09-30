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

## Instalacion paso a paso

### 1. Clonar el proyecto

```bash
git clone https://github.com/Goldiden7u7/Invetarios.git
cd Invetarios
```

> Si el repositorio es privado, GitHub te pedira iniciar sesion. En GitHub
> Desktop: **File → Clone repository**.

### 2. Levantar MySQL y crear la base de datos

Con XAMPP, abre el **Control Panel** y dale **Start** a MySQL.

Luego abre **phpMyAdmin** (<http://localhost/phpmyadmin>) y crea la base de datos
llamada **`inventario_db`** con cotejamiento `utf8mb4_unicode_ci`.

> Ojo: el nombre debe ser exactamente `inventario_db` (salvo que lo cambies
> en el paso 3).

### 3. Importar las tablas y datos de ejemplo

En phpMyAdmin, selecciona la base `inventario_db` y ve a la pestana
**Importar**. Elige el archivo:

```
sql/inventario_db.sql
```

y dale **Continuar / Ejecutar**.

Esto crea las 19 tablas y carga el catalogo de ejemplo: 24 productos,
12 combos, las recetas, los 6 roles y el usuario administrador.

### 4. Configurar la conexion (normalmente no hace falta nada)

El archivo **`api/config.php`** ya viene con los valores locales de XAMPP
(`localhost`, usuario `root`, sin contrasena, base `inventario_db`), asi que
en un XAMPP recien instalado no hay nada que tocar.

Si tu MySQL tiene otro usuario o contrasena, hay dos formas:

**Opcion A — Crear `api/config.local.php`** (recomendada, ese archivo NO se
sube a GitHub):

```php
<?php
define('DB_HOST', 'localhost');
define('DB_USER', 'root');
define('DB_PASS', 'tu_contrasena');
define('DB_NAME', 'inventario_db');
```

**Opcion B — Variables de entorno**, sin tocar el codigo: define `DB_HOST`,
`DB_USER`, `DB_PASS` y `DB_NAME` antes de arrancar PHP.

### 5. Instalar las dependencias del frontend

```bash
npm install
```

### 6. Arrancar la API (en una terminal)

```bash
C:\xampp\php\php.exe -S 127.0.0.1:8080 -t api
```

*(en Linux/Mac: `php -S 127.0.0.1:8080 -t api`)*

Deja esa terminal abierta. Si al ejecutarlo dice que el puerto 8080 esta
ocupado, puedes cambiarlo: la app lee la variable `API_URL`, por ejemplo
`$env:API_URL="http://127.0.0.1:8090"` antes de correr `npm run dev`.

### 7. Arrancar la app (en otra terminal)

```bash
npm run dev
```

Abre <http://localhost:3039>.

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
src/
  sections/          Una carpeta por modulo (caja, cocina, inventario...)
  layouts/           Estructura general y menu lateral
  theme/             Colores y estilos
  types/             Tipos de TypeScript del dominio
```

---

## Publicar en un hosting (cPanel)

1. Sube el contenido de `dist/` (generalo con `npm run build`) a `public_html/`.
2. Sube la carpeta `api/` a `public_html/api/`.
3. Crea la base de datos en cPanel e importa `sql/inventario_db.sql`.
4. Crea `api/config.local.php` con los datos de tu cPanel, o define las
   variables de entorno `DB_HOST`, `DB_USER`, `DB_PASS`, `DB_NAME`.
5. En `api/config.php` pon `MODO_DEBUG` en `0` y ajusta `CORS_ORIGENES`
   con tu dominio.
6. Verifica que tu hosting ejecuta los `.php` (no los muestra como texto) y
   que existe el archivo `.htaccess` que bloquea el acceso directo a la API.
7. Cambia la contrasena del administrador.

Mas detalle en **[MANUEL_INSTALACION.md](MANUEL_INSTALACION.md)**.

---

## Problemas frecuentes

**"No se pudo conectar con la API"**
La terminal del paso 6 esta cerrada, o MySQL no esta arrancado en XAMPP.

**"El puerto 8080 esta ocupado"**
Cambia el puerto del paso 6 y define `API_URL` con el mismo antes del paso 7.

**"Access denied for user"**
Los datos en `api/config.local.php` no coinciden con los de tu MySQL.
Verifica usuario, contrasena y que la base se llame `inventario_db`.

**La pagina se ve sin estilos**
Se instalaron mal las dependencias. Borra `node_modules`, ejecuta `npm install`
de nuevo y reinicia `npm run dev`.

**Cambie un archivo y no se refleja**
Para: `Ctrl+C` para detener el servidor y volver a correr `npm run dev`.
