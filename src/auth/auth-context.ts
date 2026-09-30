import type { Usuario } from 'src/types/inventario';

import { useContext, createContext } from 'react';

// ----------------------------------------------------------------------

export type AuthContextValue = {
  /** Usuario de la sesion actual, o null si no hay sesion. */
  usuario: Usuario | null;
  /** true mientras comprobamos con el servidor si la sesion sigue viva. */
  cargando: boolean;
  iniciarSesion: (email: string, password: string) => Promise<void>;
  cerrarSesion: () => Promise<void>;
  /** true si el usuario tiene TODOS los permisos indicados. */
  puede: (...bits: number[]) => boolean;
};

// ----------------------------------------------------------------------

export const AuthContext = createContext<AuthContextValue | null>(null);

// ----------------------------------------------------------------------

/**
 * Acceso al contexto de sesion.
 *
 * Se tira un error si se usa fuera del provider: eso casi siempre es un
 * forgot de envolver un componente, y es mejor que devuelva undefined y
 * reviente mas lejos y mas dificil de entender.
 */
export function useAuth() {
  const contexto = useContext(AuthContext);

  if (!contexto) {
    throw new Error('useAuth() debe usarse dentro de <AuthProvider>');
  }

  return contexto;
}
