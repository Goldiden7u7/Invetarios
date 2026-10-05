import type { MetodoPago } from 'src/types/inventario';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import Typography from '@mui/material/Typography';

import { fDateTime } from 'src/utils/format-time';
import { fNumber, fCurrency } from 'src/utils/format-number';

import { Label } from 'src/components/label';
import { Iconify } from 'src/components/iconify';

import { useIngresosCaja } from '../use-ingresos-caja';

// ----------------------------------------------------------------------
//  PESTANA "CAJA" DE LA PANTALLA DE MOVIMIENTOS
//  Muestra el dinero de cada venta: cuanto entro, quien cobro, como cobro
//  y cuanto ganamos. Es la segunda seleccion, al lado de Movimientos de stock.
// ----------------------------------------------------------------------

/** Como se pinta cada metodo de pago. El efectivo es el que queda en gaveta. */
const COLOR_METODO: Record<MetodoPago, 'success' | 'info' | 'warning' | 'default'> = {
  efectivo: 'success',
  tarjeta: 'info',
  transferencia: 'warning',
  otro: 'default',
};

const METODOS: { valor: MetodoPago; etiqueta: string }[] = [
  { valor: 'efectivo', etiqueta: 'Efectivo' },
  { valor: 'tarjeta', etiqueta: 'Tarjeta' },
  { valor: 'transferencia', etiqueta: 'Transferencia' },
  { valor: 'otro', etiqueta: 'Otro' },
];

/** Solo los nombres de icono que existen en el set offline del proyecto. */
type NombreIcono = React.ComponentProps<typeof Iconify>['icon'];

/** Tarjeta de cifra: cifra grande, piechecito que explica de donde sale. */
function TarjetaCifra({
  icono,
  color,
  titulo,
  valor,
  pie,
}: {
  icono: NombreIcono;
  color: string;
  titulo: string;
  valor: number;
  pie: string;
}) {
  return (
    <Card
      sx={{
        p: 2,
        flex: 1,
        minWidth: 190,
        borderLeft: 4,
        borderLeftColor: color,
        background: `linear-gradient(135deg, ${color}14, ${color}05)`,
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
        <Iconify icon={icono} width={20} sx={{ color }} />
        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
          {titulo}
        </Typography>
      </Stack>

      <Typography variant="h5" sx={{ color }}>
        {fCurrency(valor)}
      </Typography>

      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        {pie}
      </Typography>
    </Card>
  );
}

export function CajaTab({ activo }: { activo: boolean }) {
  const { ingresos, resumen, paginacion, metodoFiltro, setMetodoFiltro, cargando, error, cargar } =
    useIngresosCaja(activo);

  const efectivoHoy = resumen.hoy.efectivo;

  return (
    <Box>
      {/* Las tres cifras que un dueño revisa primero */}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3 }}>
        <TarjetaCifra
          icono="solar:dollar-bold-duotone"
          color="var(--mui-palette-success-main)"
          titulo="Entro hoy"
          valor={resumen.hoy.total}
          pie={`${fNumber(resumen.hoy.ventas)} venta(s) cerradas`}
        />

        <TarjetaCifra
          icono="solar:wallet-money-bold-duotone"
          color="var(--mui-palette-primary-main)"
          titulo="En efectivo hoy"
          valor={efectivoHoy}
          pie="Lo que quedo en la gaveta"
        />

        <TarjetaCifra
          icono="solar:calendar-mark-bold"
          color="var(--mui-palette-info-main)"
          titulo="Acumulado del mes"
          valor={resumen.mes.total}
          pie={`${fCurrency(resumen.mes.ganancia)} de ganancia`}
        />
      </Stack>

      {/* Reparto por metodo de pago */}
      {resumen.por_metodo.length > 0 && (
        <Card sx={{ p: 2, mb: 3 }}>
          <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
            Como entra el dinero
          </Typography>

          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {resumen.por_metodo.map((fila) => {
              const cuota = resumen.mes.total > 0 ? (fila.total / resumen.mes.total) * 100 : 0;

              return (
                <Chip
                  key={fila.metodo_pago}
                  icon={<Iconify icon="solar:wallet-money-bold-duotone" />}
                  label={`${fila.metodo_pago}: ${fCurrency(fila.total)} (${fNumber(cuota)}%)`}
                  color={COLOR_METODO[fila.metodo_pago as MetodoPago] ?? 'default'}
                  variant="outlined"
                />
              );
            })}
          </Stack>
        </Card>
      )}

      {/* Filtro por metodo de pago */}
      <Stack direction="row" spacing={1} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap alignItems="center">
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Metodo:
        </Typography>

        {(['', ...METODOS.map((m) => m.valor)] as const).map((opcion) => (
          <Chip
            key={opcion || 'todos'}
            label={opcion || 'Todos'}
            color={metodoFiltro === opcion ? 'primary' : 'default'}
            variant={metodoFiltro === opcion ? 'filled' : 'outlined'}
            onClick={() => setMetodoFiltro(opcion as MetodoPago | '')}
          />
        ))}

        <Box sx={{ flex: 1 }} />

        <Button
          variant="outlined"
          color="inherit"
          size="small"
          startIcon={<Iconify icon="solar:restart-bold" />}
          onClick={() => cargar(paginacion.pagina)}
          disabled={cargando}
        >
          Actualizar
        </Button>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} action={<Button color="inherit" size="small" onClick={() => cargar(1)}>Reintentar</Button>}>
          {error}
        </Alert>
      )}

      {cargando && ingresos.length === 0 ? (
        <Skeleton variant="rounded" height={340} />
      ) : (
        <Card sx={{ overflow: 'hidden' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Venta</TableCell>
                <TableCell>Cajero</TableCell>
                <TableCell>Metodo</TableCell>
                <TableCell align="right">Subtotal</TableCell>
                <TableCell align="right">Descuento</TableCell>
                <TableCell align="right">Entro</TableCell>
                <TableCell align="right">Ganancia</TableCell>
                <TableCell>Fecha</TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {ingresos.map((ingreso) => (
                <TableRow key={ingreso.id} hover>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {ingreso.codigo}
                    </Typography>
                    {ingreso.cliente_nombre && (
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {ingreso.cliente_nombre}
                      </Typography>
                    )}
                  </TableCell>

                  <TableCell>{ingreso.cajero}</TableCell>

                  <TableCell>
                    <Label color={COLOR_METODO[ingreso.metodo_pago] ?? 'default'} variant="soft">
                      {ingreso.metodo_pago}
                    </Label>
                  </TableCell>

                  <TableCell align="right">{fCurrency(ingreso.subtotal)}</TableCell>

                  <TableCell align="right">
                    {ingreso.descuento > 0 ? (
                      <Typography variant="body2" sx={{ color: 'error.main' }}>
                        -{fCurrency(ingreso.descuento)}
                      </Typography>
                    ) : (
                      <Typography variant="body2" sx={{ color: 'text.disabled' }}>
                        &mdash;
                      </Typography>
                    )}
                  </TableCell>

                  <TableCell align="right">
                    <Typography variant="body2" sx={{ fontWeight: 700, color: 'success.main' }}>
                      {fCurrency(ingreso.total)}
                    </Typography>
                  </TableCell>

                  <TableCell align="right">
                    <Typography variant="body2" sx={{ color: ingreso.ganancia >= 0 ? 'text.primary' : 'error.main' }}>
                      {fCurrency(ingreso.ganancia)}
                    </Typography>
                  </TableCell>

                  <TableCell>{fDateTime(ingreso.creado_en)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {ingresos.length === 0 && !cargando && (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Iconify icon="solar:wallet-money-bold-duotone" width={40} sx={{ color: 'text.disabled' }} />
              <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
                Todavia no hay ventas cobradas para mostrar.
              </Typography>
            </Box>
          )}
        </Card>
      )}

      {paginacion.total_paginas > 1 && (
        <Stack direction="row" spacing={1} justifyContent="center" sx={{ mt: 2 }} alignItems="center">
          <Button
            variant="outlined"
            color="inherit"
            size="small"
            disabled={cargando || paginacion.pagina <= 1}
            onClick={() => cargar(paginacion.pagina - 1)}
          >
            Anterior
          </Button>

          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Pagina {paginacion.pagina} de {paginacion.total_paginas} ({paginacion.total} ventas)
          </Typography>

          <Button
            variant="outlined"
            color="inherit"
            size="small"
            disabled={cargando || paginacion.pagina >= paginacion.total_paginas}
            onClick={() => cargar(paginacion.pagina + 1)}
          >
            Siguiente
          </Button>
        </Stack>
      )}
    </Box>
  );
}