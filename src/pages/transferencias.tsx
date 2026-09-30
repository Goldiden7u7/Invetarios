import { CONFIG } from 'src/config-global';

import { TransferenciasView } from 'src/sections/transferencias';

// ----------------------------------------------------------------------

export default function Page() {
  return (
    <>
      <title>{`Transferencias - ${CONFIG.appName}`}</title>
      <meta
        name="description"
        content="Traslados de stock entre almacenes"
      />

      <TransferenciasView />
    </>
  );
}