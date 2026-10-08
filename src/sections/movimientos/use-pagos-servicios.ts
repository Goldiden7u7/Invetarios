import type {
  Paginacion,
  PagoServicio,
  ResumenPagos,
  CategoriaPago,
  RespuestaPagos,
  RespuestaPagoCreado,
} from 'src/types/inventario';

import { useState, useEffect, useCallback } from 'react';

import { api, ApiError } from 'src/api/client';

// ----------------------------------------------------------------------
//  PAGOS DE SERVICIOS
//  Lee api/pagos.php: los retiros de la caja para gastos del negocio
//  (trabajadores, transporte, local y servicios). Es la pestana que vive
//  DENTRO de Movimientos > Caja, por eso pide el permiso de ventas (128):
//  solo el administrador y los roles de control ven (y retiran) esa plata.
// ----------------------------------------------------------------------

const RESUMEN_VACIO: ResumenPagos = {
  hoy: { pagos: 0, total: 0 },
  mes: { pagos: 0, total: 0 },
  por_categoria: [],
};

/** Lo que se envia al API al retirar un pago. */
export type PagoEntrada = {
  categoria: CategoriaPago;
  monto: number;
  descripcion: string;
};

export function usePagosServicios(activo: boolean) {
  const [pagos, setPagos] = useState<PagoServicio[]>([]);
  const [resumen, setResumen] = useState(RESUMEN_VACIO);
  const [paginacion, setPaginacion] = useState<Paginacion>({
    pagina: 1,
    por_pagina: 50,
    total: 0,
    total_paginas: 0,
  });
  const [categoriaFiltro, setCategoriaFiltro] = useState<CategoriaPago | ''>('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(
    async (pagina = 1) => {
      setCargando(true);

      try {
        const datos = await api.get<RespuestaPagos>('pagos.php', {
          categoria: categoriaFiltro || undefined,
          pagina,
          por_pagina: 50,
        });

        setPagos(datos.pagos ?? []);
        setResumen(datos.resumen ?? RESUMEN_VACIO);
        setPaginacion(datos.paginacion);
        setError(null);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'No se pudieron cargar los pagos.');
      } finally {
        setCargando(false);
      }
    },
    [categoriaFiltro]
  );

  // Solo se consulta cuando la subpestana Pagos de servicios esta abierta.
  useEffect(() => {
    if (activo) {
      void cargar(1);
    }
  }, [activo, cargar]);

  const registrar = useCallback(async (pago: PagoEntrada) => {
    const datos = await api.post<RespuestaPagoCreado>('pagos.php', pago);
    return datos;
  }, []);

  return {
    pagos,
    resumen,
    paginacion,
    categoriaFiltro,
    setCategoriaFiltro,
    cargando,
    error,
    cargar,
    registrar,
  };
}