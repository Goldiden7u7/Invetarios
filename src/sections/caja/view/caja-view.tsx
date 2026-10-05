import type { RespuestaCrearVenta } from 'src/types/inventario';

import { useState } from 'react';
import { varAlpha } from 'minimal-shared/utils';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Dialog from '@mui/material/Dialog';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Skeleton from '@mui/material/Skeleton';
import MenuItem from '@mui/material/MenuItem';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
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
import { Iconify, type IconifyName } from 'src/components/iconify';
import { PageHeader } from 'src/components/page-header/page-header';

import { PERMISO } from 'src/types/inventario';

import { ComboModal } from './combo-modal';
import { useCaja, type FiltroTipo } from '../use-caja';

// ----------------------------------------------------------------------

const TIPOS: { valor: FiltroTipo; etiqueta: string }[] = [
  { valor: 'todos', etiqueta: 'Todo' },
  { valor: 'comida', etiqueta: 'Comida' },
  { valor: 'snack', etiqueta: 'Snacks' },
  { valor: 'bebida', etiqueta: 'Bebidas' },
];

/** Identidad visual de cada tipo de producto del menu. */
const ESTILO_TIPO: Record<string, { color: 'primary' | 'warning' | 'info'; icono: IconifyName }> = {
  comida: { color: 'primary', icono: 'solar:chef-hat-bold-duotone' },
  snack: { color: 'warning', icono: 'solar:layers-bold-duotone' },
  bebida: { color: 'info', icono: 'solar:cart-3-bold' },
};

type CobroModalState = { abierto: boolean; resultado: RespuestaCrearVenta | null };

// ----------------------------------------------------------------------

export function CajaView() {
  const { puede } = useAuth();
  // Los dos bits: poder crear y estar en el modulo Caja.
  // eslint-disable-next-line no-bitwise -- los permisos SON banderas de bits
  const puedeVender = puede(PERMISO.crear | PERMISO.caja);

  const {
    combos,
    almacenes,
    almacenId,
    setAlmacenId,
    tipoFiltro,
    setTipoFiltro,
    comboActivo,
    carrito,
    cargando,
    cobrando,
    error,
    cargarCatalogo,
    abrirCombo,
    setComboActivo,
    agregarAlCarrito,
    quitarDelCarrito,
    limpiarCarrito,
    totalLinea,
    subtotal,
    cobrar,
  } = useCaja();

  const [cobro, setCobro] = useState<CobroModalState>({ abierto: false, resultado: null });
  const [cliente, setCliente] = useState('');
  const [metodoPago, setMetodoPago] = useState('efectivo');
  const [descuento, setDescuento] = useState('0');
  const [cobrandoError, setCobrandoError] = useState('');

  const comboFiltrados = tipoFiltro === 'todos' ? combos : combos.filter((c) => c.tipo === tipoFiltro);

  const totalConDescuento = Math.max(0, subtotal - Number(descuento || 0));

  const confirmarCobro = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCobrandoError('');

    try {
      const resultado = await cobrar(cliente.trim(), metodoPago, Number(descuento || 0));
      setCobro({ abierto: true, resultado });
      setCliente('');
      setDescuento('0');
    } catch (e) {
      setCobrandoError(e instanceof Error ? e.message : 'No se pudo completar la venta.');
    }
  };

  const renderCabecera = () => (
    <PageHeader
      titulo="Caja"
      descripcion="Toca un combo para agregarlo, personaliza los ingredientes y cobra."
      icono="solar:wallet-money-bold-duotone"
      color="primary"
      chips={[
        { etiqueta: 'En el pedido', valor: `${carrito.reduce((n, l) => n + l.cantidad, 0)} items` },
        { etiqueta: 'Total', valor: fCurrency(totalConDescuento), color: 'primary' },
      ]}
      acciones={
        <>
          <TextField
            select
            size="small"
            label="Almacen"
            value={almacenId}
            disabled={cargando || almacenes.length === 0}
            onChange={(e) => setAlmacenId(Number(e.target.value))}
            sx={{ minWidth: 180 }}
          >
            {almacenes.map((almacen) => (
              <MenuItem key={almacen.id} value={almacen.id}>
                {almacen.nombre}
              </MenuItem>
            ))}
          </TextField>

          <Button variant="outlined" color="inherit" startIcon={<Iconify icon="solar:restart-bold" />} onClick={cargarCatalogo} disabled={cargando}>
            Actualizar
          </Button>
        </>
      }
    />
  );

  const renderMenu = () => (
    <Box>
      <Stack direction="row" spacing={1} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
        {TIPOS.map((tipo) => (
          <Chip
            key={tipo.valor}
            label={tipo.etiqueta}
            color={tipoFiltro === tipo.valor ? 'primary' : 'default'}
            variant={tipoFiltro === tipo.valor ? 'filled' : 'outlined'}
            onClick={() => setTipoFiltro(tipo.valor)}
          />
        ))}
      </Stack>

      {cargando ? (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: '1fr 1fr 1fr' }, gap: 2 }}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} variant="rounded" height={132} />
          ))}
        </Box>
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: '1fr 1fr 1fr' }, gap: 2 }}>
          {comboFiltrados.map((combo) => {
            const estilo = ESTILO_TIPO[combo.tipo];

            return (
              <Card
                key={combo.id}
                onClick={() => abrirCombo(combo)}
                sx={{
                  p: 2,
                  cursor: 'pointer',
                  position: 'relative',
                  overflow: 'hidden',
                  // Franja de color segun el tipo: comida, snack o bebida.
                  // De un vistazo se distingue el menu sin leer nada.
                  borderTop: 4,
                  borderTopColor: (theme) => theme.vars.palette[estilo.color].main,
                  '&:hover': { transform: 'translateY(-3px)' },
                }}
              >
                <Stack direction="row" spacing={1.5} alignItems="flex-start">
                  <Box
                    sx={{
                      width: 44,
                      height: 44,
                      display: 'grid',
                      placeItems: 'center',
                      flexShrink: 0,
                      borderRadius: 2,
                      color: (theme) => theme.vars.palette[estilo.color].main,
                      bgcolor: (theme) => varAlpha(theme.vars.palette[estilo.color].mainChannel, 0.14),
                    }}
                  >
                    <Iconify icon={estilo.icono} width={24} />
                  </Box>

                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography variant="subtitle2" noWrap>
                      {combo.nombre}
                    </Typography>

                    {combo.descripcion && (
                      <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap>
                        {combo.descripcion}
                      </Typography>
                    )}

                    <Stack direction="row" spacing={0.75} sx={{ mt: 1, flexWrap: 'wrap', gap: 0.5 }}>
                      <Label color={combo.requiere_cocina === 1 ? 'warning' : 'success'} variant="soft">
                        {combo.requiere_cocina === 1 ? 'Va a cocina' : 'Listo al instante'}
                      </Label>

                      {combo.n_opcionales > 0 && (
                        <Label color="info" variant="soft">
                          {combo.n_opcionales} extras
                        </Label>
                      )}
                    </Stack>
                  </Box>
                </Stack>

                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mt: 1.5 }}>
                  <Typography variant="h5" sx={{ color: 'primary.main' }}>
                    {fCurrency(combo.precio_venta)}
                  </Typography>

                  <Box
                    sx={{
                      width: 32,
                      height: 32,
                      display: 'grid',
                      placeItems: 'center',
                      borderRadius: '50%',
                      color: 'primary.contrastText',
                      backgroundImage: (theme) =>
                        `linear-gradient(135deg, ${theme.vars.palette.primary.main}, ${theme.vars.palette.primary.dark})`,
                    }}
                  >
                    <Iconify icon="mingcute:add-line" width={18} />
                  </Box>
                </Stack>
              </Card>
            );
          })}
        </Box>
      )}

      {!cargando && comboFiltrados.length === 0 && (
        <Box sx={{ py: 6, textAlign: 'center' }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            No hay combos en esta categoria.
          </Typography>
        </Box>
      )}
    </Box>
  );

  const renderCarrito = () => (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'sticky',
        top: 96,
      }}
    >
      <Box
        sx={{
          px: 2,
          py: 1.5,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundImage: (theme) =>
            `linear-gradient(90deg, ${varAlpha(theme.vars.palette.primary.mainChannel, 0.12)}, transparent)`,
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <Iconify icon="solar:cart-3-bold" width={20} sx={{ color: 'primary.main' }} />
          <Typography variant="subtitle1">Tu pedido</Typography>
          <Label color="primary" variant="soft">
            {carrito.reduce((n, l) => n + l.cantidad, 0)}
          </Label>
        </Stack>

        {carrito.length > 0 && (
          <Button size="small" color="error" startIcon={<Iconify icon="solar:trash-bin-trash-bold" />} onClick={limpiarCarrito}>
            Vaciar
          </Button>
        )}
      </Box>

      <Divider />

      {carrito.length === 0 ? (
        <Box sx={{ flex: 1, display: 'grid', placeItems: 'center', p: 3 }}>
          <Box sx={{ textAlign: 'center' }}>
            <Iconify icon="solar:cart-3-bold" width={40} sx={{ color: 'text.disabled', mb: 1 }} />
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Toca un combo para empezar.
            </Typography>
          </Box>
        </Box>
      ) : (
        <>
          <Box sx={{ flex: 1, overflowY: 'auto', p: 1 }}>
            <Table size="small">
              <TableBody>
                {carrito.map((linea, indice) => {
                  const nombreExtras = linea.opcionales.map((o) => `+${o.nombre}`);

                  return (
                    <TableRow key={`${linea.combo.id}-${indice}`}>
                      <TableCell sx={{ borderBottom: 'none', py: 1 }}>
                        <Typography variant="body2">
                          {linea.cantidad}× {linea.combo.nombre}
                        </Typography>

                        {(linea.opcionales.length > 0 || linea.quitados.length > 0) && (
                          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                            {nombreExtras.concat(linea.quitados.map((q) => `sin ${q.nombre}`)).join(', ')}
                          </Typography>
                        )}

                        {linea.notas && (
                          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', fontStyle: 'italic' }}>
                            {linea.notas}
                          </Typography>
                        )}
                      </TableCell>

                      <TableCell align="right" sx={{ borderBottom: 'none', py: 1 }}>
                        <Typography variant="body2">{fCurrency(totalLinea(linea))}</Typography>
                      </TableCell>

                      <TableCell align="right" sx={{ borderBottom: 'none', py: 1, width: 40 }}>
                        <IconButton size="small" onClick={() => quitarDelCarrito(indice)} aria-label="Quitar del pedido">
                          <Iconify icon="mingcute:close-line" width={16} />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Box>

          <Divider />

          <Box sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Subtotal
              </Typography>
              <Typography variant="body2">{fCurrency(subtotal)}</Typography>
            </Box>

            {Number(descuento) > 0 && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  Descuento
                </Typography>
                <Typography variant="body2" color="error">
                  −{fCurrency(Number(descuento))}
                </Typography>
              </Box>
            )}

            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                mb: 2,
                p: 1.5,
                borderRadius: 2,
                bgcolor: (theme) => varAlpha(theme.vars.palette.primary.mainChannel, 0.1),
                border: (theme) => `1px dashed ${varAlpha(theme.vars.palette.primary.mainChannel, 0.4)}`,
              }}
            >
              <Typography variant="subtitle1">Total a pagar</Typography>
              <Typography variant="h4" sx={{ color: 'primary.main' }}>
                {fCurrency(totalConDescuento)}
              </Typography>
            </Box>

            {!puedeVender ? (
              <Alert severity="warning">No tienes permiso para cobrar ventas.</Alert>
            ) : (
              <Button
                variant="contained"
                fullWidth
                size="large"
                disabled={carrito.length === 0}
                onClick={() => {
                  setCobrandoError('');
                  setCobro((previo) => ({ ...previo, abierto: true }));
                }}
                startIcon={<Iconify icon="solar:wallet-money-bold-duotone" />}
              >
                Cobrar y enviar a cocina
              </Button>
            )}
          </Box>
        </>
      )}
    </Card>
  );

  const renderCobroModal = () => (
    <Dialog
      open={cobro.abierto}
      onClose={() => {
        if (!cobrando) setCobro((previo) => ({ ...previo, abierto: false }));
      }}
      fullWidth
      maxWidth="xs"
    >
      <form onSubmit={confirmarCobro}>
        <DialogTitle>Cobrar pedido</DialogTitle>

        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Nombre del cliente (opcional)"
            size="small"
            value={cliente}
            onChange={(e) => setCliente(e.target.value)}
          />

          <TextField
            select
            size="small"
            label="Metodo de pago"
            value={metodoPago}
            onChange={(e) => setMetodoPago(e.target.value)}
          >
            <MenuItem value="efectivo">Efectivo</MenuItem>
            <MenuItem value="tarjeta">Tarjeta</MenuItem>
            <MenuItem value="transferencia">Transferencia</MenuItem>
            <MenuItem value="otro">Otro</MenuItem>
          </TextField>

          <TextField
            label={`Descuento (total ${fCurrency(totalConDescuento)})`}
            size="small"
            type="number"
            inputProps={{ min: 0, step: '0.01' }}
            value={descuento}
            onChange={(e) => setDescuento(e.target.value)}
          />

          {cobrandoError && (
            <Alert severity="error" onClose={() => setCobrandoError('')}>
              {cobrandoError}
            </Alert>
          )}
        </DialogContent>

        <DialogActions>
          <Button color="inherit" disabled={cobrando} onClick={() => setCobro((previo) => ({ ...previo, abierto: false }))}>
            Volver
          </Button>
          <Button type="submit" variant="contained" disabled={cobrando} startIcon={cobrando ? <CircularProgress size={16} color="inherit" /> : null}>
            {cobrando ? 'Cobrando...' : `Cobrar ${fCurrency(totalConDescuento)}`}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );

  const renderResultadoModal = () => {
    const resultado = cobro.resultado;

    return (
      <Dialog open={Boolean(resultado)} onClose={() => setCobro({ abierto: false, resultado: null })} fullWidth maxWidth="xs">
        <DialogContent sx={{ textAlign: 'center', pt: 4 }}>
          <Iconify icon="solar:check-circle-bold" width={56} sx={{ color: 'success.main', mb: 2 }} />

          <Typography variant="h5" sx={{ mb: 0.5 }}>
            ¡Venta {resultado?.codigo}!
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
            Total cobrado: <strong>{fCurrency(resultado?.total ?? 0)}</strong>
          </Typography>

          {resultado?.pedido ? (
            <Alert severity="info" sx={{ mb: 2 }}>
              Pedido {resultado.pedido.codigo} enviado a cocina.
            </Alert>
          ) : (
            <Alert severity="success" sx={{ mb: 2 }}>
              Sin pedidos de cocina (todo al dia).
            </Alert>
          )}

          {resultado && resultado.avisos.length > 0 && (
            <Alert severity="warning" sx={{ mb: 1, textAlign: 'left' }}>
              Stock bajo: {resultado.avisos.join('. ')}
            </Alert>
          )}
        </DialogContent>

        <DialogActions sx={{ justifyContent: 'center', pb: 3 }}>
          <Button variant="contained" onClick={() => setCobro({ abierto: false, resultado: null })}>
            Nuevo pedido
          </Button>
        </DialogActions>
      </Dialog>
    );
  };

  return (
    <DashboardContent maxWidth="xl" disablePadding sx={{ p: { xs: 2, md: 3 } }}>
      {renderCabecera()}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => undefined} action={<Button color="inherit" size="small" onClick={cargarCatalogo}>Reintentar</Button>}>
          {error}
        </Alert>
      )}

      <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2} alignItems="stretch">
        <Box sx={{ flex: 1 }}>{renderMenu()}</Box>
        <Box sx={{ width: { xs: '100%', lg: 400 } }}>{renderCarrito()}</Box>
      </Stack>

      {comboActivo && (
        <ComboModal
          key={comboActivo.id}
          combo={comboActivo}
          alCerrar={() => setComboActivo(null)}
          alConfirmar={agregarAlCarrito}
        />
      )}

      {renderCobroModal()}
      {renderResultadoModal()}
    </DashboardContent>
  );
}