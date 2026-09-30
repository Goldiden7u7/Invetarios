import type { DetalleCombo } from 'src/types/inventario';

import { useState } from 'react';
import { varAlpha } from 'minimal-shared/utils';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';

import { fCurrency } from 'src/utils/format-number';

import { Iconify } from 'src/components/iconify';

import type { QuitadoLinea, OpcionalLinea, Personalizacion } from '../use-caja';

// ----------------------------------------------------------------------

const TIPO_TEXTO: Record<string, string> = {
  comida: 'Comida',
  snack: 'Snack',
  bebida: 'Bebida',
};

/** Color de acento por tipo de producto, igual que las tarjetas del menu. */
const TIPO_COLOR: Record<string, 'primary' | 'warning' | 'info'> = {
  comida: 'primary',
  snack: 'warning',
  bebida: 'info',
};

const TIPO_ICONO: Record<string, 'solar:chef-hat-bold-duotone' | 'solar:layers-bold-duotone' | 'solar:cart-3-bold'> = {
  comida: 'solar:chef-hat-bold-duotone',
  snack: 'solar:layers-bold-duotone',
  bebida: 'solar:cart-3-bold',
};

type Props = {
  combo: DetalleCombo;
  alCerrar: () => void;
  alConfirmar: (personalizacion: Personalizacion, combo: DetalleCombo) => void;
};

/** Titulo de seccion con icono: separa bloques para que no se mezclen. */
function Seccion({
  icono,
  titulo,
  ayuda,
  children,
}: {
  icono: 'solar:box-minimalistic-bold-duotone' | 'solar:cart-3-bold';
  titulo: string;
  ayuda: string;
  children: React.ReactNode;
}) {
  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box
          sx={{
            width: 30,
            height: 30,
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
            borderRadius: 1.5,
            color: 'primary.main',
            bgcolor: (theme) => varAlpha(theme.vars.palette.primary.mainChannel, 0.14),
          }}
        >
          <Iconify icon={icono} width={17} />
        </Box>

        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle2" sx={{ lineHeight: 1.2 }}>
            {titulo}
          </Typography>

          <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.2 }}>
            {ayuda}
          </Typography>
        </Box>
      </Box>

      <Box sx={{ mt: 1.25 }}>{children}</Box>
    </Box>
  );
}

// ----------------------------------------------------------------------

export function ComboModal({ combo, alCerrar, alConfirmar }: Props) {
  const [cantidad, setCantidad] = useState(1);
  const [quitados, setQuitados] = useState<QuitadoLinea[]>([]);
  const [opcionales, setOpcionales] = useState<OpcionalLinea[]>([]);
  const [notas, setNotas] = useState('');

  const color = TIPO_COLOR[combo.tipo] ?? 'primary';

  const estaQuitado = (productoId: number) => quitados.some((q) => q.producto_id === productoId);

  const alternarQuitado = (ingrediente: { producto_id: number; nombre: string; cantidad: number }) => {
    setQuitados((previo) => {
      if (estaQuitado(ingrediente.producto_id)) {
        return previo.filter((q) => q.producto_id !== ingrediente.producto_id);
      }
      return [...previo, { producto_id: ingrediente.producto_id, nombre: ingrediente.nombre, cantidad: ingrediente.cantidad }];
    });
  };

  const cambiarOpcional = (opcional: OpcionalLinea, delta: number) => {
    setOpcionales((previo) => {
      const existente = previo.find((o) => o.producto_id === opcional.producto_id);
      const nuevaCantidad = Math.max(0, (existente?.cantidad ?? 0) + delta);

      if (nuevaCantidad === 0) {
        return previo.filter((o) => o.producto_id !== opcional.producto_id);
      }

      if (existente) {
        return previo.map((o) => (o.producto_id === opcional.producto_id ? { ...o, cantidad: nuevaCantidad } : o));
      }

      return [...previo, { ...opcional, cantidad: nuevaCantidad }];
    });
  };

  const sumaExtras = opcionales.reduce((suma, o) => suma + o.precio_extra * o.cantidad, 0);
  const total = (combo.precio_venta + sumaExtras) * cantidad;

  /** Cantidad ya agregada de un extra, para pintar el contador. */
  const takenOpcional = (productoId: number) => opcionales.find((o) => o.producto_id === productoId)?.cantidad ?? 0;

  const confirmar = () => {
    alConfirmar({ cantidad, opcionales, quitados, notas: notas.trim() }, combo);
  };

  /** Contador +/- reutilizable (extras y cantidad). */
  const Contador = ({
    valor,
    onMenos,
    onMas,
    etiqueta,
  }: {
    valor: number;
    onMenos: () => void;
    onMas: () => void;
    etiqueta: string;
  }) => (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        borderRadius: 999,
        border: (theme) => `1px solid ${theme.vars.palette.divider}`,
        p: 0.25,
        flexShrink: 0,
      }}
    >
      <IconButton
        size="small"
        onClick={onMenos}
        disabled={valor === 0}
        aria-label={`Quitar ${etiqueta}`}
        sx={{ width: 28, height: 28 }}
      >
        <Iconify icon="mingcute:close-line" width={14} />
      </IconButton>

      <Typography variant="subtitle2" sx={{ minWidth: 24, textAlign: 'center' }}>
        {valor}
      </Typography>

      <IconButton size="small" color="primary" onClick={onMas} aria-label={`Anadir ${etiqueta}`} sx={{ width: 28, height: 28 }}>
        <Iconify icon="mingcute:add-line" width={14} />
      </IconButton>
    </Box>
  );

  return (
    <Dialog open onClose={alCerrar} fullWidth maxWidth="sm" keepMounted={false}>
      {/* Encabezado con el color del tipo de producto */}
      <DialogTitle
        sx={{
          p: 0,
          color: 'common.white',
          backgroundImage: (theme) =>
            `linear-gradient(120deg, ${theme.vars.palette[color].dark}, ${theme.vars.palette[color].main})`,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 2.5 }}>
          <Box
            sx={{
              width: 46,
              height: 46,
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
              borderRadius: 2,
              color: 'common.white',
              bgcolor: (theme) => varAlpha(theme.vars.palette[color].dark, 0.35),
            }}
          >
            <Iconify icon={TIPO_ICONO[combo.tipo] ?? 'solar:cart-3-bold'} width={26} />
          </Box>

          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="h6" sx={{ color: 'common.white' }}>
              {combo.nombre}
            </Typography>

            <Typography variant="caption" sx={{ color: 'inherit', opacity: 0.85 }}>
              {combo.codigo} · {TIPO_TEXTO[combo.tipo] ?? combo.tipo} · {fCurrency(combo.precio_venta)}
            </Typography>
          </Box>

          <IconButton onClick={alCerrar} aria-label="Cerrar" sx={{ color: 'common.white' }}>
            <Iconify icon="mingcute:close-line" width={20} />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, py: 2.5 }}>
        {combo.descripcion && (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {combo.descripcion}
          </Typography>
        )}

        {/* Ingredientes: toda la fila es pulsable, sin hunting for the switch */}
        <Seccion
          icono="solar:box-minimalistic-bold-duotone"
          titulo="Ingredientes"
          ayuda="Toca uno para quitarlo. La cocina lo vera marcado como NO PREPARAR."
        >
          {combo.ingredientes.length === 0 ? (
            <Typography variant="body2" sx={{ color: 'text.disabled' }}>
              Este combo no tiene ingredientes registrados.
            </Typography>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              {combo.ingredientes.map((ingrediente) => {
                const quitado = estaQuitado(ingrediente.producto_id);

                return (
                  <Box
                    key={ingrediente.producto_id}
                    role="button"
                    tabIndex={0}
                    onClick={() => alternarQuitado(ingrediente)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        alternarQuitado(ingrediente);
                      }
                    }}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 1.5,
                      cursor: 'pointer',
                      userSelect: 'none',
                      p: 1.25,
                      borderRadius: 2,
                      border: (theme) => `1px solid ${quitado ? 'transparent' : theme.vars.palette.divider}`,
                      bgcolor: quitado
                        ? (theme) => varAlpha(theme.vars.palette.error.mainChannel, 0.1)
                        : 'background.paper',
                      transition: 'all 140ms ease',
                      '&:hover': {
                        borderColor: (theme) =>
                          varAlpha(quitado ? theme.vars.palette.error.mainChannel : theme.vars.palette.primary.mainChannel, 0.5),
                      },
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
                      <Box
                        sx={{
                          width: 22,
                          height: 22,
                          display: 'grid',
                          placeItems: 'center',
                          flexShrink: 0,
                          borderRadius: 1,
                          color: quitado ? 'common.white' : 'transparent',
                          bgcolor: (theme) =>
                            quitado ? theme.vars.palette.error.main : theme.vars.palette.background.neutral,
                          border: (theme) => `1px solid ${theme.vars.palette.divider}`,
                        }}
                      >
                        <Iconify icon="mingcute:close-line" width={14} />
                      </Box>

                      <Box sx={{ minWidth: 0 }}>
                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: 500,
                            textDecoration: quitado ? 'line-through' : 'none',
                            color: quitado ? 'text.secondary' : 'text.primary',
                          }}
                        >
                          {ingrediente.nombre}
                        </Typography>

                        <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                          {ingrediente.cantidad} {ingrediente.unidad_medida}
                        </Typography>
                      </Box>
                    </Box>

                    <Chip
                      label={quitado ? 'Quitar' : 'Incluido'}
                      color={quitado ? 'error' : 'default'}
                      variant={quitado ? 'filled' : 'outlined'}
                      size="small"
                      sx={{ flexShrink: 0, pointerEvents: 'none' }}
                    />
                  </Box>
                );
              })}
            </Box>
          )}
        </Seccion>

        {/* Extras opcionales */}
        {combo.opcionales.length > 0 && (
          <Seccion
            icono="solar:cart-3-bold"
            titulo="Extras opcionales"
            ayuda="Suman al precio. Solo se descuentan del stock si el cliente los pide."
          >
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              {combo.opcionales.map((extra) => {
                const cantidadP = takenOpcional(extra.producto_id);

                return (
                  <Box
                    key={extra.producto_id}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 1.5,
                      p: 1.25,
                      borderRadius: 2,
                      border: (theme) => `1px solid ${theme.vars.palette.divider}`,
                      bgcolor: (theme) =>
                        cantidadP > 0 ? varAlpha(theme.vars.palette.primary.mainChannel, 0.07) : 'background.paper',
                    }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {extra.nombre}
                      </Typography>

                      <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 600 }}>
                        +{fCurrency(extra.precio_extra)}
                      </Typography>

                      <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block' }}>
                        {extra.cantidad} {extra.unidad_medida}
                      </Typography>
                    </Box>

                    <Contador
                      valor={cantidadP}
                      etiqueta={extra.nombre}
                      onMenos={() => cambiarOpcional(extra, -1)}
                      onMas={() => cambiarOpcional(extra, 1)}
                    />
                  </Box>
                );
              })}
            </Box>
          </Seccion>
        )}

        <Divider />

        {/* Cantidad + notas */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="subtitle2">Cuantas piezas</Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Se aplican los mismos ingredientes a todas
            </Typography>
          </Box>

          <Contador
            valor={cantidad}
            etiqueta="pieza"
            onMenos={() => setCantidad((c) => Math.max(1, c - 1))}
            onMas={() => setCantidad((c) => Math.min(100, c + 1))}
          />
        </Box>

        <TextField
          label="Notas para cocina (opcional)"
          size="small"
          multiline
          minRows={2}
          placeholder='Ej: "sin sal", "servir caliente"...'
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
        />

        {/* Resumen de lo customizing: lo ve el cajero antes de agregar */}
        {(quitados.length > 0 || opcionales.length > 0) && (
          <Box
            sx={{
              p: 1.5,
              borderRadius: 2,
              bgcolor: (theme) => varAlpha(theme.vars.palette.background.neutralChannel, 0.6),
            }}
          >
            <Typography variant="caption" sx={{ display: 'block', mb: 0.75, color: 'text.secondary' }}>
              Resumen del pedido
            </Typography>

            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
              {quitados.map((q) => (
                <Chip
                  key={`q-${q.producto_id}`}
                  size="small"
                  color="error"
                  variant="outlined"
                  icon={<Iconify icon="mingcute:close-line" width={14} />}
                  label={`Sin ${q.nombre}`}
                />
              ))}

              {opcionales.map((o) => (
                <Chip
                  key={`o-${o.producto_id}`}
                  size="small"
                  color="primary"
                  variant="outlined"
                  label={`${o.cantidad}x ${o.nombre}`}
                />
              ))}
            </Box>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', lineHeight: 1.1 }}>
            Total
          </Typography>

          <Typography variant="h5" sx={{ color: 'primary.main' }}>
            {fCurrency(total)}
          </Typography>

          {sumaExtras > 0 && (
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              incluye {fCurrency(sumaExtras)} en extras
            </Typography>
          )}
        </Box>

        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" color="inherit" onClick={alCerrar}>
            Cancelar
          </Button>

          <Button variant="contained" size="large" onClick={confirmar} startIcon={<Iconify icon="solar:cart-3-bold" />}>
            Agregar al pedido
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
}
