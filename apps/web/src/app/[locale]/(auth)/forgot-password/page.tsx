'use client';

import { Suspense } from 'react';
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';

function ForgotPasswordFallback() {
  return (
    <div className='fixed inset-0 z-50 flex flex-col overflow-hidden lg:flex-row'>
      <div className='relative flex flex-[1.1] lg:flex-1 bg-[hsl(174,72%,17%)]' />
      <div className='flex flex-1 bg-background' />
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<ForgotPasswordFallback />}>
      <ForgotPasswordForm />
    </Suspense>
  );
}
