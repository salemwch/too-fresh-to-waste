'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import {
  HeartHandshake,
  Loader2,
  TrendingUp,
  Users,
  Utensils,
  Target,
  RefreshCw,
  Save,
  AlertTriangle,
  CalendarX,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  Input,
  Label,
  Separator,
  Badge,
} from '@foodwaste/ui';
import { Textarea } from '@/components/ui/textarea';
import { ConfirmActionDialog } from '@/components/dashboard/admin/confirm-action-dialog';
import {
  useAdminDonationPool,
  useUpdateDonationPool,
  useResetDonationPool,
} from '@/hooks/use-admin';
import type { DonationPoolStatus } from '@/types/dashboard';

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({
  status,
  t,
}: {
  status: DonationPoolStatus;
  t: ReturnType<typeof useTranslations>;
}) {
  const variants: Record<DonationPoolStatus, string> = {
    active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    funded: 'bg-blue-50 text-blue-700 border-blue-200',
    distributed: 'bg-purple-50 text-purple-700 border-purple-200',
    archived: 'bg-gray-100 text-gray-500 border-gray-200',
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${variants[status] ?? variants.active}`}
    >
      {t(`status.${status}`)}
    </span>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  icon: Icon,
  sub,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  sub?: string;
}) {
  return (
    <Card className='border-border/60'>
      <CardContent className='p-5'>
        <div className='flex items-start justify-between'>
          <div>
            <p className='text-xs font-medium text-muted-foreground'>{label}</p>
            <p className='mt-1 text-2xl font-bold tracking-tight'>{value}</p>
            {sub && <p className='mt-0.5 text-xs text-muted-foreground'>{sub}</p>}
          </div>
          <div className='rounded-lg bg-primary-500/10 p-2'>
            <Icon className='size-4 text-primary-500' />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminDonationPoolPage() {
  const t = useTranslations('dashboard.adminDonationPool');

  const { data: pool, isLoading, refetch, isFetching } = useAdminDonationPool();
  const updatePool = useUpdateDonationPool();
  const resetPool = useResetDonationPool();

  const [targetAmount, setTargetAmount] = useState('');
  const [cause, setCause] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [resetDialog, setResetDialog] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Sync form with fetched data
  useEffect(() => {
    if (pool) {
      setTargetAmount(String(pool.targetAmount));
      setCause(pool.cause);
      setTargetDate(pool.targetDate ? pool.targetDate.slice(0, 10) : '');
    }
  }, [pool]);

  const isDirty =
    pool &&
    (Number(targetAmount) !== pool.targetAmount ||
      cause !== pool.cause ||
      (targetDate ? `${targetDate}T00:00:00.000Z` : undefined) !== pool.targetDate);

  function handleSave() {
    updatePool.mutate(
      {
        targetAmount: Number(targetAmount),
        cause,
        targetDate: targetDate ? new Date(targetDate).toISOString() : null,
      },
      {
        onSuccess: () => {
          setSaveSuccess(true);
          setTimeout(() => setSaveSuccess(false), 3000);
        },
      },
    );
  }

  function handleReset() {
    resetPool.mutate(undefined, {
      onSuccess: () => setResetDialog(false),
    });
  }

  if (isLoading) {
    return (
      <div className='flex items-center justify-center py-24'>
        <Loader2 className='size-6 animate-spin text-muted-foreground' />
      </div>
    );
  }

  const progressPct = pool?.progressPercentage ?? 0;

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex items-start justify-between gap-4'>
        <div>
          <h1 className='text-xl font-bold tracking-tight'>{t('title')}</h1>
          <p className='mt-0.5 text-sm text-muted-foreground'>{t('description')}</p>
        </div>
        <div className='flex items-center gap-2'>
          {pool && <StatusBadge status={pool.status} t={t} />}
          <Button
            size='sm'
            variant='outline'
            onClick={() => void refetch()}
            disabled={isFetching}
            className='h-7 px-2.5 text-xs'
          >
            <RefreshCw className={`me-1.5 size-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
        <KpiCard
          label={t('raised')}
          value={`${(pool?.totalDonations ?? 0).toFixed(2)} TND`}
          icon={TrendingUp}
        />
        <KpiCard
          label={t('target')}
          value={`${(pool?.targetAmount ?? 0).toFixed(0)} TND`}
          icon={Target}
          sub={`${progressPct.toFixed(1)}% ${t('progress')}`}
        />
        <KpiCard label={t('meals')} value={String(pool?.mealCount ?? 0)} icon={Utensils} />
        <KpiCard
          label={t('contributors')}
          value={String(pool?.contributorCount ?? 0)}
          icon={Users}
        />
      </div>

      {/* Progress bar */}
      <Card className='border-border/60'>
        <CardContent className='p-5'>
          <div className='flex items-center justify-between mb-2'>
            <span className='text-sm font-medium'>{t('progress')}</span>
            <span className='text-sm font-semibold tabular-nums'>{progressPct.toFixed(1)}%</span>
          </div>
          <div className='h-3 w-full overflow-hidden rounded-full bg-muted'>
            <div
              className='h-full rounded-full bg-primary-500 transition-all duration-500'
              style={{ width: `${Math.min(progressPct, 100)}%` }}
            />
          </div>
          <div className='mt-2 flex justify-between text-xs text-muted-foreground'>
            <span>{(pool?.totalDonations ?? 0).toFixed(2)} TND raised</span>
            <span>{(pool?.targetAmount ?? 0).toFixed(0)} TND goal</span>
          </div>
          {pool?.targetDate && (
            <p className='mt-2 text-xs text-muted-foreground'>
              Deadline: {new Date(pool.targetDate).toLocaleDateString()}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Settings Card */}
      <Card className='border-border/60'>
        <CardHeader>
          <CardTitle className='text-sm'>{t('settings.title')}</CardTitle>
          <CardDescription className='text-xs'>{t('settings.description')}</CardDescription>
        </CardHeader>
        <CardContent className='space-y-5'>
          {/* Target Amount */}
          <div className='space-y-1.5'>
            <Label className='text-xs font-medium'>{t('settings.targetAmount')}</Label>
            <Input
              type='number'
              min={1}
              max={1_000_000}
              value={targetAmount}
              onChange={e => setTargetAmount(e.target.value)}
              className='h-7 text-xs max-w-xs'
            />
            <p className='text-xs text-muted-foreground'>{t('settings.targetAmountHint')}</p>
          </div>

          <Separator />

          {/* Cause */}
          <div className='space-y-1.5'>
            <Label className='text-xs font-medium'>{t('settings.cause')}</Label>
            <Textarea
              value={cause}
              onChange={e => setCause(e.target.value)}
              minLength={3}
              maxLength={200}
              rows={1}
              className='text-xs resize-none py-1.5'
            />
            <p className='text-xs text-muted-foreground'>{t('settings.causeHint')}</p>
          </div>

          <Separator />

          {/* Target Date */}
          <div className='space-y-1.5'>
            <Label className='text-xs font-medium'>{t('settings.targetDate')}</Label>
            <div className='flex items-center gap-2'>
              <Input
                type='date'
                value={targetDate}
                onChange={e => setTargetDate(e.target.value)}
                className='h-7 text-xs w-40'
              />
              {targetDate && (
                <button
                  type='button'
                  onClick={() => setTargetDate('')}
                  className='inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors'
                >
                  <CalendarX className='size-3.5' />
                  {t('settings.clearDate')}
                </button>
              )}
            </div>
            <p className='text-xs text-muted-foreground'>{t('settings.targetDateHint')}</p>
          </div>

          <Separator />

          {/* Save row */}
          <div className='flex items-center justify-between'>
            {saveSuccess && (
              <p className='text-xs font-medium text-emerald-600'>{t('settings.saveSuccess')}</p>
            )}
            {!saveSuccess && <span />}
            <Button
              size='sm'
              onClick={handleSave}
              disabled={!isDirty || updatePool.isPending}
              className='h-7 px-3 text-xs'
            >
              {updatePool.isPending ? (
                <>
                  <Loader2 className='me-1.5 size-3.5 animate-spin' />
                  {t('settings.saving')}
                </>
              ) : (
                <>
                  <Save className='me-1.5 size-3.5' />
                  {t('settings.save')}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className='border-destructive/40'>
        <CardHeader>
          <CardTitle className='flex items-center gap-2 text-sm text-destructive'>
            <AlertTriangle className='size-4' />
            {t('reset.title')}
          </CardTitle>
          <CardDescription className='text-xs'>{t('reset.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant='outline'
            size='sm'
            className='h-7 px-3 text-xs border-destructive/40 text-destructive hover:bg-destructive/5'
            onClick={() => setResetDialog(true)}
          >
            <HeartHandshake className='me-1.5 size-3.5' />
            {t('reset.button')}
          </Button>
        </CardContent>
      </Card>

      {/* Reset confirm dialog */}
      <ConfirmActionDialog
        open={resetDialog}
        onOpenChange={setResetDialog}
        title={t('reset.confirmTitle')}
        description={t('reset.confirmDescription')}
        confirmLabel={t('reset.confirm')}
        variant='warning'
        isLoading={resetPool.isPending}
        onConfirm={handleReset}
      />
    </div>
  );
}
