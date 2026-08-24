'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';

/**
 * Error boundary for the (admin) route group.
 * Catches runtime errors within admin dashboard pages without
 * tearing down the entire app (global-error.tsx is the last resort).
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className='flex flex-1 flex-col items-center justify-center gap-lg p-4xl text-center'>
      <div className='flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10'>
        <AlertCircle className='h-7 w-7 text-destructive' />
      </div>
      <div className='space-y-xs'>
        <h2 className='text-lg font-semibold'>Something went wrong</h2>
        <p className='text-sm text-muted-foreground max-w-sm'>
          An unexpected error occurred while loading this page. Please try again.
        </p>
      </div>
      <button
        onClick={() => reset()}
        className='inline-flex items-center gap-sm rounded-lg bg-primary px-lg py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors'
      >
        <RotateCcw className='h-4 w-4' />
        Try again
      </button>
    </div>
  );
}
