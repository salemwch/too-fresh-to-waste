import { Skeleton } from '@foodwaste/ui';

export default function MerchantLoading() {
  return (
    <div className='flex h-screen bg-background'>
      {/* Sidebar skeleton */}
      <div className='hidden xl:flex w-72 shrink-0 flex-col gap-1.5 bg-primary/90 px-3.5 py-xl'>
        <div className='flex items-center gap-2.5 mb-lg px-1.5'>
          <Skeleton className='h-8 w-8 rounded-full opacity-30' />
          <div className='space-y-xs'>
            <Skeleton className='h-3.5 w-24 opacity-30' />
            <Skeleton className='h-2.5 w-16 opacity-20' />
          </div>
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className='h-9 w-full rounded-xl opacity-20' />
        ))}
      </div>

      {/* Mobile header skeleton */}
      <div className='xl:hidden fixed top-0 inset-x-0 h-12 bg-primary z-40' />

      {/* Main content skeleton */}
      <div className='flex flex-1 flex-col overflow-hidden pt-3xl xl:pt-0'>
        <div className='flex-1 p-lg lg:p-4xl space-y-xl mt-sm'>
          <div className='space-y-1.5'>
            <Skeleton className='h-6 w-44' />
            <Skeleton className='h-4 w-64' />
          </div>
          <div className='grid grid-cols-2 lg:grid-cols-4 gap-lg'>
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className='h-28 rounded-lg' />
            ))}
          </div>
          <Skeleton className='h-64 w-full rounded-lg' />
        </div>
      </div>
    </div>
  );
}
