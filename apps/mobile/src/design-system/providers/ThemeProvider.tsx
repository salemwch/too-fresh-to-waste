/**
 * Design System - Theme Provider
 * Provides theme context and manages light/dark mode state
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useColorScheme } from 'react-native';

import { designTokens } from '../tokens';

import type { ThemeMode, ColorScheme, ThemeContextValue } from '../types';
import type { ReactNode } from 'react';

// Theme storage key
const THEME_STORAGE_KEY = '@foodwaste/theme';

// Theme context
const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

// Theme provider props
interface ThemeProviderProps {
  children: ReactNode;
  defaultTheme?: ThemeMode;
  storageKey?: string;
}

// Custom hook to get theme colors based on mode
const useThemeColors = (colorScheme: ColorScheme) =>
  colorScheme === 'dark' ? designTokens.colors.dark : designTokens.colors.light;

// Custom hook to get theme shadows based on mode
const useThemeShadows = (colorScheme: ColorScheme) => {
  const baseShadows =
    colorScheme === 'dark' ? designTokens.shadows.dark : designTokens.shadows.cross;

  // Return shadows with component shadows included
  return {
    ...baseShadows,
    component: designTokens.shadows.component,
  };
};

export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  defaultTheme = 'light',
  storageKey = THEME_STORAGE_KEY,
}) => {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeMode] = useState<ThemeMode>(defaultTheme);

  // Determine the active color scheme
  const colorScheme: ColorScheme =
    themeMode === 'auto' ? systemColorScheme || 'light' : (themeMode as ColorScheme);

  // Get theme-specific tokens
  const themeColors = useThemeColors(colorScheme);
  const colors = { ...themeColors, base: designTokens.colors.base };
  const shadows = useThemeShadows(colorScheme);

  // Load saved theme from storage
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem(storageKey);
        if (savedTheme != null && ['light', 'dark', 'auto'].includes(savedTheme)) {
          setThemeMode(savedTheme as ThemeMode);
        }
      } catch (error) {
        console.warn('Failed to load theme from storage:', error);
      }
    };

    loadTheme();
  }, [storageKey]);

  // Save theme to storage
  const saveTheme = useCallback(
    async (mode: ThemeMode) => {
      try {
        await AsyncStorage.setItem(storageKey, mode);
      } catch (error) {
        console.warn('Failed to save theme to storage:', error);
      }
    },
    [storageKey],
  );

  // Set theme function
  const setTheme = useCallback(
    (mode: ThemeMode) => {
      setThemeMode(mode);
      saveTheme(mode);
    },
    [saveTheme],
  );

  // Toggle theme function
  const toggleTheme = useCallback(() => {
    const newMode = colorScheme === 'light' ? 'dark' : 'light';
    setTheme(newMode);
  }, [colorScheme, setTheme]);

  // Theme context value
  // Enterprise-grade spacing structure: preserve full nested structure for type safety
  const contextValue: ThemeContextValue = {
    mode: themeMode,
    colorScheme,
    colors: { ...colors, base: designTokens.colors.base } as typeof designTokens.colors.light & {
      base: typeof designTokens.colors.base;
    },
    // Preserve nested structure explicitly to prevent undefined access errors
    // This provides BOTH theme.spacing.base.sm (nested) AND flattened access for convenience
    spacing: {
      ...designTokens.spacing.base, // Flatten base spacing for direct access (theme.spacing.sm)
      base: designTokens.spacing.base, // Preserve nested access (theme.spacing.base.sm)
      radius: designTokens.spacing.radius,
      sizing: designTokens.spacing.sizing,
      semantic: designTokens.spacing.semantic,
      elevation: designTokens.spacing.elevation,
      touchTarget: designTokens.spacing.touchTarget,
      layout: designTokens.spacing.layout,
      motion: designTokens.spacing.motion,
      unit: designTokens.spacing.unit,
    },
    typography: designTokens.typography,
    shadows: shadows as unknown as typeof designTokens.shadows,
    motion: designTokens.motion,
    setTheme,
    toggleTheme,
  };

  // Enterprise-grade: Render immediately with default theme
  // This prevents undefined theme errors during AsyncStorage load
  // Components will render immediately with default theme, then re-render with saved preference
  return <ThemeContext.Provider value={contextValue}>{children}</ThemeContext.Provider>;
};

// Hook to use theme context
export const useTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext);

  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }

  return context;
};

// Hook to create themed styles
export const useThemedStyles = <T extends Record<string, any>>(
  createStyles: (theme: ThemeContextValue) => T,
): T => {
  const theme = useTheme();
  return createStyles(theme);
};

// HOC for themed components
export function withTheme<P extends object>(
  Component: React.ComponentType<P & { theme: ThemeContextValue }>,
): React.ComponentType<P> {
  const WrappedComponent = (props: P) => {
    const theme = useTheme();
    return <Component {...props} theme={theme} />;
  };

  WrappedComponent.displayName = `withTheme(${Component.displayName != null || Component.name})`;

  return WrappedComponent;
}

// Utility function to get theme colors outside of React components
export const getThemeColors = (colorScheme: ColorScheme) =>
  colorScheme === 'dark' ? designTokens.colors.dark : designTokens.colors.light;

// Utility function to check if dark mode is active
export const isDarkMode = (theme: ThemeContextValue): boolean => theme.colorScheme === 'dark';

// Utility function to get responsive values based on theme
export const getResponsiveValue = <T,>(
  value: T | { light: T; dark: T },
  theme: ThemeContextValue,
): T => {
  if (typeof value === 'object' && value !== null && 'light' in value && 'dark' in value) {
    return theme.colorScheme === 'dark' ? value.dark : value.light;
  }
  return value;
};

export default ThemeProvider;
