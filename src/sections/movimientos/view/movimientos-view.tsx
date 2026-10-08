import type { Almacen, Producto, TipoMovimiento } from 'src/types/inventario';

import { useState } from 'react';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Tabs from '@mui/material/Tabs';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Dialog from '@mui/material/Dialog';
import Button from '@mui/material/Button';
import Select from '@mui/material/Select';
import Skeleton from '@mui/material/Skeleton';
import MenuItem from '@mui/material/MenuItem';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import Typography from '@mui/material/Typography';
import InputLabel from '@mui/material/InputLabel';
import DialogTitle from '@mui/material/DialogTitle';
import FormControl from '@mui/material/FormControl';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import CircularProgress from '@mui/material/CircularProgress';

import { fDateTime } from 'src/utils/format-time';

import { useAuth } from 'src/auth';
import { api } from 'src/api/client';
import { DashboardContent } from 'src/layouts/dashboard';

import { Label } from 'src/components/label';
import { Iconify } from 'src/components/iconify';
import { PageHeader } from 'src/components/page-header/page-header';

import { PERMISO } from 'src/types/inventario';

import { CajaTab } from './caja-tab';
import { useMovimientos } from '../use-movimientos';

import type { MovimientoEntrada } from '../use-movimientos';

// ----------------------------------------------------------------------

const COLOR_TIPO: Record<string, 'success' | 'error' | 'info' | 'default'> = {
  entrada: 'success',
  salida: 'error',
  ajuste: 'info',
  transferencia: 'default',
};

export function MovimientosView() {
  const { puede } = useAuth();
  const puedeRegistrar = puede(PERMISO.crear);

  // Las cifras de caja son del administrador: quien mueve mercaderia no las ve.
  const puedeVerCaja = puede(PERMISO.ventas);

  const { movimientos, resumen, tipoFiltro, setTipoFiltro, cargando, error, cargar, registrar } = useMovimientos();

  const [pestana, setPestana] = useState<'stock' | 'caja'>('stock');

  const [abierto, setAbierto] = useState(false);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [almacenes, setAlmacenes] = useState<Almacen[]>([]);
  const [productoId, setProductoId] = useState<number | ''>('');
  const [almacenId, setAlmacenId] = useState<number | ''>('');
  const [tipo, setTipo] = useState<TipoMovimiento | ''>('entrada');
  const [cantidad, setCantidad] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [errorForm, setErrorForm] = useState('');

  const abrirRegistro = async () => {
    setAbierto(true);
    setErrorForm('');

    if (productos.length === 0 || almacenes.length === 0) {
      try {
        const [datosProductos, datosAlmacenes] = await Promise.all([
          api.get<{ productos: Producto[] }>('productos.php', { estado: 'activos', por_pagina: 100 }),
          api.get<Almacen[]>('almacenes.php'),
        ]);
        setProductos(datosProductos.productos);
        setAlmacenes(Array.isArray(datosAlmacenes) ? datosAlmacenes : []);
      } catch {
        // El select queda vacio; el usuario reintenta.
      }
    }
  };

  const enviar = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorForm('');

    if (productoId === '' || almacenId === '' || tipo === '' || Number(cantidad) <= 0) {
      setErrorForm('Completa producto, almacen, tipo y una cantidad mayor que cero.');
      return;
    }

    setEnviando(true);

    try {
      const datos: MovimientoEntrada = {
        producto_id: Number(productoId),
        almacen_id: Number(almacenId),
        tipo: tipo as 'entrada' | 'salida' | 'ajuste',
        cantidad: Math.floor(Number(cantidad)),
      };

      await registrar(datos);
      setAbierto(false);
      setProductoId('');
      setAlmacenId('');
      setCantidad('');
    } catch (e) {
      setErrorForm(e instanceof Error ? e.message : 'No se pudo registrar el movimiento.');
    } finally {
      setEnviando(false);
    }
  };

  const renderResumen = () => (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3 }}>
      {[
        { etiqueta: 'Entradas', valor: resumen.total_entradas, color: 'success.main' },
        { etiqueta: 'Salidas', valor: resumen.total_salidas, color: 'error.main' },
        { etiqueta: 'Movimientos', valor: resumen.total_movimientos, color: 'primary.main' },
      ].map((item) => (
        <Card key={item.etiqueta} sx={{ p: 2, flex: 1 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {item.etiqueta}
          </Typography>
          <Typography variant="h5" sx={{ color: item.color }}>
            {item.valor}
          </Typography>
        </Card>
      ))}
    </Stack>
  );

  return (
    <DashboardContent maxWidth="xl">
      <PageHeader
        titulo="Movimientos"
        descripcion={
          puedeVerCaja
            ? 'Entradas y salidas de stock, y el dinero de la caja: lo que entra con cada venta y lo que se retira en pagos de servicios.'
            : 'Entradas, salidas y ajustes de stock.'
        }
        icono="solar:transfer-vertical-bold-duotone"
        color="success"
        acciones={
          <>
            {pestana === 'stock' && (
              <Button variant="outlined" color="inherit" startIcon={<Iconify icon="solar:restart-bold" />} onClick={() => cargar(1)} disabled={cargando}>
                Actualizar
              </Button>
            )}

            {pestana === 'stock' && puedeRegistrar && (
              <Button variant="contained" startIcon={<Iconify icon="mingcute:add-line" />} onClick={abrirRegistro}>
                Registrar movimiento
              </Button>
            )}
          </>
        }
      />

      {/* Las dos selecciones de esta pantalla: mercaderia y dinero */}
      {puedeVerCaja && (
        <Card sx={{ mb: 3, px: 1 }}>
          <Tabs
            value={pestana}
            onChange={(_evento, valor: 'stock' | 'caja') => setPestana(valor)}
            variant="fullWidth"
            sx={{ minHeight: 48 }}
          >
            <Tab
              value="stock"
              icon={<Iconify icon="solar:box-minimalistic-bold-duotone" />}
              iconPosition="start"
              label="Stock"
              sx={{ minHeight: 48 }}
            />
            <Tab
              value="caja"
              icon={<Iconify icon="solar:wallet-money-bold-duotone" />}
              iconPosition="start"
              label="Caja"
              sx={{ minHeight: 48 }}
            />
          </Tabs>
        </Card>
      )}

      {pestana === 'caja' ? (
        <CajaTab activo />
      ) : (
        <>
          {renderResumen()}

          <Stack direction="row" spacing={1} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
            {(['', 'entrada', 'salida', 'ajuste'] as const).map((opcion) => (
              <Chip
                key={opcion || 'todos'}
                label={opcion || 'Todos'}
                color={tipoFiltro === opcion ? 'primary' : 'default'}
                variant={tipoFiltro === opcion ? 'filled' : 'outlined'}
                onClick={() => setTipoFiltro(opcion)}
              />
            ))}
          </Stack>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }} action={<Button color="inherit" size="small" onClick={() => cargar(1)}>Reintentar</Button>}>
              {error}
            </Alert>
          )}

          {cargando && movimientos.length === 0 ? (
            <Skeleton variant="rounded" height={400} />
          ) : (
            <Card sx={{ overflow: 'hidden' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Producto</TableCell>
                    <TableCell>Almacen</TableCell>
                    <TableCell>Tipo</TableCell>
                    <TableCell align="right">Cantidad</TableCell>
                    <TableCell align="right">Stock despues</TableCell>
                    <TableCell>Usuario</TableCell>
                    <TableCell>Fecha</TableCell>
                  </TableRow>
                </TableHead>

                <TableBody>
                  {movimientos.map((movimiento) => (
                    <TableRow key={movimiento.id} hover>
                      <TableCell>
                        <Typography variant="body2">{movimiento.producto_nombre}</Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          {movimiento.producto_codigo}
                        </Typography>
                      </TableCell>

                      <TableCell>{movimiento.almacen_nombre}</TableCell>

                      <TableCell>
                        <Label color={COLOR_TIPO[movimiento.tipo] ?? 'default'} variant="soft">
                          {movimiento.tipo}
                        </Label>
                      </TableCell>

                      <TableCell align="right">
                        <Typography variant="body2" color={movimiento.cantidad < 0 ? 'error.main' : 'success.main'}>
                          {movimiento.cantidad > 0 ? `+${movimiento.cantidad}` : movimiento.cantidad}
                        </Typography>
                      </TableCell>

                      <TableCell align="right">{movimiento.stock_nuevo}</TableCell>
                      <TableCell>{movimiento.usuario_nombre}</TableCell>
                      <TableCell>{fDateTime(movimiento.creado_en)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {movimientos.length === 0 && !cargando && (
                <Box sx={{ p: 4, textAlign: 'center' }}>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    Sin movimientos registrados.
                  </Typography>
                </Box>
              )}
            </Card>
          )}
        </>
      )}

      <Dialog open={abierto} onClose={() => setAbierto(false)} fullWidth maxWidth="xs" keepMounted={false}>
        <form onSubmit={enviar}>
          <DialogTitle>Registrar movimiento</DialogTitle>

          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <FormControl size="small" fullWidth>
              <InputLabel>Producto</InputLabel>
              <Select label="Producto" value={productoId} onChange={(e) => setProductoId(Number(e.target.value))}>
                {productos.map((producto) => (
                  <MenuItem key={producto.id} value={producto.id}>
                    {producto.nombre} ({producto.codigo})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" fullWidth>
              <InputLabel>Almacen</InputLabel>
              <Select label="Almacen" value={almacenId} onChange={(e) => setAlmacenId(Number(e.target.value))}>
                {almacenes.map((almacen) => (
                  <MenuItem key={almacen.id} value={almacen.id}>
                    {almacen.nombre}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" fullWidth>
              <InputLabel>Tipo</InputLabel>
              <Select label="Tipo" value={tipo} onChange={(e) => setTipo(e.target.value as TipoMovimiento)}>
                <MenuItem value="entrada">Entrada</MenuItem>
                <MenuItem value="salida">Salida</MenuItem>
                <MenuItem value="ajuste">Ajuste</MenuItem>
              </Select>
            </FormControl>

            <TextField
              label="Cantidad"
              size="small"
              type="number"
              inputProps={{ min: 1 }}
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
            />

            {errorForm && (
              <Alert severity="error" onClose={() => setErrorForm('')}>
                {errorForm}
              </Alert>
            )}
          </DialogContent>

          <DialogActions>
            <Button color="inherit" disabled={enviando} onClick={() => setAbierto(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="contained" disabled={enviando} startIcon={enviando ? <CircularProgress size={16} color="inherit" /> : null}>
              Registrar
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </DashboardContent>
  );
}