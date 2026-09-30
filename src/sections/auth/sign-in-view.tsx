import { useState, useCallback } from 'react';
import { useSearchParams } from 'react-router';

import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import { keyframes } from '@mui/material/styles';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import InputAdornment from '@mui/material/InputAdornment';
import CircularProgress from '@mui/material/CircularProgress';

import { useRouter } from 'src/routes/hooks';

import { useAuth } from 'src/auth';
import { ApiError } from 'src/api/client';

import { Iconify, type IconifyName } from 'src/components/iconify';

// ----------------------------------------------------------------------

const entrar = keyframes`
  from { opacity: 0; transform: translateY(18px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
`;

const flotar = keyframes`
  from { transform: translateY(0) rotate(-4deg); }
  to { transform: translateY(-14px) rotate(4deg); }
`;

const latido = keyframes`
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.06); }
`;

const FLOATES: { icono: IconifyName; top: string; left?: string; right?: string; delay: string; color: string }[] = [
  { icono: 'solar:chef-hat-bold-duotone', top: '8%', left: '-6%', delay: '0s', color: '#FFAB00' },
  { icono: 'solar:cart-3-bold', top: '58%', left: '-12%', delay: '0.8s', color: '#2E90FA' },
  { icono: 'solar:box-minimalistic-bold-duotone', top: '26%', right: '-10%', delay: '1.6s', color: '#00A76F' },
  { icono: 'solar:wallet-money-bold-duotone', top: '72%', right: '-6%', delay: '2.4s', color: '#8E33FF' },
];

// ----------------------------------------------------------------------

export function SignInView() {
  const { iniciarSesion } = useAuth();

  const router = useRouter();
  const [params] = useSearchParams();

  const [verClave, setVerClave] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // A donde queria ir antes de que le pedimos la clave.
  const destino = params.get('next') || '/';

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (enviando) return;

      setError('');
      setEnviando(true);

      try {
        await iniciarSesion(email.trim(), password);
        router.replace(destino);
      } catch (e) {
        // El mensaje del servidor esta en espanol y es util ("Correo o
        // contrasena incorrectos"). Si es un fallo de red, mostramos
        // el texto generico del cliente.
        setError(
          e instanceof ApiError ? e.message : 'Ocurrio un error inesperado. Intentalo otra vez.'
        );
        setEnviando(false);
      }
    },
    [email, password, destino, enviando, iniciarSesion, router]
  );

  const renderDecoracion = (
    <Box
      sx={{
        position: 'relative',
        width: '100%',
        height: 120,
        borderRadius: 2,
        mb: 3,
        overflow: 'hidden',
        background: (theme) => `linear-gradient(135deg, ${theme.vars.palette.primary.dark}, ${theme.vars.palette.primary.main} 55%, ${theme.vars.palette.secondary.main})`,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: 'primary.contrastText',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 56,
            height: 56,
            borderRadius: '50%',
            mb: 1,
            background: 'rgba(255,255,255,0.22)',
            animation: `${latido} 2.4s ease-in-out infinite`,
          }}
        >
          <Iconify icon="solar:chef-hat-bold-duotone" width={32} />
        </Box>

        <Typography variant="h5" sx={{ color: 'inherit', fontWeight: 'fontWeightBold' }}>
          Cafeteria
        </Typography>

        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.85)' }}>
          Inventario · Caja · Cocina
        </Typography>
      </Box>

      {FLOATES.map((flotante) => (
        <Box
          key={flotante.icono}
          sx={{
            position: 'absolute',
            top: flotante.top,
            left: flotante.left,
            right: flotante.right,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 44,
            height: 44,
            borderRadius: 2,
            color: flotante.color,
            background: 'rgba(255,255,255,0.92)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.16)',
            animation: `${flotar} 3.2s ease-in-out ${flotante.delay} infinite alternate`,
          }}
        >
          <Iconify icon={flotante.icono} width={24} />
        </Box>
      ))}
    </Box>
  );

  const renderForm = (
    <Box
      component="form"
      onSubmit={handleSubmit}
      sx={{ display: 'flex', flexDirection: 'column', width: '100%' }}
    >
      <TextField
        fullWidth
        name="email"
        label="Correo electronico"
        type="email"
        autoComplete="username"
        autoFocus
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={enviando}
        sx={{ mb: 2 }}
        slotProps={{
          inputLabel: { shrink: true },
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <Iconify icon="solar:letter-bold-duotone" width={20} />
              </InputAdornment>
            ),
          },
        }}
      />

      <TextField
        fullWidth
        name="password"
        label="Contrasena"
        type={verClave ? 'text' : 'password'}
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        disabled={enviando}
        slotProps={{
          inputLabel: { shrink: true },
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <Iconify icon="solar:shield-keyhole-bold-duotone" width={20} />
              </InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  onClick={() => setVerClave(!verClave)}
                  edge="end"
                  aria-label={verClave ? 'Ocultar contrasena' : 'Mostrar contrasena'}
                >
                  <Iconify icon={verClave ? 'solar:eye-bold' : 'solar:eye-closed-bold'} />
                </IconButton>
              </InputAdornment>
            ),
          },
        }}
        sx={{ mb: 2.5 }}
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Button
        fullWidth
        size="large"
        type="submit"
        variant="contained"
        disabled={enviando || !email || !password}
        startIcon={enviando ? <CircularProgress color="inherit" size={18} /> : <Iconify icon="solar:wallet-money-bold-duotone" width={20} />}
        sx={{
          py: 1.4,
          borderRadius: 2,
          background: (theme) => `linear-gradient(90deg, ${theme.vars.palette.primary.main}, ${theme.vars.palette.secondary.main})`,
        }}
      >
        {enviando ? 'Entrando...' : 'Entrar al sistema'}
      </Button>
    </Box>
  );

  return (
    <Box
      sx={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        animation: `${entrar} 0.55s cubic-bezier(0.22, 1, 0.36, 1)`,
      }}
    >
      {renderDecoracion}

      <Typography variant="h6" sx={{ mb: 0.5 }}>
        Bienvenido de nuevo
      </Typography>

      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
        Inicia sesion para operar caja, cocina e inventario.
      </Typography>

      {renderForm}

      <Typography variant="body2" sx={{ mt: 3, textAlign: 'center', color: 'text.secondary' }}>
        ¿Primer ingreso?{' '}
        <Link variant="subtitle2" href="/">
          contacta al administrador
        </Link>{' '}
        para que te cree un usuario.
      </Typography>
    </Box>
  );
}