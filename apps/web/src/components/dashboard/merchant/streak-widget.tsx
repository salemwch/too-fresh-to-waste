'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Snowflake, Trophy, AlertTriangle, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useStreakData } from '@/hooks/use-merchant-dashboard';

interface StreakWidgetProps {
  onListOffer: () => void;
  disabled?: boolean;
}

export function StreakWidget({ onListOffer, disabled }: StreakWidgetProps) {
  const t = useTranslations('dashboard.streak');
  const { data, isLoading, isError } = useStreakData();

  if (isLoading) return <StreakWidgetSkeleton />;
  if (isError || !data) return null;

  const {
    currentStreak,
    longestStreak,
    freezesAvailable,
    streakAtRisk,
    listedToday,
    nextFreezeAt,
  } = data;

  const isRecord = currentStreak > 0 && currentStreak === longestStreak && currentStreak >= 3;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className={`glass rounded-2xl shadow-soft overflow-hidden relative ${streakAtRisk ? 'ring-1 ring-brand-coral/40' : ''}`}
    >
      {/* At-risk pulse border */}
      <AnimatePresence>
        {streakAtRisk && currentStreak > 0 && (
          <motion.div
            className='absolute inset-0 rounded-2xl ring-2 ring-brand-coral/60 pointer-events-none'
            animate={{ opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        )}
      </AnimatePresence>

      <div className='flex items-center gap-0 divide-x divide-primary-500/[0.08]'>
        {/* Flame + streak count */}
        <div className='flex items-center gap-[14px] px-[24px] py-[20px] flex-1 min-w-0'>
          <div
            className={`text-4xl leading-none select-none ${streakAtRisk && currentStreak > 0 ? 'animate-pulse' : ''}`}
          >
            🔥
          </div>
          <div className='min-w-0'>
            <div className='flex items-baseline gap-1.5'>
              <span className='font-display text-4xl text-primary-500 tracking-tight leading-none'>
                {currentStreak}
              </span>
              <span className='text-sm text-primary-500/60 font-medium'>{t('days')}</span>
              {isRecord && (
                <span className='flex items-center gap-xxs text-[10px] font-semibold text-brand-green uppercase tracking-wider'>
                  <Trophy size={10} />
                  {t('record')}
                </span>
              )}
            </div>
            <div className='text-xs text-primary-500/50 mt-xxs'>
              {listedToday
                ? t('listedToday')
                : currentStreak === 0
                  ? t('startStreak')
                  : t('notListedYet')}
            </div>
          </div>
        </div>

        {/* Freezes */}
        <div className='px-[20px] py-[20px] flex flex-col items-center gap-xs shrink-0'>
          <div className='flex items-center gap-[5px]'>
            {Array.from({ length: 3 }).map((_, i) => (
              <Snowflake
                key={i}
                size={16}
                className={i < freezesAvailable ? 'text-sky-400' : 'text-primary-500/15'}
              />
            ))}
          </div>
          <span className='text-[10px] text-primary-500/50 whitespace-nowrap'>{t('freezes')}</span>
          {freezesAvailable < 3 && nextFreezeAt > 0 && (
            <span className='text-[10px] text-primary-500/40'>
              +1 {t('inDays', { n: nextFreezeAt })}
            </span>
          )}
        </div>

        {/* Longest streak */}
        <div className='px-[20px] py-[20px] flex flex-col items-center gap-xxs shrink-0'>
          <span className='font-display text-xl text-primary-500/40'>{longestStreak}</span>
          <span className='text-[10px] text-primary-500/40 whitespace-nowrap'>{t('best')}</span>
        </div>

        {/* CTA — shown when not yet listed today */}
        {!listedToday && (
          <div className='px-[20px] py-[20px] shrink-0'>
            <motion.button
              {...(disabled ? {} : { whileTap: { scale: 0.95 } })}
              onClick={disabled ? undefined : onListOffer}
              disabled={disabled}
              className={`flex items-center gap-1.5 px-[14px] py-[8px] rounded-xl text-sm font-semibold text-white transition-colors ${
                disabled
                  ? 'bg-primary-500/40 cursor-not-allowed'
                  : streakAtRisk
                    ? 'bg-brand-coral hover:brightness-105'
                    : 'bg-primary-500 hover:brightness-105'
              }`}
            >
              {streakAtRisk ? (
                <>
                  <AlertTriangle size={13} />
                  {t('listNow')}
                </>
              ) : (
                <>
                  <Plus size={13} />
                  {t('listToday')}
                </>
              )}
            </motion.button>
          </div>
        )}
      </div>

      {/* Progress bar to next freeze */}
      {freezesAvailable < 3 && currentStreak > 0 && (
        <div className='px-[24px] pb-[14px]'>
          <div className='flex items-center justify-between text-[10px] text-primary-500/40 mb-xs'>
            <span>{t('nextFreeze')}</span>
            <span>
              {7 - nextFreezeAt}/{7} {t('days')}
            </span>
          </div>
          <div className='h-[3px] rounded-full bg-primary-500/[0.08] overflow-hidden'>
            <motion.div
              className='h-full rounded-full bg-sky-400/70'
              initial={{ width: 0 }}
              animate={{ width: `${((7 - nextFreezeAt) / 7) * 100}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </div>
        </div>
      )}
    </motion.div>
  );
}

function StreakWidgetSkeleton() {
  return <div className='glass rounded-2xl shadow-soft h-[80px] animate-pulse bg-white/30' />;
}
