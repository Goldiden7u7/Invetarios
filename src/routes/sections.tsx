import type { RouteObject } from 'react-router';

import { lazy, Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { varAlpha } from 'minimal-shared/utils';

import Box from '@mui/material/Box';
import LinearProgress, { linearProgressClasses } from '@mui/material/LinearProgress';

import { ProtectedRoute } from 'src/routes/components';

import { AuthLayout } from 'src/layouts/auth';
import { DashboardLayout } from 'src/layouts/dashboard';

// ----------------------------------------------------------------------

export const DashboardPage = lazy(() => import('src/pages/dashboard'));
export const SignInPage = lazy(() => import('src/pages/sign-in'));
export const Page404 = lazy(() => import('src/pages/page-not-found'));
export const CajaPage = lazy(() => import('src/pages/caja'));
export const CocinaPage = lazy(() => import('src/pages/cocina'));
export const InventarioPage = lazy(() => import('src/pages/inventario'));
export const MovimientosPage = lazy(() => import('src/pages/movimientos'));
export const TransferenciasPage = lazy(() => import('src/pages/transferencias'));
export const AlmacenesPage = lazy(() => import('src/pages/almacenes'));
export const CategoriasPage = lazy(() => import('src/pages/categorias'));
export const UsuariosPage = lazy(() => import('src/pages/usuarios'));

const renderFallback = () => (
  <Box
    sx={{
      display: 'flex',
      flex: '1 1 auto',
      alignItems: 'center',
      justifyContent: 'center',
    }}
  >
    <LinearProgress
      sx={{
        width: 1,
        maxWidth: 320,
        bgcolor: (theme) => varAlpha(theme.vars.palette.text.primaryChannel, 0.16),
        [`& .${linearProgressClasses.bar}`]: { bgcolor: 'text.primary' },
      }}
    />
  </Box>
);

// ----------------------------------------------------------------------

export const routesSection: RouteObject[] = [
  {
    element: (
      // El guard envuelve TODO el layout: sin sesion no se dibuja ni el
      // menu, para que no se vea un instante la estructura del sistema.
      <ProtectedRoute>
        <DashboardLayout>
          <Suspense fallback={renderFallback()}>
            <Outlet />
          </Suspense>
        </DashboardLayout>
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'caja', element: <CajaPage /> },
      { path: 'cocina', element: <CocinaPage /> },
      { path: 'inventario', element: <InventarioPage /> },
      { path: 'movimientos', element: <MovimientosPage /> },
      { path: 'transferencias', element: <TransferenciasPage /> },
      { path: 'almacenes', element: <AlmacenesPage /> },
      { path: 'categorias', element: <CategoriasPage /> },
      { path: 'usuarios', element: <UsuariosPage /> },
    ],
  },
  {
    path: 'sign-in',
    element: (
      <AuthLayout>
        <SignInPage />
      </AuthLayout>
    ),
  },
  {
    path: '404',
    element: <Page404 />,
  },
  { path: '*', element: <Page404 /> },
];
