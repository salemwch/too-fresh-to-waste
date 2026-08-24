'use client';

import { createContext, useEffect, useState, useCallback } from 'react';

import { readThemeCookie, writeThemeCookie, type Theme } from '@/lib/theme-script';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: 'light' | 'dark';
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light');
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');

  const applyTheme = useCallback((t: Theme) => {
    const resolved = t === 'system' ? getSystemTheme() : t;
    setResolvedTheme(resolved);

    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(resolved);
  }, []);

  const setTheme = useCallback(
    (newTheme: Theme) => {
      setThemeState(newTheme);
      writeThemeCookie(newTheme);
      applyTheme(newTheme);
    },
    [applyTheme],
  );

  /*
   * Sync React state with what the pre-paint script already applied.
   *
   * The class is on <html> before this runs (see lib/theme-script.ts), so this
   * effect only reconciles state - it must not re-apply a default, or a dark
   * user would flash to light on every mount.
   */
  useEffect(() => {
    const stored = readThemeCookie() ?? 'light';
    setThemeState(stored);
    setResolvedTheme(stored === 'system' ? getSystemTheme() : stored);
  }, []);

  // Listen for system theme changes
  useEffect(() => {
    if (theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyTheme('system');
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [theme, applyTheme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
