import { type LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';
import { Card, CardContent, Skeleton } from '@foodwaste/ui';
import { cn } from '@/lib/utils';

interface AdminStatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  change?: {
    value: number;
    direction: 'up' | 'down';
    label?: string;
  };
  highlight?: boolean; // amber highlight for urgent items (e.g. pending approvals > 0)
  loading?: boolean;
}

export function AdminStatCard({
  label,
  value,
  icon: Icon,
  iconBg,
  iconColor,
  change,
  highlight,
  loading,
}: AdminStatCardProps) {
  if (loading) {
    return (
      <Card className='border-border/60'>
        <CardContent className='p-lg'>
          <div className='flex items-start justify-between gap-md'>
            <div className='flex-1 space-y-sm'>
              <Skeleton className='h-3.5 w-24' />
              <Skeleton className='h-7 w-16' />
              <Skeleton className='h-3 w-20' />
            </div>
            <Skeleton className='size-9 shrink-0 rounded-lg' />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className={cn(
        'border-border/60 transition-shadow hover:shadow-sm',
        highlight && 'border-amber-300 bg-amber-50/40 dark:bg-amber-950/10',
      )}
    >
      <CardContent className='p-lg'>
        <div className='flex items-start justify-between gap-md'>
          <div className='min-w-0 flex-1'>
            <p className='truncate text-xs font-medium text-muted-foreground'>{label}</p>
            <p
              className={cn(
                'mt-xs text-2xl font-bold tracking-tight tabular-nums',
                highlight ? 'text-amber-700 dark:text-amber-400' : 'text-foreground',
              )}
            >
              {value}
            </p>
            {change && (
              <div
                className={cn(
                  'mt-1.5 flex items-center gap-xs text-xs font-medium',
                  change.direction === 'up' ? 'text-emerald-600' : 'text-rose-500',
                )}
              >
                {change.direction === 'up' ? (
                  <TrendingUp className='size-3' />
                ) : (
                  <TrendingDown className='size-3' />
                )}
                <span>
                  {change.value > 0 ? '+' : ''}
                  {change.value}
                </span>
                {change.label && (
                  <span className='font-normal text-muted-foreground'>{change.label}</span>
                )}
              </div>
            )}
          </div>
          <div className={cn('rounded-lg p-sm shrink-0', iconBg)}>
            <Icon className={cn('size-5', iconColor)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
