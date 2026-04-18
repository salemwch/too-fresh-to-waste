'use client';

import { Coins, Leaf, HeartHandshake, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import { useCarbonMetrics, useSocialImpact } from '@/hooks/use-merchant-dashboard';
import type { OrderStatsResponse } from '@/types/dashboard';

interface ImpactCardsProps {
  stats: OrderStatsResponse | null | undefined;
}

function formatValue(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return v.toLocaleString('fr-FR');
}

export function ImpactCards({ stats }: ImpactCardsProps) {
  const carbonQuery = useCarbonMetrics();
  const socialQuery = useSocialImpact();

  const revenue = stats?.totalRevenue ?? 0;
  const completionRate =
    stats && stats.totalOrders > 0
      ? Math.round((stats.completedOrders / stats.totalOrders) * 100)
      : 0;

  const carbonKg = carbonQuery.data?.carbonKgAvoided ?? 0;
  const carKm = carbonQuery.data?.carKmEquivalent ?? 0;
  const meals = socialQuery.data?.mealsDistributed ?? 0;

  const cards = [
    {
      title: 'Revenus Sauvés',
      value: formatValue(revenue),
      unit: 'TND',
      delta: `+${completionRate}% taux complétion`,
      icon: Coins,
      note: 'Sustainability is profitable. Your rescue revenue this period.',
    },
    {
      title: 'Impact Carbone (Scope 3)',
      value: carbonKg.toString(),
      unit: 'kg CO₂',
      delta: 'évités cette période',
      icon: Leaf,
      note: `C'est l'équivalent d'un trajet de ${carKm} km en voiture.`,
    },
    {
      title: 'Impact Social',
      value: meals.toString(),
      unit: 'repas',
      delta: 'distribués',
      icon: HeartHandshake,
      note: `Vous avez nourri ~${socialQuery.data?.peopleServedEstimate ?? 0} bénéficiaires ce mois-ci.`,
    },
  ];

  return (
    <section className='grid grid-cols-1 md:grid-cols-3 gap-[20px]'>
      {cards.map((card, i) => {
        const Icon = card.icon;
        return (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.08, duration: 0.5, ease: 'easeOut' }}
            className='glass rounded-2xl p-[24px] shadow-soft relative overflow-hidden group'
          >
            {/* Coral glow blob */}
            <div className='absolute -top-12 -right-12 h-40 w-40 rounded-full bg-brand-coral/10 blur-2xl group-hover:bg-brand-coral/20 transition-colors pointer-events-none' />

            <div className='relative flex items-start justify-between mb-[24px]'>
              <div className='h-11 w-11 rounded-xl bg-primary-500/[0.08] grid place-items-center text-primary-500'>
                <Icon size={20} />
              </div>
              <div className='flex items-center gap-1 text-[11px] font-medium text-brand-coral'>
                <TrendingUp size={12} />
                {card.delta}
              </div>
            </div>

            <div className='relative'>
              <div className='text-xs uppercase tracking-wider text-primary-500/60 mb-2'>
                {card.title}
              </div>
              <div className='flex items-baseline gap-2'>
                <span className='font-display text-5xl text-primary-500 tracking-tight'>
                  {card.value}
                </span>
                <span className='text-primary-500/60 font-medium'>{card.unit}</span>
              </div>
              <p className='mt-[16px] text-xs italic text-primary-500/65 leading-relaxed'>
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
    <section className='grid grid-cols-1 md:grid-cols-3 gap-[20px]'>
      {[0, 1, 2].map(i => (
        <div
          key={i}
          className='glass rounded-2xl p-[24px] shadow-soft h-[200px] animate-pulse bg-white/30'
        />
      ))}
    </section>
  );
}
