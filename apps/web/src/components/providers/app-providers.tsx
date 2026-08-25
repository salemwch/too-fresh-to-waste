'use client';

import { DirectionProvider } from '@radix-ui/react-direction';

import { QueryProvider } from './query-provider';
import { AuthProvider } from './auth-provider';
import { ThemeProvider } from './theme-provider';
import { Toaster } from '@foodwaste/ui';
import { TooltipProvider } from '@foodwaste/ui';

/**
 * `dir` is threaded in from the server layout rather than read from the DOM.
 *
 * Radix renders dropdowns, selects and menus through a portal on `document.body`
 * and resolves direction from its own context, not from the `dir` attribute on
 * `<html>`. Without this provider those surfaces lay out left-to-right inside an
 * otherwise correct RTL page - the check indicator in a Select ends up on the
 * opposite edge from the padding reserved for it. See DESIGN.md 19-E22.
 */
export function AppProviders({
  children,
  dir = 'ltr',
}: Readonly<{ children: React.ReactNode; dir?: 'ltr' | 'rtl' }>) {
  return (
    <DirectionProvider dir={dir}>
      <QueryProvider>
        <ThemeProvider>
          <AuthProvider>
            <TooltipProvider>
              {children}
              <Toaster position='top-right' richColors closeButton />
            </TooltipProvider>
          </AuthProvider>
        </ThemeProvider>
      </QueryProvider>
    </DirectionProvider>
  );
}
