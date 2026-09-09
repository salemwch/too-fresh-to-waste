'use client';

import { createContext, useEffect, useCallback, useSyncExternalStore } from 'react';

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

/*
 * The theme lives in a cookie, not in React. It is written by setTheme here and
 * read by the pre-paint script in lib/theme-script.ts before React ever runs,
 * so React is a subscriber to it rather than its owner.
 *
 * Modelling it as an external store is what removes the mount effect that used
 * to setState from inside useEffect. useSyncExternalStore takes an explicit
 * server snapshot, so hydration still renders 'light' to match the server HTML
 * and switches to the stored value in the same commit - no cascading render,
 * and no flash, because the pre-paint script has already put the right class on
 * <html>. Reading the cookie in a useState initialiser would not work: the
 * client's first render would disagree with the server's and produce a
 * hydration mismatch.
 */
const cookieListeners = new Set<() => void>();

function subscribeToThemeCookie(onChange: () => void): () => void {
  cookieListeners.add(onChange);
  return () => cookieListeners.delete(onChange);
}

function notifyThemeCookieChanged(): void {
  for (const listener of cookieListeners) listener();
}

const getThemeSnapshot = (): Theme => readThemeCookie() ?? 'light';
const getThemeServerSnapshot = (): Theme => 'light';

/** The OS preference is a second external store, read the same way. */
function subscribeToSystemTheme(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  mediaQuery.addEventListener('change', onChange);
  return () => mediaQuery.removeEventListener('change', onChange);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(
    subscribeToThemeCookie,
    getThemeSnapshot,
    getThemeServerSnapshot,
  );

  const systemTheme = useSyncExternalStore(
    subscribeToSystemTheme,
    getSystemTheme,
    // 'light' on the server, matching the cookie store's server snapshot
    () => 'light' as const,
  );

  // Derived, not stored. resolvedTheme is a pure function of the two stores
  // above, so keeping it in state only created a value that could disagree.
  const resolvedTheme: 'light' | 'dark' = theme === 'system' ? systemTheme : theme;

  const setTheme = useCallback((newTheme: Theme) => {
    writeThemeCookie(newTheme);
    notifyThemeCookieChanged();
  }, []);

  /*
   * Writing the class onto <html> is the one thing that genuinely belongs in an
   * effect: it pushes React state out to an external system. It is not setState,
   * so it is not the cascading-render pattern the previous version had.
   *
   * The pre-paint script has usually applied the same class already, so on first
   * mount this is a no-op and there is no flash.
   */
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(resolvedTheme);
  }, [resolvedTheme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
