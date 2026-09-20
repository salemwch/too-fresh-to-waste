'use client';

import { memo, useCallback, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Settings2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Badge, Button, Separator, Sheet, SheetContent, SheetTitle, Skeleton } from '@foodwaste/ui';

import { useCommissionLedger } from '@/hooks/use-commission';
import { formatDateTime, formatMoney } from '@/lib/format';
import { cn } from '@/lib/utils';
import type {
  CommissionLedgerRow,
  CommissionLedgerType,
  CommissionMerchantRow,
} from '@/types/admin';

/** Frozen — a fresh array in render gives every child a new prop identity. */
const EMPTY_ROWS: readonly CommissionLedgerRow[] = Object.freeze(
  [],
) as readonly CommissionLedgerRow[];
const SKELETON_ROWS = Object.freeze([0, 1, 2, 3, 4, 5]);

/**
 * How each movement reads to an admin.
 *
 * Accrual and settlement are both ordinary; only reversal and adjustment are
 * exceptional, so only those two get a colour that draws the eye. Colouring
 * every row would make the exceptional ones invisible.
 */
const TYPE_STYLE: Record<
  CommissionLedgerType,
  {
    icon: LucideIcon;
    sign: '+' | '-';
    tone: string;
    badge: 'secondary' | 'outline' | 'destructive';
  }
> = {
  accrual: { icon: ArrowUpRight, sign: '+', tone: 'text-muted-foreground', badge: 'outline' },
  settlement: { icon: ArrowDownRight, sign: '-', tone: 'text-success', badge: 'secondary' },
  reversal: { icon: RotateCcw, sign: '-', tone: 'text-warning', badge: 'destructive' },
  adjustment: { icon: Settings2, sign: '-', tone: 'text-warning', badge: 'destructive' },
};

interface Props {
  merchant: CommissionMerchantRow | null;
  onClose: () => void;
}

function LedgerRow({
  row,
  locale,
  label,
}: {
  row: CommissionLedgerRow;
  locale: string;
  label: string;
}) {
  const style = TYPE_STYLE[row.type];
  const Icon = style.icon;

  return (
    <li className='flex items-start gap-sm py-sm'>
      <Icon aria-hidden='true' className={cn('mt-0.5 size-4 shrink-0', style.tone)} />

      <div className='min-w-0 flex-1'>
        <div className='flex items-baseline justify-between gap-sm'>
          <Badge variant={style.badge} className='shrink-0'>
            {label}
          </Badge>
          <span className={cn('font-mono text-sm font-semibold tabular-nums', style.tone)}>
            {style.sign}
            {formatMoney(locale, row.amount)}
          </span>
        </div>

        <p className='text-muted-foreground mt-xxs text-xs'>
          {formatDateTime(locale, row.createdAt)}
          {row.orderSubtotal != null && ` · ${formatMoney(locale, row.orderSubtotal)}`}
        </p>

        {row.reason && <p className='text-muted-foreground mt-xxs text-xs italic'>{row.reason}</p>}
      </div>

      <span className='text-muted-foreground shrink-0 font-mono text-xs tabular-nums'>
        {formatMoney(locale, row.balanceAfter)}
      </span>
    </li>
  );
}

const MemoLedgerRow = memo(LedgerRow);

export function CommissionLedgerSheet({ merchant, onClose }: Props) {
  const t = useTranslations('adminCommission');
  const locale = useLocale();
  const [page, setPage] = useState(1);

  const { data, isLoading } = useCommissionLedger(merchant?.establishmentId ?? null, page);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        setPage(1);
        onClose();
      }
    },
    [onClose],
  );

  const rows = data?.rows ?? (EMPTY_ROWS as CommissionLedgerRow[]);
  const totalPages = data?.totalPages ?? 1;

  return (
    <Sheet open={!!merchant} onOpenChange={handleOpenChange}>
      <SheetContent className='flex w-full flex-col gap-0 p-0 sm:max-w-lg'>
        <div className='border-border border-b p-lg'>
          <SheetTitle className='truncate'>{merchant?.establishmentName ?? ''}</SheetTitle>
          <p className='text-muted-foreground mt-xxs text-sm'>{t('ledger.subtitle')}</p>

          <div className='mt-md flex items-baseline gap-sm'>
            <span className='text-muted-foreground text-xs'>{t('ledger.currentDue')}</span>
            <span className='font-mono text-2xl font-bold tabular-nums'>
              {formatMoney(locale, data?.commissionDue ?? merchant?.commissionDue ?? 0)}
            </span>
          </div>
        </div>

        <div className='min-h-0 flex-1 overflow-y-auto px-lg'>
          {isLoading ? (
            <ul className='divide-border divide-y'>
              {SKELETON_ROWS.map(i => (
                <li key={i} className='flex items-start gap-sm py-sm'>
                  <Skeleton className='size-4 shrink-0 rounded-full' />
                  <div className='flex-1 space-y-xs'>
                    <Skeleton className='h-4 w-2/3' />
                    <Skeleton className='h-3 w-1/2' />
                  </div>
                </li>
              ))}
            </ul>
          ) : rows.length === 0 ? (
            <div className='flex flex-col items-center justify-center gap-sm py-4xl text-center'>
              <Settings2 aria-hidden='true' className='text-muted-foreground size-12' />
              <h3 className='text-md font-semibold'>{t('ledger.emptyTitle')}</h3>
              <p className='text-muted-foreground max-w-xs text-sm'>{t('ledger.emptyBody')}</p>
            </div>
          ) : (
            <>
              <div className='text-muted-foreground flex items-center justify-between py-sm text-xs font-medium uppercase tracking-wide'>
                <span>{t('ledger.movement')}</span>
                <span>{t('ledger.balanceAfter')}</span>
              </div>
              <Separator />
              <ul className='divide-border divide-y'>
                {rows.map(row => (
                  <MemoLedgerRow
                    key={row.id}
                    row={row}
                    locale={locale}
                    label={t(`ledger.type.${row.type}`)}
                  />
                ))}
              </ul>
            </>
          )}
        </div>

        {totalPages > 1 && (
          <div className='border-border flex items-center justify-between border-t p-lg'>
            <Button
              type='button'
              variant='outline'
              size='sm'
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
            >
              {/* Chevrons self-mirror under RTL; see rtl_horizontal_scrollview_mirroring. */}
              <ChevronLeft aria-hidden='true' className='size-4 rtl:rotate-180' />
              {t('ledger.prev')}
            </Button>
            <span className='text-muted-foreground text-xs tabular-nums'>
              {page} / {totalPages}
            </span>
            <Button
              type='button'
              variant='outline'
              size='sm'
              disabled={page >= totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            >
              {t('ledger.next')}
              <ChevronRight aria-hidden='true' className='size-4 rtl:rotate-180' />
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
