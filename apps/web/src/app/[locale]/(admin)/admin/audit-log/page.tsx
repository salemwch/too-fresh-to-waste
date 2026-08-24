'use client';

import { useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  ScrollText,
  Shield,
  AlertTriangle,
  Users,
  Eye,
  User,
  Activity,
  ShieldAlert,
  Settings,
} from 'lucide-react';
import {
  Card,
  CardContent,
  Button,
  Sheet,
  SheetContent,
  SheetTitle,
  Separator,
} from '@foodwaste/ui';
import { AdminModuleHeader } from '@/components/dashboard/admin/admin-module-header';
import { AdminTabNav, type AdminTab } from '@/components/dashboard/admin/admin-tab-nav';
import { AdminKpiRow, type KpiItem } from '@/components/dashboard/admin/admin-kpi-row';
import { AdminDataTable, type ColumnDef } from '@/components/dashboard/admin/admin-data-table';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useAuditLogs, useAuditStats } from '@/hooks/use-admin';
import { adminService } from '@/services/admin.service';
import type { AuditLogItem, AuditLogSearchParams } from '@/types/admin';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function relativeDate(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  return `${days}d ago`;
}

function getActionCategoryIcon(action: string) {
  if (action.startsWith('user_')) return ShieldAlert;
  if (action.startsWith('establishment_')) return Shield;
  if (action.startsWith('order_')) return Activity;
  if (action.startsWith('review_')) return Eye;
  if (action.startsWith('system_') || action.startsWith('bulk_')) return Settings;
  return Activity;
}

function getActionCategory(action: string): 'admin' | 'security' | 'system' {
  if (action.startsWith('user_suspended') || action.startsWith('user_blocked')) return 'security';
  if (action.startsWith('system_')) return 'system';
  return 'admin';
}

// ─── Detail Drawer ───────────────────────────────────────────────────────────

function AuditDetailDrawer({
  entry,
  open,
  onClose,
}: {
  entry: AuditLogItem | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!entry) return null;
  const ActionIcon = getActionCategoryIcon(entry.action);

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent className='w-full overflow-y-auto sm:max-w-lg'>
        <SheetTitle className='sr-only'>Audit Entry Details</SheetTitle>
        <div className='space-y-0'>
          <div className='-mx-2xl -mt-2xl mb-0 border-b border-border/60 bg-muted/20 px-2xl pb-xl pt-xl pe-14'>
            <div className='flex items-start gap-md'>
              <div className='rounded-lg p-sm bg-muted'>
                <ActionIcon className='size-5 text-foreground' />
              </div>
              <div>
                <p className='text-base font-semibold capitalize'>
                  {entry.action.replace(/_/g, ' ')}
                </p>
                <p className='mt-xxs text-xs text-muted-foreground'>
                  {new Date(entry.timestamp).toLocaleString('en-GB')}
                </p>
              </div>
            </div>
          </div>

          <div className='space-y-xl py-xl'>
            <section className='space-y-2.5'>
              <h3 className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
                Event Info
              </h3>
              {[
                { label: 'Admin', value: entry.adminEmail, icon: User },
                {
                  label: 'Action',
                  value: entry.action.replace(/_/g, ' '),
                  icon: Activity,
                },
                ...(entry.targetId
                  ? [{ label: 'Target ID', value: entry.targetId, icon: Eye }]
                  : []),
                { label: 'Target Type', value: entry.targetType, icon: ScrollText },
              ].map(row => (
                <div key={row.label} className='flex items-center justify-between'>
                  <div className='flex items-center gap-1.5 text-muted-foreground'>
                    <row.icon className='size-3' />
                    <span className='text-xs'>{row.label}</span>
                  </div>
                  <span className='text-xs font-medium capitalize'>{row.value}</span>
                </div>
              ))}
              {entry.ipAddress && (
                <div className='flex items-center justify-between'>
                  <span className='text-xs text-muted-foreground'>IP Address</span>
                  <span className='font-mono text-[11px]'>{entry.ipAddress}</span>
                </div>
              )}
            </section>

            {entry.reason && (
              <>
                <Separator />
                <section className='space-y-sm'>
                  <h3 className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
                    Reason
                  </h3>
                  <p className='text-xs text-foreground rounded-lg border border-border/60 bg-muted/20 p-md'>
                    {entry.reason}
                  </p>
                </section>
              </>
            )}

            {(entry.previousValue || entry.newValue) && (
              <>
                <Separator />
                <section className='space-y-sm'>
                  <h3 className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
                    Changes
                  </h3>
                  {entry.previousValue && (
                    <div className='space-y-xs'>
                      <p className='text-[10px] font-medium text-muted-foreground'>Before:</p>
                      <pre className='text-[11px] rounded-lg border border-border/60 bg-muted/20 p-sm overflow-x-auto'>
                        {JSON.stringify(entry.previousValue, null, 2)}
                      </pre>
                    </div>
                  )}
                  {entry.newValue && (
                    <div className='space-y-xs'>
                      <p className='text-[10px] font-medium text-muted-foreground'>After:</p>
                      <pre className='text-[11px] rounded-lg border border-border/60 bg-muted/20 p-sm overflow-x-auto'>
                        {JSON.stringify(entry.newValue, null, 2)}
                      </pre>
                    </div>
                  )}
                </section>
              </>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Content ─────────────────────────────────────────────────────────────────

function AuditLogContent() {
  const t = useTranslations('adminAuditLog');
  const searchParams = useSearchParams();
  const currentTab = searchParams.get('tab') ?? 'all';

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [selectedEntry, setSelectedEntry] = useState<AuditLogItem | null>(null);

  const queryParams: AuditLogSearchParams = {
    page,
    limit: 20,
    ...(currentTab === 'admin'
      ? { targetType: 'user' as const }
      : currentTab === 'security'
        ? { targetType: 'system' as const }
        : {}),
    ...(search ? { adminId: search } : {}),
  };

  const { data: auditResponse, isLoading } = useAuditLogs(queryParams);
  const { data: stats } = useAuditStats(30);

  const logs = auditResponse?.logs ?? [];
  const total = auditResponse?.total ?? 0;
  const totalPages = auditResponse?.totalPages ?? 1;

  const tabs: AdminTab[] = [
    { key: 'all', label: t('tabs.all') },
    { key: 'admin', label: t('tabs.adminActions') },
    { key: 'security', label: t('tabs.security') },
  ];

  const topAction = stats?.actionsByType
    ? (Object.entries(stats.actionsByType)
        .sort(([, a], [, b]) => b - a)[0]?.[0]
        ?.replace(/_/g, ' ') ?? '—')
    : '—';

  const activeAdmins = stats?.actionsByAdmin?.length ?? 0;

  const kpis: KpiItem[] = [
    {
      label: t('kpi.totalEvents'),
      value: stats?.totalActions.toLocaleString() ?? '—',
      icon: ScrollText,
      iconBg: 'bg-indigo-50',
      iconColor: 'text-indigo-600',
    },
    {
      label: t('kpi.activeAdmins'),
      value: activeAdmins.toString(),
      icon: Users,
      iconBg: 'bg-violet-50',
      iconColor: 'text-violet-600',
    },
    {
      label: t('kpi.topAction'),
      value: topAction.length > 14 ? topAction.slice(0, 14) + '…' : topAction,
      icon: Activity,
      iconBg: 'bg-sky-50',
      iconColor: 'text-sky-600',
    },
    {
      label: t('kpi.securityAlerts'),
      value: (stats?.targetsByType?.['system'] ?? 0).toString(),
      icon: AlertTriangle,
      iconBg: 'bg-rose-50',
      iconColor: 'text-rose-600',
      highlight: (stats?.targetsByType?.['system'] ?? 0) > 0,
    },
  ];

  const handleSearch = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  const handleExport = useCallback(async () => {
    try {
      const response = await adminService.exportAuditLogs({ format: 'csv' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      // silently fail — toast would be added with notifications module
    }
  }, []);

  const columns: ColumnDef<AuditLogItem>[] = [
    {
      key: 'timestamp',
      header: t('columns.time'),
      render: e => (
        <div>
          <p className='text-xs tabular-nums'>{relativeDate(e.timestamp)}</p>
          <p className='text-[10px] text-muted-foreground'>
            {new Date(e.timestamp).toLocaleTimeString('en-GB', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </div>
      ),
    },
    {
      key: 'admin',
      header: t('columns.admin'),
      render: e => <span className='text-xs truncate max-w-[140px] block'>{e.adminEmail}</span>,
    },
    {
      key: 'action',
      header: t('columns.action'),
      render: e => {
        const Icon = getActionCategoryIcon(e.action);
        return (
          <div className='flex items-center gap-sm'>
            <Icon className='size-3.5 text-muted-foreground shrink-0' />
            <span className='text-xs capitalize'>{e.action.replace(/_/g, ' ')}</span>
          </div>
        );
      },
    },
    {
      key: 'target',
      header: t('columns.target'),
      render: e => (
        <div>
          <p className='text-xs font-medium'>{e.targetId ?? '—'}</p>
          <p className='text-[10px] text-muted-foreground capitalize'>{e.targetType}</p>
        </div>
      ),
    },
    {
      key: 'category',
      header: t('columns.severity'),
      render: e => {
        const cat = getActionCategory(e.action);
        const styles = {
          admin: 'bg-muted text-muted-foreground',
          security: 'bg-rose-50 text-rose-700 border-rose-200',
          system: 'bg-amber-50 text-amber-700 border-amber-200',
        };
        return (
          <span
            className={cn(
              'inline-flex rounded-full border px-sm py-xxs text-[10px] font-semibold capitalize',
              styles[cat],
            )}
          >
            {cat}
          </span>
        );
      },
    },
    {
      key: 'actions',
      header: '',
      render: e => (
        <Button
          variant='ghost'
          size='sm'
          className='h-9 w-9 p-0'
          onClick={() => setSelectedEntry(e)}
        >
          <Eye className='size-3.5' />
          <span className='sr-only'>View</span>
        </Button>
      ),
    },
  ];

  return (
    <div className='space-y-xl'>
      <AdminModuleHeader
        title={t('title')}
        subtitle={t('subtitle')}
        onExport={handleExport}
        exportLabel={t('exportCSV')}
      />

      <AdminKpiRow items={kpis} loading={!stats} />

      <Card className='border-border/60'>
        <CardContent className='p-0'>
          <AdminTabNav tabs={tabs} />
          <div className='p-lg'>
            <AdminDataTable
              columns={columns}
              data={logs}
              isLoading={isLoading}
              page={page}
              totalPages={totalPages}
              total={total}
              onPageChange={setPage}
              searchPlaceholder={t('searchPlaceholder')}
              onSearchChange={handleSearch}
              onRowClick={row => setSelectedEntry(row)}
              emptyIcon={ScrollText}
              emptyTitle={t('empty.title')}
              emptyDescription={t('empty.description')}
            />
          </div>
        </CardContent>
      </Card>

      <AuditDetailDrawer
        entry={selectedEntry}
        open={!!selectedEntry}
        onClose={() => setSelectedEntry(null)}
      />
    </div>
  );
}

export default function AdminAuditLogPage() {
  return (
    <Suspense
      fallback={
        <div className='space-y-xl'>
          <Skeleton className='h-16 rounded-lg' />
          <div className='grid grid-cols-2 md:grid-cols-4 gap-md'>
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className='h-24 rounded-lg' />
            ))}
          </div>
          <Skeleton className='h-96 rounded-lg' />
        </div>
      }
    >
      <AuditLogContent />
    </Suspense>
  );
}
