'use client';

import { useEffect, useState } from 'react';
import { cn } from '@foodwaste/ui';

// ─── Types ──────────────────────────────────────────────────────────────────
export interface LocationItem {
  name: string;
  value: number;
  color: string;     // Tailwind bg class e.g. "bg-blue-100"
  textColor: string; // Tailwind text class e.g. "text-blue-700"
}

interface CustomersByLocationProps {
  locations: LocationItem[];
  title: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const NICE_STEPS = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000, 10000, 50000];

/** Compute N+1 evenly-spaced nice ticks from 0 → rounded-up maxValue. */
function computeXTicks(maxValue: number, count = 5): number[] {
  if (maxValue === 0) return Array.from({ length: count + 1 }, (_, i) => i);
  const rawStep = maxValue / count;
  const step = NICE_STEPS.find((s) => s >= rawStep) ?? rawStep;
  const maxTick = Math.ceil(maxValue / step) * step;
  const raw = Array.from({ length: count + 1 }, (_, i) =>
    Math.round((i / count) * maxTick),
  );
  // Deduplicate while preserving order (can occur when maxTick < count)
  return [...new Set(raw)];
}

function formatAxisLabel(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(0)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k`;
  return String(v);
}

// ─── Component ──────────────────────────────────────────────────────────────
export function CustomersByLocation({ locations, title }: CustomersByLocationProps) {
  const maxValue = Math.max(...locations.map((l) => l.value), 0);
  const ticks = computeXTicks(maxValue);
  const maxTick = ticks[ticks.length - 1] ?? 1;

  // Trigger width animation after mount so CSS transition plays
  const [animated, setAnimated] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setAnimated(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
      <h3 className="text-base font-semibold tracking-tight text-slate-900 mb-4">
        {title}
      </h3>

      {locations.length === 0 ? (
        /* ── Empty state ── */
        <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
          <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center">
            <svg
              className="w-5 h-5 text-slate-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </div>
          <p className="text-sm text-slate-400">No location data yet</p>
        </div>
      ) : (
        /* ── Bar chart ── */
        <div className="space-y-3">
          {locations.map((location, i) => {
            const widthPercent = maxTick > 0 ? (location.value / maxTick) * 100 : 0;

            return (
              <div key={location.name} className="flex items-center gap-3">
                {/* City label */}
                <span className="w-14 text-sm font-medium text-slate-600 shrink-0 truncate">
                  {location.name}
                </span>

                {/* Bar + value */}
                <div className="flex-1 flex items-center gap-2 min-w-0">
                  <div
                    className={cn('h-5 rounded-md', location.color)}
                    style={{
                      width: animated ? `${Math.max(widthPercent, 2)}%` : '0%',
                      transition: `width 500ms cubic-bezier(0.4, 0, 0.2, 1)`,
                      transitionDelay: animated ? `${i * 90}ms` : '0ms',
                    }}
                  />
                  <span className={cn('text-xs font-semibold shrink-0', location.textColor)}>
                    {location.value.toLocaleString()}
                  </span>
                </div>
              </div>
            );
          })}

          {/* Dynamic X-axis scale */}
          <div className="flex justify-between text-[10px] text-slate-400 pl-[68px] pt-2 border-t border-slate-100">
            {ticks.map((t, i) => (
              <span key={i}>{formatAxisLabel(t)}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
