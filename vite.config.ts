import path from 'path';
import checker from 'vite-plugin-checker';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

// ----------------------------------------------------------------------

const PORT = 3039;

// ----------------------------------------------------------------------
//  API PHP
// ----------------------------------------------------------------------
//  En desarrollo el frontend (localhost:3039) y la API (127.0.0.1:8080)
//  estan en puertos distintos. Eso obligaria a CORS, y una cookie de sesion
//  con SameSite=Lax NO viaja en peticiones cross-origin: la sesion se
//  perderia en cada llamada.
//
//  La solucion es el proxy: /api/productos.php se reenvia a
//  http://127.0.0.1:8080/productos.php. El navegador ve un unico origen,
//  la cookie viaja sola y el codigo de la app es IDENTICO al de
//  produccion (donde todo vive en el mismo hosting).

const API_LOCAL = process.env.API_URL || 'http://127.0.0.1:8080';

export default defineConfig({
  plugins: [
    react(),
    checker({
      typescript: true,
      eslint: {
        useFlatConfig: true,
        lintCommand: 'eslint "./src/**/*.{js,jsx,ts,tsx}"',
        dev: { logLevel: ['error'] },
      },
      overlay: {
        position: 'tl',
        initialIsOpen: false,
      },
    }),
  ],
  resolve: {
    alias: [
      {
        find: /^src(.+)/,
        replacement: path.resolve(process.cwd(), 'src/$1'),
      },
    ],
  },
  server: {
    port: PORT,
    host: true,
    proxy: {
      '/api': {
        target: API_LOCAL,
        changeOrigin: true,
        // Quitamos el prefijo /api: en el servidor la ruta real es /productos.php
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  preview: { port: PORT, host: true },
});
