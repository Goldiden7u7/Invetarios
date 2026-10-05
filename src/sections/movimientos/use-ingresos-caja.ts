import type {
  MetodoPago,
  Paginacion,
  IngresoCaja,
  ResumenCaja,
  RespuestaCaja,
} from 'src/types/inventario';

import { useState, useEffect, useCallback } from 'react';

import { api, ApiError } from 'src/api/client';

// ----------------------------------------------------------------------
//  INGRESOS DE CAJA
//  Lee la segunda vista de api/movimientos.php: ?vista=caja. Cada fila es
//  una venta cerrada (el dinero que entro), no un movimiento de stock.
//  Pide el permiso de ventas (128), por eso solo el administrador y los
//  roles de control ven esta pestana.
// ----------------------------------------------------------------------

const RESUMEN_VACIO: ResumenCaja = {
  hoy: { ventas: 0, total: 0, ganancia: 0, efectivo: 0 },
  mes: { ventas: 0, total: 0, ganancia: 0, efectivo: 0 },
  por_metodo: [],
};

export function useIngresosCaja(activo: boolean) {
  const [ingresos, setIngresos] = useState<IngresoCaja[]>([]);
  const [resumen, setResumen] = useState(RESUMEN_VACIO);
  const [paginacion, setPaginacion] = useState<Paginacion>({
    pagina: 1,
    por_pagina: 50,
    total: 0,
    total_paginas: 0,
  });
  const [metodoFiltro, setMetodoFiltro] = useState<MetodoPago | ''>('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(
    async (pagina = 1) => {
      setCargando(true);

      try {
        const datos = await api.get<RespuestaCaja>('movimientos.php', {
          vista: 'caja',
          metodo_pago: metodoFiltro || undefined,
          pagina,
          por_pagina: 50,
        });

        setIngresos(datos.ingresos ?? []);
        setResumen(datos.resumen ?? RESUMEN_VACIO);
        setPaginacion(datos.paginacion);
        setError(null);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'No se pudieron cargar los ingresos de caja.');
      } finally {
        setCargando(false);
      }
    },
    [metodoFiltro]
  );

  // Solo se consulta cuando la pestana Caja esta abierta: asi el
  // administrador no espera por datos que todavia no va a mirar.
  useEffect(() => {
    if (activo) {
      void cargar(1);
    }
  }, [activo, cargar]);

  return {
    ingresos,
    resumen,
    paginacion,
    metodoFiltro,
    setMetodoFiltro,
    cargando,
    error,
    cargar,
  };
}