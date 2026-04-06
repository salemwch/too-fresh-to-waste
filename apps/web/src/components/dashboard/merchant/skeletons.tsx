// Dashboard skeleton components — animate-pulse placeholders that match the
// exact layout of each real component so the page never jumps on load.

// ─── Stat Cards (3-column KPI row) ──────────────────────────────────────────

export function StatsCardsSkeleton() {
  return (
    <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
      {[0, 1, 2].map(i => (
        <div
          key={i}
          className='bg-white p-4 rounded-xl border border-slate-100 shadow-sm animate-pulse'
        >
          <div className='flex justify-between items-start mb-3'>
            <div className='space-y-2'>
              <div className='h-6 w-24 bg-slate-100 rounded' />
              <div className='h-3.5 w-16 bg-slate-100 rounded' />
            </div>
            <div className='w-7 h-7 rounded-full bg-slate-100' />
          </div>
          <div className='flex items-center gap-2'>
            <div className='h-3 w-8 bg-slate-100 rounded' />
            <div className='h-3 w-20 bg-slate-100 rounded' />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Revenue Chart ───────────────────────────────────────────────────────────

export function RevenueChartSkeleton() {
  return (
    <div className='bg-white rounded-xl border border-slate-100 shadow-sm p-4 animate-pulse'>
      {/* Title row */}
      <div className='flex justify-between items-center mb-4'>
        <div className='h-4 w-32 bg-slate-100 rounded' />
      </div>

      {/* Chart body */}
      <div className='bg-orange-50/30 rounded-xl p-5'>
        {/* Income header */}
        <div className='mb-4 space-y-2'>
          <div className='h-3 w-28 bg-slate-100 rounded' />
          <div className='flex items-center gap-3'>
            <div className='h-7 w-24 bg-slate-100 rounded' />
            <div className='h-5 w-14 bg-slate-100 rounded-full' />
          </div>
        </div>
        {/* Chart area */}
        <div className='h-[200px] bg-slate-100 rounded-lg mt-6' />
      </div>

      {/* Summary row */}
      <div className='grid grid-cols-3 gap-4 mt-4'>
        {[0, 1, 2].map(i => (
          <div key={i} className='flex items-center gap-3'>
            <div className='w-9 h-9 rounded-full bg-slate-100' />
            <div className='space-y-1.5'>
              <div className='h-3.5 w-14 bg-slate-100 rounded' />
              <div className='h-3 w-10 bg-slate-100 rounded' />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Generic panel (Recent Orders / Trending Offers / Customers by Location) ─

export function PanelSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className='bg-white rounded-xl border border-slate-100 shadow-sm p-4 h-full animate-pulse'>
      {/* Header */}
      <div className='flex justify-between items-center mb-4'>
        <div className='h-4 w-28 bg-slate-100 rounded' />
        <div className='h-3 w-12 bg-slate-100 rounded' />
      </div>

      {/* Rows */}
      <div className='space-y-3'>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className='flex items-center gap-3'>
            <div className='w-7 h-7 rounded-full bg-slate-100 shrink-0' />
            <div className='flex-1 space-y-1.5'>
              <div className='h-3 bg-slate-100 rounded w-3/4' />
              <div className='h-2.5 bg-slate-100 rounded w-1/2' />
            </div>
            <div className='h-4 w-12 bg-slate-100 rounded shrink-0' />
          </div>
        ))}
      </div>
    </div>
  );
}
