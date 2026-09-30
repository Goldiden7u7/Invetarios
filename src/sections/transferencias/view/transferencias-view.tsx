import type { Almacen, Producto } from 'src/types/inventario';

import { useState } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
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
import FormHelperText from '@mui/material/FormHelperText';
import CircularProgress from '@mui/material/CircularProgress';

import { fDateTime } from 'src/utils/format-time';

import { useAuth } from 'src/auth';
import { api } from 'src/api/client';
import { DashboardContent } from 'src/layouts/dashboard';

import { Label } from 'src/components/label';
import { Iconify } from 'src/components/iconify';
import { PageHeader } from 'src/components/page-header/page-header';

import { PERMISO } from 'src/types/inventario';

import { useTransferencias } from '../use-transferencias';

import type { TransferenciaEntrada } from '../use-transferencias';

// ----------------------------------------------------------------------

const ESTADO_COLOR: Record<string, 'warning' | 'success' | 'error'> = {
  en_transito: 'warning',
  recibida: 'success',
  cancelada: 'error',
};

export function TransferenciasView() {
  const { puede } = useAuth();
  const puedeGestionar = puede(PERMISO.movimientos);

  const { transferencias, cargando, error, actuando, cargar, crear, accionar } = useTransferencias();

  const [abierto, setAbierto] = useState(false);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [almacenes, setAlmacenes] = useState<Almacen[]>([]);
  const [productoId, setProductoId] = useState<number | ''>('');
  const [origenId, setOrigenId] = useState<number | ''>('');
  const [destinoId, setDestinoId] = useState<number | ''>('');
  const [cantidad, setCantidad] = useState('');
  const [notas, setNotas] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [errorForm, setErrorForm] = useState('');

  const abrirNueva = async () => {
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
        setErrorForm('No se pudo cargar productos o almacenes.');
      }
    }
  };

  const enviar = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorForm('');

    if (productoId === '' || origenId === '' || destinoId === '' || Number(cantidad) <= 0) {
      setErrorForm('Completa producto, origen, destino y una cantidad mayor que cero.');
      return;
    }

    if (origenId === destinoId) {
      setErrorForm('Origen y destino no pueden ser el mismo almacen.');
      return;
    }

    setEnviando(true);

    try {
      const datos: TransferenciaEntrada = {
        producto_id: Number(productoId),
        almacen_origen_id: Number(origenId),
        almacen_destino_id: Number(destinoId),
        cantidad: Math.floor(Number(cantidad)),
        notas: notas.trim() || undefined,
      };

      await crear(datos);
      setAbierto(false);
      setProductoId('');
      setOrigenId('');
      setDestinoId('');
      setCantidad('');
      setNotas('');
    } catch (e) {
      setErrorForm(e instanceof Error ? e.message : 'No se pudo crear la transferencia.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <DashboardContent maxWidth="xl">
      <PageHeader
        titulo="Transferencias"
        descripcion="Traslados de stock entre almacenes, con recepcion al llegar."
        icono="solar:round-transfer-horizontal-bold-duotone"
        color="secondary"
        acciones={
          <>
            <Button variant="outlined" color="inherit" startIcon={<Iconify icon="solar:restart-bold" />} onClick={cargar} disabled={cargando}>
              Actualizar
            </Button>

            {puedeGestionar && (
              <Button variant="contained" startIcon={<Iconify icon="mingcute:add-line" />} onClick={abrirNueva}>
                Nueva transferencia
              </Button>
            )}
          </>
        }
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => undefined} action={<Button color="inherit" size="small" onClick={cargar}>Reintentar</Button>}>
          {error}
        </Alert>
      )}

      {cargando && transferencias.length === 0 ? (
        <Skeleton variant="rounded" height={400} />
      ) : (
        <Card sx={{ overflow: 'hidden' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Codigo</TableCell>
                <TableCell>Producto</TableCell>
                <TableCell>Ruta</TableCell>
                <TableCell align="right">Cantidad</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell>Fecha</TableCell>
                <TableCell align="right">Acciones</TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {transferencias.map((transferencia) => (
                <TableRow key={transferencia.id} hover>
                  <TableCell>
                    <Typography variant="body2">{transferencia.codigo}</Typography>
                  </TableCell>

                  <TableCell>
                    <Typography variant="body2">{transferencia.producto_nombre}</Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {transferencia.producto_codigo}
                    </Typography>
                  </TableCell>

                  <TableCell>
                    <Typography variant="body2">
                      {transferencia.origen_nombre} → {transferencia.destino_nombre}
                    </Typography>
                    {transferencia.notas && (
                      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                        {transferencia.notas}
                      </Typography>
                    )}
                  </TableCell>

                  <TableCell align="right">{transferencia.cantidad}</TableCell>

                  <TableCell>
                    <Label color={ESTADO_COLOR[transferencia.estado] ?? 'default'} variant="soft">
                      {transferencia.estado === 'en_transito' ? 'En transito' : transferencia.estado}
                    </Label>
                  </TableCell>

                  <TableCell>{fDateTime(transferencia.fecha_envio)}</TableCell>

                  <TableCell align="right">
                    {transferencia.estado === 'en_transito' && puedeGestionar && (
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                        <Button
                          size="small"
                          variant="contained"
                          color="success"
                          disabled={actuando === transferencia.id}
                          startIcon={actuando === transferencia.id ? <CircularProgress size={14} color="inherit" /> : null}
                          onClick={() => accionar(transferencia.id, 'recibir')}
                        >
                          Recibir
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          color="error"
                          disabled={actuando === transferencia.id}
                          onClick={() => accionar(transferencia.id, 'cancelar')}
                        >
                          Cancelar
                        </Button>
                      </Stack>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {transferencias.length === 0 && !cargando && (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Ninguna transferencia registrada.
              </Typography>
            </Box>
          )}
        </Card>
      )}

      <Dialog open={abierto} onClose={() => setAbierto(false)} fullWidth maxWidth="sm" keepMounted={false}>
        <form onSubmit={enviar}>
          <DialogTitle>Nueva transferencia</DialogTitle>

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

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
              <FormControl size="small" fullWidth>
                <InputLabel>De (origen)</InputLabel>
                <Select label="De (origen)" value={origenId} onChange={(e) => setOrigenId(Number(e.target.value))}>
                  {almacenes.map((almacen) => (
                    <MenuItem key={almacen.id} value={almacen.id}>
                      {almacen.nombre}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl size="small" fullWidth>
                <InputLabel>Para (destino)</InputLabel>
                <Select label="Para (destino)" value={destinoId} onChange={(e) => setDestinoId(Number(e.target.value))}>
                  {almacenes.map((almacen) => (
                    <MenuItem key={almacen.id} value={almacen.id}>
                      {almacen.nombre}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            <TextField
              label="Cantidad a transferir"
              size="small"
              type="number"
              inputProps={{ min: 1 }}
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
            />

            <TextField
              label="Notas (opcional)"
              size="small"
              multiline
              minRows={2}
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
            />

            {errorForm && (
              <Alert severity="error" onClose={() => setErrorForm('')}>
                {errorForm}
              </Alert>
            )}

            <FormHelperText>
              El stock se descuenta del origen al enviar y se suma al destino al recibir.
            </FormHelperText>
          </DialogContent>

          <DialogActions>
            <Button color="inherit" disabled={enviando} onClick={() => setAbierto(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="contained" disabled={enviando} startIcon={enviando ? <CircularProgress size={16} color="inherit" /> : null}>
              Enviar transferencia
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </DashboardContent>
  );
}