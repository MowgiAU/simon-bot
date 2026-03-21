/**
 * Theme configuration for Fuji Studio Dashboard
 * Design system: "Glass Midnight" — ultra-dark glassmorphism with vibrant teal accents
 */

export const colors = {
  // Primary — Vibrant Teal
  primary: '#10B981',
  primaryLight: '#34D399',
  primaryDark: '#059669',
  
  // Secondary — Cool Slate
  secondary: '#475569',
  secondaryLight: '#64748B',
  secondaryDark: '#334155',
  
  // Accent — Electric Cyan
  accent: '#06B6D4',
  accentLight: '#22D3EE',
  accentDark: '#0891B2',
  
  // Highlight — Warm Amber
  highlight: '#F59E0B',
  highlightLight: '#FBBF24',
  highlightDark: '#D97706',
  
  // Tertiary — Soft Rose (for errors/warnings)
  tertiary: '#F43F5E',
  tertiaryLight: '#FB7185',
  tertiaryDark: '#E11D48',
  
  // Neutrals — True dark with blue undertone
  background: '#0B0F19',
  surface: '#111827',
  surfaceLight: '#1F2937',
  border: '#1E293B',
  
  // Glass effect surfaces
  cardBg: 'rgba(17, 24, 39, 0.7)',
  glass: 'rgba(255, 255, 255, 0.03)',
  glassBorder: 'rgba(255, 255, 255, 0.06)',
  sidebarBg: '#0F1420',
  headerBg: '#0F1420',
  
  // Text — Higher contrast hierarchy
  textPrimary: '#F8FAFC',
  textSecondary: '#94A3B8',
  textTertiary: '#64748B',
  
  // Status
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',
};

export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '20px',
  xxl: '24px',
  '3xl': '32px',
};

export const typography = {
  fontFamily: "'Inter', 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  
  h1: {
    fontSize: '28px',
    fontWeight: 700,
    lineHeight: 1.2,
    letterSpacing: '-0.02em',
  },
  
  h2: {
    fontSize: '20px',
    fontWeight: 600,
    lineHeight: 1.3,
    letterSpacing: '-0.01em',
  },
  
  h3: {
    fontSize: '16px',
    fontWeight: 600,
    lineHeight: 1.4,
  },
  
  body: {
    fontSize: '14px',
    fontWeight: 400,
    lineHeight: 1.6,
  },
  
  small: {
    fontSize: '12px',
    fontWeight: 400,
    lineHeight: 1.5,
  },
};

export const shadows = {
  sm: '0 1px 3px rgba(0, 0, 0, 0.3), 0 1px 2px rgba(0, 0, 0, 0.2)',
  md: '0 4px 16px rgba(0, 0, 0, 0.4)',
  lg: '0 12px 40px rgba(0, 0, 0, 0.5)',
  glow: '0 0 20px rgba(16, 185, 129, 0.15)',
  glowStrong: '0 0 40px rgba(16, 185, 129, 0.25)',
};

export const borderRadius = {
  sm: '6px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  pill: '9999px',
};

export const breakpoints = {
  xs: '0px',
  sm: '640px',
  md: '1024px',
  lg: '1440px',
};
