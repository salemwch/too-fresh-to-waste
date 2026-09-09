'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
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
  Wifi,
  Banknote,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  X,
  Bike,
} from 'lucide-react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  useMerchantOrders,
  useOrderDetail,
  useCancelOrder,
  HISTORY_STATUSES,
} from '@/hooks/use-merchant-dashboard';
import { LocationSwitcher } from '@/components/dashboard/organization/location-switcher';
import { useNotificationStore } from '@/lib/notification-store';
import { cn } from '@/lib/utils';
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

function isOnlinePayment(order: MerchantOrder): boolean {
  return order.paymentDetails?.method === 'online' || order.status === 'pending_payment';
}

function isTodayOrder(isoDate: string): boolean {
  const d = new Date(isoDate);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

type StatusTranslationKey =
  | 'statusPending'
  | 'statusReserved'
  | 'statusConfirmed'
  | 'statusReady'
  | 'statusPickedUp'
  | 'statusCancelled'
  | 'statusCompleted'
  | 'statusPendingPayment'
  | 'statusExpired'
  | 'statusRefunded'
  | 'statusDriverAssigned'
  | 'statusOutForDelivery'
  | 'statusDelivered';

const STATUS_KEY_MAP: Record<OrderStatus, StatusTranslationKey> = {
  pending: 'statusPending',
  reserved: 'statusReserved',
  confirmed: 'statusConfirmed',
  ready_for_pickup: 'statusReady',
  picked_up: 'statusPickedUp',
  driver_assigned: 'statusDriverAssigned',
  out_for_delivery: 'statusOutForDelivery',
  delivered: 'statusDelivered',
  cancelled: 'statusCancelled',
  completed: 'statusCompleted',
  pending_payment: 'statusPendingPayment',
  expired: 'statusExpired',
  refunded: 'statusRefunded',
};

const STATUS_STYLE: Record<OrderStatus, { bg: string; text: string; icon: React.ElementType }> = {
  pending: { bg: 'bg-amber-100', text: 'text-amber-700', icon: Clock },
  reserved: { bg: 'bg-amber-100', text: 'text-amber-700', icon: Clock },
  confirmed: { bg: 'bg-blue-100', text: 'text-blue-700', icon: CheckCircle2 },
  ready_for_pickup: { bg: 'bg-purple-100', text: 'text-purple-700', icon: Package },
  picked_up: { bg: 'bg-green-100', text: 'text-green-700', icon: CheckCircle2 },
  // Delivery in progress reads as motion, not completion — blue like confirmed,
  // so a merchant does not mistake 'a driver has it' for 'the customer has it'.
  driver_assigned: { bg: 'bg-blue-100', text: 'text-blue-700', icon: Bike },
  out_for_delivery: { bg: 'bg-blue-100', text: 'text-blue-700', icon: Bike },
  delivered: { bg: 'bg-green-100', text: 'text-green-700', icon: CheckCircle2 },
  completed: { bg: 'bg-green-100', text: 'text-green-700', icon: CheckCircle2 },
  pending_payment: { bg: 'bg-amber-100', text: 'text-amber-700', icon: Clock },
  cancelled: { bg: 'bg-red-100', text: 'text-red-700', icon: XCircle },
  expired: { bg: 'bg-zinc-100', text: 'text-zinc-500', icon: AlertCircle },
  refunded: { bg: 'bg-orange-100', text: 'text-orange-700', icon: AlertCircle },
};

// ─── Status Badge ────────────────────────────────────────────────────────────

function StatusBadge({ status, t }: { status: OrderStatus; t: (key: string) => string }) {
  const style = STATUS_STYLE[status] ?? STATUS_STYLE.pending;
  const Icon = style.icon;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-xs rounded-full px-sm py-xxs text-[10px] font-semibold',
        style.bg,
        style.text,
      )}
    >
      <Icon className='h-3 w-3' />
      {t(STATUS_KEY_MAP[status])}
    </span>
  );
}

// ─── Payment Status Indicator ────────────────────────────────────────────────

function PaymentIndicator({ order, t }: { order: MerchantOrder; t: (key: string) => string }) {
  const method = order.paymentDetails?.method;
  const paymentStatus = order.paymentStatus;

  if (method === 'online') {
    if (paymentStatus === 'completed' || paymentStatus === 'paid') {
      return (
        <span className='inline-flex items-center gap-xs text-[10px] font-medium text-green-700 bg-green-50 border border-green-200 rounded-full px-sm py-xxs'>
          <CheckCircle2 className='h-2.5 w-2.5' />
          {t('paymentPaid')}
        </span>
      );
    }
    if (paymentStatus === 'failed') {
      return (
        <span className='inline-flex items-center gap-xs text-[10px] font-medium text-red-700 bg-red-50 border border-red-200 rounded-full px-sm py-xxs'>
          <XCircle className='h-2.5 w-2.5' />
          {t('paymentFailed')}
        </span>
      );
    }
    if (paymentStatus === 'refunded') {
      return (
        <span className='inline-flex items-center gap-xs text-[10px] font-medium text-orange-700 bg-orange-50 border border-orange-200 rounded-full px-sm py-xxs'>
          <AlertCircle className='h-2.5 w-2.5' />
          {t('paymentRefunded')}
        </span>
      );
    }
    return (
      <span className='inline-flex items-center gap-xs text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-sm py-xxs'>
        <Clock className='h-2.5 w-2.5' />
        {t('paymentAwaitingPayment')}
      </span>
    );
  }

  return (
    <span className='inline-flex items-center gap-xs text-[10px] font-medium text-muted-foreground bg-muted rounded-full px-sm py-xxs'>
      <Banknote className='h-2.5 w-2.5' />
      {t('paymentPayAtPickup')}
    </span>
  );
}

// ─── Order Card ──────────────────────────────────────────────────────────────

interface OrderCardProps {
  order: MerchantOrder;
  onClick: () => void;
  t: (key: string, values?: Record<string, string | number>) => string;
}

function OrderCard({ order, onClick, t }: OrderCardProps) {
  const total = order.pricing?.total ?? 0;
  const currency = order.pricing?.currency ?? 'TND';
  const customer = order.customerId;
  const pickupCode = order.pickupDetails?.pickupCode;
  const isActive = !isHistoryOrder(order.status);

  return (
    <button
      onClick={onClick}
      className='w-full text-start rounded-xl border border-border bg-card p-3.5 hover:border-primary/30 hover:shadow-sm transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
    >
      {/* Top row: order number + status */}
      <div className='flex items-center justify-between gap-sm'>
        <span className='text-xs font-bold text-foreground'>#{order.orderNumber}</span>
        <StatusBadge status={order.status} t={t} />
      </div>

      {/* Customer + amount */}
      <div className='flex items-center justify-between mt-sm'>
        <div className='flex items-center gap-1.5 min-w-0'>
          <User className='h-3 w-3 text-muted-foreground shrink-0' />
          <span className='text-xs text-foreground truncate'>{getCustomerName(customer)}</span>
        </div>
        <span className='text-sm font-bold text-foreground shrink-0'>
          {formatCurrency(total, currency)}
        </span>
      </div>

      {/* Items summary */}
      <p className='mt-1.5 text-[10px] text-muted-foreground truncate'>
        {order.items.map(i => `${i.quantity}× ${i.offerTitle}`).join(', ')}
      </p>

      {/* Bottom row: payment status + time + pickup code */}
      <div className='flex items-center justify-between mt-2.5 gap-sm'>
        <PaymentIndicator order={order} t={t} />
        <span className='text-[10px] text-muted-foreground shrink-0'>
          {formatRelativeTime(order.createdAt)}
        </span>
      </div>

      {/* Pickup code for active orders */}
      {isActive && pickupCode && (
        <div className='mt-2.5 pt-2.5 border-t border-border/60'>
          <div className='flex items-center gap-1.5'>
            <span className='text-[10px] font-semibold uppercase tracking-wider text-primary/70'>
              {t('pickupCode')}:
            </span>
            <div className='flex gap-xs'>
              {pickupCode.split('').map((d, i) => (
                <span
                  key={i}
                  className='w-5 h-6 rounded bg-primary/5 border border-primary/20 flex items-center justify-center text-xs font-black text-foreground'
                >
                  {d}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </button>
  );
}

// ─── Order Column ────────────────────────────────────────────────────────────

const HISTORY_PAGE_SIZE = 10;

interface OrderColumnProps {
  title: string;
  icon: React.ReactNode;
  activeOrders: MerchantOrder[];
  historyOrders: MerchantOrder[];
  showHistory: boolean;
  isLoading: boolean;
  onSelectOrder: (order: MerchantOrder) => void;
  t: (key: string, values?: Record<string, string | number>) => string;
}

function OrderColumn({
  title,
  icon,
  activeOrders,
  historyOrders,
  showHistory,
  isLoading,
  onSelectOrder,
  t,
}: OrderColumnProps) {
  const [historyPage, setHistoryPage] = useState(1);

  /*
   * Toggling history back on starts at page 1 rather than wherever the merchant
   * had paged to. Adjusted during render so the first page is what gets
   * painted - the effect version rendered the stale page number once, then
   * corrected it.
   */
  const [lastShowHistory, setLastShowHistory] = useState(showHistory);
  if (lastShowHistory !== showHistory) {
    setLastShowHistory(showHistory);
    setHistoryPage(1);
  }

  const totalHistoryPages = Math.max(1, Math.ceil(historyOrders.length / HISTORY_PAGE_SIZE));
  const paginatedHistory = useMemo(() => {
    const start = (historyPage - 1) * HISTORY_PAGE_SIZE;
    return historyOrders.slice(start, start + HISTORY_PAGE_SIZE);
  }, [historyOrders, historyPage]);

  const totalCount = activeOrders.length + (showHistory ? historyOrders.length : 0);
  const isEmpty = activeOrders.length === 0 && (!showHistory || historyOrders.length === 0);

  return (
    <div className='flex-1 min-w-0 flex flex-col rounded-xl border border-border bg-background overflow-hidden'>
      {/* Column header */}
      <div className='shrink-0 flex items-center gap-sm px-lg py-md border-b border-border bg-muted/30'>
        {icon}
        <h2 className='text-sm font-semibold text-foreground'>{title}</h2>
        <span className='inline-flex items-center justify-center rounded-full text-[10px] font-bold min-w-5 h-5 px-xs bg-primary text-primary-foreground'>
          {totalCount}
        </span>
      </div>

      {/* Order list */}
      <div className='flex-1 overflow-y-auto p-md'>
        {isLoading ? (
          <div className='flex items-center justify-center h-32'>
            <Loader2 className='h-5 w-5 animate-spin text-muted-foreground' />
          </div>
        ) : isEmpty ? (
          <div className='flex flex-col items-center justify-center h-40 px-lg text-center'>
            <Package className='h-8 w-8 text-muted-foreground/40 mb-sm' />
            <p className='text-xs font-medium text-muted-foreground'>{t('noOrders')}</p>
            <p className='text-[10px] text-muted-foreground/70 mt-xs'>{t('noOrdersDesc')}</p>
          </div>
        ) : (
          <>
            {/* Active orders */}
            {activeOrders.length > 0 && (
              <div className='space-y-2.5'>
                {activeOrders.map(order => (
                  <OrderCard
                    key={order._id}
                    order={order}
                    onClick={() => onSelectOrder(order)}
                    t={t}
                  />
                ))}
              </div>
            )}

            {/* History section */}
            {showHistory && historyOrders.length > 0 && (
              <>
                {/* Divider */}
                <div className='flex items-center gap-md my-lg'>
                  <div className='flex-1 h-px bg-border' />
                  <span className='text-[10px] font-semibold uppercase tracking-wider text-muted-foreground'>
                    {t('historySection', { count: historyOrders.length })}
                  </span>
                  <div className='flex-1 h-px bg-border' />
                </div>

                {/* Paginated history cards */}
                <div className='space-y-2.5'>
                  {paginatedHistory.map(order => (
                    <OrderCard
                      key={order._id}
                      order={order}
                      onClick={() => onSelectOrder(order)}
                      t={t}
                    />
                  ))}
                </div>

                {/* Pagination controls */}
                {totalHistoryPages > 1 && (
                  <div className='flex items-center justify-between mt-md pt-md border-t border-border/60'>
                    <button
                      onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
                      disabled={historyPage <= 1}
                      className='h-7 px-2.5 rounded-lg text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-40 disabled:pointer-events-none transition-colors flex items-center gap-xs'
                    >
                      <ChevronLeft className='h-3.5 w-3.5' />
                      {t('paginationPrev')}
                    </button>
                    <span className='text-[10px] text-muted-foreground'>
                      {t('paginationInfo', { current: historyPage, total: totalHistoryPages })}
                    </span>
                    <button
                      onClick={() => setHistoryPage(p => Math.min(totalHistoryPages, p + 1))}
                      disabled={historyPage >= totalHistoryPages}
                      className='h-7 px-2.5 rounded-lg text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-40 disabled:pointer-events-none transition-colors flex items-center gap-xs'
                    >
                      {t('paginationNext')}
                      <ChevronRight className='h-3.5 w-3.5' />
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Pickup Code Block (detail drawer) ───────────────────────────────────────

function PickupCodeBlock({
  code,
  status,
  t,
}: {
  code: string | undefined;
  status: OrderStatus;
  t: (key: string) => string;
}) {
  const digits = (code ?? '------').split('');

  return (
    <div className='rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 p-lg'>
      <p className='text-[10px] font-semibold uppercase tracking-widest text-primary/70 text-center mb-md'>
        {t('pickupCode')}
      </p>

      <div className='flex justify-center gap-sm'>
        {digits.map((d, i) => (
          <div
            key={i}
            className='w-9 h-11 rounded-lg bg-background border-2 border-primary/20 flex items-center justify-center shadow-sm'
          >
            <span className='text-xl font-black tracking-tighter text-foreground'>{d}</span>
          </div>
        ))}
      </div>

      <p className='mt-md text-center text-[10px] text-muted-foreground'>{t('pickupCodeHint')}</p>

      <div className='mt-lg'>
        {status === 'picked_up' || status === 'completed' ? (
          <div className='flex items-center justify-center gap-sm rounded-lg bg-green-50 border border-green-200 py-2.5 px-lg'>
            <CheckCircle2 className='h-4 w-4 text-green-600 shrink-0' />
            <span className='text-xs font-semibold text-green-700'>{t('confirmedPickup')}</span>
          </div>
        ) : (
          <div className='flex items-center justify-center gap-sm rounded-lg bg-amber-50 border border-amber-200 py-2.5 px-lg'>
            <span className='relative flex h-2.5 w-2.5 shrink-0'>
              <span className='animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75' />
              <span className='relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500' />
            </span>
            <span className='text-xs font-medium text-amber-700'>{t('waitingPickup')}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Cancel Dialog ───────────────────────────────────────────────────────────

interface CancelDialogProps {
  orderId: string;
  orderNumber: string;
  onClose: () => void;
  onCancelled: () => void;
  t: (key: string) => string;
}

function CancelDialog({ orderId, orderNumber, onClose, onCancelled, t }: CancelDialogProps) {
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
    <div className='fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-lg'>
      <div className='w-full max-w-sm rounded-2xl bg-background shadow-xl border border-border p-2xl'>
        <div className='flex items-center gap-md mb-lg'>
          <div className='h-9 w-9 rounded-full bg-red-100 flex items-center justify-center shrink-0'>
            <Ban className='h-4 w-4 text-red-600' />
          </div>
          <div>
            <h3 className='text-sm font-semibold text-foreground'>
              {t('cancelConfirmTitle')} #{orderNumber}
            </h3>
            <p className='text-xs text-muted-foreground mt-xxs'>{t('cancelConfirmDesc')}</p>
          </div>
        </div>

        <textarea
          className='w-full rounded-lg border border-input bg-background px-md py-sm text-xs resize-none focus:outline-none focus:ring-1 focus:ring-ring'
          rows={3}
          placeholder={t('cancelReasonPlaceholder')}
          value={reason}
          onChange={e => setReason(e.target.value)}
        />

        <div className='flex gap-sm mt-lg'>
          <button
            onClick={onClose}
            className='flex-1 h-8 rounded-lg border border-border text-xs font-medium hover:bg-accent transition-colors'
          >
            {t('cancelDismiss')}
          </button>
          <button
            onClick={handleConfirm}
            disabled={!reason.trim() || isPending}
            className='flex-1 h-8 rounded-lg bg-destructive text-destructive-foreground text-xs font-semibold hover:bg-destructive/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5'
          >
            {isPending && <Loader2 className='h-3 w-3 animate-spin' />}
            {t('cancelConfirm')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Order Detail Drawer ─────────────────────────────────────────────────────

interface OrderDrawerProps {
  orderId: string | null;
  open: boolean;
  onClose: () => void;
  t: (key: string, values?: Record<string, string | number>) => string;
}

function OrderDrawer({ orderId, open, onClose, t }: OrderDrawerProps) {
  const { data: order, isLoading } = useOrderDetail(orderId);
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  if (!open) return null;

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={v => {
        if (!v) onClose();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className='fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0' />
        <DialogPrimitive.Content
          className='fixed inset-y-0 end-0 z-50 w-full max-w-md border-s border-border bg-background shadow-xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right duration-300 flex flex-col'
          aria-describedby={undefined}
        >
          {/* Header */}
          <div className='shrink-0 flex items-center justify-between px-2xl py-lg border-b border-border'>
            <DialogPrimitive.Title className='text-base font-bold text-foreground'>
              {t('orderDetails')}
            </DialogPrimitive.Title>
            <DialogPrimitive.Close className='rounded-lg p-1.5 hover:bg-accent transition-colors'>
              <X className='h-4 w-4' />
              <span className='sr-only'>{t('close')}</span>
            </DialogPrimitive.Close>
          </div>

          {/* Content */}
          <div className='flex-1 overflow-y-auto'>
            {isLoading ? (
              <div className='flex items-center justify-center h-48'>
                <Loader2 className='h-6 w-6 animate-spin text-muted-foreground' />
              </div>
            ) : !order ? (
              <div className='flex items-center justify-center h-48 p-4xl text-center'>
                <div>
                  <AlertCircle className='h-8 w-8 text-muted-foreground mx-auto mb-sm' />
                  <p className='text-sm text-muted-foreground'>Order not found</p>
                </div>
              </div>
            ) : (
              <OrderDetailContent order={order} t={t} onCancel={() => setShowCancelDialog(true)} />
            )}
          </div>

          {/* Cancel dialog */}
          {showCancelDialog && order && (
            <CancelDialog
              orderId={order._id}
              orderNumber={order.orderNumber}
              onClose={() => setShowCancelDialog(false)}
              onCancelled={() => setShowCancelDialog(false)}
              t={t}
            />
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

// ─── Order Detail Content ────────────────────────────────────────────────────

function OrderDetailContent({
  order,
  t,
  onCancel,
}: {
  order: MerchantOrder;
  t: (key: string, values?: Record<string, string | number>) => string;
  onCancel: () => void;
}) {
  const customer = order.customerId;
  const isActive = !isHistoryOrder(order.status);
  const pickupCode = order.pickupDetails?.pickupCode;
  const currency = order.pricing?.currency ?? 'TND';
  const canCancel = isActive && order.status !== 'picked_up' && order.status !== 'completed';

  return (
    <div className='p-2xl space-y-xl'>
      {/* Order header with status + payment method */}
      <div className='flex items-start justify-between gap-md'>
        <div>
          <h3 className='text-base font-bold text-foreground'>#{order.orderNumber}</h3>
          <p className='text-xs text-muted-foreground mt-xxs'>
            {formatRelativeTime(order.createdAt)}
          </p>
        </div>
        <div className='flex flex-col items-end gap-1.5'>
          <StatusBadge status={order.status} t={t} />
          <PaymentIndicator order={order} t={t} />
        </div>
      </div>

      {/* Payment method badge */}
      <div className='flex items-center gap-sm rounded-lg bg-muted/50 px-md py-2.5 border border-border'>
        {isOnlinePayment(order) ? (
          <>
            <CreditCard className='h-4 w-4 text-blue-600' />
            <span className='text-xs font-medium text-foreground'>{t('paymentMethodOnline')}</span>
          </>
        ) : (
          <>
            <Banknote className='h-4 w-4 text-green-600' />
            <span className='text-xs font-medium text-foreground'>{t('paymentMethodCash')}</span>
          </>
        )}
      </div>

      {/* Pickup code for active orders */}
      {isActive && <PickupCodeBlock code={pickupCode} status={order.status} t={t} />}

      {/* Picked-up confirmation banner */}
      {(order.status === 'picked_up' || order.status === 'completed') && (
        <div className='flex items-center gap-sm rounded-xl bg-green-50 border border-green-200 px-lg py-md'>
          <CheckCircle2 className='h-4 w-4 text-green-600 shrink-0' />
          <span className='text-xs font-semibold text-green-700'>{t('confirmedPickup')}</span>
        </div>
      )}

      {/* Customer info */}
      <section>
        <h3 className='text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-sm flex items-center gap-1.5'>
          <User className='h-3.5 w-3.5' />
          {t('customer')}
        </h3>
        <div className='rounded-xl border border-border bg-card p-md space-y-1.5'>
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
        <h3 className='text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-sm flex items-center gap-1.5'>
          <ShoppingBag className='h-3.5 w-3.5' />
          {t('items')}
        </h3>
        <div className='rounded-xl border border-border bg-card divide-y divide-border'>
          {order.items.map((item, idx) => (
            <div key={idx} className='flex items-center justify-between px-md py-2.5 gap-md'>
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
        <h3 className='text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-sm'>
          {t('pricing')}
        </h3>
        <div className='rounded-xl border border-border bg-card p-md space-y-1.5'>
          {[
            { label: t('subtotal'), value: order.pricing?.subtotal },
            {
              label: t('discount'),
              value: order.pricing?.discountAmount ? -order.pricing.discountAmount : null,
            },
            { label: t('tax'), value: order.pricing?.taxAmount },
            { label: t('deliveryFee'), value: order.pricing?.deliveryFee },
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
          <div className='pt-1.5 mt-xs border-t border-border flex items-center justify-between'>
            <span className='text-sm font-bold text-foreground'>{t('total')}</span>
            <span className='text-sm font-black text-foreground'>
              {formatCurrency(order.pricing?.total ?? 0, currency)}
            </span>
          </div>
        </div>
      </section>

      {/* Pickup instructions */}
      {order.pickupDetails?.instructions && (
        <section>
          <h3 className='text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-sm'>
            {t('instructions')}
          </h3>
          <div className='rounded-xl border border-border bg-card px-md py-2.5 text-xs text-foreground'>
            {order.pickupDetails.instructions}
          </div>
        </section>
      )}

      {/* Payment status */}
      <section>
        <div className='flex items-center justify-between text-xs'>
          <span className='text-muted-foreground'>{t('paymentStatus')}</span>
          <span className='font-semibold capitalize text-foreground'>{order.paymentStatus}</span>
        </div>
      </section>

      {/* Cancel button */}
      {canCancel && (
        <button
          onClick={onCancel}
          className='w-full h-9 rounded-lg bg-destructive/10 text-destructive text-xs font-semibold hover:bg-destructive/20 transition-colors flex items-center justify-center gap-1.5'
        >
          <Ban className='h-3.5 w-3.5' />
          {t('cancelOrder')}
        </button>
      )}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function MerchantOrdersPage() {
  const t = useTranslations('dashboard.merchantOrders');
  const [search, setSearch] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { data, isLoading } = useMerchantOrders();
  const allOrders = useMemo(() => data?.orders ?? [], [data]);
  const markRead = useNotificationStore(s => s.markRead);
  const markAllRead = useNotificationStore(s => s.markAllRead);

  useEffect(() => {
    markAllRead();
  }, [markAllRead]);

  // Apply search filter
  const searchedOrders = useMemo(() => {
    if (!search.trim()) return allOrders;
    const q = search.toLowerCase();
    return allOrders.filter(
      o =>
        o.orderNumber.toLowerCase().includes(q) ||
        getCustomerName(o.customerId).toLowerCase().includes(q),
    );
  }, [allOrders, search]);

  // Split into active vs history, then cash vs online
  const { cashActive, cashHistory, onlineActive, onlineHistory } = useMemo(() => {
    const cA: MerchantOrder[] = [];
    const cH: MerchantOrder[] = [];
    const oA: MerchantOrder[] = [];
    const oH: MerchantOrder[] = [];
    for (const o of searchedOrders) {
      const online = isOnlinePayment(o);
      const history = isHistoryOrder(o.status);
      if (online) {
        if (history) oH.push(o);
        else oA.push(o);
      } else {
        if (history) cH.push(o);
        else cA.push(o);
      }
    }
    return { cashActive: cA, cashHistory: cH, onlineActive: oA, onlineHistory: oH };
  }, [searchedOrders]);

  // Stats
  const stats = useMemo(() => {
    const active = allOrders.filter(o => !isHistoryOrder(o.status)).length;
    const awaitingPickup = allOrders.filter(
      o => o.status === 'confirmed' || o.status === 'ready_for_pickup',
    ).length;
    const completedToday = allOrders.filter(
      o => o.status === 'completed' && isTodayOrder(o.updatedAt),
    ).length;
    return { active, awaitingPickup, completedToday };
  }, [allOrders]);

  const handleSelectOrder = useCallback(
    (order: MerchantOrder) => {
      setSelectedOrderId(order._id);
      setDrawerOpen(true);
      markRead(order._id);
    },
    [markRead],
  );

  const handleCloseDrawer = useCallback(() => {
    setDrawerOpen(false);
    setSelectedOrderId(null);
  }, []);

  return (
    <div className='h-full flex flex-col gap-lg'>
      {/* Page header */}
      <div className='shrink-0 flex items-center justify-between'>
        <div>
          <h1 className='font-display text-lg font-bold tracking-tight text-foreground flex items-center gap-sm'>
            {t('title')}
            <span className='inline-flex items-center gap-xs text-[10px] font-medium text-green-600 bg-green-50 border border-green-200 rounded-full px-sm py-xxs'>
              <span className='relative flex h-1.5 w-1.5'>
                <span className='animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75' />
                <span className='relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500' />
              </span>
              <Wifi className='h-2.5 w-2.5' />
              {t('liveIndicator')}
            </span>
          </h1>
          <p className='text-xs text-muted-foreground mt-xxs'>{t('description')}</p>
        </div>
        <LocationSwitcher />
      </div>

      {/* Stats bar */}
      <div className='shrink-0 flex items-center gap-md flex-wrap'>
        <div className='inline-flex items-center gap-1.5 rounded-lg bg-blue-50 border border-blue-200 px-md py-1.5'>
          <Package className='h-3.5 w-3.5 text-blue-600' />
          <span className='text-xs font-semibold text-blue-700'>
            {t('statsActive', { count: stats.active })}
          </span>
        </div>
        <div className='inline-flex items-center gap-1.5 rounded-lg bg-amber-50 border border-amber-200 px-md py-1.5'>
          <Clock className='h-3.5 w-3.5 text-amber-600' />
          <span className='text-xs font-semibold text-amber-700'>
            {t('statsAwaitingPickup', { count: stats.awaitingPickup })}
          </span>
        </div>
        <div className='inline-flex items-center gap-1.5 rounded-lg bg-green-50 border border-green-200 px-md py-1.5'>
          <CheckCircle2 className='h-3.5 w-3.5 text-green-600' />
          <span className='text-xs font-semibold text-green-700'>
            {t('statsCompletedToday', { count: stats.completedToday })}
          </span>
        </div>
      </div>

      {/* Search + history toggle */}
      <div className='shrink-0 flex items-center gap-md'>
        <div className='relative flex-1 max-w-sm'>
          <Search className='absolute start-md top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none' />
          <input
            type='search'
            className='w-full h-9 rounded-lg border border-input bg-background ps-5xl pe-md text-xs focus:outline-none focus:ring-1 focus:ring-ring'
            placeholder={t('searchPlaceholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <label className='inline-flex items-center gap-sm cursor-pointer select-none'>
          <input
            type='checkbox'
            checked={showHistory}
            onChange={e => setShowHistory(e.target.checked)}
            className='rounded border-border h-4 w-4 text-primary focus:ring-ring'
          />
          <span className='text-xs font-medium text-muted-foreground'>{t('showHistory')}</span>
        </label>
      </div>

      {/* Two-column layout */}
      <div className='flex-1 min-h-0 flex gap-lg'>
        <OrderColumn
          title={t('columnCash')}
          icon={<Banknote className='h-4 w-4 text-green-600' />}
          activeOrders={cashActive}
          historyOrders={cashHistory}
          showHistory={showHistory}
          isLoading={isLoading}
          onSelectOrder={handleSelectOrder}
          t={t}
        />
        <OrderColumn
          title={t('columnOnline')}
          icon={<CreditCard className='h-4 w-4 text-blue-600' />}
          activeOrders={onlineActive}
          historyOrders={onlineHistory}
          showHistory={showHistory}
          isLoading={isLoading}
          onSelectOrder={handleSelectOrder}
          t={t}
        />
      </div>

      {/* Detail drawer */}
      <OrderDrawer orderId={selectedOrderId} open={drawerOpen} onClose={handleCloseDrawer} t={t} />
    </div>
  );
}
