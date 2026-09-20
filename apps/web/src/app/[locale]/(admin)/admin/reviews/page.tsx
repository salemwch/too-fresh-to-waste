'use client';

import { useCallback, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Check, MessageSquare, Star, X } from 'lucide-react';
import { Badge, Button } from '@foodwaste/ui';

import { AdminDataTable, type ColumnDef } from '@/components/dashboard/admin/admin-data-table';
import { AdminErrorState } from '@/components/dashboard/admin/admin-error-state';
import { AdminModuleHeader } from '@/components/dashboard/admin/admin-module-header';
import { ConfirmActionDialog } from '@/components/dashboard/admin/confirm-action-dialog';
import { useModerateReview, useModerationReviews } from '@/hooks/use-admin';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { AdminReviewRow } from '@/types/admin';

type Tab = 'pending' | 'flagged';

/** Frozen so an empty result never hands the table a fresh array identity. */
const NO_REVIEWS: readonly AdminReviewRow[] = Object.freeze([]) as readonly AdminReviewRow[];

/**
 * Review moderation.
 *
 * ## Why this page did not exist
 *
 * The backend has carried a complete review-moderation API for some time -
 * `/reviews/moderation/pending`, `/reviews/moderation/flagged`,
 * `PATCH /reviews/:id/moderate`, all `@Roles(ADMIN)` - and nothing in the admin
 * app called any of it. `PlatformAnalytics` even returns `flaggedReviews` and
 * `reviewsModerationQueue`, and the whole `reviews` block went unread.
 *
 * So a flagged review sat in the queue indefinitely with no screen to action it
 * from.
 *
 * ## Two tabs, not one filtered list
 *
 * Pending is a **backlog**, worked oldest-first, and the backend sorts it that
 * way. Flagged is an **incident list**, worked newest-first. They are different
 * jobs with different urgency, so merging them behind a status filter would
 * bury the flags under the backlog.
 */
export default function AdminReviewsPage() {
  const t = useTranslations('adminReviews');
  const locale = useLocale();

  const [tab, setTab] = useState<Tab>('pending');
  const [page, setPage] = useState(1);
  const [pending, setPending] = useState<{ review: AdminReviewRow; approve: boolean } | null>(null);

  const { data, isLoading, isError, refetch } = useModerationReviews(tab, page);
  const moderate = useModerateReview();

  const rows = data?.rows ?? (NO_REVIEWS as AdminReviewRow[]);

  const changeTab = useCallback((next: Tab) => {
    setTab(next);
    // A page number from one queue is meaningless in the other.
    setPage(1);
  }, []);

  const closeDialog = useCallback(() => setPending(null), []);

  const confirm = useCallback(
    (reason?: string) => {
      if (!pending) {
        return;
      }

      moderate.mutate(
        {
          reviewId: pending.review._id,
          payload: {
            status: pending.approve ? 'approved' : 'rejected',
            // Conditional spread: `exactOptionalPropertyTypes` rejects passing
            // an explicit `undefined` to an optional property.
            ...(reason ? { moderationReason: reason } : {}),
          },
        },
        { onSuccess: closeDialog },
      );
    },
    [pending, moderate, closeDialog],
  );

  // ── Columns ───────────────────────────────────────────────────────────────

  const columns = useMemo<ColumnDef<AdminReviewRow & { id: string }>[]>(
    () => [
      {
        key: 'review',
        header: t('col.review'),
        render: row => (
          <div className='min-w-0 max-w-md'>
            <div className='flex items-center gap-xs'>
              {/* Rating as filled stars, not a bare number: a moderator scans
                  for 1-star outliers, and a digit does not pop. */}
              <span className='flex' aria-label={t('stars', { count: row.rating })}>
                {[1, 2, 3, 4, 5].map(n => (
                  <Star
                    key={n}
                    aria-hidden='true'
                    className={cn(
                      'size-3.5',
                      n <= row.rating
                        ? 'fill-secondary text-secondary'
                        : 'text-muted-foreground/30',
                    )}
                  />
                ))}
              </span>
              {row.title && <span className='truncate text-sm font-semibold'>{row.title}</span>}
            </div>
            {row.comment && (
              <p className='text-muted-foreground mt-xxs line-clamp-2 text-sm'>{row.comment}</p>
            )}
          </div>
        ),
      },
      {
        key: 'author',
        header: t('col.author'),
        render: row => {
          // Populated or raw id - the same duality the orders code handles.
          const user = typeof row.userId === 'object' ? row.userId : null;
          const name = user
            ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email
            : null;

          return <span className='text-sm'>{name ?? t('unknownAuthor')}</span>;
        },
      },
      {
        key: 'establishment',
        header: t('col.establishment'),
        render: row => {
          const est = typeof row.establishmentId === 'object' ? row.establishmentId : null;
          return <span className='text-sm'>{est?.name ?? t('unknownEstablishment')}</span>;
        },
      },
      {
        key: 'createdAt',
        header: t('col.date'),
        className: 'text-end',
        render: row => (
          <span className='text-muted-foreground text-xs'>
            {formatDateTime(locale, row.createdAt)}
          </span>
        ),
      },
      {
        key: 'actions',
        header: t('col.actions'),
        className: 'text-end',
        render: row => (
          <div className='flex items-center justify-end gap-xs'>
            <Button
              type='button'
              size='sm'
              variant='outline'
              onClick={() => setPending({ review: row, approve: true })}
            >
              <Check aria-hidden='true' className='size-4' />
              <span className='sr-only sm:not-sr-only'>{t('approve')}</span>
            </Button>
            <Button
              type='button'
              size='sm'
              variant='outline'
              className='text-destructive hover:bg-destructive/10'
              onClick={() => setPending({ review: row, approve: false })}
            >
              <X aria-hidden='true' className='size-4' />
              <span className='sr-only sm:not-sr-only'>{t('reject')}</span>
            </Button>
          </div>
        ),
      },
    ],
    [t, locale],
  );

  // `AdminDataTable` keys rows on `id`; reviews carry `_id`.
  const tableRows = useMemo(() => rows.map(r => ({ ...r, id: r._id })), [rows]);

  const tabs = useMemo(
    () => [
      { key: 'pending' as const, label: t('tabs.pending') },
      { key: 'flagged' as const, label: t('tabs.flagged') },
    ],
    [t],
  );

  return (
    <div className='flex flex-col gap-lg'>
      <AdminModuleHeader title={t('title')} subtitle={t('subtitle')} />

      <div className='flex flex-wrap gap-xs'>
        {tabs.map(item => (
          <Button
            key={item.key}
            type='button'
            size='sm'
            variant={tab === item.key ? 'default' : 'outline'}
            onClick={() => changeTab(item.key)}
          >
            {item.label}
            {tab === item.key && data ? (
              <Badge variant='secondary' className='ms-xs'>
                {data.total}
              </Badge>
            ) : null}
          </Button>
        ))}
      </div>

      {isError ? (
        <AdminErrorState
          variant='block'
          title={t('error.title')}
          description={t('error.body')}
          retryLabel={t('error.retry')}
          onRetry={() => void refetch()}
        />
      ) : (
        <AdminDataTable
          columns={columns}
          data={tableRows}
          isLoading={isLoading}
          page={page}
          totalPages={data?.totalPages ?? 1}
          total={data?.total ?? 0}
          onPageChange={setPage}
          searchPlaceholder={t('searchPlaceholder')}
          onSearchChange={() => {
            /* The moderation endpoints take no search term; the toolbar's
               search is intentionally inert here rather than pretending to
               filter a single page of results client-side. */
          }}
          emptyIcon={MessageSquare}
          emptyTitle={tab === 'pending' ? t('empty.pendingTitle') : t('empty.flaggedTitle')}
          emptyDescription={tab === 'pending' ? t('empty.pendingBody') : t('empty.flaggedBody')}
        />
      )}

      <ConfirmActionDialog
        open={pending !== null}
        onOpenChange={open => {
          if (!open) {
            closeDialog();
          }
        }}
        title={pending?.approve ? t('confirm.approveTitle') : t('confirm.rejectTitle')}
        description={pending?.approve ? t('confirm.approveBody') : t('confirm.rejectBody')}
        confirmLabel={pending?.approve ? t('approve') : t('reject')}
        cancelLabel={t('cancel')}
        variant={pending?.approve ? 'default' : 'danger'}
        isLoading={moderate.isPending}
        onConfirm={confirm}
        // A rejection removes a customer's words from a merchant's page, so it
        // has to be justified. An approval does not.
        reasonConfig={
          pending?.approve
            ? { label: t('confirm.noteLabel'), placeholder: t('confirm.notePlaceholder') }
            : {
                label: t('confirm.reasonLabel'),
                placeholder: t('confirm.reasonPlaceholder'),
                required: true,
              }
        }
      />
    </div>
  );
}
