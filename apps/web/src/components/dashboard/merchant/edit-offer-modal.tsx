'use client';

import { useEffect, useState } from 'react';
import { Pencil } from 'lucide-react';

import { cn } from '@/lib/utils';

import type { MerchantOffer, UpdateOfferPayload } from '@/types/dashboard';

/**
 * Correct an offer that is already published.
 *
 * The Edit buttons on the offer card were rendered with no onClick at all — a
 * merchant who mistyped a price could only cancel the offer and post it again,
 * losing its place in the listings. This opens on the offer's current values, so
 * the common case is changing one field and saving.
 *
 * Deliberately narrower than the create panel: title, price, discount and
 * quantity. Not description — the offers list does not return it, so the field
 * would open empty and saving would wipe the real one. Not the pickup window
 * either — moving that on a live offer changes when a customer who already
 * reserved has to turn up, which belongs to the reactivate flow. Images have
 * their own endpoint.
 *
 * Only changed fields are sent. UpdateOfferDto extends PartialType(CreateOfferDto),
 * so an untouched field is simply absent — two merchants correcting different
 * things cannot overwrite each other.
 */

const DISCOUNT_OPTIONS = [40, 50, 55, 60, 65, 70, 80, 90] as const;

/** Discount that best matches the offer's current prices, snapped to the options. */
function currentDiscount(offer: MerchantOffer): number {
  const { originalPrice: op, discountedPrice: dp } = offer.pricing;
  if (op <= 0) return 50;
  const pct = Math.round(((op - dp) / op) * 100);
  return DISCOUNT_OPTIONS.reduce((prev, curr) =>
    Math.abs(curr - pct) < Math.abs(prev - pct) ? curr : prev,
  );
}

export interface EditOfferModalProps {
  offer: MerchantOffer;
  isPending: boolean;
  onClose: () => void;
  onConfirm: (payload: UpdateOfferPayload) => void;
  t: (key: string, values?: Record<string, string | number | Date>) => string;
}

export function EditOfferModal({ offer, isPending, onClose, onConfirm, t }: EditOfferModalProps) {
  const [title, setTitle] = useState(offer.title);
  const [quantity, setQuantity] = useState(offer.totalQuantity ?? 1);
  // Kept as the raw string so a half-typed "12." does not snap back to 12 mid-edit.
  const [rawOriginalPrice, setRawOriginalPrice] = useState(offer.pricing.originalPrice.toFixed(3));
  const [discount, setDiscount] = useState<number>(() => currentDiscount(offer));

  // Escape closes it, which is what anyone expects of a dialog and what the
  // backdrop's click handler cannot offer a keyboard user.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const parsedOriginalPrice = parseFloat(rawOriginalPrice) || 0;
  const discountedPrice = parsedOriginalPrice > 0 ? parsedOriginalPrice * (1 - discount / 100) : 0;

  const trimmedTitle = title.trim();
  const canConfirm = trimmedTitle.length > 0 && parsedOriginalPrice > 0 && quantity > 0;

  function handleConfirm() {
    const payload: UpdateOfferPayload = {};

    if (trimmedTitle !== offer.title) payload.title = trimmedTitle;

    if (quantity !== offer.totalQuantity) payload.totalQuantity = quantity;

    // Compared on the rounded values actually sent, so re-saving an untouched
    // form does not post a pricing change from float noise.
    const nextOriginal = parseFloat(parsedOriginalPrice.toFixed(3));
    const nextDiscounted = parseFloat(discountedPrice.toFixed(3));
    if (
      nextOriginal !== offer.pricing.originalPrice ||
      nextDiscounted !== offer.pricing.discountedPrice
    ) {
      payload.pricing = { originalPrice: nextOriginal, discountedPrice: nextDiscounted };
    }

    onConfirm(payload);
  }

  const field =
    'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500';
  const label = 'text-xs font-semibold text-slate-700';

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center p-4'>
      {/* A button rather than a div with onClick: dismissing by backdrop must be
          reachable without a mouse, and Escape above covers the keyboard path. */}
      <button
        type='button'
        aria-label={t('merchantOffers.editCancel')}
        onClick={onClose}
        className='absolute inset-0 bg-black/40 backdrop-blur-sm'
      />
      <div
        role='dialog'
        aria-modal='true'
        aria-label={t('merchantOffers.editTitle')}
        className='relative bg-white rounded-2xl shadow-2xl w-full max-w-sm flex flex-col max-h-[90vh]'
      >
        <div className='flex items-center gap-2 px-5 py-3 border-b border-slate-100 shrink-0'>
          <Pencil className='h-4 w-4 text-primary-500' />
          <div className='min-w-0'>
            <p className='text-sm font-bold text-slate-900'>{t('merchantOffers.editTitle')}</p>
            <p className='text-xs text-slate-500 mt-0.5 truncate max-w-[220px]'>{offer.title}</p>
          </div>
        </div>

        <div className='flex-1 overflow-y-auto px-5 py-4 space-y-4'>
          <div className='space-y-1.5'>
            <label htmlFor='edit-offer-title' className={label}>
              {t('merchantOffers.editFieldTitle')}
            </label>
            <input
              id='edit-offer-title'
              type='text'
              value={title}
              onChange={e => setTitle(e.target.value)}
              className={field}
              maxLength={100}
            />
          </div>

          <div className='grid grid-cols-2 gap-3'>
            <div className='space-y-1.5'>
              <label htmlFor='edit-offer-price' className={label}>
                {t('merchantOffers.editFieldPrice')}
              </label>
              <input
                id='edit-offer-price'
                type='number'
                inputMode='decimal'
                min={0}
                step={0.1}
                value={rawOriginalPrice}
                onChange={e => setRawOriginalPrice(e.target.value)}
                className={field}
              />
            </div>
            <div className='space-y-1.5'>
              <label htmlFor='edit-offer-quantity' className={label}>
                {t('merchantOffers.editFieldQuantity')}
              </label>
              <input
                id='edit-offer-quantity'
                type='number'
                inputMode='numeric'
                min={1}
                value={quantity}
                onChange={e => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className={field}
              />
            </div>
          </div>

          <div className='space-y-1.5'>
            <span className={label}>{t('merchantOffers.editFieldDiscount')}</span>
            <div className='flex flex-wrap gap-1.5'>
              {DISCOUNT_OPTIONS.map(option => (
                <button
                  key={option}
                  type='button'
                  onClick={() => setDiscount(option)}
                  className={cn(
                    'rounded-lg px-2.5 py-1 text-xs font-semibold border transition-colors',
                    discount === option
                      ? 'border-primary-500 bg-primary-500 text-white'
                      : 'border-slate-200 text-slate-600 hover:border-primary-500/40',
                  )}
                >
                  -{option}%
                </button>
              ))}
            </div>
          </div>

          <div className='rounded-lg bg-slate-50 px-3 py-2.5 flex items-baseline justify-between'>
            <span className='text-xs text-slate-500'>{t('merchantOffers.editCustomerPays')}</span>
            <span className='text-lg font-bold tabular-nums text-primary-500'>
              {discountedPrice.toFixed(3)} <span className='text-xs font-normal'>TND</span>
            </span>
          </div>
        </div>

        <div className='flex gap-2 px-5 py-3 border-t border-slate-100 shrink-0'>
          <button
            type='button'
            onClick={onClose}
            className='flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50'
          >
            {t('merchantOffers.editCancel')}
          </button>
          <button
            type='button'
            onClick={handleConfirm}
            disabled={!canConfirm || isPending}
            className={cn(
              'flex-1 rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              isPending && 'animate-pulse',
            )}
          >
            {isPending ? t('merchantOffers.editSaving') : t('merchantOffers.editSave')}
          </button>
        </div>
      </div>
    </div>
  );
}
