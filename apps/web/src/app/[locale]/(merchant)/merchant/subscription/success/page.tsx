'use client';

import { useEffect, useState } from 'react';
import { CheckCircle, Loader2 } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from '@/i18n/routing';
import { subscriptionService } from '@/services/subscription.service';

export default function SubscriptionSuccessPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');

  useEffect(() => {
    const paymentRef = searchParams.get('payment_ref');
    if (!paymentRef) {
      setStatus('success');
      return;
    }

    subscriptionService
      .verifyPayment(paymentRef)
      .then(res => {
        setStatus(res.data.data.success ? 'success' : 'error');
      })
      .catch(() => {
        setStatus('success');
      });
  }, [searchParams]);

  if (status === 'verifying') {
    return (
      <div className='flex min-h-[60vh] flex-col items-center justify-center gap-4'>
        <Loader2 className='size-10 animate-spin text-primary' />
        <p className='text-muted-foreground'>Verifying your payment...</p>
      </div>
    );
  }

  return (
    <div className='flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center'>
      <CheckCircle className='size-16 text-green-600' />
      <h1 className='text-2xl font-bold'>Subscription Activated!</h1>
      <p className='max-w-md text-muted-foreground'>
        Your subscription has been activated successfully. You can now create and publish offers on
        the platform.
      </p>
      <button
        onClick={() => router.push('/merchant/dashboard')}
        className='mt-4 rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90'
      >
        Go to Dashboard
      </button>
    </div>
  );
}
