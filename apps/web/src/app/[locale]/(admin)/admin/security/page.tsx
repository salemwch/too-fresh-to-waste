'use client';

import { useState, useCallback, useMemo } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { ShieldAlert, Lock, Unlock, Users, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@foodwaste/ui';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { StatusBadge } from '@/components/dashboard/admin/status-badge';
import type { LockedAccount } from '@/types/admin';
import {
  useSecurityStats,
  useLockedAccounts,
  useUnlockAccount,
  useClearIpBlocks,
  useFailedLoginAttempts,
} from '@/hooks/use-admin';
import { toast } from 'sonner';

const PERIOD_OPTIONS = [
  { value: '7', label: '7d' },
  { value: '30', label: '30d' },
  { value: '90', label: '90d' },
] as const;

function getPeriodDates(days: number) {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - days);
  return { fromDate: from.toISOString(), toDate: to.toISOString() };
}

function UnlockDialog({
  target,
  reason,
  onReasonChange,
  onClose,
  onUnlock,
  isPending,
  t,
}: {
  target: { id: string; email: string } | null;
  reason: string;
  onReasonChange: (v: string) => void;
  onClose: () => void;
  onUnlock: () => void;
  isPending: boolean;
  t: ReturnType<typeof useTranslations>;
}) {
  const { data: loginInfo, isLoading: infoLoading } = useFailedLoginAttempts(target?.id ?? null);

  return (
    <Dialog
      open={!!target}
      onOpenChange={open => {
        if (!open) onClose();
      }}
    >
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>{t('lockedAccounts.unlockTitle')}</DialogTitle>
          <DialogDescription>
            {t('lockedAccounts.unlockDesc')}
            {target && (
              <span className='block mt-xs font-medium text-foreground'>{target.email}</span>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className='space-y-md pt-sm'>
          {/* Failed login details */}
          {infoLoading ? (
            <Skeleton className='h-16 rounded-lg' />
          ) : loginInfo ? (
            <div className='rounded-lg border border-border/60 bg-muted/20 p-md space-y-1.5'>
              <div className='flex items-center justify-between text-xs'>
                <span className='text-muted-foreground'>
                  {t('lockedAccounts.failedAttemptsDetail')}
                </span>
                <span className='font-bold tabular-nums text-destructive'>
                  {loginInfo.failedAttempts}
                </span>
              </div>
              <div className='flex items-center justify-between text-xs'>
                <span className='text-muted-foreground'>{t('lockedAccounts.lockStatus')}</span>
                <span
                  className={
                    loginInfo.isLocked
                      ? 'font-medium text-destructive'
                      : 'font-medium text-green-600'
                  }
                >
                  {loginInfo.isLocked ? t('lockedAccounts.locked') : t('lockedAccounts.notLocked')}
                </span>
              </div>
              {loginInfo.accountLockedUntil && (
                <div className='flex items-center justify-between text-xs'>
                  <span className='text-muted-foreground'>
                    {t('lockedAccounts.columns.lockedUntil')}
                  </span>
                  <span className='font-medium tabular-nums'>
                    {new Date(loginInfo.accountLockedUntil).toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          ) : null}
          <div className='space-y-1.5'>
            <Label>{t('lockedAccounts.unlockReason')}</Label>
            <Input
              value={reason}
              onChange={e => onReasonChange(e.target.value)}
              placeholder={t('lockedAccounts.unlockReasonPlaceholder')}
            />
          </div>
          <div className='flex gap-md pt-xs'>
            <Button variant='outline' className='flex-1' onClick={onClose}>
              Cancel
            </Button>
            <Button className='flex-1' onClick={onUnlock} disabled={isPending}>
              {isPending ? 'Unlocking...' : t('lockedAccounts.unlockConfirm')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Stable identity for "no locked accounts". `?? []` allocated a new array each
 * render - .claude/rules/performance.md rule 1.
 */
const NO_ACCOUNTS: readonly LockedAccount[] = Object.freeze([]);

export default function SecurityPage() {
  const t = useTranslations('adminSecurity');
  const locale = useLocale();
  const [periodDays, setPeriodDays] = useState(7);
  const [page, setPage] = useState(1);
  const [unlockTarget, setUnlockTarget] = useState<{ id: string; email: string } | null>(null);
  const [unlockReason, setUnlockReason] = useState('');
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const periodParams = getPeriodDates(periodDays);
  const { data: stats, isLoading: statsLoading } = useSecurityStats(periodParams);
  const { data: lockedData, isLoading: lockedLoading } = useLockedAccounts(page, 20);
  const unlockMutation = useUnlockAccount();
  const clearMutation = useClearIpBlocks();

  const accounts = lockedData?.data?.accounts ?? NO_ACCOUNTS;
  const totalLocked = lockedData?.data?.total ?? 0;
  const totalPages = Math.ceil(totalLocked / 20);

  const kpiItems: KpiItem[] = [
    {
      label: t('stats.totalAttempts'),
      value: stats?.summary?.totalLoginAttempts?.toLocaleString() ?? '—',
      icon: Users,
      iconBg: 'bg-blue-500/10',
      iconColor: 'text-blue-600',
    },
    {
      label: t('stats.successRate'),
      value: stats?.summary?.successRate ? `${stats.summary.successRate}%` : '—',
      icon: CheckCircle,
      iconBg: 'bg-green-500/10',
      iconColor: 'text-green-600',
    },
    {
      label: t('stats.lockedAccounts'),
      value: stats?.lockedAccounts?.toString() ?? '—',
      icon: Lock,
      iconBg: 'bg-destructive/10',
      iconColor: 'text-destructive',
      ...(stats?.lockedAccounts && stats.lockedAccounts > 0 ? { highlight: true } : {}),
    },
    {
      label: t('stats.failedLogins'),
      value: stats?.failedLogins?.toLocaleString() ?? '—',
      icon: XCircle,
      iconBg: 'bg-orange-500/10',
      iconColor: 'text-orange-600',
    },
  ];

  const handleUnlock = useCallback(async () => {
    if (!unlockTarget) return;
    try {
      await unlockMutation.mutateAsync({
        userId: unlockTarget.id,
        ...(unlockReason ? { reason: unlockReason } : {}),
      });
      toast.success(t('lockedAccounts.unlocked'));
      setUnlockTarget(null);
      setUnlockReason('');
    } catch {
      toast.error(t('lockedAccounts.unlocked'));
    }
  }, [unlockTarget, unlockReason, unlockMutation, t]);

  const handleClearIpBlocks = useCallback(async () => {
    try {
      const result = await clearMutation.mutateAsync();
      toast.success(t('actions.cleared'), {
        description: t('actions.clearedDetail', {
          ipBlocks: (result as { clearedIpBlocks: number })?.clearedIpBlocks ?? 0,
          attempts: (result as { clearedLoginAttempts: number })?.clearedLoginAttempts ?? 0,
        }),
      });
      setShowClearConfirm(false);
    } catch {
      toast.error(t('actions.clearIpBlocksFailed'));
    }
  }, [clearMutation, t]);

  /**
   * Column definitions for `AdminDataTable`. Memoised so the array keeps one
   * identity across renders - see .claude/rules/performance.md rule 1.
   */
  const columns: readonly ColumnDef<LockedAccount>[] = useMemo(
    () => [
      {
        key: 'user',
        header: t('lockedAccounts.columns.user'),
        render: account => (
          <div>
            <p className='font-medium text-foreground'>
              {account.firstName} {account.lastName}
            </p>
            <p className='text-xs text-muted-foreground'>{account.email}</p>
          </div>
        ),
      },
      {
        key: 'role',
        header: t('lockedAccounts.columns.role'),
        className: 'hidden md:table-cell',
        // Was a bare `<span className='capitalize'>{account.role}</span>`, which
        // painted the raw enum - "merchant" in an otherwise Arabic page.
        // StatusBadge resolves common.badges.role.* and matches how the users
        // page renders the same field.
        render: account => <StatusBadge status={account.role} variant='role' />,
      },
      {
        key: 'failedAttempts',
        header: t('lockedAccounts.columns.failedAttempts'),
        className: 'text-center',
        render: account => (
          <span className='inline-flex items-center justify-center rounded-full bg-destructive/10 px-sm py-xxs text-xs font-bold tabular-nums text-destructive'>
            {account.failedLoginAttempts}
          </span>
        ),
      },
      {
        key: 'lockedUntil',
        header: t('lockedAccounts.columns.lockedUntil'),
        className: 'hidden text-xs text-muted-foreground tabular-nums lg:table-cell',
        // `toLocaleString()` with no argument formats in the browser's locale
        // rather than the app's, so this read as a US timestamp on an Arabic
        // page. The lock expiry is the one figure an admin acts on here.
        render: account => new Date(account.accountLockedUntil).toLocaleString(locale),
      },
      {
        key: 'actions',
        header: t('lockedAccounts.columns.actions'),
        className: 'text-end',
        render: account => (
          <div className='flex justify-end'>
            <Button
              variant='outline'
              size='sm'
              onClick={() => setUnlockTarget({ id: account._id, email: account.email })}
            >
              <Unlock className='me-1.5 size-3.5' />
              {t('lockedAccounts.unlock')}
            </Button>
          </div>
        ),
      },
    ],
    [t, locale],
  );

  return (
    <div className='space-y-2xl p-2xl'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-semibold'>{t('title')}</h1>
          <p className='text-sm text-muted-foreground'>{t('subtitle')}</p>
        </div>
        <div className='flex items-center gap-md'>
          <Select value={String(periodDays)} onValueChange={v => setPeriodDays(Number(v))}>
            <SelectTrigger className='w-[130px]'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value}>
                  {t(`period.${o.label}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant='outline'
            size='sm'
            onClick={() => setShowClearConfirm(true)}
            className='text-destructive border-destructive/30 hover:bg-destructive/5'
          >
            <ShieldAlert className='size-4 me-sm' />
            {t('actions.clearIpBlocks')}
          </Button>
        </div>
      </div>

      {/* KPI Row */}
      <AdminKpiRow items={kpiItems} loading={statsLoading} />

      {/* Locked Accounts */}
      <div className='space-y-md'>
        <h2 className='text-lg font-semibold'>{t('lockedAccounts.title')}</h2>
        <AdminDataTable
          columns={columns}
          data={accounts}
          isLoading={lockedLoading}
          page={page}
          totalPages={totalPages}
          total={totalLocked}
          onPageChange={setPage}
          emptyIcon={Unlock}
          emptyTitle={t('lockedAccounts.empty')}
          emptyDescription={t('lockedAccounts.emptyDesc')}
        />
      </div>

      {/* Unlock Dialog */}
      <UnlockDialog
        target={unlockTarget}
        reason={unlockReason}
        onReasonChange={setUnlockReason}
        onClose={() => {
          setUnlockTarget(null);
          setUnlockReason('');
        }}
        onUnlock={handleUnlock}
        isPending={unlockMutation.isPending}
        t={t}
      />

      {/* Clear IP Blocks Confirm */}
      <ConfirmActionDialog
        open={showClearConfirm}
        onOpenChange={setShowClearConfirm}
        title={t('actions.clearIpBlocks')}
        description={t('actions.clearIpBlocksDesc')}
        confirmLabel={t('actions.clearIpBlocksConfirm')}
        variant='danger'
        isLoading={clearMutation.isPending}
        onConfirm={handleClearIpBlocks}
      />
    </div>
  );
}
