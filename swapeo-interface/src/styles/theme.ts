export const theme = {
  colors: {
    matrix: {
      primary: '#4CAF50',
      secondary: '#2E7D32',
      accent: '#81C784',
      glow: 'rgba(76, 175, 80, 0.3)',
    },
    background: {
      dark: 'rgba(0, 0, 0, 0.9)',
      card: 'rgba(18, 24, 33, 0.8)',
      overlay: 'rgba(0, 255, 0, 0.05)',
    },
    text: {
      primary: '#4CAF50',
      secondary: 'rgba(76, 175, 80, 0.8)',
      muted: 'rgba(76, 175, 80, 0.5)',
    },
    border: 'rgba(76, 175, 80, 0.3)',
    status: {
      success: '#4CAF50',
      warning: '#FFA000',
      error: '#F44336',
    }
  },
  effects: {
    glow: '0 0 15px rgba(76, 175, 80, 0.2)',
    glassMorphism: 'backdrop-filter: blur(10px)',
    matrixRain: 'linear-gradient(180deg, #4CAF50 0%, transparent 100%)',
  },
  animation: {
    slow: '0.3s ease',
    medium: '0.2s ease',
    fast: '0.1s ease',
  },
  shadows: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)'
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px'
  },
  borderRadius: {
    sm: '4px',
    md: '8px',
    lg: '12px',
    xl: '16px',
    full: '9999px'
  },
  typography: {
    fontFamily: {
      sans: 'Inter, system-ui, -apple-system, sans-serif',
      mono: 'JetBrains Mono, monospace'
    },
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      md: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem'
    }
  }
} as const; 