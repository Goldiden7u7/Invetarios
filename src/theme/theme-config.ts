import type { CommonColors } from '@mui/material/styles';

import type { ThemeCssVariables } from './types';
import type { PaletteColorNoChannels } from './core/palette';

// ----------------------------------------------------------------------

type ThemeConfig = {
  classesPrefix: string;
  cssVariables: ThemeCssVariables;
  fontFamily: Record<'primary' | 'secondary', string>;
  palette: Record<
    'primary' | 'secondary' | 'info' | 'success' | 'warning' | 'error',
    PaletteColorNoChannels
  > & {
    common: Pick<CommonColors, 'black' | 'white'>;
    grey: Record<
      '50' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900',
      string
    >;
  };
};

export const themeConfig: ThemeConfig = {
  /** **************************************
   * Base
   *************************************** */
  classesPrefix: 'minimal',
  /** **************************************
   * Typography
   *************************************** */
  fontFamily: {
    primary: 'DM Sans Variable',
    secondary: 'Barlow',
  },
  /** **************************************
   * Palette
   *
   * Paleta calida de cafeteria: naranja tostado como color principal
   * (energia, appetite, barra) y neutros con toque calido para que la
   * aplicacion no se vea toda blanca y fria.
   *************************************** */
  palette: {
    primary: {
      lighter: '#FFE8D1',
      light: '#FDBA74',
      main: '#EA6A1B',
      dark: '#C2410C',
      darker: '#7C2D12',
      contrastText: '#FFFFFF',
    },
    secondary: {
      lighter: '#F3E8FF',
      light: '#D8B4FE',
      main: '#8B5CF6',
      dark: '#6D28D9',
      darker: '#3B1E7A',
      contrastText: '#FFFFFF',
    },
    info: {
      lighter: '#D6F4FF',
      light: '#7DD3FC',
      main: '#0EA5E9',
      dark: '#0369A1',
      darker: '#075985',
      contrastText: '#FFFFFF',
    },
    success: {
      lighter: '#D3FCD2',
      light: '#77ED8B',
      main: '#15A34A',
      dark: '#15803D',
      darker: '#14532D',
      contrastText: '#FFFFFF',
    },
    warning: {
      lighter: '#FEF0C7',
      light: '#FDE047',
      main: '#EAB308',
      dark: '#A16207',
      darker: '#713F12',
      contrastText: '#422006',
    },
    error: {
      lighter: '#FFE4E6',
      light: '#FDA4AF',
      main: '#E11D48',
      dark: '#BE123C',
      darker: '#881337',
      contrastText: '#FFFFFF',
    },
    grey: {
      '50': '#FDFAF7',
      '100': '#F8F3EE',
      '200': '#EFE7DE',
      '300': '#DFD3C6',
      '400': '#C4B4A3',
      '500': '#9A8978',
      '600': '#77675A',
      '700': '#5B4E45',
      '800': '#3A322C',
      '900': '#241F1B',
    },
    common: { black: '#1A1512', white: '#FFFFFF' },
  },
  /** **************************************
   * Css variables
   *************************************** */
  cssVariables: {
    cssVarPrefix: '',
    colorSchemeSelector: 'data-color-scheme',
  },
};
