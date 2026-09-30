/**
 * CLIENTE HTTP DEL API
 * -----------------------------------------------------------------
 * Una sola puerta de entrada hacia la API PHP. Todas las pantallas pasan
 * por aqui, asi el sobre { ok, datos, error } se maneja en un unico sitio.
 *
 * IMPORTANTE - sesion:
 *   La API autentica con una cookie de sesion PHP (no con token). Por eso
 *   todas las peticiones llevan `credentials: 'include'`. En desarrollo el
 *   proxy de Vite hace que el API y la app compartan origen; en produccion
 *   viven en el mismo hosting, asi que el codigo es el mismo.
 */

// ----------------------------------------------------------------------

/** Origen del API. Relativa a proposito: el proxy /api de Vite la resuelve. */
const BASE = '/api';

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

// ----------------------------------------------------------------------
//  Sesion expirada
// ----------------------------------------------------------------------

/**
 * Cuando el API responde 401 (sesion caida o caducada) hay que devolver al
 * usuario al login. El cliente no sabe de auth, asi que avisa por callback y
 * es el AuthProvider quien decide (redirigir, mostrar aviso, etc).
 */
type Escucha401 = () => void;

let escucha401: Escucha401 | null = null;

export function alExpirarSesion(fn: Escucha401) {
  escucha401 = fn;
}

// ----------------------------------------------------------------------
//  Peticiones
// ----------------------------------------------------------------------

type Sobres<T> = {
  ok: boolean;
  datos?: T;
  error?: string;
  detalle?: string;
};

type Opciones = {
  metodo?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  cuerpo?: unknown;
  params?: Record<string, string | number | boolean | undefined | null>;
};

/** Arma la URL final con el query string, omitiendo parametros vacios. */
function armarUrl(ruta: string, params?: Opciones['params']) {
  const url = `${BASE}/${ruta.replace(/^\//, '')}`;

  if (!params) return url;

  const query = Object.entries(params)
    .filter(([, valor]) => valor !== undefined && valor !== null && valor !== '')
    .map(([clave, valor]) => `${encodeURIComponent(clave)}=${encodeURIComponent(String(valor))}`)
    .join('&');

  return query ? `${url}?${query}` : url;
}

async function peticion<T>(ruta: string, opciones: Opciones = {}): Promise<T> {
  const { metodo = 'GET', cuerpo, params } = opciones;

  let respuesta: Response;

  try {
    respuesta = await fetch(armarUrl(ruta, params), {
      method: metodo,
      // Imprescindible para que viaje la cookie de sesion.
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
  } catch {
    // fetch solo falla asi cuando no hay red o el servidor esta caido.
    throw new ApiError('No se pudo conectar con el servidor. Revisa tu conexion.', 0);
  }

  // Una respuesta que no es JSON casi siempre significa que PHP imprimio
  // un aviso dentro del cuerpo. Lo decimos claro para no depurar a ciegas.
  const texto = await respuesta.text();

  let sobre: Sobres<T>;

  try {
    sobre = JSON.parse(texto) as Sobres<T>;
  } catch {
    throw new ApiError(
      `El servidor devolvio una respuesta ilegible (HTTP ${respuesta.status}).`,
      respuesta.status
    );
  }

  if (respuesta.status === 401) {
    escucha401?.();
    throw new ApiError(sobre.error || 'Tu sesion expiro. Vuelve a entrar.', 401);
  }

  if (!respuesta.ok || sobre.ok === false) {
    throw new ApiError(sobre.error || `Error ${respuesta.status}`, respuesta.status);
  }

  return sobre.datos as T;
}

// ----------------------------------------------------------------------

export const api = {
  get: <T>(ruta: string, params?: Opciones['params']) => peticion<T>(ruta, { params }),
  post: <T>(ruta: string, cuerpo?: unknown) => peticion<T>(ruta, { metodo: 'POST', cuerpo }),
  put: <T>(ruta: string, cuerpo?: unknown) => peticion<T>(ruta, { metodo: 'PUT', cuerpo }),
  delete: <T>(ruta: string, cuerpo?: unknown) => peticion<T>(ruta, { metodo: 'DELETE', cuerpo }),
};
