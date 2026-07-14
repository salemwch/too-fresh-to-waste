'use client';

import { useState } from 'react';
import { AlertCircle, Clock, CreditCard } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMyEstablishment } from '@/hooks/use-merchant-dashboard';
import { SubscriptionModal } from './subscription-modal';

const WARNING_THRESHOLD_DAYS = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function TrialStatusBanner() {
  const t = useTranslations('subscription');
  const { data: establishment } = useMyEstablishment();
  const [modalOpen, setModalOpen] = useState(false);

  if (!establishment) return null;

  const subscribeButton = (
    <button
      type='button'
      onClick={() => setModalOpen(true)}
      className='mt-2 inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90'
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
          className='flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm'
        >
          <AlertCircle className='mt-0.5 size-5 shrink-0 text-destructive' aria-hidden='true' />
          <div className='flex-1'>
            <p className='font-semibold text-destructive'>{t('expired')}</p>
            <p className='mt-0.5 text-destructive/80'>{t('expiredDescription')}</p>
            {subscribeButton}
          </div>
        </div>
        {modal}
      </>
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
      <>
        <div
          role='status'
          className='flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm'
        >
          <Clock className='mt-0.5 size-5 shrink-0 text-warning' aria-hidden='true' />
          <div className='flex-1'>
            <p className='font-semibold text-warning'>{t('expiresIn', { days: daysRemaining })}</p>
            <p className='mt-0.5 text-warning/80'>{t('expiresOn', { date: formattedDate })}</p>
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
  const msRemaining = trialEndsAt.getTime() - Date.now();
  if (msRemaining <= 0) return null;

  const daysRemaining = Math.ceil(msRemaining / MS_PER_DAY);
  if (daysRemaining > WARNING_THRESHOLD_DAYS) return null;

  const formattedDate = trialEndsAt.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <>
      <div
        role='status'
        className='flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm'
      >
        <Clock className='mt-0.5 size-5 shrink-0 text-warning' aria-hidden='true' />
        <div className='flex-1'>
          <p className='font-semibold text-warning'>{t('trialEndsIn', { days: daysRemaining })}</p>
          <p className='mt-0.5 text-warning/80'>{t('trialEndsOn', { date: formattedDate })}</p>
          {subscribeButton}
        </div>
      </div>
      {modal}
    </>
  );
}
