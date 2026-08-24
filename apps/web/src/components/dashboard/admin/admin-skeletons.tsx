import { Skeleton } from '@foodwaste/ui';

export function AdminStatGridSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className='grid grid-cols-2 gap-md md:grid-cols-3 lg:grid-cols-5'>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className='rounded-xl border border-border/60 bg-card p-lg'>
          <div className='flex items-start justify-between gap-md'>
            <div className='flex-1 space-y-sm'>
              <Skeleton className='h-3.5 w-20' />
              <Skeleton className='h-7 w-14' />
              <Skeleton className='h-3 w-16' />
            </div>
            <Skeleton className='size-9 shrink-0 rounded-lg' />
          </div>
        </div>
      ))}
    </div>
  );
}

export function AdminTableSkeleton({ rows = 8, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className='overflow-hidden rounded-lg border border-border/60 bg-card'>
      {/* Header */}
      <div className='border-b border-border/60 bg-muted/30 px-lg py-md'>
        <div className='flex gap-lg'>
          {Array.from({ length: cols }).map((_, i) => (
            <Skeleton key={i} className='h-3 w-16' />
          ))}
        </div>
      </div>
      {/* Rows */}
      <div className='divide-y divide-border/40'>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className='flex items-center gap-lg px-lg py-md'>
            <Skeleton className='size-8 rounded-full shrink-0' />
            <div className='flex-1 space-y-1.5'>
              <Skeleton className='h-3.5 w-32' />
              <Skeleton className='h-3 w-24' />
            </div>
            <Skeleton className='h-5 w-16 rounded-full' />
            <Skeleton className='h-5 w-14 rounded-full' />
            <Skeleton className='h-3 w-20' />
            <Skeleton className='h-6 w-16 rounded-md' />
          </div>
        ))}
      </div>
    </div>
  );
}

// AdminActivityFeedSkeleton was unused — removed

export function AdminDetailSheetSkeleton() {
  return (
    <div className='space-y-2xl p-2xl'>
      <div className='flex items-center gap-lg'>
        <Skeleton className='size-14 rounded-full' />
        <div className='space-y-sm'>
          <Skeleton className='h-5 w-36' />
          <Skeleton className='h-3.5 w-24' />
        </div>
      </div>
      <div className='space-y-md'>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className='flex justify-between'>
            <Skeleton className='h-3.5 w-24' />
            <Skeleton className='h-3.5 w-32' />
          </div>
        ))}
      </div>
      <div className='space-y-sm'>
        <Skeleton className='h-3.5 w-20' />
        <Skeleton className='h-10 w-full rounded-md' />
      </div>
    </div>
  );
}

export function AdminPendingCardsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className='grid gap-md sm:grid-cols-2 lg:grid-cols-3'>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className='rounded-lg border border-amber-200/60 bg-amber-50/30 p-lg'>
          <div className='space-y-md'>
            <div className='flex items-center gap-md'>
              <Skeleton className='size-9 rounded-lg' />
              <div className='flex-1 space-y-xs'>
                <Skeleton className='h-3.5 w-28' />
                <Skeleton className='h-3 w-16' />
              </div>
            </div>
            <div className='flex gap-sm'>
              <Skeleton className='h-7 flex-1 rounded-md' />
              <Skeleton className='h-7 flex-1 rounded-md' />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
