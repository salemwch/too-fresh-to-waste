'use client';

import { Suspense } from 'react';
import { ResetPasswordForm } from '@/components/auth/reset-password-form';

function ResetPasswordFallback() {
  return (
    <div className='w-full max-w-md space-y-lg'>
      <div className='space-y-1.5'>
        <div className='h-7 w-48 bg-muted rounded animate-pulse' />
        <div className='h-4 w-64 bg-muted rounded animate-pulse' />
      </div>
      <div className='bg-card rounded-xl border p-2xl space-y-lg'>
        <div className='h-9 w-full bg-muted rounded-md animate-pulse' />
        <div className='h-9 w-full bg-muted rounded-md animate-pulse' />
        <div className='h-10 w-full bg-primary/20 rounded-md animate-pulse' />
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<ResetPasswordFallback />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
