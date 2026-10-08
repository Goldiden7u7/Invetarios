import { useState } from 'react';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Card from '@mui/material/Card';
import Tabs from '@mui/material/Tabs';

import { Iconify } from 'src/components/iconify';

import { PagosTab } from './pagos-tab';
import { IngresosTab } from './ingresos-tab';

// ----------------------------------------------------------------------
//  PESTANA "CAJA" DE LA PANTALLA DE MOVIMIENTOS
//  Adentro tiene dos subselecciones:
//    - INGRESOS: el dinero de cada venta (cuanto entro, quien cobro).
//    - PAGOS DE SERVICIOS: los retiros de la caja para gastos del negocio
//      (trabajadores, transporte, local y servicios).
//  Ambas piden el permiso de ventas (128): son los numeros del dueno.
// ----------------------------------------------------------------------

export function CajaTab({ activo }: { activo: boolean }) {
  const [pestana, setPestana] = useState<'ingresos' | 'pagos'>('ingresos');

  return (
    <Box>
      <Card sx={{ mb: 3, px: 1 }}>
        <Tabs
          value={pestana}
          onChange={(_evento, valor: 'ingresos' | 'pagos') => setPestana(valor)}
          variant="fullWidth"
          sx={{ minHeight: 48 }}
        >
          <Tab
            value="ingresos"
            icon={<Iconify icon="solar:wallet-money-bold-duotone" />}
            iconPosition="start"
            label="Ingresos"
            sx={{ minHeight: 48 }}
          />
          <Tab
            value="pagos"
            icon={<Iconify icon="solar:dollar-bold-duotone" />}
            iconPosition="start"
            label="Pagos de servicios"
            sx={{ minHeight: 48 }}
          />
        </Tabs>
      </Card>

      {/* Cada subpestana se monta solo cuando se abre: asi consulta el API
          justo cuando el dueno va a mirarla, y refresca al volver. */}
      {pestana === 'ingresos' ? <IngresosTab activo={activo} /> : <PagosTab activo={activo} />}
    </Box>
  );
}