'use client';

import { type LucideIcon, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { cn } from '@foodwaste/ui';

// ─── Types ──────────────────────────────────────────────────────────────────
export interface StatCardItem {
  /** Unique identifier for the card (used to route click events). */
  id?: string;
  label: string;
  value: string;
  icon: LucideIcon;
  iconBg: string;    // e.g. "bg-indigo-50"
  iconColor: string;  // e.g. "text-indigo-600"
  trend: {
    value: number;
    /** Optional unit appended to the trend value, e.g. '%' */
    suffix?: string;
    direction: 'up' | 'down';
    label: string;
  };
  /**
   * Optional array of raw data values for the mini sparkline chart.
   * At least 2 values are needed to draw a line.
   */
  sparkline?: number[];
  /** When true the card renders as an interactive, clickable surface. */
  clickable?: boolean;
}

interface StatsCardsProps {
  stats: StatCardItem[];
  /** Fires when a card with `clickable: true` is clicked. Receives the card `id`. */
  onCardClick?: (id: string) => void;
}

// ─── Sparkline SVG ──────────────────────────────────────────────────────────
const SPARK_W = 80;
const SPARK_H = 28;

function Sparkline({
  data,
  direction,
}: {
  data: number[];
  direction: 'up' | 'down';
}) {
  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * SPARK_W;
      // 2px top + bottom padding so the line never clips at the edges
      const y = SPARK_H - 2 - ((v - min) / range) * (SPARK_H - 4);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const color = direction === 'up' ? '#10b981' : '#f43f5e'; // emerald-500 / rose-500

  // Area fill: close the polygon along the bottom
  const firstX = 0;
  const lastX = SPARK_W;
  const areaPoints = `${firstX},${SPARK_H} ${pts} ${lastX},${SPARK_H}`;

  return (
    <svg
      width={SPARK_W}
      height={SPARK_H}
      viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
      className="overflow-visible"
      aria-hidden="true"
    >
      {/* Gradient fill under the line */}
      <defs>
        <linearGradient id={`spark-grad-${direction}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon
        points={areaPoints}
        fill={`url(#spark-grad-${direction})`}
      />
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.85}
      />
    </svg>
  );
}

// ─── Component ──────────────────────────────────────────────────────────────
export function StatsCards({ stats, onCardClick }: StatsCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        const TrendIcon = stat.trend.direction === 'up' ? ArrowUpRight : ArrowDownRight;
        const isPositive = stat.trend.direction === 'up';
        const hasSparkline = stat.sparkline && stat.sparkline.length >= 2;
        const isClickable = stat.clickable && stat.id && onCardClick;

        return (
          <div
            key={stat.label}
            role={isClickable ? 'button' : undefined}
            tabIndex={isClickable ? 0 : undefined}
            onClick={isClickable ? () => onCardClick(stat.id!) : undefined}
            onKeyDown={isClickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onCardClick(stat.id!); } } : undefined}
            className={cn(
              'bg-white p-4 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-all',
              isClickable && 'cursor-pointer hover:ring-2 hover:ring-indigo-200 active:scale-[0.98]',
            )}
          >
            {/* Top row: value + icon */}
            <div className="flex justify-between items-start mb-2">
              <div>
                <h3 className="text-xl font-semibold tracking-tight text-slate-900">
                  {stat.value}
                </h3>
                <p className="text-sm text-slate-500 font-medium mt-0.5">
                  {stat.label}
                </p>
              </div>
              <div
                className={cn(
                  'w-7 h-7 rounded-full flex items-center justify-center',
                  stat.iconBg,
                  stat.iconColor,
                )}
              >
                <Icon className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Sparkline row */}
            {hasSparkline && (
              <div className="mb-2">
                <Sparkline
                  data={stat.sparkline!}
                  direction={stat.trend.direction}
                />
              </div>
            )}

            {/* Trend row */}
            <div className="flex items-center gap-1.5">
              <div
                className={cn(
                  'flex items-center gap-0.5 text-xs font-medium',
                  isPositive ? 'text-emerald-500' : 'text-rose-500',
                )}
              >
                <TrendIcon className="w-3.5 h-3.5" />
                {Math.abs(stat.trend.value)}{stat.trend.suffix ?? ''}
              </div>
              <span className="text-xs text-slate-400">{stat.trend.label}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
