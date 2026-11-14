/**
 * Centralized FAVMO Design Token System
 * Monochrome luxury streetwear: pure black, pure white, neutral grays only.
 */
export const FAVMO_TOKENS = {
  colors: {
    black: '#000000',
    obsidian: '#0A0A0A',
    charcoal: '#171717',
    graphite: '#262626',
    neutralDark: '#404040',
    neutralMuted: '#737373',
    neutralLight: '#A3A3A3',
    hairlineDark: '#262626',
    hairlineLight: '#E5E5E5',
    surfaceOffWhite: '#F5F5F5',
    white: '#FFFFFF',
  },
  typography: {
    enDisplay: '"Archivo", "Plus Jakarta Sans", sans-serif',
    enBody: '"Plus Jakarta Sans", sans-serif',
    arBody: '"IBM Plex Sans Arabic", "Tajawal", sans-serif',
    arDisplay: '"Noto Kufi Arabic", "IBM Plex Sans Arabic", sans-serif',
    mono: '"IBM Plex Mono", monospace',
    weights: {
      regular: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    arabicBodyLineHeight: 1.75,
  },
  spacing: {
    containerMax: '1440px',
    sectionY: 'clamp(4rem, 8vw, 7.5rem)',
    gutter: 'clamp(1.25rem, 3vw, 2.5rem)',
  },
  borders: {
    hairline: '1px solid',
    radiusNone: '0px',
    radiusSubtle: '2px',
  },
  shadows: {
    none: 'none',
    drawer: '0 24px 64px rgba(0, 0, 0, 0.24)',
  },
  motion: {
    fastMs: 180,
    baseMs: 320,
    slowMs: 520,
    easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
  },
} as const;
