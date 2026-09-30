import type { LabelColor } from 'src/components/label';
import type { Producto, Categoria } from 'src/types/inventario';

import { useMemo, useState } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import TablePagination from '@mui/material/TablePagination';

import { fDate } from 'src/utils/format-time';
import { fCurrency } from 'src/utils/format-number';

import { useAuth } from 'src/auth';
import { api } from 'src/api/client';
import { DashboardContent } from 'src/layouts/dashboard';

import { Label } from 'src/components/label';
import { Iconify } from 'src/components/iconify';
import { PageHeader } from 'src/components/page-header/page-header';

import { PERMISO } from 'src/types/inventario';

import { useInventario } from '../use-inventario';
import { ProductoForm, type ProductoFormValores } from './producto-form';

// ----------------------------------------------------------------------

const colorStock = (estado: string): LabelColor =>
  estado === 'agotado' ? 'error' : estado === 'bajo' ? 'warning' : 'success';

/** Color y texto para la fecha de vencimiento de un producto perecedero. */
function vencimientoDe(producto: Producto): { color: LabelColor; texto: string } | null {
  if (!producto.perecedero || !producto.fecha_vencimiento) return null;

  const dias = producto.dias_para_vencer ?? 0;

  if (dias < 0) return { color: 'error', texto: `Vencido ${fDate(producto.fecha_vencimiento)}` };
  if (dias === 0) return { color: 'error', texto: 'Vence hoy' };
  if (dias <= 7) return { color: 'warning', texto: `Vence en ${dias} d (${fDate(producto.fecha_vencimiento)})` };

  return { color: 'success', texto: fDate(producto.fecha_vencimiento) };
}

// ----------------------------------------------------------------------

export function InventarioView() {
  const { puede } = useAuth();
  const puedeEditar = puede(PERMISO.editar);
  const puedeEliminar = puede(PERMISO.eliminar);

  const {
    productos,
    pagina,
    porPagina,
    total,
    totalPaginas,
    cargando,
    error,
    recargando,
    buscar,
    setBuscar,
    estadoFiltro,
    setEstadoFiltro,
    irAPagina,
    recargar,
    guardar,
    eliminar,
  } = useInventario();

  const [formulario, setFormulario] = useState<{
    abierto: boolean;
    producto?: Producto;
  }>({ abierto: false });
  const [borrando, setBorrando] = useState<number | null>(null);
  const [categorias, setCategorias] = useState<Categoria[]>([]);

  const abrirNuevo = () => setFormulario({ abierto: true });
  const abrirEditar = (producto: Producto) => setFormulario({ abierto: true, producto });
  const cerrarFormulario = () => setFormulario({ abierto: false });

  const alGuardar = async (valores: ProductoFormValores) => {
    await guardar(
      {
        codigo: valores.codigo,
        nombre: valores.nombre,
        descripcion: valores.descripcion || undefined,
        categoria_id: valores.categoria_id || null,
        unidad_medida: valores.unidad_medida,
        precio_compra: valores.precio_compra,
        precio_venta: valores.precio_venta,
        stock_minimo: valores.stock_minimo,
        stock_maximo: valores.stock_maximo,
        controla_serial: valores.controla_serial ? 1 : 0,
        perecedero: valores.perecedero ? 1 : 0,
        fecha_vencimiento: valores.fecha_vencimiento || null,
        activo: valores.activo ? 1 : 0,
      },
      formulario.producto?.id
    );
    cerrarFormulario();
  };

  const alEliminar = async (producto: Producto) => {
    setBorrando(producto.id);
    try {
      await eliminar(producto.id);
    } finally {
      setBorrando(null);
    }
  };

  const abrirConCategorias = async () => {
    abrirNuevo();
    if (categorias.length === 0) {
      try {
        const datos = await api.get<Categoria[]>('categorias.php');
        setCategorias(Array.isArray(datos) ? datos : []);
      } catch {
        setCategorias([]);
      }
    }
  };

  // Resumen de stock para el encabezado: el almacenero necesita ver de
  // inmediato si hay agotados o faltantes antes de revisar la tabla.
  const resumen = useMemo(() => {
    const agotados = productos.filter((p) => p.estado_stock === 'agotado').length;
    const bajos = productos.filter((p) => p.estado_stock === 'bajo').length;

    return { agotados, bajos };
  }, [productos]);

  const renderCabecera = () => (
    <PageHeader
      titulo="Inventario"
      descripcion="Productos con su stock, fechas de vencimiento y niveles minimos."
      icono="solar:box-minimalistic-bold-duotone"
      color="info"
      chips={[
        { etiqueta: 'Productos', valor: `${total}` },
        { etiqueta: 'Stock bajo', valor: `${resumen.bajos}`, color: 'warning' },
        { etiqueta: 'Agotados', valor: `${resumen.agotados}`, color: 'error' },
      ]}
      acciones={
        <>
          <Button variant="outlined" color="inherit" startIcon={<Iconify icon="solar:restart-bold" />} onClick={() => recargar(true)} disabled={cargando}>
            Actualizar
          </Button>

          {puedeEditar && (
            <Button variant="contained" color="primary" startIcon={<Iconify icon="mingcute:add-line" />} onClick={abrirConCategorias}>
              Nuevo producto
            </Button>
          )}
        </>
      }
    />
  );

  const renderFiltros = () => (
    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 2 }}>
      <TextField
        size="small"
        placeholder="Buscar por nombre o codigo..."
        value={buscar}
        onChange={(e) => setBuscar(e.target.value)}
        sx={{ width: { md: 340 } }}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <Iconify icon="eva:search-fill" width={20} />
              </InputAdornment>
            ),
          },
        }}
      />

      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        {(['activos', 'todos', 'inactivos'] as const).map((opcion) => (
          <Chip
            key={opcion}
            label={opcion === 'activos' ? 'Activos' : opcion === 'todos' ? 'Todo' : 'Inactivos'}
            color={estadoFiltro === opcion ? 'primary' : 'default'}
            variant={estadoFiltro === opcion ? 'filled' : 'outlined'}
            onClick={() => setEstadoFiltro(opcion)}
          />
        ))}
      </Stack>
    </Stack>
  );

  const renderTabla = () => (
    <Card sx={{ overflow: 'hidden' }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Producto</TableCell>
            <TableCell>Categoria</TableCell>
            <TableCell align="right">Stock</TableCell>
            <TableCell>Vencimiento</TableCell>
            <TableCell align="right">Compra</TableCell>
            <TableCell align="right">Venta</TableCell>
            <TableCell align="right">Acciones</TableCell>
          </TableRow>
        </TableHead>

        <TableBody>
          {productos.map((producto) => {
            const vencimiento = vencimientoDe(producto);

            return (
              <TableRow key={producto.id} hover>
                <TableCell>
                  <Typography variant="body2">{producto.nombre}</Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {producto.codigo} - {producto.unidad_medida}
                  </Typography>
                </TableCell>

                <TableCell>
                  <Typography variant="body2">{producto.categoria ?? '—'}</Typography>
                  {!producto.activo && (
                    <Label color="default" variant="soft" sx={{ mt: 0.5 }}>
                      Inactivo
                    </Label>
                  )}
                </TableCell>

                <TableCell align="right">
                  <Label color={colorStock(producto.estado_stock)} variant="soft">
                    {producto.cantidad_total} {producto.unidad_medida}
                  </Label>
                </TableCell>

                <TableCell>
                  {producto.perecedero ? (
                    <Label color={vencimiento?.color ?? 'success'} variant="soft">
                      {vencimiento?.texto ?? 'Sin fecha'}
                    </Label>
                  ) : (
                    <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                      No perecedero
                    </Typography>
                  )}
                </TableCell>

                <TableCell align="right">{fCurrency(producto.precio_compra)}</TableCell>
                <TableCell align="right">{fCurrency(producto.precio_venta)}</TableCell>

                <TableCell align="right">
                  {puedeEditar && (
                    <IconButton size="small" onClick={() => abrirEditar(producto)} aria-label={`Editar ${producto.nombre}`}>
                      <Iconify icon="solar:pen-bold" width={18} />
                    </IconButton>
                  )}

                  {puedeEliminar && (
                    <IconButton
                      size="small"
                      color="error"
                      disabled={borrando === producto.id}
                      onClick={() => alEliminar(producto)}
                      aria-label={`Eliminar ${producto.nombre}`}
                    >
                      <Iconify icon="solar:trash-bin-trash-bold" width={18} />
                    </IconButton>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {productos.length === 0 && !cargando && (
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Ningun producto coincide con la busqueda.
          </Typography>
        </Box>
      )}

      <TablePagination
        component="div"
        count={total}
        page={Math.min(pagina - 1, Math.max(totalPaginas - 1, 0))}
        rowsPerPage={porPagina}
        rowsPerPageOptions={[porPagina]}
        onPageChange={(_, paginaNueva) => irAPagina(paginaNueva + 1)}
        labelRowsPerPage="Filas"
      />
    </Card>
  );

  const renderCargando = () => (
    <>
      <Skeleton variant="rounded" height={36} sx={{ mb: 2 }} />
      <Skeleton variant="rounded" height={380} />
    </>
  );

  const renderContenido = () => {
    if (cargando && productos.length === 0) return renderCargando();

    return (
      <>
        {recargando && (
          <Box sx={{ mb: 2 }}>
            <Alert severity="info">Actualizando inventario...</Alert>
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} action={<Button color="inherit" size="small" onClick={() => recargar()}>Reintentar</Button>}>
            {error}
          </Alert>
        )}

        {renderTabla()}
      </>
    );
  };

  const estadoStockItems = useMemo(() => {
    const conteo = { normal: 0, bajo: 0, agotado: 0 };
    productos.forEach((p) => {
      conteo[p.estado_stock] = (conteo[p.estado_stock] ?? 0) + 1;
    });
    return conteo;
  }, [productos]);

  return (
    <DashboardContent maxWidth="xl">
      {renderCabecera()}

      {(estadoStockItems.bajo > 0 || estadoStockItems.agotado > 0) && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {estadoStockItems.agotado > 0 && `${estadoStockItems.agotado} agotados. `}
          {estadoStockItems.bajo > 0 && `${estadoStockItems.bajo} por debajo del minimo. `}
          Programa reposiciones.
        </Alert>
      )}

      {renderFiltros()}
      {renderContenido()}

      <ProductoForm
        key={formulario.producto?.id ?? 'nuevo'}
        abierto={formulario.abierto}
        producto={formulario.producto}
        categorias={categorias}
        alCerrar={cerrarFormulario}
        alGuardar={alGuardar}
      />
    </DashboardContent>
  );
}