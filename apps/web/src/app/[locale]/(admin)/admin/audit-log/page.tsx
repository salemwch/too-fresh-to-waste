'use client';

import { useState, Suspense } from 'react';
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
  LogIn,
  UserX,
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

// ─── Types ───────────────────────────────────────────────────────────────────

interface AuditEntry {
  id: string;
  timestamp: string;
  adminEmail: string;
  action: string;
  actionType: 'user_management' | 'content_moderation' | 'system_config' | 'security' | 'login';
  target: string;
  targetType: 'user' | 'establishment' | 'offer' | 'order' | 'system';
  severity: 'low' | 'medium' | 'high' | 'critical';
  details?: string;
  ipAddress?: string;
}

// ─── Mock data ───────────────────────────────────────────────────────────────

const MOCK_ENTRIES: AuditEntry[] = [
  {
    id: '1',
    timestamp: '2026-07-18T14:30:00Z',
    adminEmail: 'admin@tftw.tn',
    action: 'Approved establishment',
    actionType: 'content_moderation',
    target: 'Boulangerie Sfax',
    targetType: 'establishment',
    severity: 'medium',
    details: 'Approved after document verification',
  },
  {
    id: '2',
    timestamp: '2026-07-18T13:15:00Z',
    adminEmail: 'moderator@tftw.tn',
    action: 'Suspended user account',
    actionType: 'user_management',
    target: 'user_abc123',
    targetType: 'user',
    severity: 'high',
    details: 'Multiple no-show violations (5 in 7 days)',
  },
  {
    id: '3',
    timestamp: '2026-07-18T11:00:00Z',
    adminEmail: 'admin@tftw.tn',
    action: 'Updated system configuration',
    actionType: 'system_config',
    target: 'rate_limits',
    targetType: 'system',
    severity: 'medium',
    details: 'Increased API rate limit from 100 to 150 req/min',
  },
  {
    id: '4',
    timestamp: '2026-07-18T09:45:00Z',
    adminEmail: 'admin@tftw.tn',
    action: 'Failed login attempt',
    actionType: 'security',
    target: 'admin@tftw.tn',
    targetType: 'user',
    severity: 'critical',
    details: 'Invalid credentials from IP 192.168.1.100',
    ipAddress: '192.168.1.100',
  },
  {
    id: '5',
    timestamp: '2026-07-17T16:20:00Z',
    adminEmail: 'moderator@tftw.tn',
    action: 'Removed offer listing',
    actionType: 'content_moderation',
    target: 'offer_xyz789',
    targetType: 'offer',
    severity: 'medium',
    details: 'Misleading description reported by 3 users',
  },
];

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

function getSeverityStyle(severity: AuditEntry['severity']) {
  const map = {
    low: 'bg-muted text-muted-foreground',
    medium: 'bg-amber-50 text-amber-700 border-amber-200',
    high: 'bg-orange-50 text-orange-700 border-orange-200',
    critical: 'bg-rose-50 text-rose-700 border-rose-200',
  };
  return map[severity];
}

function getActionIcon(type: AuditEntry['actionType']) {
  switch (type) {
    case 'user_management':
      return UserX;
    case 'content_moderation':
      return Shield;
    case 'system_config':
      return Settings;
    case 'security':
      return ShieldAlert;
    case 'login':
      return LogIn;
    default:
      return Activity;
  }
}

// ─── Detail Drawer ───────────────────────────────────────────────────────────

function AuditDetailDrawer({
  entry,
  open,
  onClose,
}: {
  entry: AuditEntry | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!entry) return null;
  const ActionIcon = getActionIcon(entry.actionType);

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent className='w-full overflow-y-auto sm:max-w-lg'>
        <SheetTitle className='sr-only'>Audit Entry Details</SheetTitle>
        <div className='space-y-0'>
          <div className='-mx-6 -mt-6 mb-0 border-b border-border/60 bg-muted/20 px-6 pb-5 pt-5 pe-14'>
            <div className='flex items-start gap-3'>
              <div className={cn('rounded-lg p-2', getSeverityStyle(entry.severity))}>
                <ActionIcon className='size-5' />
              </div>
              <div>
                <p className='text-base font-semibold'>{entry.action}</p>
                <p className='mt-0.5 text-xs text-muted-foreground'>
                  {new Date(entry.timestamp).toLocaleString('en-GB')}
                </p>
              </div>
            </div>
          </div>

          <div className='space-y-5 py-5'>
            <section className='space-y-2.5'>
              <h3 className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
                Event Info
              </h3>
              {[
                { label: 'Admin', value: entry.adminEmail, icon: User },
                {
                  label: 'Action Type',
                  value: entry.actionType.replace(/_/g, ' '),
                  icon: Activity,
                },
                { label: 'Target', value: entry.target, icon: Eye },
                { label: 'Target Type', value: entry.targetType, icon: ScrollText },
                { label: 'Severity', value: entry.severity, icon: AlertTriangle },
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

            {entry.details && (
              <>
                <Separator />
                <section className='space-y-2'>
                  <h3 className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
                    Details
                  </h3>
                  <p className='text-xs text-foreground rounded-lg border border-border/60 bg-muted/20 p-3'>
                    {entry.details}
                  </p>
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
  const [selectedEntry, setSelectedEntry] = useState<AuditEntry | null>(null);

  const tabs: AdminTab[] = [
    { key: 'all', label: t('tabs.all') },
    { key: 'admin', label: t('tabs.adminActions') },
    { key: 'security', label: t('tabs.security'), badge: 1 },
  ];

  const filteredEntries = MOCK_ENTRIES.filter(e => {
    if (currentTab === 'admin')
      return (
        e.actionType === 'user_management' ||
        e.actionType === 'content_moderation' ||
        e.actionType === 'system_config'
      );
    if (currentTab === 'security') return e.actionType === 'security' || e.severity === 'critical';
    return true;
  });

  const kpis: KpiItem[] = [
    {
      label: t('kpi.totalEvents'),
      value: '1,247',
      icon: ScrollText,
      iconBg: 'bg-indigo-50',
      iconColor: 'text-indigo-600',
    },
    {
      label: t('kpi.activeAdmins'),
      value: '4',
      icon: Users,
      iconBg: 'bg-violet-50',
      iconColor: 'text-violet-600',
    },
    {
      label: t('kpi.topAction'),
      value: 'User Mgmt',
      icon: Activity,
      iconBg: 'bg-sky-50',
      iconColor: 'text-sky-600',
    },
    {
      label: t('kpi.securityAlerts'),
      value: '2',
      icon: AlertTriangle,
      iconBg: 'bg-rose-50',
      iconColor: 'text-rose-600',
      highlight: true,
    },
  ];

  const columns: ColumnDef<AuditEntry>[] = [
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
      render: e => <span className='text-xs truncate max-w-[140px]'>{e.adminEmail}</span>,
    },
    {
      key: 'action',
      header: t('columns.action'),
      render: e => {
        const Icon = getActionIcon(e.actionType);
        return (
          <div className='flex items-center gap-2'>
            <Icon className='size-3.5 text-muted-foreground shrink-0' />
            <span className='text-xs'>{e.action}</span>
          </div>
        );
      },
    },
    {
      key: 'target',
      header: t('columns.target'),
      render: e => (
        <div>
          <p className='text-xs font-medium'>{e.target}</p>
          <p className='text-[10px] text-muted-foreground capitalize'>{e.targetType}</p>
        </div>
      ),
    },
    {
      key: 'severity',
      header: t('columns.severity'),
      render: e => (
        <span
          className={cn(
            'inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize',
            getSeverityStyle(e.severity),
          )}
        >
          {e.severity}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: e => (
        <Button
          variant='ghost'
          size='sm'
          className='h-7 w-7 p-0'
          onClick={() => setSelectedEntry(e)}
        >
          <Eye className='size-3.5' />
          <span className='sr-only'>View</span>
        </Button>
      ),
    },
  ];

  return (
    <div className='space-y-5'>
      <AdminModuleHeader
        title={t('title')}
        subtitle={t('subtitle')}
        onExport={() => {}}
        exportLabel={t('exportCSV')}
      />

      <AdminKpiRow items={kpis} />

      <Card className='border-border/60'>
        <CardContent className='p-0'>
          <AdminTabNav tabs={tabs} />
          <div className='p-4'>
            <AdminDataTable
              columns={columns}
              data={filteredEntries}
              isLoading={false}
              page={1}
              totalPages={1}
              total={filteredEntries.length}
              onPageChange={() => {}}
              searchPlaceholder={t('searchPlaceholder')}
              onSearchChange={() => {}}
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
        <div className='space-y-5'>
          <Skeleton className='h-16 rounded-lg' />
          <div className='grid grid-cols-2 md:grid-cols-4 gap-3'>
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
