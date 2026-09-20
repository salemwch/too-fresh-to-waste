'use client';

import { useCallback, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { AlertTriangle, CheckCircle2, Percent, Scale, Store, Wallet } from 'lucide-react';
import { Badge, Button, Input, Label } from '@foodwaste/ui';

import { AdminModuleHeader } from '@/components/dashboard/admin/admin-module-header';
import { AdminKpiRow, type KpiItem } from '@/components/dashboard/admin/admin-kpi-row';
import { AdminDataTable, type ColumnDef } from '@/components/dashboard/admin/admin-data-table';
import {
  useCommissionCities,
  useCommissionMerchants,
  useCommissionSummary,
} from '@/hooks/use-commission';
import { formatMoney, formatRelative } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { CommissionMerchantRow, CommissionQuery, CommissionSortKey } from '@/types/admin';
import { CommissionLedgerSheet } from './commission-ledger-sheet';

const PAGE_SIZE = 20;
const PLACEHOLDER = '-';

/** The take rate the platform charges. Rows are measured against this. */
const TARGET_RATE = 0.19;

/**
 * A row is flagged when its realised rate is more than this far from target.
 * Two points allows for the ordinary lag of a merchant carrying a balance
 * between settlements; beyond that something is actually wrong.
 */
const RATE_TOLERANCE = 0.02;

/** Frozen so the table never receives a fresh array identity per render. */
const NO_ROWS: readonly CommissionMerchantRow[] = Object.freeze(
  [],
) as readonly CommissionMerchantRow[];

/** Quick filters, in the order an admin would reach for them. */
type PresetKey = 'all' | 'highBalance' | 'neverSettled' | 'rateDrift';

const PRESETS: { key: PresetKey; patch: Partial<CommissionQuery> }[] = [
  { key: 'all', patch: {} },
  { key: 'highBalance', patch: { minDue: 20, sortBy: 'commissionDue', sortOrder: 'desc' } },
  { key: 'neverSettled', patch: { neverSettled: true } },
  { key: 'rateDrift', patch: { rateDriftAbove: RATE_TOLERANCE } },
];

export default function AdminCommissionPage() {
  const t = useTranslations('adminCommission');
  const locale = useLocale();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [city, setCity] = useState('');
  const [minDue, setMinDue] = useState('');
  const [preset, setPreset] = useState<PresetKey>('all');
  const [sortBy, setSortBy] = useState<CommissionSortKey>('commissionDue');
  const [openLedgerFor, setOpenLedgerFor] = useState<CommissionMerchantRow | null>(null);

  const query = useMemo<CommissionQuery>(() => {
    const presetPatch = PRESETS.find(p => p.key === preset)?.patch ?? {};
    const parsedMin = Number.parseFloat(minDue);

    return {
      page,
      limit: PAGE_SIZE,
      sortBy,
      sortOrder: 'desc',
      ...presetPatch,
      ...(search.trim() ? { search: search.trim() } : {}),
      ...(city ? { city } : {}),
      // Explicit input wins over the preset's default floor.
      ...(minDue && !Number.isNaN(parsedMin) ? { minDue: parsedMin } : {}),
    };
  }, [page, search, city, minDue, preset, sortBy]);

  const { data, isLoading, isError, refetch } = useCommissionMerchants(query);
  const { data: summary } = useCommissionSummary();
  const { data: cities } = useCommissionCities();

  const rows = data?.rows ?? (NO_ROWS as CommissionMerchantRow[]);

  /** Any filter change invalidates the current page number. */
  const applyFilter = useCallback((fn: () => void) => {
    fn();
    setPage(1);
  }, []);

  const handleSearch = useCallback(
    (value: string) => applyFilter(() => setSearch(value)),
    [applyFilter],
  );

  const handlePreset = useCallback(
    (key: PresetKey) => applyFilter(() => setPreset(key)),
    [applyFilter],
  );

  const closeLedger = useCallback(() => setOpenLedgerFor(null), []);

  // ── KPIs ──────────────────────────────────────────────────────────────────

  const kpis = useMemo<KpiItem[]>(() => {
    const rate = summary?.effectiveRate;

    return [
      {
        label: t('kpi.outstanding'),
        value: summary ? formatMoney(locale, summary.totalDue) : PLACEHOLDER,
        icon: Wallet,
        iconBg: 'bg-primary-500/10',
        iconColor: 'text-primary-500',
        highlight: true,
      },
      {
        label: t('kpi.collected'),
        value: summary ? formatMoney(locale, summary.totalCollected) : PLACEHOLDER,
        icon: Scale,
        iconBg: 'bg-success/10',
        iconColor: 'text-success',
      },
      {
        label: t('kpi.effectiveRate'),
        value: rate != null ? `${(rate * 100).toFixed(1)}%` : PLACEHOLDER,
        icon: Percent,
        // The whole model depends on this landing on 19%. Colour it by whether
        // it did, so the failure is visible without reading the number.
        iconBg:
          rate != null && Math.abs(rate - TARGET_RATE) > RATE_TOLERANCE
            ? 'bg-warning/10'
            : 'bg-success/10',
        iconColor:
          rate != null && Math.abs(rate - TARGET_RATE) > RATE_TOLERANCE
            ? 'text-warning'
            : 'text-success',
      },
      {
        label: t('kpi.merchantsWithBalance'),
        value: summary ? String(summary.merchantsWithBalance) : PLACEHOLDER,
        icon: Store,
        iconBg: 'bg-secondary/10',
        iconColor: 'text-secondary',
      },
    ];
  }, [summary, locale, t]);

  // ── Columns ───────────────────────────────────────────────────────────────

  const columns = useMemo<ColumnDef<CommissionMerchantRow>[]>(
    () => [
      {
        key: 'merchant',
        header: t('col.merchant'),
        render: row => (
          <div className='min-w-0'>
            <p className='truncate font-semibold'>{row.establishmentName}</p>
            <p className='text-muted-foreground truncate text-xs'>
              {row.merchantName}
              {row.city ? ` · ${row.city}` : ''}
            </p>
          </div>
        ),
      },
      {
        key: 'commissionDue',
        header: t('col.due'),
        className: 'text-end',
        render: row => (
          <span
            className={cn(
              'font-mono font-semibold tabular-nums',
              row.commissionDue > 0 ? 'text-foreground' : 'text-muted-foreground',
            )}
          >
            {formatMoney(locale, row.commissionDue)}
          </span>
        ),
      },
      {
        key: 'gmv',
        header: t('col.gmv'),
        className: 'text-end',
        render: row => (
          <span className='font-mono tabular-nums'>{formatMoney(locale, row.gmv)}</span>
        ),
      },
      {
        key: 'collected',
        header: t('col.collected'),
        className: 'text-end',
        render: row => (
          <span className='font-mono tabular-nums'>{formatMoney(locale, row.collected)}</span>
        ),
      },
      {
        key: 'effectiveRate',
        header: t('col.rate'),
        className: 'text-end',
        render: row => {
          if (row.effectiveRate == null) {
            return <span className='text-muted-foreground'>{PLACEHOLDER}</span>;
          }

          const drifted = Math.abs(row.effectiveRate - TARGET_RATE) > RATE_TOLERANCE;

          return (
            <Badge
              variant={drifted ? 'destructive' : 'secondary'}
              className='font-mono tabular-nums'
            >
              {(row.effectiveRate * 100).toFixed(1)}%
            </Badge>
          );
        },
      },
      {
        key: 'lastSettlementAt',
        header: t('col.lastSettlement'),
        className: 'text-end',
        render: row => (
          <span className='text-muted-foreground text-xs'>
            {formatRelative(locale, row.lastSettlementAt) ?? t('never')}
          </span>
        ),
      },
    ],
    [t, locale],
  );

  // ── Filters ───────────────────────────────────────────────────────────────

  const filterSlot = (
    <div className='flex flex-wrap items-end gap-sm'>
      <div className='flex flex-wrap gap-xs'>
        {PRESETS.map(({ key }) => (
          <Button
            key={key}
            type='button'
            size='sm'
            variant={preset === key ? 'default' : 'outline'}
            onClick={() => handlePreset(key)}
          >
            {t(`preset.${key}`)}
          </Button>
        ))}
      </div>

      <div className='flex flex-col gap-xxs'>
        <Label htmlFor='commission-city' className='text-xs'>
          {t('filter.city')}
        </Label>
        <select
          id='commission-city'
          value={city}
          onChange={e => applyFilter(() => setCity(e.target.value))}
          className='border-input bg-background h-9 rounded-md border px-sm text-sm'
        >
          <option value=''>{t('filter.allCities')}</option>
          {cities?.map(c => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div className='flex flex-col gap-xxs'>
        <Label htmlFor='commission-min-due' className='text-xs'>
          {t('filter.minDue')}
        </Label>
        <Input
          id='commission-min-due'
          type='number'
          inputMode='decimal'
          min={0}
          step='0.5'
          value={minDue}
          onChange={e => applyFilter(() => setMinDue(e.target.value))}
          placeholder='0'
          className='h-9 w-28'
        />
      </div>

      <div className='flex flex-col gap-xxs'>
        <Label htmlFor='commission-sort' className='text-xs'>
          {t('filter.sortBy')}
        </Label>
        <select
          id='commission-sort'
          value={sortBy}
          onChange={e => applyFilter(() => setSortBy(e.target.value as CommissionSortKey))}
          className='border-input bg-background h-9 rounded-md border px-sm text-sm'
        >
          {(
            ['commissionDue', 'gmv', 'collected', 'effectiveRate', 'lastSettlementAt'] as const
          ).map(key => (
            <option key={key} value={key}>
              {t(
                `col.${key === 'lastSettlementAt' ? 'lastSettlement' : key === 'effectiveRate' ? 'rate' : key === 'commissionDue' ? 'due' : key}`,
              )}
            </option>
          ))}
        </select>
      </div>
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className='flex flex-col gap-lg'>
      <AdminModuleHeader title={t('title')} subtitle={t('subtitle')} />

      {/*
        Reconciliation banner. This is the one alarm on the screen: the ledger
        and the running balances are two independent records of the same money,
        and a drift means one of them has lost some. Rendered above the KPIs
        because no other number matters while it is broken.
      */}
      {summary && !summary.reconciled && (
        <div
          role='alert'
          className='border-destructive/40 bg-destructive/5 flex items-start gap-sm rounded-lg border p-md'
        >
          <AlertTriangle aria-hidden='true' className='text-destructive mt-0.5 size-5 shrink-0' />
          <div className='min-w-0'>
            <p className='text-destructive font-semibold'>{t('reconcile.brokenTitle')}</p>
            <p className='text-muted-foreground mt-xxs text-sm'>
              {t('reconcile.brokenBody', {
                delta: formatMoney(locale, summary.reconciliationDelta),
              })}
            </p>
          </div>
        </div>
      )}

      {summary?.reconciled && (
        <p className='text-muted-foreground flex items-center gap-xs text-xs'>
          <CheckCircle2 aria-hidden='true' className='text-success size-4 shrink-0' />
          {t('reconcile.ok')}
        </p>
      )}

      <AdminKpiRow items={kpis} />

      {isError ? (
        <div className='border-border flex flex-col items-center justify-center gap-sm rounded-lg border py-4xl text-center'>
          <AlertTriangle aria-hidden='true' className='text-muted-foreground size-12' />
          <h3 className='text-md font-semibold'>{t('error.title')}</h3>
          <p className='text-muted-foreground max-w-xs text-sm'>{t('error.body')}</p>
          <Button type='button' variant='outline' onClick={() => void refetch()}>
            {t('error.retry')}
          </Button>
        </div>
      ) : (
        <AdminDataTable
          columns={columns}
          data={rows}
          isLoading={isLoading}
          page={page}
          totalPages={data?.totalPages ?? 1}
          total={data?.total ?? 0}
          onPageChange={setPage}
          searchValue={search}
          searchPlaceholder={t('searchPlaceholder')}
          onSearchChange={handleSearch}
          onRowClick={setOpenLedgerFor}
          filterSlot={filterSlot}
          emptyIcon={Wallet}
          emptyTitle={t('empty.title')}
          emptyDescription={t('empty.body')}
        />
      )}

      <CommissionLedgerSheet merchant={openLedgerFor} onClose={closeLedger} />
    </div>
  );
}
