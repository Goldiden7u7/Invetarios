import { useState } from 'react';
import { varAlpha } from 'minimal-shared/utils';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Collapse from '@mui/material/Collapse';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';

import { fToNow, fDateTime } from 'src/utils/format-time';

import { useAuth } from 'src/auth';
import { DashboardContent } from 'src/layouts/dashboard';

import { Label } from 'src/components/label';
import { Iconify, type IconifyName } from 'src/components/iconify';
import { PageHeader } from 'src/components/page-header/page-header';

import { PERMISO, type Pedido, type EstadoPedido } from 'src/types/inventario';

import { useCocina } from '../use-cocina';
import { ingredientesAPreparar } from '../receta';

// ----------------------------------------------------------------------

/** Colores de paleta (para pintar acentos), no colores del componente Label. */
type ColorEstado = 'primary' | 'info' | 'warning' | 'success';

const COLUMNAS: { estado: EstadoPedido; titulo: string; color: ColorEstado }[] = [
  { estado: 'pendiente', titulo: 'Pendientes', color: 'info' },
  { estado: 'en_preparacion', titulo: 'En preparacion', color: 'warning' },
  { estado: 'listo', titulo: 'Listos', color: 'success' },
];

const ACCION: Record<string, { estado: EstadoPedido; etiqueta: string; icono: IconifyName }> = {
  pendiente: { estado: 'en_preparacion', etiqueta: 'Empezar', icono: 'eva:arrow-ios-forward-fill' },
  en_preparacion: { estado: 'listo', etiqueta: 'Listo', icono: 'eva:checkmark-fill' },
  listo: { estado: 'entregado', etiqueta: 'Entregar', icono: 'eva:done-all-fill' },
};

/** Color de la barra lateral de cada tarjeta segun su estado. */
const ESTADO_COLOR: Record<string, ColorEstado> = {
  pendiente: 'info',
  en_preparacion: 'warning',
  listo: 'success',
};

const colorEstado = (estado: EstadoPedido): ColorEstado => ESTADO_COLOR[estado] ?? 'primary';

// ----------------------------------------------------------------------

export function CocinaView() {
  const { puede } = useAuth();
  const puedeMover = puede(PERMISO.crear);

  const { pedidos, cargando, error, moviendo, recargar, avanzar } = useCocina();

  /** Ids de pedidos ampliados (el cocinero abre los que necesita ver). */
  const [abiertos, setAbiertos] = useState<number[]>([]);

  const alternar = (id: number) =>
    setAbiertos((previos) =>
      previos.includes(id) ? previos.filter((x) => x !== id) : [...previos, id]
    );

  const deColumna = (estado: EstadoPedido) =>
    pedidos
      .filter((p) => p.estado === estado)
      .sort((a, b) => a.creado_en.localeCompare(b.creado_en));

  // Totales por columna: los muestra el encabezado para que el cocinero
  // sepa de un vistazo cuantos pedidos lleva, sin recorrer las columnas.
  const pendientes = pedidos.filter((p) => p.estado === 'pendiente').length;
  const preparando = pedidos.filter((p) => p.estado === 'en_preparacion').length;
  const listos = pedidos.filter((p) => p.estado === 'listo').length;

  const renderPedido = (pedido: Pedido) => {
    const accion = ACCION[pedido.estado];
    const abierto = abiertos.includes(pedido.id);
    const items = pedido.items ?? [];
    const color = colorEstado(pedido.estado);
    const esperando = pedido.espera_minutos ?? 0;

    return (
      <Card
        key={pedido.id}
        onClick={() => alternar(pedido.id)}
        sx={{
          p: 2,
          mb: 2,
          cursor: 'pointer',
          overflow: 'visible',
          borderLeft: 4,
          borderLeftColor: (theme) => theme.vars.palette[color].main,
          transition: 'transform 160ms ease, box-shadow 160ms ease',
          '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 8px 20px rgba(16,24,40,0.10)' },
          ...(abierto && { boxShadow: '0 12px 28px rgba(16,24,40,0.14)' }),
        }}
      >
        {/* Encabezado */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              {pedido.codigo}
            </Typography>

            <Label color={esperando > 15 ? 'error' : esperando > 5 ? 'warning' : 'default'} variant="soft">
              {esperando} min
            </Label>
          </Box>

          <Typography variant="caption" sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}>
            {fToNow(pedido.creado_en)}
          </Typography>
        </Box>

        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
          {pedido.cliente_nombre || 'Mostrador'} · {pedido.n_items}{' '}
          {pedido.n_items === 1 ? 'item' : 'items'}
        </Typography>

        {/* Resumen compacto */}
        <Stack direction="row" spacing={0.5} sx={{ mt: 1.5, flexWrap: 'wrap', gap: 0.5, mb: 1.5 }}>
          {items.map((item) => (
            <Chip
              key={item.id}
              size="small"
              variant="outlined"
              label={`${item.cantidad}x ${item.nombre}`}
              sx={{ borderColor: (theme) => theme.vars.palette.divider }}
            />
          ))}
        </Stack>

        <Divider />

        {/* Detalle ampliado */}
        <Collapse in={abierto} unmountOnExit>
          <Box sx={{ pt: 1.5 }}>
            {items.map((item) => {
              const preparar = ingredientesAPreparar(item);
              const noPreparar = item.quitados ?? [];

              return (
                <Box
                  key={item.id}
                  sx={{
                    p: 1.5,
                    mb: 1.5,
                    borderRadius: 1.5,
                    bgcolor: (theme) => varAlpha(theme.vars.palette.background.neutralChannel, 0.5),
                  }}
                >
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    {item.cantidad}x {item.nombre}
                  </Typography>

                  <Typography
                    variant="caption"
                    sx={{ color: 'success.main', fontWeight: 700, display: 'block', mb: 0.5 }}
                  >
                    PREPARAR
                  </Typography>

                  {preparar.length === 0 ? (
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      Sin ingredientes pendientes.
                    </Typography>
                  ) : (
                    <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                      {preparar.map((i) => (
                        <Chip
                          key={i.producto_id}
                          size="small"
                          color="success"
                          variant="outlined"
                          label={`${i.cantidad} ${i.nombre} (${i.unidad_medida})`}
                        />
                      ))}
                    </Stack>
                  )}

                  {noPreparar.length > 0 && (
                    <>
                      <Typography
                        variant="caption"
                        sx={{ color: 'error.main', fontWeight: 700, display: 'block', mt: 1.5, mb: 0.5 }}
                      >
                        NO PREPARAR (el cliente lo quito)
                      </Typography>

                      <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                        {noPreparar.map((q) => (
                          <Chip
                            key={q.producto_id}
                            size="small"
                            color="error"
                            variant="outlined"
                            label={q.nombre ?? `Producto ${q.producto_id}`}
                            icon={<Iconify icon="mingcute:close-line" width={14} />}
                          />
                        ))}
                      </Stack>
                    </>
                  )}
                </Box>
              );
            })}

            {pedido.notas && (
              <Alert severity="info" variant="outlined" sx={{ mb: 1.5 }}>
                {pedido.notas}
              </Alert>
            )}

            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
              Recibido {fDateTime(pedido.creado_en)} · {pedido.usuario_nombre}
            </Typography>
          </Box>
        </Collapse>

        {/* Acciones */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1.5, gap: 1 }}>
          <Typography
            variant="caption"
            sx={{ color: 'text.disabled', display: 'flex', alignItems: 'center', gap: 0.5 }}
          >
            <Iconify
              icon={abierto ? 'eva:arrow-ios-upward-fill' : 'eva:arrow-ios-downward-fill'}
              width={14}
            />
            {abierto ? 'Ocultar detalle' : 'Ver detalle'}
          </Typography>

          {puedeMover && accion ? (
            <Button
              variant="contained"
              color={pedido.estado === 'listo' ? 'success' : pedido.estado === 'en_preparacion' ? 'warning' : 'primary'}
              size="small"
              disabled={moviendo === pedido.id}
              startIcon={
                moviendo === pedido.id ? <CircularProgress size={14} color="inherit" /> : <Iconify icon={accion.icono} />
              }
              onClick={(evento) => {
                evento.stopPropagation();
                avanzar(pedido.id, accion.estado);
              }}
            >
              {accion.etiqueta}
            </Button>
          ) : (
            !puedeMover && (
              <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                Solo lectura.
              </Typography>
            )
          )}
        </Box>
      </Card>
    );
  };

  return (
    <DashboardContent maxWidth="xl">
      <PageHeader
        titulo="Cocina"
        descripcion="Toca un pedido para ver que preparar. El cliente ya eligio sus ingredientes."
        icono="solar:chef-hat-bold-duotone"
        color="warning"
        chips={[
          { etiqueta: 'Pendientes', valor: `${pendientes}`, color: 'info' },
          { etiqueta: 'En preparacion', valor: `${preparando}`, color: 'warning' },
          { etiqueta: 'Listos', valor: `${listos}`, color: 'success' },
        ]}
        acciones={
          <Button
            variant="outlined"
            color="inherit"
            startIcon={<Iconify icon="solar:restart-bold" />}
            onClick={recargar}
            disabled={cargando}
          >
            Actualizar
          </Button>
        }
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} action={<Button color="inherit" size="small" onClick={recargar}>Reintentar</Button>}>
          {error}
        </Alert>
      )}

      {cargando && pedidos.length === 0 ? (
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} variant="rounded" height={420} sx={{ flex: 1 }} />
          ))}
        </Stack>
      ) : (
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="stretch">
          {COLUMNAS.map((columna) => {
            const lista = deColumna(columna.estado);

            return (
              <Box key={columna.estado} sx={{ flex: 1, minWidth: 0 }}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    mb: 1.5,
                    p: 1,
                    px: 1.5,
                    borderRadius: 2,
                    bgcolor: (theme) => varAlpha(theme.vars.palette[columna.color].lightChannel, 0.35),
                  }}
                >
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                    {columna.titulo}
                  </Typography>
                  <Label color={columna.color} variant="filled">
                    {lista.length}
                  </Label>
                </Box>

                {lista.length === 0 ? (
                  <Card sx={{ p: 3, textAlign: 'center', opacity: 0.6 }}>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      Sin pedidos
                    </Typography>
                  </Card>
                ) : (
                  <Box>{lista.map(renderPedido)}</Box>
                )}
              </Box>
            );
          })}
        </Stack>
      )}
    </DashboardContent>
  );
}
