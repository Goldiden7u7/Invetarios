import { CONFIG } from 'src/config-global';

import { DashboardView } from 'src/sections/dashboard';

// ----------------------------------------------------------------------

export default function Page() {
  return (
    <>
      <title>{`Resumen - ${CONFIG.appName}`}</title>
      <meta
        name="description"
        content="Estado del inventario, alertas de stock y actividad reciente"
      />

      <DashboardView />
    </>
  );
}
