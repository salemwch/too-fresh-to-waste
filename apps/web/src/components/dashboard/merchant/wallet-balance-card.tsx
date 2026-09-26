'use client';

import { Clock, Wallet } from 'lucide-react';
import { motion } from 'framer-motion';
import { useLocale, useTranslations } from 'next-intl';

import { InfoDisclosure } from '@/components/ui/info-disclosure';
import { useMyWallet } from '@/hooks/use-merchant-dashboard';
import { formatMoney } from '@/lib/format';

/**
 * Online payments TFTW holds for the merchant - and only those.
 *
 * Cash orders are paid to the merchant directly (at the counter, or by the
 * driver from the TFTW float) and never pass through this wallet; the card
 * says so, and Today's sales shows every payment method. Both balances carry
 * an info disclosure (DESIGN.md §13.12): "pending" moves to "available" when
 * the pickup is CONFIRMED - the previous copy said "when the pickup window
 * closes", which is not what the backend does.
 */
export function WalletBalanceCard() {
  const t = useTranslations('dashboard.walletBalance');
  const locale = useLocale();
  const { data, isLoading, isError } = useMyWallet();

  if (isLoading) {
    return <WalletBalanceCardSkeleton />;
  }

  // Was `isLoading || !data`: a failed request showed the skeleton forever.
  if (isError || !data) {
    return (
      <div className='glass rounded-2xl p-lg shadow-soft'>
        <p className='text-sm text-primary-500/65'>{t('error')}</p>
      </div>
    );
  }

  const money = (value: number) => formatMoney(locale, value, data.currency);

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className='glass rounded-2xl p-lg shadow-soft'
      aria-labelledby='wallet-balance-title'
    >
      <h2
        id='wallet-balance-title'
        className='text-xs uppercase tracking-wider text-primary-500/60 mb-md'
      >
        {t('title')}
      </h2>

      <div className='grid grid-cols-2 gap-lg'>
        <div>
          <InfoDisclosure
            label={
              <span className='flex items-center gap-xs text-xs uppercase tracking-wider text-primary-500/60'>
                <Wallet size={14} className='text-primary-500' aria-hidden='true' />
                {t('available')}
              </span>
            }
            buttonLabel={t('availableInfoLabel')}
          >
            {t('availableInfo')}
          </InfoDisclosure>
          <div className='mt-xs font-mono text-2xl font-bold tabular-nums text-primary-500'>
            {money(data.availableBalance)}
          </div>
          <p className='mt-xs text-xs text-primary-500/65 leading-snug'>{t('availableNote')}</p>
        </div>

        <div>
          <InfoDisclosure
            label={
              <span className='flex items-center gap-xs text-xs uppercase tracking-wider text-primary-500/60'>
                <Clock size={14} className='text-primary-500/60' aria-hidden='true' />
                {t('pending')}
              </span>
            }
            buttonLabel={t('pendingInfoLabel')}
          >
            {t('pendingInfo')}
          </InfoDisclosure>
          <div className='mt-xs font-mono text-2xl font-bold tabular-nums text-primary-500/70'>
            {money(data.pendingBalance)}
          </div>
          <p className='mt-xs text-xs text-primary-500/65 leading-snug'>{t('pendingNote')}</p>
        </div>
      </div>

      <p className='mt-md border-t border-primary-500/10 pt-sm text-xs text-primary-500/65'>
        {t('cashNotHere')}
      </p>
    </motion.section>
  );
}

function WalletBalanceCardSkeleton() {
  return (
    <div
      data-testid='wallet-balance-skeleton'
      className='glass rounded-2xl p-lg shadow-soft h-[132px] animate-pulse bg-white/30'
    />
  );
}
