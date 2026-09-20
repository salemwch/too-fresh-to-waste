import { type LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';
import { Skeleton } from '@foodwaste/ui';
import { cn } from '@/lib/utils';

interface AdminStatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  /** Retained for call-site compatibility; no longer painted as a filled chip. */
  iconBg?: string;
  iconColor?: string;
  change?: {
    value: number;
    direction: 'up' | 'down';
    label?: string;
  };
  /** Draws the eye to the one figure that needs action. Use sparingly. */
  highlight?: boolean;
  loading?: boolean;
}

/**
 * A single statistic.
 *
 * ## Anatomy, shared with the work-queue tile
 *
 * ```
 *   [ label ................ icon ]
 *   [ value                       ]
 *   [ change (optional)           ]
 * ```
 *
 * This used to be a different shape - icon in a filled colour chip beside the
 * value - which meant the dashboard's two card rows read as two unrelated
 * components sitting on top of each other. `AdminWorkQueue` is the newer and
 * better-behaved of the two, so this one moved to match rather than the other
 * way round, and the ten other admin pages using `AdminStatCard` come along.
 *
 * ## Why the icon lost its coloured chip
 *
 * Every tile carried a differently-tinted square - indigo, violet, sky,
 * emerald, amber - which is five emphasis colours in one row. DESIGN.md §17
 * allows two, and a colour that is on every card signals nothing. The icon is
 * now a muted glyph, and colour is reserved for `highlight`, which marks the
 * one figure that actually needs attention.
 *
 * `iconBg` / `iconColor` remain in the props so the ten existing call sites
 * keep compiling; they are deliberately unused. Removing them would be a
 * mechanical edit across ten files for no behavioural gain, and leaving them
 * typed as optional documents that passing one is now a no-op.
 */
export function AdminStatCard({
  label,
  value,
  icon: Icon,
  change,
  highlight,
  loading,
}: AdminStatCardProps) {
  if (loading) {
    return (
      <div className='border-border bg-card flex flex-col gap-sm rounded-lg border p-md'>
        <div className='flex items-center justify-between gap-sm'>
          <Skeleton className='h-4 w-24' />
          <Skeleton className='size-4 shrink-0 rounded' />
        </div>
        {/* Matches the real value's height exactly, so data landing does not
            shift the page - DESIGN.md §15.3. */}
        <Skeleton className='h-8 w-20' />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'border-border bg-card flex flex-col gap-sm rounded-lg border p-md transition-colors',
        highlight && 'border-primary-500/30 bg-primary-500/[0.04]',
      )}
    >
      <div className='flex items-center justify-between gap-sm'>
        <span className='text-muted-foreground truncate text-sm font-medium'>{label}</span>
        <Icon
          aria-hidden='true'
          className={cn(
            'size-4 shrink-0',
            highlight ? 'text-primary-500' : 'text-muted-foreground',
          )}
        />
      </div>

      <span className='font-mono text-3xl font-bold tabular-nums'>{value}</span>

      {change && (
        <span
          className={cn(
            'flex items-center gap-xs text-xs font-medium',
            // Semantic tokens, not raw emerald/rose - those bypass the theme.
            change.direction === 'up' ? 'text-success' : 'text-destructive',
          )}
        >
          {change.direction === 'up' ? (
            <TrendingUp aria-hidden='true' className='size-3' />
          ) : (
            <TrendingDown aria-hidden='true' className='size-3' />
          )}
          {change.value > 0 ? '+' : ''}
          {change.value}
          {change.label && (
            <span className='text-muted-foreground font-normal'>{change.label}</span>
          )}
        </span>
      )}
    </div>
  );
}
