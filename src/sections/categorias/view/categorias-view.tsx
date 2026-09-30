import type { Categoria } from 'src/types/inventario';

import { useState } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Alert from '@mui/material/Alert';
import Table from '@mui/material/Table';
import Dialog from '@mui/material/Dialog';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import InputAdornment from '@mui/material/InputAdornment';
import CircularProgress from '@mui/material/CircularProgress';

import { useAuth } from 'src/auth';
import { ApiError } from 'src/api/client';
import { DashboardContent } from 'src/layouts/dashboard';

import { Label } from 'src/components/label';
import { Iconify } from 'src/components/iconify';
import { PageHeader } from 'src/components/page-header/page-header';

import { PERMISO } from 'src/types/inventario';

import { useCategorias } from '../use-categorias';

import type { CategoriaEntrada } from '../use-categorias';

// ----------------------------------------------------------------------

const COLORES = ['#2065D1', '#FFAB00', '#22C55E', '#FF5630', '#8E33FF', '#00B8D9', '#637381'];

export function CategoriasView() {
  const { puede } = useAuth();
  const puedeEditar = puede(PERMISO.editar);
  const puedeEliminar = puede(PERMISO.eliminar);

  const { categorias, cargando, error, cargar, guardar, eliminar } = useCategorias();

  const [formulario, setFormulario] = useState<{ abierto: boolean; categoria?: Categoria }>({ abierto: false });
  const [confirmar, setConfirmar] = useState<Categoria | null>(null);
  const [borrando, setBorrando] = useState(false);
  const [errorAccion, setErrorAccion] = useState('');

  const alGuardar = async (datos: CategoriaEntrada) => {
    await guardar(datos, formulario.categoria?.id);
    setFormulario({ abierto: false });
  };

  const alEliminar = async () => {
    if (!confirmar) return;

    setBorrando(true);
    setErrorAccion('');

    try {
      await eliminar(confirmar.id);
      setConfirmar(null);
    } catch (e) {
      setErrorAccion(e instanceof Error ? e.message : 'No se pudo eliminar la categoria.');
    } finally {
      setBorrando(false);
    }
  };

  return (
    <DashboardContent maxWidth="lg">
      <PageHeader
        titulo="Categorias"
        descripcion="Clasificacion de los productos del inventario."
        icono="solar:layers-bold-duotone"
        color="secondary"
        acciones={
          <>
            <Button variant="outlined" color="inherit" startIcon={<Iconify icon="solar:restart-bold" />} onClick={cargar} disabled={cargando}>
              Actualizar
            </Button>

            {puedeEditar && (
              <Button variant="contained" startIcon={<Iconify icon="mingcute:add-line" />} onClick={() => setFormulario({ abierto: true })}>
                Nueva categoria
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

      {cargando && categorias.length === 0 ? (
        <Skeleton variant="rounded" height={360} />
      ) : (
        <Card sx={{ overflow: 'hidden' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Categoria</TableCell>
                <TableCell>Descripcion</TableCell>
                <TableCell align="right">Productos</TableCell>
                <TableCell align="right">Unidades</TableCell>
                <TableCell align="right">Acciones</TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {categorias.map((categoria) => (
                <TableRow key={categoria.id} hover>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box
                        component="span"
                        sx={{
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          bgcolor: categoria.color ?? 'text.disabled',
                        }}
                      />
                      <Typography variant="body2">{categoria.nombre}</Typography>
                      {!categoria.activo && (
                        <Label color="default" variant="soft">
                          Inactiva
                        </Label>
                      )}
                    </Box>
                  </TableCell>

                  <TableCell>{categoria.descripcion ?? '—'}</TableCell>
                  <TableCell align="right">{categoria.productos ?? 0}</TableCell>
                  <TableCell align="right">{categoria.unidades ?? 0}</TableCell>

                  <TableCell align="right">
                    {puedeEditar && (
                      <IconButton size="small" onClick={() => setFormulario({ abierto: true, categoria })} aria-label={`Editar ${categoria.nombre}`}>
                        <Iconify icon="solar:pen-bold" width={18} />
                      </IconButton>
                    )}

                    {puedeEliminar && (
                      <IconButton size="small" color="error" onClick={() => setConfirmar(categoria)} aria-label={`Eliminar ${categoria.nombre}`}>
                        <Iconify icon="solar:trash-bin-trash-bold" width={18} />
                      </IconButton>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {categorias.length === 0 && !cargando && (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Sin categorias registradas.
              </Typography>
            </Box>
          )}
        </Card>
      )}

      <CategoriaForm
        key={formulario.categoria?.id ?? 'nuevo'}
        abierto={formulario.abierto}
        categoria={formulario.categoria}
        alCerrar={() => setFormulario((previo) => ({ ...previo, abierto: false }))}
        alGuardar={alGuardar}
      />

      <Dialog open={Boolean(confirmar)} onClose={() => setConfirmar(null)} fullWidth maxWidth="xs">
        <DialogTitle>Eliminar categoria</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {confirmar?.nombre} se desactivara si tiene productos asociados, o se eliminara si esta vacia.
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

// ----------------------------------------------------------------------
//  Formulario embebido
// ----------------------------------------------------------------------

type FormProps = {
  abierto: boolean;
  categoria?: Categoria;
  alCerrar: () => void;
  alGuardar: (datos: CategoriaEntrada) => Promise<void>;
};

export function CategoriaForm({ abierto, categoria, alCerrar, alGuardar }: FormProps) {
  const [nombre, setNombre] = useState(categoria?.nombre ?? '');
  const [descripcion, setDescripcion] = useState(categoria?.descripcion ?? '');
  const [color, setColor] = useState(categoria?.color ?? COLORES[0]);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  const enviar = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (enviando) return;

    setError('');
    setEnviando(true);

    try {
      await alGuardar({
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || undefined,
        color,
      });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudo guardar la categoria.');
      setEnviando(false);
    }
  };

  return (
    <Dialog open={abierto} onClose={alCerrar} fullWidth maxWidth="sm" keepMounted={false}>
      <form onSubmit={enviar}>
        <DialogTitle>{categoria ? `Editar: ${categoria.nombre}` : 'Nueva categoria'}</DialogTitle>

        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Nombre"
            size="small"
            value={nombre}
            required
            onChange={(e) => setNombre(e.target.value)}
          />

          <TextField
            label="Descripcion"
            size="small"
            multiline
            minRows={2}
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
          />

          <TextField
            label="Color"
            size="small"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Box component="span" sx={{ width: 14, height: 14, borderRadius: '50%', bgcolor: color }} />
                  </InputAdornment>
                ),
              },
            }}
          />

          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {COLORES.map((opcion) => (
              <Box
                key={opcion}
                component="button"
                type="button"
                onClick={() => setColor(opcion)}
                sx={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  bgcolor: opcion,
                  cursor: 'pointer',
                  border: color === opcion ? '3px solid' : '1px solid',
                  borderColor: color === opcion ? 'primary.main' : 'divider',
                }}
              />
            ))}
          </Box>

          {error && (
            <Alert severity="error" onClose={() => setError('')}>
              {error}
            </Alert>
          )}
        </DialogContent>

        <DialogActions>
          <Button onClick={alCerrar} color="inherit" disabled={enviando}>
            Cancelar
          </Button>
          <Button type="submit" variant="contained" disabled={enviando} startIcon={enviando ? <CircularProgress size={16} color="inherit" /> : null}>
            {categoria ? 'Guardar cambios' : 'Crear categoria'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}