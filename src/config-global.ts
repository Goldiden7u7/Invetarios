import packageJson from '../package.json';

// ----------------------------------------------------------------------

export type ConfigValue = {
  appName: string;
  appVersion: string;
  /**
   * Formato de numeros y dinero.
   *
   * El backend trabaja en America/Caracas (ver api/config.php), asi que la
   * app debe mostrar los importes igual. Cambiar la moneda es cosa de UNA
   * linea aqui, no de revisar cada pantalla.
   */
  locale: string;
  currency: string;
  /** Zona horaria para "hoy" y "ayer" en los graficos. */
  timeZone: string;
};

export const CONFIG: ConfigValue = {
  appName: 'Inventario Cafeteria',
  appVersion: packageJson.version,
  locale: 'es-VE',
  currency: 'VES',
  timeZone: 'America/Caracas',
};
