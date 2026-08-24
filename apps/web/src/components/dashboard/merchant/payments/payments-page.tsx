'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import {
  Wallet,
  DollarSign,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowDownToLine,
  Banknote,
  TrendingUp,
  ShoppingBag,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useMerchantPayments, usePaymentStats } from '@/hooks/use-payments';
import type { PaymentStatus, PaymentQueryFilters, MerchantPayment } from '@/types/payments';

// ─── Status badge config ────────────────────────────────────────────────────

const PAYMENT_STATUS_STYLES: Record<string, { bg: string; icon: typeof CheckCircle2 }> = {
  completed: { bg: 'bg-emerald-500/10 text-emerald-600 border-emerald-200', icon: CheckCircle2 },
  pending: { bg: 'bg-amber-500/10 text-amber-600 border-amber-200', icon: Clock },
  processing: { bg: 'bg-blue-500/10 text-blue-600 border-blue-200', icon: Clock },
  failed: { bg: 'bg-destructive/10 text-destructive border-destructive/20', icon: XCircle },
  refunded: { bg: 'bg-violet-500/10 text-violet-600 border-violet-200', icon: ArrowDownToLine },
  cancelled: { bg: 'bg-muted text-muted-foreground border-border', icon: XCircle },
};

// ─── Skeletons ──────────────────────────────────────────────────────────────

function StatsCardsSkeleton() {
  return (
    <div className='grid grid-cols-2 lg:grid-cols-4 gap-lg'>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className='glass rounded-2xl p-[24px] shadow-soft'>
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

// ─── Error state ────────────────────────────────────────────────────────────

function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className='glass rounded-2xl p-[24px] shadow-soft'>
      <div className='flex flex-col items-center justify-center py-6xl gap-md text-center'>
        <AlertCircle className='size-12 text-muted-foreground' />
        <p className='text-sm text-muted-foreground'>{message}</p>
        {onRetry && (
          <Button variant='outline' size='sm' onClick={onRetry}>
            Retry
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Stats Cards ────────────────────────────────────────────────────────────

function PaymentStatsCards() {
  const t = useTranslations('dashboard.payments');
  const { data: stats, isLoading, isError, refetch } = usePaymentStats();

  if (isLoading) return <StatsCardsSkeleton />;
  if (isError) return <ErrorState message={t('error')} onRetry={() => void refetch()} />;
  if (!stats) return null;

  const cards = [
    {
      label: t('stats.totalCollected'),
      value: `${(stats.totalRevenue ?? 0).toFixed(2)} ${t('tndCurrency')}`,
      icon: DollarSign,
    },
    {
      label: t('stats.completedOrders'),
      value: stats.completedPayments,
      icon: CheckCircle2,
    },
    {
      label: t('stats.pendingCollection'),
      value: stats.pendingPayments,
      icon: Clock,
    },
    {
      label: t('stats.todayRevenue'),
      value: `${(stats.averageOrderValue ?? 0).toFixed(2)} ${t('tndCurrency')}`,
      icon: TrendingUp,
      subtitle: 'avg/order',
    },
  ];

  return (
    <div className='grid grid-cols-2 lg:grid-cols-4 gap-md'>
      {cards.map((card, i) => {
        const Icon = card.icon;
        return (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.08, duration: 0.3 }}
            className='glass rounded-xl p-lg shadow-soft relative overflow-hidden'
          >
            <div className='absolute -top-lg -end-lg w-16 h-16 rounded-full bg-brand-coral/10 blur-2xl' />
            <div className='relative'>
              <div className='h-8 w-8 rounded-lg bg-primary-500/[0.08] flex items-center justify-center mb-sm'>
                <Icon className='size-4 text-primary-500' />
              </div>
              <p className='text-[11px] text-muted-foreground'>{card.label}</p>
              <p className='font-display text-lg text-primary-500 font-bold mt-xxs'>{card.value}</p>
              {card.subtitle && (
                <p className='text-[11px] text-muted-foreground'>{card.subtitle}</p>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

// ─── Payment Row ────────────────────────────────────────────────────────────

function PaymentRow({ payment }: { payment: MerchantPayment }) {
  const t = useTranslations('dashboard.payments');
  const statusConfig = PAYMENT_STATUS_STYLES[payment.status] || PAYMENT_STATUS_STYLES.pending;
  const StatusIcon = statusConfig.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className='glass rounded-xl p-lg shadow-soft hover:shadow-md transition-shadow'
    >
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-md flex-1 min-w-0'>
          <div className='size-10 rounded-lg bg-primary-500/[0.08] flex items-center justify-center shrink-0'>
            <Banknote className='size-5 text-primary-500' />
          </div>
          <div className='min-w-0'>
            <div className='flex items-center gap-sm'>
              <p className='text-sm font-semibold truncate'>
                {payment.orderNumber ? `#${payment.orderNumber}` : `#${payment.orderId.slice(-8)}`}
              </p>
              <Badge variant='outline' className={`text-xs shrink-0 ${statusConfig.bg}`}>
                <StatusIcon className='size-3 me-xs' />
                {t(`status.${payment.status}`)}
              </Badge>
            </div>
            <div className='flex items-center gap-md text-xs text-muted-foreground mt-xxs'>
              {payment.customerName && (
                <span className='flex items-center gap-xs'>
                  <ShoppingBag className='size-3' />
                  {payment.customerName}
                </span>
              )}
              <span>{t(`methods.${payment.paymentMethod}`)}</span>
              <span>{new Date(payment.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
        <p className='font-display text-lg font-bold text-primary-500 shrink-0 ms-lg'>
          {(payment.amount ?? 0).toFixed(2)}{' '}
          <span className='text-xs font-normal'>{t('tndCurrency')}</span>
        </p>
      </div>
    </motion.div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export function PaymentsPage() {
  const t = useTranslations('dashboard.payments');
  const [filters, setFilters] = useState<PaymentQueryFilters>({ limit: 20 });
  const { data, isLoading, isError, refetch } = useMerchantPayments(filters);

  function handleStatusFilter(value: string) {
    setFilters(prev => {
      if (value === 'all') {
        const { status: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, status: value as PaymentStatus };
    });
  }

  function handleDateFilter(value: string) {
    const now = new Date();
    let fromDate: string | undefined;

    if (value === 'today') {
      fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    } else if (value === 'thisWeek') {
      const dayOfWeek = now.getDay();
      const monday = new Date(now);
      monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7));
      monday.setHours(0, 0, 0, 0);
      fromDate = monday.toISOString();
    } else if (value === 'thisMonth') {
      fromDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    }

    setFilters(prev => {
      if (value === 'all') {
        const { fromDate: _, toDate: __, ...rest } = prev;
        return rest;
      }
      return { ...prev, ...(fromDate ? { fromDate } : {}) };
    });
  }

  const payments = data?.payments || [];

  return (
    <div className='space-y-2xl'>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className='font-display text-3xl md:text-4xl text-primary-500 font-bold'>
          {t('title')}
        </h1>
        <p className='text-sm text-muted-foreground mt-xs'>{t('subtitle')}</p>
      </motion.div>

      {/* Stats */}
      <PaymentStatsCards />

      {/* Filters */}
      <div className='flex flex-wrap gap-sm'>
        <Select value={filters.status || 'all'} onValueChange={handleStatusFilter}>
          <SelectTrigger className='h-8 w-auto min-w-[120px] text-xs'>
            <SelectValue placeholder={t('filters.allStatuses')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>{t('filters.allStatuses')}</SelectItem>
            <SelectItem value='completed'>{t('filters.collected')}</SelectItem>
            <SelectItem value='pending'>{t('filters.pending')}</SelectItem>
            <SelectItem value='refunded'>{t('filters.refunded')}</SelectItem>
            <SelectItem value='failed'>{t('filters.failed')}</SelectItem>
          </SelectContent>
        </Select>

        <Select defaultValue='all' onValueChange={handleDateFilter}>
          <SelectTrigger className='h-8 w-auto min-w-[120px] text-xs'>
            <SelectValue placeholder={t('filters.dateRange')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>{t('filters.dateRange')}</SelectItem>
            <SelectItem value='today'>{t('filters.today')}</SelectItem>
            <SelectItem value='thisWeek'>{t('filters.thisWeek')}</SelectItem>
            <SelectItem value='thisMonth'>{t('filters.thisMonth')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Payment list */}
      {isLoading ? (
        <PaymentListSkeleton />
      ) : isError ? (
        <ErrorState message={t('error')} onRetry={() => void refetch()} />
      ) : payments.length === 0 ? (
        <div className='glass rounded-2xl p-[24px] shadow-soft'>
          <div className='flex flex-col items-center justify-center py-6xl gap-md text-center'>
            <Wallet className='size-12 text-muted-foreground' />
            <h3 className='text-md font-semibold'>{t('empty.title')}</h3>
            <p className='text-sm text-muted-foreground max-w-xs'>{t('empty.description')}</p>
          </div>
        </div>
      ) : (
        <div className='space-y-md'>
          {payments.map(payment => (
            <PaymentRow key={payment.id} payment={payment} />
          ))}
        </div>
      )}

      {/* Load more */}
      {data?.hasMore && (
        <div className='flex justify-center pt-sm'>
          <Button
            variant='outline'
            onClick={() =>
              setFilters(prev => ({
                ...prev,
                ...(data.nextCursor ? { after: data.nextCursor } : {}),
              }))
            }
          >
            Load More
          </Button>
        </div>
      )}
    </div>
  );
}
