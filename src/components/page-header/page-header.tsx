import type { ReactNode } from 'react';
import type { IconifyName } from 'src/components/iconify';
import type { Theme, SxProps } from '@mui/material/styles';

import { varAlpha } from 'minimal-shared/utils';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

export type PageHeaderColor = 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info';

export type PageHeaderProps = {
  titulo: string;
  descripcion?: string;
  /** Icono grande del encabezado. Es lo que da identidad a cada pantalla. */
  icono?: IconifyName;
  color?: PageHeaderColor;
  /** Acciones a la derecha (botones, selects, filtros). */
  acciones?: ReactNode;
  /** Chips de informacion rapida bajo el titulo. */
  chips?: { etiqueta: string; valor: string; color?: PageHeaderColor }[];
  sx?: SxProps<Theme>;
};

// ----------------------------------------------------------------------

/**
 * Encabezado de pagina.
 *
 * Antes cada pantalla hacia su propio titulo en texto plano sobre fondo
 * blanco y todas se veian igual. Esto le da a cada seccion un color y un
 * icono propio, asi el usuario sabe de un vistazo donde esta.
 */
export function PageHeader({
  titulo,
  descripcion,
  icono,
  color = 'primary',
  acciones,
  chips,
  sx,
}: PageHeaderProps) {
  return (
    <Card
      sx={[
        {
          mb: 3,
          p: { xs: 2, md: 2.5 },
          overflow: 'hidden',
          // Franja de color a la izquierda + halo suave: marca la pantalla
          // sin gastar una linea entera de espacio.
          borderLeft: 5,
          borderLeftColor: (theme) => theme.vars.palette[color].main,
          backgroundImage: (theme) =>
            `linear-gradient(100deg, ${varAlpha(theme.vars.palette[color].mainChannel, 0.12)}, transparent 55%)`,
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        alignItems={{ md: 'center' }}
        justifyContent="space-between"
        spacing={2}
      >
        <Stack direction="row" spacing={1.75} alignItems="center" sx={{ minWidth: 0 }}>
          {icono && (
            <Box
              sx={{
                width: 52,
                height: 52,
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
                borderRadius: 2.5,
                color: (theme) => theme.vars.palette[color].main,
                bgcolor: (theme) => varAlpha(theme.vars.palette[color].mainChannel, 0.16),
                border: (theme) => `1px solid ${varAlpha(theme.vars.palette[color].mainChannel, 0.24)}`,
              }}
            >
              <Iconify icon={icono} width={28} />
            </Box>
          )}

          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h4" sx={{ mb: 0.25 }}>
              {titulo}
            </Typography>

            {descripcion && (
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {descripcion}
              </Typography>
            )}
          </Box>
        </Stack>

        {acciones && (
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            {acciones}
          </Stack>
        )}
      </Stack>

      {chips && chips.length > 0 && (
        <Stack direction="row" spacing={1} sx={{ mt: 2, flexWrap: 'wrap', gap: 1 }}>
          {chips.map((chip) => (
            <Box
              key={chip.etiqueta}
              sx={{
                px: 1.5,
                py: 0.75,
                borderRadius: 2,
                bgcolor: 'background.paper',
                border: (theme) => `1px solid ${theme.vars.palette.divider}`,
                minWidth: 96,
              }}
            >
              <Typography
                variant="caption"
                sx={{ display: 'block', color: 'text.secondary', lineHeight: 1.2 }}
              >
                {chip.etiqueta}
              </Typography>

              <Typography
                variant="subtitle2"
                sx={{
                  color: chip.color
                    ? (theme) => theme.vars.palette[chip.color as PageHeaderColor].main
                    : 'text.primary',
                }}
              >
                {chip.valor}
              </Typography>
            </Box>
          ))}
        </Stack>
      )}
    </Card>
  );
}
