import { Leaf, UtensilsCrossed, Wind } from 'lucide-react';
import { Card, CardContent, Skeleton } from '@foodwaste/ui';
import { cn } from '@/lib/utils';

interface WasteImpactBannerProps {
  kgSaved: number;
  mealsSaved: number;
  co2Reduced: number;
  kgSavedLabel: string;
  mealsSavedLabel: string;
  co2ReducedLabel: string;
  title: string;
  subtitle: string;
  loading?: boolean;
}

function formatNumber(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString('en-US', { maximumFractionDigits: 1 });
}

export function WasteImpactBanner({
  kgSaved,
  mealsSaved,
  co2Reduced,
  kgSavedLabel,
  mealsSavedLabel,
  co2ReducedLabel,
  title,
  subtitle,
  loading,
}: WasteImpactBannerProps) {
  if (loading) {
    return (
      <Card className='border-emerald-200/60 bg-gradient-to-br from-emerald-50 to-teal-50/50 dark:from-emerald-950/20 dark:to-teal-950/10'>
        <CardContent className='p-5'>
          <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6'>
            <div className='flex-1 space-y-1.5'>
              <Skeleton className='h-4 w-36' />
              <Skeleton className='h-3 w-48' />
            </div>
            <div className='flex flex-wrap gap-6'>
              {[1, 2, 3].map(i => (
                <div key={i} className='space-y-1'>
                  <Skeleton className='h-7 w-16' />
                  <Skeleton className='h-3 w-20' />
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const metrics = [
    { value: kgSaved, label: kgSavedLabel, icon: Leaf, color: 'text-emerald-600' },
    { value: mealsSaved, label: mealsSavedLabel, icon: UtensilsCrossed, color: 'text-teal-600' },
    { value: co2Reduced, label: co2ReducedLabel, icon: Wind, color: 'text-cyan-600' },
  ];

  return (
    <Card className='border-emerald-200/60 bg-gradient-to-br from-emerald-50 to-teal-50/50 dark:from-emerald-950/20 dark:to-teal-950/10'>
      <CardContent className='p-5'>
        <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6'>
          <div>
            <p className='text-sm font-semibold text-emerald-800 dark:text-emerald-300'>{title}</p>
            <p className='mt-0.5 text-xs text-emerald-700/70 dark:text-emerald-400/70'>
              {subtitle}
            </p>
          </div>
          <div className='flex flex-wrap gap-6 sm:gap-8'>
            {metrics.map(({ value, label, icon: Icon, color }) => (
              <div key={label} className='flex items-center gap-2'>
                <Icon className={cn('size-5 shrink-0', color)} />
                <div>
                  <p className='text-xl font-bold tabular-nums text-foreground'>
                    {formatNumber(value)}
                  </p>
                  <p className='text-[11px] leading-tight text-muted-foreground'>{label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
