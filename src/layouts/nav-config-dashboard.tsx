import type { ReactNode } from 'react';
import type { IconifyName } from 'src/components/iconify';

import { Iconify } from 'src/components/iconify';

import { PERMISO } from 'src/types/inventario';

// ----------------------------------------------------------------------

export type NavItem = {
  title: string;
  path: string;
  icon: ReactNode;
  info?: ReactNode;
  /**
   * Permisos (flags de bits) necesarios para VER esta seccion.
   *
   * El menu no es solo estetico: esconde lo que el usuario no puede usar.
   * El backend igual lo rechaza con 403, pero una opcion visible que
   * siempre falla frustra mas que no verla.
   *
   * Ojo: esto oculta el menu, NO protege la ruta. La proteccion real la
   * hace el API en cada llamada.
   */
  permiso?: number;
};

// ----------------------------------------------------------------------

/** Iconos del set solar (empaquetados offline en icon-sets.ts). */
const icon = (nombre: IconifyName) => <Iconify width={24} icon={nombre} />;

export const navData: NavItem[] = [
  {
    title: 'Resumen',
    path: '/',
    icon: icon('solar:home-smile-bold-duotone'),
    // Las cifras de ventas son del administrador: quien cobra o cocina no
    // las necesita y el menu se lo esconde.
    permiso: PERMISO.ventas,
  },
  {
    title: 'Caja',
    path: '/caja',
    icon: icon('solar:wallet-money-bold-duotone'),
    // Necesita los dos bits: poder crear ventas Y estar en el modulo Caja.
    // eslint-disable-next-line no-bitwise -- los permisos SON banderas de bits
    permiso: PERMISO.crear | PERMISO.caja,
  },
  {
    title: 'Cocina',
    path: '/cocina',
    icon: icon('solar:chef-hat-bold-duotone'),
    permiso: PERMISO.cocina,
  },
  {
    title: 'Inventario',
    path: '/inventario',
    icon: icon('solar:box-minimalistic-bold-duotone'),
  },
  {
    title: 'Movimientos',
    path: '/movimientos',
    icon: icon('solar:transfer-vertical-bold-duotone'),
    permiso: PERMISO.movimientos,
  },
  {
    title: 'Transferencias',
    path: '/transferencias',
    icon: icon('solar:round-transfer-horizontal-bold-duotone'),
    permiso: PERMISO.movimientos,
  },
  {
    title: 'Almacenes',
    path: '/almacenes',
    icon: icon('solar:home-2-bold-duotone'),
    permiso: PERMISO.editar,
  },
  {
    title: 'Categorias',
    path: '/categorias',
    icon: icon('solar:layers-bold-duotone'),
    permiso: PERMISO.editar,
  },
  {
    title: 'Usuarios',
    path: '/usuarios',
    icon: icon('solar:users-group-rounded-bold-duotone'),
    permiso: PERMISO.usuarios,
  },
];

/** Filtra el menu segun lo que el usuario puede hacer de verdad. */
export function navVisible(permisos: number) {
  // eslint-disable-next-line no-bitwise -- los permisos SON banderas de bits
  return navData.filter((item) => !item.permiso || (permisos & item.permiso) === item.permiso);
}