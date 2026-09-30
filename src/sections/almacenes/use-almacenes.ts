import type { Almacen, RespuestaGuardado } from 'src/types/inventario';

import { useState, useEffect, useCallback } from 'react';

import { api, ApiError } from 'src/api/client';

// ----------------------------------------------------------------------

export type AlmacenEntrada = {
  codigo: string;
  nombre: string;
  descripcion?: string;
  direccion?: string;
  responsable?: string;
  activo?: number;
};

export function useAlmacenes() {
  const [almacenes, setAlmacenes] = useState<Almacen[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);

    try {
      const datos = await api.get<Almacen[]>('almacenes.php');
      setAlmacenes(Array.isArray(datos) ? datos : []);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudo cargar los almacenes.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const guardar = useCallback(
    async (datos: AlmacenEntrada, idAlmacen?: number): Promise<RespuestaGuardado> => {
      const cuerpo = { ...datos, id: idAlmacen ?? undefined };

      const resultado = idAlmacen
        ? await api.put<RespuestaGuardado>('almacenes.php', cuerpo)
        : await api.post<RespuestaGuardado>('almacenes.php', cuerpo);

      await cargar();
      return resultado;
    },
    [cargar]
  );

  const eliminar = useCallback(
    async (idAlmacen: number) => {
      await api.delete<{ mensaje: string }>('almacenes.php', { id: idAlmacen });
      await cargar();
    },
    [cargar]
  );

  return {
    almacenes,
    cargando,
    error,
    cargar,
    guardar,
    eliminar,
  };
}