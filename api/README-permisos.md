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
| 2   | `PERMISO.crear`      | Crear — y **cobrar ventas** |
| 4   | `PERMISO.editar`     | Editar                      |
| 8   | `PERMISO.eliminar`   | Eliminar / desactivar       |
| 16  | `PERMISO.movimientos`| Movimientos y transferencias |
| 32  | `PERMISO.usuarios`   | Gestionar cuentas y roles   |
| 64  | `PERMISO.config`     | Configuración general       |

---

## Matriz por endpoint

| Archivo          | GET (ver) | POST (crear / acción)     | PUT (editar) | DELETE (eliminar) |
| ---------------- | --------- | ------------------------- | ------------ | ----------------- |
| `dashboard.php`  | 1         | —                         | —            | —                 |
| `productos.php`  | 1         | 2                         | 4            | 8                 |
| `categorias.php` | 1         | 2                         | 4            | 8                 |
| `almacenes.php`  | 1         | 2                         | 4            | 8                 |
| `combos.php`     | 1         | 4                         | 4            | 8                 |
| `movimientos.php`| 1         | 16                        | —            | —                 |
| `transferencias.php` | 1     | 16 (enviar **y** recibir/cancelar) | — | —       |
| `pedidos.php`    | 1         | 2 (avanzar estado)        | —            | —                 |
| `ventas.php`     | 1         | 2 (cobrar)                | —            | —                 |
| `usuarios.php`   | 32        | 32                        | 32           | 32                |

Notas:

- **`ventas.php` y `pedidos.php`**: cualquiera con bit 2 puede cobrar y
  avanzar pedidos. El rol **Vendedor** (3 = ver + crear) y **Cocina** (3)
  pueden hacer ambas cosas; si quisieras que Cocina *no* cobre, crea un rol
  con permisos 1+2 y solo dale acceso a la pantalla Cocina en el frontend.
- **`usuarios.php`**: todo el bloque exige bit 32 (solo Administradores por
  defecto).
- **`combos.php`**: crear y editar exigen bit 4 (no 2), porque son tareas de
  configuración del menú, no de operación diaria.
- **`movimientos.php` / `transferencias.php`**: exigir bit 16 además de ver;
  un Operador (19 = 1+2+16) registra movimientos pero no edita productos.

## Roles incluidos en el SQL

| Rol          | Permisos | Suma | Puede…                                          |
| ------------ | -------- | ---- | ----------------------------------------------- |
| Administrador| 1+2+4+8+16+32+64 | 127 | Todo.                                   |
| Supervisor   | 1+2+4+8+16 | 31  | Opera inventario, transferencias y reportes.    |
| Operador     | 1+2+16     | 19  | Registra movimientos, ayuda en caja.            |
| Consulta     | 1         | 1    | Solo lectura.                                   |
| Vendedor     | 1+2       | 3    | Caja (cobra) y ve pedidos de cocina.            |
| Cocina       | 1+2       | 3    | Ve la cola de cocina y avanza los pedidos.      |

> El `password_hash` se genera con `password_hash()` de PHP (bcrypt); en la
> base **nunca** se guarda texto plano.