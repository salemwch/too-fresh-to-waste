'use client';

import { Coins, Leaf, HeartHandshake, TrendingUp, ShieldCheck, Droplets } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { useCarbonMetrics, useSocialImpact } from '@/hooks/use-merchant-dashboard';
import type { OrderStatsResponse } from '@/types/dashboard';

interface ImpactCardsProps {
  stats: OrderStatsResponse | null | undefined;
}

function formatValue(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return v.toLocaleString();
}

export function ImpactCards({ stats }: ImpactCardsProps) {
  const t = useTranslations('dashboard.impactCards');
  const carbonQuery = useCarbonMetrics();
  const socialQuery = useSocialImpact();

  const revenue = stats?.totalRevenue ?? 0; // gross — used ONLY for savingsPercent below
  const earnings = stats?.totalEarnings ?? 0; // net — what the merchant actually keeps
  const originalValue = stats?.totalOriginalValue ?? 0;
  const completionRate =
    stats && stats.totalOrders > 0
      ? Math.round((stats.completedOrders / stats.totalOrders) * 100)
      : 0;
  const savingsPercent =
    originalValue > 0 ? Math.round(((originalValue - revenue) / originalValue) * 100) : 0;

  const carbonKg = carbonQuery.data?.carbonKgAvoided ?? 0;
  const carKm = carbonQuery.data?.carKmEquivalent ?? 0;
  const waterLiters = carbonQuery.data?.waterLitersAvoided ?? 0;
  const meals = socialQuery.data?.mealsDistributed ?? 0;
  const people = socialQuery.data?.peopleServedEstimate ?? 0;

  const cards = [
    {
      title: t('rescued.title'),
      value: formatValue(originalValue),
      unit: t('rescued.unit'),
      delta: t('rescued.delta', { percent: savingsPercent }),
      icon: ShieldCheck,
      note: t('rescued.note'),
    },
    {
      title: t('revenue.title'),
      value: formatValue(earnings),
      unit: t('revenue.unit'),
      delta: t('revenue.delta', { rate: completionRate }),
      icon: Coins,
      note: t('revenue.note'),
    },
    {
      title: t('carbon.title'),
      value: carbonKg.toString(),
      unit: t('carbon.unit'),
      delta: t('carbon.delta'),
      icon: Leaf,
      note: t('carbon.note', { km: carKm }),
    },
    {
      title: t('water.title'),
      value: formatValue(waterLiters),
      unit: t('water.unit'),
      delta: t('water.delta'),
      icon: Droplets,
      note: t('water.note'),
    },
    {
      title: t('social.title'),
      value: meals.toString(),
      unit: t('social.unit'),
      delta: t('social.delta'),
      icon: HeartHandshake,
      note: t('social.note', { people }),
    },
  ];

  return (
    <section className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-md'>
      {cards.map((card, i) => {
        const Icon = card.icon;
        return (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.08, duration: 0.5, ease: 'easeOut' }}
            className='glass rounded-2xl p-lg shadow-soft relative overflow-hidden group'
          >
            {/* Coral glow blob */}
            <div className='absolute -top-3xl -right-3xl h-40 w-40 rounded-full bg-brand-coral/10 blur-2xl group-hover:bg-brand-coral/20 transition-colors pointer-events-none' />

            <div className='relative flex items-start justify-between mb-md'>
              <div className='h-9 w-9 rounded-lg bg-primary-500/[0.08] grid place-items-center text-primary-500'>
                <Icon size={17} />
              </div>
              <div className='flex items-center gap-xs text-[10px] font-medium text-brand-coral text-end'>
                <TrendingUp size={11} className='shrink-0' />
                {card.delta}
              </div>
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
              <p className='mt-sm text-[11px] italic text-primary-500/65 leading-snug'>
                {card.note}
              </p>
            </div>
          </motion.div>
        );
      })}
    </section>
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
