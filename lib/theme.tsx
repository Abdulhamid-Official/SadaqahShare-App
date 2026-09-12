import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

// ── Light palette ────────────────────────────────────────────────────────────

export const LightColors = {
  primary: '#059669',
  primaryDark: '#047857',
  primaryLight: '#10b981',
  primaryFaint: '#d1fae5',

  teal: '#0d9488',
  tealDark: '#0f766e',
  tealLight: '#14b8a6',

  amber: '#d97706',
  amberLight: '#f59e0b',
  amberFaint: '#fef3c7',

  red: '#dc2626',
  redLight: '#ef4444',
  redFaint: '#fee2e2',

  blue: '#2563eb',
  blueLight: '#3b82f6',
  blueFaint: '#dbeafe',

  stone50: '#fafaf9',
  stone100: '#f5f5f4',
  stone200: '#e7e5e4',
  stone300: '#d6d3d1',
  stone400: '#a8a29e',
  stone500: '#78716c',
  stone600: '#57534e',
  stone700: '#44403c',
  stone800: '#292524',
  stone900: '#1c1917',

  white: '#ffffff',
  black: '#000000',

  cardBg: '#ffffff',
  cardBorder: '#e7e5e4',
  textPrimary: '#1c1917',
  textSecondary: '#57534e',
  textMuted: '#78716c',
  background: '#fafaf9',

  modalOverlay: 'rgba(0,0,0,0.5)',
  tabBarBg: '#ffffff',
  tabBarBorder: '#e7e5e4',
  inputBg: '#fafaf9',
  inputBorder: '#e7e5e4',
};

// ── Dark palette ─────────────────────────────────────────────────────────────

export const DarkColors: typeof LightColors = {
  primary: '#34d399',
  primaryDark: '#10b981',
  primaryLight: '#6ee7b7',
  primaryFaint: '#064e3b',

  teal: '#2dd4bf',
  tealDark: '#14b8a6',
  tealLight: '#5eead4',

  amber: '#fbbf24',
  amberLight: '#fcd34d',
  amberFaint: '#78350f',

  red: '#f87171',
  redLight: '#fca5a5',
  redFaint: '#7f1d1d',

  blue: '#60a5fa',
  blueLight: '#93c5fd',
  blueFaint: '#1e3a5f',

  stone50: '#1c1917',
  stone100: '#292524',
  stone200: '#44403c',
  stone300: '#57534e',
  stone400: '#78716c',
  stone500: '#a8a29e',
  stone600: '#d6d3d1',
  stone700: '#e7e5e4',
  stone800: '#f5f5f4',
  stone900: '#fafaf9',

  white: '#1c1917',
  black: '#fafaf9',

  cardBg: '#292524',
  cardBorder: '#44403c',
  textPrimary: '#fafaf9',
  textSecondary: '#d6d3d1',
  textMuted: '#a8a29e',
  background: '#1c1917',

  modalOverlay: 'rgba(0,0,0,0.7)',
  tabBarBg: '#292524',
  tabBarBorder: '#44403c',
  inputBg: '#292524',
  inputBorder: '#44403c',
};

// ── Backward-compatible static export (used by StyleSheet.create at module level) ──

export const Colors = LightColors;

// ── Spacing / Radius / Font constants (theme-agnostic) ──────────────────────

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
};

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 9999,
};

export const FontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 24,
  xxxl: 30,
  display: 36,
};

// ── Theme context ────────────────────────────────────────────────────────────

export type ColorPalette = typeof LightColors;

interface ThemeContextValue {
  isDark: boolean;
  colors: ColorPalette;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  isDark: false,
  colors: LightColors,
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(false);
  const toggleTheme = useCallback(() => setIsDark((v) => !v), []);
  const value = useMemo(
    () => ({ isDark, colors: isDark ? DarkColors : LightColors, toggleTheme }),
    [isDark, toggleTheme]
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
