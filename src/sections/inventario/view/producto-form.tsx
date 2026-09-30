import type { Producto, Categoria } from 'src/types/inventario';

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

// ----------------------------------------------------------------------

export type ProductoFormValores = {
  codigo: string;
  nombre: string;
  descripcion: string;
  categoria_id: number | null;
  unidad_medida: string;
  precio_compra: number;
  precio_venta: number;
  stock_minimo: number;
  stock_maximo: number;
  controla_serial: boolean;
  perecedero: boolean;
  fecha_vencimiento: string | null;
  activo: boolean;
};

type Props = {
  abierto: boolean;
  producto?: Producto;
  categorias: Categoria[];
  alCerrar: () => void;
  alGuardar: (valores: ProductoFormValores) => Promise<void>;
};

// ----------------------------------------------------------------------

const UNIDADES = ['unidad', 'kg', 'g', 'L', 'ml', 'paquete', 'caja'];

export function ProductoForm({ abierto, producto, categorias, alCerrar, alGuardar }: Props) {
  const [valores, setValores] = useState<ProductoFormValores>(() => ({
    codigo: producto?.codigo ?? '',
    nombre: producto?.nombre ?? '',
    descripcion: producto?.descripcion ?? '',
    categoria_id: producto?.categoria_id ?? null,
    unidad_medida: producto?.unidad_medida ?? 'unidad',
    precio_compra: producto?.precio_compra ?? 0,
    precio_venta: producto?.precio_venta ?? 0,
    stock_minimo: producto?.stock_minimo ?? 0,
    stock_maximo: producto?.stock_maximo ?? 0,
    controla_serial: Boolean(producto?.controla_serial),
    perecedero: Boolean(producto?.perecedero),
    fecha_vencimiento: producto?.fecha_vencimiento ? producto.fecha_vencimiento.slice(0, 10) : null,
    activo: producto ? Boolean(producto.activo) : true,
  }));

  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  const cambiar = <K extends keyof ProductoFormValores>(campo: K, valor: ProductoFormValores[K]) => {
    setValores((previo) => ({ ...previo, [campo]: valor }));
  };

  const enviar = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (enviando) return;

    setError('');
    setEnviando(true);

    try {
      await alGuardar(valores);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudo guardar el producto.');
      setEnviando(false);
    }
  };

  return (
    <Dialog open={abierto} onClose={alCerrar} fullWidth maxWidth="sm" keepMounted={false}>
      <form onSubmit={enviar}>
        <DialogTitle>{producto ? `Editar: ${producto.nombre}` : 'Nuevo producto'}</DialogTitle>

        <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 2fr' }, gap: 2 }}>
            <TextField
              label="Codigo"
              size="small"
              value={valores.codigo}
              required
              onChange={(e) => cambiar('codigo', e.target.value)}
            />
            <TextField
              label="Nombre"
              size="small"
              value={valores.nombre}
              required
              onChange={(e) => cambiar('nombre', e.target.value)}
            />
          </Box>

          <TextField
            label="Descripcion"
            size="small"
            multiline
            minRows={2}
            value={valores.descripcion}
            onChange={(e) => cambiar('descripcion', e.target.value)}
          />

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
            <TextField
              select
              label="Categoria"
              size="small"
              value={valores.categoria_id ?? ''}
              onChange={(e) => cambiar('categoria_id', e.target.value ? Number(e.target.value) : null)}
            >
              <MenuItem value="">Sin categoria</MenuItem>
              {categorias.map((categoria) => (
                <MenuItem key={categoria.id} value={categoria.id}>
                  {categoria.nombre}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              select
              label="Unidad de medida"
              size="small"
              value={valores.unidad_medida}
              onChange={(e) => cambiar('unidad_medida', e.target.value)}
            >
              {UNIDADES.map((unidad) => (
                <MenuItem key={unidad} value={unidad}>
                  {unidad}
                </MenuItem>
              ))}
            </TextField>
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
            <TextField
              label="Precio de compra"
              size="small"
              type="number"
              inputProps={{ min: 0, step: '0.01' }}
              value={valores.precio_compra}
              onChange={(e) => cambiar('precio_compra', Number(e.target.value))}
            />
            <TextField
              label="Precio de venta"
              size="small"
              type="number"
              inputProps={{ min: 0, step: '0.01' }}
              value={valores.precio_venta}
              onChange={(e) => cambiar('precio_venta', Number(e.target.value))}
            />
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
            <TextField
              label="Stock minimo"
              size="small"
              type="number"
              inputProps={{ min: 0 }}
              value={valores.stock_minimo}
              onChange={(e) => cambiar('stock_minimo', Number(e.target.value))}
            />
            <TextField
              label="Stock maximo"
              size="small"
              type="number"
              inputProps={{ min: 0 }}
              value={valores.stock_maximo}
              onChange={(e) => cambiar('stock_maximo', Number(e.target.value))}
            />
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
            <FormControlLabel
              control={<Switch checked={valores.perecedero} onChange={(e) => cambiar('perecedero', e.target.checked)} />}
              label="Perecedero"
            />
            <FormControlLabel
              control={<Switch checked={valores.controla_serial} onChange={(e) => cambiar('controla_serial', e.target.checked)} />}
              label="Controla numero de serie"
            />
          </Box>

          {valores.perecedero && (
            <TextField
              label="Fecha de vencimiento"
              size="small"
              type="date"
              value={valores.fecha_vencimiento ?? ''}
              onChange={(e) => cambiar('fecha_vencimiento', e.target.value || null)}
            />
          )}

          {producto && (
            <FormControlLabel
              control={<Switch checked={valores.activo} onChange={(e) => cambiar('activo', e.target.checked)} />}
              label="Producto activo"
            />
          )}

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
            {producto ? 'Guardar cambios' : 'Crear producto'}
          </Button>
        </DialogActions>
      </form>

      <Typography variant="caption" sx={{ px: 3, pb: 2, color: 'text.secondary' }}>
        La fecha de vencimiento solo aplica a productos perecederos.
      </Typography>
    </Dialog>
  );
}