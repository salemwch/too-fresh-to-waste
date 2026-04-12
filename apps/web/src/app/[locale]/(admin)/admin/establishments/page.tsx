'use client';

import { useState, useCallback, useRef } from 'react';
import { useTranslations } from 'next-intl';
import {
  Building2,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  XCircle,
  MoreHorizontal,
  Eye,
  Star,
  CalendarClock,
  BadgeCheck,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  Button,
  Separator,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@foodwaste/ui';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EstablishmentStatus, EstablishmentType } from '@foodwaste/shared';
import { AdminDataTable, type ColumnDef } from '@/components/dashboard/admin/admin-data-table';
import { StatusBadge } from '@/components/dashboard/admin/status-badge';
import {
  AdminDetailSheetSkeleton,
  AdminPendingCardsSkeleton,
} from '@/components/dashboard/admin/admin-skeletons';
import { ConfirmActionDialog } from '@/components/dashboard/admin/confirm-action-dialog';
import { ExtendTrialDialog } from '@/components/dashboard/admin/extend-trial-dialog';
import {
  useEstablishmentOverview,
  useEstablishmentSearch,
  useEstablishmentDetail,
  useEstablishmentStats,
  useEstablishmentActivity,
  useVerifyEstablishmentDocuments,
  usePendingApprovals,
  useApproveEstablishment,
  useUpdateEstablishmentStatus,
  useExtendEstablishmentTrial,
  useMarkEstablishmentAsPaid,
} from '@/hooks/use-admin';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import type { AdminEstablishment, EstablishmentSearchParams } from '@/types/admin';

function relativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

function formatLastActivity(iso: string | undefined): { label: string; dot: string; text: string } {
  if (!iso)
    return { label: 'Never', dot: 'bg-muted-foreground/30', text: 'text-muted-foreground/60' };
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);
  if (minutes < 60)
    return { label: `${minutes}m ago`, dot: 'bg-[#2E7D32]', text: 'text-[#2E7D32]' };
  if (hours < 24) return { label: `${hours}h ago`, dot: 'bg-[#2E7D32]', text: 'text-[#2E7D32]' };
  if (days === 1) return { label: 'Yesterday', dot: 'bg-emerald-400', text: 'text-foreground' };
  if (days < 7) return { label: `${days}d ago`, dot: 'bg-emerald-400', text: 'text-foreground' };
  if (days < 30)
    return { label: `${days}d ago`, dot: 'bg-amber-400', text: 'text-muted-foreground' };
  if (days < 90)
    return { label: `${Math.floor(days / 30)}mo ago`, dot: 'bg-[#F57C00]', text: 'text-[#F57C00]' };
  return {
    label: `${Math.floor(days / 30)}mo ago`,
    dot: 'bg-destructive/70',
    text: 'text-destructive/70',
  };
}

type ActionType = 'approve' | 'reject' | 'suspend' | 'reactivate';

export default function AdminEstablishmentsPage() {
  const t = useTranslations('dashboard.admin.establishments');

  const [params, setParams] = useState<EstablishmentSearchParams>({ page: 1, limit: 20 });
  const [searchInput, setSearchInput] = useState('');
  const [pendingExpanded, setPendingExpanded] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [actionDialog, setActionDialog] = useState<{
    open: boolean;
    type: ActionType;
    establishment: AdminEstablishment;
  } | null>(null);
  const [extendTrialOpen, setExtendTrialOpen] = useState(false);
  const [markPaidConfirmOpen, setMarkPaidConfirmOpen] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const { data: overview } = useEstablishmentOverview();
  const { data: pending, isLoading: loadingPending } = usePendingApprovals();
  const { data: list, isLoading: loadingList } = useEstablishmentSearch(params);
  const { data: detail, isLoading: loadingDetail } = useEstablishmentDetail(selectedId);
  const { data: estStats, isLoading: loadingStats } = useEstablishmentStats(selectedId);
  const { data: estActivity, isLoading: loadingActivity } = useEstablishmentActivity(selectedId);
  const approveMutation = useApproveEstablishment();
  const statusMutation = useUpdateEstablishmentStatus();
  const verifyDocsMutation = useVerifyEstablishmentDocuments();
  const extendTrialMutation = useExtendEstablishmentTrial();
  const markPaidMutation = useMarkEstablishmentAsPaid();

  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setParams(p => ({ ...p, page: 1, ...(value ? { search: value } : {}) }));
    }, 300);
  }, []);

  function handleStatusFilter(value: string) {
    setParams(p => {
      const { status: _s, ...rest } = p;
      return value !== 'all'
        ? { ...rest, page: 1, status: value as EstablishmentStatus }
        : { ...rest, page: 1 };
    });
  }

  function handleTypeFilter(value: string) {
    setParams(p => {
      const { type: _t, ...rest } = p;
      return value !== 'all'
        ? { ...rest, page: 1, type: value as EstablishmentType }
        : { ...rest, page: 1 };
    });
  }

  function openAction(est: AdminEstablishment, type: ActionType) {
    setActionDialog({ open: true, type, establishment: est });
  }

  function handleConfirmAction(reason?: string) {
    if (!actionDialog) return;
    const { type, establishment } = actionDialog;

    if (type === 'approve' || type === 'reject') {
      approveMutation.mutate(
        {
          id: establishment.id,
          payload: {
            approved: type === 'approve',
            ...(reason ? { reason } : {}),
            sendNotification: true,
          },
        },
        { onSuccess: () => setActionDialog(null) },
      );
    } else {
      const statusMap: Partial<Record<ActionType, EstablishmentStatus>> = {
        suspend: EstablishmentStatus.SUSPENDED,
        reactivate: EstablishmentStatus.ACTIVE,
      };
      statusMutation.mutate(
        { id: establishment.id, payload: { status: statusMap[type]!, reason: reason ?? '' } },
        { onSuccess: () => setActionDialog(null) },
      );
    }
  }

  const establishments = list?.establishments ?? [];
  const total = list?.total ?? 0;
  const totalPages = list?.totalPages ?? 1;

  const pendingCount = overview?.pending ?? pending?.length ?? 0;

  const columns: ColumnDef<AdminEstablishment>[] = [
    {
      key: 'name',
      header: t('columns.name'),
      render: est => (
        <div className='flex items-center gap-2.5'>
          <div className='flex size-8 shrink-0 items-center justify-center rounded-lg bg-violet-50'>
            <Building2 className='size-4 text-violet-600' />
          </div>
          <div>
            <p className='text-xs font-medium'>{est.name}</p>
            {est.isVerified && <p className='text-[10px] text-emerald-600'>Verified</p>}
          </div>
        </div>
      ),
    },
    {
      key: 'type',
      header: t('columns.type'),
      render: est => (
        <span className='text-xs capitalize text-muted-foreground'>
          {est.type.replace(/_/g, ' ')}
        </span>
      ),
    },
    {
      key: 'status',
      header: t('columns.status'),
      render: est => <StatusBadge status={est.status} variant='establishment' />,
    },
    {
      key: 'city',
      header: t('columns.city'),
      render: est => (
        <span className='text-xs text-muted-foreground'>{est.address?.city ?? '—'}</span>
      ),
    },
    {
      key: 'rating',
      header: t('columns.rating'),
      render: est =>
        est.rating ? (
          <div className='flex items-center gap-1'>
            <Star className='size-3 fill-amber-400 text-amber-400' />
            <span className='text-xs tabular-nums'>{est.rating.toFixed(1)}</span>
          </div>
        ) : (
          <span className='text-xs text-muted-foreground'>—</span>
        ),
    },
    {
      key: 'lastActivity',
      header: 'Last Activity',
      render: est => {
        const { label, dot, text } = formatLastActivity(est.lastActivityAt);
        return (
          <div className='flex items-center gap-1.5'>
            <span className={`size-1.5 shrink-0 rounded-full ${dot}`} />
            <span className={`text-xs tabular-nums ${text}`}>{label}</span>
          </div>
        );
      },
    },
    {
      key: 'actions',
      header: t('columns.actions'),
      render: est => (
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button variant='ghost' size='sm' className='h-7 w-7 p-0'>
              <MoreHorizontal className='size-3.5' />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end' className='w-36'>
            <DropdownMenuItem onClick={() => setSelectedId(est.id)}>
              <Eye className='me-2 size-3.5' />
              {t('actions.view')}
            </DropdownMenuItem>
            {est.status === EstablishmentStatus.PENDING && (
              <>
                <DropdownMenuItem
                  className='text-emerald-600'
                  onClick={() => openAction(est, 'approve')}
                >
                  <CheckCircle className='me-2 size-3.5' />
                  {t('actions.approve')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className='text-rose-600'
                  onClick={() => openAction(est, 'reject')}
                >
                  <XCircle className='me-2 size-3.5' />
                  {t('actions.reject')}
                </DropdownMenuItem>
              </>
            )}
            {est.status === EstablishmentStatus.ACTIVE && (
              <DropdownMenuItem
                className='text-orange-600'
                onClick={() => openAction(est, 'suspend')}
              >
                {t('actions.suspend')}
              </DropdownMenuItem>
            )}
            {est.status === EstablishmentStatus.SUSPENDED && (
              <DropdownMenuItem
                className='text-emerald-600'
                onClick={() => openAction(est, 'reactivate')}
              >
                {t('actions.reactivate')}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const overviewStats = [
    { label: t('totalEstablishments'), value: overview?.total ?? total, color: 'text-violet-600' },
    { label: t('activeEstablishments'), value: overview?.active ?? 0, color: 'text-emerald-600' },
    { label: 'Active (30d)', value: overview?.activeLastThirtyDays ?? 0, color: 'text-teal-600' },
    { label: t('pendingEstablishments'), value: pendingCount, color: 'text-amber-600' },
    {
      label: t('suspendedEstablishments'),
      value: overview?.suspended ?? 0,
      color: 'text-orange-600',
    },
    { label: t('rejectedEstablishments'), value: overview?.rejected ?? 0, color: 'text-rose-600' },
  ];

  const isPending = approveMutation.isPending || statusMutation.isPending;

  return (
    <div className='space-y-5'>
      {/* Header + Stats */}
      <div className='flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between'>
        <div>
          <h1 className='text-xl font-bold tracking-tight'>{t('title')}</h1>
          <p className='mt-0.5 text-sm text-muted-foreground'>{t('description')}</p>
        </div>
        <div className='flex flex-wrap gap-2'>
          {overviewStats.map(stat => (
            <div
              key={stat.label}
              className='flex items-center gap-1.5 rounded-lg border border-border/60 bg-card px-2.5 py-1.5'
            >
              <span className={`text-xs font-semibold tabular-nums ${stat.color}`}>
                {stat.value}
              </span>
              <span className='text-xs text-muted-foreground'>{stat.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Pending Approvals Section */}
      {pendingCount > 0 && (
        <Alert className='border-amber-300 bg-amber-50/60 dark:bg-amber-950/10'>
          <AlertDescription>
            <div className='space-y-3'>
              <button
                onClick={() => setPendingExpanded(e => !e)}
                className='flex w-full items-center justify-between text-sm font-semibold text-amber-800 dark:text-amber-300'
              >
                <span>
                  {t('pendingSection')} ({pendingCount})
                </span>
                {pendingExpanded ? (
                  <ChevronUp className='size-4' />
                ) : (
                  <ChevronDown className='size-4' />
                )}
              </button>
              {pendingExpanded && (
                <>
                  <p className='text-xs text-amber-700/70'>{t('pendingSectionDescription')}</p>
                  {loadingPending ? (
                    <AdminPendingCardsSkeleton count={3} />
                  ) : (
                    <div className='grid gap-2 sm:grid-cols-2 lg:grid-cols-3'>
                      {(pending ?? []).map(est => (
                        <div
                          key={est.id}
                          className='rounded-lg border border-amber-200 bg-white/70 p-3 dark:bg-amber-950/20'
                        >
                          <div className='flex items-start justify-between gap-2'>
                            <div className='min-w-0'>
                              <p className='truncate text-xs font-semibold'>{est.name}</p>
                              <p className='text-[10px] capitalize text-muted-foreground'>
                                {est.type.replace(/_/g, ' ')}
                                {est.address?.city ? ` · ${est.address.city}` : ''}
                              </p>
                              <p className='mt-0.5 text-[10px] text-muted-foreground/70'>
                                {relativeDate(est.createdAt)}
                              </p>
                            </div>
                            <button
                              onClick={() => setSelectedId(est.id)}
                              className='mt-0.5 shrink-0 text-[10px] text-indigo-600 hover:underline'
                            >
                              {t('actions.view')}
                            </button>
                          </div>
                          <div className='mt-2.5 flex gap-2'>
                            <Button
                              size='sm'
                              className='h-7 flex-1 bg-emerald-600 text-xs hover:bg-emerald-700'
                              onClick={() => openAction(est, 'approve')}
                            >
                              <CheckCircle className='me-1.5 size-3' />
                              {t('actions.approve')}
                            </Button>
                            <Button
                              size='sm'
                              variant='outline'
                              className='h-7 flex-1 border-rose-300 text-xs text-rose-600 hover:bg-rose-50'
                              onClick={() => openAction(est, 'reject')}
                            >
                              <XCircle className='me-1.5 size-3' />
                              {t('actions.reject')}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Main Table */}
      <AdminDataTable
        columns={columns}
        data={establishments}
        isLoading={loadingList}
        page={params.page ?? 1}
        totalPages={totalPages}
        total={total}
        onPageChange={p => setParams(prev => ({ ...prev, page: p }))}
        searchValue={searchInput}
        searchPlaceholder={t('searchPlaceholder')}
        onSearchChange={handleSearchChange}
        filterSlot={
          <>
            <Select onValueChange={handleStatusFilter} defaultValue='all'>
              <SelectTrigger className='h-7 w-28 text-xs'>
                <SelectValue placeholder={t('filterStatus')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>{t('allStatuses')}</SelectItem>
                <SelectItem value={EstablishmentStatus.ACTIVE}>Active</SelectItem>
                <SelectItem value={EstablishmentStatus.PENDING}>Pending</SelectItem>
                <SelectItem value={EstablishmentStatus.SUSPENDED}>Suspended</SelectItem>
                <SelectItem value={EstablishmentStatus.REJECTED}>Rejected</SelectItem>
                <SelectItem value={EstablishmentStatus.INACTIVE}>Inactive</SelectItem>
              </SelectContent>
            </Select>
            <Select onValueChange={handleTypeFilter} defaultValue='all'>
              <SelectTrigger className='h-7 w-32 text-xs'>
                <SelectValue placeholder={t('filterType')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>{t('allTypes')}</SelectItem>
                <SelectItem value={EstablishmentType.RESTAURANT}>Restaurant</SelectItem>
                <SelectItem value={EstablishmentType.BAKERY}>Bakery</SelectItem>
                <SelectItem value={EstablishmentType.CAFE}>Café</SelectItem>
                <SelectItem value={EstablishmentType.GROCERY_STORE}>Grocery Store</SelectItem>
                <SelectItem value={EstablishmentType.FAST_FOOD}>Fast Food</SelectItem>
                <SelectItem value={EstablishmentType.SUPERMARKET}>Supermarket</SelectItem>
                <SelectItem value={EstablishmentType.HOTEL}>Hotel</SelectItem>
                <SelectItem value={EstablishmentType.OTHER}>Other</SelectItem>
              </SelectContent>
            </Select>
          </>
        }
        emptyIcon={Building2}
        emptyTitle={t('empty')}
        emptyDescription={t('emptyDescription')}
      />

      {/* Detail Sheet */}
      <Sheet open={!!selectedId} onOpenChange={open => !open && setSelectedId(null)}>
        <SheetContent className='w-full overflow-y-auto sm:max-w-lg'>
          {/* SheetTitle required by Radix for accessibility even when loading */}
          {loadingDetail && <SheetTitle className='sr-only'>Loading…</SheetTitle>}
          {loadingDetail ? (
            <AdminDetailSheetSkeleton />
          ) : detail ? (
            <div className='space-y-5 py-6'>
              {/* Header */}
              <SheetHeader>
                <div className='flex items-start gap-3'>
                  <div className='flex size-12 shrink-0 items-center justify-center rounded-xl bg-violet-50'>
                    <Building2 className='size-6 text-violet-600' />
                  </div>
                  <div>
                    <SheetTitle className='text-base'>{detail.name}</SheetTitle>
                    <p className='mt-0.5 text-xs capitalize text-muted-foreground'>
                      {detail.type.replace(/_/g, ' ')}
                    </p>
                    <div className='mt-1.5 flex gap-1.5'>
                      <StatusBadge status={detail.status} variant='establishment' />
                      {detail.isVerified && (
                        <span className='inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700'>
                          {t('detail.verified')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </SheetHeader>

              {/* Tabs: Info / Stats / Activity */}
              <Tabs defaultValue='info'>
                <TabsList className='h-8 w-full'>
                  <TabsTrigger value='info' className='flex-1 text-xs'>
                    Info
                  </TabsTrigger>
                  <TabsTrigger value='stats' className='flex-1 text-xs'>
                    Stats
                  </TabsTrigger>
                  <TabsTrigger value='activity' className='flex-1 text-xs'>
                    Activity
                  </TabsTrigger>
                </TabsList>

                {/* Info tab */}
                <TabsContent value='info' className='mt-4 space-y-4'>
                  <div className='space-y-2.5'>
                    {[
                      { label: t('detail.contact'), value: detail.contactEmail ?? '—' },
                      {
                        label: t('detail.address'),
                        value:
                          [detail.address?.street, detail.address?.city, detail.address?.country]
                            .filter(Boolean)
                            .join(', ') || '—',
                      },
                      ...(detail.rating
                        ? [
                            {
                              label: 'Rating',
                              value: `${detail.rating.toFixed(1)} / 5 (${detail.totalReviews ?? 0} reviews)`,
                            },
                          ]
                        : []),
                      {
                        label: 'Submitted',
                        value: new Date(detail.createdAt).toLocaleDateString(),
                      },
                      ...(detail.owner
                        ? [
                            {
                              label: 'Owner',
                              value: `${detail.owner.firstName} ${detail.owner.lastName} · ${detail.owner.email}`,
                            },
                          ]
                        : []),
                    ].map(row => (
                      <div key={row.label} className='flex justify-between gap-4'>
                        <span className='text-xs text-muted-foreground'>{row.label}</span>
                        <span className='text-right text-xs font-medium'>{row.value}</span>
                      </div>
                    ))}
                  </div>
                  <Separator />

                  {/* Activity breakdown */}
                  {(detail.lastOrderAt ?? detail.lastOfferCreatedAt ?? detail.ownerLastLoginAt) && (
                    <div className='space-y-1.5'>
                      <p className='text-[11px] font-medium uppercase tracking-wide text-muted-foreground'>
                        Recent Activity
                      </p>
                      {[
                        { label: 'Last Order', iso: detail.lastOrderAt },
                        { label: 'Last Offer', iso: detail.lastOfferCreatedAt },
                        { label: 'Owner Login', iso: detail.ownerLastLoginAt },
                      ]
                        .filter(r => !!r.iso)
                        .map(({ label, iso }) => {
                          const { label: timeLabel, dot, text } = formatLastActivity(iso);
                          return (
                            <div key={label} className='flex items-center justify-between'>
                              <span className='text-xs text-muted-foreground'>{label}</span>
                              <div className='flex items-center gap-1.5'>
                                <span className={`size-1.5 rounded-full ${dot}`} />
                                <span className={`text-xs font-medium tabular-nums ${text}`}>
                                  {timeLabel}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}

                  <Separator />

                  {/* ── Subscription / Trial ── */}
                  <div className='space-y-2'>
                    <p className='text-[11px] font-medium uppercase tracking-wide text-muted-foreground'>
                      Subscription
                    </p>
                    <div className='rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5'>
                      <div className='flex items-center justify-between gap-3'>
                        <div className='flex items-center gap-1.5'>
                          <span
                            className={`size-2 rounded-full ${
                              detail.subscriptionStatus === 'paid'
                                ? 'bg-emerald-500'
                                : detail.subscriptionStatus === 'suspended'
                                  ? 'bg-rose-500'
                                  : 'bg-amber-400'
                            }`}
                          />
                          <span className='text-xs font-medium capitalize'>
                            {detail.subscriptionStatus ?? 'trial'}
                          </span>
                        </div>
                        {detail.trialEndsAt && (
                          <span className='text-[10px] tabular-nums text-muted-foreground'>
                            ends {new Date(detail.trialEndsAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className='flex gap-2'>
                      <Button
                        size='sm'
                        variant='outline'
                        className='h-7 flex-1 border-indigo-300 text-xs text-indigo-600 hover:bg-indigo-50'
                        onClick={() => setExtendTrialOpen(true)}
                      >
                        <CalendarClock className='me-1.5 size-3' />
                        Extend Trial
                      </Button>
                      <Button
                        size='sm'
                        variant='outline'
                        className='h-7 flex-1 border-emerald-300 text-xs text-emerald-600 hover:bg-emerald-50'
                        disabled={detail.subscriptionStatus === 'paid'}
                        onClick={() => setMarkPaidConfirmOpen(true)}
                      >
                        <BadgeCheck className='me-1.5 size-3' />
                        Mark as Paid
                      </Button>
                    </div>
                  </div>

                  <Separator />
                  <div className='flex flex-col gap-2'>
                    {!detail.isVerified && (
                      <Button
                        size='sm'
                        variant='outline'
                        className='border-indigo-300 text-indigo-600 hover:bg-indigo-50'
                        disabled={verifyDocsMutation.isPending}
                        onClick={() => verifyDocsMutation.mutate(detail.id)}
                      >
                        {verifyDocsMutation.isPending ? 'Verifying…' : 'Verify Documents'}
                      </Button>
                    )}
                    {detail.status === EstablishmentStatus.PENDING && (
                      <>
                        <Button
                          size='sm'
                          className='bg-emerald-600 hover:bg-emerald-700'
                          onClick={() => openAction(detail, 'approve')}
                        >
                          {t('actions.approve')}
                        </Button>
                        <Button
                          size='sm'
                          variant='outline'
                          className='border-rose-300 text-rose-600 hover:bg-rose-50'
                          onClick={() => openAction(detail, 'reject')}
                        >
                          {t('actions.reject')}
                        </Button>
                      </>
                    )}
                    {detail.status === EstablishmentStatus.ACTIVE && (
                      <Button
                        size='sm'
                        variant='outline'
                        className='border-orange-300 text-orange-600 hover:bg-orange-50'
                        onClick={() => openAction(detail, 'suspend')}
                      >
                        {t('actions.suspend')}
                      </Button>
                    )}
                    {detail.status === EstablishmentStatus.SUSPENDED && (
                      <Button
                        size='sm'
                        variant='outline'
                        className='border-emerald-300 text-emerald-600 hover:bg-emerald-50'
                        onClick={() => openAction(detail, 'reactivate')}
                      >
                        {t('actions.reactivate')}
                      </Button>
                    )}
                  </div>
                </TabsContent>

                {/* Activity tab */}
                <TabsContent value='activity' className='mt-4'>
                  {loadingActivity ? (
                    <div className='space-y-2'>
                      {[...Array(5)].map((_, i) => (
                        <Skeleton key={i} className='h-12 rounded-lg' />
                      ))}
                    </div>
                  ) : estActivity && estActivity.length > 0 ? (
                    <div className='space-y-0 divide-y divide-border/40'>
                      {estActivity.map((entry, i) => (
                        <div
                          key={entry._id ?? entry.id ?? i}
                          className='flex items-start gap-2.5 py-2.5 first:pt-0'
                        >
                          <div className='mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted'>
                            <Star className='size-3 text-muted-foreground' />
                          </div>
                          <div className='min-w-0 flex-1'>
                            <p className='text-xs font-medium capitalize'>
                              {entry.action.replace(/_/g, ' ')}
                            </p>
                            <p className='text-[10px] text-muted-foreground'>
                              {entry.adminEmail ?? '—'}
                              {entry.reason ? ` — ${entry.reason}` : ''}
                            </p>
                          </div>
                          <span className='shrink-0 text-[10px] tabular-nums text-muted-foreground/70'>
                            {relativeDate(entry.timestamp ?? entry.createdAt ?? '')}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className='py-8 text-center text-sm text-muted-foreground'>
                      No activity found
                    </p>
                  )}
                </TabsContent>

                {/* Stats tab */}
                <TabsContent value='stats' className='mt-4'>
                  {loadingStats ? (
                    <div className='grid grid-cols-2 gap-3'>
                      {[...Array(6)].map((_, i) => (
                        <Skeleton key={i} className='h-20 rounded-lg' />
                      ))}
                    </div>
                  ) : estStats ? (
                    <div className='space-y-4'>
                      <div className='grid grid-cols-2 gap-3'>
                        {[
                          {
                            label: 'Total Orders',
                            value: (estStats.totalOrders ?? 0).toLocaleString(),
                          },
                          {
                            label: 'Completed',
                            value: (estStats.completedOrders ?? 0).toLocaleString(),
                            color: 'text-[#2E7D32]',
                          },
                          {
                            label: 'Completion Rate',
                            value: `${Math.round((estStats.orderCompletionRate ?? 0) * 100)}%`,
                            color: 'text-[#2E7D32]',
                          },
                          {
                            label: 'Total Revenue',
                            value: `${(estStats.totalRevenue ?? 0).toLocaleString()} TND`,
                            color: 'text-primary',
                          },
                          {
                            label: 'Avg Order Value',
                            value: `${(estStats.averageOrderValue ?? 0).toFixed(1)} TND`,
                          },
                          {
                            label: 'Pickup Rate',
                            value: `${Math.round((estStats.pickupRate ?? 0) * 100)}%`,
                          },
                        ].map(({ label, value, color }) => (
                          <div key={label} className='rounded-lg border border-border/60 px-3 py-3'>
                            <p className='text-[10px] text-muted-foreground'>{label}</p>
                            <p className={`mt-0.5 text-base font-bold tabular-nums ${color ?? ''}`}>
                              {value}
                            </p>
                          </div>
                        ))}
                      </div>
                      <Separator />
                      <div>
                        <p className='mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground'>
                          Offers
                        </p>
                        <div className='grid grid-cols-2 gap-2 text-xs'>
                          {[
                            ['Total Offers', estStats.totalOffers],
                            ['Active', estStats.activeOffers],
                            ['Sold Out', estStats.soldOutOffers],
                            ['Expired', estStats.expiredOffers],
                          ].map(([label, value]) => (
                            <div
                              key={String(label)}
                              className='flex justify-between rounded bg-muted/40 px-2.5 py-1.5'
                            >
                              <span className='text-muted-foreground'>{label}</span>
                              <span className='font-medium tabular-nums'>{value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className='mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground'>
                          Reviews
                        </p>
                        <div className='flex items-center gap-3 rounded-lg bg-muted/40 px-3 py-2.5'>
                          <Star className='size-4 fill-amber-400 text-amber-400' />
                          <span className='text-sm font-bold'>
                            {(estStats.averageRating ?? 0).toFixed(1)}
                          </span>
                          <span className='text-xs text-muted-foreground'>
                            from {estStats.totalReviews ?? 0} reviews
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className='py-8 text-center text-sm text-muted-foreground'>
                      No stats available
                    </p>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      {/* Extend Trial Dialog */}
      {detail && (
        <ExtendTrialDialog
          open={extendTrialOpen}
          onOpenChange={setExtendTrialOpen}
          {...(detail.trialEndsAt ? { currentTrialEndsAt: detail.trialEndsAt } : {})}
          isLoading={extendTrialMutation.isPending}
          onConfirm={payload =>
            extendTrialMutation.mutate(
              { id: detail.id, payload },
              { onSuccess: () => setExtendTrialOpen(false) },
            )
          }
        />
      )}

      {/* Mark as Paid confirm */}
      {detail && (
        <ConfirmActionDialog
          open={markPaidConfirmOpen}
          onOpenChange={setMarkPaidConfirmOpen}
          title='Mark as paid'
          description='Bypass the trial-expiry scan and mark this merchant as paid. This clears the trial end date and reactivates the merchant if they were suspended.'
          confirmLabel='Mark as paid'
          variant='default'
          isLoading={markPaidMutation.isPending}
          onConfirm={reason =>
            markPaidMutation.mutate(
              {
                id: detail.id,
                payload: { sendNotification: true, ...(reason ? { adminNotes: reason } : {}) },
              },
              { onSuccess: () => setMarkPaidConfirmOpen(false) },
            )
          }
          reasonConfig={{
            label: 'Internal notes (optional)',
            placeholder: 'E.g. Invoice #INV-1204 paid on 2026-04-11',
          }}
        />
      )}

      {/* Confirm Dialog */}
      {actionDialog && (
        <ConfirmActionDialog
          open={actionDialog.open}
          onOpenChange={open => !open && setActionDialog(null)}
          title={t(
            `confirm${actionDialog.type.charAt(0).toUpperCase() + actionDialog.type.slice(1)}.title` as Parameters<
              typeof t
            >[0],
          )}
          description={t(
            `confirm${actionDialog.type.charAt(0).toUpperCase() + actionDialog.type.slice(1)}.description` as Parameters<
              typeof t
            >[0],
          )}
          confirmLabel={t(`actions.${actionDialog.type}` as Parameters<typeof t>[0])}
          variant={
            actionDialog.type === 'reject' || actionDialog.type === 'suspend'
              ? actionDialog.type === 'reject'
                ? 'danger'
                : 'warning'
              : 'default'
          }
          isLoading={isPending}
          onConfirm={handleConfirmAction}
          {...(actionDialog.type !== 'approve' && actionDialog.type !== 'reactivate'
            ? {
                reasonConfig: {
                  label: t(
                    `confirm${actionDialog.type.charAt(0).toUpperCase() + actionDialog.type.slice(1)}.reasonLabel` as Parameters<
                      typeof t
                    >[0],
                  ),
                  placeholder: t(
                    `confirm${actionDialog.type.charAt(0).toUpperCase() + actionDialog.type.slice(1)}.reasonPlaceholder` as Parameters<
                      typeof t
                    >[0],
                  ),
                  required: actionDialog.type === 'reject',
                },
              }
            : {})}
        />
      )}
    </div>
  );
}
