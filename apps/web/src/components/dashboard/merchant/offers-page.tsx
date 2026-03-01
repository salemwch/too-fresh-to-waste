'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Plus, Search, X, ChevronLeft, ChevronRight,
  AlertTriangle, Package, RefreshCw,
} from 'lucide-react';
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

const STATUS_TABS = [
  { key: 'all',       label: 'All'       },
  { key: 'active',    label: 'Active'    },
  { key: 'draft',     label: 'Draft'     },
  { key: 'sold_out',  label: 'Sold Out'  },
  { key: 'expired',   label: 'Expired'   },
  { key: 'cancelled', label: 'Cancelled' },
] as const;

type TabKey = typeof STATUS_TABS[number]['key'];

const TYPE_FILTER_OPTIONS = [
  { value: '',               label: 'All Types'     },
  { value: 'surprise_bag',   label: 'Surprise Bag'  },
  { value: 'specific_items', label: 'Specific Item' },
  { value: 'meal_deal',      label: 'Meal Deal'     },
];

const SORT_OPTIONS = [
  { value: 'newest',     label: 'Newest first' },
  { value: 'oldest',     label: 'Oldest first' },
  { value: 'price_asc',  label: 'Price ↑'      },
  { value: 'price_desc', label: 'Price ↓'      },
];

// ─── Pickup time helpers (mirrored from surprise-bag-panel) ──────────────────

const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2);
  const m = (i % 2) * 30;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
});

const UNTIL_OPTIONS = [...TIME_OPTIONS.slice(1), '00:00'];

const REACTIVATE_PRESETS = [
  { label: 'Lunch',   from: '12:00', until: '14:00' },
  { label: 'Dinner',  from: '18:00', until: '21:00' },
  { label: 'All Day', from: '08:00', until: '22:00' },
] as const;

function getAvailableFromTimes(day: 'today' | 'tomorrow'): string[] {
  if (day === 'tomorrow') return TIME_OPTIONS;
  const now       = new Date();
  const bufferMs  = 30 * 60 * 1000;
  const nowMs     = (now.getHours() * 60 + now.getMinutes()) * 60 * 1000;
  return TIME_OPTIONS.filter((t) => {
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
  color: string;
}

function StatChip({ label, count, color }: StatChipProps) {
  return (
    <div className={cn('flex-1 min-w-[80px] rounded-xl border px-4 py-3 text-center', color)}>
      <p className="text-lg font-bold tabular-nums">{count}</p>
      <p className="text-[11px] font-medium mt-0.5 opacity-80">{label}</p>
    </div>
  );
}

// ─── Empty state ─────────────────────────────────────────────────────────────

function EmptyOffers({ hasFilters, onClear }: { hasFilters: boolean; onClear: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Package className="h-12 w-12 text-slate-300 mb-4" />
      <p className="text-sm font-semibold text-slate-700">
        {hasFilters ? 'No offers match your filters' : 'No offers yet'}
      </p>
      <p className="text-xs text-slate-500 mt-1 max-w-xs">
        {hasFilters
          ? 'Try clearing the filters to see all offers.'
          : 'Create your first offer to start selling to customers.'}
      </p>
      {hasFilters && (
        <button
          type="button"
          onClick={onClear}
          className="mt-4 text-xs font-semibold text-primary hover:underline"
        >
          Clear filters
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
}

function ReactivateModal({ offer, isPending, onClose, onConfirm }: ReactivateModalProps) {
  const [day,         setDay]   = useState<'today' | 'tomorrow'>('tomorrow');
  const [pickupFrom,  setFrom]  = useState('12:00');
  const [pickupUntil, setUntil] = useState('14:00');
  const [quantity,    setQty]   = useState(offer.totalQuantity ?? 5);

  const fromOptions = useMemo(() => getAvailableFromTimes(day), [day]);

  // Correct stale "from" value when day changes
  useEffect(() => {
    if (fromOptions.length > 0 && !fromOptions.includes(pickupFrom)) {
      setFrom(fromOptions[0] ?? '12:00');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day]);

  function applyPreset(preset: typeof REACTIVATE_PRESETS[number]) {
    const available = getAvailableFromTimes(day);
    setFrom(available.includes(preset.from) ? preset.from : (available[0] ?? preset.from));
    setUntil(preset.until);
  }

  function handleConfirm() {
    const overflow = pickupUntil === '00:00';
    onConfirm({
      availableFrom:    toISO(day, pickupFrom),
      availableUntil:   toISO(day, pickupUntil, overflow),
      pickupTimeSlots:  [{ startTime: pickupFrom, endTime: pickupUntil }],
      totalQuantity:    quantity,
      timezone:         Intl.DateTimeFormat().resolvedOptions().timeZone,
      isPickupToday:    day === 'today',
      isPickupTomorrow: day === 'tomorrow',
    });
  }

  const canConfirm = day === 'tomorrow' || fromOptions.length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <p className="text-sm font-bold text-slate-900">Reactivate Offer</p>
            <p className="text-xs text-slate-500 mt-0.5 truncate max-w-[220px]">{offer.title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 hover:bg-slate-100 transition-colors"
          >
            <X className="h-4 w-4 text-slate-500" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">

          {/* Day toggle */}
          <div>
            <p className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-2">
              Pickup day
            </p>
            <div className="flex gap-2">
              {(['today', 'tomorrow'] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDay(d)}
                  className={cn(
                    'flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all',
                    day === d
                      ? 'bg-primary text-white border-primary'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-primary/40',
                  )}
                >
                  {d === 'today' ? 'Today' : 'Tomorrow'}
                </button>
              ))}
            </div>
            {day === 'today' && fromOptions.length === 0 && (
              <p className="text-[10px] text-amber-600 mt-1.5">
                No time slots available today — switch to Tomorrow.
              </p>
            )}
          </div>

          {/* Quick presets */}
          <div>
            <p className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-2">
              Quick presets
            </p>
            <div className="flex gap-2">
              {REACTIVATE_PRESETS.map((p) => {
                const resolvedFrom = fromOptions.includes(p.from) ? p.from : (fromOptions[0] ?? p.from);
                const isActive = pickupFrom === resolvedFrom && pickupUntil === p.until;
                return (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => applyPreset(p)}
                    className={cn(
                      'flex-1 flex flex-col items-center rounded-lg border py-1.5 px-1 transition-all',
                      isActive
                        ? 'border-primary bg-primary/8 text-primary'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-primary/30',
                    )}
                  >
                    <span className="text-[11px] font-semibold leading-none">{p.label}</span>
                    <span className={cn('text-[10px] mt-0.5 tabular-nums', isActive ? 'text-primary/70' : 'text-slate-400')}>
                      {p.from}–{p.until}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* From / Until selects — always visible */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-[10px] font-semibold text-slate-500 block mb-1">From</label>
              <select
                value={pickupFrom}
                onChange={(e) => setFrom(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {fromOptions.length === 0 ? (
                  <option disabled>No times available</option>
                ) : (
                  fromOptions.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))
                )}
              </select>
            </div>
            <div className="flex-1">
              <label className="text-[10px] font-semibold text-slate-500 block mb-1">Until</label>
              <select
                value={pickupUntil}
                onChange={(e) => setUntil(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {UNTIL_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t === '00:00' ? '00:00 (midnight)' : t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Live summary */}
          <p className="text-[11px] font-medium text-slate-600 tabular-nums">
            {day === 'today' ? 'Today' : 'Tomorrow'} · {pickupFrom} – {pickupUntil === '00:00' ? '00:00 (midnight)' : pickupUntil}
          </p>

          {/* Quantity */}
          <div>
            <p className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-2">
              Quantity
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="h-8 w-8 rounded-full border border-slate-200 text-slate-600 hover:bg-slate-100 text-base font-bold flex items-center justify-center transition-colors"
              >
                −
              </button>
              <span className="min-w-[2.5rem] text-center text-sm font-bold text-slate-900 tabular-nums">
                {quantity}
              </span>
              <button
                type="button"
                onClick={() => setQty((q) => Math.min(100, q + 1))}
                className="h-8 w-8 rounded-full border border-slate-200 text-slate-600 hover:bg-slate-100 text-base font-bold flex items-center justify-center transition-colors"
              >
                +
              </button>
              <span className="text-[11px] text-slate-400">bags (max 100)</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 pb-5">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-9 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canConfirm || isPending}
            onClick={handleConfirm}
            className={cn(
              'flex-1 h-9 rounded-xl bg-primary text-white text-sm font-bold transition-all',
              'hover:opacity-90 active:scale-[0.97]',
              'disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100',
              isPending && 'animate-pulse',
            )}
          >
            {isPending ? 'Reactivating…' : 'Reactivate'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function MerchantOffersView() {
  // ── UI state ────────────────────────────────────────────────────────────────
  const [panelOpen,        setPanelOpen]        = useState(false);
  const [activeTab,        setActiveTab]        = useState<TabKey>('all');
  const [search,           setSearch]           = useState('');
  const [typeFilter,       setTypeFilter]       = useState('');
  const [sort,             setSort]             = useState('newest');
  const [page,             setPage]             = useState(1);
  const [reactivateTarget, setReactivateTarget] = useState<MerchantOffer | null>(null);

  // ── Status counts (lightweight — limit=1, reads meta.total) ────────────────
  const activeCount    = (useOfferStatusCount('active').data    ?? 0);
  const draftCount     = (useOfferStatusCount('draft').data     ?? 0);
  const soldOutCount   = (useOfferStatusCount('sold_out').data  ?? 0);
  const expiredCount   = (useOfferStatusCount('expired').data   ?? 0);
  const cancelledCount = (useOfferStatusCount('cancelled').data ?? 0);
  const totalCount     = activeCount + draftCount + soldOutCount + expiredCount + cancelledCount;

  const TAB_COUNTS: Record<TabKey, number> = {
    all:       totalCount,
    active:    activeCount,
    draft:     draftCount,
    sold_out:  soldOutCount,
    expired:   expiredCount,
    cancelled: cancelledCount,
  };

  // ── Data ────────────────────────────────────────────────────────────────────
  const statusParam = activeTab === 'all' ? undefined : activeTab;
  const offersQuery = useMerchantOffersFiltered(page, PAGE_SIZE, statusParam);
  const estabQuery  = useMyEstablishment();
  const isEstablishmentApproved = estabQuery.data?.status === 'active';

  // ── Mutations ───────────────────────────────────────────────────────────────
  const updateStatus = useUpdateOfferStatus();
  const deleteOffer  = useDeleteOffer();
  const reactivate   = useReactivateOffer();
  const anyPending   = updateStatus.isPending || deleteOffer.isPending || reactivate.isPending;

  // ── Client-side filter + sort (applied on top of the server-paginated list) ─
  const displayedOffers = useMemo(() => {
    let list = offersQuery.data?.offers ?? [];

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((o) => o.title.toLowerCase().includes(q));
    }

    if (typeFilter) {
      list = list.filter((o) => o.type === typeFilter);
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

  const meta       = offersQuery.data?.meta;
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
          onConfirm={(payload) => {
            reactivate.mutate(
              { offerId: reactivateTarget.id, payload },
              { onSuccess: () => setReactivateTarget(null) },
            );
          }}
        />
      )}

      <div className="space-y-5">

        {/* ── Page header ──────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-lg font-bold tracking-tight text-slate-900">Offers</h1>
            <p className="text-sm text-slate-500 mt-0.5">Manage and track all your food offers</p>
          </div>
          <button
            type="button"
            onClick={() => setPanelOpen(true)}
            className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 active:scale-[0.97] transition-all"
          >
            <Plus className="h-4 w-4" />
            New Offer
          </button>
        </div>

        {/* ── Establishment approval banner ─────────────────────────────────── */}
        {!estabQuery.isLoading && !isEstablishmentApproved && (
          <div className="flex items-start gap-3 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800">Establishment awaiting approval</p>
              <p className="text-xs text-amber-700 mt-0.5">
                Your establishment has not been approved yet. You can create draft offers, but
                publishing them requires admin approval first.
              </p>
            </div>
          </div>
        )}

        {/* ── Stats chips ───────────────────────────────────────────────────── */}
        <div className="flex gap-3 flex-wrap">
          <StatChip label="Active"    count={activeCount}    color="border-emerald-200 bg-emerald-50  text-emerald-700" />
          <StatChip label="Draft"     count={draftCount}     color="border-slate-200   bg-slate-50   text-slate-600"   />
          <StatChip label="Sold Out"  count={soldOutCount}   color="border-red-200     bg-red-50     text-red-600"     />
          <StatChip label="Expired"   count={expiredCount}   color="border-amber-200   bg-amber-50   text-amber-700"  />
          <StatChip label="Cancelled" count={cancelledCount} color="border-slate-200   bg-white      text-slate-500"  />
        </div>

        {/* ── Status filter tabs ────────────────────────────────────────────── */}
        <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => handleTabChange(tab.key)}
              className={cn(
                'shrink-0 flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-semibold border transition-all',
                activeTab === tab.key
                  ? 'bg-primary text-white border-primary shadow-sm'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-primary/40 hover:text-primary',
              )}
            >
              {tab.label}
              <span
                className={cn(
                  'min-w-[18px] px-1 py-px rounded-full text-[10px] font-bold tabular-nums text-center',
                  activeTab === tab.key ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500',
                )}
              >
                {TAB_COUNTS[tab.key]}
              </span>
            </button>
          ))}
        </div>

        {/* ── Toolbar: search · type filter · sort ─────────────────────────── */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search offers…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full h-9 rounded-xl border border-slate-200 bg-white pl-8 pr-8 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <select
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
            className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            {TYPE_FILTER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          {offersQuery.isFetching && !offersQuery.isLoading && (
            <RefreshCw className="h-3.5 w-3.5 text-slate-400 animate-spin shrink-0" />
          )}
        </div>

        {/* ── Offer list ───────────────────────────────────────────────────── */}
        {offersQuery.isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-28 rounded-xl bg-slate-100 animate-pulse" />
            ))}
          </div>
        ) : offersQuery.isError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-6 text-center">
            <p className="text-sm font-medium text-red-700">Failed to load offers</p>
            <p className="text-xs text-red-500 mt-1">{(offersQuery.error as Error).message}</p>
          </div>
        ) : displayedOffers.length === 0 ? (
          <EmptyOffers hasFilters={hasFilters} onClear={handleClearFilters} />
        ) : (
          <div className="space-y-3">
            {displayedOffers.map((offer) => (
              <OfferCard
                key={offer.id}
                offer={offer}
                isEstablishmentApproved={isEstablishmentApproved}
                isPending={anyPending}
                onPublish={() =>
                  updateStatus.mutate({ offerId: offer.id, status: 'active' })
                }
                onMarkSoldOut={() =>
                  updateStatus.mutate({ offerId: offer.id, status: 'sold_out' })
                }
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
          <div className="flex items-center justify-between pt-1">
            <p className="text-xs text-slate-500">
              Page {meta.page} of {meta.totalPages} · {meta.total} offers
            </p>
            <div className="flex gap-1">
              <button
                type="button"
                disabled={!meta.hasPreviousPage}
                onClick={() => setPage((p) => p - 1)}
                className="h-8 w-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                disabled={!meta.hasNextPage}
                onClick={() => setPage((p) => p + 1)}
                className="h-8 w-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
