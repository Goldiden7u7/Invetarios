import { CONFIG } from 'src/config-global';

import { UsuariosView } from 'src/sections/usuarios';

// ----------------------------------------------------------------------

export default function Page() {
  return (
    <>
      <title>{`Usuarios - ${CONFIG.appName}`}</title>
      <meta
        name="description"
        content="Gestion de usuarios, roles y permisos del sistema"
      />

      <UsuariosView />
    </>
  );
}