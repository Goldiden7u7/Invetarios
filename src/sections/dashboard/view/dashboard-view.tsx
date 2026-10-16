import type { IconifyName } from 'src/components/iconify';
import type { Metricas, MovimientoReciente, ProductoPorReponer } from 'src/types/inventario';

import { varAlpha } from 'minimal-shared/utils';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Skeleton from '@mui/material/Skeleton';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import Typography from '@mui/material/Typography';

import { fNumber, fCurrency } from 'src/utils/format-number';

import { useAuth } from 'src/auth';
import { DashboardContent } from 'src/layouts/dashboard';

import { Iconify } from 'src/components/iconify';
import { Label, type LabelColor } from 'src/components/label';

import { useDashboard } from '../use-dashboard';
import { CentroGraficas } from './centro-graficas';

// ----------------------------------------------------------------------

export function DashboardView() {
  const { usuario } = useAuth();

  const { datos, cargando, error, recargar } = useDashboard();

  const renderEncabezado = () => (
    <Card
      sx={{
        mb: 3,
        p: { xs: 2.5, md: 3.5 },
        overflow: 'hidden',
        position: 'relative',
        color: 'common.white',
        border: 0,
        backgroundImage: (theme) =>
          `linear-gradient(120deg, ${theme.vars.palette.primary.dark} 0%, ${theme.vars.palette.primary.main} 45%, ${theme.vars.palette.error.main} 130%)`,
        boxShadow: (theme) =>
          `0 14px 34px -14px ${varAlpha(theme.vars.palette.primary.mainChannel, 0.65)}`,
      }}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ sm: 'center' }}
        justifyContent="space-between"
        spacing={2}
        sx={{ position: 'relative' }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.75 }}>
            <Typography variant="overline" sx={{ color: 'inherit', opacity: 0.85, letterSpacing: 1.5 }}>
              Panel de control
            </Typography>

            <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'common.white' }} />
          </Stack>

          <Typography variant="h4" sx={{ color: 'common.white', mb: 0.5 }}>
            Hola {usuario?.nombre?.split(' ')[0] ?? ''}, aqui esta tu cafeteria
          </Typography>

          <Typography variant="body2" sx={{ color: 'inherit', opacity: 0.9 }}>
            Ventas de hoy, ganancia real y lo que falta reponer. Las graficas las abres cuando las necesites.
          </Typography>
        </Box>

        <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0 }}>
          <Button
            variant="outlined"
            onClick={recargar}
            disabled={cargando}
            startIcon={<Iconify icon="solar:restart-bold" />}
            sx={(theme) => ({
              color: 'common.white',
              borderColor: varAlpha(theme.vars.palette.common.whiteChannel, 0.5),
              '&:hover': {
                borderColor: 'common.white',
                bgcolor: varAlpha(theme.vars.palette.common.whiteChannel, 0.12),
              },
            })}
          >
            Actualizar
          </Button>
        </Stack>
      </Stack>
    </Card>
  );

  const renderCargando = () => (
    <>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} sx={{ mb: 3 }}>
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} variant="rounded" height={124} sx={{ flex: 1 }} />
        ))}
      </Stack>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3}>
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} variant="rounded" height={124} sx={{ flex: 1 }} />
        ))}
      </Stack>
    </>
  );

  if (cargando && !datos) {
    return (
      <DashboardContent maxWidth="xl">
        {renderEncabezado()}
        {renderCargando()}
      </DashboardContent>
    );
  }

  if (error && !datos) {
    return (
      <DashboardContent maxWidth="xl">
        {renderEncabezado()}

        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={recargar}>
              Reintentar
            </Button>
          }
        >
          {error}
        </Alert>
      </DashboardContent>
    );
  }

  if (!datos) {
    return (
      <DashboardContent maxWidth="xl">
        {renderEncabezado()}
        <Alert severity="info">No hay datos para mostrar.</Alert>
      </DashboardContent>
    );
  }

  const { metricas, graficas, top, ultimos } = datos;

  return (
    <DashboardContent maxWidth="xl">
      {renderEncabezado()}

      {error && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          {error} (se muestran los ultimos datos cargados)
        </Alert>
      )}

      <Grupo icono="solar:box-minimalistic-bold-duotone" titulo="Tu inventario" sx={{ mb: 2 }}>
        <Tarjetas metricas={metricas} />
      </Grupo>

      <Grupo icono="solar:cart-3-bold" titulo="Como van las ventas" sx={{ mb: 4 }}>
        <VentasResumen metricas={metricas} />
      </Grupo>

      <Grupo icono="eva:trending-up-fill" titulo="Graficas y reportes" sx={{ mb: 4 }}>
        <CentroGraficas datos={graficas} />
      </Grupo>

      <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2} sx={{ mt: 3 }}>
        <PorReponer productos={top} />
        <Actividad ultimos={ultimos} />
      </Stack>
    </DashboardContent>
  );
}

// ----------------------------------------------------------------------
//  Grupo: titulo de seccion del dashboard
// ----------------------------------------------------------------------

function Grupo({
  icono,
  titulo,
  children,
  sx,
}: {
  icono: IconifyName;
  titulo: string;
  children: React.ReactNode;
  sx?: object;
}) {
  return (
    <Box sx={sx}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
        <Iconify icon={icono} width={18} sx={{ color: 'primary.main' }} />

        <Typography variant="overline" sx={{ color: 'text.secondary', fontWeight: 700, letterSpacing: 1 }}>
          {titulo}
        </Typography>

        <Divider sx={{ flex: 1 }} />
      </Stack>

      {children}
    </Box>
  );
}

// ----------------------------------------------------------------------
//  Tarjetas de metricas
// ----------------------------------------------------------------------

type TarjetaProps = {
  titulo: string;
  valor: string;
  pie: string;
  icono: IconifyName;
  color: 'primary' | 'success' | 'warning' | 'error' | 'info';
  alerta?: boolean;
  /** Porcentaje 0-100 para una barra de progreso bajo el valor. */
  progreso?: number;
};

function Tarjeta({ titulo, valor, pie, icono, color, alerta, progreso }: TarjetaProps) {
  return (
    <Card
      sx={{
        p: 2.5,
        flex: 1,
        minWidth: 220,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        overflow: 'hidden',
        position: 'relative',
        // Fondo tenido con el color de la tarjeta: separa los bloques de
        // numeros sin necesidad de lineas ni bordes duros.
        backgroundImage: (theme) =>
          `linear-gradient(150deg, ${varAlpha(theme.vars.palette[color].mainChannel, 0.1)}, transparent 60%)`,
        borderTop: 3,
        borderTopColor: (theme) => theme.vars.palette[color].main,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5 }}>
        <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500 }}>
          {titulo}
        </Typography>

        <Box
          sx={{
            display: 'grid',
            placeItems: 'center',
            width: 38,
            height: 38,
            flexShrink: 0,
            borderRadius: 2,
            bgcolor: (theme) => varAlpha(theme.vars.palette[color].main, 0.16),
            color: (theme) => theme.vars.palette[color].main,
          }}
        >
          <Iconify width={21} icon={icono} />
        </Box>
      </Box>

      <Box>
        <Typography
          variant="h4"
          sx={{ color: (theme) => theme.vars.palette[color].dark, lineHeight: 1.1 }}
        >
          {valor}
        </Typography>

        <Typography variant="caption" sx={{ color: alerta ? 'error.main' : 'text.secondary' }}>
          {pie}
        </Typography>
      </Box>

      {progreso !== undefined && (
        <Box
          sx={{
            height: 6,
            borderRadius: 999,
            overflow: 'hidden',
            bgcolor: (theme) => varAlpha(theme.vars.palette[color].main, 0.14),
          }}
        >
          <Box
            sx={{
              width: `${Math.min(100, Math.max(2, progreso))}%`,
              height: '100%',
              borderRadius: 999,
              backgroundImage: (theme) =>
                `linear-gradient(90deg, ${theme.vars.palette[color].light}, ${theme.vars.palette[color].main})`,
            }}
          />
        </Box>
      )}
    </Card>
  );
}

function Tarjetas({ metricas }: { metricas: Metricas }) {
  const lista: TarjetaProps[] = [
    {
      titulo: 'Valor del inventario (costo)',
      valor: fCurrency(metricas.valor_costo),
      pie: `${fNumber(metricas.productos_activos)} productos activos`,
      icono: 'solar:box-minimalistic-bold-duotone',
      color: 'primary',
    },
    {
      titulo: 'Valor a la venta',
      valor: fCurrency(metricas.valor_venta),
      pie: `Margen ${fNumber(metricas.margen_porcentaje)}%`,
      icono: 'solar:dollar-bold-duotone',
      color: 'success',
      progreso: metricas.margen_porcentaje,
    },
    {
      titulo: 'Unidades en stock',
      valor: fNumber(metricas.unidades_totales),
      pie: `${fNumber(metricas.almacenes_activos)} almacenes`,
      icono: 'solar:layers-bold-duotone',
      color: 'info',
    },
    {
      titulo: 'Necesitan reposicion',
      valor: fNumber(metricas.alertas_stock),
      pie:
        metricas.agotados > 0
          ? `${fNumber(metricas.agotados)} agotados`
          : 'Todo por encima del minimo',
      icono: 'solar:shield-warning-bold-duotone',
      color: metricas.alertas_stock > 0 ? 'error' : 'success',
      alerta: metricas.alertas_stock > 0,
    },
  ];

  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
      {lista.map((t) => (
        <Tarjeta key={t.titulo} {...t} />
      ))}
    </Stack>
  );
}

// ----------------------------------------------------------------------
//  Resumen de ventas (analisis del POS)
// ----------------------------------------------------------------------

function VentasResumen({ metricas, sx }: { metricas: Metricas; sx?: object }) {
  const lista: TarjetaProps[] = [
    {
      titulo: 'Ventas de hoy',
      valor: fCurrency(metricas.ventas_hoy.total),
      pie: `${fNumber(metricas.ventas_hoy.ventas)} ventas · ganancia ${fCurrency(metricas.ventas_hoy.ganancia)}`,
      icono: 'solar:wallet-money-bold-duotone',
      color: 'success',
      alerta: metricas.ventas_hoy.ventas === 0,
    },
    {
      titulo: 'Ventas del mes',
      valor: fCurrency(metricas.ventas_mes.total),
      pie: `${fNumber(metricas.ventas_mes.ventas)} ventas · ganancia ${fCurrency(metricas.ventas_mes.ganancia)}`,
      icono: 'solar:cart-3-bold',
      color: 'info',
    },
    {
      titulo: 'Ganancia real acumulada',
      valor: fCurrency(metricas.ganancia_real),
      pie: `Margen ${fNumber(metricas.margen_venta_real)}% sobre lo vendido`,
      icono: 'solar:dollar-bold-duotone',
      color: 'primary',
    },
    {
      titulo: 'Cola de cocina',
      valor: fNumber(metricas.pedidos_pendientes),
      pie: `${fNumber(metricas.proximos_vencer)} productos por vencer`,
      icono: 'solar:chef-hat-bold-duotone',
      color: metricas.pedidos_pendientes > 0 ? 'warning' : 'success',
      alerta: metricas.pedidos_pendientes > 0,
    },
  ];

  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={sx}>
      {lista.map((t) => (
        <Tarjeta key={t.titulo} {...t} />
      ))}
    </Stack>
  );
}

// ----------------------------------------------------------------------
//  Productos por reponer
// ----------------------------------------------------------------------

const colorAlerta = (estado: string): LabelColor => (estado === 'agotado' ? 'error' : 'warning');

function PorReponer({ productos }: { productos: ProductoPorReponer[] }) {
  if (productos.length === 0) {
    return (
      <Card sx={{ p: 3, flex: 1 }}>
        <Typography variant="h6">Por reponer</Typography>

        <Alert severity="success" sx={{ mt: 2 }}>
          Ningun producto esta por debajo del minimo. Todo en orden.
        </Alert>
      </Card>
    );
  }

  return (
    <Card sx={{ p: 3, flex: 1, minWidth: 0 }}>
      <Typography variant="h6">Por reponer</Typography>

      <Table size="small" sx={{ mt: 1 }}>
        <TableHead>
          <TableRow>
            <TableCell>Producto</TableCell>
            <TableCell align="right">Stock</TableCell>
            <TableCell align="right">Minimo</TableCell>
            <TableCell align="right">Falta</TableCell>
          </TableRow>
        </TableHead>

        <TableBody>
          {productos.map((p) => (
            <TableRow key={`${p.producto_id}-${p.almacen_id}`} hover>
              <TableCell>
                <Typography variant="body2" noWrap>
                  {p.producto_nombre}
                </Typography>

                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {p.almacen_nombre}
                </Typography>
              </TableCell>

              <TableCell align="right">
                <Label color={colorAlerta(p.estado_stock)} variant="soft">
                  {fNumber(p.cantidad)} {p.unidad_medida}
                </Label>
              </TableCell>

              <TableCell align="right">
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {fNumber(p.stock_minimo)}
                </Typography>
              </TableCell>

              <TableCell align="right">
                <Chip
                  size="small"
                  color="error"
                  variant="outlined"
                  label={fNumber(p.stock_minimo - p.cantidad)}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

// ----------------------------------------------------------------------
//  Actividad reciente
// ----------------------------------------------------------------------

const colorMovimiento: Record<string, LabelColor> = {
  entrada: 'success',
  salida: 'error',
  ajuste: 'warning',
  transferencia: 'info',
};

function Actividad({ ultimos }: { ultimos: MovimientoReciente[] }) {
  return (
    <Card sx={{ p: 3, flex: 1, minWidth: 0 }}>
      <Typography variant="h6">Actividad reciente</Typography>

      {ultimos.length === 0 ? (
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 2 }}>
          Sin movimientos todavia.
        </Typography>
      ) : (
        <Stack spacing={1.5} sx={{ mt: 2 }}>
          {ultimos.map((m) => (
            <Stack key={m.id} direction="row" alignItems="center" spacing={1.5}>
              <Label color={colorMovimiento[m.tipo] ?? 'default'} variant="soft" sx={{ minWidth: 96 }}>
                {m.tipo}
              </Label>

              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" noWrap>
                  {m.producto_nombre}
                </Typography>

                <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap>
                  {m.almacen_nombre} - {m.usuario_nombre}
                </Typography>
              </Box>

              <Typography
                variant="body2"
                sx={{
                  fontWeight: 'fontWeightBold',
                  color: m.cantidad >= 0 ? 'success.main' : 'error.main',
                }}
              >
                {m.cantidad > 0 ? '+' : ''}
                {fNumber(m.cantidad)}
              </Typography>
            </Stack>
          ))}
        </Stack>
      )}
    </Card>
  );
}