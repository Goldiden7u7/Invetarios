import type { UsuarioTabla, RespuestaUsuarios, RespuestaUsuarioGuardado } from 'src/types/inventario';

import { useState, useEffect, useCallback } from 'react';

import { api, ApiError } from 'src/api/client';

// ----------------------------------------------------------------------

export type UsuarioEntrada = {
  nombre: string;
  email: string;
  rol_id: number;
  telefono?: string;
  password?: string;
  activo?: number;
};

export function useUsuarios() {
  const [usuarios, setUsuarios] = useState<UsuarioTabla[]>([]);
  const [roles, setRoles] = useState<RespuestaUsuarios['roles']>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);

    try {
      const datos = await api.get<RespuestaUsuarios>('usuarios.php');
      setUsuarios(datos.usuarios);
      setRoles(datos.roles);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudo cargar los usuarios.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const guardar = useCallback(
    async (datos: UsuarioEntrada, idUsuario?: number): Promise<RespuestaUsuarioGuardado> => {
      const cuerpo = { ...datos, id: idUsuario ?? undefined };

      const resultado = idUsuario
        ? await api.put<RespuestaUsuarioGuardado>('usuarios.php', cuerpo)
        : await api.post<RespuestaUsuarioGuardado>('usuarios.php', cuerpo);

      await cargar();
      return resultado;
    },
    [cargar]
  );

  /** Desactiva un usuario (el API nunca lo borra fisicamente). */
  const desactivar = useCallback(
    async (idUsuario: number) => {
      await api.delete<{ mensaje: string }>('usuarios.php', { id: idUsuario });
      await cargar();
    },
    [cargar]
  );

  return {
    usuarios,
    roles,
    cargando,
    error,
    cargar,
    guardar,
    desactivar,
  };
}