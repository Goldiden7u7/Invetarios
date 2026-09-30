# Como subir este proyecto a GitHub (sin comandos)

> Guia paso a paso usando **GitHub Desktop**, que tiene botones y ventana.
> No necesitas abrir la terminal ni escribir comandos.
> GitHub Desktop ya incluye Git por dentro, asi que esto es todo lo que
> tienes que instalar.

---

## Que es Git y que es GitHub (para no volver a confundirse)

| | Que es | Donde vive |
|---|---|---|
| **GitHub** | La pagina web donde se guarda tu proyecto | En internet |
| **Git** | El programita que sube tus archivos a esa pagina | En tu PC |
| **GitHub Desktop** | Un programa con botones que usa Git por ti | En tu PC |

**Instalar GitHub Desktop NO es instalar GitHub.** GitHub ya lo tienes en el
navegador. Lo unico que instalas es el programa de escritorio.

---

## Paso 1 - Instala GitHub Desktop

1. Abre en el navegador: **https://desktop.github.com/**
2. Clic en el boton grande **Download for Windows**.
3. Ejecuta el instalador (`GitHubDesktopSetup.exe`).
4. Acepta los defaults y dale **Next / Install / Finish**.
5. Al abrirlo por primera vez, iniciamos sesion con tu cuenta de GitHub
   (te abre el navegador para autorizarlo).

---

## Paso 2 - Crea el repositorio vacio en la pagina web

1. Ve a **https://github.com/new**
2. **Repository name:** `cafeteria-inventario` (o el nombre que quieras)
3. **Visibilidad:** elige **Private** (recomendado si tiene datos de negocio)
4. **NO marques** ninguna de estas casillas:
   - [ ] Add a README file
   - [ ] Add .gitignore
   - [ ] Choose a license
   - [ ] Allow people to override a set of security rules

   Esto es importante: si las marcas, despues GitHub Desktop se confunde
   porque el repositorio ya tendria archivos.
5. Clic en **Create repository**

---

## Paso 3 - Crea el repositorio local en GitHub Desktop

1. Abre **GitHub Desktop**
2. Menu superior: **File → New repository...**
3. En el formulario:
   - **Repository name:** `cafeteria-inventario` (el MISMO nombre del paso 2)
   - **Repository description:** (opcional) `Sistema de inventario, caja y cocina`
   - **Local path:** dale clic en **Choose...** y selecciona la carpeta
     `C:\Users\PC\Desktop\inventario`
     (la carpeta PADRE, no la del proyecto)
4. GitHub Desktop creara una carpeta nueva vacia llamada `cafeteria-inventario`
   dentro de esa ruta.
5. Clic en **Create repository**

---

## Paso 4 - Pasa tus archivos de tu proyecto a la carpeta nueva

Este paso es copiar archivos en Windows, nada de comandos.

1. Abre el Explorador de Archivos y ve a:
   `C:\Users\PC\Desktop\inventario\material-kit-react-main`
2. **Selecciona TODO** lo que hay dentro (Ctrl + A).
   - **No copies la carpeta `node_modules`** (son 300+ MB y Git la ignora
     igual). Para que no te tome el selecto, ve borrando `node_modules`
     de la seleccion manteniendo presionado Ctrl.
3. Copia todo (Ctrl + C).
4. Ve a la carpeta nueva:
   `C:\Users\PC\Desktop\inventario\cafeteria-inventario`
5. Pega todo dentro (Ctrl + V).

> **Importante:** NO copies `api\config.php`, porque tiene tus datos de
> base de datos. Ya esta en `.gitignore` asi que GitHub Desktop lo va a
> ignorar automaticamente, pero por si acaso puedes saltartelo.

---

## Paso 5 - Haz el commit

1. Vuelve a **GitHub Desktop**. Veras todos los archivos en la lista de
   la izquierda con la casillita en verde.
2. Abajo, en el cuadro **Summary** escribe: `Primer commit del proyecto`
3. Clic en **Commit to main** (abajo a la derecha).

---

## Paso 6 - Sube a GitHub

1. En la esquina superior derecha, busca el boton **Publish repository**.
   Si no lo ves todavia, es que el repositorio del paso 2 quedo esperando;
   dale **Fetch origin** y luego **Publish repository**.
2. Elige:
   - **Keep this code private** (recomendado)
   - o **Make this code public**
3. Clic en **Publish repository**
4. Espera unos segundos.

---

## Listo

Tu proyecto ya esta en GitHub. Ahora puedes:
- Verlo en **https://github.com/TU_USUARIO/cafeteria-inventario**
- Subir cambios: solo dale **Commit to main** y despues **Push origin**
  (GitHub Desktop lo pone azul en la barra de arriba cuando hay cambios)

---

## Recordatorio de seguridad

Este proyecto tiene dos archivos sensibles y ambos estan protegidos:

| Archivo | Por que | Como esta protegido |
|---|---|---|
| `api/config.php` | Tiene tus credenciales de MySQL | En `.gitignore`, nunca se sube. Usa `api/config.ejemplo.php` como plantilla. |
| `sql/inventario_db.sql` | Tiene el hash de la clave del admin | Sube normal, pero cambia la clave `Admin123!` del administrador en produccion. |

Si en algun momento cambias la clave del admin, recuerda hacer el
`Commit` + `Push` para que quede guardado.
