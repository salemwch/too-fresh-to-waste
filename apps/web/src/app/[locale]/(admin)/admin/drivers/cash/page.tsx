'use client';

import { useCallback, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  AlertTriangle,
  ArrowLeft,
  Banknote,
  HandCoins,
  PackageX,
  Receipt,
  Truck,
  Wallet,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from '@foodwaste/ui';

import { AdminDataTable, type ColumnDef } from '@/components/dashboard/admin/admin-data-table';
import { AdminKpiRow, type KpiItem } from '@/components/dashboard/admin/admin-kpi-row';
import { AdminModuleHeader } from '@/components/dashboard/admin/admin-module-header';
import { useDrivers } from '@/hooks/use-drivers';
import {
  useDriverCashReconciliation,
  useMoveDriverFloat,
  useRecordDriverHandover,
  useResolveDeliveryRecovery,
} from '@/hooks/use-driver-cash';
import { Link } from '@/i18n/routing';
import { parseCashAmount } from '@/lib/cash-amount';
import { formatMoney } from '@/lib/format';
import { cn } from '@/lib/utils';

import type { DriverCashFlag, DriverCashRow, DriverPendingRecovery } from '@/types/admin';

/**
 * Driver cash - the admin side of the delivery money model
 * (.claude/work/commission-settlement-model.md, "Driver cash").
 *
 * Expected vs collected vs handed over vs outstanding, per driver, with every
 * reconciliation flag the backend raises. Admins record counted handovers,
 * move the TFTW float, and decide failed deliveries still pending recovery.
 * Nothing here computes money: every figure is the backend's.
 */

const PAGE_SIZE = 10;

/** AdminDataTable keys rows by `id`; a driver has one reconciliation row. */
type CashTableRow = DriverCashRow & { id: string };

const NO_ROWS: readonly CashTableRow[] = Object.freeze([]) as readonly CashTableRow[];

/** Flags that mean money may be missing - shown as destructive, not neutral. */
const SEVERE: ReadonlySet<DriverCashFlag> = new Set<DriverCashFlag>([
  'SHORT_COLLECTION',
  'STALE_UNDELIVERED',
  'UNALLOCATED_HANDOVER',
  'EXPECTED_COLLECTED_MISMATCH',
]);

type DialogState =
  | { kind: 'handover'; driverId: string }
  | { kind: 'float'; driverId: string }
  | {
      kind: 'recovery';
      recovery: DriverPendingRecovery;
      outcome: 'RETURNED_TO_MERCHANT' | 'UNRECOVERABLE';
    }
  | null;

export default function DriverCashPage() {
  const t = useTranslations('adminDrivers.cash');
  const locale = useLocale();
  const money = useCallback((value: number) => formatMoney(locale, value), [locale]);

  const { data, isLoading, isError } = useDriverCashReconciliation();
  const { data: drivers } = useDrivers();
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<DialogState>(null);
  const closeDialog = useCallback(() => setDialog(null), []);

  const names = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of drivers ?? []) {
      map.set(d._id, `${d.firstName} ${d.lastName}`.trim());
    }
    return map;
  }, [drivers]);

  const rows: readonly CashTableRow[] = useMemo(
    () => (data ? data.drivers.map(d => ({ ...d, id: d.driverId })) : NO_ROWS),
    [data],
  );
  const pageRows = useMemo(
    () => rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [rows, page],
  );
  const pending = useMemo(() => rows.flatMap(r => r.pendingRecoveries), [rows]);

  const kpis: KpiItem[] = useMemo(() => {
    const totals = data?.totals;
    const v = (n: number | undefined) => money(n ?? 0);
    return [
      { label: t('kpiExpected'), value: v(totals?.expectedCash), icon: Receipt },
      { label: t('kpiCollected'), value: v(totals?.collectedCash), icon: Banknote },
      { label: t('kpiHandedOver'), value: v(totals?.handedOverCash), icon: HandCoins },
      {
        label: t('kpiOwedByDrivers'),
        value: v(totals?.outstandingOwedByDriver),
        icon: Wallet,
        highlight: (totals?.outstandingOwedByDriver ?? 0) > 0,
      },
    ];
  }, [data, money, t]);

  const revenueKpis: KpiItem[] = useMemo(() => {
    const totals = data?.totals;
    const v = (n: number | undefined) => money(n ?? 0);
    return [
      { label: t('kpiOwedToDrivers'), value: v(totals?.outstandingOwedToDriver), icon: Truck },
      { label: t('kpiDeliveryRevenue'), value: v(totals?.tftwDeliveryRevenue), icon: Receipt },
      { label: t('kpiSettlement'), value: v(totals?.tftwCommissionSettlement), icon: HandCoins },
      { label: t('kpiLoss'), value: v(totals?.lossAmount), icon: PackageX },
    ];
  }, [data, money, t]);

  const columns: ColumnDef<CashTableRow>[] = useMemo(
    () => [
      {
        key: 'driver',
        header: t('colDriver'),
        render: row => (
          <span className='font-medium text-foreground'>
            {names.get(row.driverId) ?? t('unknownDriver')}
          </span>
        ),
      },
      {
        key: 'float',
        header: t('colFloat'),
        className: 'text-end',
        render: row => <span className='font-mono tabular-nums'>{money(row.float)}</span>,
      },
      {
        key: 'owedBy',
        header: t('colOwedByDriver'),
        className: 'text-end',
        render: row => (
          <span className='font-mono tabular-nums'>{money(row.outstandingOwedByDriver)}</span>
        ),
      },
      {
        key: 'owedTo',
        header: t('colOwedToDriver'),
        className: 'text-end',
        render: row => (
          <span className='font-mono tabular-nums'>{money(row.outstandingOwedToDriver)}</span>
        ),
      },
      {
        key: 'hold',
        header: t('colShouldHold'),
        className: 'text-end',
        render: row => (
          <span className='font-mono font-semibold tabular-nums'>
            {money(row.cashDriverShouldHold)}
          </span>
        ),
      },
      {
        key: 'flags',
        header: t('colFlags'),
        render: row =>
          row.flags.length === 0 ? (
            <span className='text-sm text-muted-foreground'>{t('noFlags')}</span>
          ) : (
            <div className='flex flex-wrap gap-xs'>
              {row.flags.map(flag => (
                <Badge key={flag} variant={SEVERE.has(flag) ? 'destructive' : 'outline'}>
                  {t(`flag${flag}`)}
                </Badge>
              ))}
            </div>
          ),
      },
      {
        key: 'actions',
        header: t('colActions'),
        render: row => (
          <div className='flex flex-wrap gap-xs'>
            <Button
              size='sm'
              onClick={() => setDialog({ kind: 'handover', driverId: row.driverId })}
            >
              {t('recordHandover')}
            </Button>
            <Button
              size='sm'
              variant='outline'
              onClick={() => setDialog({ kind: 'float', driverId: row.driverId })}
            >
              {t('moveFloat')}
            </Button>
          </div>
        ),
      },
    ],
    [money, names, t],
  );

  return (
    <div className='space-y-lg'>
      <AdminModuleHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <Link
            href='/admin/drivers'
            className='inline-flex min-h-11 items-center gap-xs rounded-md text-sm font-medium text-primary-500 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
          >
            <ArrowLeft size={16} aria-hidden='true' className='rtl:rotate-180' />
            {t('back')}
          </Link>
        }
      />

      {isError ? (
        <div
          role='alert'
          className='rounded-xl border border-destructive/30 bg-destructive/5 p-md text-sm text-destructive'
        >
          {t('error')}
        </div>
      ) : null}

      <AdminKpiRow items={kpis} loading={isLoading} columns={4} />
      <AdminKpiRow items={revenueKpis} loading={isLoading} columns={4} />

      <AdminDataTable<CashTableRow>
        columns={columns}
        data={pageRows}
        isLoading={isLoading}
        page={page}
        totalPages={Math.max(1, Math.ceil(rows.length / PAGE_SIZE))}
        total={rows.length}
        onPageChange={setPage}
        emptyIcon={Wallet}
        emptyTitle={t('emptyTitle')}
        emptyDescription={t('emptyDescription')}
      />

      <section aria-labelledby='pending-recoveries' className='space-y-sm'>
        <h2 id='pending-recoveries' className='flex items-center gap-xs text-md font-semibold'>
          <AlertTriangle size={16} aria-hidden='true' className='text-warning' />
          {t('pendingTitle')}
        </h2>
        {pending.length === 0 ? (
          <p className='text-sm text-muted-foreground'>{t('pendingEmpty')}</p>
        ) : (
          <ul className='divide-y divide-border rounded-xl border border-border bg-card'>
            {pending.map(p => (
              <li
                key={p.orderId}
                className='flex flex-wrap items-center justify-between gap-sm p-md'
              >
                <div className='min-w-0'>
                  <p className='font-mono text-sm text-foreground'>
                    #{p.orderId.slice(-6).toUpperCase()}
                  </p>
                  <p className='text-sm text-muted-foreground'>
                    {t('pendingPaid', { amount: money(p.paidToMerchant) })}
                  </p>
                </div>
                <div className='flex flex-wrap gap-xs'>
                  <Button
                    size='sm'
                    variant='outline'
                    onClick={() =>
                      setDialog({ kind: 'recovery', recovery: p, outcome: 'RETURNED_TO_MERCHANT' })
                    }
                  >
                    {t('pendingReturned')}
                  </Button>
                  <Button
                    size='sm'
                    variant='destructive'
                    onClick={() =>
                      setDialog({ kind: 'recovery', recovery: p, outcome: 'UNRECOVERABLE' })
                    }
                  >
                    {t('pendingLost')}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {dialog?.kind === 'handover' ? (
        <HandoverDialog driverId={dialog.driverId} onClose={closeDialog} />
      ) : null}
      {dialog?.kind === 'float' ? (
        <FloatDialog driverId={dialog.driverId} onClose={closeDialog} />
      ) : null}
      {dialog?.kind === 'recovery' ? (
        <RecoveryDialog
          recovery={dialog.recovery}
          outcome={dialog.outcome}
          money={money}
          onClose={closeDialog}
        />
      ) : null}
    </div>
  );
}

// ── Dialogs (web rule 14: multi-option flows live in a Dialog) ────────────────

function HandoverDialog({ driverId, onClose }: { driverId: string; onClose: () => void }) {
  const t = useTranslations('adminDrivers.cash');
  const [direction, setDirection] = useState<'in' | 'out'>('in');
  const [amountText, setAmountText] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { mutate, isPending } = useRecordDriverHandover();

  const submit = () => {
    const amount = parseCashAmount(amountText);
    if (amount === null) {
      setError(t('invalidAmount'));
      return;
    }
    const trimmed = notes.trim();
    mutate(
      {
        driverId,
        amount: direction === 'in' ? amount : -amount,
        ...(trimmed ? { notes: trimmed } : {}),
      },
      {
        onSuccess: () => {
          toast.success(t('saved'));
          onClose();
        },
        onError: () => setError(t('saveFailed')),
      },
    );
  };

  return (
    <Dialog open onOpenChange={open => !open && !isPending && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('handoverTitle')}</DialogTitle>
          <DialogDescription>{t('handoverHint')}</DialogDescription>
        </DialogHeader>

        <fieldset className='space-y-sm'>
          <legend className='sr-only'>{t('handoverTitle')}</legend>
          {(['in', 'out'] as const).map(value => (
            <label
              key={value}
              className={cn(
                'flex min-h-11 cursor-pointer items-center gap-sm rounded-lg border p-sm text-sm',
                direction === value ? 'border-primary-500 bg-primary-500/5' : 'border-border',
              )}
            >
              <input
                type='radio'
                name='handover-direction'
                value={value}
                checked={direction === value}
                onChange={() => setDirection(value)}
              />
              {value === 'in' ? t('handoverDirectionIn') : t('handoverDirectionOut')}
            </label>
          ))}
        </fieldset>

        <div className='space-y-xs'>
          <Label htmlFor='handover-amount'>{t('handoverAmount')}</Label>
          <Input
            id='handover-amount'
            inputMode='decimal'
            value={amountText}
            onChange={e => {
              setAmountText(e.target.value);
              setError(null);
            }}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'handover-error' : undefined}
          />
        </div>
        <div className='space-y-xs'>
          <Label htmlFor='handover-notes'>{t('handoverNotes')}</Label>
          <Input
            id='handover-notes'
            value={notes}
            maxLength={500}
            onChange={e => setNotes(e.target.value)}
          />
        </div>
        {error ? (
          <p id='handover-error' role='alert' className='text-sm text-destructive'>
            {error}
          </p>
        ) : null}

        <DialogFooter>
          <Button variant='outline' onClick={onClose} disabled={isPending}>
            {t('cancel')}
          </Button>
          <Button onClick={submit} disabled={isPending}>
            {t('submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FloatDialog({ driverId, onClose }: { driverId: string; onClose: () => void }) {
  const t = useTranslations('adminDrivers.cash');
  const [type, setType] = useState<'ISSUED' | 'RETURNED'>('ISSUED');
  const [amountText, setAmountText] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { mutate, isPending } = useMoveDriverFloat();

  const submit = () => {
    const amount = parseCashAmount(amountText);
    if (amount === null) {
      setError(t('invalidAmount'));
      return;
    }
    const trimmed = reason.trim();
    mutate(
      { driverId, type, amount, ...(trimmed ? { reason: trimmed } : {}) },
      {
        onSuccess: () => {
          toast.success(t('saved'));
          onClose();
        },
        onError: () => setError(t('saveFailed')),
      },
    );
  };

  return (
    <Dialog open onOpenChange={open => !open && !isPending && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('floatTitle')}</DialogTitle>
        </DialogHeader>

        <fieldset className='space-y-sm'>
          <legend className='sr-only'>{t('floatTitle')}</legend>
          {(['ISSUED', 'RETURNED'] as const).map(value => (
            <label
              key={value}
              className={cn(
                'flex min-h-11 cursor-pointer items-center gap-sm rounded-lg border p-sm text-sm',
                type === value ? 'border-primary-500 bg-primary-500/5' : 'border-border',
              )}
            >
              <input
                type='radio'
                name='float-type'
                value={value}
                checked={type === value}
                onChange={() => setType(value)}
              />
              {value === 'ISSUED' ? t('floatIssue') : t('floatReturn')}
            </label>
          ))}
        </fieldset>

        <div className='space-y-xs'>
          <Label htmlFor='float-amount'>{t('floatAmount')}</Label>
          <Input
            id='float-amount'
            inputMode='decimal'
            value={amountText}
            onChange={e => {
              setAmountText(e.target.value);
              setError(null);
            }}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'float-error' : undefined}
          />
        </div>
        <div className='space-y-xs'>
          <Label htmlFor='float-reason'>{t('floatReason')}</Label>
          <Input
            id='float-reason'
            value={reason}
            maxLength={500}
            onChange={e => setReason(e.target.value)}
          />
        </div>
        {error ? (
          <p id='float-error' role='alert' className='text-sm text-destructive'>
            {error}
          </p>
        ) : null}

        <DialogFooter>
          <Button variant='outline' onClick={onClose} disabled={isPending}>
            {t('cancel')}
          </Button>
          <Button onClick={submit} disabled={isPending}>
            {t('submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RecoveryDialog({
  recovery,
  outcome,
  money,
  onClose,
}: {
  recovery: DriverPendingRecovery;
  outcome: 'RETURNED_TO_MERCHANT' | 'UNRECOVERABLE';
  money: (value: number) => string;
  onClose: () => void;
}) {
  const t = useTranslations('adminDrivers.cash');
  const { mutate, isPending } = useResolveDeliveryRecovery();
  const amount = money(recovery.paidToMerchant);

  const confirm = () => {
    mutate(
      { orderId: recovery.orderId, recovery: outcome },
      {
        onSuccess: () => {
          toast.success(t('saved'));
          onClose();
        },
        onError: () => toast.error(t('saveFailed')),
      },
    );
  };

  return (
    <Dialog open onOpenChange={open => !open && !isPending && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('pendingConfirmTitle')}</DialogTitle>
          <DialogDescription>
            {outcome === 'RETURNED_TO_MERCHANT'
              ? t('pendingConfirmReturned', { amount })
              : t('pendingConfirmLost', { amount })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant='outline' onClick={onClose} disabled={isPending}>
            {t('cancel')}
          </Button>
          <Button
            variant={outcome === 'UNRECOVERABLE' ? 'destructive' : 'default'}
            onClick={confirm}
            disabled={isPending}
          >
            {outcome === 'RETURNED_TO_MERCHANT' ? t('pendingReturned') : t('pendingLost')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
