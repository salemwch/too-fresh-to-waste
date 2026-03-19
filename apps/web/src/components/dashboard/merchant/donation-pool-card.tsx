'use client';

import { Heart, Target, Users, Utensils, Package } from 'lucide-react';
import { cn } from '@foodwaste/ui';
import type { DonationStats, CommunityBagGoalStats } from '@/types/dashboard';

// ─── Types ──────────────────────────────────────────────────────────────────

interface DonationPoolCardProps {
  donationStats: DonationStats | null;
  communityGoal: CommunityBagGoalStats | null;
  isLoading?: boolean;
}

// ─── Progress bar ───────────────────────────────────────────────────────────

function ProgressBar({
  percentage,
  color,
}: {
  percentage: number;
  color: string;
}) {
  const clamped = Math.min(Math.max(percentage, 0), 100);
  return (
    <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
      <div
        className={cn('h-full rounded-full transition-all duration-700 ease-out', color)}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

// ─── Skeleton ───────────────────────────────────────────────────────────────

function DonationPoolSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 space-y-4 animate-pulse">
      <div className="h-5 w-32 bg-slate-100 rounded" />
      <div className="space-y-3">
        <div className="h-4 w-full bg-slate-100 rounded" />
        <div className="h-2 w-full bg-slate-100 rounded-full" />
        <div className="h-4 w-3/4 bg-slate-100 rounded" />
      </div>
      <div className="h-px bg-slate-100" />
      <div className="space-y-3">
        <div className="h-4 w-full bg-slate-100 rounded" />
        <div className="h-2 w-full bg-slate-100 rounded-full" />
        <div className="h-4 w-2/3 bg-slate-100 rounded" />
      </div>
    </div>
  );
}

// ─── Stat row ───────────────────────────────────────────────────────────────

function StatRow({
  icon: Icon,
  iconClassName,
  label,
  value,
}: {
  icon: React.ElementType;
  iconClassName: string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className={cn('w-6 h-6 rounded-full flex items-center justify-center', iconClassName)}>
          <Icon className="w-3 h-3" />
        </div>
        <span className="text-xs text-slate-500">{label}</span>
      </div>
      <span className="text-xs font-semibold text-slate-700 tabular-nums">{value}</span>
    </div>
  );
}

// ─── Component ──────────────────────────────────────────────────────────────

export function DonationPoolCard({
  donationStats,
  communityGoal,
  isLoading,
}: DonationPoolCardProps) {
  if (isLoading) return <DonationPoolSkeleton />;
  if (!donationStats && !communityGoal) return null;

  const currency = donationStats?.currency ?? 'TND';

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
      {/* ── Donation Pool Section ── */}
      {donationStats && (
        <div className="p-5 space-y-3">
          {/* Header */}
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-rose-50 flex items-center justify-center">
              <Heart className="w-3.5 h-3.5 text-rose-500" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Donation Pool</h3>
              <p className="text-[11px] text-slate-400">Your orders change lives</p>
            </div>
          </div>

          {/* Amount + Progress */}
          <div>
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="text-lg font-bold text-slate-900 tabular-nums">
                {donationStats.totalDonations.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{' '}
                <span className="text-xs font-medium text-slate-400">{currency}</span>
              </span>
              <span className="text-xs font-semibold text-rose-500">
                {donationStats.progressPercentage.toFixed(0)}%
              </span>
            </div>
            <ProgressBar
              percentage={donationStats.progressPercentage}
              color="bg-rose-400"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Goal: {donationStats.targetAmount.toLocaleString()} {currency}
            </p>
          </div>

          {/* Stats */}
          <div className="space-y-2">
            <StatRow
              icon={Users}
              iconClassName="bg-blue-50 text-blue-500"
              label="Contributors"
              value={donationStats.contributorCount.toLocaleString()}
            />
            <StatRow
              icon={Utensils}
              iconClassName="bg-amber-50 text-amber-500"
              label="Meals Funded"
              value={donationStats.mealCount.toLocaleString()}
            />
          </div>

          {/* Cause */}
          <div className="rounded-lg bg-slate-50 px-3 py-2">
            <p className="text-[11px] text-slate-400 mb-0.5">Current Cause</p>
            <p className="text-xs font-medium text-slate-700">
              {donationStats.cause || 'Ensuring No One Goes Hungry'}
            </p>
          </div>
        </div>
      )}

      {/* ── Divider ── */}
      {donationStats && communityGoal && (
        <div className="border-t border-dashed border-slate-200" />
      )}

      {/* ── Community Bag Goal Section ── */}
      {communityGoal && (
        <div className="p-5 space-y-3">
          {/* Header */}
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-emerald-50 flex items-center justify-center">
              <Package className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-900">Community Goal</h3>
                {communityGoal.status === 'active' && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    </span>
                    LIVE
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400">
                Cycle #{communityGoal.cycleNumber}
              </p>
            </div>
          </div>

          {/* Count + Progress */}
          <div>
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="text-lg font-bold text-slate-900 tabular-nums">
                {communityGoal.currentCount.toLocaleString()}
                <span className="text-xs font-medium text-slate-400">
                  {' '}/ {communityGoal.targetCount.toLocaleString()} bags
                </span>
              </span>
              <span className="text-xs font-semibold text-emerald-600">
                {communityGoal.progressPercentage.toFixed(0)}%
              </span>
            </div>
            <ProgressBar
              percentage={communityGoal.progressPercentage}
              color="bg-emerald-500"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              {communityGoal.remaining.toLocaleString()} bags remaining
            </p>
          </div>

          {/* Target row */}
          <StatRow
            icon={Target}
            iconClassName="bg-emerald-50 text-emerald-600"
            label="Grand Prize at"
            value={`${communityGoal.targetCount.toLocaleString()} bags`}
          />
        </div>
      )}
    </div>
  );
}
