'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Star, ChevronLeft, ChevronRight, ShoppingBag } from 'lucide-react';
import { cn } from '@foodwaste/ui';

// ─── Types ──────────────────────────────────────────────────────────────────
export interface TrendingOfferItem {
  id: string;
  name: string;
  image: string;
  price: string;
  rating: number;
  orderCount: number;
}

interface TrendingOffersProps {
  offers: TrendingOfferItem[];
  title: string;
  orderLabel: string;
  viewAllHref?: string;
}

const ITEMS_PER_PAGE = 4;

// ─── Component ──────────────────────────────────────────────────────────────
export function TrendingOffers({
  offers,
  title,
  orderLabel,
  viewAllHref,
}: TrendingOffersProps) {
  const [page, setPage] = useState(0);

  const pageCount = Math.max(1, Math.ceil(offers.length / ITEMS_PER_PAGE));
  const visibleOffers = offers.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE);
  const canPrev = page > 0;
  const canNext = page < pageCount - 1;

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
      {/* ── Header ── */}
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-base font-semibold tracking-tight text-slate-900">{title}</h3>

        <div className="flex items-center gap-2">
          {viewAllHref && (
            <Link
              href={viewAllHref}
              className="text-xs text-indigo-600 hover:text-indigo-700 font-medium transition-colors"
            >
              View all
            </Link>
          )}

          {/* Prev / Next arrows — only rendered when there are multiple pages */}
          {pageCount > 1 && (
            <div className="flex gap-1">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={!canPrev}
                aria-label="Previous page"
                className={cn(
                  'w-6 h-6 rounded-md flex items-center justify-center transition-colors',
                  canPrev
                    ? 'text-slate-600 hover:bg-slate-100'
                    : 'text-slate-200 cursor-not-allowed',
                )}
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                disabled={!canNext}
                aria-label="Next page"
                className={cn(
                  'w-6 h-6 rounded-md flex items-center justify-center transition-colors',
                  canNext
                    ? 'text-slate-800 hover:bg-slate-100'
                    : 'text-slate-200 cursor-not-allowed',
                )}
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Empty state ── */}
      {offers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
          <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center">
            <ShoppingBag className="w-5 h-5 text-slate-300" />
          </div>
          <p className="text-sm text-slate-400">No offers yet</p>
          {viewAllHref && (
            <Link
              href={viewAllHref}
              className="text-xs text-indigo-600 hover:underline font-medium"
            >
              Create your first offer
            </Link>
          )}
        </div>
      ) : (
        <>
          {/* ── Offer grid (2 × 2) ── */}
          <div className="grid grid-cols-2 gap-3">
            {visibleOffers.map((offer) => (
              <div
                key={offer.id}
                className="bg-slate-50 p-3 rounded-lg relative group cursor-pointer hover:bg-slate-100 transition-colors"
              >
                {/* Rating badge */}
                <div className="absolute top-3 right-3 bg-white px-1.5 py-0.5 rounded-md text-[10px] font-semibold flex items-center gap-0.5 shadow-sm z-10">
                  <Star className="w-2.5 h-2.5 fill-yellow-400 text-yellow-400" />
                  {offer.rating > 0 ? offer.rating.toFixed(1) : '—'}
                </div>

                {/* Product image */}
                <div className="h-24 w-full flex items-center justify-center mb-3">
                  <Image
                    src={offer.image}
                    alt={offer.name}
                    width={64}
                    height={64}
                    className="h-16 w-auto object-contain drop-shadow-lg group-hover:scale-110 transition-transform duration-300"
                  />
                </div>

                {/* Name + price row */}
                <p className="text-xs text-slate-500 mb-0.5 truncate">{offer.name}</p>
                <div className="flex justify-between items-end">
                  <h4 className="text-sm font-semibold text-slate-900">{offer.price}</h4>
                  <span className="text-[10px] text-slate-400">
                    {orderLabel}{' '}
                    <strong className="text-slate-700">{offer.orderCount}</strong>
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* ── Page indicator dots ── */}
          {pageCount > 1 && (
            <div className="flex justify-center gap-1.5 mt-3">
              {Array.from({ length: pageCount }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setPage(i)}
                  aria-label={`Go to page ${i + 1}`}
                  className={cn(
                    'h-1.5 rounded-full transition-all duration-200',
                    i === page ? 'bg-slate-700 w-3' : 'bg-slate-200 hover:bg-slate-300 w-1.5',
                  )}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
