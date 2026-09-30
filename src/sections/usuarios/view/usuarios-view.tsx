import type { LabelColor } from 'src/components/label';
import type { UsuarioTabla } from 'src/types/inventario';

import { useState } from 'react';

import Card from '@mui/material/Card';
import Alert from '@mui/material/Alert';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Skeleton from '@mui/material/Skeleton';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import CircularProgress from '@mui/material/CircularProgress';

import { fDateTime } from 'src/utils/format-time';

import { useAuth } from 'src/auth';
import { DashboardContent } from 'src/layouts/dashboard';

import { Label } from 'src/components/label';
import { Iconify } from 'src/components/iconify';
import { PageHeader } from 'src/components/page-header/page-header';

import { PERMISO } from 'src/types/inventario';

import { UsuarioForm } from './usuario-form';
import { useUsuarios } from '../use-usuarios';

// ----------------------------------------------------------------------

export function UsuariosView() {
  const { usuario: sesion, puede } = useAuth();
  const puedeGestionar = puede(PERMISO.usuarios);

  const { usuarios, roles, cargando, error, cargar, guardar, desactivar } = useUsuarios();

  const [formulario, setFormulario] = useState<{ abierto: boolean; usuario?: UsuarioTabla }>({ abierto: false });
  const [borrando, setBorrando] = useState<number | null>(null);
  const [confirmar, setConfirmar] = useState<UsuarioTabla | null>(null);
  const [errorAccion, setErrorAccion] = useState('');

  const abrirNuevo = () => setFormulario({ abierto: true });
  const abrirEditar = (usuarioTabla: UsuarioTabla) => setFormulario({ abierto: true, usuario: usuarioTabla });
  const cerrarFormulario = () => setFormulario({ abierto: false });

  const alDesactivar = async () => {
    if (!confirmar) return;

    setBorrando(confirmar.id);
    setErrorAccion('');

    try {
      await desactivar(confirmar.id);
      setConfirmar(null);
    } catch (e) {
      setErrorAccion(e instanceof Error ? e.message : 'No se pudo desactivar el usuario.');
    } finally {
      setBorrando(null);
    }
  };

  const esElMismo = (usuarioTabla: UsuarioTabla) => sesion?.id === usuarioTabla.id;

  return (
    <DashboardContent maxWidth="xl">
      <PageHeader
        titulo="Usuarios"
        descripcion="Cuentas del sistema y sus roles de acceso."
        icono="solar:users-group-rounded-bold-duotone"
        color="secondary"
        acciones={
          <>
            <Button variant="outlined" color="inherit" startIcon={<Iconify icon="solar:restart-bold" />} onClick={cargar} disabled={cargando}>
              Actualizar
            </Button>

            {puedeGestionar && (
              <Button variant="contained" startIcon={<Iconify icon="mingcute:add-line" />} onClick={abrirNuevo}>
                Nuevo usuario
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

      {cargando && usuarios.length === 0 ? (
        <Skeleton variant="rounded" height={420} />
      ) : (
        <Card sx={{ overflow: 'hidden' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Usuario</TableCell>
                <TableCell>Rol</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell>Ultimo acceso</TableCell>
                <TableCell align="right">Movimientos</TableCell>
                <TableCell align="right">Acciones</TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {usuarios.map((usuarioTabla) => (
                <TableRow key={usuarioTabla.id} hover>
                  <TableCell>
                    <Typography variant="body2">
                      {usuarioTabla.nombre} {esElMismo(usuarioTabla) && <Label color="info" variant="soft">Tu</Label>}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {usuarioTabla.email}
                    </Typography>
                  </TableCell>

                  <TableCell>
                    <Label color="default" variant="soft">
                      {usuarioTabla.rol}
                    </Label>
                  </TableCell>

                  <TableCell>
                    <Label color={(usuarioTabla.activo ? 'success' : 'default') as LabelColor} variant="soft">
                      {usuarioTabla.activo ? 'Activo' : 'Inactivo'}
                    </Label>
                  </TableCell>

                  <TableCell>
                    <Typography variant="body2">
                      {usuarioTabla.ultimo_acceso ? fDateTime(usuarioTabla.ultimo_acceso) : 'Nunca'}
                    </Typography>
                  </TableCell>

                  <TableCell align="right">{usuarioTabla.movimientos ?? 0}</TableCell>

                  <TableCell align="right">
                    {puedeGestionar && (
                      <IconButton size="small" onClick={() => abrirEditar(usuarioTabla)} aria-label={`Editar ${usuarioTabla.nombre}`}>
                        <Iconify icon="solar:pen-bold" width={18} />
                      </IconButton>
                    )}

                    {puedeGestionar && !esElMismo(usuarioTabla) && usuarioTabla.activo ? (
                      <IconButton
                        size="small"
                        color="error"
                        disabled={borrando === usuarioTabla.id}
                        onClick={() => setConfirmar(usuarioTabla)}
                        aria-label={`Desactivar ${usuarioTabla.nombre}`}
                      >
                        <Iconify icon="solar:trash-bin-trash-bold" width={18} />
                      </IconButton>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <UsuarioForm
        key={formulario.usuario?.id ?? 'nuevo'}
        abierto={formulario.abierto}
        usuario={formulario.usuario}
        roles={roles}
        alCerrar={cerrarFormulario}
        alGuardar={guardar}
      />

      <Dialog open={Boolean(confirmar)} onClose={() => setConfirmar(null)} fullWidth maxWidth="xs">
        <DialogTitle>Desactivar usuario</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {confirmar?.nombre} ya no podra entrar al sistema. Puedes reactivarlo despues desde su edicion.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" disabled={borrando !== null} onClick={() => setConfirmar(null)}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            color="error"
            disabled={borrando !== null}
            onClick={alDesactivar}
            startIcon={borrando !== null ? <CircularProgress size={16} color="inherit" /> : null}
          >
            Desactivar
          </Button>
        </DialogActions>
      </Dialog>
    </DashboardContent>
  );
}