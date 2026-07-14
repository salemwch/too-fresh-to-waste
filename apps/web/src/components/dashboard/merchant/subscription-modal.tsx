'use client';

import { useState } from 'react';
import { Check, CreditCard, Loader2, Star } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { subscriptionService } from '@/services/subscription.service';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

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
] as const;

export function SubscriptionModal({
  open,
  onOpenChange,
  establishmentId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  establishmentId: string;
}) {
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-2xl max-h-[90vh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>{t('choosePlan')}</DialogTitle>
          <DialogDescription>{t('expiredDescription')}</DialogDescription>
        </DialogHeader>

        {/* Cycle toggle */}
        <div className='flex items-center justify-center gap-1 rounded-lg bg-muted p-1 w-fit mx-auto'>
          <button
            type='button'
            onClick={() => setCycle('monthly')}
            className={`rounded-md px-5 py-2 text-sm font-medium transition-colors ${
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
            className={`rounded-md px-5 py-2 text-sm font-medium transition-colors ${
              cycle === 'yearly'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t('yearly')}
          </button>
        </div>

        {/* Plan cards */}
        <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
          {/* Standard */}
          <div className='rounded-xl border border-border bg-card p-5 space-y-4'>
            <div>
              <h4 className='font-semibold text-base text-foreground'>{t('standardPlan')}</h4>
              <p className='text-sm text-muted-foreground mt-1'>{t('standardDescription')}</p>
            </div>
            <div className='flex items-baseline gap-1'>
              <span className='text-3xl font-bold text-foreground'>
                {PRICES.standard[cycle].toFixed(3)}
              </span>
              <span className='text-sm text-muted-foreground'>
                {t('tnd')}
                {cycle === 'monthly' ? t('perMonth') : t('perYear')}
              </span>
            </div>
            <ul className='space-y-2'>
              {STANDARD_FEATURES.map(key => (
                <li key={key} className='flex items-start gap-2 text-sm text-foreground'>
                  <Check className='size-4 text-green-600 shrink-0 mt-0.5' />
                  {t(key)}
                </li>
              ))}
            </ul>
            <button
              type='button'
              onClick={() => handleSubscribe('standard')}
              disabled={loading !== null}
              className='w-full inline-flex items-center justify-center gap-2 rounded-lg border border-primary bg-transparent px-4 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10 disabled:opacity-50'
            >
              {loading === `standard-${cycle}` ? (
                <Loader2 className='size-4 animate-spin' />
              ) : (
                <CreditCard className='size-4' />
              )}
              {loading === `standard-${cycle}` ? t('subscribing') : t('subscribe')}
            </button>
          </div>

          {/* Pro */}
          <div className='rounded-xl border-2 border-primary bg-card p-5 space-y-4 relative'>
            <span className='absolute -top-3 end-4 inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground'>
              <Star className='size-3' />
              {t('popular')}
            </span>
            <div>
              <h4 className='font-semibold text-base text-foreground'>{t('proPlan')}</h4>
              <p className='text-sm text-muted-foreground mt-1'>{t('proDescription')}</p>
            </div>
            <div className='flex items-baseline gap-1'>
              <span className='text-3xl font-bold text-foreground'>
                {PRICES.pro[cycle].toFixed(3)}
              </span>
              <span className='text-sm text-muted-foreground'>
                {t('tnd')}
                {cycle === 'monthly' ? t('perMonth') : t('perYear')}
              </span>
            </div>
            <ul className='space-y-2'>
              {PRO_FEATURES.map(key => (
                <li key={key} className='flex items-start gap-2 text-sm text-foreground'>
                  <Check className='size-4 text-green-600 shrink-0 mt-0.5' />
                  {t(key)}
                </li>
              ))}
            </ul>
            <button
              type='button'
              onClick={() => handleSubscribe('pro')}
              disabled={loading !== null}
              className='w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50'
            >
              {loading === `pro-${cycle}` ? (
                <Loader2 className='size-4 animate-spin' />
              ) : (
                <CreditCard className='size-4' />
              )}
              {loading === `pro-${cycle}` ? t('subscribing') : t('subscribe')}
            </button>
          </div>
        </div>

        {error && <p className='text-center text-sm text-destructive'>{error}</p>}
      </DialogContent>
    </Dialog>
  );
}
