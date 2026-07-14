'use client';

import { useState } from 'react';
import { AlertCircle, Check, Clock, CreditCard, Loader2, Star } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMyEstablishment } from '@/hooks/use-merchant-dashboard';
import { subscriptionService } from '@/services/subscription.service';

const WARNING_THRESHOLD_DAYS = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

type Tier = 'standard' | 'pro';
type Cycle = 'monthly' | 'yearly';

const PRICES: Record<Tier, Record<Cycle, number>> = {
  standard: { monthly: 15.5, yearly: 15.5 * 12 },
  pro: { monthly: 30.5, yearly: 30.5 * 12 },
};

const STANDARD_FEATURES = [
  'standardFeature1',
  'standardFeature2',
  'standardFeature3',
  'standardFeature4',
  'standardFeature5',
] as const;

const PRO_FEATURES = [
  'proFeature1',
  'proFeature2',
  'proFeature3',
  'proFeature4',
  'proFeature5',
  'proFeature6',
] as const;

function PlanCards({ establishmentId }: { establishmentId: string }) {
  const t = useTranslations('subscription');
  const [cycle, setCycle] = useState<Cycle>('monthly');
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubscribe(tier: Tier) {
    setLoading(`${tier}-${cycle}`);
    setError(null);
    try {
      const response = await subscriptionService.initiatePayment(tier, cycle, establishmentId);
      const { payUrl } = response.data.data;
      window.location.href = payUrl;
    } catch {
      setError(t('errorGeneric'));
      setLoading(null);
    }
  }

  return (
    <div className='mt-4 space-y-4'>
      {/* Cycle toggle */}
      <div className='flex items-center justify-center gap-1 rounded-lg bg-muted p-1 w-fit mx-auto'>
        <button
          type='button'
          onClick={() => setCycle('monthly')}
          className={`rounded-md px-4 py-1.5 text-xs font-medium transition-colors ${
            cycle === 'monthly'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {t('monthly')}
        </button>
        <button
          type='button'
          onClick={() => setCycle('yearly')}
          className={`rounded-md px-4 py-1.5 text-xs font-medium transition-colors ${
            cycle === 'yearly'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {t('yearly')}
        </button>
      </div>

      {/* Plan cards */}
      <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
        {/* Standard */}
        <div className='rounded-xl border border-border bg-card p-4 space-y-3'>
          <div>
            <h4 className='font-semibold text-sm text-foreground'>{t('standardPlan')}</h4>
            <p className='text-xs text-muted-foreground mt-0.5'>{t('standardDescription')}</p>
          </div>
          <div className='flex items-baseline gap-1'>
            <span className='text-2xl font-bold text-foreground'>
              {PRICES.standard[cycle].toFixed(3)}
            </span>
            <span className='text-xs text-muted-foreground'>
              {t('tnd')}
              {cycle === 'monthly' ? t('perMonth') : t('perYear')}
            </span>
          </div>
          <ul className='space-y-1.5'>
            {STANDARD_FEATURES.map(key => (
              <li key={key} className='flex items-start gap-2 text-xs text-foreground'>
                <Check className='size-3.5 text-green-600 shrink-0 mt-0.5' />
                {t(key)}
              </li>
            ))}
          </ul>
          <button
            type='button'
            onClick={() => handleSubscribe('standard')}
            disabled={loading !== null}
            className='w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-primary bg-transparent px-3 py-2 text-xs font-medium text-primary transition-colors hover:bg-primary/10 disabled:opacity-50'
          >
            {loading === `standard-${cycle}` ? (
              <Loader2 className='size-3.5 animate-spin' />
            ) : (
              <CreditCard className='size-3.5' />
            )}
            {loading === `standard-${cycle}` ? t('subscribing') : t('subscribe')}
          </button>
        </div>

        {/* Pro */}
        <div className='rounded-xl border-2 border-primary bg-card p-4 space-y-3 relative'>
          <span className='absolute -top-2.5 end-3 inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-semibold text-primary-foreground'>
            <Star className='size-3' />
            {t('popular')}
          </span>
          <div>
            <h4 className='font-semibold text-sm text-foreground'>{t('proPlan')}</h4>
            <p className='text-xs text-muted-foreground mt-0.5'>{t('proDescription')}</p>
          </div>
          <div className='flex items-baseline gap-1'>
            <span className='text-2xl font-bold text-foreground'>
              {PRICES.pro[cycle].toFixed(3)}
            </span>
            <span className='text-xs text-muted-foreground'>
              {t('tnd')}
              {cycle === 'monthly' ? t('perMonth') : t('perYear')}
            </span>
          </div>
          <ul className='space-y-1.5'>
            {PRO_FEATURES.map(key => (
              <li key={key} className='flex items-start gap-2 text-xs text-foreground'>
                <Check className='size-3.5 text-green-600 shrink-0 mt-0.5' />
                {t(key)}
              </li>
            ))}
          </ul>
          <button
            type='button'
            onClick={() => handleSubscribe('pro')}
            disabled={loading !== null}
            className='w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50'
          >
            {loading === `pro-${cycle}` ? (
              <Loader2 className='size-3.5 animate-spin' />
            ) : (
              <CreditCard className='size-3.5' />
            )}
            {loading === `pro-${cycle}` ? t('subscribing') : t('subscribe')}
          </button>
        </div>
      </div>

      {error && <p className='text-center text-xs text-destructive'>{error}</p>}
    </div>
  );
}

/**
 * Shows a persistent banner for merchants whose subscription is nearing expiry
 * or has already been suspended. Includes plan cards for subscribing.
 */
export function TrialStatusBanner() {
  const t = useTranslations('subscription');
  const { data: establishment } = useMyEstablishment();

  if (!establishment) return null;

  if (establishment.subscriptionStatus === 'suspended') {
    return (
      <div
        role='alert'
        className='rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-4 text-sm'
      >
        <div className='flex items-start gap-3'>
          <AlertCircle className='mt-0.5 size-5 shrink-0 text-destructive' aria-hidden='true' />
          <div className='flex-1'>
            <p className='font-semibold text-destructive'>{t('expired')}</p>
            <p className='mt-0.5 text-destructive/80'>{t('expiredDescription')}</p>
          </div>
        </div>
        <PlanCards establishmentId={establishment._id} />
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
        className='rounded-lg border border-warning/30 bg-warning/10 px-4 py-4 text-sm'
      >
        <div className='flex items-start gap-3'>
          <Clock className='mt-0.5 size-5 shrink-0 text-warning' aria-hidden='true' />
          <div className='flex-1'>
            <p className='font-semibold text-warning'>{t('expiresIn', { days: daysRemaining })}</p>
            <p className='mt-0.5 text-warning/80'>{t('expiresOn', { date: formattedDate })}</p>
          </div>
        </div>
        <PlanCards establishmentId={establishment._id} />
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

  return (
    <div
      role='status'
      className='rounded-lg border border-warning/30 bg-warning/10 px-4 py-4 text-sm'
    >
      <div className='flex items-start gap-3'>
        <Clock className='mt-0.5 size-5 shrink-0 text-warning' aria-hidden='true' />
        <div className='flex-1'>
          <p className='font-semibold text-warning'>{t('trialEndsIn', { days: daysRemaining })}</p>
          <p className='mt-0.5 text-warning/80'>{t('trialEndsOn', { date: formattedDate })}</p>
        </div>
      </div>
      <PlanCards establishmentId={establishment._id} />
    </div>
  );
}
