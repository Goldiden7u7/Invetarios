import { CONFIG } from 'src/config-global';

import { InventarioView } from 'src/sections/inventario';

// ----------------------------------------------------------------------

export default function Page() {
  return (
    <>
      <title>{`Inventario - ${CONFIG.appName}`}</title>
      <meta
        name="description"
        content="Productos del inventario con fechas de vencimiento y niveles de stock"
      />

      <InventarioView />
    </>
  );
}