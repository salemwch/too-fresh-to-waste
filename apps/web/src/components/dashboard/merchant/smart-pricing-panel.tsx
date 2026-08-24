'use client';

import { useTranslations } from 'next-intl';
import { Lightbulb, TrendingUp, TrendingDown, Calendar, Clock, Target, Tag } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@foodwaste/ui';
import { Skeleton } from '@/components/ui/skeleton';
import { usePricingSuggestions } from '@/hooks/use-merchant-dashboard';
import { cn } from '@/lib/utils';
import type { PricingInsight, PricingInsightType } from '@/types/dashboard';

const INSIGHT_ICONS: Record<PricingInsightType, typeof TrendingUp> = {
  price_above_zone: TrendingDown,
  price_below_zone: TrendingUp,
  low_fill_rate: Target,
  best_day: Calendar,
  best_hour: Clock,
  low_discount: Tag,
};

/** Index-aligned with the backend's 0 = Sunday day numbering. */
const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

interface StatTileProps {
  value: string;
  label: string;
  /** Plain-language explanation — the whole point of the tile. */
  help: string;
}

function StatTile({ value, label, help }: StatTileProps) {
  return (
    <div className='rounded-lg border border-border/60 bg-muted/20 p-md'>
      {/* Numeric values and ranges stay LTR so "4.5–6 TND" does not reorder in Arabic. */}
      <p className='text-lg font-bold tabular-nums' dir='ltr'>
        {value}
      </p>
      <p className='text-[11px] font-semibold text-foreground/80'>{label}</p>
      <p className='mt-xs text-[10px] leading-snug text-muted-foreground'>{help}</p>
    </div>
  );
}

function PanelShell({ children }: { children: React.ReactNode }) {
  return <Card className='border-border/60'>{children}</Card>;
}

function SmartPricingPanelSkeleton() {
  return (
    <PanelShell>
      <CardHeader className='pb-md'>
        <Skeleton className='h-5 w-48 rounded' />
        <Skeleton className='h-3 w-64 rounded mt-xs' />
      </CardHeader>
      <CardContent className='space-y-md'>
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className='h-16 rounded-lg' />
        ))}
      </CardContent>
    </PanelShell>
  );
}

/**
 * Merchant pricing guide.
 *
 * The backend sends advice as `{ type, params }` and never as prose, so every
 * sentence here is resolved against the merchant's locale. It also reports the
 * provenance of each number (`zoneStats.scope`, `suggestedPriceRange.basis`,
 * `sample`), and this panel surfaces that rather than presenting bare figures:
 * a merchant cannot act on a number whose origin they cannot see.
 */
export function SmartPricingPanel() {
  const t = useTranslations('dashboard.merchantPricing');
  const { data, isLoading } = usePricingSuggestions();

  if (isLoading) return <SmartPricingPanelSkeleton />;
  // Web and backend deploy independently (Vercel / Render), so a browser can
  // hold a build that expects the keyed-advice payload while the API still
  // returns the old prose shape. Render nothing rather than throwing on a
  // missing `sample` or on an insight with no `params` to interpolate.
  if (!data?.sample || !data.merchantStats || !Array.isArray(data.insights)) return null;

  const { merchantStats, zoneStats, suggestedPriceRange, sample, insights } = data;

  const header = (
    <CardHeader className='pb-md'>
      <div className='flex items-center gap-sm'>
        <Lightbulb className='size-4 text-warning' aria-hidden='true' />
        <CardTitle className='text-sm font-semibold'>{t('title')}</CardTitle>
      </div>
      <CardDescription className='text-xs'>{t('subtitle')}</CardDescription>
    </CardHeader>
  );

  // A merchant with nothing published gets an explanation of what will appear
  // here, rather than a card that silently does not exist.
  if (merchantStats.totalOffers === 0) {
    return (
      <PanelShell>
        {header}
        <CardContent>
          <div className='flex flex-col items-center justify-center gap-sm py-2xl text-center'>
            <Lightbulb className='size-10 text-muted-foreground' aria-hidden='true' />
            <h3 className='text-sm font-semibold'>{t('empty.title')}</h3>
            <p className='max-w-sm text-xs text-muted-foreground'>{t('empty.body')}</p>
          </div>
        </CardContent>
      </PanelShell>
    );
  }

  return (
    <PanelShell>
      {header}
      <CardContent className='space-y-lg'>
        <div className='grid grid-cols-1 gap-md sm:grid-cols-2 lg:grid-cols-4'>
          <StatTile
            value={`${merchantStats.avgDiscountedPrice} TND`}
            label={t('tiles.avgPrice')}
            help={t('tiles.avgPriceHelp')}
          />
          <StatTile
            value={`${merchantStats.fillRate}%`}
            label={t('tiles.fillRate')}
            help={t('tiles.fillRateHelp')}
          />
          {zoneStats.scope !== 'none' && (
            <StatTile
              value={`${zoneStats.avgDiscountedPrice} TND`}
              label={t('tiles.peers')}
              help={t(
                zoneStats.scope === 'category_city' ? 'tiles.peersHelp' : 'tiles.peersHelpCity',
                { count: zoneStats.totalMerchants },
              )}
            />
          )}
          {suggestedPriceRange && (
            <StatTile
              value={`${suggestedPriceRange.min}–${suggestedPriceRange.max} ${suggestedPriceRange.currency}`}
              label={t('tiles.suggested')}
              help={t(
                suggestedPriceRange.basis === 'own_history'
                  ? 'tiles.suggestedHelpOwn'
                  : 'tiles.suggestedHelpZone',
              )}
            />
          )}
        </div>

        {insights.length > 0 && (
          <ul className='space-y-sm'>
            {insights.map(insight => (
              <InsightRow key={insight.type} insight={insight} />
            ))}
          </ul>
        )}

        <p className='text-[10px] text-muted-foreground'>
          {t('sampleNote', { offers: sample.merchantOffers, days: sample.windowDays })}
        </p>
      </CardContent>
    </PanelShell>
  );
}

function InsightRow({ insight }: { insight: PricingInsight }) {
  const t = useTranslations('dashboard.merchantPricing');
  const tDays = useTranslations('dashboard.merchantPricing.days');

  const Icon = INSIGHT_ICONS[insight.type];
  // An advice key this build does not know about, or one still carrying the old
  // prose shape, is skipped rather than rendered as a raw translation key.
  if (!Icon || !insight.params) return null;

  const isHigh = insight.impact === 'high';

  // `best_day` is the one message whose parameter is a word rather than a
  // number, so the day index is resolved to a translated name here.
  const dayKey = DAY_KEYS[insight.params.day ?? -1];
  if (insight.type === 'best_day' && !dayKey) return null;

  const values: Record<string, string | number> = dayKey
    ? { ...insight.params, day: tDays(dayKey) }
    : insight.params;

  return (
    <li
      className={cn(
        'flex items-start gap-md rounded-lg border px-md py-2.5',
        isHigh ? 'border-warning/40 bg-warning/5' : 'border-border/60 bg-muted/10',
      )}
    >
      <Icon
        className={cn('mt-xxs size-4 shrink-0', isHigh ? 'text-warning' : 'text-muted-foreground')}
        aria-hidden='true'
      />
      <p className='min-w-0 flex-1 text-xs leading-relaxed text-foreground'>
        {t(`insights.${insight.type}`, values)}
      </p>
    </li>
  );
}
