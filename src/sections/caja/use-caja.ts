import type {
  Combo,
  Almacen,
  DetalleCombo,
  RespuestaCombos,
  ItemVentaEntrada,
  RespuestaCrearVenta,
} from 'src/types/inventario';

import { useState, useEffect, useCallback } from 'react';

import { api, ApiError } from 'src/api/client';

// ----------------------------------------------------------------------

export type OpcionalLinea = {
  producto_id: number;
  nombre: string;
  cantidad: number;
  precio_extra: number;
};

export type QuitadoLinea = {
  producto_id: number;
  nombre: string;
  cantidad: number;
};

export type LineaCarrito = {
  combo: DetalleCombo;
  cantidad: number;
  opcionales: OpcionalLinea[];
  quitados: QuitadoLinea[];
  notas: string;
};

export type Personalizacion = {
  cantidad: number;
  opcionales: OpcionalLinea[];
  quitados: QuitadoLinea[];
  notas: string;
};

export type FiltroTipo = 'todos' | 'comida' | 'snack' | 'bebida';

// ----------------------------------------------------------------------

export function useCaja() {
  const [combos, setCombos] = useState<Combo[]>([]);
  const [almacenes, setAlmacenes] = useState<Almacen[]>([]);
  const [almacenId, setAlmacenId] = useState<number>(1);
  const [tipoFiltro, setTipoFiltro] = useState<FiltroTipo>('todos');
  const [comboActivo, setComboActivo] = useState<DetalleCombo | null>(null);
  const [carrito, setCarrito] = useState<LineaCarrito[]>([]);
  const [cargando, setCargando] = useState(true);
  const [cobrando, setCobrando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargarCatalogo = useCallback(async () => {
    setCargando(true);
    setError(null);

    try {
      const [datosCombos, datosAlmacenes] = await Promise.all([
        api.get<RespuestaCombos>('combos.php', { estado: 'activos' }),
        api.get<Almacen[]>('almacenes.php'),
      ]);

      setCombos(datosCombos.combos);
      setAlmacenes(Array.isArray(datosAlmacenes) ? datosAlmacenes : []);
      setAlmacenId((previo) => ((previo && Array.isArray(datosAlmacenes) && datosAlmacenes.length > 0) ? previo : 1));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudo cargar el menu.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarCatalogo();
  }, [cargarCatalogo]);

  /** Abre el detalle (con receta) de un combo para personalizarlo. */
  const abrirCombo = useCallback(async (combo: Combo) => {
    setError(null);

    try {
      const detalle = await api.get<DetalleCombo>('combos.php', { id: combo.id });
      setComboActivo(detalle);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudo cargar el combo.');
    }
  }, []);

  const agregarAlCarrito = useCallback((personalizacion: Personalizacion, combo: DetalleCombo) => {
    setCarrito((previo) => [
      ...previo,
      {
        combo,
        cantidad: personalizacion.cantidad,
        opcionales: personalizacion.opcionales,
        quitados: personalizacion.quitados,
        notas: personalizacion.notas,
      },
    ]);
    setComboActivo(null);
  }, []);

  const quitarDelCarrito = useCallback((indice: number) => {
    setCarrito((previo) => previo.filter((_, i) => i !== indice));
  }, []);

  const limpiarCarrito = useCallback(() => setCarrito([]), []);

  /** Total de una linea: (precio + extras) por cantidad. */
  const totalLinea = useCallback((linea: LineaCarrito) => {
    const extras = linea.opcionales.reduce((suma, opcional) => suma + opcional.precio_extra * opcional.cantidad, 0);
    return (linea.combo.precio_venta + extras) * linea.cantidad;
  }, []);

  const subtotal = carrito.reduce((suma, linea) => suma + totalLinea(linea), 0);

  /** Manda la venta completa (cobra + genera los pedidos de cocina). */
  const cobrar = useCallback(
    async (clienteNombre: string, metodoPago: string, descuento: number): Promise<RespuestaCrearVenta> => {
      if (carrito.length === 0) {
        throw new ApiError('El carrito esta vacio. Agrega al menos un item.', 0);
      }

      if (almacenId <= 0) {
        throw new ApiError('Indica el almacen desde donde vendes.', 0);
      }

      setCobrando(true);
      setError(null);

      const items: ItemVentaEntrada[] = carrito.map((linea) => ({
        combo_id: linea.combo.id,
        cantidad: linea.cantidad,
        opcionales: linea.opcionales.map((o) => ({ producto_id: o.producto_id, cantidad: o.cantidad })),
        quitados: linea.quitados.map((q) => ({ producto_id: q.producto_id, cantidad: q.cantidad })),
        notas: linea.notas || undefined,
      }));

      try {
        const respuesta = await api.post<RespuestaCrearVenta>('ventas.php', {
          almacen_id: almacenId,
          cliente_nombre: clienteNombre || null,
          metodo_pago: metodoPago,
          descuento,
          items,
        });

        setCarrito([]);
        return respuesta;
      } finally {
        setCobrando(false);
      }
    },
    [carrito, almacenId]
  );

  return {
    combos,
    almacenes,
    almacenId,
    setAlmacenId,
    tipoFiltro,
    setTipoFiltro,
    comboActivo,
    setComboActivo,
    carrito,
    cargando,
    cobrando,
    error,
    cargarCatalogo,
    abrirCombo,
    agregarAlCarrito,
    quitarDelCarrito,
    limpiarCarrito,
    totalLinea,
    subtotal,
    cobrar,
  };
}