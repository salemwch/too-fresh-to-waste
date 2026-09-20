'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { Skeleton } from '@foodwaste/ui';
import { cn } from '@/lib/utils';

export interface WorkQueueItem {
  id: string;
  label: string;
  /** `undefined` while loading; `0` is a real, meaningful answer. */
  count: number | undefined;
  icon: LucideIcon;
  href: string;
  /** Shown under the count - what the number means, or what to do. */
  hint: string;
}

interface AdminWorkQueueProps {
  items: WorkQueueItem[];
  isLoading?: boolean;
}

/**
 * The queues an admin works through, as entry points rather than statistics.
 *
 * ## The distinction from a KPI tile
 *
 * A KPI answers "how are we doing". A queue answers "what is waiting for me".
 * They look similar and behave completely differently: a queue count of zero is
 * *good news* and should feel calm, while a KPI of zero is usually bad. So a
 * zero here renders muted with a "nothing waiting" hint, not as an alarming
 * dash.
 *
 * Every tile is a link into the page where the work is actually done. A count
 * you cannot click is a number you have to go and find, which is how admin
 * dashboards become read-only summaries nobody opens.
 *
 * ## Why not a `0` skeleton
 *
 * `count` is `number | undefined`, not `number`. Defaulting a pending count to
 * `0` while it loads flashes "nothing waiting" and then jumps to "7 waiting" -
 * briefly telling an admin the opposite of the truth.
 */
export function AdminWorkQueue({ items, isLoading = false }: AdminWorkQueueProps) {
  return (
    <section
      aria-label='Work queue'
      className='grid grid-cols-1 gap-md sm:grid-cols-2 xl:grid-cols-4'
    >
      {items.map(item => {
        const Icon = item.icon;
        const pending = (item.count ?? 0) > 0;
        const showSkeleton = isLoading || item.count === undefined;

        return (
          <Link
            key={item.id}
            href={item.href}
            className={cn(
              'group border-border bg-card flex flex-col gap-sm rounded-lg border p-md outline-none transition-colors',
              'hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              // Only a non-empty queue earns emphasis. Tinting every tile makes
              // the one that needs attention indistinguishable.
              pending && 'border-primary-500/30 bg-primary-500/[0.04]',
            )}
          >
            <div className='flex items-center justify-between gap-sm'>
              <span className='text-muted-foreground text-sm font-medium'>{item.label}</span>
              <Icon
                aria-hidden='true'
                className={cn(
                  'size-4 shrink-0',
                  pending ? 'text-primary-500' : 'text-muted-foreground',
                )}
              />
            </div>

            {showSkeleton ? (
              <Skeleton className='h-8 w-16' />
            ) : (
              <span
                className={cn(
                  'font-mono text-3xl font-bold tabular-nums',
                  pending ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {item.count}
              </span>
            )}

            <span className='text-muted-foreground flex items-center gap-xs text-xs'>
              {item.hint}
              {/* Self-mirrors under RTL rather than needing a flipped icon. */}
              <ArrowRight
                aria-hidden='true'
                className='size-3 shrink-0 transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5'
              />
            </span>
          </Link>
        );
      })}
    </section>
  );
}
