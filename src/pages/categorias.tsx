import { CONFIG } from 'src/config-global';

import { CategoriasView } from 'src/sections/categorias';

// ----------------------------------------------------------------------

export default function Page() {
  return (
    <>
      <title>{`Categorias - ${CONFIG.appName}`}</title>
      <meta
        name="description"
        content="Categorias de productos del inventario"
      />

      <CategoriasView />
    </>
  );
}