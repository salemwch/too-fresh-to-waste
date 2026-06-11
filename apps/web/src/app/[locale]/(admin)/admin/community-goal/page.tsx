'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import {
  Trophy,
  Loader2,
  Target,
  Users,
  Zap,
  RefreshCw,
  Save,
  AlertTriangle,
  CalendarX,
  Hash,
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
} from '@foodwaste/ui';
import { ConfirmActionDialog } from '@/components/dashboard/admin/confirm-action-dialog';
import {
  useAdminCommunityGoal,
  useUpdateCommunityGoal,
  useResetCommunityGoal,
} from '@/hooks/use-admin';
import type { CommunityGoalStatus } from '@/types/dashboard';

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({
  status,
  t,
}: {
  status: CommunityGoalStatus;
  t: ReturnType<typeof useTranslations>;
}) {
  const variants: Record<CommunityGoalStatus, string> = {
    active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    completed: 'bg-blue-50 text-blue-700 border-blue-200',
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

export default function AdminCommunityGoalPage() {
  const t = useTranslations('dashboard.adminCommunityGoal');

  const { data: goal, isLoading, refetch, isFetching } = useAdminCommunityGoal();
  const updateGoal = useUpdateCommunityGoal();
  const resetGoal = useResetCommunityGoal();

  const [targetCount, setTargetCount] = useState('');
  const [seasonName, setSeasonName] = useState('');
  const [rewardPoints, setRewardPoints] = useState('');
  const [endDate, setEndDate] = useState('');
  const [resetDialog, setResetDialog] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (goal) {
      setTargetCount(String(goal.targetCount));
      setSeasonName(goal.seasonName ?? '');
      setRewardPoints(String(goal.rewardPoints ?? 50));
      setEndDate(goal.endDate ? goal.endDate.slice(0, 10) : '');
    }
  }, [goal]);

  const isDirty =
    goal &&
    (Number(targetCount) !== goal.targetCount ||
      seasonName !== (goal.seasonName ?? '') ||
      Number(rewardPoints) !== (goal.rewardPoints ?? 50) ||
      endDate !== (goal.endDate ? goal.endDate.slice(0, 10) : ''));

  function handleSave() {
    updateGoal.mutate(
      {
        targetCount: Number(targetCount),
        ...(seasonName ? { seasonName } : {}),
        ...(rewardPoints ? { rewardPoints: Number(rewardPoints) } : {}),
        ...(endDate ? { endDate: new Date(endDate).toISOString() } : {}),
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
    resetGoal.mutate(undefined, {
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

  const progressPct = goal?.progressPercentage ?? 0;

  const daysLeft = goal?.endDate
    ? Math.max(0, Math.ceil((new Date(goal.endDate).getTime() - Date.now()) / 86_400_000))
    : null;

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex items-start justify-between gap-4'>
        <div>
          <h1 className='text-xl font-bold tracking-tight'>{t('title')}</h1>
          <p className='mt-0.5 text-sm text-muted-foreground'>{t('description')}</p>
        </div>
        <div className='flex items-center gap-2'>
          {goal && <StatusBadge status={goal.status} t={t} />}
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
          label={t('currentBags')}
          value={String(goal?.currentCount ?? 0)}
          icon={Trophy}
          sub={`${progressPct.toFixed(1)}% ${t('progress')}`}
        />
        <KpiCard
          label={t('targetBags')}
          value={String(goal?.targetCount ?? 0)}
          icon={Target}
          sub={`${goal?.remaining ?? 0} remaining`}
        />
        <KpiCard
          label={t('rewardPts')}
          value={String(goal?.rewardPoints ?? 0)}
          icon={Zap}
          sub={`${t('cycle')} #${goal?.cycleNumber ?? 1}`}
        />
        <KpiCard
          label={t('participants')}
          value={String(goal?.participantCount ?? 0)}
          icon={Users}
          sub={daysLeft !== null ? t('daysLeft', { count: daysLeft }) : t('noDeadline')}
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
            <span>
              {goal?.currentCount ?? 0} / {goal?.targetCount ?? 0} bags
            </span>
            <span>{goal?.seasonName ?? '—'}</span>
          </div>
          {goal?.endDate && (
            <p className='mt-1 text-xs text-muted-foreground'>
              Deadline: {new Date(goal.endDate).toLocaleDateString()}
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
          {/* Target Count */}
          <div className='space-y-1.5'>
            <Label className='text-xs font-medium'>{t('settings.targetCount')}</Label>
            <Input
              type='number'
              min={1}
              max={100_000}
              value={targetCount}
              onChange={e => setTargetCount(e.target.value)}
              className='h-7 text-xs max-w-xs'
            />
            <p className='text-xs text-muted-foreground'>{t('settings.targetCountHint')}</p>
          </div>

          <Separator />

          {/* Season Name */}
          <div className='space-y-1.5'>
            <Label className='text-xs font-medium'>{t('settings.seasonName')}</Label>
            <Input
              type='text'
              maxLength={80}
              value={seasonName}
              onChange={e => setSeasonName(e.target.value)}
              placeholder='June Challenge'
              className='h-7 text-xs max-w-xs'
            />
            <p className='text-xs text-muted-foreground'>{t('settings.seasonNameHint')}</p>
          </div>

          <Separator />

          {/* Reward Points */}
          <div className='space-y-1.5'>
            <Label className='text-xs font-medium'>{t('settings.rewardPoints')}</Label>
            <div className='flex items-center gap-2 max-w-xs'>
              <Hash className='size-3.5 text-muted-foreground' />
              <Input
                type='number'
                min={1}
                max={10_000}
                value={rewardPoints}
                onChange={e => setRewardPoints(e.target.value)}
                className='h-7 text-xs'
              />
            </div>
            <p className='text-xs text-muted-foreground'>{t('settings.rewardPointsHint')}</p>
          </div>

          <Separator />

          {/* End Date (Prize Drop Deadline) */}
          <div className='space-y-1.5'>
            <Label className='text-xs font-medium'>{t('settings.endDate')}</Label>
            <div className='flex items-center gap-2'>
              <Input
                type='date'
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className='h-7 text-xs w-40'
              />
              {endDate && (
                <button
                  type='button'
                  onClick={() => setEndDate('')}
                  className='inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors'
                >
                  <CalendarX className='size-3.5' />
                  {t('settings.clearDate')}
                </button>
              )}
            </div>
            <p className='text-xs text-muted-foreground'>{t('settings.endDateHint')}</p>
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
              disabled={!isDirty || updateGoal.isPending}
              className='h-7 px-3 text-xs'
            >
              {updateGoal.isPending ? (
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
            <Trophy className='me-1.5 size-3.5' />
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
        isLoading={resetGoal.isPending}
        onConfirm={handleReset}
      />
    </div>
  );
}
