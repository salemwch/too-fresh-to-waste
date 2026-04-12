'use client';

import { useTranslations } from 'next-intl';
import { useHealth, useLiveness } from '@/hooks/use-admin';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@foodwaste/ui';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Database,
  Layers,
  MemoryStick,
  Server,
  Clock,
  Cpu,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { HealthStatus } from '@/types/admin';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

const SERVICE_ICONS: Record<string, React.ElementType> = {
  database: Database,
  redis: Layers,
  memory_heap: MemoryStick,
  memory_rss: Cpu,
};

function StatusIcon({ status }: { status: HealthStatus }) {
  if (status === 'up') return <CheckCircle2 className='size-5 text-[#2E7D32]' />;
  if (status === 'down') return <XCircle className='size-5 text-destructive' />;
  return <AlertCircle className='size-5 text-warning' />;
}

function statusBg(status: HealthStatus) {
  if (status === 'up') return 'border-[#2E7D32]/20 bg-[#2E7D32]/5';
  if (status === 'down') return 'border-destructive/20 bg-destructive/5';
  return 'border-warning/20 bg-warning/5';
}

function statusBadge(status: HealthStatus, label: string) {
  if (status === 'up')
    return <Badge className='border-[#2E7D32]/30 bg-[#2E7D32]/10 text-[#2E7D32]'>{label}</Badge>;
  if (status === 'down')
    return (
      <Badge className='border-destructive/30 bg-destructive/10 text-destructive'>{label}</Badge>
    );
  return <Badge variant='secondary'>{label}</Badge>;
}

// ─── Pulse dot ────────────────────────────────────────────────────────────────

function PulseDot({ status }: { status: HealthStatus }) {
  return (
    <span className='relative flex size-3'>
      {status === 'up' && (
        <span className='absolute inline-flex h-full w-full animate-ping rounded-full bg-[#2E7D32] opacity-50' />
      )}
      <span
        className={cn(
          'relative inline-flex size-3 rounded-full',
          status === 'up' && 'bg-[#2E7D32]',
          status === 'down' && 'bg-destructive',
          status === 'unknown' && 'bg-warning',
        )}
      />
    </span>
  );
}

// ─── Overall status banner ────────────────────────────────────────────────────

function OverallBanner({
  status,
  t,
}: {
  status: 'ok' | 'error' | 'shutting_down' | undefined;
  t: ReturnType<typeof useTranslations>;
}) {
  const isOk = status === 'ok';
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-xl border px-5 py-4',
        isOk ? 'border-[#2E7D32]/20 bg-[#2E7D32]/5' : 'border-destructive/20 bg-destructive/5',
      )}
    >
      <PulseDot status={isOk ? 'up' : 'down'} />
      <div>
        <p className={cn('text-sm font-semibold', isOk ? 'text-[#2E7D32]' : 'text-destructive')}>
          {isOk ? t('overall.healthy') : t('overall.down')}
        </p>
      </div>
    </div>
  );
}

// ─── Service card ─────────────────────────────────────────────────────────────

function ServiceCard({
  name,
  status,
  t,
}: {
  name: string;
  status: HealthStatus;
  t: ReturnType<typeof useTranslations>;
}) {
  const Icon = SERVICE_ICONS[name] ?? Server;
  const label = t(`services.${name}` as Parameters<typeof t>[0], { fallback: name });
  const statusLabel = t(`status.${status}` as Parameters<typeof t>[0], { fallback: status });

  return (
    <div
      className={cn(
        'flex items-center gap-4 rounded-xl border p-4 transition-all duration-300',
        statusBg(status),
      )}
    >
      <div className='flex size-10 shrink-0 items-center justify-center rounded-lg bg-background shadow-xs'>
        <Icon className='size-5 text-muted-foreground' />
      </div>
      <div className='flex-1 min-w-0'>
        <p className='text-sm font-medium'>{label}</p>
        <div className='mt-1'>{statusBadge(status, statusLabel)}</div>
      </div>
      <StatusIcon status={status} />
    </div>
  );
}

// ─── Liveness info row ────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className='flex items-center justify-between gap-3 py-2.5'>
      <span className='text-sm text-muted-foreground'>{label}</span>
      <span className='text-sm font-medium tabular-nums'>{value}</span>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function HealthSkeleton() {
  return (
    <div className='space-y-6'>
      <Skeleton className='h-14 w-full rounded-xl' />
      <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className='h-20 rounded-xl' />
        ))}
      </div>
      <Skeleton className='h-48 rounded-xl' />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminHealthPage() {
  const t = useTranslations('dashboard.adminHealth');
  const {
    data: health,
    isLoading: loadingHealth,
    dataUpdatedAt,
    refetch,
    isFetching,
  } = useHealth();
  const { data: liveness, isLoading: loadingLiveness } = useLiveness();

  const overallStatus = health?.status;

  // Build service list from info + error merged
  const indicators: Record<string, HealthStatus> = {};
  if (health) {
    for (const [key, val] of Object.entries(health.info ?? {})) {
      indicators[key] = val.status;
    }
    for (const [key, val] of Object.entries(health.error ?? {})) {
      indicators[key] = val.status;
    }
  }

  const lastChecked = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : '—';

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex items-start justify-between gap-4'>
        <div>
          <h1 className='text-xl font-bold tracking-tight'>{t('title')}</h1>
          <p className='mt-0.5 text-sm text-muted-foreground'>{t('description')}</p>
        </div>
        <div className='flex items-center gap-2 shrink-0'>
          <span className='hidden text-xs text-muted-foreground sm:block'>{t('autoRefresh')}</span>
          <Button
            variant='outline'
            size='sm'
            onClick={() => void refetch()}
            disabled={isFetching}
            className='gap-1.5'
          >
            <RefreshCw className={cn('size-3.5', isFetching && 'animate-spin')} />
            {t('refresh')}
          </Button>
        </div>
      </div>

      {loadingHealth || loadingLiveness ? (
        <HealthSkeleton />
      ) : (
        <>
          {/* Overall status */}
          <OverallBanner status={overallStatus} t={t} />

          {/* Service cards */}
          <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
            {Object.entries(indicators).map(([name, status]) => (
              <ServiceCard key={name} name={name} status={status} t={t} />
            ))}
          </div>

          {/* Two-column: liveness + meta */}
          <div className='grid gap-4 lg:grid-cols-2'>
            {/* Instance info */}
            <Card className='border-border/60'>
              <CardHeader className='pb-2'>
                <div className='flex items-center gap-2'>
                  <Server className='size-4 text-muted-foreground' />
                  <CardTitle className='text-sm font-semibold'>{t('liveness.title')}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className='divide-y divide-border/60'>
                  <InfoRow
                    label={t('liveness.environment')}
                    value={
                      <Badge variant='secondary' className='capitalize'>
                        {liveness?.environment ?? '—'}
                      </Badge>
                    }
                  />
                  <InfoRow
                    label={t('liveness.uptime')}
                    value={liveness ? formatUptime(liveness.uptime) : '—'}
                  />
                  <InfoRow
                    label={t('liveness.checkedAt')}
                    value={
                      <span className='flex items-center gap-1.5'>
                        <Clock className='size-3 text-muted-foreground' />
                        {liveness
                          ? new Date(liveness.timestamp).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })
                          : '—'}
                      </span>
                    }
                  />
                </div>
              </CardContent>
            </Card>

            {/* Check metadata */}
            <Card className='border-border/60'>
              <CardHeader className='pb-2'>
                <div className='flex items-center gap-2'>
                  <CheckCircle2 className='size-4 text-muted-foreground' />
                  <CardTitle className='text-sm font-semibold'>Check Summary</CardTitle>
                </div>
                <CardDescription className='text-xs'>
                  {t('lastChecked')}: {lastChecked}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className='divide-y divide-border/60'>
                  <InfoRow label='Total checks' value={Object.keys(indicators).length} />
                  <InfoRow
                    label='Passing'
                    value={
                      <span className='font-semibold text-[#2E7D32]'>
                        {Object.values(indicators).filter(s => s === 'up').length}
                      </span>
                    }
                  />
                  <InfoRow
                    label='Failing'
                    value={
                      <span
                        className={cn(
                          'font-semibold',
                          Object.values(indicators).filter(s => s === 'down').length > 0
                            ? 'text-destructive'
                            : 'text-muted-foreground',
                        )}
                      >
                        {Object.values(indicators).filter(s => s === 'down').length}
                      </span>
                    }
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Services detail list */}
          <Card className='border-border/60'>
            <CardHeader className='pb-3'>
              <CardTitle className='text-sm font-semibold'>Service Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className='divide-y divide-border/60'>
                {Object.entries(indicators).map(([name, status]) => {
                  const Icon = SERVICE_ICONS[name] ?? Server;
                  const label = t(`services.${name}` as Parameters<typeof t>[0], {
                    fallback: name,
                  });
                  const statusLabel = t(`status.${status}` as Parameters<typeof t>[0], {
                    fallback: status,
                  });
                  return (
                    <div key={name} className='flex items-center gap-4 py-3'>
                      <div className='flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted'>
                        <Icon className='size-4 text-muted-foreground' />
                      </div>
                      <span className='flex-1 text-sm font-medium'>{label}</span>
                      <div className='flex items-center gap-2'>
                        {statusBadge(status, statusLabel)}
                        <StatusIcon status={status} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
