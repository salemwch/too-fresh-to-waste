'use client';

import { useMemo, useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { ArrowUpRight, ArrowDownRight, Wallet, PiggyBank, DollarSign } from 'lucide-react';
import { cn } from '@foodwaste/ui';

// ─── Types ──────────────────────────────────────────────────────────────────
export interface RevenueChartData {
  months: { label: string; value: number }[];
  averageIncome: string;
  trend: { value: number; direction: 'up' | 'down'; label: string };
  summary: {
    expenses: string;
    income: string;
    profit: string;
  };
}

interface RevenueChartProps {
  data: RevenueChartData;
  title: string;
  avgLabel: string;
  vsLabel: string;
  expensesLabel: string;
  incomeLabel: string;
  profitLabel: string;
  tooltipLabel?: string;
  /** Rendered at the far-right of the chart header (date filter slot). */
  filterSlot?: ReactNode;
}

// ─── SVG Layout Constants ───────────────────────────────────────────────────
const SVG_WIDTH = 1000;
const SVG_HEIGHT = 280;
const CHART_COLOR = '#eab308'; // amber-500

const Y_AXIS_WIDTH = 55;
const CHART_LEFT = 70;
const CHART_RIGHT_PAD = 60;
const CHART_TOP = 20;
const CHART_BOTTOM = 40;
const CHART_HEIGHT = SVG_HEIGHT - CHART_TOP - CHART_BOTTOM; // 220
const PLOT_WIDTH = SVG_WIDTH - CHART_LEFT - CHART_RIGHT_PAD; // 870
const PLOT_RIGHT = CHART_LEFT + PLOT_WIDTH;                  // 930
const X_AXIS_Y = CHART_TOP + CHART_HEIGHT;                   // 240

/** px above the dot centre that the tooltip sits (tooltip height ≈ 60 + 6 arrow + 6 gap) */
const TOOLTIP_ABOVE_PX = 78;

// ─── Y-Axis Tick Computation ────────────────────────────────────────────────
const NICE_STEPS = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000];

function computeYAxisTicks(values: number[]): { ticks: number[]; maxTick: number } {
  const maxVal = Math.max(0, ...values);
  if (maxVal === 0) return { ticks: [0, 25, 50, 75, 100], maxTick: 100 };

  const TARGET_TICKS = 5;
  const rawStep = maxVal / TARGET_TICKS;
  let step = NICE_STEPS.find((s) => s >= rawStep) ?? rawStep;

  if (step < rawStep) {
    const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const normalized = rawStep / magnitude;
    if (normalized <= 1) step = magnitude;
    else if (normalized <= 2) step = 2 * magnitude;
    else if (normalized <= 5) step = 5 * magnitude;
    else step = 10 * magnitude;
  }

  const maxTick = Math.ceil(maxVal / step) * step;
  const ticks: number[] = [];
  for (let t = 0; t <= maxTick; t += step) {
    ticks.push(Math.round(t * 100) / 100);
  }
  return { ticks, maxTick };
}

function formatTickLabel(value: number): string {
  if (value === 0) return '0';
  if (value >= 1_000_000) {
    const v = value / 1_000_000;
    return v % 1 === 0 ? `${v}M` : `${v.toFixed(1)}M`;
  }
  if (value >= 1_000) {
    const v = value / 1_000;
    return v % 1 === 0 ? `${v}k` : `${v.toFixed(1)}k`;
  }
  return String(value);
}

// ─── SVG Path Builder ───────────────────────────────────────────────────────
interface ChartPoint { x: number; y: number; value: number; label: string }
interface ChartPaths  { linePath: string; areaPath: string; points: ChartPoint[] }

function buildChartPaths(
  months: { label: string; value: number }[],
  maxTick: number,
): ChartPaths {
  const empty: ChartPaths = { linePath: '', areaPath: '', points: [] };
  if (months.length === 0) return empty;

  // Clamp control points to the chart area so they never drop below the x-axis
  const clampY = (y: number) => Math.max(CHART_TOP, Math.min(y, X_AXIS_Y));

  const points: ChartPoint[] = months.map((m, i) => {
    const xRatio = months.length === 1 ? 1 : i / (months.length - 1);
    const x = CHART_LEFT + xRatio * PLOT_WIDTH;
    const yRatio = maxTick === 0 ? 0 : Math.max(0, m.value) / maxTick;
    const y = X_AXIS_Y - yRatio * CHART_HEIGHT;
    return { x, y: clampY(y), value: m.value, label: m.label };
  });

  if (points.length === 1) return { linePath: '', areaPath: '', points };

  const first = points[0]!;
  let linePath = `M ${first.x},${first.y}`;

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(i - 1, 0)]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[Math.min(i + 2, points.length - 1)]!;

    // Catmull-Rom → Bezier control points, clamped to prevent sub-axis overshoot
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = clampY(p1.y + (p2.y - p0.y) / 6);
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = clampY(p2.y - (p3.y - p1.y) / 6);

    linePath += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
  }

  const lastPoint = points[points.length - 1]!;
  const areaPath = `${linePath} L ${lastPoint.x},${X_AXIS_Y} L ${first.x},${X_AXIS_Y} Z`;

  return { linePath, areaPath, points };
}

// ─── Component ──────────────────────────────────────────────────────────────
export function RevenueChart({
  data,
  title,
  avgLabel,
  vsLabel,
  expensesLabel,
  incomeLabel,
  profitLabel,
  tooltipLabel,
  filterSlot,
}: RevenueChartProps) {
  const values = useMemo(() => data.months.map((m) => m.value), [data.months]);
  const { ticks, maxTick } = useMemo(() => computeYAxisTicks(values), [values]);
  const { linePath, areaPath, points } = useMemo(
    () => buildChartPaths(data.months, maxTick),
    [data.months, maxTick],
  );

  const lastIndex = points.length > 0 ? points.length - 1 : null;

  // ── Hover / tooltip state ────────────────────────────────────────────────
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  /**
   * Pixel position of the active dot within the .chart-wrap div.
   * null → fall back to %-based positioning (before first rAF fires).
   */
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef       = useRef<SVGSVGElement>(null);

  const activeIndex = hoveredIndex ?? lastIndex;
  const activePoint = activeIndex !== null ? (points[activeIndex] ?? null) : null;
  const isHoveringNonLast = hoveredIndex !== null && hoveredIndex !== lastIndex;

  // Convert a ChartPoint (SVG coords) → pixel coords inside containerRef
  const computeDotPixels = useCallback(
    (pt: ChartPoint): { x: number; y: number } | null => {
      const svgEl = svgRef.current;
      const containerEl = containerRef.current;
      if (!svgEl || !containerEl) return null;

      const svgRect = svgEl.getBoundingClientRect();
      const cRect   = containerEl.getBoundingClientRect();

      const rawX = svgRect.left - cRect.left + (pt.x / SVG_WIDTH)  * svgRect.width;
      const rawY = svgRect.top  - cRect.top  + (pt.y / SVG_HEIGHT) * svgRect.height;

      // Clamp X so tooltip never clips the container edges
      const clampedX = Math.max(50, Math.min(cRect.width - 50, rawX));
      return { x: clampedX, y: rawY };
    },
    [],
  );

  // Set / refresh last-point tooltip on mount, data change, and resize
  useEffect(() => {
    const lastPt = lastIndex !== null ? points[lastIndex] : null;
    if (!lastPt) return;

    const update = () => {
      const pos = computeDotPixels(lastPt);
      if (pos) setTooltipPos(pos);
    };

    // Defer so SVG has been laid out
    const rafId = requestAnimationFrame(update);
    const observer = new ResizeObserver(update);
    if (containerRef.current) observer.observe(containerRef.current);

    return () => {
      cancelAnimationFrame(rafId);
      observer.disconnect();
    };
  }, [points, lastIndex, computeDotPixels]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (points.length === 0) return;

      const svgEl = e.currentTarget;
      const svgRect = svgEl.getBoundingClientRect();
      const mouseX = ((e.clientX - svgRect.left) / svgRect.width) * SVG_WIDTH;

      let closest = 0;
      let minDist = Infinity;
      points.forEach((pt, i) => {
        const dist = Math.abs(pt.x - mouseX);
        if (dist < minDist) { minDist = dist; closest = i; }
      });

      setHoveredIndex(closest);
      const pos = computeDotPixels(points[closest]!);
      if (pos) setTooltipPos(pos);
    },
    [points, computeDotPixels],
  );

  const handleMouseLeave = useCallback(() => {
    setHoveredIndex(null);
    const lastPt = lastIndex !== null ? points[lastIndex] : null;
    if (lastPt) {
      const pos = computeDotPixels(lastPt);
      if (pos) setTooltipPos(pos);
    }
  }, [points, lastIndex, computeDotPixels]);

  // Fallback %-based left for first render before rAF fires
  const fallbackLeftPct = activePoint
    ? Math.min(Math.max((activePoint.x / SVG_WIDTH) * 100, 6), 94)
    : 50;

  const showEveryOther = data.months.length > 16;
  const TrendIcon = data.trend.direction === 'up' ? ArrowUpRight : ArrowDownRight;
  const isPositive = data.trend.direction === 'up';

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
      {/* Title row — title on far left, filter on far right */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <h3 className="text-base font-semibold tracking-tight text-slate-900 pt-1">{title}</h3>
        {filterSlot && <div className="ml-auto shrink-0">{filterSlot}</div>}
      </div>

      {/* Chart area */}
      <div className="bg-orange-50/30 rounded-xl p-5">
        {/* Income header */}
        <div className="mb-4">
          <p className="text-sm text-slate-500 mb-0.5">{avgLabel}</p>
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
              {data.averageIncome}
            </h2>
            <span
              className={cn(
                'bg-white px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1 shadow-sm',
                isPositive ? 'text-emerald-600' : 'text-rose-500',
              )}
            >
              <TrendIcon className="w-3 h-3" />
              {Math.abs(data.trend.value)}%
            </span>
            <span className="text-sm text-slate-400">{vsLabel}</span>
          </div>
        </div>

        {/* Chart container — tooltip is positioned relative to this div */}
        <div ref={containerRef} className="relative" style={{ marginTop: 28 }}>
          {/* Tooltip — follows the active dot in pixel space */}
          {activePoint && (
            <div
              className="absolute pointer-events-none flex flex-col items-center z-10"
              style={
                tooltipPos
                  ? {
                      left: tooltipPos.x,
                      top: tooltipPos.y - TOOLTIP_ABOVE_PX,
                      transform: 'translateX(-50%)',
                      transition: 'left 80ms ease, top 80ms ease',
                    }
                  : {
                      // Fallback before first rAF: %-based X, near top
                      left: `${fallbackLeftPct}%`,
                      top: -8,
                      transform: 'translateX(-50%)',
                    }
              }
            >
              <div
                className={cn(
                  'px-4 py-2 rounded-lg shadow-xl text-center whitespace-nowrap',
                  isHoveringNonLast ? 'bg-slate-700' : 'bg-slate-900',
                  'text-white',
                )}
              >
                <p className="text-xs text-slate-300">
                  {activePoint.label} &middot; {tooltipLabel ?? incomeLabel}
                </p>
                <p className="text-sm font-semibold">
                  {activePoint.value.toLocaleString('en-US', {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 3,
                  })}
                </p>
              </div>
              {/* Arrow */}
              <div
                className="w-0 h-0"
                style={{
                  borderLeft: '6px solid transparent',
                  borderRight: '6px solid transparent',
                  borderTop: `6px solid ${isHoveringNonLast ? '#374151' : '#0f172a'}`,
                }}
              />
            </div>
          )}

          {/* SVG chart */}
          <svg
            ref={svgRef}
            viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
            className="w-full"
            preserveAspectRatio="xMidYMid meet"
            style={{ cursor: points.length > 0 ? 'crosshair' : 'default', display: 'block' }}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          >
            <defs>
              <linearGradient id="revenueGradient" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={CHART_COLOR} stopOpacity="0.15" />
                <stop offset="100%" stopColor={CHART_COLOR} stopOpacity="0.01" />
              </linearGradient>
            </defs>

            {/* Y-Axis labels + grid lines */}
            {ticks.map((tick) => {
              const yRatio = maxTick === 0 ? 0 : tick / maxTick;
              const y = X_AXIS_Y - yRatio * CHART_HEIGHT;
              return (
                <g key={`tick-${tick}`}>
                  <text
                    x={Y_AXIS_WIDTH}
                    y={y + 4}
                    textAnchor="end"
                    className="fill-slate-400"
                    fontSize="22"
                    fontFamily="system-ui, sans-serif"
                  >
                    {formatTickLabel(tick)}
                  </text>
                  <line
                    x1={CHART_LEFT} y1={y} x2={PLOT_RIGHT} y2={y}
                    stroke="#e2e8f0"
                    strokeWidth="1"
                    strokeDasharray={tick === 0 ? 'none' : '6 4'}
                    opacity={tick === 0 ? 0.8 : 0.5}
                  />
                </g>
              );
            })}

            {/* Y-axis vertical line */}
            <line
              x1={CHART_LEFT} y1={CHART_TOP} x2={CHART_LEFT} y2={X_AXIS_Y}
              stroke="#e2e8f0" strokeWidth="1" opacity={0.8}
            />

            {/* Area fill */}
            {areaPath && <path d={areaPath} fill="url(#revenueGradient)" />}

            {/* Line */}
            {linePath && (
              <path
                d={linePath}
                fill="none"
                stroke={CHART_COLOR}
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Always-visible current-month indicator (last data point) */}
            {lastIndex !== null && points[lastIndex] && (
              <>
                <line
                  x1={points[lastIndex]!.x} y1={points[lastIndex]!.y}
                  x2={points[lastIndex]!.x} y2={X_AXIS_Y}
                  stroke="#94a3b8" strokeWidth="2" strokeDasharray="6 4" opacity={0.7}
                />
                <circle cx={points[lastIndex]!.x} cy={points[lastIndex]!.y}
                  r="10" fill={CHART_COLOR} opacity={0.15} />
                <circle cx={points[lastIndex]!.x} cy={points[lastIndex]!.y}
                  r="6" fill={CHART_COLOR} stroke="#ffffff" strokeWidth="3" />
              </>
            )}

            {/* Hover crosshair + dot for non-last hovered point */}
            {isHoveringNonLast && activePoint && (
              <>
                <line
                  x1={activePoint.x} y1={CHART_TOP}
                  x2={activePoint.x} y2={X_AXIS_Y}
                  stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="4 3" opacity={0.45}
                />
                <circle cx={activePoint.x} cy={activePoint.y}
                  r="5" fill={CHART_COLOR} stroke="#ffffff" strokeWidth="2.5" />
              </>
            )}

            {/* Single-point dot */}
            {points.length === 1 && points[0] && (
              <>
                <circle cx={points[0].x} cy={points[0].y}
                  r="10" fill={CHART_COLOR} opacity={0.15} />
                <circle cx={points[0].x} cy={points[0].y}
                  r="6" fill={CHART_COLOR} stroke="#ffffff" strokeWidth="3" />
              </>
            )}

            {/* Month labels */}
            {points.map((pt, i) => {
              if (showEveryOther && i % 2 !== 0 && i !== points.length - 1) return null;
              const isLast    = i === points.length - 1;
              const isHovered = i === hoveredIndex;
              return (
                <text
                  key={`month-${pt.label}-${i}`}
                  x={pt.x}
                  y={X_AXIS_Y + 28}
                  textAnchor="middle"
                  fontSize="22"
                  fontFamily="system-ui, sans-serif"
                  className={isHovered ? 'fill-amber-500' : isLast ? 'fill-slate-800' : 'fill-slate-400'}
                  fontWeight={isLast || isHovered ? 700 : 400}
                >
                  {pt.label}
                </text>
              );
            })}
          </svg>
        </div>
      </div>

      {/* Financial summary row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
        <SummaryItem icon={DollarSign} label={expensesLabel} value={data.summary.expenses} />
        <SummaryItem icon={Wallet}     label={incomeLabel}   value={data.summary.income} />
        <SummaryItem icon={PiggyBank}  label={profitLabel}   value={data.summary.profit} />
      </div>
    </div>
  );
}

// ─── Summary sub-component ──────────────────────────────────────────────────
function SummaryItem({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof DollarSign;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-9 h-9 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100 text-slate-600">
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-900">{value}</p>
        <p className="text-xs text-slate-500">{label}</p>
      </div>
    </div>
  );
}
