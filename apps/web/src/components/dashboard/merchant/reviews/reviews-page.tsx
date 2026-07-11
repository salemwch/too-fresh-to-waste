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
  Reply,
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
  useRespondToReview,
  useReportReview,
} from '@/hooks/use-merchant-reviews';
import { useMyEstablishments } from '@/hooks/use-merchant-dashboard';
import type { Review, ReviewFilters, ReviewAnalyticsResponse } from '@/types/reviews';
import { REPORT_REASONS } from '@/types/reviews';

// ─── Star Rating Display ────────────────────────────────────────────────────

function StarRating({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <div className='flex items-center gap-0.5'>
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
      <div className='grid grid-cols-2 lg:grid-cols-4 gap-3'>
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className='glass rounded-xl p-4 shadow-soft h-[100px] animate-pulse bg-white/30'
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
      label: t('stats.responseRate'),
      value: `${(data.responseRate ?? 0).toFixed(0)}%`,
      icon: Reply,
    },
    {
      label: t('stats.ratingDistribution'),
      value: null,
      icon: BarChart3,
      distribution: data.ratingDistribution,
    },
  ];

  return (
    <div className='grid grid-cols-2 lg:grid-cols-4 gap-3'>
      {stats.map((stat, i) => {
        const Icon = stat.icon;
        return (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.06, duration: 0.5, ease: 'easeOut' }}
            className='glass rounded-xl p-4 shadow-soft relative overflow-hidden group'
          >
            <div className='absolute -top-6 -end-6 h-20 w-20 rounded-full bg-brand-coral/10 blur-2xl group-hover:bg-brand-coral/20 transition-colors pointer-events-none' />

            <div className='relative'>
              <div className='flex items-center gap-2 mb-2'>
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

              {stat.extra && <div className='mt-1'>{stat.extra}</div>}

              {stat.distribution && (
                <div className='space-y-1.5 mt-1'>
                  {[5, 4, 3, 2, 1].map(rating => {
                    const count = stat.distribution?.[String(rating)] ?? 0;
                    const total = Object.values(stat.distribution ?? {}).reduce(
                      (sum: number, v) => sum + (v as number),
                      0,
                    );
                    const pct = total > 0 ? (count / total) * 100 : 0;
                    return (
                      <div key={rating} className='flex items-center gap-2'>
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
    <div className='flex items-center gap-2 flex-wrap'>
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

      {/* Response status filter */}
      <Select
        value={
          filters.hasResponse === undefined
            ? 'all'
            : filters.hasResponse
              ? 'responded'
              : 'not_responded'
        }
        onValueChange={v =>
          onFiltersChange(prev => {
            const { hasResponse: _, ...rest } = prev;
            return { ...rest, ...(v !== 'all' ? { hasResponse: v === 'responded' } : {}), page: 1 };
          })
        }
      >
        <SelectTrigger className='h-8 w-auto min-w-[110px] text-xs glass shadow-soft border-0'>
          <SelectValue placeholder={t('filters.allStatuses')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value='all'>{t('filters.allStatuses')}</SelectItem>
          <SelectItem value='responded'>{t('filters.responded')}</SelectItem>
          <SelectItem value='not_responded'>{t('filters.notResponded')}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

// ─── Review Card ────────────────────────────────────────────────────────────

function ReviewCard({
  review,
  onReply,
  onReport,
  t,
}: {
  review: Review;
  onReply: (review: Review) => void;
  onReport: (review: Review) => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const hasResponse = review.responses && review.responses.length > 0;
  const latestResponse = hasResponse ? review.responses[review.responses.length - 1] : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className='glass rounded-2xl p-[24px] shadow-soft relative overflow-hidden group'
    >
      <div className='absolute -top-10 -right-10 h-32 w-32 rounded-full bg-brand-coral/5 blur-2xl pointer-events-none' />

      <div className='relative'>
        {/* Header: rating + date + actions */}
        <div className='flex items-start justify-between gap-3'>
          <div className='flex-1 min-w-0'>
            <div className='flex items-center gap-2 mb-1'>
              <StarRating rating={review.overallRating} />
              {review.isVerifiedPurchase && (
                <span className='inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full'>
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
              {!hasResponse && (
                <DropdownMenuItem onClick={() => onReply(review)}>
                  <Reply size={14} className='me-2' />
                  {t('card.reply')}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => onReport(review)}>
                <Flag size={14} className='me-2' />
                {t('card.report')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Comment */}
        <p className='mt-3 text-sm text-primary-500/80 leading-relaxed'>{review.comment}</p>

        {/* Tags */}
        {review.tags.length > 0 && (
          <div className='flex flex-wrap gap-1.5 mt-3'>
            {review.tags.map(tag => (
              <span
                key={tag}
                className='text-[10px] font-medium text-primary-500/60 bg-primary-500/[0.06] px-2 py-0.5 rounded-full'
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Merchant response */}
        {latestResponse && (
          <div className='mt-4 ps-4 border-s-2 border-primary-500/20'>
            <div className='text-xs font-semibold text-primary-500 mb-1'>
              {t('card.merchantResponse')}
            </div>
            <p className='text-sm text-primary-500/70 leading-relaxed'>
              {latestResponse.responseText}
            </p>
            <div className='text-[10px] text-primary-500/40 mt-1'>
              {t('card.respondedOn', {
                date: new Date(latestResponse.respondedAt).toLocaleDateString(),
              })}
            </div>
          </div>
        )}

        {/* Reply button for cards without response */}
        {!hasResponse && (
          <button
            onClick={() => onReply(review)}
            className='mt-4 flex items-center gap-1.5 text-xs font-medium text-brand-coral hover:text-brand-coral/80 transition-colors'
          >
            <Reply size={13} />
            {t('card.reply')}
          </button>
        )}
      </div>
    </motion.div>
  );
}

// ─── Reply Dialog ───────────────────────────────────────────────────────────

function ReplyDialog({
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
  const [text, setText] = useState('');
  const respondMutation = useRespondToReview();

  const handleSubmit = useCallback(async () => {
    if (!review || text.trim().length < 5) return;
    try {
      await respondMutation.mutateAsync({ reviewId: review.id, responseText: text.trim() });
      toast.success(t('replyDialog.success'));
      setText('');
      onOpenChange(false);
    } catch {
      toast.error(t('replyDialog.error'));
    }
  }, [review, text, respondMutation, t, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>{t('replyDialog.title')}</DialogTitle>
        </DialogHeader>

        {review && (
          <div className='rounded-lg bg-primary-500/[0.04] p-3 mb-3'>
            <StarRating rating={review.overallRating} size={12} />
            <p className='text-xs text-primary-500/70 mt-1 line-clamp-2'>{review.comment}</p>
          </div>
        )}

        <Textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={t('replyDialog.placeholder')}
          maxLength={1000}
          rows={4}
          className='resize-none'
        />
        <div className='text-end text-[11px] text-primary-500/40'>
          {t('replyDialog.charLimit', { count: text.length })}
        </div>

        <DialogFooter>
          <Button
            onClick={handleSubmit}
            disabled={text.trim().length < 5 || respondMutation.isPending}
            className='bg-primary-500 hover:bg-primary-600 text-white'
          >
            {respondMutation.isPending ? t('replyDialog.submitting') : t('replyDialog.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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

        <div className='space-y-4'>
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
        <div className='h-5 w-36 bg-white/30 animate-pulse rounded mb-4' />
        <div className='flex gap-2 flex-wrap'>
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
      <div className='flex items-center gap-2 mb-[16px]'>
        <TrendingUp size={16} className='text-primary-500' />
        <div>
          <h3 className='font-display text-lg text-primary-500'>{t('trendingKeywords.title')}</h3>
          <p className='text-xs text-primary-500/60'>{t('trendingKeywords.subtitle')}</p>
        </div>
      </div>

      <div className='flex gap-2 flex-wrap'>
        {keywords.map((kw, i) => (
          <motion.span
            key={kw.keyword}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 + i * 0.04 }}
            className='inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary-500/[0.06] text-xs font-medium text-primary-500'
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
    <div className='flex items-center justify-center gap-4'>
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className='flex items-center gap-1 text-xs font-medium text-primary-500 disabled:text-primary-500/30 transition-colors'
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
        className='flex items-center gap-1 text-xs font-medium text-primary-500 disabled:text-primary-500/30 transition-colors'
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
      className='flex items-center gap-3 rounded-xl bg-brand-coral/10 border border-brand-coral/20 p-[16px]'
    >
      <AlertCircle size={18} className='text-brand-coral shrink-0' />
      <p className='text-sm text-brand-coral'>{message}</p>
    </motion.div>
  );
}

// ─── Empty State ────────────────────────────────────────────────────────────

function EmptyState({ t }: { t: ReturnType<typeof useTranslations> }) {
  return (
    <div className='flex flex-col items-center justify-center py-10 gap-3 text-center'>
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

  const [replyReview, setReplyReview] = useState<Review | null>(null);
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
          <div className='text-xs uppercase tracking-[0.18em] text-primary-500/60 mb-2'>
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
              <ReviewCard
                key={review.id}
                review={review}
                onReply={setReplyReview}
                onReport={setReportReview}
                t={t}
              />
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

      {/* Dialogs */}
      <ReplyDialog
        review={replyReview}
        open={replyReview !== null}
        onOpenChange={open => {
          if (!open) setReplyReview(null);
        }}
        t={t}
      />
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
