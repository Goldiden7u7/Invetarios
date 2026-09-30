import type { Movimiento , Paginacion, TipoMovimiento, RespuestaGuardado } from 'src/types/inventario';

import { useState, useEffect, useCallback } from 'react';

import { api, ApiError } from 'src/api/client';

// ----------------------------------------------------------------------

export type MovimientoEntrada = {
  producto_id: number;
  almacen_id: number;
  tipo: 'entrada' | 'salida' | 'ajuste';
  cantidad: number;
};

type RespuestaMovimientos = {
  movimientos: Movimiento[];
  resumen: { total_entradas: number; total_salidas: number; total_movimientos: number };
  paginacion: Paginacion;
};

export function useMovimientos() {
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [resumen, setResumen] = useState({ total_entradas: 0, total_salidas: 0, total_movimientos: 0 });
  const [paginacion, setPaginacion] = useState<Paginacion>({ pagina: 1, por_pagina: 25, total: 0, total_paginas: 0 });
  const [tipoFiltro, setTipoFiltro] = useState<TipoMovimiento | ''>('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async (pagina = 1) => {
    setCargando(true);

    try {
      const datos = await api.get<RespuestaMovimientos>('movimientos.php', {
        tipo: tipoFiltro || undefined,
        pagina,
        por_pagina: 25,
      });

      setMovimientos(datos.movimientos);
      setResumen(datos.resumen);
      setPaginacion(datos.paginacion);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudo cargar los movimientos.');
    } finally {
      setCargando(false);
    }
  }, [tipoFiltro]);

  useEffect(() => {
    cargar(1);
  }, [cargar]);

  const registrar = useCallback(async (datos: MovimientoEntrada): Promise<RespuestaGuardado> => {
    const resultado = await api.post<RespuestaGuardado>('movimientos.php', datos);
    await cargar(1);
    return resultado;
  }, [cargar]);

  return {
    movimientos,
    resumen,
    paginacion,
    tipoFiltro,
    setTipoFiltro,
    cargando,
    error,
    cargar,
    registrar,
  };
}