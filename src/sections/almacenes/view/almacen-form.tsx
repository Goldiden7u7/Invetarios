import type { Almacen } from 'src/types/inventario';

import { useState } from 'react';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Dialog from '@mui/material/Dialog';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import CircularProgress from '@mui/material/CircularProgress';

import { ApiError } from 'src/api/client';

import type { AlmacenEntrada } from '../use-almacenes';

// ----------------------------------------------------------------------

type Props = {
  abierto: boolean;
  almacen?: Almacen;
  alCerrar: () => void;
  alGuardar: (datos: AlmacenEntrada) => Promise<void>;
};

// ----------------------------------------------------------------------

export function AlmacenForm({ abierto, almacen, alCerrar, alGuardar }: Props) {
  const [codigo, setCodigo] = useState(almacen?.codigo ?? '');
  const [nombre, setNombre] = useState(almacen?.nombre ?? '');
  const [descripcion, setDescripcion] = useState(almacen?.descripcion ?? '');
  const [direccion, setDireccion] = useState(almacen?.direccion ?? '');
  const [responsable, setResponsable] = useState(almacen?.responsable ?? '');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  const enviar = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (enviando) return;

    setError('');
    setEnviando(true);

    try {
      await alGuardar({
        codigo: codigo.trim(),
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || undefined,
        direccion: direccion.trim() || undefined,
        responsable: responsable.trim() || undefined,
      });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudo guardar el almacen.');
      setEnviando(false);
    }
  };

  return (
    <Dialog open={abierto} onClose={alCerrar} fullWidth maxWidth="sm" keepMounted={false}>
      <form onSubmit={enviar}>
        <DialogTitle>{almacen ? `Editar: ${almacen.nombre}` : 'Nuevo almacen'}</DialogTitle>

        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 2fr' }, gap: 2 }}>
            <TextField
              label="Codigo"
              size="small"
              value={codigo}
              required
              onChange={(e) => setCodigo(e.target.value)}
            />
            <TextField
              label="Nombre"
              size="small"
              value={nombre}
              required
              onChange={(e) => setNombre(e.target.value)}
            />
          </Box>

          <TextField
            label="Descripcion"
            size="small"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
          />

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
            <TextField
              label="Direccion"
              size="small"
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
            />
            <TextField
              label="Responsable"
              size="small"
              value={responsable}
              onChange={(e) => setResponsable(e.target.value)}
            />
          </Box>

          {error && (
            <Alert severity="error" onClose={() => setError('')}>
              {error}
            </Alert>
          )}

          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            El stock de cada producto se reparte entre los almacenes activos.
          </Typography>
        </DialogContent>

        <DialogActions>
          <Button onClick={alCerrar} color="inherit" disabled={enviando}>
            Cancelar
          </Button>
          <Button type="submit" variant="contained" disabled={enviando} startIcon={enviando ? <CircularProgress size={16} color="inherit" /> : null}>
            {almacen ? 'Guardar cambios' : 'Crear almacen'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}