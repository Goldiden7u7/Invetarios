import type { Dashboard } from 'src/types/inventario';

import { useState, useEffect, useCallback } from 'react';

import { api, ApiError } from 'src/api/client';

// ----------------------------------------------------------------------

type Estado = {
  datos: Dashboard | null;
  cargando: boolean;
  error: string | null;
};

/**
 * Carga el resumen del dashboard.
 *
 * Se usa `cargando` para el primer render y `recargar` para el boton de
 * "actualizar": recargar no debe dejar la pantalla en blanco.
 */
export function useDashboard() {
  const [estado, setEstado] = useState<Estado>({
    datos: null,
    cargando: true,
    error: null,
  });

  const cargar = useCallback(async (inicial: boolean) => {
    setEstado((previo) => ({
      ...previo,
      // Al recargar mantenemos los datos viejos visibles mientras llegan.
      cargando: inicial,
      error: null,
    }));

    try {
      const datos = await api.get<Dashboard>('dashboard.php');
      setEstado({ datos, cargando: false, error: null });
    } catch (e) {
      setEstado((previo) => ({
        datos: previo.datos,
        cargando: false,
        error: e instanceof ApiError ? e.message : 'No se pudo cargar el resumen.',
      }));
    }
  }, []);

  useEffect(() => {
    cargar(true);
  }, [cargar]);

  const recargar = useCallback(() => {
    cargar(false);
  }, [cargar]);

  return { ...estado, recargar };
}
