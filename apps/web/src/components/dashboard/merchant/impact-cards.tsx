'use client';

import { useState } from 'react';
import { Coins, Leaf, HeartHandshake, TrendingUp, ShieldCheck, Droplets, Lock } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { apiErrorCode } from '@foodwaste/shared';

import {
  useCarbonMetrics,
  useMyEstablishment,
  useOrderStats,
  useSocialImpact,
} from '@/hooks/use-merchant-dashboard';
import { useSalesSummary } from '@/hooks/use-merchant-sales';
import { SubscriptionModal } from './subscription-modal';
import type { SalesPeriod } from '@/types/payments';
import { useFormat } from '@/lib/use-format';

interface ImpactCardsProps {
  /** Period resolved server-side; cards filter by createdAt, not commission moment. */
  period: SalesPeriod;
}

type CardStatus = 'loading' | 'locked' | 'error' | 'ready';

/**
 * `hasData` wins over both `isLoading` and `isLocked`: a background refetch
 * that fails (a 403 after a downgrade, a dropped connection) must not blank
 * out or lock a card that already has a good value on screen - same rule as
 * `EarningsCard`.
 */
function statusFor(isLoading: boolean, hasData: boolean, isLocked: boolean): CardStatus {
  if (hasData) return 'ready';
  if (isLoading) return 'loading';
  if (isLocked) return 'locked';
  return 'error';
}

interface CardContent {
  key: string;
  title: string;
  icon: typeof Coins;
  status: CardStatus;
  value: string;
  unit: string;
  /** `null` hides the delta badge - never fabricate a "+0%" from absent data. */
  delta: string | null;
  note: string;
}

/**
 * Five KPI cards, all scoped to `period`. Grouped by the query that actually
 * backs each one - Revenue rescued and Earned revenue share the earnings
 * summary; Carbon Impact and Water Saved share carbon metrics; Social Impact
 * has its own; the completion-rate delta on Earned revenue comes from order
 * stats but never gates the card (it just hides the delta badge if absent).
 * Each card carries its own loading/locked/error state - a query with no data
 * can never take down a card that does not depend on it, and carbon/social
 * being Pro-only (`PRO_PLAN_REQUIRED`) shows the existing upsell pattern
 * (see `ProGate`), not a generic error, for a non-Pro merchant.
 */
export function ImpactCards({ period }: ImpactCardsProps) {
  const fmt = useFormat();
  const t = useTranslations('dashboard.impactCards');
  const tp = useTranslations('dashboard.period');
  const { data: establishment } = useMyEstablishment();
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const statsQuery = useOrderStats(period);
  const summaryQuery = useSalesSummary(period);
  const carbonQuery = useCarbonMetrics(period);
  const socialQuery = useSocialImpact(period);

  const summaryStatus = statusFor(summaryQuery.isLoading, !!summaryQuery.data, false);
  const carbonStatus = statusFor(
    carbonQuery.isLoading,
    !!carbonQuery.data,
    apiErrorCode(carbonQuery.error) === 'PRO_PLAN_REQUIRED',
  );
  const socialStatus = statusFor(
    socialQuery.isLoading,
    !!socialQuery.data,
    apiErrorCode(socialQuery.error) === 'PRO_PLAN_REQUIRED',
  );

  const summary = summaryQuery.data;
  const stats = statsQuery.data; // completion-rate delta only - never gates a card
  const periodLabel = tp(period);

  const originalValue = summary?.total.originalValue ?? 0;
  const foodValue = summary?.total.foodValue ?? 0;
  const earnings = summary?.total.earned ?? 0;
  // Food only: the old formula divided by pricing.total, which includes the
  // delivery fee, and so understated the discount on every delivery order.
  // `null` (never a fabricated `0`) when there is nothing to divide by - no
  // sales in the period is a different statement from "0% saved".
  const savingsPercent =
    originalValue > 0 ? Math.round(((originalValue - foodValue) / originalValue) * 100) : null;
  // `undefined` when order stats has no data (loading or failed) - a "+0%
  // completion rate" badge would be exactly the invented figure this fix
  // round removes elsewhere, so the badge is hidden instead of fabricated.
  const completionRate =
    stats == null
      ? undefined
      : stats.totalOrders > 0
        ? Math.round((stats.completedOrders / stats.totalOrders) * 100)
        : 0;

  const carbonKg = carbonQuery.data?.carbonKgAvoided ?? 0;
  const carKm = carbonQuery.data?.carKmEquivalent ?? 0;
  const waterLiters = carbonQuery.data?.waterLitersAvoided ?? 0;
  const meals = socialQuery.data?.mealsDistributed ?? 0;
  const people = socialQuery.data?.peopleServedEstimate ?? 0;

  const cards: CardContent[] = [
    {
      key: 'rescued',
      title: t('rescued.title'),
      icon: ShieldCheck,
      status: summaryStatus,
      value: fmt.compact(originalValue),
      unit: t('rescued.unit'),
      delta: savingsPercent === null ? null : t('rescued.delta', { percent: savingsPercent }),
      note: t('rescued.note'),
    },
    {
      key: 'revenue',
      title: t('revenue.title'),
      icon: Coins,
      status: summaryStatus,
      value: fmt.compact(earnings),
      unit: t('revenue.unit'),
      delta: completionRate === undefined ? null : t('revenue.delta', { rate: completionRate }),
      note: t('revenue.note'),
    },
    {
      key: 'carbon',
      title: t('carbon.title'),
      icon: Leaf,
      status: carbonStatus,
      value: carbonKg.toString(),
      unit: t('carbon.unit'),
      delta: t('carbon.delta', { period: periodLabel }),
      note: t('carbon.note', { km: carKm }),
    },
    {
      key: 'water',
      title: t('water.title'),
      icon: Droplets,
      status: carbonStatus,
      value: fmt.compact(waterLiters),
      unit: t('water.unit'),
      delta: t('water.delta'),
      note: t('water.note'),
    },
    {
      key: 'social',
      title: t('social.title'),
      icon: HeartHandshake,
      status: socialStatus,
      value: meals.toString(),
      unit: t('social.unit'),
      delta: t('social.delta'),
      note: t('social.note', { people, period: periodLabel }),
    },
  ];

  return (
    <section className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-md'>
      {cards.map((card, i) => (
        <ImpactCard
          key={card.key}
          card={card}
          delay={0.1 + i * 0.08}
          onUpgrade={() => setUpgradeOpen(true)}
        />
      ))}
      {establishment && (
        <SubscriptionModal
          open={upgradeOpen}
          onOpenChange={setUpgradeOpen}
          establishmentId={establishment._id}
        />
      )}
    </section>
  );
}

function ImpactCard({
  card,
  delay,
  onUpgrade,
}: {
  card: CardContent;
  delay: number;
  onUpgrade: () => void;
}) {
  const t = useTranslations('dashboard.impactCards');
  const tSub = useTranslations('subscription');
  const Icon = card.icon;

  if (card.status === 'loading') {
    return (
      <div
        data-testid='impact-card-skeleton'
        className='glass rounded-2xl p-lg shadow-soft h-[164px] animate-pulse bg-white/30'
      />
    );
  }

  if (card.status === 'error') {
    return (
      <div
        data-testid='impact-card-error'
        className='glass rounded-2xl p-lg shadow-soft h-[164px] flex items-center justify-center text-center'
      >
        <p className='text-xs text-primary-500/65'>{t('error')}</p>
      </div>
    );
  }

  if (card.status === 'locked') {
    return (
      <div
        data-testid='impact-card-locked'
        className='glass rounded-2xl p-lg shadow-soft relative overflow-hidden flex h-[164px] flex-col'
      >
        <div className='flex items-start justify-between mb-md'>
          <div className='h-9 w-9 rounded-lg bg-primary-500/[0.08] grid place-items-center text-primary-500'>
            <Icon size={17} />
          </div>
          <Lock size={14} className='text-primary-500/40' aria-hidden='true' />
        </div>
        <div className='text-[10px] uppercase tracking-wider text-primary-500/60 mb-1.5'>
          {card.title}
        </div>
        <p className='text-sm font-semibold text-primary-500'>{tSub('proOnly')}</p>
        <button
          type='button'
          onClick={onUpgrade}
          className='mt-auto self-start text-xs font-medium text-primary-500 underline underline-offset-2 hover:no-underline'
        >
          {tSub('upgradeToPro')}
        </button>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5, ease: 'easeOut' }}
      className='glass rounded-2xl p-lg shadow-soft relative overflow-hidden group'
    >
      {/* Coral glow blob */}
      <div className='absolute -top-3xl -right-3xl h-40 w-40 rounded-full bg-brand-coral/10 blur-2xl group-hover:bg-brand-coral/20 transition-colors pointer-events-none' />

      <div className='relative flex items-start justify-between mb-md'>
        <div className='h-9 w-9 rounded-lg bg-primary-500/[0.08] grid place-items-center text-primary-500'>
          <Icon size={17} />
        </div>
        {card.delta !== null && (
          <div className='flex items-center gap-xs text-[10px] font-medium text-brand-green text-end'>
            <TrendingUp size={11} className='shrink-0' />
            {card.delta}
          </div>
        )}
      </div>

      <div className='relative'>
        <div className='text-[10px] uppercase tracking-wider text-primary-500/60 mb-1.5'>
          {card.title}
        </div>
        <div className='flex items-baseline gap-sm'>
          <span className='font-display text-3xl text-primary-500 tracking-tight'>
            {card.value}
          </span>
          <span className='text-xs text-primary-500/60 font-medium'>{card.unit}</span>
        </div>
        <p className='mt-sm text-[11px] italic text-primary-500/65 leading-snug'>{card.note}</p>
      </div>
    </motion.div>
  );
}

export function ImpactCardsSkeleton() {
  return (
    <section className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-md'>
      {[0, 1, 2, 3, 4].map(i => (
        <div
          key={i}
          className='glass rounded-2xl p-lg shadow-soft h-[164px] animate-pulse bg-white/30'
        />
      ))}
    </section>
  );
}
