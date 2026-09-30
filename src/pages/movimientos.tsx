import { CONFIG } from 'src/config-global';

import { MovimientosView } from 'src/sections/movimientos';

// ----------------------------------------------------------------------

export default function Page() {
  return (
    <>
      <title>{`Movimientos - ${CONFIG.appName}`}</title>
      <meta
        name="description"
        content="Historial de entradas, salidas y ajustes de stock"
      />

      <MovimientosView />
    </>
  );
}