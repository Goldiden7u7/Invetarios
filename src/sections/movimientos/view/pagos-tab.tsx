import type { CategoriaPago } from 'src/types/inventario';

import { useState } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Skeleton from '@mui/material/Skeleton';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import CircularProgress from '@mui/material/CircularProgress';

import { fDateTime } from 'src/utils/format-time';
import { fNumber, fCurrency } from 'src/utils/format-number';

import { Label } from 'src/components/label';
import { Iconify } from 'src/components/iconify';

import { usePagosServicios } from '../use-pagos-servicios';

// ----------------------------------------------------------------------
//  SUBPESTANA "PAGOS DE SERVICIOS" DENTRO DE Movimientos > Caja
//  Retiros de dinero de la caja para los gastos del negocio. Cuatro botones
//  (trabajadores, transporte, local y servicios); al tocar uno se abre un
//  formulario para describir y retirar el monto. Debajo, el historial.
// ----------------------------------------------------------------------

/** Solo los nombres de icono que existen en el set offline del proyecto. */
type NombreIcono = React.ComponentProps<typeof Iconify>['icon'];

/** Los cuatro rubros de pago, en el mismo orden que el API. */
const RUBROS: {
  categoria: CategoriaPago;
  etiqueta: string;
  icono: NombreIcono;
  color: string;
  ayuda: string;
}[] = [
  {
    categoria: 'trabajadores',
    etiqueta: 'Pago de trabajadores',
    icono: 'solar:users-group-rounded-bold-duotone',
    color: 'var(--mui-palette-primary-main)',
    ayuda: 'Sueldos, jornales y adelantos',
  },
  {
    categoria: 'transporte',
    etiqueta: 'Pago de transporte',
    icono: 'solar:round-transfer-horizontal-bold-duotone',
    color: 'var(--mui-palette-info-main)',
    ayuda: 'Fletes, gasolina y mensajeria',
  },
  {
    categoria: 'local',
    etiqueta: 'Pago del local',
    icono: 'solar:home-smile-bold-duotone',
    color: 'var(--mui-palette-warning-main)',
    ayuda: 'Renta, mantenimiento y gastos del local',
  },
  {
    categoria: 'servicios',
    etiqueta: 'Pago de servicios',
    icono: 'solar:settings-bold-duotone',
    color: 'var(--mui-palette-error-main)',
    ayuda: 'Luz, agua, internet y otros',
  },
];

const COLOR_RUBRO: Record<CategoriaPago, 'primary' | 'info' | 'warning' | 'error'> = {
  trabajadores: 'primary',
  transporte: 'info',
  local: 'warning',
  servicios: 'error',
};

/** Tarjeta de cifra: cifra grande, piechecito que explica de donde sale. */
function TarjetaCifra({
  icono,
  color,
  titulo,
  valor,
  pie,
}: {
  icono: NombreIcono;
  color: string;
  titulo: string;
  valor: number;
  pie: string;
}) {
  return (
    <Card
      sx={{
        p: 2,
        flex: 1,
        minWidth: 190,
        borderLeft: 4,
        borderLeftColor: color,
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
        <Iconify icon={icono} width={20} sx={{ color }} />
        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
          {titulo}
        </Typography>
      </Stack>

      <Typography variant="h5" sx={{ color }}>
        {fCurrency(valor)}
      </Typography>

      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        {pie}
      </Typography>
    </Card>
  );
}

export function PagosTab({ activo }: { activo: boolean }) {
  const {
    pagos,
    resumen,
    paginacion,
    categoriaFiltro,
    setCategoriaFiltro,
    cargando,
    error,
    cargar,
    registrar,
  } = usePagosServicios(activo);

  const [rubroAbierto, setRubroAbierto] = useState<CategoriaPago | null>(null);
  const [monto, setMonto] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [errorForm, setErrorForm] = useState('');
  const [exito, setExito] = useState<string | null>(null);

  const rubroActual = RUBROS.find((r) => r.categoria === rubroAbierto) ?? null;

  const abrirRubro = (categoria: CategoriaPago) => {
    setRubroAbierto(categoria);
    setMonto('');
    setDescripcion('');
    setErrorForm('');
  };

  const enviar = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorForm('');
    setExito(null);

    if (rubroAbierto === null) return;

    const cantidad = Number(monto);
    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      setErrorForm('Escribe un monto mayor que cero.');
      return;
    }
    if (descripcion.trim() === '') {
      setErrorForm('Escribe una descripcion de para que fue el pago.');
      return;
    }

    setEnviando(true);

    try {
      const datos = await registrar({
        categoria: rubroAbierto,
        monto: cantidad,
        descripcion: descripcion.trim(),
      });

      setExito(`${datos.mensaje} (${datos.codigo})`);
      setRubroAbierto(null);
      void cargar(1);
    } catch (e) {
      setErrorForm(e instanceof Error ? e.message : 'No se pudo registrar el pago.');
    } finally {
      setEnviando(false);
    }
  };

  const promedioMes = resumen.mes.pagos > 0 ? resumen.mes.total / resumen.mes.pagos : 0;

  return (
    <Box>
      {/* Lo que sale de la caja */}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3 }}>
        <TarjetaCifra
          icono="solar:dollar-bold-duotone"
          color="var(--mui-palette-error-main)"
          titulo="Retirado hoy"
          valor={resumen.hoy.total}
          pie={`${fNumber(resumen.hoy.pagos)} pago(s) hoy`}
        />

        <TarjetaCifra
          icono="solar:wallet-money-bold-duotone"
          color="var(--mui-palette-warning-main)"
          titulo="Pagado en el mes"
          valor={resumen.mes.total}
          pie={`${fNumber(resumen.mes.pagos)} pago(s) en el mes`}
        />

        <TarjetaCifra
          icono="solar:calendar-mark-bold"
          color="var(--mui-palette-info-main)"
          titulo="Pago promedio"
          valor={promedioMes}
          pie="Promedio de cada retiro del mes"
        />
      </Stack>

      {/* Los cuatro botones para retirar */}
      <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
        Retirar dinero de la caja
      </Typography>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3 }}>
        {RUBROS.map((r) => (
          <Card
            key={r.categoria}
            onClick={() => abrirRubro(r.categoria)}
            sx={{
              p: 2,
              flex: 1,
              minWidth: 170,
              cursor: 'pointer',
              border: '1px dashed',
              borderColor: 'divider',
              transition: 'border-color .2s, box-shadow .2s',
              '&:hover': {
                borderColor: r.color,
                boxShadow: 1,
              },
            }}
          >
            <Stack direction="row" alignItems="center" spacing={1.5}>
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: 1.5,
                  display: 'grid',
                  placeItems: 'center',
                  bgcolor: 'rgba(145, 158, 171, 0.16)',
                  color: r.color,
                }}
              >
                <Iconify icon={r.icono} width={24} />
              </Box>

              <Box sx={{ minWidth: 0 }}>
                <Typography variant="subtitle2">{r.etiqueta}</Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                  {r.ayuda}
                </Typography>
              </Box>
            </Stack>
          </Card>
        ))}
      </Stack>

      {/* Como sale el dinero, por rubro */}
      {resumen.por_categoria.length > 0 && (
        <Card sx={{ p: 2, mb: 3 }}>
          <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
            Como sale el dinero
          </Typography>

          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {resumen.por_categoria.map((fila) => (
              <Chip
                key={fila.categoria}
                icon={<Iconify icon="solar:wallet-money-bold-duotone" />}
                label={`${RUBROS.find((r) => r.categoria === fila.categoria)?.etiqueta ?? fila.categoria}: ${fCurrency(fila.total)} (${fNumber(fila.pagos)} pago(s))`}
                color={COLOR_RUBRO[fila.categoria]}
                variant="outlined"
              />
            ))}
          </Stack>
        </Card>
      )}

      {exito && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setExito(null)}>
          {exito}
        </Alert>
      )}

      {/* Filtro por rubro */}
      <Stack direction="row" spacing={1} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap alignItems="center">
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Rubro:
        </Typography>

        {(['', ...RUBROS.map((r) => r.categoria)] as const).map((opcion) => (
          <Chip
            key={opcion || 'todos'}
            label={opcion || 'Todos'}
            color={categoriaFiltro === opcion ? 'primary' : 'default'}
            variant={categoriaFiltro === opcion ? 'filled' : 'outlined'}
            onClick={() => setCategoriaFiltro(opcion as CategoriaPago | '')}
          />
        ))}

        <Box sx={{ flex: 1 }} />

        <Button
          variant="outlined"
          color="inherit"
          size="small"
          startIcon={<Iconify icon="solar:restart-bold" />}
          onClick={() => cargar(paginacion.pagina)}
          disabled={cargando}
        >
          Actualizar
        </Button>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} action={<Button color="inherit" size="small" onClick={() => cargar(1)}>Reintentar</Button>}>
          {error}
        </Alert>
      )}

      {cargando && pagos.length === 0 ? (
        <Skeleton variant="rounded" height={340} />
      ) : (
        <Card sx={{ overflow: 'hidden' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Pago</TableCell>
                <TableCell>Rubro</TableCell>
                <TableCell>Descripcion</TableCell>
                <TableCell align="right">Monto</TableCell>
                <TableCell>Registrado por</TableCell>
                <TableCell>Fecha</TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {pagos.map((pago) => (
                <TableRow key={pago.id} hover>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {pago.codigo}
                    </Typography>
                  </TableCell>

                  <TableCell>
                    <Label color={COLOR_RUBRO[pago.categoria]} variant="soft">
                      {RUBROS.find((r) => r.categoria === pago.categoria)?.etiqueta ?? pago.categoria}
                    </Label>
                  </TableCell>

                  <TableCell sx={{ maxWidth: 320 }}>
                    <Typography variant="body2" noWrap title={pago.descripcion}>
                      {pago.descripcion}
                    </Typography>
                  </TableCell>

                  <TableCell align="right">
                    <Typography variant="body2" sx={{ fontWeight: 700, color: 'error.main' }}>
                      -{fCurrency(pago.monto)}
                    </Typography>
                  </TableCell>

                  <TableCell>{pago.usuario_nombre}</TableCell>

                  <TableCell>{fDateTime(pago.creado_en)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {pagos.length === 0 && !cargando && (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Iconify icon="solar:dollar-bold-duotone" width={40} sx={{ color: 'text.disabled' }} />
              <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
                Todavia no hay pagos registrados. Toca uno de los cuatro botones de arriba.
              </Typography>
            </Box>
          )}
        </Card>
      )}

      {paginacion.total_paginas > 1 && (
        <Stack direction="row" spacing={1} justifyContent="center" sx={{ mt: 2 }} alignItems="center">
          <Button
            variant="outlined"
            color="inherit"
            size="small"
            disabled={cargando || paginacion.pagina <= 1}
            onClick={() => cargar(paginacion.pagina - 1)}
          >
            Anterior
          </Button>

          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Pagina {paginacion.pagina} de {paginacion.total_paginas} ({paginacion.total} pagos)
          </Typography>

          <Button
            variant="outlined"
            color="inherit"
            size="small"
            disabled={cargando || paginacion.pagina >= paginacion.total_paginas}
            onClick={() => cargar(paginacion.pagina + 1)}
          >
            Siguiente
          </Button>
        </Stack>
      )}

      {/* Formulario de retiro: aparece al tocar uno de los cuatro rubros */}
      <Dialog open={rubroAbierto !== null} onClose={() => setRubroAbierto(null)} fullWidth maxWidth="xs" keepMounted={false}>
        <form onSubmit={enviar}>
          <DialogTitle>{rubroActual ? rubroActual.etiqueta : 'Retirar pago'}</DialogTitle>

          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Monto"
              type="number"
              size="small"
              autoFocus
              inputProps={{ min: 0.01, step: 0.01 }}
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              placeholder="0.00"
            />

            <TextField
              label="Descripcion"
              size="small"
              multiline
              minRows={2}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Por ejemplo: salario de la semana de Juan, flete de mercancia..."
            />

            {errorForm && (
              <Alert severity="error" onClose={() => setErrorForm('')}>
                {errorForm}
              </Alert>
            )}
          </DialogContent>

          <DialogActions>
            <Button color="inherit" disabled={enviando} onClick={() => setRubroAbierto(null)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={enviando}
              startIcon={enviando ? <CircularProgress size={16} color="inherit" /> : null}
            >
              Retirar
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
}