import type { Producto, RespuestaGuardado, RespuestaProductos } from 'src/types/inventario';

import { useState, useEffect, useCallback } from 'react';

import { api, ApiError } from 'src/api/client';

// ----------------------------------------------------------------------

export type ProductoEntrada = {
  codigo: string;
  nombre: string;
  descripcion?: string;
  categoria_id?: number | null;
  unidad_medida: string;
  precio_compra: number;
  precio_venta: number;
  stock_minimo?: number;
  stock_maximo?: number;
  controla_serial?: number;
  perecedero?: number;
  fecha_vencimiento?: string | null;
  activo?: number;
};

type Estado = {
  productos: Producto[];
  pagina: number;
  porPagina: number;
  total: number;
  totalPaginas: number;
  cargando: boolean;
  error: string | null;
};

const POR_PAGINA = 10;

export function useInventario() {
  const [estado, setEstado] = useState<Estado>({
    productos: [],
    pagina: 1,
    porPagina: POR_PAGINA,
    total: 0,
    totalPaginas: 0,
    cargando: true,
    error: null,
  });

  const [buscar, setBuscar] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState<'activos' | 'inactivos' | 'todos'>('activos');
  const [recargando, setRecargando] = useState(false);

  const cargar = useCallback(async (nuevaPagina: number, termino: string, filtro: string) => {
    setEstado((previo) => ({ ...previo, cargando: true, error: null }));

    try {
      const datos = await api.get<RespuestaProductos>('productos.php', {
        buscar: termino,
        estado: filtro,
        pagina: nuevaPagina,
        por_pagina: POR_PAGINA,
      });

      setEstado({
        productos: datos.productos,
        pagina: nuevaPagina,
        porPagina: POR_PAGINA,
        total: datos.paginacion.total,
        totalPaginas: datos.paginacion.total_paginas,
        cargando: false,
        error: null,
      });
    } catch (e) {
      setEstado((previo) => ({
        ...previo,
        cargando: false,
        error: e instanceof ApiError ? e.message : 'No se pudo cargar el inventario.',
      }));
    }
  }, []);

  // Busqueda con debounce ligero
  useEffect(() => {
    const timer = window.setTimeout(() => {
      cargar(1, buscar, estadoFiltro);
    }, 350);

    return () => window.clearTimeout(timer);
  }, [buscar, estadoFiltro, cargar]);

  const irAPagina = useCallback(
    (pagina: number) => {
      cargar(pagina, buscar, estadoFiltro);
    },
    [buscar, estadoFiltro, cargar]
  );

  const recargar = useCallback(
    (mientrasCarga = false) => {
      setRecargando(mientrasCarga);
      cargar(estado.pagina, buscar, estadoFiltro).finally(() => setRecargando(false));
    },
    [buscar, estadoFiltro, estado.pagina, cargar]
  );

  const guardar = useCallback(
    async (datos: ProductoEntrada, idProducto?: number): Promise<RespuestaGuardado> => {
      const cuerpo = { ...datos, id: idProducto ?? undefined };
      const resultado = idProducto
        ? await api.put<RespuestaGuardado>('productos.php', cuerpo)
        : await api.post<RespuestaGuardado>('productos.php', cuerpo);

      await cargar(estado.pagina, buscar, estadoFiltro);
      return resultado;
    },
    [estado.pagina, buscar, estadoFiltro, cargar]
  );

  const eliminar = useCallback(
    async (idProducto: number) => {
      await api.delete<{ mensaje: string }>('productos.php', { id: idProducto });
      await cargar(estado.pagina, buscar, estadoFiltro);
    },
    [estado.pagina, buscar, estadoFiltro, cargar]
  );

  return {
    ...estado,
    buscar,
    setBuscar,
    estadoFiltro,
    setEstadoFiltro,
    irAPagina,
    recargar,
    recargando,
    guardar,
    eliminar,
  };
}