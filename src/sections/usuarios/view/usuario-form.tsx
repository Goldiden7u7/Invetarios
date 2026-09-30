import type { Rol, UsuarioTabla } from 'src/types/inventario';

import { useState } from 'react';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Dialog from '@mui/material/Dialog';
import Button from '@mui/material/Button';
import Switch from '@mui/material/Switch';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import FormControlLabel from '@mui/material/FormControlLabel';
import CircularProgress from '@mui/material/CircularProgress';

import { ApiError } from 'src/api/client';

import type { UsuarioEntrada } from '../use-usuarios';

// ----------------------------------------------------------------------

type Props = {
  abierto: boolean;
  usuario?: UsuarioTabla;
  roles: Rol[];
  alCerrar: () => void;
  alGuardar: (datos: UsuarioEntrada, idUsuario?: number) => Promise<unknown>;
};

// ----------------------------------------------------------------------

export function UsuarioForm({ abierto, usuario, roles, alCerrar, alGuardar }: Props) {
  const [nombre, setNombre] = useState(usuario?.nombre ?? '');
  const [email, setEmail] = useState(usuario?.email ?? '');
  const [telefono, setTelefono] = useState(usuario?.telefono ?? '');
  const [rolId, setRolId] = useState<number | ''>(usuario?.rol_id ?? '');
  const [password, setPassword] = useState('');
  const [activo, setActivo] = useState(usuario ? Boolean(usuario.activo) : true);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  const enviar = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (enviando) return;

    setError('');
    setEnviando(true);

    try {
      await alGuardar(
        {
          nombre: nombre.trim(),
          email: email.trim(),
          telefono: telefono.trim() || undefined,
          rol_id: Number(rolId),
          password: password || undefined,
          activo: activo ? 1 : 0,
        },
        usuario?.id
      );
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudo guardar el usuario.');
      setEnviando(false);
    }
  };

  return (
    <Dialog open={abierto} onClose={alCerrar} fullWidth maxWidth="sm" keepMounted={false}>
      <form onSubmit={enviar}>
        <DialogTitle>{usuario ? `Editar: ${usuario.nombre}` : 'Nuevo usuario'}</DialogTitle>

        <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
            <TextField
              label="Nombre"
              size="small"
              value={nombre}
              required
              onChange={(e) => setNombre(e.target.value)}
            />
            <TextField
              label="Correo"
              size="small"
              type="email"
              value={email}
              required
              onChange={(e) => setEmail(e.target.value)}
            />
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
            <TextField
              select
              label="Rol"
              size="small"
              value={rolId}
              required
              onChange={(e) => setRolId(Number(e.target.value))}
            >
              {roles.map((rol) => (
                <MenuItem key={rol.id} value={rol.id}>
                  {rol.nombre}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              label="Telefono (opcional)"
              size="small"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
            />
          </Box>

          <TextField
            label={usuario ? 'Nueva contrasena (dejar vacio para no cambiarla)' : 'Contrasena (minimo 8 caracteres)'}
            size="small"
            type="password"
            value={password}
            required={!usuario}
            onChange={(e) => setPassword(e.target.value)}
          />

          {usuario && (
            <FormControlLabel
              control={<Switch checked={activo} onChange={(e) => setActivo(e.target.checked)} />}
              label="Usuario activo (puede entrar)"
            />
          )}

          {error && (
            <Alert severity="error" onClose={() => setError('')}>
              {error}
            </Alert>
          )}

          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            El rol controla lo que el usuario puede ver y hacer en el sistema.
          </Typography>
        </DialogContent>

        <DialogActions>
          <Button onClick={alCerrar} color="inherit" disabled={enviando}>
            Cancelar
          </Button>
          <Button type="submit" variant="contained" disabled={enviando || !rolId} startIcon={enviando ? <CircularProgress size={16} color="inherit" /> : null}>
            {usuario ? 'Guardar cambios' : 'Crear usuario'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}