import { Skeleton } from '@foodwaste/ui';

export default function AuthLoading() {
  return (
    <div className='min-h-screen flex flex-col bg-muted/30'>
      {/* Header */}
      <div className='flex items-center justify-between px-6 py-4'>
        <Skeleton className='h-10 w-40' />
        <Skeleton className='h-8 w-24 rounded-md' />
      </div>
      {/* Form area */}
      <div className='flex-1 flex items-center justify-center px-4'>
        <div className='w-full max-w-md space-y-4'>
          <div className='space-y-1.5'>
            <Skeleton className='h-7 w-48' />
            <Skeleton className='h-4 w-72' />
          </div>
          <div className='bg-card rounded-xl border p-6 space-y-4'>
            <Skeleton className='h-9 w-full rounded-md' />
            <Skeleton className='h-9 w-full rounded-md' />
            <Skeleton className='h-10 w-full rounded-md' />
          </div>
        </div>
      </div>
    </div>
  );
}
