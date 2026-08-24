'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  Star,
  MessageSquare,
  BarChart3,
  Flag,
  MoreHorizontal,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { LocationSwitcher } from '@/components/dashboard/organization/location-switcher';
import {
  useMerchantReviews,
  useReviewAnalytics,
  useTrendingKeywords,
  useReportReview,
} from '@/hooks/use-merchant-reviews';
import { useMyEstablishments } from '@/hooks/use-merchant-dashboard';
import type { Review, ReviewFilters, ReviewAnalyticsResponse } from '@/types/reviews';
import { REPORT_REASONS } from '@/types/reviews';

// ─── Star Rating Display ────────────────────────────────────────────────────

function StarRating({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <div className='flex items-center gap-xxs'>
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          size={size}
          className={i <= rating ? 'text-amber-400 fill-amber-400' : 'text-primary-500/20'}
        />
      ))}
    </div>
  );
}

// ─── Stats Header ───────────────────────────────────────────────────────────

function StatsHeader({
  data,
  isLoading,
  t,
}: {
  data: ReviewAnalyticsResponse | undefined;
  isLoading: boolean;
  t: ReturnType<typeof useTranslations>;
}) {
  if (isLoading) {
    return (
      <div className='grid grid-cols-1 sm:grid-cols-3 gap-md'>
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className='glass rounded-xl p-lg shadow-soft h-[100px] animate-pulse bg-white/30'
          />
        ))}
      </div>
    );
  }

  if (!data) return null;

  const stats = [
    {
      label: t('stats.averageRating'),
      value: (data.averageRating ?? 0).toFixed(1),
      icon: Star,
      extra: <StarRating rating={Math.round(data.averageRating ?? 0)} />,
    },
    {
      label: t('stats.totalReviews'),
      value: data.totalReviews.toLocaleString(),
      icon: MessageSquare,
    },
    {
      label: t('stats.ratingDistribution'),
      value: null,
      icon: BarChart3,
      distribution: data.ratingDistribution,
    },
  ];

  return (
    <div className='grid grid-cols-1 sm:grid-cols-3 gap-md'>
      {stats.map((stat, i) => {
        const Icon = stat.icon;
        return (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.06, duration: 0.5, ease: 'easeOut' }}
            className='glass rounded-xl p-lg shadow-soft relative overflow-hidden group'
          >
            <div className='absolute -top-2xl -end-2xl h-20 w-20 rounded-full bg-brand-coral/10 blur-2xl group-hover:bg-brand-coral/20 transition-colors pointer-events-none' />

            <div className='relative'>
              <div className='flex items-center gap-sm mb-sm'>
                <div className='h-7 w-7 rounded-md bg-primary-500/[0.08] grid place-items-center text-primary-500'>
                  <Icon size={14} />
                </div>
                <span className='text-[11px] uppercase tracking-wider text-primary-500/60'>
                  {stat.label}
                </span>
              </div>

              {stat.value !== null ? (
                <div className='font-display text-xl text-primary-500 tracking-tight'>
                  {stat.value}
                </div>
              ) : null}

              {stat.extra && <div className='mt-xs'>{stat.extra}</div>}

              {stat.distribution && (
                <div className='space-y-1.5 mt-xs'>
                  {[5, 4, 3, 2, 1].map(rating => {
                    const count = stat.distribution?.[String(rating)] ?? 0;
                    const total = Object.values(stat.distribution ?? {}).reduce(
                      (sum: number, v) => sum + (v as number),
                      0,
                    );
                    const pct = total > 0 ? (count / total) * 100 : 0;
                    return (
                      <div key={rating} className='flex items-center gap-sm'>
                        <span className='text-[10px] font-medium text-primary-500/60 w-3'>
                          {rating}
                        </span>
                        <div className='flex-1 h-[4px] rounded-full bg-primary-500/[0.08] overflow-hidden'>
                          <div
                            className='h-full rounded-full bg-amber-400'
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

// ─── Filters Bar ────────────────────────────────────────────────────────────

function FiltersBar({
  filters,
  onFiltersChange,
  t,
}: {
  filters: ReviewFilters;
  onFiltersChange: (updater: (prev: ReviewFilters) => ReviewFilters) => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const establishmentsQuery = useMyEstablishments();

  return (
    <div className='flex items-center gap-sm flex-wrap'>
      {/* Rating filter */}
      <Select
        value={filters.rating ? String(filters.rating) : 'all'}
        onValueChange={v =>
          onFiltersChange(prev => {
            const { rating: _, ...rest } = prev;
            return { ...rest, ...(v !== 'all' ? { rating: Number(v) } : {}), page: 1 };
          })
        }
      >
        <SelectTrigger className='h-8 w-auto min-w-[100px] text-xs glass shadow-soft border-0'>
          <SelectValue placeholder={t('filters.allRatings')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value='all'>{t('filters.allRatings')}</SelectItem>
          {[5, 4, 3, 2, 1].map(r => (
            <SelectItem key={r} value={String(r)}>
              {t('filters.stars', { count: r })}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Establishment filter */}
      {establishmentsQuery.data && establishmentsQuery.data.length > 1 && (
        <Select
          value={filters.establishmentId ?? 'all'}
          onValueChange={v =>
            onFiltersChange(prev => {
              const { establishmentId: _, ...rest } = prev;
              return { ...rest, ...(v !== 'all' ? { establishmentId: v } : {}), page: 1 };
            })
          }
        >
          <SelectTrigger className='h-8 w-auto min-w-[120px] text-xs glass shadow-soft border-0'>
            <SelectValue placeholder={t('filters.allEstablishments')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>{t('filters.allEstablishments')}</SelectItem>
            {establishmentsQuery.data.map(est => (
              <SelectItem key={est._id} value={est._id}>
                {est.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

// ─── Review Card ────────────────────────────────────────────────────────────

function ReviewCard({
  review,
  onReport,
  t,
}: {
  review: Review;
  onReport: (review: Review) => void;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className='glass rounded-2xl p-[24px] shadow-soft relative overflow-hidden group'
    >
      <div className='absolute -top-6xl -end-6xl h-32 w-32 rounded-full bg-brand-coral/5 blur-2xl pointer-events-none' />

      <div className='relative'>
        {/* Header: rating + date + actions */}
        <div className='flex items-start justify-between gap-md'>
          <div className='flex-1 min-w-0'>
            <div className='flex items-center gap-sm mb-xs'>
              <StarRating rating={review.overallRating} />
              {review.isVerifiedPurchase && (
                <span className='inline-flex items-center gap-xs text-[10px] font-medium text-emerald-600 bg-emerald-50 px-1.5 py-xxs rounded-full'>
                  <CheckCircle2 size={10} />
                  {t('card.verifiedPurchase')}
                </span>
              )}
            </div>
            <div className='text-xs text-primary-500/50'>
              {new Date(review.createdAt).toLocaleDateString()}
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className='h-8 w-8 grid place-items-center rounded-lg hover:bg-primary-500/[0.06] transition-colors'>
                <MoreHorizontal size={16} className='text-primary-500/50' />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end'>
              <DropdownMenuItem onClick={() => onReport(review)}>
                <Flag size={14} className='me-sm' />
                {t('card.report')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Comment */}
        <p className='mt-md text-sm text-primary-500/80 leading-relaxed'>{review.comment}</p>

        {/* Tags */}
        {review.tags.length > 0 && (
          <div className='flex flex-wrap gap-1.5 mt-md'>
            {review.tags.map(tag => (
              <span
                key={tag}
                className='text-[10px] font-medium text-primary-500/60 bg-primary-500/[0.06] px-sm py-xxs rounded-full'
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Report Dialog ──────────────────────────────────────────────────────────

function ReportDialog({
  review,
  open,
  onOpenChange,
  t,
}: {
  review: Review | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const reportMutation = useReportReview();

  const handleSubmit = useCallback(async () => {
    if (!review || !reason) return;
    try {
      await reportMutation.mutateAsync({
        reviewId: review.id,
        reason,
        ...(details.trim() ? { additionalDetails: details.trim() } : {}),
      });
      toast.success(t('reportDialog.success'));
      setReason('');
      setDetails('');
      onOpenChange(false);
    } catch {
      toast.error(t('reportDialog.error'));
    }
  }, [review, reason, details, reportMutation, t, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>{t('reportDialog.title')}</DialogTitle>
        </DialogHeader>

        <div className='space-y-lg'>
          <div>
            <label className='text-sm font-medium text-primary-500 mb-1.5 block'>
              {t('reportDialog.reasonLabel')}
            </label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue placeholder={t('reportDialog.reasonLabel')} />
              </SelectTrigger>
              <SelectContent>
                {REPORT_REASONS.map(r => (
                  <SelectItem key={r} value={r}>
                    {t(`reportDialog.reasons.${r}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className='text-sm font-medium text-primary-500 mb-1.5 block'>
              {t('reportDialog.detailsLabel')}
            </label>
            <Textarea
              value={details}
              onChange={e => setDetails(e.target.value)}
              placeholder={t('reportDialog.detailsPlaceholder')}
              rows={3}
              className='resize-none'
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            onClick={handleSubmit}
            disabled={!reason || reportMutation.isPending}
            variant='destructive'
          >
            {reportMutation.isPending ? t('reportDialog.submitting') : t('reportDialog.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Trending Keywords ──────────────────────────────────────────────────────

function TrendingKeywordsPanel({ t }: { t: ReturnType<typeof useTranslations> }) {
  const keywordsQuery = useTrendingKeywords();

  if (keywordsQuery.isLoading) {
    return (
      <div className='glass rounded-2xl p-[24px] shadow-soft'>
        <div className='h-5 w-36 bg-white/30 animate-pulse rounded mb-lg' />
        <div className='flex gap-sm flex-wrap'>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className='h-7 w-20 bg-white/30 animate-pulse rounded-full' />
          ))}
        </div>
      </div>
    );
  }

  const keywords = keywordsQuery.data ?? [];
  if (keywords.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.5 }}
      className='glass rounded-2xl p-[24px] shadow-soft'
    >
      <div className='flex items-center gap-sm mb-[16px]'>
        <TrendingUp size={16} className='text-primary-500' />
        <div>
          <h3 className='font-display text-lg text-primary-500'>{t('trendingKeywords.title')}</h3>
          <p className='text-xs text-primary-500/60'>{t('trendingKeywords.subtitle')}</p>
        </div>
      </div>

      <div className='flex gap-sm flex-wrap'>
        {keywords.map((kw, i) => (
          <motion.span
            key={kw.keyword}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 + i * 0.04 }}
            className='inline-flex items-center gap-1.5 px-md py-1.5 rounded-full bg-primary-500/[0.06] text-xs font-medium text-primary-500'
          >
            {kw.keyword}
            <span className='text-[10px] text-primary-500/40'>{kw.count}</span>
          </motion.span>
        ))}
      </div>
    </motion.div>
  );
}

// ─── Pagination ─────────────────────────────────────────────────────────────

function Pagination({
  page,
  totalPages,
  onPageChange,
  t,
}: {
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
  t: ReturnType<typeof useTranslations>;
}) {
  if (totalPages <= 1) return null;

  return (
    <div className='flex items-center justify-center gap-lg'>
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className='flex items-center gap-xs text-xs font-medium text-primary-500 disabled:text-primary-500/30 transition-colors'
      >
        <ChevronLeft size={14} />
        {t('pagination.previous')}
      </button>
      <span className='text-xs text-primary-500/60'>
        {t('pagination.page', { current: page, total: totalPages })}
      </span>
      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        className='flex items-center gap-xs text-xs font-medium text-primary-500 disabled:text-primary-500/30 transition-colors'
      >
        {t('pagination.next')}
        <ChevronRight size={14} />
      </button>
    </div>
  );
}

// ─── Error State ────────────────────────────────────────────────────────────

function ErrorState({ message }: { message: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className='flex items-center gap-md rounded-xl bg-brand-coral/10 border border-brand-coral/20 p-[16px]'
    >
      <AlertCircle size={18} className='text-brand-coral shrink-0' />
      <p className='text-sm text-brand-coral'>{message}</p>
    </motion.div>
  );
}

// ─── Empty State ────────────────────────────────────────────────────────────

function EmptyState({ t }: { t: ReturnType<typeof useTranslations> }) {
  return (
    <div className='flex flex-col items-center justify-center py-6xl gap-md text-center'>
      <div className='h-16 w-16 rounded-2xl bg-primary-500/[0.06] grid place-items-center'>
        <MessageSquare size={28} className='text-primary-500/30' />
      </div>
      <h3 className='font-display text-lg text-primary-500'>{t('empty.title')}</h3>
      <p className='text-sm text-primary-500/60 max-w-xs'>{t('empty.description')}</p>
    </div>
  );
}

// ─── Review List Skeleton ───────────────────────────────────────────────────

function ReviewListSkeleton() {
  return (
    <div className='space-y-[16px]'>
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className='glass rounded-2xl p-[24px] shadow-soft h-[180px] animate-pulse bg-white/30'
        />
      ))}
    </div>
  );
}

// ─── Main Reviews Page ──────────────────────────────────────────────────────

export function ReviewsPage() {
  const t = useTranslations('dashboard.reviews');

  const [filters, setFilters] = useState<ReviewFilters>({
    page: 1,
    limit: 10,
  });

  const [reportReview, setReportReview] = useState<Review | null>(null);

  const analyticsQuery = useReviewAnalytics();
  const reviewsQuery = useMerchantReviews(filters);
  const establishmentsQuery = useMyEstablishments();

  const showLocationSwitcher = establishmentsQuery.data && establishmentsQuery.data.length > 1;

  const totalPages = reviewsQuery.data?.meta?.totalPages ?? 1;

  const handleFiltersChange = useCallback((updater: (prev: ReviewFilters) => ReviewFilters) => {
    setFilters(updater);
  }, []);

  return (
    <div className='flex flex-col gap-[24px] p-[24px]'>
      {/* Header */}
      <div className='flex flex-col sm:flex-row sm:items-start justify-between gap-[16px]'>
        <div>
          <div className='text-xs uppercase tracking-[0.18em] text-primary-500/60 mb-sm'>
            {t('subtitle')}
          </div>
          <h1 className='font-display text-3xl md:text-4xl text-primary-500'>{t('title')}</h1>
        </div>
        {showLocationSwitcher && <LocationSwitcher />}
      </div>

      {/* Error */}
      {reviewsQuery.isError && <ErrorState message={t('error')} />}

      {/* Stats */}
      <StatsHeader data={analyticsQuery.data} isLoading={analyticsQuery.isLoading} t={t} />

      {/* Trending Keywords */}
      <TrendingKeywordsPanel t={t} />

      {/* Filters */}
      <FiltersBar filters={filters} onFiltersChange={handleFiltersChange} t={t} />

      {/* Review List */}
      {reviewsQuery.isLoading ? (
        <ReviewListSkeleton />
      ) : reviewsQuery.data?.reviews.length === 0 ? (
        <EmptyState t={t} />
      ) : (
        <div className='space-y-[16px]'>
          <AnimatePresence mode='popLayout'>
            {reviewsQuery.data?.reviews.map(review => (
              <ReviewCard key={review.id} review={review} onReport={setReportReview} t={t} />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Pagination */}
      <Pagination
        page={filters.page}
        totalPages={totalPages}
        onPageChange={p => handleFiltersChange(prev => ({ ...prev, page: p }))}
        t={t}
      />

      {/* Report Dialog */}
      <ReportDialog
        review={reportReview}
        open={reportReview !== null}
        onOpenChange={open => {
          if (!open) setReportReview(null);
        }}
        t={t}
      />
    </div>
  );
}
