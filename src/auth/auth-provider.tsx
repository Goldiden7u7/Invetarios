import type { ReactNode } from 'react';
import type { Usuario } from 'src/types/inventario';

import { useMemo, useState, useEffect, useCallback } from 'react';

import { api, alExpirarSesion } from 'src/api/client';

import { tienePermiso } from 'src/types/inventario';

import { AuthContext } from './auth-context';

import type { AuthContextValue } from './auth-context';

// ----------------------------------------------------------------------

type AuthProviderProps = {
  children: ReactNode;
};

export function AuthProvider({ children }: AuthProviderProps) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [cargando, setCargando] = useState(true);

  /**
   * Al abrir la app (o recargar con F5) la cookie de sesion sigue ahi, pero
   * el React no lo sabe. Preguntamos al servidor quien somos.
   *
   * Mientras esta la consulta, `cargando` vale true: el guard de rutas usa
   * esa bandera para NO expulsar al usuario antes de tiempo.
   */
  useEffect(() => {
    let vigente = true;

    (async () => {
      try {
        const respuesta = await api.get<{ usuario: Usuario | null }>('auth/yo.php');
        if (vigente) setUsuario(respuesta.usuario);
      } catch {
        // Sin sesion es lo normal al entrar por primera vez, no es un fallo.
        if (vigente) setUsuario(null);
      } finally {
        if (vigente) setCargando(false);
      }
    })();

    return () => {
      vigente = false;
    };
  }, []);

  /**
   * El cliente HTTP nos avisa cuando cualquier peticion vuelve un 401.
   * Aqui soltamos la sesion para que el guard redirija al login.
   */
  useEffect(() => {
    alExpirarSesion(() => setUsuario(null));
  }, []);

  const iniciarSesion = useCallback(async (email: string, password: string) => {
    const datos = await api.post<Usuario>('auth/login.php', { email, password });
    setUsuario(datos);
  }, []);

  const cerrarSesion = useCallback(async () => {
    try {
      await api.post('auth/logout.php');
    } finally {
      // Aunque el servidor falle, en el navegador la sesion se acaba igual:
      // es mejor desloguear de mas que dejar entrar a un usuario cerrando.
      setUsuario(null);
    }
  }, []);

  const puede = useCallback(
    (...bits: number[]) => (usuario ? tienePermiso(usuario.permisos, ...bits) : false),
    [usuario]
  );

  const valor = useMemo<AuthContextValue>(
    () => ({ usuario, cargando, iniciarSesion, cerrarSesion, puede }),
    [usuario, cargando, iniciarSesion, cerrarSesion, puede]
  );

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}
