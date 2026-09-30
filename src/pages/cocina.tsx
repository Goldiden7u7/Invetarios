import { CONFIG } from 'src/config-global';

import { CocinaView } from 'src/sections/cocina';

// ----------------------------------------------------------------------

export default function Page() {
  return (
    <>
      <title>{`Cocina - ${CONFIG.appName}`}</title>
      <meta
        name="description"
        content="Cola de pedidos por preparar con los ingredientes elegidos por el cliente"
      />

      <CocinaView />
    </>
  );
}