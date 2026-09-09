'use client';

import { useState } from 'react';
import { Edit3, Trash2, RotateCcw, Zap, Lock, AlertCircle } from 'lucide-react';
import { cn } from '@foodwaste/ui';
import type { MerchantOffer } from '@/types/dashboard';

// ─── Constants ───────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  surprise_bag: 'Surprise Bag',
  specific_items: 'Specific Item',
  meal_deal: 'Meal Deal',
  parcels_bag: 'Parcels Bag',
};

const STATUS_CONFIG: Record<string, { label: string; badge: string }> = {
  draft: { label: 'Draft', badge: 'bg-slate-100 text-slate-600 border-slate-200' },
  active: { label: 'Active', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  sold_out: { label: 'Sold Out', badge: 'bg-red-50 text-red-600 border-red-200' },
  expired: { label: 'Expired', badge: 'bg-amber-50 text-amber-700 border-amber-200' },
  cancelled: { label: 'Cancelled', badge: 'bg-slate-100 text-slate-500 border-slate-200' },
  suspended: { label: 'Suspended', badge: 'bg-rose-50 text-rose-700 border-rose-200' },
};

const PROGRESS_COLOR: Record<string, string> = {
  available: 'bg-emerald-500',
  low_stock: 'bg-amber-400',
  sold_out: 'bg-red-400',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return `TND ${n.toFixed(3)}`;
}

function pickupLabel(offer: MerchantOffer): string {
  const slot = offer.pickupTimeSlots?.[0];
  if (!slot) return '';
  const day = offer.isPickupToday ? 'Today' : offer.isPickupTomorrow ? 'Tomorrow' : '';
  return [day, `${slot.startTime} – ${slot.endTime}`].filter(Boolean).join(' · ');
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface OfferCardProps {
  offer: MerchantOffer;
  isEstablishmentApproved: boolean;
  isPending: boolean;
  onPublish: () => void;
  onMarkSoldOut: () => void;
  onCancelOffer: () => void;
  onDelete: () => void;
  onReactivate: () => void;
  onEdit: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function OfferCard({
  offer,
  isEstablishmentApproved,
  isPending,
  onPublish,
  onMarkSoldOut,
  onCancelOffer,
  onDelete,
  onReactivate,
  onEdit,
}: OfferCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [imgError, setImgError] = useState(false);

  const cfg = (STATUS_CONFIG[offer.status] ?? STATUS_CONFIG['draft'])!;

  const isDraft = offer.status === 'draft';
  const isInactive = ['expired', 'cancelled', 'sold_out', 'suspended'].includes(offer.status);

  // Revenue: only if soldQuantity is available from the backend
  const revenue =
    offer.soldQuantity != null ? offer.soldQuantity * offer.pricing.discountedPrice : null;

  // Progress bar %
  const soldPct =
    offer.soldQuantity != null && offer.totalQuantity != null && offer.totalQuantity > 0
      ? Math.round((offer.soldQuantity / offer.totalQuantity) * 100)
      : null;

  const pickup = pickupLabel(offer);

  // ── Shared button styles ────────────────────────────────────────────────
  const btn =
    'inline-flex items-center gap-1.5 h-6 px-md rounded-full text-[11px] font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed';
  const prim = 'bg-primary text-white hover:opacity-90 active:scale-[0.97]';
  const sec =
    'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 active:scale-[0.97]';
  const warn =
    'bg-white border border-amber-200 text-amber-700 hover:bg-amber-50 active:scale-[0.97]';
  const dang = 'bg-white border border-red-200 text-red-500 hover:bg-red-50 active:scale-[0.97]';
  const ghost = 'bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed';

  /*
   * A render helper, not a component.
   *
   * Declared inside OfferCard and rendered as <Actions />, React saw a new
   * component type on every parent render and remounted the whole action bar -
   * losing focus and any transition mid-flight. It holds no state and calls no
   * hooks, so calling it as a plain function inlines the same JSX with none of
   * that. Extracting it to module scope would mean threading eight props
   * through for no benefit.
   */
  function renderActions() {
    if (offer.status === 'draft') {
      return (
        <>
          {isEstablishmentApproved ? (
            <button
              type='button'
              disabled={isPending}
              onClick={onPublish}
              className={cn(btn, prim)}
            >
              <Zap className='h-3 w-3' /> Publish Now
            </button>
          ) : (
            <button type='button' disabled className={cn(btn, ghost)}>
              <Lock className='h-3 w-3' /> Publish — needs approval
            </button>
          )}
          <button type='button' onClick={onEdit} className={cn(btn, sec)}>
            <Edit3 className='h-3 w-3' /> Edit
          </button>
          <button
            type='button'
            onClick={() => setConfirmDelete(true)}
            className={cn(btn, dang, 'ms-auto')}
            aria-label='Delete offer'
          >
            <Trash2 className='h-3 w-3' />
          </button>
        </>
      );
    }

    if (offer.status === 'active') {
      return (
        <>
          <button
            type='button'
            disabled={isPending}
            onClick={onMarkSoldOut}
            className={cn(btn, warn)}
          >
            Mark Sold Out
          </button>
          <button
            type='button'
            disabled={isPending}
            onClick={() => setConfirmCancel(true)}
            className={cn(btn, sec)}
          >
            Stop Sales
          </button>
          <button type='button' onClick={onEdit} className={cn(btn, sec)}>
            <Edit3 className='h-3 w-3' /> Edit
          </button>
          <button
            type='button'
            onClick={() => setConfirmDelete(true)}
            className={cn(btn, dang, 'ms-auto')}
            aria-label='Delete offer'
          >
            <Trash2 className='h-3 w-3' />
          </button>
        </>
      );
    }

    if (['sold_out', 'expired', 'cancelled'].includes(offer.status)) {
      return (
        <>
          <button
            type='button'
            disabled={isPending}
            onClick={onReactivate}
            className={cn(btn, prim)}
          >
            <RotateCcw className='h-3 w-3' /> Reactivate
          </button>
          <button
            type='button'
            onClick={() => setConfirmDelete(true)}
            className={cn(btn, dang, 'ms-auto')}
            aria-label='Delete offer'
          >
            <Trash2 className='h-3 w-3' />
          </button>
        </>
      );
    }

    if (offer.status === 'suspended') {
      return (
        <>
          <span className='flex items-center gap-1.5 text-[11px] text-rose-600'>
            <AlertCircle className='h-3.5 w-3.5 shrink-0' />
            Suspended by admin · Contact support to resolve
          </span>
          <button
            type='button'
            onClick={() => setConfirmDelete(true)}
            className={cn(btn, dang, 'ms-auto')}
            aria-label='Delete offer'
          >
            <Trash2 className='h-3 w-3' />
          </button>
        </>
      );
    }

    return null;
  }

  return (
    <div
      className={cn(
        'bg-white rounded-xl border overflow-hidden',
        'transition-shadow duration-150 hover:shadow-md',
        isDraft
          ? 'border-red-300 border-dashed border-2 hover:border-red-400'
          : 'border-slate-200 hover:border-slate-300',
        isInactive && 'opacity-75',
      )}
    >
      {/* ── Draft banner ── */}
      {isDraft && (
        <div className='flex items-center gap-1.5 px-lg py-1.5 bg-red-50 border-b border-dashed border-red-200'>
          <AlertCircle className='h-3 w-3 text-red-500 shrink-0' />
          <span className='text-[11px] font-semibold text-red-600'>
            Not published — invisible to customers
          </span>
        </div>
      )}

      {/* ── Card body ── */}
      <div className='flex gap-lg p-lg'>
        {/* Image */}
        <div className='w-[72px] h-[72px] shrink-0 rounded-lg overflow-hidden border border-slate-200 bg-slate-100'>
          {offer.image && !imgError ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={offer.image}
              alt={offer.title}
              className={cn('w-full h-full object-cover', isInactive && 'grayscale-[30%]')}
              onError={() => setImgError(true)}
            />
          ) : (
            <div className='w-full h-full flex items-center justify-center bg-primary/10'>
              <span className='text-lg font-bold text-primary'>
                {offer.title.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className='flex-1 min-w-0'>
          {/* Row 1 — Title + status badge */}
          <div className='flex items-start justify-between gap-sm min-w-0'>
            <p className='text-sm font-bold text-slate-900 leading-tight truncate'>{offer.title}</p>
            <span
              className={cn(
                'shrink-0 flex items-center gap-xs px-sm py-xxs rounded-full text-[10px] font-bold border',
                cfg.badge,
              )}
            >
              <span className='h-1.5 w-1.5 rounded-full bg-current' />
              {cfg.label}
            </span>
          </div>

          {/* Row 2 — Type · pickup */}
          <p className='text-xs text-slate-500 mt-xxs truncate'>
            {TYPE_LABELS[offer.type] ?? offer.type}
            {pickup && <> &middot; {pickup}</>}
          </p>

          {/* Row 3 — Pricing + bags left */}
          <div className='flex items-center gap-sm mt-1.5 flex-wrap'>
            <span className='font-display font-bold text-sm text-white bg-primary-500 px-2.5 py-xxs rounded-full tabular-nums'>
              {fmt(offer.pricing.discountedPrice)}
            </span>
            <span className='text-xs text-slate-400 line-through tabular-nums'>
              {fmt(offer.pricing.originalPrice)}
            </span>
            <span className='px-sm py-xxs rounded-full bg-primary-500/10 text-[11px] font-bold text-primary-500 border border-primary-500/20'>
              -{offer.pricing.discountPercentage}%
            </span>
            {offer.soldQuantity != null && offer.totalQuantity != null ? (
              <span className='text-xs text-slate-500 tabular-nums'>
                📦 {offer.soldQuantity}/{offer.totalQuantity} sold
              </span>
            ) : (
              <span className='text-xs text-slate-500 tabular-nums'>
                📦 {offer.availableQuantity} bag{offer.availableQuantity !== 1 ? 's' : ''} left
              </span>
            )}
            {offer.ctaState === 'low_stock' && (
              <span className='px-1.5 py-xxs rounded-full text-[10px] font-bold bg-amber-50 text-amber-600 border border-amber-200'>
                Low Stock
              </span>
            )}
          </div>

          {/* Row 4 — Revenue */}
          {revenue !== null && (
            <div className='mt-xs'>
              <span className='text-xs font-semibold text-emerald-700 tabular-nums'>
                💰 {fmt(revenue)} earned
              </span>
            </div>
          )}

          {/* Progress bar — only when we have exact numbers */}
          {soldPct !== null && (
            <div className='mt-2.5 h-1.5 rounded-full bg-slate-100 overflow-hidden'>
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-500',
                  PROGRESS_COLOR[offer.ctaState] ?? 'bg-emerald-500',
                )}
                style={{ width: `${soldPct}%` }}
              />
            </div>
          )}
        </div>
      </div>

      {/* ── Action bar ── */}
      <div className='flex items-center gap-sm px-lg py-2.5 border-t border-slate-100 bg-slate-50/60 flex-wrap'>
        {renderActions()}
      </div>

      {/* ── Inline delete confirm ── */}
      {confirmDelete && (
        <div className='flex items-center justify-between gap-md px-lg py-md bg-red-50 border-t border-red-200'>
          <p className='text-xs text-red-700 font-medium'>Delete this offer permanently?</p>
          <div className='flex gap-sm'>
            <button
              type='button'
              onClick={() => setConfirmDelete(false)}
              className={cn(btn, sec, 'text-[11px]')}
            >
              Keep it
            </button>
            <button
              type='button'
              onClick={() => {
                setConfirmDelete(false);
                onDelete();
              }}
              className='inline-flex items-center h-6 px-md rounded-full text-[11px] font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors'
            >
              Yes, delete
            </button>
          </div>
        </div>
      )}

      {/* ── Inline stop-sales confirm ── */}
      {confirmCancel && (
        <div className='flex items-center justify-between gap-md px-lg py-md bg-amber-50 border-t border-amber-200'>
          <p className='text-xs text-amber-800 font-medium'>
            Stop this active offer? Customers won&apos;t see it anymore.
          </p>
          <div className='flex gap-sm'>
            <button
              type='button'
              onClick={() => setConfirmCancel(false)}
              className={cn(btn, sec, 'text-[11px]')}
            >
              Keep it live
            </button>
            <button
              type='button'
              onClick={() => {
                setConfirmCancel(false);
                onCancelOffer();
              }}
              className='inline-flex items-center h-6 px-md rounded-full text-[11px] font-semibold bg-amber-600 text-white hover:bg-amber-700 transition-colors'
            >
              Stop sales
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
