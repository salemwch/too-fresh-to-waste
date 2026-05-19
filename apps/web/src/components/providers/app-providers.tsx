'use client';

import { GoogleOAuthProvider } from '@react-oauth/google';
import { QueryProvider } from './query-provider';
import { AuthProvider } from './auth-provider';
import { ThemeProvider } from './theme-provider';
import { Toaster } from '@foodwaste/ui';
import { TooltipProvider } from '@foodwaste/ui';

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? ''}>
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
    </GoogleOAuthProvider>
  );
}
