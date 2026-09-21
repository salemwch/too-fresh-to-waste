'use client';

import { useState } from 'react';
import { AlertCircle, Clock, CreditCard } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMyEstablishment } from '@/hooks/use-merchant-dashboard';
import { useToday } from '@/hooks/useClock';
import { SubscriptionModal } from './subscription-modal';
import { useFormat, MISSING_COUNT } from '@/lib/use-format';

const WARNING_THRESHOLD_DAYS = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function TrialStatusBanner() {
  const fmt = useFormat();
  // Stable day-quantised clock. Reading Date.now() in render made this
  // component non-reproducible and left the count stale overnight.
  const today = useToday();
  const t = useTranslations('subscription');
  const { data: establishment } = useMyEstablishment();
  const [modalOpen, setModalOpen] = useState(false);

  if (!establishment) return null;

  const subscribeButton = (
    <button
      type='button'
      onClick={() => setModalOpen(true)}
      className='mt-sm inline-flex items-center gap-1.5 rounded-md bg-primary px-lg py-sm text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90'
    >
      <CreditCard className='size-3.5' />
      {t('choosePlan')}
    </button>
  );

  const modal = (
    <SubscriptionModal
      open={modalOpen}
      onOpenChange={setModalOpen}
      establishmentId={establishment._id}
    />
  );

  if (establishment.subscriptionStatus === 'suspended') {
    return (
      <>
        <div
          role='alert'
          className='flex items-start gap-md rounded-lg border border-destructive/30 bg-destructive/10 px-lg py-md text-sm'
        >
          <AlertCircle className='mt-xxs size-5 shrink-0 text-destructive' aria-hidden='true' />
          <div className='flex-1'>
            <p className='font-semibold text-destructive'>{t('expired')}</p>
            <p className='mt-xxs text-destructive/80'>{t('expiredDescription')}</p>
            {subscribeButton}
          </div>
        </div>
        {modal}
      </>
    );
  }

  if (establishment.subscriptionStatus === 'paid' && establishment.subscriptionExpiresAt) {
    const expiresAt = new Date(establishment.subscriptionExpiresAt);
    const msRemaining = expiresAt.getTime() - today;
    if (msRemaining <= 0) return null;

    const daysRemaining = Math.ceil(msRemaining / MS_PER_DAY);
    if (daysRemaining > WARNING_THRESHOLD_DAYS) return null;

    const formattedDate = fmt.date(expiresAt) ?? MISSING_COUNT;

    return (
      <>
        <div
          role='status'
          className='flex items-start gap-md rounded-lg border border-warning/30 bg-warning/10 px-lg py-md text-sm'
        >
          <Clock className='mt-xxs size-5 shrink-0 text-warning' aria-hidden='true' />
          <div className='flex-1'>
            <p className='font-semibold text-warning'>{t('expiresIn', { days: daysRemaining })}</p>
            <p className='mt-xxs text-warning/80'>{t('expiresOn', { date: formattedDate })}</p>
            {subscribeButton}
          </div>
        </div>
        {modal}
      </>
    );
  }

  if (establishment.subscriptionStatus !== 'trial' || !establishment.trialEndsAt) {
    return null;
  }

  const trialEndsAt = new Date(establishment.trialEndsAt);
  const msRemaining = trialEndsAt.getTime() - today;
  if (msRemaining <= 0) return null;

  const daysRemaining = Math.ceil(msRemaining / MS_PER_DAY);
  if (daysRemaining > WARNING_THRESHOLD_DAYS) return null;

  const formattedDate = fmt.date(trialEndsAt) ?? MISSING_COUNT;

  return (
    <>
      <div
        role='status'
        className='flex items-start gap-md rounded-lg border border-warning/30 bg-warning/10 px-lg py-md text-sm'
      >
        <Clock className='mt-xxs size-5 shrink-0 text-warning' aria-hidden='true' />
        <div className='flex-1'>
          <p className='font-semibold text-warning'>{t('trialEndsIn', { days: daysRemaining })}</p>
          <p className='mt-xxs text-warning/80'>{t('trialEndsOn', { date: formattedDate })}</p>
          {subscribeButton}
        </div>
      </div>
      {modal}
    </>
  );
}
