import { CONFIG } from 'src/config-global';

import { CajaView } from 'src/sections/caja';

// ----------------------------------------------------------------------

export default function Page() {
  return (
    <>
      <title>{`Caja - ${CONFIG.appName}`}</title>
      <meta
        name="description"
        content="Punto de venta: combos, personalizacion de ingredientes y cobro"
      />

      <CajaView />
    </>
  );
}