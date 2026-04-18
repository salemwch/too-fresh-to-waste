'use client';

import { motion } from 'framer-motion';
import { Users, Target, Heart, TrendingUp, Award } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { dashboardService } from '@/services/dashboard.service';
import { dashboardKeys, useSocialImpact } from '@/hooks/use-merchant-dashboard';
import type { CommunityBagGoalStats, DonationStats } from '@/types/dashboard';

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString('fr-FR');
}

function StatCard({
  title,
  value,
  sub,
  icon: Icon,
  delay = 0,
}: {
  title: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className='glass rounded-2xl p-[24px] shadow-soft relative overflow-hidden group'
    >
      <div className='absolute -top-10 -right-10 h-32 w-32 rounded-full bg-brand-coral/8 blur-2xl group-hover:bg-brand-coral/15 transition-colors pointer-events-none' />
      <div className='h-10 w-10 rounded-xl bg-primary-500/[0.08] grid place-items-center text-primary-500 mb-4'>
        <Icon size={18} />
      </div>
      <div className='text-xs uppercase tracking-wider text-primary-500/60 mb-1'>{title}</div>
      <div className='font-display text-4xl text-primary-500 tracking-tight'>{value}</div>
      {sub && <p className='mt-2 text-xs text-primary-500/55'>{sub}</p>}
    </motion.div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function CommunityPage() {
  const communityQuery = useQuery({
    queryKey: dashboardKeys.communityGoal(),
    queryFn: async (): Promise<CommunityBagGoalStats> => {
      const response = await dashboardService.getCommunityGoalStats();
      return response.data.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const donationQuery = useQuery({
    queryKey: dashboardKeys.donationStats(),
    queryFn: async (): Promise<DonationStats> => {
      const response = await dashboardService.getDonationStats();
      return response.data.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const socialQuery = useSocialImpact();

  const community = communityQuery.data;
  const donations = donationQuery.data;
  const social = socialQuery.data;

  return (
    <div className='space-y-[32px]'>
      {/* Page header */}
      <div>
        <div className='text-xs uppercase tracking-[0.18em] text-primary-500/60 mb-2'>
          Communauté · Too Fresh to Waste
        </div>
        <h1 className='font-display text-3xl md:text-4xl text-primary-500 leading-[1.05]'>
          Votre Impact Communautaire
        </h1>
        <p className='mt-2 text-primary-500/65 text-sm max-w-xl'>
          Ensemble, les marchands de notre réseau sauvent des milliers de repas chaque jour. Voici
          votre contribution à la mission collective.
        </p>
      </div>

      {/* Your social impact stats */}
      <div>
        <div className='text-xs uppercase tracking-wider text-primary-500/60 mb-4'>
          Votre contribution
        </div>
        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[20px]'>
          <StatCard
            title='Repas distribués'
            value={fmt(social?.mealsDistributed ?? 0)}
            sub='repas sauvés depuis toujours'
            icon={Heart}
            delay={0}
          />
          <StatCard
            title='Personnes nourries'
            value={`~${fmt(social?.peopleServedEstimate ?? 0)}`}
            sub='bénéficiaires estimés'
            icon={Users}
            delay={0.07}
          />
          <StatCard
            title='Valeur alimentaire'
            value={`${fmt(social?.estimatedValueTnd ?? 0)} TND`}
            sub='de nourriture sauvée'
            icon={Award}
            delay={0.14}
          />
          <StatCard
            title='Poids rescapé'
            value={`${fmt(social?.foodWeightKg ?? 0)} kg`}
            sub='de gaspillage évité'
            icon={TrendingUp}
            delay={0.21}
          />
        </div>
      </div>

      {/* Community goal */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className='glass rounded-2xl p-[24px] shadow-soft'
      >
        <div className='flex items-center gap-3 mb-[20px]'>
          <div className='h-10 w-10 rounded-xl bg-primary-500/[0.08] grid place-items-center text-primary-500'>
            <Target size={18} />
          </div>
          <div>
            <div className='text-xs uppercase tracking-wider text-primary-500/60'>
              Objectif Communautaire
            </div>
            <div className='font-semibold text-primary-500'>
              Cycle #{community?.cycleNumber ?? '—'}
            </div>
          </div>
          <div className='ml-auto'>
            <span
              className='text-[10px] px-2.5 py-1 rounded-full font-medium capitalize'
              style={{
                background: community?.status === 'completed' ? '#1e4448' : 'rgba(30,68,72,0.08)',
                color: community?.status === 'completed' ? '#fff' : '#1e4448',
              }}
            >
              {community?.status ?? 'actif'}
            </span>
          </div>
        </div>

        <div className='flex items-end justify-between mb-2'>
          <span className='text-sm text-primary-500/70'>
            <span className='font-semibold text-primary-500'>
              {fmt(community?.currentCount ?? 0)}
            </span>{' '}
            / {fmt(community?.targetCount ?? 10000)} paniers
          </span>
          <span className='font-semibold text-primary-500'>
            {community?.progressPercentage ?? 0}%
          </span>
        </div>
        <div className='h-3 w-full rounded-full bg-primary-500/[0.08] overflow-hidden'>
          <motion.div
            className='h-full rounded-full bg-gradient-to-r from-primary-500 to-[#2a5e63]'
            initial={{ width: 0 }}
            animate={{ width: `${community?.progressPercentage ?? 0}%` }}
            transition={{ duration: 1.4, ease: 'easeOut' }}
          />
        </div>
        {community && community.remaining > 0 && (
          <p className='mt-3 text-xs text-primary-500/55'>
            Plus que{' '}
            <span className='font-semibold text-primary-500'>
              {fmt(community.remaining)} paniers
            </span>{' '}
            pour compléter cet objectif communautaire !
          </p>
        )}
      </motion.div>

      {/* Donation pool */}
      {donations && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.18 }}
          className='glass rounded-2xl p-[24px] shadow-soft'
        >
          <div className='flex items-center gap-3 mb-[20px]'>
            <div className='h-10 w-10 rounded-xl bg-brand-coral/10 grid place-items-center text-brand-coral'>
              <Heart size={18} />
            </div>
            <div>
              <div className='text-xs uppercase tracking-wider text-primary-500/60'>
                Cagnotte Solidaire
              </div>
              <div className='font-semibold text-primary-500'>{donations.cause}</div>
            </div>
          </div>

          <div className='grid grid-cols-2 sm:grid-cols-4 gap-4 mb-[20px]'>
            {[
              {
                label: 'Collecté',
                value: `${fmt(donations.totalDonations)} ${donations.currency}`,
              },
              { label: 'Objectif', value: `${fmt(donations.targetAmount)} ${donations.currency}` },
              { label: 'Repas financés', value: `${fmt(donations.mealCount)}` },
              { label: 'Contributeurs', value: `${fmt(donations.contributorCount)}` },
            ].map(item => (
              <div key={item.label} className='text-center p-3 rounded-xl bg-primary-500/[0.04]'>
                <div className='text-xs text-primary-500/55 mb-1'>{item.label}</div>
                <div className='font-semibold text-primary-500 text-sm'>{item.value}</div>
              </div>
            ))}
          </div>

          <div className='flex items-end justify-between mb-2'>
            <span className='text-xs text-primary-500/60'>Progression de la collecte</span>
            <span className='font-semibold text-brand-coral'>{donations.progressPercentage}%</span>
          </div>
          <div className='h-2 w-full rounded-full bg-primary-500/[0.08] overflow-hidden'>
            <motion.div
              className='h-full rounded-full bg-brand-coral'
              initial={{ width: 0 }}
              animate={{ width: `${donations.progressPercentage}%` }}
              transition={{ duration: 1.2, ease: 'easeOut' }}
            />
          </div>
        </motion.div>
      )}
    </div>
  );
}
