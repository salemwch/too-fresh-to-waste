'use client';

import { useState, useMemo, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Network, Building2, CheckCircle, Clock, Ban, Calendar, MapPin } from 'lucide-react';
import { Button, Badge, Sheet, SheetContent, SheetTitle, Separator } from '@foodwaste/ui';
import { Input } from '@/components/ui/input';
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
import {
  useOrganizations,
  useOrganizationDetail,
  useUpdateOrganizationStatus,
} from '@/hooks/use-admin';
import type { OrganizationStatus, OrganizationQuery } from '@/types/admin';
import { toast } from 'sonner';

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
                    {new Date(org.createdAt).toLocaleDateString()}
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
                      {new Date(org.updatedAt).toLocaleString()}
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

  const orgs = orgData?.data ?? [];
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
      toast.error('Failed to update status');
    }
  }, [confirmAction, updateStatus, t]);

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

      {/* Filters */}
      <div className='flex flex-wrap items-center gap-md'>
        <Input
          placeholder={t('filters.searchPlaceholder')}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className='w-64'
        />
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
      </div>

      {/* Table */}
      <div className='overflow-x-auto rounded-lg border border-border/60'>
        <table className='w-full text-sm'>
          <thead>
            <tr className='border-b border-border/60 bg-muted/40'>
              <th className='px-lg py-2.5 text-start text-xs font-medium text-muted-foreground'>
                {t('columns.name')}
              </th>
              <th className='px-lg py-2.5 text-start text-xs font-medium text-muted-foreground'>
                {t('columns.status')}
              </th>
              <th className='px-lg py-2.5 text-center text-xs font-medium text-muted-foreground hidden md:table-cell'>
                {t('columns.locations')}
              </th>
              <th className='px-lg py-2.5 text-start text-xs font-medium text-muted-foreground hidden lg:table-cell'>
                {t('columns.created')}
              </th>
              <th className='px-lg py-2.5 text-end text-xs font-medium text-muted-foreground'>
                {t('columns.actions')}
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              [...Array(6)].map((_, i) => (
                <tr key={i} className='border-b border-border/40'>
                  <td className='px-lg py-md'>
                    <Skeleton className='h-4 w-36 rounded' />
                  </td>
                  <td className='px-lg py-md'>
                    <Skeleton className='h-5 w-16 rounded-full' />
                  </td>
                  <td className='px-lg py-md hidden md:table-cell'>
                    <Skeleton className='h-4 w-8 mx-auto rounded' />
                  </td>
                  <td className='px-lg py-md hidden lg:table-cell'>
                    <Skeleton className='h-4 w-24 rounded' />
                  </td>
                  <td className='px-lg py-md'>
                    <Skeleton className='h-7 w-20 rounded ms-auto' />
                  </td>
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className='py-3xl text-center'>
                  <div className='flex flex-col items-center gap-sm'>
                    <Building2 className='size-10 text-muted-foreground/40' />
                    <p className='text-sm font-medium text-muted-foreground'>{t('empty')}</p>
                    <p className='text-xs text-muted-foreground/70'>{t('emptyDesc')}</p>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map(org => (
                <tr
                  key={org._id}
                  className='border-b border-border/40 hover:bg-muted/20 cursor-pointer'
                  onClick={() => setSelectedOrgId(org._id)}
                >
                  <td className='px-lg py-md'>
                    <div className='flex items-center gap-2.5'>
                      <div className='flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10'>
                        <Network className='size-4 text-primary' />
                      </div>
                      <span className='font-medium text-foreground'>{org.name}</span>
                    </div>
                  </td>
                  <td className='px-lg py-md'>
                    <Badge variant='outline' className={STATUS_STYLES[org.status]}>
                      {t(`status.${org.status}`)}
                    </Badge>
                  </td>
                  <td className='px-lg py-md text-center hidden md:table-cell tabular-nums'>
                    {org.establishmentIds.length}
                  </td>
                  <td className='px-lg py-md hidden lg:table-cell text-xs text-muted-foreground tabular-nums'>
                    {new Date(org.createdAt).toLocaleDateString()}
                  </td>
                  <td className='px-lg py-md text-end' onClick={e => e.stopPropagation()}>
                    <div className='flex justify-end gap-sm'>
                      {org.status === 'pending' && (
                        <Button
                          variant='outline'
                          size='sm'
                          onClick={() =>
                            setConfirmAction({ id: org._id, name: org.name, status: 'active' })
                          }
                        >
                          {t('actions.approve')}
                        </Button>
                      )}
                      {org.status === 'active' && (
                        <Button
                          variant='outline'
                          size='sm'
                          className='text-destructive border-destructive/30'
                          onClick={() =>
                            setConfirmAction({ id: org._id, name: org.name, status: 'suspended' })
                          }
                        >
                          {t('actions.suspend')}
                        </Button>
                      )}
                      {org.status === 'suspended' && (
                        <Button
                          variant='outline'
                          size='sm'
                          onClick={() =>
                            setConfirmAction({ id: org._id, name: org.name, status: 'active' })
                          }
                        >
                          {t('actions.activate')}
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className='flex items-center justify-center gap-sm'>
          <Button
            variant='outline'
            size='sm'
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
          >
            Previous
          </Button>
          <span className='text-sm text-muted-foreground tabular-nums'>
            {page} / {totalPages}
          </span>
          <Button
            variant='outline'
            size='sm'
            disabled={page >= totalPages}
            onClick={() => setPage(p => p + 1)}
          >
            Next
          </Button>
        </div>
      )}

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
