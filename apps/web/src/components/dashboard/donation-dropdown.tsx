'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { Heart, Users, Utensils } from 'lucide-react';
import { cn } from '@foodwaste/ui';
import { useDonationStats } from '@/hooks/use-merchant-dashboard';

// ─── Progress bar ───────────────────────────────────────────────────────────

function ProgressBar({ percentage }: { percentage: number }) {
  const clamped = Math.min(Math.max(percentage, 0), 100);
  return (
    <div className='h-1.5 w-full rounded-full bg-rose-100 overflow-hidden'>
      <div
        className='h-full rounded-full bg-rose-400 transition-all duration-700 ease-out'
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

// ─── Component ──────────────────────────────────────────────────────────────

export function DonationDropdown() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { data: stats, isLoading } = useDonationStats();

  // Close on outside click
  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
      setOpen(false);
    }
  }, []);

  // Close on Escape
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') setOpen(false);
  }, []);

  useEffect(() => {
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, handleClickOutside, handleKeyDown]);

  const currency = stats?.currency ?? 'TND';

  return (
    <div ref={containerRef} className='relative'>
      {/* Trigger — pink circle with heart */}
      <button
        type='button'
        onClick={() => setOpen(v => !v)}
        aria-label='Donation pool'
        aria-expanded={open}
        className={cn(
          'w-7 h-7 rounded-full flex items-center justify-center transition-all',
          open ? 'bg-rose-100 ring-2 ring-rose-300' : 'bg-rose-50 hover:bg-rose-100',
        )}
      >
        <Heart
          className={cn('w-3.5 h-3.5 transition-colors', open ? 'text-rose-600' : 'text-rose-500')}
          fill={open ? 'currentColor' : 'none'}
        />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className='absolute right-0 top-full mt-2 w-72 rounded-xl border border-slate-200 bg-white shadow-lg z-50 animate-in fade-in slide-in-from-top-1 duration-150'>
          {isLoading ? (
            <div className='p-5 space-y-3 animate-pulse'>
              <div className='h-4 w-28 bg-slate-100 rounded' />
              <div className='h-6 w-36 bg-slate-100 rounded' />
              <div className='h-1.5 w-full bg-slate-100 rounded-full' />
              <div className='h-3 w-24 bg-slate-100 rounded' />
              <div className='space-y-2 pt-2'>
                <div className='h-4 w-full bg-slate-100 rounded' />
                <div className='h-4 w-full bg-slate-100 rounded' />
              </div>
            </div>
          ) : !stats ? (
            <div className='p-5 text-center'>
              <p className='text-xs text-slate-400'>Donation data unavailable</p>
            </div>
          ) : (
            <div className='p-5 space-y-3.5'>
              {/* Header */}
              <div className='flex items-center gap-2'>
                <div className='w-8 h-8 rounded-full bg-rose-50 flex items-center justify-center'>
                  <Heart className='w-4 h-4 text-rose-500' fill='currentColor' />
                </div>
                <div>
                  <h3 className='text-sm font-semibold text-slate-900'>Donation Pool</h3>
                  <p className='text-[11px] text-slate-400'>Your orders change lives</p>
                </div>
              </div>

              {/* Amount */}
              <div>
                <div className='flex items-baseline justify-between mb-1'>
                  <span className='text-xl font-bold text-slate-900 tabular-nums'>
                    {stats.totalDonations.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                    <span className='text-xs font-medium text-slate-400 ml-1'>{currency}</span>
                  </span>
                  <span className='text-xs font-semibold text-rose-500'>
                    {stats.progressPercentage.toFixed(0)}%
                  </span>
                </div>
                <ProgressBar percentage={stats.progressPercentage} />
                <p className='text-[11px] text-slate-400 mt-1'>
                  Goal: {stats.targetAmount.toLocaleString()} {currency}
                </p>
              </div>

              {/* Divider */}
              <div className='border-t border-slate-100' />

              {/* Stats */}
              <div className='space-y-2.5'>
                <div className='flex items-center justify-between'>
                  <div className='flex items-center gap-2'>
                    <div className='w-6 h-6 rounded-full bg-blue-50 flex items-center justify-center'>
                      <Users className='w-3 h-3 text-blue-500' />
                    </div>
                    <span className='text-xs text-slate-500'>Contributors</span>
                  </div>
                  <span className='text-xs font-semibold text-slate-700 tabular-nums'>
                    {stats.contributorCount.toLocaleString()}
                  </span>
                </div>

                <div className='flex items-center justify-between'>
                  <div className='flex items-center gap-2'>
                    <div className='w-6 h-6 rounded-full bg-amber-50 flex items-center justify-center'>
                      <Utensils className='w-3 h-3 text-amber-500' />
                    </div>
                    <span className='text-xs text-slate-500'>Meals Funded</span>
                  </div>
                  <span className='text-xs font-semibold text-slate-700 tabular-nums'>
                    {stats.mealCount.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Cause */}
              <div className='rounded-lg bg-slate-50 px-3 py-2'>
                <p className='text-[10px] text-slate-400 mb-0.5'>Current Cause</p>
                <p className='text-xs font-medium text-slate-700'>
                  {stats.cause || 'Ensuring No One Goes Hungry'}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
