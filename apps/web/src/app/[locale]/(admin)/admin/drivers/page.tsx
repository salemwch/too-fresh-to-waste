'use client';

import { useCallback, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { z } from 'zod';
import { Check, Copy, Radio, Truck, Users, Wallet } from 'lucide-react';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from '@foodwaste/ui';
import { AdminModuleHeader } from '@/components/dashboard/admin/admin-module-header';
import { AdminKpiRow, type KpiItem } from '@/components/dashboard/admin/admin-kpi-row';
import { AdminDataTable, type ColumnDef } from '@/components/dashboard/admin/admin-data-table';
import { StatusBadge } from '@/components/dashboard/admin/status-badge';
import { useCreateDriver, useDrivers } from '@/hooks/use-drivers';
import { formatDate, formatMoney, formatRelative } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { CreateDriverResponse, DriverRow } from '@/types/admin';
import { DriverDetailSheet } from './driver-detail-sheet';

/** Module-level so the Dialog never receives a new handler identity. */
const NOOP = () => {};
const preventDefault = (e: Event) => e.preventDefault();

const PAGE_SIZE = 10;
const EM_DASH = '—';

/** Frozen so the table never receives a fresh array identity per render. */
const NO_DRIVERS: readonly DriverRow[] = Object.freeze([]) as readonly DriverRow[];

// ── Form ──────────────────────────────────────────────────────────────────────

type FormFields = 'firstName' | 'lastName' | 'email' | 'phoneNumber' | 'idCardNumber' | 'address';

const EMPTY_FORM: Record<FormFields, string> = {
  firstName: '',
  lastName: '',
  email: '',
  phoneNumber: '',
  idCardNumber: '',
  address: '',
};

/**
 * Field layout, three per row. Labels and placeholders are i18n keys resolved
 * at render — the shape itself is static so it lives outside the component.
 */
const FORM_ROWS: { name: FormFields; labelKey: string; placeholderKey: string }[][] = [
  [
    {
      name: 'firstName',
      labelKey: 'create.firstName',
      placeholderKey: 'create.firstNamePlaceholder',
    },
    { name: 'lastName', labelKey: 'create.lastName', placeholderKey: 'create.lastNamePlaceholder' },
    { name: 'email', labelKey: 'create.email', placeholderKey: 'create.emailPlaceholder' },
  ],
  [
    { name: 'phoneNumber', labelKey: 'create.phone', placeholderKey: 'create.phonePlaceholder' },
    { name: 'idCardNumber', labelKey: 'create.cin', placeholderKey: 'create.cinPlaceholder' },
    { name: 'address', labelKey: 'create.address', placeholderKey: 'create.addressPlaceholder' },
  ],
];

/**
 * Validation messages are i18n keys, not sentences — the component resolves
 * them so the same schema serves all three locales.
 */
const schema = z.object({
  firstName: z.string().trim().min(1, 'validation.required'),
  lastName: z.string().trim().min(1, 'validation.required'),
  email: z.string().trim().email('validation.invalidEmail'),
  phoneNumber: z
    .string()
    .transform(v => v.replace(/\s+/g, ''))
    .pipe(z.string().min(8, 'validation.invalidPhone')),
  idCardNumber: z
    .string()
    .trim()
    .length(8, 'validation.cinLength')
    .regex(/^\d{8}$/, 'validation.cinDigits'),
  address: z.string().trim().min(1, 'validation.required'),
});

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DriversPage() {
  const t = useTranslations('adminDrivers');
  const locale = useLocale();

  const { data, isLoading, isError } = useDrivers();
  const { mutateAsync: createDriver, isPending } = useCreateDriver();

  const drivers = data ?? NO_DRIVERS;

  const [values, setValues] = useState<Record<FormFields, string>>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<FormFields, string>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreateDriverResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // ── Derived data ────────────────────────────────────────────────────────────

  const kpis: KpiItem[] = useMemo(() => {
    let online = 0;
    let inProgress = 0;
    let earnings = 0;
    for (const d of drivers) {
      if (d.driverProfile?.isOnline) online += 1;
      inProgress += d.stats.activeCount;
      earnings += d.stats.totalEarnings;
    }
    return [
      {
        label: t('columns.driver'),
        value: String(drivers.length),
        icon: Users,
        iconBg: 'bg-primary/10',
        iconColor: 'text-primary',
      },
      {
        label: t('availability.online'),
        value: String(online),
        icon: Radio,
        iconBg: 'bg-success/10',
        iconColor: 'text-success',
      },
      {
        label: t('columns.inProgress'),
        value: String(inProgress),
        icon: Truck,
        iconBg: 'bg-secondary/10',
        iconColor: 'text-secondary',
      },
      {
        label: t('columns.earnings'),
        value: formatMoney(locale, earnings),
        icon: Wallet,
        iconBg: 'bg-accent/10',
        iconColor: 'text-accent',
      },
    ];
  }, [drivers, locale, t]);

  // The whole fleet arrives in one request, so search and paging stay on the
  // client — no round trip per keystroke.
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return drivers;
    return drivers.filter(d =>
      `${d.firstName} ${d.lastName} ${d.email} ${d.phoneNumber ?? ''} ${
        d.driverProfile?.idCardNumber ?? ''
      }`
        .toLowerCase()
        .includes(term),
    );
  }, [drivers, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = useMemo(
    () => filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filtered, safePage],
  );

  const columns: ColumnDef<DriverRow>[] = useMemo(
    () => [
      {
        key: 'driver',
        header: t('columns.driver'),
        render: d => (
          <div className='min-w-0'>
            <p className='truncate text-sm font-medium'>
              {d.firstName} {d.lastName}
            </p>
            <p className='truncate text-xs text-muted-foreground'>{d.email}</p>
          </div>
        ),
      },
      {
        key: 'contact',
        header: t('columns.contact'),
        render: d => (
          <div className='min-w-0'>
            <p className='truncate text-xs'>{d.phoneNumber ?? EM_DASH}</p>
            <p className='truncate text-[11px] text-muted-foreground'>
              {d.driverProfile?.address ?? EM_DASH}
            </p>
          </div>
        ),
      },
      {
        key: 'cin',
        header: t('columns.cin'),
        render: d => (
          <span className='font-mono text-xs'>{d.driverProfile?.idCardNumber ?? EM_DASH}</span>
        ),
      },
      {
        key: 'availability',
        header: t('columns.availability'),
        render: d => {
          const online = d.driverProfile?.isOnline ?? false;
          const lastSeen = formatRelative(locale, d.driverProfile?.lastOnlineAt ?? null);
          return (
            <div className='flex items-center gap-1.5'>
              <span
                aria-hidden='true'
                className={cn(
                  'size-2 shrink-0 rounded-full',
                  online ? 'bg-success' : 'bg-muted-foreground/40',
                )}
              />
              <div className='min-w-0'>
                <p className='text-xs font-medium'>
                  {online ? t('availability.online') : t('availability.offline')}
                </p>
                <p className='truncate text-[10px] text-muted-foreground'>
                  {lastSeen
                    ? t('availability.lastSeen', { when: lastSeen })
                    : t('availability.never')}
                </p>
              </div>
            </div>
          );
        },
      },
      {
        key: 'delivered',
        header: t('columns.delivered'),
        className: 'text-end',
        render: d => (
          <span className='text-sm font-semibold tabular-nums'>{d.stats.totalDelivered}</span>
        ),
      },
      {
        key: 'inProgress',
        header: t('columns.inProgress'),
        className: 'text-end',
        render: d => (
          <span
            className={cn(
              'text-sm tabular-nums',
              d.stats.activeCount > 0 ? 'font-semibold text-primary' : 'text-muted-foreground',
            )}
          >
            {d.stats.activeCount}
          </span>
        ),
      },
      {
        key: 'earnings',
        header: t('columns.earnings'),
        className: 'text-end',
        render: d => (
          <span className='text-xs tabular-nums'>{formatMoney(locale, d.stats.totalEarnings)}</span>
        ),
      },
      {
        key: 'status',
        header: t('columns.status'),
        render: d =>
          d.requiresPasswordChange ? (
            <Badge
              variant='outline'
              className='border-warning bg-warning/10 py-0 text-[10px] text-warning'
            >
              {t('accountStatus.pendingSetup')}
            </Badge>
          ) : (
            <StatusBadge
              status={d.status}
              variant='user'
              label={
                t.has(`accountStatus.${d.status}`)
                  ? t(`accountStatus.${d.status}`)
                  : t('accountStatus.unknown')
              }
            />
          ),
      },
      {
        key: 'joined',
        header: t('columns.joined'),
        render: d => (
          <span className='text-xs text-muted-foreground'>
            {formatDate(locale, d.createdAt) ?? EM_DASH}
          </span>
        ),
      },
    ],
    [locale, t],
  );

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleChange = useCallback((name: FormFields, value: string) => {
    setValues(prev => ({ ...prev, [name]: value }));
    setErrors(prev => (prev[name] ? { ...prev, [name]: undefined } : prev));
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setSubmitError(null);

      const parsed = schema.safeParse(values);
      if (!parsed.success) {
        const next: Partial<Record<FormFields, string>> = {};
        for (const issue of parsed.error.issues) {
          const field = issue.path[0] as FormFields | undefined;
          if (field && !next[field]) next[field] = issue.message;
        }
        setErrors(next);
        return;
      }

      try {
        setCreated(await createDriver(parsed.data));
        setValues(EMPTY_FORM);
        setErrors({});
      } catch {
        // The backend message is not guaranteed to be user-appropriate, so a
        // translated sentence is shown instead of anything from the exception.
        setSubmitError(t('create.error'));
      }
    },
    [createDriver, t, values],
  );

  const handleCopy = useCallback(async () => {
    if (!created) return;
    await navigator.clipboard.writeText(created.temporaryPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [created]);

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  const handleRowClick = useCallback((driver: DriverRow) => setSelectedId(driver._id), []);
  const handleSheetClose = useCallback(() => setSelectedId(null), []);
  const handleDialogDone = useCallback(() => setCreated(null), []);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className='space-y-xl'>
      <AdminModuleHeader title={t('title')} subtitle={t('subtitle')} />

      <AdminKpiRow items={kpis} loading={isLoading} columns={4} />

      {/* Create form */}
      <section className='rounded-lg border border-border/60 bg-card p-lg'>
        <h2 className='mb-md text-sm font-semibold text-foreground'>{t('create.title')}</h2>
        <form onSubmit={handleSubmit} className='space-y-md' noValidate>
          {FORM_ROWS.map((row, rowIndex) => (
            <div key={rowIndex} className='grid gap-md sm:grid-cols-3'>
              {row.map(({ name, labelKey, placeholderKey }) => {
                const error = errors[name];
                const errorId = `${name}-error`;
                return (
                  <div key={name} className='space-y-xs'>
                    <Label htmlFor={name} className='text-xs text-muted-foreground'>
                      {t(labelKey)}
                    </Label>
                    <Input
                      id={name}
                      name={name}
                      placeholder={t(placeholderKey)}
                      value={values[name]}
                      onChange={e => handleChange(name, e.target.value)}
                      aria-invalid={!!error}
                      {...(error ? { 'aria-describedby': errorId } : {})}
                      className='h-8 text-sm'
                    />
                    {error && (
                      <p id={errorId} className='text-[11px] leading-tight text-destructive'>
                        {t(error)}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          ))}

          {submitError && (
            <p role='alert' className='text-xs text-destructive'>
              {submitError}
            </p>
          )}

          <div className='flex justify-end pt-xs'>
            <Button type='submit' size='sm' disabled={isPending} className='min-w-[140px]'>
              {isPending ? t('create.submitting') : t('create.submit')}
            </Button>
          </div>
        </form>
      </section>

      {/* Fleet table */}
      {isError ? (
        <div className='rounded-lg border border-border/60 bg-card py-3xl text-center'>
          <p className='text-sm text-muted-foreground'>{t('list.error')}</p>
        </div>
      ) : (
        <AdminDataTable<DriverRow>
          columns={columns}
          data={paged}
          isLoading={isLoading}
          page={safePage}
          totalPages={totalPages}
          total={filtered.length}
          onPageChange={setPage}
          searchValue={search}
          searchPlaceholder={t('list.title')}
          onSearchChange={handleSearchChange}
          onRowClick={handleRowClick}
          emptyIcon={Truck}
          emptyTitle={t('list.empty')}
          emptyDescription={t('list.emptyHint')}
        />
      )}

      <DriverDetailSheet driverId={selectedId} open={!!selectedId} onClose={handleSheetClose} />

      {/* Temporary password — shown once, non-dismissible by outside click */}
      <Dialog open={!!created} onOpenChange={NOOP}>
        <DialogContent onInteractOutside={preventDefault} onEscapeKeyDown={preventDefault}>
          <DialogHeader>
            <DialogTitle className='flex items-center gap-sm'>
              <Truck className='size-4' aria-hidden='true' />
              {t('password.title')}
            </DialogTitle>
          </DialogHeader>
          <div className='space-y-lg'>
            <p className='text-sm text-muted-foreground'>{t('password.description')}</p>
            <div className='flex items-center gap-sm rounded-md bg-muted px-md py-sm'>
              <code className='flex-1 font-mono text-sm font-bold tracking-widest'>
                {created?.temporaryPassword}
              </code>
              <Button
                size='sm'
                variant='ghost'
                className='size-7 shrink-0 p-0'
                onClick={handleCopy}
                aria-label={t('password.copy')}
              >
                {copied ? (
                  <Check className='size-3.5 text-success' />
                ) : (
                  <Copy className='size-3.5' />
                )}
              </Button>
            </div>
            <Button className='w-full' size='sm' onClick={handleDialogDone}>
              {t('password.done')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
