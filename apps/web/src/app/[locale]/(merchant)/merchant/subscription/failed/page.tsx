'use client';

import { XCircle } from 'lucide-react';
import { useRouter } from '@/i18n/routing';

export default function SubscriptionFailedPage() {
  const router = useRouter();

  return (
    <div className='flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center'>
      <XCircle className='size-16 text-destructive' />
      <h1 className='text-2xl font-bold'>Payment Failed</h1>
      <p className='max-w-md text-muted-foreground'>
        Your payment could not be processed. No charges were made. Please try again or use a
        different payment method.
      </p>
      <button
        onClick={() => router.push('/merchant/dashboard')}
        className='mt-4 rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90'
      >
        Back to Dashboard
      </button>
    </div>
  );
}
