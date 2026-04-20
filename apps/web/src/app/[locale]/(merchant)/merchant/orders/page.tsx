'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { formatCurrency } from '@foodwaste/shared';
import {
  Search,
  Package,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ShoppingBag,
  User,
  Phone,
  Mail,
  Loader2,
  Ban,
  ChevronRight,
  Wifi,
} from 'lucide-react';
import {
  useMerchantOrders,
  useOrderDetail,
  useCancelOrder,
  HISTORY_STATUSES,
} from '@/hooks/use-merchant-dashboard';
import type { MerchantOrder, OrderStatus, PopulatedUser } from '@/types/dashboard';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatRelativeTime(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function getCustomerName(customer: PopulatedUser | string | undefined): string {
  if (!customer || typeof customer === 'string') return '—';
  return `${customer.firstName} ${customer.lastName}`.trim();
}

function getCustomerPhone(customer: PopulatedUser | string | undefined): string | null {
  if (!customer || typeof customer === 'string') return null;
  return customer.phoneNumber ?? null;
}

function getCustomerEmail(customer: PopulatedUser | string | undefined): string | null {
  if (!customer || typeof customer === 'string') return null;
  return customer.email ?? null;
}

const isHistoryOrder = (status: OrderStatus) => HISTORY_STATUSES.includes(status);

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_META: Record<
  OrderStatus,
  { label: string; bg: string; text: string; icon: React.ReactNode }
> = {
  pending: {
    label: 'Pending',
    bg: 'bg-amber-100',
    text: 'text-amber-700',
    icon: <Clock className='h-3 w-3' />,
  },
  reserved: {
    label: 'Reserved',
    bg: 'bg-amber-100',
    text: 'text-amber-700',
    icon: <Clock className='h-3 w-3' />,
  },
  confirmed: {
    label: 'Confirmed',
    bg: 'bg-blue-100',
    text: 'text-blue-700',
    icon: <CheckCircle2 className='h-3 w-3' />,
  },
  ready_for_pickup: {
    label: 'Ready',
    bg: 'bg-purple-100',
    text: 'text-purple-700',
    icon: <Package className='h-3 w-3' />,
  },
  picked_up: {
    label: 'Picked Up',
    bg: 'bg-green-100',
    text: 'text-green-700',
    icon: <CheckCircle2 className='h-3 w-3' />,
  },
  cancelled: {
    label: 'Cancelled',
    bg: 'bg-red-100',
    text: 'text-red-700',
    icon: <XCircle className='h-3 w-3' />,
  },
  expired: {
    label: 'Expired',
    bg: 'bg-zinc-100',
    text: 'text-zinc-500',
    icon: <AlertCircle className='h-3 w-3' />,
  },
  refunded: {
    label: 'Refunded',
    bg: 'bg-orange-100',
    text: 'text-orange-700',
    icon: <AlertCircle className='h-3 w-3' />,
  },
};

function StatusBadge({ status }: { status: OrderStatus }) {
  const meta = STATUS_META[status] ?? STATUS_META['pending'];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${meta.bg} ${meta.text}`}
    >
      {meta.icon}
      {meta.label}
    </span>
  );
}

// ─── Order list card ──────────────────────────────────────────────────────────

interface OrderCardProps {
  order: MerchantOrder;
  isSelected: boolean;
  onClick: () => void;
}

function OrderListCard({ order, isSelected, onClick }: OrderCardProps) {
  const total = order.pricing?.total ?? 0;
  const currency = order.pricing?.currency ?? 'EUR';
  const customer = order.customerId;

  return (
    <button
      onClick={onClick}
      className={[
        'w-full text-left px-4 py-3 border-b border-border/60 transition-colors duration-100',
        'hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
        isSelected ? 'bg-accent border-l-2 border-l-primary' : 'border-l-2 border-l-transparent',
      ].join(' ')}
    >
      <div className='flex items-start justify-between gap-2'>
        <div className='flex-1 min-w-0'>
          <div className='flex items-center gap-1.5 flex-wrap'>
            <span className='text-xs font-semibold text-foreground truncate'>
              #{order.orderNumber}
            </span>
            <StatusBadge status={order.status} />
          </div>
          <p className='mt-0.5 text-[11px] text-muted-foreground truncate'>
            {getCustomerName(customer)}
          </p>
        </div>
        <div className='flex flex-col items-end shrink-0 gap-0.5'>
          <span className='text-xs font-bold text-foreground'>
            {formatCurrency(total, currency)}
          </span>
          <span className='text-[10px] text-muted-foreground'>
            {formatRelativeTime(order.createdAt)}
          </span>
        </div>
      </div>

      {/* Items summary */}
      <p className='mt-1 text-[10px] text-muted-foreground truncate'>
        {order.items.map(i => `${i.quantity}× ${i.offerTitle}`).join(', ')}
      </p>
    </button>
  );
}

// ─── Pickup code display ──────────────────────────────────────────────────────

function PickupCodeBlock({ code, status }: { code: string | undefined; status: OrderStatus }) {
  const digits = (code ?? '------').split('');

  return (
    <div className='rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 p-4'>
      <p className='text-[10px] font-semibold uppercase tracking-widest text-primary/70 text-center mb-3'>
        Pickup Code
      </p>

      {/* 6-digit display */}
      <div className='flex justify-center gap-2'>
        {digits.map((d, i) => (
          <div
            key={i}
            className='w-9 h-11 rounded-lg bg-background border-2 border-primary/20 flex items-center justify-center shadow-sm'
          >
            <span className='text-xl font-black tracking-tighter text-foreground'>{d}</span>
          </div>
        ))}
      </div>

      <p className='mt-3 text-center text-[10px] text-muted-foreground'>
        Write this code on the physical bag
      </p>

      {/* Status indicator */}
      <div className='mt-4'>
        {status === 'picked_up' ? (
          <div className='flex items-center justify-center gap-2 rounded-lg bg-green-50 border border-green-200 py-2.5 px-4'>
            <CheckCircle2 className='h-4 w-4 text-green-600 shrink-0' />
            <span className='text-xs font-semibold text-green-700'>Picked up successfully</span>
          </div>
        ) : (
          <div className='flex items-center justify-center gap-2 rounded-lg bg-amber-50 border border-amber-200 py-2.5 px-4'>
            <span className='relative flex h-2.5 w-2.5 shrink-0'>
              <span className='animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75' />
              <span className='relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500' />
            </span>
            <span className='text-xs font-medium text-amber-700'>
              Waiting for customer to confirm on their app...
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Cancel dialog ────────────────────────────────────────────────────────────

interface CancelDialogProps {
  orderId: string;
  orderNumber: string;
  onClose: () => void;
  onCancelled: () => void;
}

function CancelDialog({ orderId, orderNumber, onClose, onCancelled }: CancelDialogProps) {
  const [reason, setReason] = useState('');
  const { mutate: cancelOrder, isPending } = useCancelOrder();

  const handleConfirm = () => {
    if (!reason.trim()) return;
    cancelOrder(
      { orderId, reason: reason.trim() },
      {
        onSuccess: () => {
          onCancelled();
          onClose();
        },
      },
    );
  };

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4'>
      <div className='w-full max-w-sm rounded-2xl bg-background shadow-xl border border-border p-6'>
        <div className='flex items-center gap-3 mb-4'>
          <div className='h-9 w-9 rounded-full bg-red-100 flex items-center justify-center shrink-0'>
            <Ban className='h-4 w-4 text-red-600' />
          </div>
          <div>
            <h3 className='text-sm font-semibold text-foreground'>Cancel Order #{orderNumber}?</h3>
            <p className='text-xs text-muted-foreground mt-0.5'>The customer will be notified.</p>
          </div>
        </div>

        <textarea
          className='w-full rounded-lg border border-input bg-background px-3 py-2 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-ring'
          rows={3}
          placeholder='Reason for cancellation...'
          value={reason}
          onChange={e => setReason(e.target.value)}
        />

        <div className='flex gap-2 mt-4'>
          <button
            onClick={onClose}
            className='flex-1 h-8 rounded-lg border border-border text-xs font-medium hover:bg-accent transition-colors'
          >
            Keep Order
          </button>
          <button
            onClick={handleConfirm}
            disabled={!reason.trim() || isPending}
            className='flex-1 h-8 rounded-lg bg-destructive text-destructive-foreground text-xs font-semibold hover:bg-destructive/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5'
          >
            {isPending && <Loader2 className='h-3 w-3 animate-spin' />}
            Yes, Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Order detail panel ───────────────────────────────────────────────────────

interface OrderDetailPanelProps {
  orderId: string;
}

function OrderDetailPanel({ orderId }: OrderDetailPanelProps) {
  const { data: order, isLoading } = useOrderDetail(orderId);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelledId, setCancelledId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className='h-full flex items-center justify-center'>
        <Loader2 className='h-6 w-6 animate-spin text-muted-foreground' />
      </div>
    );
  }

  if (!order) {
    return (
      <div className='h-full flex items-center justify-center p-8 text-center'>
        <div>
          <AlertCircle className='h-8 w-8 text-muted-foreground mx-auto mb-2' />
          <p className='text-sm text-muted-foreground'>Order not found</p>
        </div>
      </div>
    );
  }

  const customer = order.customerId;
  const isActive = !isHistoryOrder(order.status);
  const pickupCode = order.pickupDetails?.pickupCode;
  const currency = order.pricing?.currency ?? 'EUR';

  return (
    <div className='h-full flex flex-col'>
      {/* Header */}
      <div className='px-6 py-4 border-b border-border/60 shrink-0'>
        <div className='flex items-start justify-between gap-3'>
          <div>
            <h2 className='text-base font-bold text-foreground'>Order #{order.orderNumber}</h2>
            <p className='text-xs text-muted-foreground mt-0.5'>
              {formatRelativeTime(order.createdAt)}
            </p>
          </div>
          <div className='flex items-center gap-2'>
            <StatusBadge status={order.status} />
            {isActive && order.status !== 'picked_up' && (
              <button
                onClick={() => setShowCancelDialog(true)}
                className='h-7 px-2.5 rounded-lg bg-destructive/10 text-destructive text-[11px] font-semibold hover:bg-destructive/20 transition-colors flex items-center gap-1'
              >
                <Ban className='h-3 w-3' />
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Scrollable content */}
      <div className='flex-1 overflow-y-auto p-6 space-y-5'>
        {/* Pickup code — only for active orders */}
        {isActive && <PickupCodeBlock code={pickupCode} status={order.status} />}

        {/* Picked-up confirmation banner */}
        {order.status === 'picked_up' && (
          <div className='flex items-center gap-2 rounded-xl bg-green-50 border border-green-200 px-4 py-3'>
            <CheckCircle2 className='h-4 w-4 text-green-600 shrink-0' />
            <span className='text-xs font-semibold text-green-700'>
              Order picked up successfully
            </span>
          </div>
        )}

        {/* Customer info */}
        <section>
          <h3 className='text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5'>
            <User className='h-3.5 w-3.5' />
            Customer
          </h3>
          <div className='rounded-xl border border-border bg-card p-3 space-y-1.5'>
            <p className='text-sm font-medium text-foreground'>{getCustomerName(customer)}</p>
            {getCustomerEmail(customer) && (
              <div className='flex items-center gap-1.5 text-xs text-muted-foreground'>
                <Mail className='h-3 w-3 shrink-0' />
                {getCustomerEmail(customer)}
              </div>
            )}
            {getCustomerPhone(customer) && (
              <div className='flex items-center gap-1.5 text-xs text-muted-foreground'>
                <Phone className='h-3 w-3 shrink-0' />
                {getCustomerPhone(customer)}
              </div>
            )}
          </div>
        </section>

        {/* Items */}
        <section>
          <h3 className='text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5'>
            <ShoppingBag className='h-3.5 w-3.5' />
            Items
          </h3>
          <div className='rounded-xl border border-border bg-card divide-y divide-border'>
            {order.items.map((item, idx) => (
              <div key={idx} className='flex items-center justify-between px-3 py-2.5 gap-3'>
                <div className='flex-1 min-w-0'>
                  <p className='text-xs font-medium text-foreground truncate'>{item.offerTitle}</p>
                  <p className='text-[10px] text-muted-foreground'>
                    {item.quantity}× {formatCurrency(item.unitPrice, currency)}
                  </p>
                </div>
                <span className='text-xs font-semibold text-foreground shrink-0'>
                  {formatCurrency(item.totalPrice, currency)}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Pricing breakdown */}
        <section>
          <h3 className='text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2'>
            Pricing
          </h3>
          <div className='rounded-xl border border-border bg-card p-3 space-y-1.5'>
            {[
              { label: 'Subtotal', value: order.pricing?.subtotal },
              {
                label: 'Discount',
                value: order.pricing?.discountAmount ? -order.pricing.discountAmount : null,
              },
              { label: 'Tax', value: order.pricing?.taxAmount },
              { label: 'Service Fee', value: order.pricing?.serviceFee },
            ]
              .filter(r => r.value != null && r.value !== 0)
              .map(row => (
                <div
                  key={row.label}
                  className='flex items-center justify-between text-xs text-muted-foreground'
                >
                  <span>{row.label}</span>
                  <span className={row.value! < 0 ? 'text-green-600' : ''}>
                    {formatCurrency(row.value!, currency)}
                  </span>
                </div>
              ))}
            <div className='pt-1.5 mt-1 border-t border-border flex items-center justify-between'>
              <span className='text-sm font-bold text-foreground'>Total</span>
              <span className='text-sm font-black text-foreground'>
                {formatCurrency(order.pricing?.total ?? 0, currency)}
              </span>
            </div>
          </div>
        </section>

        {/* Pickup instructions */}
        {order.pickupDetails?.instructions && (
          <section>
            <h3 className='text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2'>
              Instructions
            </h3>
            <div className='rounded-xl border border-border bg-card px-3 py-2.5 text-xs text-foreground'>
              {order.pickupDetails.instructions}
            </div>
          </section>
        )}

        {/* Payment status */}
        <section>
          <div className='flex items-center justify-between text-xs'>
            <span className='text-muted-foreground'>Payment Status</span>
            <span className='font-semibold capitalize text-foreground'>{order.paymentStatus}</span>
          </div>
        </section>
      </div>

      {/* Cancel dialog */}
      {showCancelDialog && (
        <CancelDialog
          orderId={order._id}
          orderNumber={order.orderNumber}
          onClose={() => setShowCancelDialog(false)}
          onCancelled={() => setCancelledId(order._id)}
        />
      )}

      {/* Cancelled confirmation toast */}
      {cancelledId && (
        <div className='absolute bottom-4 left-1/2 -translate-x-1/2 bg-foreground text-background text-xs font-medium px-4 py-2 rounded-full shadow-lg'>
          Order cancelled
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function MerchantOrdersPage() {
  const t = useTranslations('dashboard.merchantOrders');
  const [tab, setTab] = useState<'active' | 'history'>('active');
  const [search, setSearch] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const { data, isLoading } = useMerchantOrders();
  const allOrders = useMemo(() => data?.orders ?? [], [data]);

  const { activeOrders, historyOrders } = useMemo(() => {
    const active: MerchantOrder[] = [];
    const history: MerchantOrder[] = [];
    for (const o of allOrders) {
      if (isHistoryOrder(o.status)) history.push(o);
      else active.push(o);
    }
    return { activeOrders: active, historyOrders: history };
  }, [allOrders]);

  const filteredOrders = useMemo(() => {
    const base = tab === 'active' ? activeOrders : historyOrders;
    if (!search.trim()) return base;
    const q = search.toLowerCase();
    return base.filter(
      o =>
        o.orderNumber.toLowerCase().includes(q) ||
        getCustomerName(o.customerId).toLowerCase().includes(q),
    );
  }, [tab, activeOrders, historyOrders, search]);

  // When tab changes, auto-select first visible order (or clear selection)
  useEffect(() => {
    setSelectedOrderId(prev => {
      const stillVisible = filteredOrders.some(o => o._id === prev);
      return stillVisible ? prev : (filteredOrders[0]?._id ?? null);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  return (
    <div className='h-full flex flex-col'>
      {/* Page header */}
      <div className='shrink-0 flex items-center justify-between pb-4'>
        <div>
          <h1 className='font-display text-lg font-bold tracking-tight text-foreground flex items-center gap-2'>
            {t('title')}
            {/* Live indicator */}
            <span className='inline-flex items-center gap-1 text-[10px] font-medium text-green-600 bg-green-50 border border-green-200 rounded-full px-2 py-0.5'>
              <span className='relative flex h-1.5 w-1.5'>
                <span className='animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75' />
                <span className='relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500' />
              </span>
              <Wifi className='h-2.5 w-2.5' />
              {t('liveIndicator')}
            </span>
          </h1>
          <p className='text-xs text-muted-foreground mt-0.5'>{t('description')}</p>
        </div>
      </div>

      {/* Split panel */}
      <div className='flex-1 min-h-0 flex gap-3 rounded-xl overflow-hidden border border-border bg-background shadow-sm'>
        {/* ── Left: order list ── */}
        <div className='w-72 lg:w-80 xl:w-96 shrink-0 flex flex-col border-r border-border'>
          {/* Tabs */}
          <div className='flex border-b border-border shrink-0'>
            {(['active', 'history'] as const).map(t_ => (
              <button
                key={t_}
                onClick={() => setTab(t_)}
                className={[
                  'flex-1 h-10 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5',
                  tab === t_
                    ? 'text-primary border-b-2 border-primary'
                    : 'text-muted-foreground hover:text-foreground',
                ].join(' ')}
              >
                {t_ === 'active' ? t('tabActive') : t('tabHistory')}
                <span
                  className={[
                    'inline-flex items-center justify-center rounded-full text-[9px] font-bold w-4 h-4',
                    tab === t_
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground',
                  ].join(' ')}
                >
                  {t_ === 'active' ? activeOrders.length : historyOrders.length}
                </span>
              </button>
            ))}
          </div>

          {/* Search */}
          <div className='px-3 py-2 border-b border-border shrink-0'>
            <div className='relative'>
              <Search className='absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none' />
              <input
                type='search'
                className='w-full h-8 rounded-lg border border-input bg-background pl-8 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring'
                placeholder={t('searchPlaceholder')}
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Order list */}
          <div className='flex-1 overflow-y-auto'>
            {isLoading ? (
              <div className='flex items-center justify-center h-32'>
                <Loader2 className='h-5 w-5 animate-spin text-muted-foreground' />
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className='flex flex-col items-center justify-center h-48 px-6 text-center'>
                <Package className='h-7 w-7 text-muted-foreground/50 mb-2' />
                <p className='text-xs font-medium text-muted-foreground'>
                  {tab === 'active' ? t('noActiveOrders') : t('noHistoryOrders')}
                </p>
                <p className='text-[10px] text-muted-foreground/70 mt-1'>
                  {tab === 'active' ? t('noActiveOrdersDesc') : t('noHistoryOrdersDesc')}
                </p>
              </div>
            ) : (
              filteredOrders.map(order => (
                <OrderListCard
                  key={order._id}
                  order={order}
                  isSelected={selectedOrderId === order._id}
                  onClick={() => setSelectedOrderId(order._id)}
                />
              ))
            )}
          </div>
        </div>

        {/* ── Right: order detail ── */}
        <div className='flex-1 min-w-0 relative'>
          {selectedOrderId ? (
            <OrderDetailPanel orderId={selectedOrderId} />
          ) : (
            <div className='h-full flex flex-col items-center justify-center gap-3 text-center px-8'>
              <div className='h-14 w-14 rounded-2xl bg-muted flex items-center justify-center'>
                <ChevronRight className='h-7 w-7 text-muted-foreground' />
              </div>
              <div>
                <p className='text-sm font-semibold text-foreground'>{t('selectOrder')}</p>
                <p className='text-xs text-muted-foreground mt-1'>{t('selectOrderDesc')}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
