/**
 * Theme configuration for Simon Bot Dashboard
 * Based on Vuexy dark theme with FL Studio music producer color scheme
 */

export const colors = {
  // Primary - Teal (FL Studio inspired)
  primary: '#2B8C71',
  primaryLight: '#3BA886',
  primaryDark: '#1F6451',
  
  // Secondary - Dark Green
  secondary: '#3E5922',
  secondaryLight: '#4F7730',
  secondaryDark: '#2C3F17',
  
  // Accent - Olive Green
  accent: '#7A8C37',
  accentLight: '#8FA24D',
  accentDark: '#636D2B',
  
  // Highlight - Orange
  highlight: '#F27B13',
  highlightLight: '#F5921E',
  highlightDark: '#C86410',
  
  // Tertiary - Brown
  tertiary: '#593119',
  tertiaryLight: '#6F411F',
  tertiaryDark: '#3F210D',
  
  // Neutrals - Vuexy dark theme
  background: '#1A1E2E',
  surface: '#252C3C',
  surfaceLight: '#2F3647',
  border: '#3E4556',
  
  // Text
  textPrimary: '#FFFFFF',
  textSecondary: '#B9C3CE',
  textTertiary: '#8A92A0',
  
  // Status colors
  success: '#00D084',
  warning: '#FFA500',
  error: '#FF4757',
  info: '#2196F3',
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
  fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  
  h1: {
    fontSize: '32px',
    fontWeight: 600,
    lineHeight: 1.2,
  },
  
  h2: {
    fontSize: '24px',
    fontWeight: 600,
    lineHeight: 1.3,
  },
  
  h3: {
    fontSize: '18px',
    fontWeight: 600,
    lineHeight: 1.4,
  },
  
  body: {
    fontSize: '14px',
    fontWeight: 400,
    lineHeight: 1.5,
  },
  
  small: {
    fontSize: '12px',
    fontWeight: 400,
    lineHeight: 1.5,
  },
};

export const shadows = {
  sm: '0 1px 2px rgba(0, 0, 0, 0.16)',
  md: '0 4px 8px rgba(0, 0, 0, 0.24)',
  lg: '0 8px 16px rgba(0, 0, 0, 0.32)',
};

export const borderRadius = {
  sm: '4px',
  md: '6px',
  lg: '8px',
  xl: '12px',
};

export const breakpoints = {
  xs: '0px',
  sm: '640px',
  md: '1024px',
  lg: '1440px',
};
