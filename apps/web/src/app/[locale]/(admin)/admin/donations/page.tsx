'use client';

import { useState } from 'react';
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
  History,
  Sparkles,
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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ConfirmActionDialog } from '@/components/dashboard/admin/confirm-action-dialog';
import {
  useAdminDonationPool,
  useUpdateDonationPool,
  useResetDonationPool,
  useStartDonationSeason,
} from '@/hooks/use-admin';
import { Link } from '@/i18n/routing';
import type {
  DonationPoolStatus,
  DonationGoalCategory,
  CategoryPricingInput,
} from '@/types/dashboard';

const GOAL_CATEGORIES: DonationGoalCategory[] = [
  'TSHIRTS',
  'PANTS',
  'SHOES',
  'CHILDREN_STUDIES',
  'MEDICINE',
];

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
    season_complete: 'bg-amber-50 text-amber-700 border-amber-200',
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-xxs text-xs font-semibold ${variants[status] ?? variants.active}`}
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
      <CardContent className='p-xl'>
        <div className='flex items-start justify-between'>
          <div>
            <p className='text-xs font-medium text-muted-foreground'>{label}</p>
            <p className='mt-xs text-2xl font-bold tracking-tight'>{value}</p>
            {sub && <p className='mt-xxs text-xs text-muted-foreground'>{sub}</p>}
          </div>
          <div className='rounded-lg bg-primary-500/10 p-sm'>
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
  const startSeason = useStartDonationSeason();

  const [targetAmount, setTargetAmount] = useState('');
  const [cause, setCause] = useState('');
  const [activeGoalCategory, setActiveGoalCategory] = useState<DonationGoalCategory>('TSHIRTS');
  const [targetDate, setTargetDate] = useState('');
  const [categoryPricing, setCategoryPricing] = useState<
    Record<DonationGoalCategory, { itemPrice: string; targetCount: string }>
  >({
    TSHIRTS: { itemPrice: '10', targetCount: '300' },
    PANTS: { itemPrice: '15', targetCount: '300' },
    SHOES: { itemPrice: '20', targetCount: '200' },
    CHILDREN_STUDIES: { itemPrice: '25', targetCount: '150' },
    MEDICINE: { itemPrice: '5', targetCount: '500' },
  });
  const [resetDialog, setResetDialog] = useState(false);
  const [seasonDialog, setSeasonDialog] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  /*
   * Populate the form once the pool loads.
   *
   * Adjusted during render rather than in an effect, so the inputs are never
   * painted empty for a frame after the fetch resolves. Keyed on the pool
   * object identity, exactly as the previous [pool] dependency was.
   */
  const [syncedPool, setSyncedPool] = useState(pool);
  if (pool && pool !== syncedPool) {
    setSyncedPool(pool);
    setTargetAmount(String(pool.targetAmount));
    setCause(pool.cause);
    setActiveGoalCategory(pool.activeGoalCategory);
    setTargetDate(pool.targetDate ? pool.targetDate.slice(0, 10) : '');
    if (pool.categoryProgress?.length) {
      const pricing = {} as Record<
        DonationGoalCategory,
        { itemPrice: string; targetCount: string }
      >;
      for (const cp of pool.categoryProgress) {
        pricing[cp.category] = {
          itemPrice: String(cp.itemPrice),
          targetCount: String(cp.targetCount),
        };
      }
      setCategoryPricing(prev => ({ ...prev, ...pricing }));
    }
  }

  function updateCategoryField(
    cat: DonationGoalCategory,
    field: 'itemPrice' | 'targetCount',
    value: string,
  ) {
    setCategoryPricing(prev => ({ ...prev, [cat]: { ...prev[cat], [field]: value } }));
  }

  const isPricingDirty =
    pool?.categoryProgress?.some(cp => {
      const local = categoryPricing[cp.category];
      return (
        Number(local?.itemPrice) !== cp.itemPrice || Number(local?.targetCount) !== cp.targetCount
      );
    }) ?? false;

  const isDirty =
    pool &&
    (Number(targetAmount) !== pool.targetAmount ||
      cause !== pool.cause ||
      activeGoalCategory !== pool.activeGoalCategory ||
      (targetDate ? `${targetDate}T00:00:00.000Z` : undefined) !== pool.targetDate ||
      isPricingDirty);

  function handleSave() {
    const pricingPayload: CategoryPricingInput[] | undefined = isPricingDirty
      ? GOAL_CATEGORIES.map(cat => ({
          category: cat,
          itemPrice: Number(categoryPricing[cat].itemPrice),
          targetCount: Number(categoryPricing[cat].targetCount),
        }))
      : undefined;

    updatePool.mutate(
      {
        targetAmount: Number(targetAmount),
        cause,
        activeGoalCategory,
        targetDate: targetDate ? new Date(targetDate).toISOString() : null,
        ...(pricingPayload ? { categoryPricing: pricingPayload } : {}),
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

  function handleStartSeason() {
    startSeason.mutate(undefined, {
      onSuccess: () => setSeasonDialog(false),
    });
  }

  if (isLoading) {
    return (
      <div className='flex items-center justify-center py-6xl'>
        <Loader2 className='size-6 animate-spin text-muted-foreground' />
      </div>
    );
  }

  const progressPct = pool?.progressPercentage ?? 0;

  return (
    <div className='space-y-2xl'>
      {/* Header */}
      <div className='flex items-start justify-between gap-lg'>
        <div>
          <h1 className='text-xl font-bold tracking-tight'>{t('title')}</h1>
          <p className='mt-xxs text-sm text-muted-foreground'>{t('description')}</p>
        </div>
        <div className='flex items-center gap-sm'>
          {pool && <StatusBadge status={pool.status} t={t} />}
          {pool && (
            <span className='text-xs text-muted-foreground'>
              {t('season', { number: pool.season ?? 1 })}
            </span>
          )}
          <Link href='/admin/donations/history'>
            <Button size='sm' variant='outline' className='px-2.5 text-xs'>
              <History className='me-1.5 size-3.5' />
              {t('viewHistory')}
            </Button>
          </Link>
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
      <div className='grid gap-lg sm:grid-cols-2 lg:grid-cols-4'>
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
        <CardContent className='p-xl'>
          <div className='flex items-center justify-between mb-sm'>
            <span className='text-sm font-medium'>{t('progress')}</span>
            <span className='text-sm font-semibold tabular-nums'>{progressPct.toFixed(1)}%</span>
          </div>
          <div className='h-3 w-full overflow-hidden rounded-full bg-muted'>
            <div
              className='h-full rounded-full bg-primary-500 transition-all duration-500'
              style={{ width: `${Math.min(progressPct, 100)}%` }}
            />
          </div>
          <div className='mt-sm flex justify-between text-xs text-muted-foreground'>
            <span>{(pool?.totalDonations ?? 0).toFixed(2)} TND raised</span>
            <span>{(pool?.targetAmount ?? 0).toFixed(0)} TND goal</span>
          </div>
          {pool?.activeGoalCategory && (
            <p className='mt-sm text-xs text-muted-foreground'>
              {t('currentCategory')}: {t(`settings.categories.${pool.activeGoalCategory}`)}
            </p>
          )}
          {pool?.targetDate && (
            <p className='mt-xs text-xs text-muted-foreground'>
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
        <CardContent className='space-y-xl'>
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

          {/* Goal Category */}
          <div className='space-y-1.5'>
            <Label className='text-xs font-medium'>{t('settings.goalCategory')}</Label>
            <Select
              value={activeGoalCategory}
              onValueChange={v => setActiveGoalCategory(v as DonationGoalCategory)}
            >
              <SelectTrigger className='h-7 text-xs max-w-xs'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GOAL_CATEGORIES.map(cat => (
                  <SelectItem key={cat} value={cat} className='text-xs'>
                    {t(`settings.categories.${cat}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className='text-xs text-muted-foreground'>{t('settings.goalCategoryHint')}</p>
          </div>

          <Separator />

          {/* Target Date */}
          <div className='space-y-1.5'>
            <Label className='text-xs font-medium'>{t('settings.targetDate')}</Label>
            <div className='flex items-center gap-sm'>
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
                  className='inline-flex items-center gap-xs text-xs text-muted-foreground hover:text-foreground transition-colors'
                >
                  <CalendarX className='size-3.5' />
                  {t('settings.clearDate')}
                </button>
              )}
            </div>
            <p className='text-xs text-muted-foreground'>{t('settings.targetDateHint')}</p>
          </div>

          <Separator />

          {/* Category Pricing */}
          <div className='space-y-md'>
            <div>
              <Label className='text-xs font-medium'>{t('settings.categoryPricing')}</Label>
              <p className='text-xs text-muted-foreground mt-xxs'>
                {t('settings.categoryPricingHint')}
              </p>
            </div>
            <div className='rounded-lg border border-border/60 overflow-hidden'>
              <table className='w-full text-xs'>
                <thead>
                  <tr className='bg-muted/50'>
                    <th className='text-start px-md py-sm font-medium text-muted-foreground'>
                      {t('settings.goalCategory')}
                    </th>
                    <th className='text-start px-md py-sm font-medium text-muted-foreground'>
                      {t('settings.itemPrice')}
                    </th>
                    <th className='text-start px-md py-sm font-medium text-muted-foreground'>
                      {t('settings.targetCount')}
                    </th>
                    <th className='text-end px-md py-sm font-medium text-muted-foreground'>
                      {t('settings.computedTarget')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {GOAL_CATEGORIES.map(cat => {
                    const p = categoryPricing[cat];
                    const total = (Number(p.itemPrice) || 0) * (Number(p.targetCount) || 0);
                    return (
                      <tr key={cat} className='border-t border-border/40'>
                        <td className='px-md py-sm font-medium'>
                          {t(`settings.categories.${cat}`)}
                          {cat === activeGoalCategory && (
                            <span className='ms-1.5 inline-flex items-center rounded-full bg-primary-500/10 px-1.5 py-xxs text-[10px] font-semibold text-primary-500'>
                              ACTIVE
                            </span>
                          )}
                        </td>
                        <td className='px-md py-sm'>
                          <Input
                            type='number'
                            min={0.1}
                            step={0.1}
                            value={p.itemPrice}
                            onChange={e => updateCategoryField(cat, 'itemPrice', e.target.value)}
                            className='h-6 text-xs w-24'
                          />
                        </td>
                        <td className='px-md py-sm'>
                          <Input
                            type='number'
                            min={1}
                            step={1}
                            value={p.targetCount}
                            onChange={e => updateCategoryField(cat, 'targetCount', e.target.value)}
                            className='h-6 text-xs w-24'
                          />
                        </td>
                        <td className='px-md py-sm text-end tabular-nums font-medium'>
                          {total.toLocaleString()} TND
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
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
              className='px-md text-xs'
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
          <CardTitle className='flex items-center gap-sm text-sm text-destructive'>
            <AlertTriangle className='size-4' />
            {t('reset.title')}
          </CardTitle>
          <CardDescription className='text-xs'>{t('reset.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant='outline'
            size='sm'
            className='px-md text-xs border-destructive/40 text-destructive hover:bg-destructive/5'
            onClick={() => setResetDialog(true)}
          >
            <HeartHandshake className='me-1.5 size-3.5' />
            {t('reset.button')}
          </Button>
        </CardContent>
      </Card>

      {/* Start New Season */}
      {pool?.status === 'season_complete' && (
        <Card className='border-amber-300/60 bg-amber-50/30'>
          <CardHeader>
            <CardTitle className='flex items-center gap-sm text-sm text-amber-700'>
              <Sparkles className='size-4' />
              {t('startNewSeason')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button size='sm' className='px-md text-xs' onClick={() => setSeasonDialog(true)}>
              <Sparkles className='me-1.5 size-3.5' />
              {t('startNewSeason')}
            </Button>
          </CardContent>
        </Card>
      )}

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

      {/* Start season confirm dialog */}
      <ConfirmActionDialog
        open={seasonDialog}
        onOpenChange={setSeasonDialog}
        title={t('startSeasonConfirmTitle')}
        description={t('startSeasonConfirmDescription')}
        confirmLabel={t('startSeasonConfirm')}
        variant='warning'
        isLoading={startSeason.isPending}
        onConfirm={handleStartSeason}
      />
    </div>
  );
}
