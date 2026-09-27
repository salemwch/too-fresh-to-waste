'use client';

import { Suspense, useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import {
  Wallet,
  DollarSign,
  ShoppingBag,
  AlertCircle,
  RotateCcw,
  ShieldAlert,
  Banknote,
  Store,
  Globe,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PeriodBar } from '@/components/dashboard/merchant/period-bar';
import { useSalesPeriod } from '@/hooks/use-sales-period';
import { usePaymentStats, useMerchantEarningsRows } from '@/hooks/use-payments';
import { useFormat, MISSING_COUNT } from '@/lib/use-format';
import { EARNINGS_TABS } from '@/types/payments';
import type { EarningsRow, EarningsTab, MerchantSalesSummary, PaymentLine } from '@/types/payments';

const LINE_ICONS: Record<PaymentLine, typeof Banknote> = {
  cashStore: Banknote,
  cashDelivery: Banknote,
  online: Globe,
};

// ─── Skeletons ──────────────────────────────────────────────────────────────

function StatsCardsSkeleton() {
  return (
    <div className='grid grid-cols-2 gap-md lg:grid-cols-5'>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className='glass rounded-xl p-lg shadow-soft'>
          <Skeleton className='h-4 w-24 mb-md' />
          <Skeleton className='h-8 w-20' />
        </div>
      ))}
    </div>
  );
}

function PaymentListSkeleton() {
  return (
    <div className='space-y-md'>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className='glass rounded-xl p-lg shadow-soft'>
          <div className='flex items-center justify-between'>
            <div className='space-y-sm'>
              <Skeleton className='h-5 w-40' />
              <Skeleton className='h-4 w-28' />
            </div>
            <Skeleton className='h-6 w-20' />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Error / empty states ───────────────────────────────────────────────────

function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const tCommon = useTranslations('common');
  return (
    <div className='glass rounded-2xl p-[24px] shadow-soft'>
      <div className='flex flex-col items-center justify-center py-6xl gap-md text-center'>
        <AlertCircle className='size-12 text-muted-foreground' />
        <p className='text-sm text-muted-foreground'>{message}</p>
        {onRetry && (
          <Button variant='outline' size='sm' onClick={onRetry}>
            {tCommon('retry')}
          </Button>
        )}
      </div>
    </div>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className='glass rounded-2xl p-[24px] shadow-soft'>
      <div className='flex flex-col items-center justify-center py-6xl gap-md text-center'>
        <Wallet className='size-12 text-muted-foreground' />
        <h3 className='text-md font-semibold'>{title}</h3>
        <p className='text-sm text-muted-foreground max-w-xs'>{description}</p>
      </div>
    </div>
  );
}

// ─── Stats cards ────────────────────────────────────────────────────────────

function StatsCard({
  label,
  value,
  icon: Icon,
  delay,
}: {
  label: string;
  value: string | number;
  icon: typeof DollarSign;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
      className='glass rounded-xl p-lg shadow-soft relative overflow-hidden'
    >
      <div className='absolute -top-lg -end-lg w-16 h-16 rounded-full bg-brand-coral/10 blur-2xl' />
      <div className='relative'>
        <div className='h-8 w-8 rounded-lg bg-primary-500/[0.08] flex items-center justify-center mb-sm'>
          <Icon className='size-4 text-primary-500' />
        </div>
        <p className='text-[11px] text-muted-foreground'>{label}</p>
        <p className='font-display text-lg text-primary-500 font-bold mt-xxs'>{value}</p>
      </div>
    </motion.div>
  );
}

function PaymentStatsCards({ summary }: { summary: MerchantSalesSummary }) {
  const t = useTranslations('dashboard.payments');
  const tLines = useTranslations('dashboard.earnings.lines');
  const fmt = useFormat();

  const cards: Array<{ label: string; value: string | number; icon: typeof DollarSign }> = [
    { label: t('stats.totalEarned'), value: fmt.money(summary.total.earned), icon: DollarSign },
    { label: t('stats.orders'), value: fmt.count(summary.total.orders), icon: ShoppingBag },
    {
      label: tLines('cashStore'),
      value: fmt.money(summary.channels.cashStore.earned),
      icon: Banknote,
    },
    {
      label: tLines('cashDelivery'),
      value: fmt.money(summary.channels.cashDelivery.earned),
      icon: Banknote,
    },
    { label: tLines('online'), value: fmt.money(summary.channels.online.earned), icon: Globe },
  ];

  return (
    <div className='grid grid-cols-2 gap-md lg:grid-cols-5'>
      {cards.map((card, i) => (
        <StatsCard key={card.label} {...card} delay={0.1 + i * 0.06} />
      ))}
    </div>
  );
}

// ─── Tabs ───────────────────────────────────────────────────────────────────

function EarningsTabs({
  value,
  onChange,
}: {
  value: EarningsTab;
  onChange: (t: EarningsTab) => void;
}) {
  const t = useTranslations('dashboard.payments');
  return (
    <div
      role='tablist'
      aria-label={t('title')}
      className='inline-flex flex-wrap gap-xs rounded-full bg-primary-500/[0.06] p-xxs'
    >
      {EARNINGS_TABS.map(tab => (
        <button
          key={tab}
          type='button'
          role='tab'
          aria-selected={value === tab}
          onClick={() => onChange(tab)}
          className={`min-h-11 rounded-full px-md text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            value === tab
              ? 'bg-primary-500 text-white'
              : 'text-primary-500/70 hover:text-primary-500'
          }`}
        >
          {t(`tabs.${tab}`)}
        </button>
      ))}
    </div>
  );
}

// ─── Row ────────────────────────────────────────────────────────────────────

function EarningsRowCard({ row, tab }: { row: EarningsRow; tab: EarningsTab }) {
  const t = useTranslations('dashboard.payments');
  const tLines = useTranslations('dashboard.earnings.lines');
  const fmt = useFormat();
  const LineIcon = LINE_ICONS[row.line];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className='glass rounded-xl p-lg shadow-soft hover:shadow-md transition-shadow'
    >
      <div className='flex items-center justify-between gap-md'>
        <div className='flex items-center gap-md flex-1 min-w-0'>
          <div className='size-10 rounded-lg bg-primary-500/[0.08] flex items-center justify-center shrink-0'>
            <LineIcon className='size-5 text-primary-500' />
          </div>
          <div className='min-w-0'>
            <p className='text-sm font-semibold truncate'>#{row.orderNumber}</p>
            <div className='flex flex-wrap items-center gap-md text-xs text-muted-foreground mt-xxs'>
              {row.customerName && (
                <span className='flex items-center gap-xs'>
                  <ShoppingBag className='size-3' />
                  {row.customerName}
                </span>
              )}
              {row.establishmentName && (
                <span className='flex items-center gap-xs'>
                  <Store className='size-3' />
                  {row.establishmentName}
                </span>
              )}
              <span>{tLines(row.line)}</span>
              <span>{fmt.dateShort(row.commissionMoment) ?? MISSING_COUNT}</span>
            </div>
          </div>
        </div>

        <div className='text-end shrink-0 ms-lg'>
          {tab === 'earnings' && (
            <p className='font-display text-lg font-bold text-primary-500'>
              {fmt.money(row.earned)}
            </p>
          )}
          {tab === 'refunded' && (
            <div className='flex flex-col items-end gap-xxs'>
              <span className='inline-flex items-center gap-xs text-xs font-semibold text-destructive'>
                <RotateCcw className='size-3.5' />
                {t('tabs.refunded')}
              </span>
              {row.refundReason && (
                <p className='text-[11px] text-muted-foreground max-w-[180px] truncate'>
                  {row.refundReason}
                </p>
              )}
            </div>
          )}
          {tab === 'verifying' && (
            <span className='inline-flex items-center gap-xs text-xs font-semibold text-muted-foreground'>
              <ShieldAlert className='size-3.5' />
              {t('tabs.verifying')}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Content (reads useSearchParams via useSalesPeriod) ────────────────────

function PaymentsPageContent() {
  const t = useTranslations('dashboard.payments');
  const [period, setPeriod] = useSalesPeriod();
  const [activeTab, setActiveTab] = useState<EarningsTab>('earnings');

  const stats = usePaymentStats(period);
  const rowsQuery = useMerchantEarningsRows(period, activeTab);

  const rows = rowsQuery.data?.pages.flatMap(page => page.rows) ?? [];

  return (
    <div className='space-y-2xl'>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className='flex flex-wrap items-start justify-between gap-md'
      >
        <div>
          <h1 className='font-display text-3xl md:text-4xl text-primary-500 font-bold'>
            {t('title')}
          </h1>
          <p className='text-sm text-muted-foreground mt-xs'>{t('subtitle')}</p>
        </div>
        <PeriodBar value={period} onChange={setPeriod} />
      </motion.div>

      {/* Stats */}
      {stats.isLoading ? (
        <StatsCardsSkeleton />
      ) : stats.isError ? (
        <ErrorState message={t('error')} onRetry={() => void stats.refetch()} />
      ) : stats.data ? (
        <PaymentStatsCards summary={stats.data} />
      ) : null}

      {/* Tabs */}
      <EarningsTabs value={activeTab} onChange={setActiveTab} />

      {/* Verifying note */}
      {activeTab === 'verifying' && rows.length > 0 && (
        <div className='flex items-center gap-sm rounded-lg border border-border/60 bg-muted/30 px-md py-sm text-xs text-muted-foreground'>
          <AlertCircle className='size-4 shrink-0' />
          <span>{t('verifyingNote')}</span>
        </div>
      )}

      {/* Row list */}
      {rowsQuery.isLoading ? (
        <PaymentListSkeleton />
      ) : rowsQuery.isError ? (
        <ErrorState message={t('error')} onRetry={() => void rowsQuery.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState title={t('empty.title')} description={t('empty.description')} />
      ) : (
        <div className='space-y-md'>
          {rows.map(row => (
            <EarningsRowCard key={row.orderId} row={row} tab={activeTab} />
          ))}
        </div>
      )}

      {/* Load more */}
      {rowsQuery.hasNextPage && (
        <div className='flex justify-center pt-sm'>
          <Button
            variant='outline'
            disabled={rowsQuery.isFetchingNextPage}
            onClick={() => void rowsQuery.fetchNextPage()}
          >
            {t('loadMore')}
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Page (Suspense boundary — useSalesPeriod reads useSearchParams) ────────

export function PaymentsPage() {
  return (
    <Suspense
      fallback={
        <div className='space-y-2xl'>
          <Skeleton className='h-12 w-64' />
          <StatsCardsSkeleton />
          <PaymentListSkeleton />
        </div>
      }
    >
      <PaymentsPageContent />
    </Suspense>
  );
}
