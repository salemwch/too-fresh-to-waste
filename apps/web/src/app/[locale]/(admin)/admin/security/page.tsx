'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
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
              <span className='block mt-1 font-medium text-foreground'>{target.email}</span>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className='space-y-3 pt-2'>
          {/* Failed login details */}
          {infoLoading ? (
            <Skeleton className='h-16 rounded-lg' />
          ) : loginInfo ? (
            <div className='rounded-lg border border-border/60 bg-muted/20 p-3 space-y-1.5'>
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
          <div className='flex gap-3 pt-1'>
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

export default function SecurityPage() {
  const t = useTranslations('adminSecurity');
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

  const accounts = lockedData?.data?.accounts ?? [];
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
      toast.error('Failed to clear IP blocks');
    }
  }, [clearMutation, t]);

  return (
    <div className='space-y-6 p-6'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-semibold'>{t('title')}</h1>
          <p className='text-sm text-muted-foreground'>{t('subtitle')}</p>
        </div>
        <div className='flex items-center gap-3'>
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
            <ShieldAlert className='size-4 me-2' />
            {t('actions.clearIpBlocks')}
          </Button>
        </div>
      </div>

      {/* KPI Row */}
      <AdminKpiRow items={kpiItems} loading={statsLoading} />

      {/* Locked Accounts */}
      <div className='space-y-3'>
        <h2 className='text-lg font-semibold'>{t('lockedAccounts.title')}</h2>
        <div className='overflow-x-auto rounded-lg border border-border/60'>
          <table className='w-full text-sm'>
            <thead>
              <tr className='border-b border-border/60 bg-muted/40'>
                <th className='px-4 py-2.5 text-start text-xs font-medium text-muted-foreground'>
                  {t('lockedAccounts.columns.user')}
                </th>
                <th className='px-4 py-2.5 text-start text-xs font-medium text-muted-foreground hidden md:table-cell'>
                  {t('lockedAccounts.columns.role')}
                </th>
                <th className='px-4 py-2.5 text-center text-xs font-medium text-muted-foreground'>
                  {t('lockedAccounts.columns.failedAttempts')}
                </th>
                <th className='px-4 py-2.5 text-start text-xs font-medium text-muted-foreground hidden lg:table-cell'>
                  {t('lockedAccounts.columns.lockedUntil')}
                </th>
                <th className='px-4 py-2.5 text-end text-xs font-medium text-muted-foreground'>
                  {t('lockedAccounts.columns.actions')}
                </th>
              </tr>
            </thead>
            <tbody>
              {lockedLoading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className='border-b border-border/40'>
                    <td className='px-4 py-3'>
                      <Skeleton className='h-4 w-40 rounded' />
                    </td>
                    <td className='px-4 py-3 hidden md:table-cell'>
                      <Skeleton className='h-4 w-16 rounded' />
                    </td>
                    <td className='px-4 py-3'>
                      <Skeleton className='h-4 w-8 mx-auto rounded' />
                    </td>
                    <td className='px-4 py-3 hidden lg:table-cell'>
                      <Skeleton className='h-4 w-32 rounded' />
                    </td>
                    <td className='px-4 py-3'>
                      <Skeleton className='h-7 w-16 rounded ms-auto' />
                    </td>
                  </tr>
                ))
              ) : accounts.length === 0 ? (
                <tr>
                  <td colSpan={5} className='py-12 text-center'>
                    <div className='flex flex-col items-center gap-2'>
                      <Unlock className='size-10 text-muted-foreground/40' />
                      <p className='text-sm font-medium text-muted-foreground'>
                        {t('lockedAccounts.empty')}
                      </p>
                      <p className='text-xs text-muted-foreground/70'>
                        {t('lockedAccounts.emptyDesc')}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                accounts.map(account => (
                  <tr key={account._id} className='border-b border-border/40 hover:bg-muted/20'>
                    <td className='px-4 py-3'>
                      <div>
                        <p className='font-medium text-foreground'>
                          {account.firstName} {account.lastName}
                        </p>
                        <p className='text-xs text-muted-foreground'>{account.email}</p>
                      </div>
                    </td>
                    <td className='px-4 py-3 hidden md:table-cell'>
                      <span className='inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium capitalize'>
                        {account.role}
                      </span>
                    </td>
                    <td className='px-4 py-3 text-center'>
                      <span className='inline-flex items-center justify-center rounded-full bg-destructive/10 text-destructive px-2 py-0.5 text-xs font-bold tabular-nums'>
                        {account.failedLoginAttempts}
                      </span>
                    </td>
                    <td className='px-4 py-3 hidden lg:table-cell text-xs text-muted-foreground tabular-nums'>
                      {new Date(account.accountLockedUntil).toLocaleString()}
                    </td>
                    <td className='px-4 py-3 text-end'>
                      <Button
                        variant='outline'
                        size='sm'
                        onClick={() => setUnlockTarget({ id: account._id, email: account.email })}
                      >
                        <Unlock className='size-3.5 me-1.5' />
                        {t('lockedAccounts.unlock')}
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className='flex items-center justify-center gap-2 pt-2'>
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
