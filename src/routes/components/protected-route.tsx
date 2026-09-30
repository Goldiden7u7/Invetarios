import type { ReactNode } from 'react';

import { useEffect } from 'react';

import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';

import { useRouter, usePathname } from 'src/routes/hooks';

import { useAuth } from 'src/auth';

// ----------------------------------------------------------------------

type ProtectedRouteProps = {
  children: ReactNode;
};

/**
 * Puerta de entrada del sistema.
 *
 * - Mientras se comprueba la sesion no decidimos nada (mostramos un spinner).
 *   Si redirigieras aqui, al abrir la app con F5 expulsarias al usuario
 *   al login unos 200ms antes de que el servidor conteste.
 * - Sin sesion -> al login, guardando a donde queria ir.
 * - Con sesion -> contenido.
 */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { usuario, cargando } = useAuth();

  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!cargando && !usuario) {
      router.replace(`/sign-in?next=${encodeURIComponent(pathname)}`);
    }
  }, [cargando, usuario, pathname, router]);

  if (cargando) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  // Sin sesion mostramos el spinner (no el contenido) mientras redirige.
  if (!usuario) {
    return null;
  }

  return <>{children}</>;
}
