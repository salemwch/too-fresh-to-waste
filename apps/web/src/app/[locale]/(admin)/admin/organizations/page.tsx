'use client';

import { useState, useMemo, useCallback } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Network, Building2, CheckCircle, Clock, Ban, Calendar, MapPin } from 'lucide-react';
import { Button, Badge, Sheet, SheetContent, SheetTitle, Separator } from '@foodwaste/ui';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmActionDialog } from '@/components/dashboard/admin/confirm-action-dialog';
import { AdminKpiRow, type KpiItem } from '@/components/dashboard/admin/admin-kpi-row';
import { AdminDataTable, type ColumnDef } from '@/components/dashboard/admin/admin-data-table';
import {
  useOrganizations,
  useOrganizationDetail,
  useUpdateOrganizationStatus,
} from '@/hooks/use-admin';
import type { OrganizationStatus, OrganizationQuery, OrganizationRow } from '@/types/admin';
import { toast } from 'sonner';
import { useFormat, MISSING_COUNT } from '@/lib/use-format';

/**
 * A stable identity for "no organizations yet".
 *
 * `orgData?.data ?? []` allocates a fresh array on every render, and both
 * `useMemo`s below list `orgs` as a dependency - so while the request is
 * in flight they recomputed on every keystroke in the search box. See
 * .claude/rules/performance.md rule 1 and the `NO_OFFERS` precedent it cites.
 */
const NO_ORGANIZATIONS: readonly OrganizationRow[] = Object.freeze([]);

const STATUS_STYLES: Record<OrganizationStatus, string> = {
  pending: 'bg-warning/10 text-warning border-warning',
  active: 'bg-green-500/10 text-green-700 border-green-500/30',
  suspended: 'bg-destructive/10 text-destructive border-destructive/30',
};

function OrgDetailDrawer({
  orgId,
  open,
  onClose,
}: {
  orgId: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const fmt = useFormat();
  const t = useTranslations('adminOrganizations');
  const { data: org, isLoading } = useOrganizationDetail(orgId);

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent className='w-full overflow-y-auto sm:max-w-lg'>
        <SheetTitle className='sr-only'>{t('detail.title')}</SheetTitle>
        {isLoading ? (
          <div className='space-y-lg py-2xl'>
            <Skeleton className='h-8 w-48 rounded' />
            <Skeleton className='h-20 rounded-lg' />
            <Skeleton className='h-16 rounded-lg' />
          </div>
        ) : org ? (
          <div className='space-y-0'>
            <div className='-mx-2xl -mt-2xl mb-0 border-b border-border/60 bg-muted/20 px-2xl pb-xl pt-xl pe-14'>
              <div className='flex items-start gap-md'>
                <div className='flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10'>
                  <Network className='size-5 text-primary' />
                </div>
                <div>
                  <p className='text-base font-semibold'>{org.name}</p>
                  <Badge
                    variant='outline'
                    className={`mt-1.5 text-[10px] ${STATUS_STYLES[org.status]}`}
                  >
                    {t(`status.${org.status}`)}
                  </Badge>
                </div>
              </div>
              <div className='mt-md grid grid-cols-2 gap-sm'>
                <div className='rounded-lg bg-background/60 border border-border/40 px-md py-sm text-center'>
                  <p className='text-lg font-bold tabular-nums'>{org.establishmentIds.length}</p>
                  <p className='text-[10px] text-muted-foreground'>{t('columns.locations')}</p>
                </div>
                <div className='rounded-lg bg-background/60 border border-border/40 px-md py-sm text-center'>
                  <p className='text-lg font-bold tabular-nums'>
                    {fmt.date(org.createdAt) ?? MISSING_COUNT}
                  </p>
                  <p className='text-[10px] text-muted-foreground'>{t('columns.created')}</p>
                </div>
              </div>
            </div>

            <div className='space-y-xl py-xl'>
              <section className='space-y-md'>
                <h3 className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
                  {t('detail.info')}
                </h3>
                <div className='space-y-2.5'>
                  <div className='flex items-center justify-between'>
                    <div className='flex items-center gap-1.5 text-muted-foreground'>
                      <Network className='size-3' />
                      <span className='text-xs'>{t('detail.orgId')}</span>
                    </div>
                    <span className='font-mono text-[11px] text-muted-foreground'>
                      ...{org._id.slice(-8)}
                    </span>
                  </div>
                  <div className='flex items-center justify-between'>
                    <div className='flex items-center gap-1.5 text-muted-foreground'>
                      <Building2 className='size-3' />
                      <span className='text-xs'>{t('detail.owner')}</span>
                    </div>
                    <span className='font-mono text-[11px] text-muted-foreground'>
                      ...{org.ownerId.slice(-8)}
                    </span>
                  </div>
                  <div className='flex items-center justify-between'>
                    <div className='flex items-center gap-1.5 text-muted-foreground'>
                      <Calendar className='size-3' />
                      <span className='text-xs'>{t('detail.lastUpdated')}</span>
                    </div>
                    <span className='text-xs font-medium'>
                      {fmt.dateTime(org.updatedAt) ?? MISSING_COUNT}
                    </span>
                  </div>
                </div>
              </section>

              {org.establishmentIds.length > 0 && (
                <>
                  <Separator />
                  <section className='space-y-md'>
                    <h3 className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
                      {t('detail.establishmentIds')}
                    </h3>
                    <div className='space-y-1.5'>
                      {org.establishmentIds.map(id => (
                        <div
                          key={id}
                          className='flex items-center gap-sm rounded-lg border border-border/60 px-md py-sm'
                        >
                          <MapPin className='size-3.5 text-muted-foreground' />
                          <span className='font-mono text-xs text-muted-foreground'>
                            ...{id.slice(-12)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </section>
                </>
              )}
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

export default function OrganizationsPage() {
  const t = useTranslations('adminOrganizations');
  const locale = useLocale();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [confirmAction, setConfirmAction] = useState<{
    id: string;
    name: string;
    status: OrganizationStatus;
  } | null>(null);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);

  const params: OrganizationQuery = {
    page,
    limit: 20,
    ...(statusFilter !== 'all' ? { status: statusFilter as OrganizationStatus } : {}),
  };

  const { data: orgData, isLoading } = useOrganizations(params);
  const updateStatus = useUpdateOrganizationStatus();

  const orgs = orgData?.data ?? NO_ORGANIZATIONS;
  const total = orgData?.meta?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  const filtered = useMemo(() => {
    if (!search) return orgs;
    const q = search.toLowerCase();
    return orgs.filter(o => o.name.toLowerCase().includes(q));
  }, [orgs, search]);

  const statusCounts = useMemo(() => {
    const counts = { total: total, pending: 0, active: 0, suspended: 0 };
    for (const o of orgs) {
      if (o.status in counts) counts[o.status as keyof typeof counts]++;
    }
    return counts;
  }, [orgs, total]);

  const kpiItems: KpiItem[] = [
    {
      label: t('stats.total'),
      value: String(statusCounts.total),
      icon: Network,
      iconBg: 'bg-blue-500/10',
      iconColor: 'text-blue-600',
    },
    {
      label: t('stats.pending'),
      value: String(statusCounts.pending),
      icon: Clock,
      iconBg: 'bg-warning/10',
      iconColor: 'text-warning',
      ...(statusCounts.pending > 0 ? { highlight: true } : {}),
    },
    {
      label: t('stats.active'),
      value: String(statusCounts.active),
      icon: CheckCircle,
      iconBg: 'bg-green-500/10',
      iconColor: 'text-green-600',
    },
    {
      label: t('stats.suspended'),
      value: String(statusCounts.suspended),
      icon: Ban,
      iconBg: 'bg-destructive/10',
      iconColor: 'text-destructive',
    },
  ];

  const handleStatusChange = useCallback(async () => {
    if (!confirmAction) return;
    try {
      await updateStatus.mutateAsync({ id: confirmAction.id, status: confirmAction.status });
      toast.success(t('actions.statusUpdated'));
      setConfirmAction(null);
    } catch {
      toast.error(t('actions.statusUpdateFailed'));
    }
  }, [confirmAction, updateStatus, t]);

  /**
   * Column definitions for `AdminDataTable`.
   *
   * `render` runs per row, so this is memoised on the values it closes over -
   * `t` and `locale` are stable per render, `setConfirmAction` is a setState
   * identity. Without this the array is a fresh identity every keystroke in the
   * search box, which is exactly the allocation-in-render pattern
   * `.claude/rules/performance.md` rule 1 rules out.
   */
  const columns: ColumnDef<OrganizationRow>[] = useMemo(
    () => [
      {
        key: 'name',
        header: t('columns.name'),
        render: org => (
          <div className='flex items-center gap-2.5'>
            <div className='flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10'>
              <Network className='size-4 text-primary' />
            </div>
            <span className='font-medium text-foreground'>{org.name}</span>
          </div>
        ),
      },
      {
        key: 'status',
        header: t('columns.status'),
        render: org => (
          <Badge variant='outline' className={STATUS_STYLES[org.status]}>
            {t(`status.${org.status}`)}
          </Badge>
        ),
      },
      {
        key: 'locations',
        header: t('columns.locations'),
        className: 'hidden text-center tabular-nums md:table-cell',
        render: org => org.establishmentIds.length,
      },
      {
        key: 'created',
        header: t('columns.created'),
        className: 'hidden text-xs text-muted-foreground tabular-nums lg:table-cell',
        // `toLocaleDateString()` with no argument formats in the *browser's*
        // locale, not the app's - so an Arabic admin on an en-US machine read
        // Gregorian US dates on an otherwise Arabic page. Passing `locale`
        // makes the date follow the language the admin chose.
        render: org => new Date(org.createdAt).toLocaleDateString(locale),
      },
      {
        key: 'actions',
        header: t('columns.actions'),
        className: 'text-end',
        render: org => (
          // The row opens the detail drawer, so each action button stops the
          // click from reaching it - otherwise approving an org also opened the
          // sheet behind the confirm dialog. This used to live on a wrapping
          // `div onClick`, which is unreachable by keyboard: a user tabbing to
          // Approve and pressing Enter fired the button but never the guard.
          // Buttons are natively interactive, so putting it on each one covers
          // pointer and keyboard identically.
          <div className='flex justify-end gap-sm'>
            {org.status === 'pending' && (
              <Button
                variant='outline'
                size='sm'
                onClick={e => {
                  e.stopPropagation();
                  setConfirmAction({ id: org._id, name: org.name, status: 'active' });
                }}
              >
                {t('actions.approve')}
              </Button>
            )}
            {org.status === 'active' && (
              <Button
                variant='outline'
                size='sm'
                className='text-destructive border-destructive/30'
                onClick={e => {
                  e.stopPropagation();
                  setConfirmAction({ id: org._id, name: org.name, status: 'suspended' });
                }}
              >
                {t('actions.suspend')}
              </Button>
            )}
            {org.status === 'suspended' && (
              <Button
                variant='outline'
                size='sm'
                onClick={e => {
                  e.stopPropagation();
                  setConfirmAction({ id: org._id, name: org.name, status: 'active' });
                }}
              >
                {t('actions.activate')}
              </Button>
            )}
          </div>
        ),
      },
    ],
    [t, locale],
  );

  const getConfirmDesc = (status: OrganizationStatus) => {
    const key =
      status === 'active'
        ? 'confirmApprove'
        : status === 'suspended'
          ? 'confirmSuspend'
          : 'confirmActivate';
    return t(`actions.${key}`);
  };

  return (
    <div className='space-y-2xl p-2xl'>
      {/* Header */}
      <div>
        <h1 className='text-2xl font-semibold'>{t('title')}</h1>
        <p className='text-sm text-muted-foreground'>{t('subtitle')}</p>
      </div>

      {/* KPI Row */}
      <AdminKpiRow items={kpiItems} loading={isLoading} />

      {/*
        Filters, table, empty state, skeleton and pagination were all hand-built
        here. `AdminDataTable` already provides every one of them, and the
        hand-rolled version had drifted: its pagination buttons read "Previous"
        and "Next" in hardcoded English on a page that is otherwise translated.
      */}
      <AdminDataTable
        columns={columns}
        data={filtered}
        isLoading={isLoading}
        page={page}
        totalPages={totalPages}
        total={total}
        onPageChange={setPage}
        searchValue={search}
        searchPlaceholder={t('filters.searchPlaceholder')}
        onSearchChange={value => {
          setSearch(value);
          setPage(1);
        }}
        onRowClick={org => setSelectedOrgId(org._id)}
        filterSlot={
          <Select
            value={statusFilter}
            onValueChange={v => {
              setStatusFilter(v);
              setPage(1);
            }}
          >
            <SelectTrigger className='w-[160px]'>
              <SelectValue placeholder={t('filters.allStatuses')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>{t('filters.allStatuses')}</SelectItem>
              <SelectItem value='pending'>{t('status.pending')}</SelectItem>
              <SelectItem value='active'>{t('status.active')}</SelectItem>
              <SelectItem value='suspended'>{t('status.suspended')}</SelectItem>
            </SelectContent>
          </Select>
        }
        emptyIcon={Building2}
        emptyTitle={t('empty')}
        emptyDescription={t('emptyDesc')}
      />

      {/* Confirm Dialog */}
      {confirmAction && (
        <ConfirmActionDialog
          open={!!confirmAction}
          onOpenChange={open => {
            if (!open) setConfirmAction(null);
          }}
          title={t('actions.confirmTitle')}
          description={`${getConfirmDesc(confirmAction.status)}\n\n${confirmAction.name}`}
          confirmLabel={
            confirmAction.status === 'active'
              ? t('actions.approve')
              : confirmAction.status === 'suspended'
                ? t('actions.suspend')
                : t('actions.activate')
          }
          variant={confirmAction.status === 'suspended' ? 'danger' : 'default'}
          isLoading={updateStatus.isPending}
          onConfirm={handleStatusChange}
        />
      )}

      {/* Detail Drawer */}
      <OrgDetailDrawer
        orgId={selectedOrgId}
        open={!!selectedOrgId}
        onClose={() => setSelectedOrgId(null)}
      />
    </div>
  );
}
