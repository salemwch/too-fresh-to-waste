'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Clock, PackageOpen } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
} from '@foodwaste/ui';
import { cn } from '@foodwaste/ui';

// ─── Types ──────────────────────────────────────────────────────────────────
export type OrderStatus = 'pending' | 'confirmed' | 'picked_up' | 'expired' | 'cancelled';

export interface RecentOrderItem {
  id: string;
  orderNumber: string;
  customerName: string;
  customerInitials: string;
  customerAvatar?: string;
  itemCount: number;
  total: string;
  status: OrderStatus;
  /** ISO timestamp — used for live-ticking display when present. */
  createdAt?: string;
  /** Pre-computed fallback when createdAt is unavailable. */
  timeAgo: string;
}

interface RecentOrdersPanelProps {
  orders: RecentOrderItem[];
  title: string;
  statusLabels: Record<OrderStatus, string>;
  itemsLabel: string;
  viewAllHref?: string;
}

// ─── Status colors ──────────────────────────────────────────────────────────
const STATUS_STYLES: Record<OrderStatus, { bg: string; text: string }> = {
  pending: { bg: 'bg-amber-50', text: 'text-amber-700' },
  confirmed: { bg: 'bg-emerald-50', text: 'text-emerald-700' },
  picked_up: { bg: 'bg-blue-50', text: 'text-blue-700' },
  expired: { bg: 'bg-slate-100', text: 'text-slate-500' },
  cancelled: { bg: 'bg-red-50', text: 'text-red-600' },
};

// ─── Live clock helper ───────────────────────────────────────────────────────
function computeTimeAgo(dateStr: string, now: number): string {
  const diffMs = now - new Date(dateStr).getTime();
  if (diffMs < 0) return 'Just now';
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

// ─── Component ──────────────────────────────────────────────────────────────
export function RecentOrdersPanel({
  orders,
  title,
  statusLabels,
  itemsLabel,
  viewAllHref,
}: RecentOrdersPanelProps) {
  // Tick every 60 s so "X min ago" labels stay accurate
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <Card className="flex h-full flex-col rounded-xl border border-slate-100 bg-white shadow-sm">
      <CardHeader className="px-4 py-3 pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-slate-900">{title}</CardTitle>
          {viewAllHref && (
            <Link
              href={viewAllHref}
              className="text-xs text-indigo-600 hover:text-indigo-700 font-medium transition-colors"
            >
              View all
            </Link>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto px-4 pb-4">
        {orders.length === 0 ? (
          /* ── Empty state ── */
          <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
            <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center">
              <PackageOpen className="w-5 h-5 text-slate-300" />
            </div>
            <p className="text-sm text-slate-400">No recent orders yet</p>
            {viewAllHref && (
              <Link
                href={viewAllHref}
                className="text-xs text-indigo-600 hover:underline font-medium"
              >
                Go to orders
              </Link>
            )}
          </div>
        ) : (
          /* ── Order list ── */
          <div className="space-y-2">
            {orders.map((order) => {
              const style = STATUS_STYLES[order.status];
              const displayTimeAgo = order.createdAt
                ? computeTimeAgo(order.createdAt, now)
                : order.timeAgo;

              return (
                <div
                  key={order.id}
                  className="flex items-center gap-2.5 rounded-lg border border-slate-50 bg-slate-50/50 p-2.5 transition-colors hover:bg-slate-50"
                >
                  {/* Avatar */}
                  <Avatar className="h-7 w-7 shrink-0">
                    {order.customerAvatar && (
                      <AvatarImage
                        src={order.customerAvatar}
                        alt={order.customerName}
                        className="object-cover"
                      />
                    )}
                    <AvatarFallback className="bg-primary-100 text-[10px] font-medium text-primary-700">
                      {order.customerInitials}
                    </AvatarFallback>
                  </Avatar>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1.5">
                      <p className="truncate text-xs font-medium text-slate-900">
                        {order.customerName}
                      </p>
                      <Badge
                        className={cn(
                          'shrink-0 border-0 text-[9px] font-medium px-1.5 py-0',
                          style.bg,
                          style.text,
                        )}
                      >
                        {statusLabels[order.status]}
                      </Badge>
                    </div>
                    <div className="mt-0.5 flex items-center justify-between">
                      <span className="text-[10px] text-slate-400">
                        {order.orderNumber} &middot;{' '}
                        {itemsLabel.replace('{count}', String(order.itemCount))}
                      </span>
                      <span className="text-[10px] font-semibold text-slate-700">
                        {order.total}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-1 text-[9px] text-slate-400">
                      <Clock className="h-2 w-2" />
                      {displayTimeAgo}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
