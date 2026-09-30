import type { Transferencia, RespuestaGuardado } from 'src/types/inventario';

import { useState, useEffect, useCallback } from 'react';

import { api, ApiError } from 'src/api/client';

// ----------------------------------------------------------------------

export type TransferenciaEntrada = {
  producto_id: number;
  almacen_origen_id: number;
  almacen_destino_id: number;
  cantidad: number;
  notas?: string;
};

export function useTransferencias() {
  const [transferencias, setTransferencias] = useState<Transferencia[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actuando, setActuando] = useState<number | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);

    try {
      const datos = await api.get<Transferencia[]>('transferencias.php');
      setTransferencias(Array.isArray(datos) ? datos : []);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudo cargar las transferencias.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const crear = useCallback(
    async (datos: TransferenciaEntrada): Promise<RespuestaGuardado> => {
      const resultado = await api.post<RespuestaGuardado & { codigo?: string }>('transferencias.php', datos);
      await cargar();
      return resultado;
    },
    [cargar]
  );

  /** Recibe o cancela una transferencia en transito. */
  const accionar = useCallback(
    async (id: number, accion: 'recibir' | 'cancelar') => {
      setActuando(id);

      try {
        const resultado = await api.post<{ mensaje: string }>('transferencias.php', { id, accion });
        await cargar();
        return resultado;
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'No se pudo actualizar la transferencia.');
        return null;
      } finally {
        setActuando(null);
      }
    },
    [cargar]
  );

  return {
    transferencias,
    cargando,
    error,
    actuando,
    cargar,
    crear,
    accionar,
  };
}