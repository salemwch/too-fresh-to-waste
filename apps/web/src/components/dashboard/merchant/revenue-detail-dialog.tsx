'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@foodwaste/ui';
import { cn } from '@foodwaste/ui';
import {
  DollarSign,
  TrendingUp,
  ShoppingBag,
  Ban,
  Receipt,
  Leaf,
  Percent,
  HandCoins,
} from 'lucide-react';

// ─── Constants ──────────────────────────────────────────────────────────────

/** Platform fee rate charged on each order (mirrors backend ORDER_PLATFORM_FEE_PERCENTAGE). */
const PLATFORM_FEE_RATE = 0.25;
/** Donation rate applied to the platform fee (mirrors backend ORDER_DONATION_PERCENTAGE). */
const DONATION_RATE = 0.05;

// ─── Types ──────────────────────────────────────────────────────────────────

export interface RevenueDetailData {
  totalRevenue: number;
  completedOrders: number;
  cancelledOrders: number;
  totalOrders: number;
  averageOrderValue: number;
  bagsSaved: number;
  periodLabel: string;
}

interface RevenueDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: RevenueDetailData | null;
}

// ─── Formatters ─────────────────────────────────────────────────────────────

const CURRENCY = 'TND';

function fmt(value: number, decimals = 3): string {
  return `${value.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} ${CURRENCY}`;
}

// ─── Row component ──────────────────────────────────────────────────────────

interface DetailRowProps {
  icon: React.ElementType;
  iconClassName: string;
  label: string;
  value: string;
  highlight?: boolean;
  border?: boolean;
}

function DetailRow({ icon: Icon, iconClassName, label, value, highlight, border }: DetailRowProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between py-2.5',
        border && 'border-t border-dashed border-slate-200',
      )}
    >
      <div className='flex items-center gap-2.5'>
        <div className={cn('w-7 h-7 rounded-full flex items-center justify-center', iconClassName)}>
          <Icon className='w-3.5 h-3.5' />
        </div>
        <span
          className={cn('text-sm', highlight ? 'font-semibold text-slate-900' : 'text-slate-600')}
        >
          {label}
        </span>
      </div>
      <span
        className={cn(
          'text-sm font-medium tabular-nums',
          highlight ? 'text-slate-900' : 'text-slate-700',
        )}
      >
        {value}
      </span>
    </div>
  );
}

// ─── Component ──────────────────────────────────────────────────────────────

export function RevenueDetailDialog({ open, onOpenChange, data }: RevenueDetailDialogProps) {
  if (!data) return null;

  const platformFee = data.totalRevenue * PLATFORM_FEE_RATE;
  const donationAmount = platformFee * DONATION_RATE;
  const netRevenue = data.totalRevenue - platformFee;
  const cancelledValue = data.cancelledOrders * data.averageOrderValue;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md pt-8'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <DollarSign className='h-5 w-5 text-indigo-600' />
            Revenue Breakdown
          </DialogTitle>
          <DialogDescription>{data.periodLabel}</DialogDescription>
        </DialogHeader>

        <div className='space-y-0.5'>
          {/* Gross revenue */}
          <DetailRow
            icon={DollarSign}
            iconClassName='bg-indigo-50 text-indigo-600'
            label='Total Revenue'
            value={fmt(data.totalRevenue)}
            highlight
          />

          {/* Platform commission */}
          <DetailRow
            icon={Percent}
            iconClassName='bg-amber-50 text-amber-600'
            label={`Platform Fee (${(PLATFORM_FEE_RATE * 100).toFixed(0)}%)`}
            value={`-${fmt(platformFee)}`}
          />

          {/* Donation from fee */}
          <DetailRow
            icon={HandCoins}
            iconClassName='bg-pink-50 text-pink-600'
            label={`Donation (${(DONATION_RATE * 100).toFixed(0)}% of fee)`}
            value={fmt(donationAmount)}
          />

          {/* Net revenue */}
          <DetailRow
            icon={TrendingUp}
            iconClassName='bg-emerald-50 text-emerald-600'
            label='Net Revenue (yours)'
            value={fmt(netRevenue)}
            highlight
            border
          />

          {/* Average order value */}
          <DetailRow
            icon={Receipt}
            iconClassName='bg-blue-50 text-blue-600'
            label='Avg. Order Value'
            value={fmt(data.averageOrderValue)}
            border
          />

          {/* Order breakdown */}
          <DetailRow
            icon={ShoppingBag}
            iconClassName='bg-slate-100 text-slate-600'
            label='Completed Orders'
            value={data.completedOrders.toLocaleString()}
          />

          <DetailRow
            icon={Ban}
            iconClassName='bg-rose-50 text-rose-500'
            label='Cancelled Orders'
            value={data.cancelledOrders.toLocaleString()}
          />

          <DetailRow
            icon={Ban}
            iconClassName='bg-orange-50 text-orange-500'
            label='Cancelled Value (est.)'
            value={fmt(cancelledValue)}
          />

          {/* Bags saved */}
          <DetailRow
            icon={Leaf}
            iconClassName='bg-green-50 text-green-600'
            label='Bags Saved'
            value={data.bagsSaved.toLocaleString()}
            border
          />
        </div>

        <p className='text-[11px] text-slate-400 text-center mt-1'>
          All amounts in Tunisian Dinar (TND). Figures are for the selected period.
        </p>
      </DialogContent>
    </Dialog>
  );
}
