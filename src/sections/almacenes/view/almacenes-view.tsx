import type { Almacen } from 'src/types/inventario';

import { useState } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Dialog from '@mui/material/Dialog';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import CircularProgress from '@mui/material/CircularProgress';

import { fCurrency } from 'src/utils/format-number';

import { useAuth } from 'src/auth';
import { DashboardContent } from 'src/layouts/dashboard';

import { Label } from 'src/components/label';
import { Iconify } from 'src/components/iconify';
import { PageHeader } from 'src/components/page-header/page-header';

import { PERMISO } from 'src/types/inventario';

import { AlmacenForm } from './almacen-form';
import { useAlmacenes, type AlmacenEntrada } from '../use-almacenes';

// ----------------------------------------------------------------------

export function AlmacenesView() {
  const { puede } = useAuth();
  const puedeEditar = puede(PERMISO.editar);
  const puedeEliminar = puede(PERMISO.eliminar);

  const { almacenes, cargando, error, cargar, guardar, eliminar } = useAlmacenes();

  const [formulario, setFormulario] = useState<{ abierto: boolean; almacen?: Almacen }>({ abierto: false });
  const [confirmar, setConfirmar] = useState<Almacen | null>(null);
  const [borrando, setBorrando] = useState(false);
  const [errorAccion, setErrorAccion] = useState('');

  const alEliminar = async () => {
    if (!confirmar) return;

    setBorrando(true);
    setErrorAccion('');

    try {
      await eliminar(confirmar.id);
      setConfirmar(null);
    } catch (e) {
      setErrorAccion(e instanceof Error ? e.message : 'No se pudo eliminar el almacen.');
    } finally {
      setBorrando(false);
    }
  };

  const alGuardar = async (datos: AlmacenEntrada) => {
    await guardar(datos, formulario.almacen?.id);
    setFormulario({ abierto: false });
  };

  // ------------------------------------------------------------------

  return (
    <DashboardContent maxWidth="xl">
      <PageHeader
        titulo="Almacenes"
        descripcion="Puntos de stock: despensa, barra y refrigeracion."
        icono="solar:home-2-bold-duotone"
        color="success"
        acciones={
          <>
            <Button variant="outlined" color="inherit" startIcon={<Iconify icon="solar:restart-bold" />} onClick={cargar} disabled={cargando}>
              Actualizar
            </Button>

            {puedeEditar && (
              <Button variant="contained" startIcon={<Iconify icon="mingcute:add-line" />} onClick={() => setFormulario({ abierto: true })}>
                Nuevo almacen
              </Button>
            )}
          </>
        }
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} action={<Button color="inherit" size="small" onClick={cargar}>Reintentar</Button>}>
          {error}
        </Alert>
      )}

      {errorAccion && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErrorAccion('')}>
          {errorAccion}
        </Alert>
      )}

      {cargando && almacenes.length === 0 ? (
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} variant="rounded" height={200} sx={{ flex: 1 }} />
          ))}
        </Stack>
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr', lg: '1fr 1fr 1fr' }, gap: 2 }}>
          {almacenes.map((almacen) => {
            const tieneAlertas = (almacen.alertas ?? 0) > 0;

            return (
              <Card key={almacen.id} sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box>
                    <Typography variant="subtitle1">{almacen.nombre}</Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {almacen.codigo} {almacen.direccion ? `· ${almacen.direccion}` : ''}
                    </Typography>
                  </Box>

                  <Label color={almacen.activo ? 'success' : 'default'} variant="soft">
                    {almacen.activo ? 'Activo' : 'Inactivo'}
                  </Label>
                </Box>

                {almacen.descripcion && (
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {almacen.descripcion}
                  </Typography>
                )}

                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                  <Box>
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                      Productos
                    </Typography>
                    <Typography variant="h6">{almacen.productos ?? 0}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                      Unidades
                    </Typography>
                    <Typography variant="h6">{almacen.unidades ?? 0}</Typography>
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2">
                    {fCurrency(almacen.valor_venta ?? 0)}
                  </Typography>

                  <Label color={tieneAlertas ? 'warning' : 'success'} variant="soft">
                    {tieneAlertas ? `${almacen.alertas} alertas` : 'Sin alertas'}
                  </Label>
                </Box>

                {(puedeEditar || puedeEliminar) && (
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5, mt: 'auto' }}>
                    {puedeEditar && (
                      <IconButton size="small" onClick={() => setFormulario({ abierto: true, almacen })} aria-label={`Editar ${almacen.nombre}`}>
                        <Iconify icon="solar:pen-bold" width={18} />
                      </IconButton>
                    )}

                    {puedeEliminar && (
                      <IconButton size="small" color="error" onClick={() => setConfirmar(almacen)} aria-label={`Eliminar ${almacen.nombre}`}>
                        <Iconify icon="solar:trash-bin-trash-bold" width={18} />
                      </IconButton>
                    )}
                  </Box>
                )}
              </Card>
            );
          })}
        </Box>
      )}

      <AlmacenForm
        key={formulario.almacen?.id ?? 'nuevo'}
        abierto={formulario.abierto}
        almacen={formulario.almacen}
        alCerrar={() => setFormulario((previo) => ({ ...previo, abierto: false }))}
        alGuardar={alGuardar}
      />

      <Dialog open={Boolean(confirmar)} onClose={() => setConfirmar(null)} fullWidth maxWidth="xs">
        <DialogTitle>Eliminar almacen</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {confirmar?.nombre} se marcara como inactivo si tiene historial, o se eliminara del todo si esta vacio.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" disabled={borrando} onClick={() => setConfirmar(null)}>
            Cancelar
          </Button>
          <Button variant="contained" color="error" disabled={borrando} onClick={alEliminar} startIcon={borrando ? <CircularProgress size={16} color="inherit" /> : null}>
            Eliminar
          </Button>
        </DialogActions>
      </Dialog>
    </DashboardContent>
  );
}