/**
 * Design System - Theme Provider
 * Provides theme context and manages light/dark mode state
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useColorScheme } from 'react-native';

import { Logger } from '../../utils/logger';
import { designTokens } from '../tokens';

import type { ThemeMode, ColorScheme, ThemeContextValue, ThemeShadows } from '../types';
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
  /**
   * Rollout lock. When true the provider reports light no matter what the user
   * saved or what the system reports.
   *
   * This is a prop rather than something the provider reads from a module
   * because the visual matrix mounts this provider directly to capture dark
   * baselines. A global consulted here would collapse every one of those to
   * light and still report green - the exact failure the matrix exists to
   * catch.
   *
   * The saved preference is deliberately left in storage and `setTheme` keeps
   * writing to it, so clearing the lock restores whatever the user had chosen.
   */
  lockToLight?: boolean;
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
  lockToLight = false,
}) => {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeMode] = useState<ThemeMode>(defaultTheme);

  // What the user's preference resolves to, before the rollout lock.
  const preferredScheme: ColorScheme =
    themeMode === 'auto' ? (systemColorScheme ?? 'light') : (themeMode as ColorScheme);

  // The active scheme, and the mode reported alongside it.
  //
  // `mode` is clamped together with `colorScheme` on purpose: the context has
  // to describe what is actually on screen. Reporting mode 'dark' while
  // rendering light would make every consumer that branches on `mode` wrong,
  // and would put a selected "Dark" pill above a light screen.
  const colorScheme: ColorScheme = lockToLight ? 'light' : preferredScheme;
  const effectiveMode: ThemeMode = lockToLight ? 'light' : themeMode;

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
        Logger.warn(
          'Failed to load theme from storage',
          { storageKey },
          error instanceof Error ? error : undefined,
        );
      }
    };

    void loadTheme();
  }, [storageKey]);

  // Save theme to storage
  const saveTheme = useCallback(
    async (mode: ThemeMode) => {
      try {
        await AsyncStorage.setItem(storageKey, mode);
      } catch (error) {
        Logger.warn(
          'Failed to save theme to storage',
          { storageKey, mode },
          error instanceof Error ? error : undefined,
        );
      }
    },
    [storageKey],
  );

  // Set theme function
  const setTheme = useCallback(
    (mode: ThemeMode) => {
      setThemeMode(mode);
      void saveTheme(mode);
    },
    [saveTheme],
  );

  // Toggle theme function
  const toggleTheme = useCallback(() => {
    // Keyed off the preference rather than the clamped scheme: while locked the
    // clamped value is always 'light', so toggling would otherwise be a no-op
    // that silently rewrote the user's saved choice to 'dark' on every call.
    const newMode = preferredScheme === 'light' ? 'dark' : 'light';
    setTheme(newMode);
  }, [preferredScheme, setTheme]);

  // Theme context value
  // Enterprise-grade spacing structure: preserve full nested structure for type safety
  const contextValue: ThemeContextValue = {
    mode: effectiveMode,
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
    shadows: shadows as ThemeShadows,
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
