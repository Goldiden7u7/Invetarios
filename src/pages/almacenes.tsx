import { CONFIG } from 'src/config-global';

import { AlmacenesView } from 'src/sections/almacenes';

// ----------------------------------------------------------------------

export default function Page() {
  return (
    <>
      <title>{`Almacenes - ${CONFIG.appName}`}</title>
      <meta
        name="description"
        content="Gestion de los almacenes y sus niveles de stock"
      />

      <AlmacenesView />
    </>
  );
}