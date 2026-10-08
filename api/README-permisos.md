# Permisos del API — qué requiere cada endpoint

Todos los endpoints exigen una sesión iniciada y **al menos
uno de los bits de permiso** del rol del usuario. La única excepción es
`auth/login.php`, que obviamente no puede exigir sesión (es el que la crea);
`auth/logout.php` y `auth/yo.php` tampoco exigen permiso, solo sesión válida.

El permiso se comprueba en el servidor: ocultar el menú en el frontend es
solo comodidad, la seguridad real es esta.

Los bits se **suman** en la columna `permisos` de la tabla `roles`:

| Bit | Constante (frontend) | Permiso                     |
| --- | -------------------- | --------------------------- |
| 1   | `PERMISO.ver`        | Ver / consultar             |
| 2   | `PERMISO.crear`      | Crear                       |
| 4   | `PERMISO.editar`     | Editar                      |
| 8   | `PERMISO.eliminar`   | Eliminar / desactivar       |
| 16  | `PERMISO.movimientos`| Movimientos y transferencias |
| 32  | `PERMISO.usuarios`   | Gestionar cuentas y roles   |
| 64  | `PERMISO.config`     | Configuración general       |

### Los bits de módulo

Los siete de arriba dicen **qué** puede hacer una persona. Estos tres dicen
**dónde** la deja entrar, y son los que separan los trabajos del día a día:

| Bit | Constante (frontend) | Módulo                       |
| --- | -------------------- | ---------------------------- |
| 128 | `PERMISO.ventas`     | **Resumen** — cifras e historial de ventas, y la selección **Caja** de Movimientos |
| 256 | `PERMISO.caja`       | **Caja** — cobrar una venta   |
| 512 | `PERMISO.cocina`     | **Cocina** — ver y mover pedidos |

Así el que cobra no ve en qué factura el negocio, y el de cocina no puede
cobrar aunque sepa crear. Como son flags de bits, se pueden exigir varios a
la vez: `exigir_permiso(2 | 256, 'cobrar')` pide **crear** *y* **caja**.

> El **Administrador suma todo (1023)**: al ser el dueño puede relevar un
> turno y entrar tanto a Caja como a Cocina además de ver los números. El
> control fino está en los otros roles, que cada uno entra solo a lo suyo.

---

## Matriz por endpoint

| Archivo          | GET (ver) | POST (crear / acción)     | PUT (editar) | DELETE (eliminar) |
| ---------------- | --------- | ------------------------- | ------------ | ----------------- |
| `dashboard.php`  | **128**   | —                         | —            | —                 |
| `productos.php`  | 1         | 2                         | 4            | 8                 |
| `categorias.php` | 1         | 2                         | 4            | 8                 |
| `almacenes.php`  | 1         | 2                         | 4            | 8                 |
| `combos.php`     | 1         | 4                         | 4            | 8                 |
| `movimientos.php`| 1 (**128** si `?vista=caja`) | 16                    | —            | —                 |
| `transferencias.php` | 1     | 16 (enviar **y** recibir/cancelar) | — | —       |
| `pedidos.php`    | **512** | 2 \| **512** (avanzar) | —            | —                 |
| `ventas.php`     | **128**   | 2 \| **256** (cobrar)     | —            | —                 |
| `usuarios.php`   | 32        | 32                        | 32           | 32                |

Notas:

- **`dashboard.php`**: pide el bit 128, no el 1. El Resumen *son* las cifras
  de ventas, así que solo entra quien tenga ese módulo habilitado.
- **`ventas.php`**: el GET (historial) pide 128, y el POST (cobrar) pide
  `crear` **y** `caja`. Con esto el rol Cocina puede ver la cola pero no
  puede registrar una venta ni aunque escriba la URL a mano.
- **`pedidos.php`**: tanto el GET como el POST piden el bit 512 de cocina.
  El GET pide el bit **512 solo** (no `1 | 512`): así el cajero —que tiene
  `ver` pero no el módulo Cocina— no puede leer la cola escribiéndole la URL
  a mano. El administrador (1023) sí tiene 512, así que entra sin problema.
- **`movimientos.php?vista=caja`**: es la segunda pestaña de la pantalla
  Movimientos. No devuelve movimientos de stock sino **el dinero de cada
  venta** (cuánto entró, quién cobró, con qué método y cuánta ganancia), así
  que pide **128** (ventas), no 1. Quien mueve mercadería pero no ve las
  cifras del negocio no la ve. Sin `?vista=caja` el GET es el de siempre y
  pide 1.
- **`usuarios.php`**: todo el bloque exige bit 32 (solo Administradores por
  defecto).
- **`combos.php`**: crear y editar exigen bit 4 (no 2), porque son tareas de
  configuración del menú, no de operación diaria.
- **`movimientos.php` / `transferencias.php`**: exigir bit 16 además de ver;
  un Operador (19 = 1+2+16) registra movimientos pero no edita productos.

## Roles incluidos en el SQL

| Rol          | Bits                                              | Suma | Puede…                                       |
| ------------ | ------------------------------------------------- | ---- | -------------------------------------------- |
| Administrador| 1+2+4+8+16+32+64 + 128+256+512                   | 1023 | Todo, incluida la Caja y la Cocina.          |
| Supervisor   | 1+2+4+8+16 + 128+512                              | 671  | Inventario, transferencias, ventas y cocina. |
| Operador     | 1+2+16 + 128+256+512                              | 915  | Inventario y caja, sin borrar nada.         |
| Consulta     | 1 + 128+256+512                                   | 897  | Solo lectura, en todo.                      |
| Vendedor     | 1+2 + 256                                         | 259  | **Solo la Caja.** Cobra, no ve cifras de ventas. |
| Cocina       | 1+2 + 512                                         | 515  | **Solo Cocina.** Ve y avanza pedidos, no cobra ni ve ventas. |

> El `password_hash` se genera con `password_hash()` de PHP (bcrypt); en la
> base **nunca** se guarda texto plano.

## Usuarios de ejemplo

| Correo                 | Rol           | Contraseña   |
| ---------------------- | ------------- | ------------ |
| `admin@inventario.com` | Administrador | `Admin123!`  |
| `caja@inventario.com`  | Vendedor      | `Caja123!`   |
| `cocina@inventario.com`| Cocina        | `Cocina123!` |

Cada uno entra por su módulo: el administrador aterriza en el Resumen (y
entra también a Caja, Cocina y a la selección **Caja** de Movimientos), el
cajero en Caja, el de cocina en Cocina, y ni el cajero ni el de cocina ven
el Resumen. **Cambia las tres contraseñas al crear la base de datos.**