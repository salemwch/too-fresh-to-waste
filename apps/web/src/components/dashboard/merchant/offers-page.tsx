'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Plus,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Package,
  RefreshCw,
  Sparkles,
  FilePen,
  PackageOpen,
  CalendarX2,
  Ban,
  LayoutGrid,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@foodwaste/ui';
import { OfferCard } from './offer-card';
import { SurpriseBagPanel } from './surprise-bag-panel';
import {
  useMerchantOffersFiltered,
  useOfferStatusCount,
  useMyEstablishment,
  useUpdateOfferStatus,
  useDeleteOffer,
  useReactivateOffer,
} from '@/hooks/use-merchant-dashboard';
import type { ReactivateOfferPayload, MerchantOffer } from '@/types/dashboard';

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 10;

const TAB_KEYS = ['all', 'active', 'draft', 'sold_out', 'expired', 'cancelled'] as const;
type TabKey = (typeof TAB_KEYS)[number];

const TAB_I18N_MAP: Record<TabKey, string> = {
  all: 'tabAll',
  active: 'tabActive',
  draft: 'tabDraft',
  sold_out: 'tabSoldOut',
  expired: 'tabExpired',
  cancelled: 'tabCancelled',
};

const TYPE_FILTER_KEYS = [
  { value: '', i18nKey: 'allTypes' },
  { value: 'surprise_bag', i18nKey: 'surpriseBag' },
  { value: 'specific_items', i18nKey: 'specificItem' },
  { value: 'meal_deal', i18nKey: 'mealDeal' },
] as const;

const SORT_KEYS = [
  { value: 'newest', i18nKey: 'newest' },
  { value: 'oldest', i18nKey: 'oldest' },
  { value: 'price_asc', i18nKey: 'priceAsc' },
  { value: 'price_desc', i18nKey: 'priceDesc' },
] as const;

// ─── Pickup time helpers (mirrored from surprise-bag-panel) ──────────────────

const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2);
  const m = (i % 2) * 30;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
});

const UNTIL_OPTIONS = [...TIME_OPTIONS.slice(1), '00:00'];

const PRESET_KEYS = [
  { i18nKey: 'presetLunch', from: '12:00', until: '14:00' },
  { i18nKey: 'presetDinner', from: '18:00', until: '21:00' },
  { i18nKey: 'presetAllDay', from: '08:00', until: '22:00' },
] as const;

function getAvailableFromTimes(day: 'today' | 'tomorrow'): string[] {
  if (day === 'tomorrow') return TIME_OPTIONS;
  const now = new Date();
  const bufferMs = 30 * 60 * 1000;
  const nowMs = (now.getHours() * 60 + now.getMinutes()) * 60 * 1000;
  return TIME_OPTIONS.filter(t => {
    const [h, m] = t.split(':').map(Number);
    return ((h ?? 0) * 60 + (m ?? 0)) * 60 * 1000 > nowMs + bufferMs;
  });
}

function toISO(day: 'today' | 'tomorrow', time: string, overflow = false): string {
  const [h, m] = time.split(':').map(Number);
  const d = new Date();
  if (day === 'tomorrow' || overflow) d.setDate(d.getDate() + 1);
  d.setHours(h ?? 0, m ?? 0, 0, 0);
  return d.toISOString();
}

// ─── Stat chip ───────────────────────────────────────────────────────────────

interface StatChipProps {
  label: string;
  count: number;
  bg: string;
  text: string;
  iconColor: string;
  icon: React.ComponentType<{ className?: string }>;
}

function StatChip({ label, count, bg, text, iconColor, icon: Icon }: StatChipProps) {
  return (
    <div
      className={cn('flex-1 min-w-[100px] rounded-2xl px-4 py-3 flex flex-col justify-between', bg)}
      style={{ minHeight: 72 }}
    >
      <div className='flex items-start justify-between gap-2'>
        <span className={cn('font-display text-3xl font-bold leading-none tabular-nums', text)}>
          {count}
        </span>
        <Icon className={cn('h-4 w-4 mt-0.5 shrink-0', iconColor)} />
      </div>
      <span className={cn('text-xs font-medium mt-2 block', text)}>{label}</span>
    </div>
  );
}

// ─── Empty state ─────────────────────────────────────────────────────────────

function EmptyOffers({
  hasFilters,
  onClear,
  t,
}: {
  hasFilters: boolean;
  onClear: () => void;
  t: (key: string) => string;
}) {
  return (
    <div className='flex flex-col items-center justify-center py-16 text-center'>
      <Package className='h-12 w-12 text-slate-300 mb-4' />
      <p className='text-sm font-semibold text-slate-700'>
        {hasFilters ? t('merchantOffers.noMatchFilters') : t('merchantOffers.noOffers')}
      </p>
      <p className='text-xs text-slate-500 mt-1 max-w-xs'>
        {hasFilters ? t('merchantOffers.clearHint') : t('merchantOffers.createHint')}
      </p>
      {hasFilters && (
        <button
          type='button'
          onClick={onClear}
          className='mt-4 text-xs font-semibold text-primary hover:underline'
        >
          {t('merchantOffers.clearFilters')}
        </button>
      )}
    </div>
  );
}

// ─── Reactivate modal ────────────────────────────────────────────────────────

interface ReactivateModalProps {
  offer: MerchantOffer;
  isPending: boolean;
  onClose: () => void;
  onConfirm: (payload: ReactivateOfferPayload) => void;
  t: (key: string) => string;
}

function ReactivateModal({ offer, isPending, onClose, onConfirm, t }: ReactivateModalProps) {
  const [day, setDay] = useState<'today' | 'tomorrow'>('tomorrow');
  const [pickupFrom, setFrom] = useState('12:00');
  const [pickupUntil, setUntil] = useState('14:00');
  const [quantity, setQty] = useState(offer.totalQuantity ?? 5);
  const [originalPrice, setOriginalPrice] = useState(offer.pricing.originalPrice);
  const [discountedPrice, setDiscountedPrice] = useState(offer.pricing.discountedPrice);

  const discountPct =
    originalPrice > 0 && discountedPrice > 0 && discountedPrice < originalPrice
      ? Math.round(((originalPrice - discountedPrice) / originalPrice) * 100)
      : null;
  const pricingValid = discountPct !== null && discountPct >= 50 && discountPct <= 90;

  const fromOptions = useMemo(() => getAvailableFromTimes(day), [day]);

  // Correct stale "from" value when day changes
  useEffect(() => {
    if (day === 'today') {
      if (pickupFrom !== 'now' && !fromOptions.includes(pickupFrom)) {
        setFrom('now');
      }
    } else {
      if (pickupFrom === 'now' || !fromOptions.includes(pickupFrom)) {
        setFrom(fromOptions[0] ?? '12:00');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day]);

  function applyPreset(preset: (typeof PRESET_KEYS)[number]) {
    const available = getAvailableFromTimes(day);
    setFrom(available.includes(preset.from) ? preset.from : (available[0] ?? preset.from));
    setUntil(preset.until);
  }

  function handleConfirm() {
    const overflow = pickupUntil === '00:00';
    const nowSnap = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const resolvedFrom =
      pickupFrom === 'now' ? `${pad(nowSnap.getHours())}:${pad(nowSnap.getMinutes())}` : pickupFrom;
    onConfirm({
      availableFrom: pickupFrom === 'now' ? nowSnap.toISOString() : toISO(day, pickupFrom),
      availableUntil: toISO(day, pickupUntil, overflow),
      pickupTimeSlots: [{ startTime: resolvedFrom, endTime: pickupUntil }],
      totalQuantity: quantity,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      isPickupToday: day === 'today',
      isPickupTomorrow: day === 'tomorrow',
      pricing: { originalPrice, discountedPrice },
    });
  }

  const canConfirm =
    pricingValid && (day === 'tomorrow' || fromOptions.length > 0 || pickupFrom === 'now');

  return (
    <div
      className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm'
      onClick={onClose}
    >
      <div
        className='bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden'
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className='flex items-center justify-between px-5 py-4 border-b border-slate-100'>
          <div>
            <p className='text-sm font-bold text-slate-900'>
              {t('merchantOffers.reactivateTitle')}
            </p>
            <p className='text-xs text-slate-500 mt-0.5 truncate max-w-[220px]'>{offer.title}</p>
          </div>
          <button
            type='button'
            onClick={onClose}
            className='rounded-full p-1.5 hover:bg-slate-100 transition-colors'
          >
            <X className='h-4 w-4 text-slate-500' />
          </button>
        </div>

        <div className='px-5 py-4 space-y-4'>
          {/* Day toggle */}
          <div>
            <p className='text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-2'>
              {t('merchantOffers.pickupDay')}
            </p>
            <div className='flex gap-2'>
              {(['today', 'tomorrow'] as const).map(d => (
                <button
                  key={d}
                  type='button'
                  onClick={() => setDay(d)}
                  className={cn(
                    'flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all',
                    day === d
                      ? 'bg-primary text-white border-primary'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-primary/40',
                  )}
                >
                  {d === 'today' ? t('merchantOffers.today') : t('merchantOffers.tomorrow')}
                </button>
              ))}
            </div>
            {day === 'today' && fromOptions.length === 0 && (
              <p className='text-[10px] text-amber-600 mt-1.5'>
                {t('merchantOffers.noSlotsToday')}
              </p>
            )}
          </div>

          {/* Quick presets */}
          <div>
            <p className='text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-2'>
              {t('merchantOffers.quickPresets')}
            </p>
            <div className='flex gap-2'>
              {PRESET_KEYS.map(p => {
                const resolvedFrom = fromOptions.includes(p.from)
                  ? p.from
                  : (fromOptions[0] ?? p.from);
                const isActive = pickupFrom === resolvedFrom && pickupUntil === p.until;
                return (
                  <button
                    key={p.i18nKey}
                    type='button'
                    onClick={() => applyPreset(p)}
                    className={cn(
                      'flex-1 flex flex-col items-center rounded-lg border py-1.5 px-1 transition-all',
                      isActive
                        ? 'border-primary bg-primary/8 text-primary'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-primary/30',
                    )}
                  >
                    <span className='text-[11px] font-semibold leading-none'>
                      {t(`merchantOffers.${p.i18nKey}`)}
                    </span>
                    <span
                      className={cn(
                        'text-[10px] mt-0.5 tabular-nums',
                        isActive ? 'text-primary/70' : 'text-slate-400',
                      )}
                    >
                      {p.from}–{p.until}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* From / Until selects — always visible */}
          <div className='flex gap-3'>
            <div className='flex-1'>
              <label className='text-[10px] font-semibold text-slate-500 block mb-1'>
                {t('merchantOffers.from')}
              </label>
              <select
                value={pickupFrom}
                onChange={e => setFrom(e.target.value)}
                className='w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/30'
              >
                {day === 'today' && <option value='now'>{t('merchantOffers.rightNow')}</option>}
                {fromOptions.map(tm => (
                  <option key={tm} value={tm}>
                    {tm}
                  </option>
                ))}
              </select>
            </div>
            <div className='flex-1'>
              <label className='text-[10px] font-semibold text-slate-500 block mb-1'>
                {t('merchantOffers.until')}
              </label>
              <select
                value={pickupUntil}
                onChange={e => setUntil(e.target.value)}
                className='w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/30'
              >
                {UNTIL_OPTIONS.map(tm => (
                  <option key={tm} value={tm}>
                    {tm === '00:00' ? t('merchantOffers.midnight') : tm}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Live summary */}
          <p className='text-[11px] font-medium text-slate-600 tabular-nums'>
            {day === 'today' ? t('merchantOffers.today') : t('merchantOffers.tomorrow')} ·{' '}
            {pickupFrom === 'now' ? t('merchantOffers.rightNow') : pickupFrom} –{' '}
            {pickupUntil === '00:00' ? t('merchantOffers.midnight') : pickupUntil}
          </p>

          {/* Pricing */}
          <div>
            <p className='text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-2'>
              {t('merchantOffers.pricing')}
            </p>
            <div className='flex gap-2 items-start'>
              <div className='flex-1'>
                <label className='text-[10px] font-semibold text-slate-500 block mb-1'>
                  {t('merchantOffers.originalPrice')}
                </label>
                <div className='relative'>
                  <input
                    type='number'
                    min={0.01}
                    step={0.1}
                    value={originalPrice}
                    onChange={e => setOriginalPrice(parseFloat(e.target.value) || 0)}
                    className='w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 pe-10 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/30'
                  />
                  <span className='absolute end-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-medium'>
                    TND
                  </span>
                </div>
              </div>
              <div className='flex-1'>
                <label className='text-[10px] font-semibold text-slate-500 block mb-1'>
                  {t('merchantOffers.salePrice')}
                </label>
                <div className='relative'>
                  <input
                    type='number'
                    min={0.01}
                    step={0.1}
                    value={discountedPrice}
                    onChange={e => setDiscountedPrice(parseFloat(e.target.value) || 0)}
                    className='w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 pe-10 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/30'
                  />
                  <span className='absolute end-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-medium'>
                    TND
                  </span>
                </div>
              </div>
              <div className='pt-4'>
                <span
                  className={cn(
                    'inline-flex items-center rounded-lg px-2 py-1.5 text-[11px] font-bold tabular-nums',
                    pricingValid ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-400',
                  )}
                >
                  {discountPct !== null ? `-${discountPct}%` : '--'}
                </span>
              </div>
            </div>
            {discountPct !== null && !pricingValid && (
              <p className='text-[10px] text-red-500 mt-1'>
                {t('merchantOffers.discountRangeError')}
              </p>
            )}
          </div>

          {/* Quantity */}
          <div>
            <p className='text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-2'>
              {t('merchantOffers.quantity')}
            </p>
            <div className='flex items-center gap-2'>
              <button
                type='button'
                onClick={() => setQty(q => Math.max(1, q - 1))}
                className='h-7 w-7 rounded-full border border-slate-200 text-slate-600 hover:bg-slate-100 text-sm font-bold flex items-center justify-center transition-colors flex-shrink-0'
              >
                −
              </button>
              <input
                type='number'
                min={1}
                max={100}
                value={quantity}
                onChange={e => setQty(Math.min(100, Math.max(1, parseInt(e.target.value) || 1)))}
                className='w-16 text-center rounded-lg border border-slate-200 bg-white px-1 py-1 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/30 tabular-nums'
              />
              <button
                type='button'
                onClick={() => setQty(q => Math.min(100, q + 1))}
                className='h-7 w-7 rounded-full border border-slate-200 text-slate-600 hover:bg-slate-100 text-sm font-bold flex items-center justify-center transition-colors flex-shrink-0'
              >
                +
              </button>
              <span className='text-[11px] text-slate-400'>{t('merchantOffers.bagsMax')}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className='flex gap-2 px-5 pb-4'>
          <button
            type='button'
            onClick={onClose}
            className='flex-1 h-8 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors'
          >
            {t('merchantOffers.cancel')}
          </button>
          <button
            type='button'
            disabled={!canConfirm || isPending}
            onClick={handleConfirm}
            className={cn(
              'flex-1 h-8 rounded-lg bg-primary text-white text-xs font-bold transition-all',
              'hover:opacity-90 active:scale-[0.97]',
              'disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100',
              isPending && 'animate-pulse',
            )}
          >
            {isPending ? t('merchantOffers.reactivating') : t('merchantOffers.reactivate')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function MerchantOffersView() {
  const t = useTranslations('dashboard');

  // ── UI state ────────────────────────────────────────────────────────────────
  const [panelOpen, setPanelOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [reactivateTarget, setReactivateTarget] = useState<MerchantOffer | null>(null);

  // ── Status counts (lightweight — limit=1, reads meta.total) ────────────────
  const activeCount = useOfferStatusCount('active').data ?? 0;
  const draftCount = useOfferStatusCount('draft').data ?? 0;
  const soldOutCount = useOfferStatusCount('sold_out').data ?? 0;
  const expiredCount = useOfferStatusCount('expired').data ?? 0;
  const cancelledCount = useOfferStatusCount('cancelled').data ?? 0;
  const totalCount = activeCount + draftCount + soldOutCount + expiredCount + cancelledCount;

  const TAB_COUNTS: Record<TabKey, number> = {
    all: totalCount,
    active: activeCount,
    draft: draftCount,
    sold_out: soldOutCount,
    expired: expiredCount,
    cancelled: cancelledCount,
  };

  // ── Data ────────────────────────────────────────────────────────────────────
  const statusParam = activeTab === 'all' ? undefined : activeTab;
  const offersQuery = useMerchantOffersFiltered(page, PAGE_SIZE, statusParam);
  const estabQuery = useMyEstablishment();
  const isEstablishmentApproved = estabQuery.data?.status === 'active';

  // ── Mutations ───────────────────────────────────────────────────────────────
  const updateStatus = useUpdateOfferStatus();
  const deleteOffer = useDeleteOffer();
  const reactivate = useReactivateOffer();
  const anyPending = updateStatus.isPending || deleteOffer.isPending || reactivate.isPending;

  // ── Client-side filter + sort (applied on top of the server-paginated list) ─
  const displayedOffers = useMemo(() => {
    let list = offersQuery.data?.offers ?? [];

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(o => o.title.toLowerCase().includes(q));
    }

    if (typeFilter) {
      list = list.filter(o => o.type === typeFilter);
    }

    switch (sort) {
      case 'oldest':
        list = [...list].sort(
          (a, b) => new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime(),
        );
        break;
      case 'price_asc':
        list = [...list].sort((a, b) => a.pricing.discountedPrice - b.pricing.discountedPrice);
        break;
      case 'price_desc':
        list = [...list].sort((a, b) => b.pricing.discountedPrice - a.pricing.discountedPrice);
        break;
      default: // 'newest' — backend already returns newest-first
        break;
    }

    return list;
  }, [offersQuery.data?.offers, search, typeFilter, sort]);

  const meta = offersQuery.data?.meta;
  const hasFilters = !!search || !!typeFilter;

  const handleClearFilters = useCallback(() => {
    setSearch('');
    setTypeFilter('');
  }, []);

  const handleTabChange = useCallback((tab: TabKey) => {
    setActiveTab(tab);
    setPage(1);
  }, []);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Create offer slide-in panel */}
      <SurpriseBagPanel open={panelOpen} onClose={() => setPanelOpen(false)} />

      {/* Reactivate modal */}
      {reactivateTarget && (
        <ReactivateModal
          offer={reactivateTarget}
          isPending={reactivate.isPending}
          onClose={() => setReactivateTarget(null)}
          onConfirm={payload => {
            reactivate.mutate(
              { offerId: reactivateTarget.id, payload },
              { onSuccess: () => setReactivateTarget(null) },
            );
          }}
          t={t}
        />
      )}

      <div className='space-y-5'>
        {/* ── Page header ──────────────────────────────────────────────────── */}
        <div className='flex items-center justify-between gap-4 flex-wrap'>
          <div>
            <span className='inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-100 text-[12px] font-medium text-red-400 mb-2'>
              <Sparkles className='h-3 w-3' />
              {t('merchantOffers.manageLabel')}
            </span>
            <h1 className='font-display text-4xl font-bold tracking-tight text-primary-500'>
              {t('merchantOffers.title')}
            </h1>
          </div>
          <button
            type='button'
            onClick={() => setPanelOpen(true)}
            className='flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 active:scale-[0.97] transition-all'
          >
            <Plus className='h-4 w-4' />
            {t('merchantOffers.newOffer')}
          </button>
        </div>

        {/* ── Establishment approval banner ─────────────────────────────────── */}
        {!estabQuery.isLoading && !isEstablishmentApproved && (
          <div className='flex items-start gap-3 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3'>
            <AlertTriangle className='h-4 w-4 text-amber-600 shrink-0 mt-0.5' />
            <div>
              <p className='text-sm font-semibold text-amber-800'>
                {t('merchantOffers.approvalTitle')}
              </p>
              <p className='text-xs text-amber-700 mt-0.5'>{t('merchantOffers.approvalMessage')}</p>
            </div>
          </div>
        )}

        {/* ── Stats chips ───────────────────────────────────────────────────── */}
        <div className='flex gap-3 flex-wrap'>
          <StatChip
            icon={Sparkles}
            label={t('merchantOffers.tabActive')}
            count={activeCount}
            bg='bg-[#c8e6df]'
            text='text-primary-500'
            iconColor='text-primary-500/50'
          />
          <StatChip
            icon={FilePen}
            label={t('merchantOffers.tabDraft')}
            count={draftCount}
            bg='bg-slate-100'
            text='text-slate-700'
            iconColor='text-slate-400'
          />
          <StatChip
            icon={PackageOpen}
            label={t('merchantOffers.tabSoldOut')}
            count={soldOutCount}
            bg='bg-red-100'
            text='text-red-500'
            iconColor='text-red-400/70'
          />
          <StatChip
            icon={CalendarX2}
            label={t('merchantOffers.tabExpired')}
            count={expiredCount}
            bg='bg-amber-100'
            text='text-amber-700'
            iconColor='text-amber-500/70'
          />
          <StatChip
            icon={Ban}
            label={t('merchantOffers.tabCancelled')}
            count={cancelledCount}
            bg='bg-white border border-slate-200'
            text='text-slate-400'
            iconColor='text-slate-300'
          />
        </div>

        {/* ── Status filter tabs ────────────────────────────────────────────── */}
        <div className='flex gap-1.5 overflow-x-auto pb-1 scrollbar-none'>
          {TAB_KEYS.map(key => (
            <button
              key={key}
              type='button'
              onClick={() => handleTabChange(key)}
              className={cn(
                'shrink-0 flex items-center gap-1.5 h-8 px-3.5 rounded-full text-xs font-semibold border transition-all',
                activeTab === key
                  ? 'bg-primary-500 text-white border-primary-500 shadow-sm'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-primary-500/40 hover:text-primary-500',
              )}
            >
              {key === 'all' && <LayoutGrid className='h-3 w-3' />}
              {t(`merchantOffers.${TAB_I18N_MAP[key]}`)}
              <span
                className={cn(
                  'min-w-[18px] px-1 py-px rounded-full text-[10px] font-bold tabular-nums text-center',
                  activeTab === key ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-500',
                )}
              >
                {TAB_COUNTS[key]}
              </span>
            </button>
          ))}
        </div>

        {/* ── Toolbar: search · type filter · sort ─────────────────────────── */}
        <div className='flex items-center gap-2 flex-wrap'>
          <div className='relative flex-1 min-w-[180px]'>
            <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none' />
            <input
              type='text'
              placeholder={t('merchantOffers.searchPlaceholder')}
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className='w-full h-7 rounded-full border border-slate-200 bg-white pl-8 pr-8 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50'
            />
            {search && (
              <button
                type='button'
                onClick={() => setSearch('')}
                className='absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600'
              >
                <X className='h-3.5 w-3.5' />
              </button>
            )}
          </div>

          <select
            value={typeFilter}
            onChange={e => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
            className='h-7 rounded-full border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/30'
          >
            {TYPE_FILTER_KEYS.map(o => (
              <option key={o.value} value={o.value}>
                {t(`merchantOffers.${o.i18nKey}`)}
              </option>
            ))}
          </select>

          <select
            value={sort}
            onChange={e => setSort(e.target.value)}
            className='h-7 rounded-full border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/30'
          >
            {SORT_KEYS.map(o => (
              <option key={o.value} value={o.value}>
                {t(`merchantOffers.${o.i18nKey}`)}
              </option>
            ))}
          </select>

          {offersQuery.isFetching && !offersQuery.isLoading && (
            <RefreshCw className='h-3.5 w-3.5 text-slate-400 animate-spin shrink-0' />
          )}
        </div>

        {/* ── Offer list ───────────────────────────────────────────────────── */}
        {offersQuery.isLoading ? (
          <div className='space-y-3'>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className='h-28 rounded-xl bg-slate-100 animate-pulse' />
            ))}
          </div>
        ) : offersQuery.isError ? (
          <div className='rounded-xl border border-red-200 bg-red-50 px-5 py-6 text-center'>
            <p className='text-sm font-medium text-red-700'>{t('merchantOffers.errorLoading')}</p>
            <p className='text-xs text-red-500 mt-1'>{(offersQuery.error as Error).message}</p>
          </div>
        ) : displayedOffers.length === 0 ? (
          <EmptyOffers hasFilters={hasFilters} onClear={handleClearFilters} t={t} />
        ) : (
          <div className='space-y-3'>
            {displayedOffers.map(offer => (
              <OfferCard
                key={offer.id}
                offer={offer}
                isEstablishmentApproved={isEstablishmentApproved}
                isPending={anyPending}
                onPublish={() => updateStatus.mutate({ offerId: offer.id, status: 'active' })}
                onMarkSoldOut={() => updateStatus.mutate({ offerId: offer.id, status: 'sold_out' })}
                onCancelOffer={() =>
                  updateStatus.mutate({ offerId: offer.id, status: 'cancelled' })
                }
                onDelete={() => deleteOffer.mutate(offer.id)}
                onReactivate={() => setReactivateTarget(offer)}
              />
            ))}
          </div>
        )}

        {/* ── Pagination ───────────────────────────────────────────────────── */}
        {meta && meta.totalPages > 1 && (
          <div className='flex items-center justify-between pt-1'>
            <p className='text-xs text-slate-500'>
              {t('merchantOffers.pagination', {
                page: meta.page,
                totalPages: meta.totalPages,
                total: meta.total,
              })}
            </p>
            <div className='flex gap-1'>
              <button
                type='button'
                disabled={!meta.hasPreviousPage}
                onClick={() => setPage(p => p - 1)}
                className='h-8 w-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors'
              >
                <ChevronLeft className='h-4 w-4' />
              </button>
              <button
                type='button'
                disabled={!meta.hasNextPage}
                onClick={() => setPage(p => p + 1)}
                className='h-8 w-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors'
              >
                <ChevronRight className='h-4 w-4' />
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
