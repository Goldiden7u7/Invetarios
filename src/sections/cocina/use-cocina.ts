import { useState, useEffect, useCallback } from 'react';

import { api, ApiError } from 'src/api/client';

import { type Pedido, type EstadoPedido, type RespuestaPedidos } from 'src/types/inventario';

// ----------------------------------------------------------------------

export function useCocina() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [moviendo, setMoviendo] = useState<number | null>(null);

  const cargar = useCallback(async () => {
    try {
      const datos = await api.get<RespuestaPedidos>('pedidos.php');

      // El listado ya incluye los items de cada pedido (con los
      // ingredientes que eligio el cliente) y la espera en minutos.
      setPedidos(datos.pedidos);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudo cargar la cola de cocina.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  /** Cambia el estado de un pedido (pendiente -> en_preparacion -> listo -> entregado). */
  const avanzar = useCallback(
    async (id: number, estado: EstadoPedido) => {
      setMoviendo(id);

      try {
        await api.post<{ id: number; estado: EstadoPedido }>('pedidos.php', { id, estado });
        await cargar();
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'No se pudo actualizar el pedido.');
      } finally {
        setMoviendo(null);
      }
    },
    [cargar]
  );

  const recargar = useCallback(() => {
    setCargando(true);
    cargar();
  }, [cargar]);

  return {
    pedidos,
    cargando,
    error,
    moviendo,
    recargar,
    avanzar,
  };
}