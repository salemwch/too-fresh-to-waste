'use client';

import { AlertCircle, Clock } from 'lucide-react';
import { useMyEstablishment } from '@/hooks/use-merchant-dashboard';

const WARNING_THRESHOLD_DAYS = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Shows a persistent banner for merchants whose free trial is nearing expiry
 * or has already been suspended by the daily trial-expiry scanner.
 *
 * Renders nothing for `subscriptionStatus === 'paid'` or when the trial has
 * more than 7 days remaining — a quiet state for the happy path.
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
          <p className='font-semibold text-destructive'>Your free trial has ended</p>
          <p className='mt-0.5 text-destructive/80'>
            You can still log in and view existing orders, but creating new offers is paused. Please
            contact the admin team to reactivate your account.
          </p>
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
          Trial ends on {formattedDate}. Contact the admin team to continue using the platform
          without interruption.
        </p>
      </div>
    </div>
  );
}
