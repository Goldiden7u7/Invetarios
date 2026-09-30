import { useEffect } from 'react';

import { useRouter } from 'src/routes/hooks';

import { useAuth } from 'src/auth';
import { CONFIG } from 'src/config-global';

import { SignInView } from 'src/sections/auth';

// ----------------------------------------------------------------------

export default function Page() {
  const { usuario, cargando } = useAuth();

  const router = useRouter();

  // Si ya hay sesion, el login no tiene sentido: de vuelta al panel.
  useEffect(() => {
    if (!cargando && usuario) {
      router.replace('/');
    }
  }, [cargando, usuario, router]);

  return (
    <>
      <title>{`Entrar - ${CONFIG.appName}`}</title>

      <SignInView />
    </>
  );
}
