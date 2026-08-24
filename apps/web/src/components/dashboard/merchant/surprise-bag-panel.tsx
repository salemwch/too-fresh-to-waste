'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';
import {
  X,
  Minus,
  Plus,
  ChevronDown,
  AlertCircle,
  CheckCircle2,
  ImagePlus,
  Flame,
} from 'lucide-react';
import { cn } from '@foodwaste/ui';
import { useMyEstablishment, useCreateSurpriseBag } from '@/hooks/use-merchant-dashboard';
import type { CreateSurpriseBagPayload, OfferBagType } from '@/types/dashboard';
import { PriceGuidance } from './price-guidance';

// ─── Constants ────────────────────────────────────────────────────────────────

const MIN_DISCOUNT_PCT = 40;
/** Matches @MinLength(20) on the backend CreateOfferDto. */
const MIN_DESCRIPTION_CHARS = 20;
/** Matches @MinLength(5) on the backend CreateOfferDto title. */
const MIN_TITLE_CHARS = 5;
const MAX_QUANTITY = 100;
const MAX_PRICE = 100;
const DISCOUNT_OPTIONS = [40, 50, 60, 70, 80, 90] as const;
const DEFAULT_PRICE = 10;
const DEFAULT_DISCOUNT = 50;
const TIMEZONE = 'Africa/Tunis';

/**
 * Every label in this panel is resolved through next-intl. The messages carry
 * no compile-time key type in this app, so the translator is passed to the pure
 * helpers below under a narrow alias rather than a full next-intl generic.
 */
type Translate = (key: string, values?: Record<string, string | number>) => string;

const BAG_TYPE_OPTIONS: OfferBagType[] = ['surprise_bag', 'specific_items', 'meal_deal'];

/** 30-minute intervals: 00:00 … 23:30 */
const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2);
  const m = (i % 2) * 30;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
});

/** Until options: 00:30 … 23:30, then 00:00 (midnight = end of day) */
const UNTIL_OPTIONS = [...TIME_OPTIONS.slice(1), '00:00'];

const PICKUP_PRESETS = [
  { key: 'lunch', from: '12:00', until: '14:00' },
  { key: 'dinner', from: '18:00', until: '21:00' },
  { key: 'allDay', from: '08:00', until: '22:00' },
] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Formats a Date as "HH:MM". Used for display only. */
function formatHHMM(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * Returns current local time as an ISO string WITHOUT a Z/offset suffix.
 * e.g. "2026-02-20T23:14:35" (Tunisia local time)
 *
 * This is intentional: TimezoneUtil.toUTC on the backend strips any Z suffix
 * before parsing, so sending a Z-suffixed UTC string would be misinterpreted
 * as local time and end up 1 hour behind. Sending a bare local string ensures
 * the backend correctly converts Tunisia local → UTC.
 */
function nowAsLocalISO(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}

/**
 * Returns FROM time options for today.
 * Buffer reduced to 10 min so merchants aren't punished for opening the app
 * a few minutes before a slot (e.g. 22:05 → still sees 22:30, not 23:00).
 * The special sentinel 'now' is prepended so merchants can start immediately.
 */
function getAvailableFromTimes(day: 'today' | 'tomorrow'): string[] {
  if (day === 'tomorrow') return TIME_OPTIONS;
  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes() + 10; // 10-min buffer
  return TIME_OPTIONS.filter(t => {
    const [h = 0, m = 0] = t.split(':').map(Number);
    return h * 60 + m > nowMins;
  });
}

/** Returns Until options that are strictly after the selected From time.
 *  '00:00' is treated as midnight (24:00) so it always appears when valid. */
function getAvailableUntilTimes(from: string): string[] {
  const now = new Date();
  const fH = from === 'now' ? now.getHours() : Number.parseInt(from.split(':')[0] ?? '0', 10);
  const fM = from === 'now' ? now.getMinutes() : Number.parseInt(from.split(':')[1] ?? '0', 10);
  const fromMins = fH * 60 + fM;
  return UNTIL_OPTIONS.filter(t => {
    const [h = 0, m = 0] = t.split(':').map(Number);
    const tMins = h === 0 && m === 0 ? 24 * 60 : h * 60 + m;
    return tMins > fromMins;
  });
}

function toISO(day: 'today' | 'tomorrow', hour: number, minute = 0, overflow = false) {
  const d = new Date();
  if (day === 'tomorrow') d.setDate(d.getDate() + 1);
  if (overflow) d.setDate(d.getDate() + 1); // midnight "00:00" means next-day 00:00
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

/**
 * The description a customer reads on the offer.
 *
 * One generic sentence used to be generated for all three types, which sold a
 * surprise bag the same way as a named dish. They are not the same promise: a
 * surprise bag's whole appeal is that nobody knows yet what will be left, and a
 * description that glosses over it reads as vague rather than exciting. Each
 * type gets copy that says what that type actually offers.
 *
 * Pre-filled, not imposed — the merchant edits it in the form below. Backend
 * requires 20 characters minimum; all three clear that comfortably.
 */
function autoDescription(t: Translate, type: OfferBagType, title: string, qty: number): string {
  // `autoDescription.*` carries one key per member of the `OfferBagType` union;
  // the i18n suite asserts all three exist in all three locales.
  return t(`autoDescription.${type}`, { title, qty });
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validatePublishForm({
  t,
  establishment,
  pickupFrom,
  pickupUntil,
  parsedPrice,
  discount,
  title,
  description,
}: {
  t: Translate;
  establishment: { _id?: string } | null | undefined;
  pickupFrom: string;
  pickupUntil: string;
  parsedPrice: number;
  discount: number;
  title: string;
  description: string;
}): string | null {
  if (!establishment?._id) return t('errors.establishmentMissing');
  if (!pickupFrom || !pickupUntil) return t('errors.pickupWindowMissing');
  if (parsedPrice <= 0) return t('errors.priceInvalid');
  if (discount < MIN_DISCOUNT_PCT) return t('errors.discountTooLow', { min: MIN_DISCOUNT_PCT });
  if (title.trim().length < MIN_TITLE_CHARS)
    return t('errors.titleTooShort', { min: MIN_TITLE_CHARS });
  // Backend requires 20; catching it here means a cleared box gets a sentence
  // rather than a 400.
  if (description.trim().length < MIN_DESCRIPTION_CHARS)
    return t('errors.descriptionTooShort', { min: MIN_DESCRIPTION_CHARS });
  return null;
}

// ─── Panel ────────────────────────────────────────────────────────────────────

interface SurpriseBagPanelProps {
  open: boolean;
  onClose: () => void;
}

export function SurpriseBagPanel({ open, onClose }: SurpriseBagPanelProps) {
  const t = useTranslations('dashboard.surpriseBag') as Translate;
  const defaultTitle = t('defaultTitle');

  // ── Form state ──────────────────────────────────────────────────────────
  const [title, setTitle] = useState(defaultTitle);
  const [quantity, setQuantity] = useState(1);
  const [bagType, setBagType] = useState<OfferBagType>('surprise_bag');
  const [description, setDescription] = useState(() =>
    autoDescription(t, 'surprise_bag', defaultTitle, 1),
  );
  // Once the merchant edits the text we stop regenerating it. Without this,
  // switching type or renaming would silently discard what they wrote.
  const [descriptionTouched, setDescriptionTouched] = useState(false);
  const [rawPrice, setRawPrice] = useState(DEFAULT_PRICE.toFixed(3));
  const [discount, setDiscount] = useState<number>(DEFAULT_DISCOUNT);
  const [pickupDay, setPickupDay] = useState<'today' | 'tomorrow'>('today');
  const [pickupFrom, setPickupFrom] = useState<string>(PICKUP_PRESETS[0].from);
  const [pickupUntil, setPickupUntil] = useState<string>(PICKUP_PRESETS[0].until);
  const [customOpen, setCustomOpen] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // ── Data ────────────────────────────────────────────────────────────────
  const { data: establishment, isLoading: estLoading } = useMyEstablishment();
  const mutation = useCreateSurpriseBag();

  // ── Computed ─────────────────────────────────────────────────────────────
  const parsedPrice = Math.max(0, Number.parseFloat(rawPrice) || 0);
  const discountedPrice = parsedPrice > 0 ? parsedPrice * (1 - discount / 100) : 0;
  const saving = parsedPrice - discountedPrice;

  const canPublish =
    !mutation.isPending &&
    !!establishment &&
    !!pickupFrom &&
    !!pickupUntil &&
    parsedPrice > 0 &&
    discount >= MIN_DISCOUNT_PCT &&
    title.trim().length >= MIN_TITLE_CHARS;

  // ── Body scroll lock ─────────────────────────────────────────────────────
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  // ── Sync pickupFrom when custom opens or day changes ────────────────────
  // Fixes stale controlled-select: if pickupFrom is not in the available list
  // (e.g. preset "Lunch 12:00" while today's clock is past 12:00), the browser
  // displays the first real option visually while React holds the old value,
  // so the first onChange never fires. We correct state immediately.
  useEffect(() => {
    const available = getAvailableFromTimes(pickupDay);
    if (pickupFrom === 'now') return; // 'now' is always valid for today
    if (pickupDay === 'today' && available.length === 0) {
      // No scheduled slots remain — only 'now' is valid; snap state to match the select
      setPickupFrom('now');
      return;
    }
    if (!available.includes(pickupFrom)) {
      setPickupFrom(available[0] ?? PICKUP_PRESETS[0].from);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickupDay, customOpen]);

  // ── Sync pickupUntil when pickupFrom changes ──────────────────────────────
  // Ensures the Until select never holds a value that's before From.
  // Defaults to ~1 hr after From; falls back to first valid slot.
  useEffect(() => {
    const available = getAvailableUntilTimes(pickupFrom);
    if (available.includes(pickupUntil)) return;
    const now = new Date();
    const fH =
      pickupFrom === 'now' ? now.getHours() : Number.parseInt(pickupFrom.split(':')[0] ?? '0', 10);
    const fM =
      pickupFrom === 'now'
        ? now.getMinutes()
        : Number.parseInt(pickupFrom.split(':')[1] ?? '0', 10);
    const fromMins = fH * 60 + fM;
    const oneHourSlot = available.find(t => {
      const [h = 0, m = 0] = t.split(':').map(Number);
      return (h === 0 && m === 0 ? 1440 : h * 60 + m) >= fromMins + 60;
    });
    setPickupUntil(oneHourSlot ?? available[0] ?? '00:00');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickupFrom]);

  // ── Esc key ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (customOpen) {
        setCustomOpen(false);
        return;
      }
      onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, customOpen, onClose]);

  // Keep the suggestion in step with the type, title and quantity — until the
  // merchant writes their own, at which point it is theirs and we leave it be.
  useEffect(() => {
    if (descriptionTouched) return;
    setDescription(autoDescription(t, bagType, title.trim() || defaultTitle, quantity));
  }, [t, defaultTitle, bagType, title, quantity, descriptionTouched]);

  // ── Reset on open ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    setTitle(defaultTitle);
    setQuantity(1);
    setBagType('surprise_bag');
    setDescription(autoDescription(t, 'surprise_bag', defaultTitle, 1));
    setDescriptionTouched(false);
    setRawPrice(DEFAULT_PRICE.toFixed(3));
    setDiscount(DEFAULT_DISCOUNT);
    setPickupDay('today');
    setPickupFrom(PICKUP_PRESETS[0].from);
    setPickupUntil(PICKUP_PRESETS[0].until);
    setCustomOpen(false);
    setImageFile(null);
    setImagePreview('');
    setErrorMsg('');
    setSuccessMsg('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const decrement = useCallback(() => setQuantity(q => Math.max(1, q - 1)), []);
  const increment = useCallback(() => setQuantity(q => Math.min(MAX_QUANTITY, q + 1)), []);

  const handlePriceChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputVal = e.target.value;
      const isGrowing = inputVal.length > rawPrice.length;

      // Keep only digits and at most one dot
      let val = inputVal.replaceAll(/[^\d.]/g, '');
      const firstDot = val.indexOf('.');
      if (firstDot !== -1) {
        val = val.slice(0, firstDot + 1) + val.slice(firstDot + 1).replaceAll(/\./g, '');
      }

      // Cap to 3 decimal places
      const dotIdx = val.indexOf('.');
      if (dotIdx !== -1) {
        val = val.slice(0, dotIdx + 4);
      }

      // Auto-insert dot after the 3rd integer digit (only when typing forward)
      if (isGrowing && !val.includes('.') && val.length >= 3) {
        val = val.slice(0, 3) + '.' + (val.length > 3 ? val.slice(3) : '');
      }

      // Enforce max 100.000
      const num = Number.parseFloat(val);
      if (!Number.isNaN(num) && num > MAX_PRICE) {
        val = MAX_PRICE.toFixed(3);
      }

      setRawPrice(val);
    },
    [rawPrice],
  );

  const handleImageChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = ev => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
    // Reset the input so the same file can be re-selected after removal
    e.target.value = '';
  }, []);

  const removeImage = useCallback(() => {
    setImageFile(null);
    setImagePreview('');
  }, []);

  const handlePublish = useCallback(async () => {
    setErrorMsg('');
    setSuccessMsg('');

    const validationError = validatePublishForm({
      t,
      establishment,
      pickupFrom,
      pickupUntil,
      parsedPrice,
      discount,
      title,
      description,
    });
    if (validationError) {
      setErrorMsg(validationError);
      return;
    }

    // Resolve actual from hours/minutes — 'now' uses the real current time
    const nowSnapshot = new Date();
    const fromH =
      pickupFrom === 'now'
        ? nowSnapshot.getHours()
        : Number.parseInt(pickupFrom.split(':')[0] ?? '0', 10);
    const fromM =
      pickupFrom === 'now'
        ? nowSnapshot.getMinutes()
        : Number.parseInt(pickupFrom.split(':')[1] ?? '0', 10);

    const [untilH = 0, untilM = 0] = pickupUntil.split(':').map(Number);
    const fromMins = fromH * 60 + fromM;
    // Treat until "00:00" as 24:00 (midnight end-of-day) for comparison
    const untilMins = untilH === 0 && untilM === 0 ? 24 * 60 : untilH * 60 + untilM;

    if (untilMins <= fromMins) {
      setErrorMsg(t('errors.endBeforeStart'));
      return;
    }
    // Skip past-time check for 'now' — current time is always valid
    const currentMins = nowSnapshot.getHours() * 60 + nowSnapshot.getMinutes();
    if (pickupDay === 'today' && pickupFrom !== 'now' && fromMins <= currentMins) {
      setErrorMsg(t('errors.startPassed'));
      return;
    }

    const untilOverflow = untilH === 0 && untilM === 0; // midnight rolls to next day
    const resolvedFromLabel = pickupFrom === 'now' ? formatHHMM(nowSnapshot) : pickupFrom;

    const payload: CreateSurpriseBagPayload = {
      title: title.trim(),
      description: description.trim(),
      establishmentId: establishment?._id ?? '',
      type: bagType,
      pricing: {
        originalPrice: Number.parseFloat(parsedPrice.toFixed(3)),
        discountedPrice: Number.parseFloat(discountedPrice.toFixed(3)),
      },
      totalQuantity: quantity,
      availableFrom: pickupFrom === 'now' ? nowAsLocalISO() : toISO(pickupDay, fromH, fromM),
      availableUntil: toISO(pickupDay, untilH, untilM, untilOverflow),
      pickupTimeSlots: [{ startTime: resolvedFromLabel, endTime: pickupUntil }],
      isPickupToday: pickupDay === 'today',
      isPickupTomorrow: pickupDay === 'tomorrow',
      timezone: TIMEZONE,
    };

    try {
      await mutation.mutateAsync({ payload, imageFile });
      setSuccessMsg(t('publishSuccess', { count: quantity }));
      setTimeout(onClose, 1200);
    } catch {
      setErrorMsg(t('errors.publishFailed'));
    }
  }, [
    t,
    establishment,
    pickupFrom,
    pickupUntil,
    parsedPrice,
    discountedPrice,
    discount,
    title,
    description,
    quantity,
    bagType,
    pickupDay,
    imageFile,
    mutation,
    onClose,
  ]);

  // ── Portal guard ─────────────────────────────────────────────────────────
  if (typeof document === 'undefined') return null;

  // ── Render ───────────────────────────────────────────────────────────────
  return createPortal(
    <React.Fragment key='surprise-bag-panel'>
      {/* Backdrop */}
      <div
        aria-hidden='true'
        className={cn(
          'fixed inset-0 z-[100] bg-black/40 backdrop-blur-[2px]',
          'transition-opacity duration-300',
          open ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
        onClick={onClose}
      />

      {/* Slide panel */}
      <div
        role='dialog'
        aria-modal='true'
        aria-label={t(`title`)}
        className={cn(
          'fixed right-0 top-0 z-[101] h-full w-full max-w-[440px]',
          'bg-white shadow-2xl flex flex-col',
          'transition-transform duration-300 ease-in-out',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        {/* ── Header ── */}
        <div className='flex items-center justify-between px-xl py-lg border-b border-slate-100 shrink-0'>
          <div>
            <h2 className='font-display text-[15px] font-bold tracking-tight text-slate-900'>
              {t(`title`)}
            </h2>
            <p className='text-[11px] text-slate-400 mt-xxs leading-none'>{t(`subtitle`)}</p>
          </div>
          <button
            type='button'
            onClick={onClose}
            aria-label={t(`close`)}
            className='rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors'
          >
            <X className='h-5 w-5' />
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div className='flex-1 overflow-y-auto px-lg py-lg space-y-lg'>
          {/* Item Name */}
          <div className='space-y-xs'>
            <label htmlFor='offer-title' className='block text-xs font-semibold text-slate-700'>
              {t(`itemName`)}
            </label>
            <input
              id='offer-title'
              type='text'
              value={title}
              onChange={e => setTitle(e.target.value)}
              maxLength={100}
              className='w-full rounded-lg border border-slate-200 bg-slate-50 px-md py-sm text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors'
              placeholder={t(`itemNamePlaceholder`)}
            />
          </div>

          {/* Description — pre-written per type, the merchant's to change */}
          <div className='space-y-xs'>
            <div className='flex items-center justify-between'>
              <label
                htmlFor='offer-description'
                className='block text-xs font-semibold text-slate-700'
              >
                {t(`description`)}
              </label>
              {descriptionTouched && (
                <button
                  type='button'
                  onClick={() => setDescriptionTouched(false)}
                  className='text-[11px] font-medium text-primary hover:underline'
                >
                  {t(`resetSuggestion`)}
                </button>
              )}
            </div>
            <textarea
              id='offer-description'
              value={description}
              onChange={e => {
                setDescription(e.target.value);
                setDescriptionTouched(true);
              }}
              rows={4}
              maxLength={500}
              className='w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-md py-sm text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors'
            />
            <p className='text-[11px] text-slate-400'>
              {t(`descriptionHelp`, { count: description.trim().length })}
            </p>
          </div>

          {/* Quantity + Offer Type */}
          <div className='flex items-end gap-md'>
            {/* Quantity */}
            <div className='space-y-xs'>
              <label className='flex items-center gap-1.5 text-xs font-semibold text-slate-700'>
                {t(`quantity`)}
                <span className='text-[11px] font-normal text-slate-400'>
                  {t(`quantityMax`, { value: MAX_QUANTITY })}
                </span>
              </label>
              <div className='flex items-center gap-1.5'>
                <button
                  type='button'
                  onClick={decrement}
                  disabled={quantity <= 1}
                  aria-label={t(`decreaseQuantity`)}
                  className='flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors'
                >
                  <Minus className='h-3 w-3' />
                </button>

                <input
                  type='number'
                  min={1}
                  max={MAX_QUANTITY}
                  value={quantity}
                  aria-label={t(`quantity`)}
                  onChange={e => {
                    const v = Number.parseInt(e.target.value, 10);
                    if (!Number.isNaN(v)) setQuantity(Math.min(MAX_QUANTITY, Math.max(1, v)));
                  }}
                  className='h-7 w-12 rounded-md border border-slate-200 bg-white text-center text-xs font-bold tabular-nums text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'
                />

                <button
                  type='button'
                  onClick={increment}
                  disabled={quantity >= MAX_QUANTITY}
                  aria-label={t(`increaseQuantity`)}
                  className='flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors'
                >
                  <Plus className='h-3 w-3' />
                </button>
              </div>
            </div>

            {/* Offer Type */}
            <div className='flex-1 space-y-xs'>
              <label htmlFor='offer-type' className='block text-xs font-semibold text-slate-700'>
                {t(`offerType`)}
              </label>
              <select
                id='offer-type'
                value={bagType}
                onChange={e => setBagType(e.target.value as OfferBagType)}
                className='h-7 w-full rounded-md border border-slate-200 bg-slate-50 px-sm text-[11px] text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors cursor-pointer'
              >
                {BAG_TYPE_OPTIONS.map(value => (
                  <option key={value} value={value}>
                    {t(`types.${value}`)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Divider */}
          <div className='border-t border-slate-100' />

          {/* Pricing */}
          <div className='space-y-md'>
            <p className='text-xs font-semibold text-slate-700'>{t(`pricing`)}</p>

            {/* Original value */}
            <div className='space-y-xs'>
              <div className='flex items-center justify-between'>
                <p className='text-[11px] text-slate-400'>{t(`originalValue`)}</p>
                <p className='text-[10px] text-slate-400'>{t(`priceMax`, { value: MAX_PRICE })}</p>
              </div>
              <div className='flex gap-xs'>
                <span className='flex h-7 items-center rounded-md border border-slate-200 bg-slate-100 px-sm text-[11px] font-semibold text-slate-500 shrink-0 select-none'>
                  TND
                </span>
                <input
                  type='text'
                  inputMode='decimal'
                  value={rawPrice}
                  onChange={handlePriceChange}
                  className='h-7 flex-1 rounded-md border border-slate-200 bg-slate-50 px-sm text-[11px] text-slate-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors'
                  placeholder='10.000'
                />
              </div>
            </div>

            {/* Discount pills */}
            <div className='space-y-xs'>
              <p className='text-xs text-slate-400'>{t(`discount`, { min: MIN_DISCOUNT_PCT })}</p>
              <div className='grid grid-cols-7 gap-xs'>
                {DISCOUNT_OPTIONS.map(pct => (
                  <button
                    key={pct}
                    type='button'
                    onClick={() => setDiscount(pct)}
                    className={cn(
                      'relative h-7 rounded-md border text-[11px] font-semibold transition-all',
                      discount === pct
                        ? 'border-primary bg-primary text-white shadow-sm'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-primary/40 hover:bg-primary/5',
                    )}
                  >
                    {pct >= 70 && (
                      <Flame className='absolute -top-sm left-xs/2 -translate-x-xs/2 h-3.5 w-3.5 text-orange-500' />
                    )}
                    {pct}%
                  </button>
                ))}
              </div>
            </div>

            {/* Customer pays */}
            <div className='space-y-xs'>
              <p className='text-[11px] text-slate-400'>{t(`customerPays`)}</p>
              <div className='flex gap-xs'>
                <div
                  className={cn(
                    'flex-1 h-7 rounded-md border flex items-center px-sm',
                    discountedPrice > 0
                      ? 'border-emerald-200 bg-emerald-50'
                      : 'border-slate-200 bg-slate-50',
                  )}
                >
                  <span
                    className={cn(
                      'text-[11px] font-bold tabular-nums',
                      discountedPrice > 0 ? 'text-emerald-700' : 'text-slate-400',
                    )}
                  >
                    {discountedPrice > 0 ? discountedPrice.toFixed(3) : '—'}
                  </span>
                </div>
                <span className='flex h-7 items-center rounded-md border border-slate-200 bg-slate-100 px-sm text-[11px] font-semibold text-slate-500 shrink-0 select-none'>
                  TND
                </span>
              </div>
              {parsedPrice > 0 && discountedPrice > 0 && (
                <p className='text-[11px] font-medium text-emerald-600'>
                  {t(`customerSaves`, { amount: saving.toFixed(3), percent: discount })}
                </p>
              )}
            </div>

            {/* What comparable bags go for — shown while the price can still change */}
            {open && <PriceGuidance discountedPrice={discountedPrice} />}
          </div>

          {/* Divider */}
          <div className='border-t border-slate-100' />

          {/* Pickup window */}
          <div className='space-y-2.5'>
            <p className='text-xs font-semibold text-slate-700'>{t(`pickupWindow`)}</p>

            {/* Day toggle */}
            <div className='flex gap-sm'>
              {(['today', 'tomorrow'] as const).map(d => (
                <button
                  key={d}
                  type='button'
                  onClick={() => setPickupDay(d)}
                  className={cn(
                    'flex-1 rounded-lg py-1.5 text-xs font-semibold transition-all',
                    pickupDay === d
                      ? 'bg-primary text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                  )}
                >
                  {t(d)}
                </button>
              ))}
            </div>

            {/* Quick presets */}
            <div className='flex gap-1.5'>
              {PICKUP_PRESETS.map(p => {
                const active = !customOpen && pickupFrom === p.from && pickupUntil === p.until;
                return (
                  <button
                    key={p.key}
                    type='button'
                    onClick={() => {
                      setPickupFrom(p.from);
                      setPickupUntil(p.until);
                      setCustomOpen(false);
                    }}
                    className={cn(
                      'flex-1 flex flex-col items-center rounded-lg border py-1.5 px-xs transition-all',
                      active
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-primary/40 hover:bg-primary/5',
                    )}
                  >
                    <span className='text-[11px] font-semibold leading-none'>
                      {t(`presets.${p.key}`)}
                    </span>
                    <span
                      className={cn(
                        'text-[10px] mt-xxs tabular-nums',
                        active ? 'text-primary/70' : 'text-slate-400',
                      )}
                    >
                      {p.from}–{p.until}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Custom range toggle */}
            <button
              type='button'
              onClick={() => setCustomOpen(v => !v)}
              className={cn(
                'w-full flex items-center justify-between h-7 rounded-md border px-2.5',
                'text-[11px] transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30',
                customOpen
                  ? 'border-primary bg-primary/5 text-primary font-semibold'
                  : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300',
              )}
            >
              <span>{t(`customRange`)}</span>
              <ChevronDown
                className={cn(
                  'h-3 w-3 shrink-0 transition-transform duration-200',
                  customOpen && 'rotate-180',
                )}
              />
            </button>

            {/* Custom From / Until selects */}
            {customOpen && (
              <div className='flex gap-sm animate-in slide-in-from-top-1 duration-150'>
                <div className='flex-1 space-y-xs'>
                  <p className='text-[10px] font-medium text-slate-500'>{t(`from`)}</p>
                  <select
                    value={pickupFrom}
                    aria-label={t(`fromLabel`)}
                    onChange={e => setPickupFrom(e.target.value)}
                    className='h-7 w-full rounded-md border border-slate-200 bg-slate-50 px-sm text-[11px] text-slate-800 tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors cursor-pointer'
                  >
                    {pickupDay === 'today' && <option value='now'>⚡ {t(`rightNow`)}</option>}
                    {getAvailableFromTimes(pickupDay).map(slot => (
                      <option key={slot} value={slot}>
                        {slot}
                      </option>
                    ))}
                  </select>
                </div>
                <div className='flex-1 space-y-xs'>
                  <p className='text-[10px] font-medium text-slate-500'>{t(`until`)}</p>
                  <select
                    value={pickupUntil}
                    aria-label={t(`untilLabel`)}
                    onChange={e => setPickupUntil(e.target.value)}
                    className='h-7 w-full rounded-md border border-slate-200 bg-slate-50 px-sm text-[11px] text-slate-800 tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors cursor-pointer'
                  >
                    {getAvailableUntilTimes(pickupFrom).map(slot => (
                      <option key={slot} value={slot}>
                        {slot === '00:00' ? t('midnight') : slot}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Live summary */}
            {pickupFrom && pickupUntil && (
              <p className='text-[11px] font-medium text-slate-600 tabular-nums'>
                {t('summary', {
                  day: t(pickupDay),
                  from: pickupFrom === 'now' ? `⚡ ${formatHHMM(new Date())}` : pickupFrom,
                  until: pickupUntil === '00:00' ? t('midnight') : pickupUntil,
                })}
              </p>
            )}

            {/* Today warning if chosen time is in the past — not shown for 'now' */}
            {pickupDay === 'today' &&
              pickupFrom !== 'now' &&
              (() => {
                const [h = 0, m = 0] = pickupFrom.split(':').map(Number);
                const now = new Date();
                return h * 60 + m <= now.getHours() * 60 + now.getMinutes();
              })() && (
                <p className='flex items-center gap-1.5 text-[11px] text-amber-600'>
                  <AlertCircle className='h-3.5 w-3.5 shrink-0' />
                  {t(`startPassedWarning`)}
                </p>
              )}
          </div>

          {/* Divider */}
          <div className='border-t border-slate-100' />

          {/* Offer Image */}
          <div className='space-y-xs'>
            <div className='flex items-center justify-between'>
              <p className='text-xs font-semibold text-slate-700'>{t(`offerImage`)}</p>
              <span className='text-[11px] text-slate-400'>{t(`imageFormats`)}</span>
            </div>

            {imagePreview ? (
              <div className='relative rounded-lg overflow-hidden border border-slate-200'>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imagePreview}
                  alt={t(`imagePreviewAlt`)}
                  className='w-full h-28 object-cover'
                />
                <button
                  type='button'
                  onClick={removeImage}
                  aria-label={t(`removeImage`)}
                  className='absolute top-1.5 right-1.5 rounded-full bg-black/50 p-xs text-white hover:bg-black/70 transition-colors'
                >
                  <X className='h-3 w-3' />
                </button>
                <p className='absolute bottom-0 left-0 right-0 bg-black/40 px-sm py-xs text-[10px] text-white truncate'>
                  {imageFile?.name}
                </p>
              </div>
            ) : (
              <label className='flex flex-col items-center justify-center gap-1.5 h-20 rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors'>
                <ImagePlus className='h-5 w-5 text-slate-400' />
                <span className='text-xs text-slate-400'>{t(`uploadCta`)}</span>
                <input
                  type='file'
                  accept='image/jpeg,image/png,image/webp'
                  className='sr-only'
                  onChange={handleImageChange}
                />
              </label>
            )}
          </div>

          {/* Establishment warnings */}
          {estLoading && (
            <p className='text-xs text-slate-400 animate-pulse'>{t(`loadingEstablishment`)}</p>
          )}
          {!estLoading && !establishment && (
            <div className='flex items-center gap-sm rounded-lg bg-amber-50 border border-amber-200 px-md py-sm'>
              <AlertCircle className='h-4 w-4 text-amber-500 shrink-0' />
              <p className='text-xs text-amber-700'>{t(`noEstablishment`)}</p>
            </div>
          )}

          {/* Feedback */}
          {errorMsg && (
            <div className='flex items-start gap-sm rounded-lg bg-red-50 border border-red-200 px-md py-2.5'>
              <AlertCircle className='h-4 w-4 text-red-500 mt-xxs shrink-0' />
              <p className='text-xs text-red-700'>{errorMsg}</p>
            </div>
          )}
          {successMsg && (
            <div className='flex items-center gap-sm rounded-lg bg-emerald-50 border border-emerald-200 px-md py-2.5'>
              <CheckCircle2 className='h-4 w-4 text-emerald-500 shrink-0' />
              <p className='text-xs font-medium text-emerald-700'>{successMsg}</p>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className='border-t border-slate-100 px-xl py-lg shrink-0 bg-white'>
          <button
            type='button'
            onClick={() => void handlePublish()}
            disabled={!canPublish}
            className={cn(
              'w-full rounded-xl py-md text-sm font-bold tracking-wide',
              'bg-primary text-white shadow-sm',
              'hover:opacity-90 active:scale-[0.98]',
              'transition-all duration-150',
              'disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100',
            )}
          >
            {mutation.isPending ? (
              <span className='flex items-center justify-center gap-sm'>
                <Flame className='h-4 w-4 animate-spin' />
                {t(`publishing`)}
              </span>
            ) : (
              t(`publish`)
            )}
          </button>
        </div>
      </div>
    </React.Fragment>,
    document.body,
  );
}
