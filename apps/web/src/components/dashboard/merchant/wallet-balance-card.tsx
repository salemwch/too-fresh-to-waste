'use client';

import { Wallet, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { useMyWallet } from '@/hooks/use-merchant-dashboard';

function formatMoney(v: number): string {
  return v.toFixed(2);
}

export function WalletBalanceCard() {
  const t = useTranslations('dashboard.walletBalance');
  const { data, isLoading } = useMyWallet();

  if (isLoading || !data) {
    return <WalletBalanceCardSkeleton />;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className='glass rounded-2xl p-lg shadow-soft relative overflow-hidden'
    >
      <div className='absolute -top-3xl -right-3xl h-40 w-40 rounded-full bg-brand-coral/10 blur-2xl pointer-events-none' />

      <div className='relative text-[10px] uppercase tracking-wider text-primary-500/60 mb-md'>
        {t('title')}
      </div>

      <div className='relative grid grid-cols-2 gap-lg'>
        <div>
          <div className='flex items-center gap-xs mb-1.5'>
            <Wallet size={14} className='text-primary-500' />
            <span className='text-[10px] uppercase tracking-wider text-primary-500/60'>
              {t('available')}
            </span>
          </div>
          <div className='flex items-baseline gap-sm'>
            <span className='font-display text-2xl text-primary-500 tracking-tight'>
              {formatMoney(data.availableBalance)}
            </span>
            <span className='text-xs text-primary-500/60 font-medium'>{data.currency}</span>
          </div>
          <p className='mt-sm text-[11px] italic text-primary-500/65 leading-snug'>
            {t('availableNote')}
          </p>
        </div>

        <div>
          <div className='flex items-center gap-xs mb-1.5'>
            <Clock size={14} className='text-primary-500/60' />
            <span className='text-[10px] uppercase tracking-wider text-primary-500/60'>
              {t('pending')}
            </span>
          </div>
          <div className='flex items-baseline gap-sm'>
            <span className='font-display text-2xl text-primary-500/70 tracking-tight'>
              {formatMoney(data.pendingBalance)}
            </span>
            <span className='text-xs text-primary-500/60 font-medium'>{data.currency}</span>
          </div>
          <p className='mt-sm text-[11px] italic text-primary-500/65 leading-snug'>
            {t('pendingNote')}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

export function WalletBalanceCardSkeleton() {
  return <div className='glass rounded-2xl p-lg shadow-soft h-[132px] animate-pulse bg-white/30' />;
}
