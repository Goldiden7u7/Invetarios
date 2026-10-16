import type { Graficas } from 'src/types/inventario';
import type { IconifyName } from 'src/components/iconify';

import { useMemo, useState } from 'react';
import { varAlpha } from 'minimal-shared/utils';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import Typography from '@mui/material/Typography';
import InputAdornment from '@mui/material/InputAdornment';

import { fNumber, fCurrency } from 'src/utils/format-number';

import { Chart } from 'src/components/chart';
import { Iconify } from 'src/components/iconify';
import { Label, type LabelColor } from 'src/components/label';

// ----------------------------------------------------------------------
//  Centro de graficas del Resumen.
//
//  La pantalla de inicio queda limpia: aqui viven todas las graficas y se
//  dibujan SOLO cuando el administrador busca o toca una. Asi el dashboard
//  no carga de golpe con graficas de todo tipo.
// ----------------------------------------------------------------------

const COLOR_ENTRADA = '#00A76F';
const COLOR_SALIDA = '#F97066';
const COLOR_ALMACENES = ['#00A76F', '#2E90FA', '#FDB022', '#7A5AF8', '#F97066'];
const COLOR_VENTAS = '#2E90FA';
const COLOR_SEMANA = '#00A76F';

const TIPO_COMBO: Record<string, LabelColor> = {
  comida: 'warning',
  snack: 'info',
  bebida: 'success',
};

/**
 * Quita acentos y pasa a minusculas para que "grafica" encuentre "gráfica".
 */
function normalizar(texto: string) {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

// ----------------------------------------------------------------------

type Vista = {
  id: string;
  titulo: string;
  icono: IconifyName;
  /** Palabras extra para que el buscador la encuentre. */
  claves: string;
  dibujar: (datos: Graficas) => React.ReactNode;
};

const VISTAS: Vista[] = [
  {
    id: 'ventas-diarias',
    titulo: 'Ventas de los ultimos 30 dias',
    icono: 'eva:trending-up-fill',
    claves: 'venta ventas diaria dia ingresos dinero mes',
    dibujar: (d) => <VentasDiarias datos={d} />,
  },
  {
    id: 'ventas-semanales',
    titulo: 'Ventas por semana (8 semanas)',
    icono: 'solar:calendar-mark-bold',
    claves: 'venta ventas semana semanal barra',
    dibujar: (d) => <VentasSemanales datos={d} />,
  },
  {
    id: 'movimientos',
    titulo: 'Movimientos de stock (30 dias)',
    icono: 'solar:transfer-vertical-bold-duotone',
    claves: 'movimiento movimientos stock entradas salidas inventario',
    dibujar: (d) => <MovimientosDiarios datos={d} />,
  },
  {
    id: 'almacenes',
    titulo: 'Unidades por almacen',
    icono: 'solar:layers-bold-duotone',
    claves: 'almacen almacenes unidades bodega deposito dona',
    dibujar: (d) => <UnidadesPorAlmacen datos={d} />,
  },
  {
    id: 'combos',
    titulo: 'Combos mas vendidos',
    icono: 'solar:cart-3-bold',
    claves: 'combo combos menu mas vendidos ranking producto tabla',
    dibujar: (d) => <TopCombos datos={d} />,
  },
  {
    id: 'ingredientes',
    titulo: 'Ingredientes con mas salida',
    icono: 'solar:box-minimalistic-bold-duotone',
    claves: 'ingrediente ingredientes insumos consumo productos mas usados',
    dibujar: (d) => <TopIngredientes datos={d} />,
  },
];

// ----------------------------------------------------------------------

export function CentroGraficas({ datos }: { datos: Graficas }) {
  const [busqueda, setBusqueda] = useState('');
  const [activa, setActiva] = useState<string | null>(null);

  const filtradas = useMemo(() => {
    const consulta = normalizar(busqueda.trim());

    if (!consulta) return VISTAS;

    return VISTAS.filter((vista) =>
      normalizar(`${vista.titulo} ${vista.claves}`).includes(consulta)
    );
  }, [busqueda]);

  const vista = VISTAS.find((item) => item.id === activa) ?? null;

  const abrir = (id: string) => setActiva((previo) => (previo === id ? null : id));

  return (
    <Card sx={{ p: 3 }}>
      <Stack direction="row" spacing={1} alignItems="center">
        <Iconify icon="eva:trending-up-fill" width={20} sx={{ color: 'primary.main' }} />

        <Typography variant="h6">Graficas y reportes</Typography>
      </Stack>

      <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5, mb: 2 }}>
        Inicio se queda limpio. Busca una grafica o toca una para verla aqui cuando la necesites.
      </Typography>

      <TextField
        fullWidth
        size="small"
        placeholder="Buscar grafica: ventas, stock, almacen, semana, combos..."
        value={busqueda}
        onChange={(evento) => setBusqueda(evento.target.value)}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <Iconify icon="eva:search-fill" width={20} sx={{ color: 'text.disabled' }} />
              </InputAdornment>
            ),
          },
        }}
      />

      {filtradas.length === 0 ? (
        <Alert severity="info" sx={{ mt: 2 }}>
          No hay ninguna grafica que coincida con &quot;{busqueda}&quot;.
        </Alert>
      ) : (
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 2 }}>
          {filtradas.map((item) => {
            const seleccionada = item.id === activa;

            return (
              <Chip
                key={item.id}
                clickable
                icon={<Iconify icon={item.icono} />}
                label={item.titulo}
                color={seleccionada ? 'primary' : 'default'}
                variant={seleccionada ? 'filled' : 'outlined'}
                onClick={() => abrir(item.id)}
              />
            );
          })}
        </Stack>
      )}

      <Box sx={{ mt: 3 }}>
        {vista === null ? (
          <Alert severity="info" icon={<Iconify icon="solar:eye-bold" />}>
            Toca una grafica de arriba para verla aqui.
          </Alert>
        ) : (
          <Box>
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              spacing={1}
              sx={{ mb: 2 }}
            >
              <Stack direction="row" spacing={1} alignItems="center">
                <Iconify icon={vista.icono} width={20} sx={{ color: 'primary.main' }} />

                <Typography variant="subtitle1">{vista.titulo}</Typography>
              </Stack>

              <Button
                size="small"
                color="inherit"
                startIcon={<Iconify icon="mingcute:close-line" />}
                onClick={() => setActiva(null)}
              >
                Cerrar
              </Button>
            </Stack>

            {vista.dibujar(datos)}
          </Box>
        )}
      </Box>
    </Card>
  );
}

// ----------------------------------------------------------------------
//  Graficas de ventas
// ----------------------------------------------------------------------

function VentasDiarias({ datos }: { datos: Graficas }) {
  const diarias = useMemo(() => {
    const lista = datos.ventas_diarias ?? [];

    return {
      series: [{ name: 'Ventas', data: lista.map((d) => d.total) }],
      categorias: lista.map((d) => d.fecha),
    };
  }, [datos.ventas_diarias]);

  const opciones = useMemo(
    () => ({
      chart: { type: 'area' as const, toolbar: { show: false }, zoom: { enabled: false } },
      colors: [COLOR_VENTAS],
      dataLabels: { enabled: false },
      stroke: { curve: 'smooth' as const, width: 2 },
      fill: { type: 'gradient' as const, opacity: 0.3 },
      xaxis: {
        categories: diarias.categorias,
        labels: { rotate: -45, style: { fontSize: '10px' } },
        axisBorder: { show: false },
        axisTicks: { show: false },
      },
      yaxis: { labels: { formatter: (v: number) => fCurrency(v) } },
      legend: { show: false },
      grid: { strokeDashArray: 4 },
    }),
    [diarias.categorias]
  );

  return (
    <Box sx={{ height: 360 }}>
      <Chart type="area" series={diarias.series} options={opciones} sx={{ height: '100%' }} />
    </Box>
  );
}

function VentasSemanales({ datos }: { datos: Graficas }) {
  const semanales = useMemo(() => {
    const lista = datos.ventas_semanales ?? [];

    return {
      series: [{ name: 'Ventas', data: lista.map((d) => d.total) }],
      categorias: lista.map((d) => d.semana),
    };
  }, [datos.ventas_semanales]);

  const opciones = useMemo(
    () => ({
      chart: { type: 'bar' as const, toolbar: { show: false }, zoom: { enabled: false } },
      colors: [COLOR_SEMANA],
      dataLabels: { enabled: false },
      plotOptions: { bar: { columnWidth: '45%', borderRadius: 4 } },
      xaxis: {
        categories: semanales.categorias,
        labels: { style: { fontSize: '10px' } },
        axisBorder: { show: false },
        axisTicks: { show: false },
      },
      yaxis: { labels: { formatter: (v: number) => fCurrency(v) } },
      legend: { show: false },
      grid: { strokeDashArray: 4 },
    }),
    [semanales.categorias]
  );

  return (
    <Box sx={{ height: 360 }}>
      <Chart type="bar" series={semanales.series} options={opciones} sx={{ height: '100%' }} />
    </Box>
  );
}

// ----------------------------------------------------------------------
//  Graficas de stock
// ----------------------------------------------------------------------

function MovimientosDiarios({ datos }: { datos: Graficas }) {
  const movimientos = useMemo(() => {
    const dias = datos.movimientos_diarios ?? [];

    return {
      series: [
        { name: 'Entradas', data: dias.map((d) => d.entradas) },
        { name: 'Salidas', data: dias.map((d) => d.salidas) },
      ],
      categorias: dias.map((d) => d.fecha),
    };
  }, [datos.movimientos_diarios]);

  const opciones = useMemo(
    () => ({
      chart: { type: 'area' as const, toolbar: { show: false }, zoom: { enabled: false } },
      colors: [COLOR_ENTRADA, COLOR_SALIDA],
      dataLabels: { enabled: false },
      stroke: { curve: 'smooth' as const, width: 2 },
      fill: { type: 'gradient' as const, opacity: 0.3 },
      xaxis: {
        categories: movimientos.categorias,
        labels: { rotate: -45, style: { fontSize: '10px' } },
        axisBorder: { show: false },
        axisTicks: { show: false },
      },
      yaxis: { labels: { formatter: (v: number) => fNumber(v) } },
      legend: { position: 'top' as const, horizontalAlign: 'right' as const },
      grid: { strokeDashArray: 4 },
    }),
    [movimientos.categorias]
  );

  return (
    <Box sx={{ height: 360 }}>
      <Chart type="area" series={movimientos.series} options={opciones} sx={{ height: '100%' }} />
    </Box>
  );
}

function UnidadesPorAlmacen({ datos }: { datos: Graficas }) {
  const opciones = useMemo(
    () => ({
      chart: { type: 'donut' as const },
      labels: datos.stock_por_almacen.map((a) => a.nombre),
      colors: COLOR_ALMACENES,
      legend: { position: 'bottom' as const },
      dataLabels: { enabled: false },
      stroke: { width: 2 },
      plotOptions: {
        pie: {
          donut: {
            size: '70%',
            labels: {
              show: true,
              name: { show: true },
              value: { show: true, formatter: (val: string) => fNumber(val) },
              total: {
                show: true,
                label: 'Unidades',
                formatter: (w: { globals: { seriesTotals: number[] } }) =>
                  fNumber(w.globals.seriesTotals.reduce((a, b) => a + b, 0)),
              },
            },
          },
        },
      },
    }),
    [datos.stock_por_almacen]
  );

  return (
    <Box sx={{ height: 360, maxWidth: 460, mx: 'auto' }}>
      <Chart
        type="donut"
        series={datos.stock_por_almacen.map((a) => a.unidades)}
        options={opciones}
        sx={{ height: '100%' }}
      />
    </Box>
  );
}

// ----------------------------------------------------------------------
//  Ranking de ventas
// ----------------------------------------------------------------------

function TopCombos({ datos }: { datos: Graficas }) {
  const topCombos = datos.top_combos ?? [];

  if (topCombos.length === 0) {
    return (
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        Aun no hay ventas registradas.
      </Typography>
    );
  }

  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>Combo</TableCell>
          <TableCell>Tipo</TableCell>
          <TableCell align="right">Unidades</TableCell>
          <TableCell align="right">Venta total</TableCell>
        </TableRow>
      </TableHead>

      <TableBody>
        {topCombos.map((combo) => (
          <TableRow key={combo.id} hover>
            <TableCell>
              <Typography variant="body2" noWrap>
                {combo.nombre}
              </Typography>
            </TableCell>

            <TableCell>
              <Label color={TIPO_COMBO[combo.tipo] ?? 'default'} variant="soft">
                {combo.tipo}
              </Label>
            </TableCell>

            <TableCell align="right">{fNumber(combo.unidades)}</TableCell>
            <TableCell align="right">{fCurrency(combo.venta_total)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function TopIngredientes({ datos }: { datos: Graficas }) {
  const topProductos = datos.top_productos ?? [];
  const maxProducto = Math.max(1, ...topProductos.map((p) => p.cantidad));

  if (topProductos.length === 0) {
    return (
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        Sin datos de consumo todavia.
      </Typography>
    );
  }

  return (
    <Stack spacing={1.5}>
      {topProductos.map((producto) => (
        <Box key={producto.producto_id}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="body2" noWrap>
              {producto.nombre}
            </Typography>

            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {fNumber(producto.cantidad)}
            </Typography>
          </Box>

          <Box
            sx={{
              height: 8,
              borderRadius: 1,
              bgcolor: (theme) => varAlpha(theme.vars.palette.primary.main, 0.12),
            }}
          >
            <Box
              sx={{
                width: `${(producto.cantidad / maxProducto) * 100}%`,
                height: '100%',
                borderRadius: 1,
                bgcolor: 'primary.main',
              }}
            />
          </Box>
        </Box>
      ))}
    </Stack>
  );
}
