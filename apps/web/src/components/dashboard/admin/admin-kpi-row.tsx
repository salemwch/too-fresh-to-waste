'use client';

import type { LucideIcon } from 'lucide-react';
import { AdminStatCard } from './admin-stat-card';
import { AdminStatGridSkeleton } from './admin-skeletons';

export interface KpiItem {
  label: string;
  value: string;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  change?: {
    value: number;
    direction: 'up' | 'down';
    label: string;
  };
  highlight?: boolean;
}

interface AdminKpiRowProps {
  items: KpiItem[];
  loading?: boolean;
  columns?: 3 | 4 | 5;
}

const GRID_COLS = {
  3: 'grid-cols-1 sm:grid-cols-3',
  4: 'grid-cols-2 md:grid-cols-4',
  5: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-5',
} as const;

export function AdminKpiRow({ items, loading = false, columns = 4 }: AdminKpiRowProps) {
  if (loading) {
    return <AdminStatGridSkeleton count={items.length || columns} />;
  }

  return (
    <div className={`grid gap-3 ${GRID_COLS[columns]}`}>
      {items.map(kpi => (
        <AdminStatCard
          key={kpi.label}
          label={kpi.label}
          value={kpi.value}
          icon={kpi.icon}
          iconBg={kpi.iconBg}
          iconColor={kpi.iconColor}
          {...(kpi.change ? { change: kpi.change } : {})}
          {...(kpi.highlight ? { highlight: kpi.highlight } : {})}
        />
      ))}
    </div>
  );
}
