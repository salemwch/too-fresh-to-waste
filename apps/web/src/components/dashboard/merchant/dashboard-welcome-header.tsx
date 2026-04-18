'use client';

import { Bell, Search } from 'lucide-react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useAuthStore } from '@/lib/auth';
import { useNotificationStore } from '@/lib/notification-store';
import { resolveProfileImage } from '@/lib/media';
import { useEsgTier, useMonthlyGoal } from '@/hooks/use-merchant-dashboard';
import type { MyEstablishment } from '@/types/dashboard';

interface DashboardWelcomeHeaderProps {
  establishment: MyEstablishment | null | undefined;
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function DashboardWelcomeHeader({ establishment }: DashboardWelcomeHeaderProps) {
  const user = useAuthStore(s => s.user);
  const unreadCount = useNotificationStore(s => s.unreadCount);
  const esgQuery = useEsgTier();
  const goalQuery = useMonthlyGoal();

  const city = establishment?.address?.city;
  const dateLabel =
    capitalize(format(new Date(), 'EEEE d MMMM', { locale: fr })) + (city ? ` · ${city}` : '');

  const ringProgress = esgQuery.data?.ringProgress ?? 72;
  const tierLabel = esgQuery.data
    ? esgQuery.data.currentBadge
      ? `${esgQuery.data.currentLabel} ${esgQuery.data.currentBadge}`
      : esgQuery.data.currentLabel
    : 'Ambassadeur';

  const treesEquivalent = goalQuery.data?.treesEquivalent ?? 1;
  const currentMonthBags = goalQuery.data?.currentMonthBags ?? 0;
  const targetBags = goalQuery.data?.targetBagsPerMonth ?? 300;
  const goalProgress = goalQuery.data?.progressPercentage ?? 0;

  const r = 18;
  const c = 2 * Math.PI * r;

  const avatar = user
    ? resolveProfileImage(user.profileImage ?? undefined, user.avatar ?? undefined)
    : null;

  return (
    <header className='space-y-[24px]'>
      <div className='flex items-start justify-between gap-[24px] flex-wrap'>
        {/* Greeting */}
        <div className='flex-1 min-w-[280px]'>
          <div className='text-xs uppercase tracking-[0.18em] text-primary-500/60 mb-2'>
            {dateLabel}
          </div>
          <h1 className='font-display text-3xl md:text-4xl lg:text-5xl text-primary-500 leading-[1.05]'>
            Félicitations, {user?.firstName ?? 'Merchant'}.
          </h1>
          <p className='mt-3 text-primary-500/70 text-base md:text-lg max-w-2xl'>
            Votre impact aujourd&apos;hui est équivalent à{' '}
            <span className='text-primary-500 font-semibold'>{treesEquivalent} arbres plantés</span>
            .
          </p>
        </div>

        {/* Actions + ESG badge */}
        <div className='flex items-center gap-3'>
          <button
            className='h-11 w-11 grid place-items-center rounded-full glass shadow-soft'
            aria-label='Search'
          >
            <Search size={18} className='text-primary-500' />
          </button>

          <button
            className='h-11 w-11 grid place-items-center rounded-full glass shadow-soft relative'
            aria-label='Notifications'
          >
            <Bell size={18} className='text-primary-500' />
            {unreadCount > 0 && (
              <span className='absolute top-2.5 right-2.5 h-2 w-2 rounded-full bg-brand-coral' />
            )}
          </button>

          {/* ESG status badge */}
          <div className='flex items-center gap-3 pl-3 pr-[16px] py-1.5 rounded-full glass shadow-soft'>
            <div className='relative h-11 w-11 shrink-0'>
              <svg viewBox='0 0 44 44' className='h-11 w-11 -rotate-90'>
                <circle
                  cx='22'
                  cy='22'
                  r={r}
                  fill='none'
                  stroke='rgba(30,68,72,0.1)'
                  strokeWidth='3'
                />
                <motion.circle
                  cx='22'
                  cy='22'
                  r={r}
                  fill='none'
                  stroke='#FF7973'
                  strokeWidth='3'
                  strokeLinecap='round'
                  strokeDasharray={c}
                  initial={{ strokeDashoffset: c }}
                  animate={{ strokeDashoffset: c - (c * ringProgress) / 100 }}
                  transition={{ duration: 1.4, ease: 'easeOut' }}
                />
              </svg>
              {avatar ? (
                <img
                  src={avatar}
                  alt={user?.firstName ?? ''}
                  className='absolute inset-1 h-9 w-9 rounded-full object-cover'
                />
              ) : (
                <div className='absolute inset-1 h-9 w-9 rounded-full bg-primary-500/20 grid place-items-center text-primary-500 text-sm font-semibold'>
                  {user?.firstName?.[0]}
                  {user?.lastName?.[0]}
                </div>
              )}
            </div>
            <div className='hidden sm:block leading-tight'>
              <div className='text-[10px] uppercase tracking-wider text-primary-500/60'>
                Statut ESG
              </div>
              <div className='text-sm font-semibold text-primary-500'>
                {tierLabel.includes(' ') ? (
                  <>
                    {tierLabel.split(' ')[0]}{' '}
                    <span className='text-brand-coral'>
                      {tierLabel.split(' ').slice(1).join(' ')}
                    </span>
                  </>
                ) : (
                  <span className='text-brand-coral'>{tierLabel}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Monthly Green Goal */}
      <div>
        <div className='flex items-center justify-between text-xs mb-2'>
          <span className='text-primary-500/70'>
            Monthly Green Goal ·{' '}
            <span className='font-medium text-primary-500'>
              {currentMonthBags} / {targetBags} paniers sauvés
            </span>
          </span>
          <span className='font-semibold text-primary-500'>{goalProgress}%</span>
        </div>
        <div className='h-1.5 w-full rounded-full bg-primary-500/[0.08] overflow-hidden'>
          <motion.div
            className='h-full rounded-full bg-brand-coral'
            initial={{ width: 0 }}
            animate={{ width: `${goalProgress}%` }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
          />
        </div>
      </div>
    </header>
  );
}
