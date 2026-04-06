'use client';

import { cn } from '@foodwaste/ui';
import {
  type DatePreset,
  type ChartGranularity,
  PRESET_CONFIG,
  PRESETS_BY_GRANULARITY,
  GRANULARITY_DEFAULT_PRESET,
} from '@/types/dashboard';

// ─── Types ──────────────────────────────────────────────────────────────────

interface DateFilterProps {
  value: DatePreset;
  onChange: (preset: DatePreset) => void;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const GRANULARITIES: ChartGranularity[] = ['day', 'week', 'month'];

const GRANULARITY_LABELS: Record<ChartGranularity, string> = {
  day: 'Day',
  week: 'Week',
  month: 'Month',
};

// ─── Component ──────────────────────────────────────────────────────────────

export function DateFilter({ value, onChange }: DateFilterProps) {
  const activeGranularity = PRESET_CONFIG[value].granularity;

  const handleGranularityClick = (g: ChartGranularity) => {
    if (g === activeGranularity) return;
    // Switch to the default preset for the new granularity
    onChange(GRANULARITY_DEFAULT_PRESET[g]);
  };

  return (
    <div className='flex flex-col gap-1.5'>
      {/* ── Row 1: granularity tabs ── */}
      <div
        role='group'
        aria-label='Chart granularity'
        className='inline-flex items-center self-end bg-slate-100 rounded-lg p-1 gap-0.5'
      >
        {GRANULARITIES.map(g => {
          const isActive = g === activeGranularity;
          return (
            <button
              key={g}
              type='button'
              onClick={() => handleGranularityClick(g)}
              aria-pressed={isActive}
              className={cn(
                'px-3 py-1 text-xs font-semibold rounded-md transition-all duration-150 select-none',
                isActive
                  ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-white/60',
              )}
            >
              {GRANULARITY_LABELS[g]}
            </button>
          );
        })}
      </div>

      {/* ── Row 2: value buttons for the active granularity ── */}
      <div
        role='group'
        aria-label='Date range'
        className='inline-flex items-center self-end bg-slate-100 rounded-lg p-1 gap-0.5'
      >
        {PRESETS_BY_GRANULARITY[activeGranularity].map(preset => {
          const isActive = preset === value;
          return (
            <button
              key={preset}
              type='button'
              onClick={() => onChange(preset)}
              aria-pressed={isActive}
              className={cn(
                'px-4 py-1.5 text-sm font-medium rounded-md transition-all duration-150 select-none whitespace-nowrap',
                isActive
                  ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-white/60',
              )}
            >
              {PRESET_CONFIG[preset].label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
