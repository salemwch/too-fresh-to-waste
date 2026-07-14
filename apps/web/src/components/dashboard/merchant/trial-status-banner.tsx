'use client';

import { useState } from 'react';
import { AlertCircle, Clock, CreditCard, Loader2 } from 'lucide-react';
import { useMyEstablishment } from '@/hooks/use-merchant-dashboard';
import { subscriptionService } from '@/services/subscription.service';

const WARNING_THRESHOLD_DAYS = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function SubscribeButtons({ establishmentId }: { establishmentId: string }) {
  const [loading, setLoading] = useState<'monthly' | 'yearly' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubscribe(plan: 'monthly' | 'yearly') {
    setLoading(plan);
    setError(null);
    try {
      const response = await subscriptionService.initiatePayment(plan, establishmentId);
      const { payUrl } = response.data.data;
      window.location.href = payUrl;
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Payment initiation failed. Please try again.';
      setError(msg);
      setLoading(null);
    }
  }

  return (
    <div className='mt-3'>
      <div className='flex flex-wrap gap-2'>
        <button
          onClick={() => handleSubscribe('monthly')}
          disabled={loading !== null}
          className='inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50'
        >
          {loading === 'monthly' ? (
            <Loader2 className='size-3.5 animate-spin' />
          ) : (
            <CreditCard className='size-3.5' />
          )}
          Subscribe Monthly
        </button>
        <button
          onClick={() => handleSubscribe('yearly')}
          disabled={loading !== null}
          className='inline-flex items-center gap-1.5 rounded-md border border-primary bg-transparent px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10 disabled:opacity-50'
        >
          {loading === 'yearly' ? (
            <Loader2 className='size-3.5 animate-spin' />
          ) : (
            <CreditCard className='size-3.5' />
          )}
          Subscribe Yearly
        </button>
      </div>
      {error && <p className='mt-1.5 text-xs text-destructive'>{error}</p>}
    </div>
  );
}

/**
 * Shows a persistent banner for merchants whose free trial is nearing expiry
 * or has already been suspended by the daily trial-expiry scanner.
 *
 * Renders nothing for `subscriptionStatus === 'paid'` with time remaining,
 * or when the trial has more than 7 days remaining.
 */
export function TrialStatusBanner() {
  const { data: establishment } = useMyEstablishment();

  if (!establishment) return null;

  if (establishment.subscriptionStatus === 'suspended') {
    return (
      <div
        role='alert'
        className='flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm'
      >
        <AlertCircle className='mt-0.5 size-5 shrink-0 text-destructive' aria-hidden='true' />
        <div className='flex-1'>
          <p className='font-semibold text-destructive'>Your subscription has expired</p>
          <p className='mt-0.5 text-destructive/80'>
            You can still log in and view existing orders, but creating and publishing new offers is
            paused. Subscribe to reactivate your account.
          </p>
          <SubscribeButtons establishmentId={establishment._id} />
        </div>
      </div>
    );
  }

  if (establishment.subscriptionStatus === 'paid' && establishment.subscriptionExpiresAt) {
    const expiresAt = new Date(establishment.subscriptionExpiresAt);
    const msRemaining = expiresAt.getTime() - Date.now();
    if (msRemaining <= 0) return null;

    const daysRemaining = Math.ceil(msRemaining / MS_PER_DAY);
    if (daysRemaining > WARNING_THRESHOLD_DAYS) return null;

    const formattedDate = expiresAt.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    return (
      <div
        role='status'
        className='flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm'
      >
        <Clock className='mt-0.5 size-5 shrink-0 text-warning' aria-hidden='true' />
        <div className='flex-1'>
          <p className='font-semibold text-warning'>
            Your subscription expires in {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'}
          </p>
          <p className='mt-0.5 text-warning/80'>
            Subscription ends on {formattedDate}. Renew to continue publishing offers.
          </p>
          <SubscribeButtons establishmentId={establishment._id} />
        </div>
      </div>
    );
  }

  if (establishment.subscriptionStatus !== 'trial' || !establishment.trialEndsAt) {
    return null;
  }

  const trialEndsAt = new Date(establishment.trialEndsAt);
  const msRemaining = trialEndsAt.getTime() - Date.now();
  if (msRemaining <= 0) return null;

  const daysRemaining = Math.ceil(msRemaining / MS_PER_DAY);
  if (daysRemaining > WARNING_THRESHOLD_DAYS) return null;

  const formattedDate = trialEndsAt.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const dayLabel = daysRemaining === 1 ? 'day' : 'days';

  return (
    <div
      role='status'
      className='flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm'
    >
      <Clock className='mt-0.5 size-5 shrink-0 text-warning' aria-hidden='true' />
      <div className='flex-1'>
        <p className='font-semibold text-warning'>
          Your free trial ends in {daysRemaining} {dayLabel}
        </p>
        <p className='mt-0.5 text-warning/80'>
          Trial ends on {formattedDate}. Subscribe to continue using the platform without
          interruption.
        </p>
        <SubscribeButtons establishmentId={establishment._id} />
      </div>
    </div>
  );
}
