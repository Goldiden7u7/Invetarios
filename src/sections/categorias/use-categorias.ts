import type { Categoria, RespuestaGuardado } from 'src/types/inventario';

import { useState, useEffect, useCallback } from 'react';

import { api, ApiError } from 'src/api/client';

// ----------------------------------------------------------------------

export type CategoriaEntrada = {
  nombre: string;
  descripcion?: string;
  color?: string;
  activo?: number;
};

export function useCategorias() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);

    try {
      const datos = await api.get<Categoria[]>('categorias.php');
      setCategorias(Array.isArray(datos) ? datos : []);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudo cargar las categorias.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const guardar = useCallback(
    async (datos: CategoriaEntrada, idCategoria?: number): Promise<RespuestaGuardado> => {
      const cuerpo = { ...datos, id: idCategoria ?? undefined };

      const resultado = idCategoria
        ? await api.put<RespuestaGuardado>('categorias.php', cuerpo)
        : await api.post<RespuestaGuardado>('categorias.php', cuerpo);

      await cargar();
      return resultado;
    },
    [cargar]
  );

  const eliminar = useCallback(
    async (idCategoria: number) => {
      await api.delete<{ mensaje: string }>('categorias.php', { id: idCategoria });
      await cargar();
    },
    [cargar]
  );

  return {
    categorias,
    cargando,
    error,
    cargar,
    guardar,
    eliminar,
  };
}