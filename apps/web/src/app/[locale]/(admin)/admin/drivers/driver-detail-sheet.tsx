'use client';

import { memo, useCallback, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  Ban,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  MapPin,
  Package,
  Timer,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  Separator,
  Sheet,
  SheetContent,
  SheetTitle,
  Skeleton,
} from '@foodwaste/ui';
import { useDriverDetail, useDriverOrders } from '@/hooks/use-drivers';
import { formatDate, formatDateTime, formatMoney, formatRelative } from '@/lib/format';
import { orderStatusColor } from '@/lib/order-status';
import { cn } from '@/lib/utils';
import type { DriverDetail, DriverOrderRow, DriverStats, DriverUnassignment } from '@/types/admin';

// Frozen module-level constants — a fresh `[]` or `[1,2,3]` in render would
// give every memoised child a new prop identity on every pass.
const EMPTY_ORDERS: readonly DriverOrderRow[] = Object.freeze([]) as readonly DriverOrderRow[];
const SKELETON_ROWS = Object.freeze([0, 1, 2, 3, 4]);
const SKELETON_BLOCKS = Object.freeze([0, 1, 2, 3]);

const ORDERS_PAGE_SIZE = 8;
const EM_DASH = '—';

interface DriverDetailSheetProps {
  driverId: string | null;
  open: boolean;
  onClose: () => void;
}

// ── Small presentational pieces ───────────────────────────────────────────────

interface StatTileProps {
  icon: LucideIcon;
  label: string;
  value: string;
  tone?: 'default' | 'warning';
}

const StatTile = memo(function StatTile({ icon: Icon, label, value, tone }: StatTileProps) {
  return (
    <div className='rounded-lg border border-border/60 bg-card p-md'>
      <div className='flex items-center gap-1.5 text-muted-foreground'>
        <Icon className={cn('size-3.5', tone === 'warning' && 'text-warning')} />
        <span className='text-[11px] font-medium uppercase tracking-wide'>{label}</span>
      </div>
      <p
        className={cn(
          'mt-xs text-lg font-semibold tabular-nums',
          tone === 'warning' ? 'text-warning' : 'text-foreground',
        )}
      >
        {value}
      </p>
    </div>
  );
});

const InfoRow = memo(function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className='flex items-baseline justify-between gap-lg py-1.5'>
      <span className='shrink-0 text-xs text-muted-foreground'>{label}</span>
      <span className='truncate text-xs font-medium text-foreground'>{value}</span>
    </div>
  );
});

const SectionTitle = memo(function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className='mb-sm text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
      {children}
    </h3>
  );
});

// ── Availability ──────────────────────────────────────────────────────────────

const AvailabilityPanel = memo(function AvailabilityPanel({
  detail,
  locale,
}: {
  detail: DriverDetail;
  locale: string;
}) {
  const t = useTranslations('adminDrivers');
  const profile = detail.driver.driverProfile;
  const position = profile?.lastKnownLocation ?? null;

  const lastSeen = formatRelative(locale, profile?.lastOnlineAt ?? null);
  const reportedAt = formatRelative(locale, position?.at ?? null);

  return (
    <section>
      <SectionTitle>{t('detail.position.title')}</SectionTitle>
      <div className='rounded-lg border border-border/60 bg-card p-md'>
        <div className='flex items-center gap-sm'>
          <span
            aria-hidden='true'
            className={cn(
              'size-2 rounded-full',
              profile?.isOnline ? 'bg-success' : 'bg-muted-foreground/40',
            )}
          />
          <span className='text-sm font-medium'>
            {profile?.isOnline ? t('availability.online') : t('availability.offline')}
          </span>
          <span className='ms-auto text-xs text-muted-foreground'>
            {lastSeen ? t('availability.lastSeen', { when: lastSeen }) : t('availability.never')}
          </span>
        </div>

        <Separator className='my-md' />

        {position ? (
          <div className='flex items-center justify-between gap-md'>
            <div className='min-w-0'>
              <p className='truncate font-mono text-xs text-foreground'>
                {position.lat.toFixed(5)}, {position.lng.toFixed(5)}
              </p>
              {reportedAt && (
                <p className='mt-xxs text-[11px] text-muted-foreground'>
                  {t('detail.position.reportedAt', { when: reportedAt })}
                </p>
              )}
            </div>
            <Button asChild variant='outline' size='sm' className='h-7 shrink-0 text-xs'>
              {/* Coordinates only — no API key, no map bundle, opens in the
                  admin's own maps app. */}
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${position.lat},${position.lng}`}
                target='_blank'
                rel='noopener noreferrer'
              >
                <MapPin className='me-xs size-3' />
                {t('detail.position.viewOnMap')}
                <ExternalLink className='ms-xs size-3' />
              </a>
            </Button>
          </div>
        ) : (
          <p className='text-xs text-muted-foreground'>{t('detail.position.empty')}</p>
        )}
      </div>
    </section>
  );
});

// ── Order history ─────────────────────────────────────────────────────────────

const OrderHistoryRow = memo(function OrderHistoryRow({
  order,
  locale,
}: {
  order: DriverOrderRow;
  locale: string;
}) {
  const tStatus = useTranslations('adminOrders.statuses');
  const t = useTranslations('adminDrivers');

  return (
    <tr className='border-b border-border/40 last:border-0'>
      <td className='py-sm pe-sm'>
        <p className='font-mono text-[11px] font-medium'>{order.orderNumber}</p>
        <p className='text-[10px] text-muted-foreground'>
          {formatDate(locale, order.createdAt) ?? EM_DASH}
        </p>
      </td>
      <td className='px-sm py-sm'>
        <span
          className={cn(
            'inline-flex rounded-full border px-1.5 py-xxs text-[10px] font-medium',
            orderStatusColor(order.status),
          )}
        >
          {tStatus(order.status)}
        </span>
      </td>
      <td className='px-sm py-sm text-[11px] text-muted-foreground'>
        {order.deliveryCity ?? EM_DASH}
      </td>
      <td className='px-sm py-sm text-[11px] tabular-nums text-muted-foreground'>
        {order.estimatedDistanceKm !== null
          ? `${order.estimatedDistanceKm.toFixed(1)} km`
          : EM_DASH}
      </td>
      <td className='ps-sm py-sm text-end text-[11px] font-medium tabular-nums'>
        {order.driverEarnings !== null
          ? formatMoney(locale, order.driverEarnings, order.currency)
          : EM_DASH}
      </td>
      <td className='ps-sm py-sm text-end text-[10px] text-muted-foreground'>
        {formatRelative(locale, order.deliveredAt) ?? t('detail.notProvided')}
      </td>
    </tr>
  );
});

function OrderHistory({ driverId, locale }: { driverId: string; locale: string }) {
  const t = useTranslations('adminDrivers');
  const [page, setPage] = useState(1);

  const params = useMemo(() => ({ page, limit: ORDERS_PAGE_SIZE }), [page]);
  const { data, isLoading, isError } = useDriverOrders(driverId, params);

  const orders = data?.orders ?? EMPTY_ORDERS;
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / ORDERS_PAGE_SIZE));

  const goPrev = useCallback(() => setPage(p => Math.max(1, p - 1)), []);
  const goNext = useCallback(() => setPage(p => p + 1), []);

  return (
    <section>
      <SectionTitle>{t('detail.orders.title')}</SectionTitle>
      <div className='rounded-lg border border-border/60 bg-card p-md'>
        {isError ? (
          <p className='py-lg text-center text-xs text-muted-foreground'>
            {t('detail.orders.error')}
          </p>
        ) : isLoading ? (
          <div className='space-y-sm'>
            {SKELETON_ROWS.map(i => (
              <Skeleton key={i} className='h-8 w-full' />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <p className='py-lg text-center text-xs text-muted-foreground'>
            {t('detail.orders.empty')}
          </p>
        ) : (
          <div className='overflow-x-auto'>
            <table className='w-full min-w-[480px] text-xs'>
              <thead>
                <tr className='border-b border-border/60 text-[10px] uppercase tracking-wide text-muted-foreground'>
                  <th className='py-1.5 pe-sm text-start font-medium'>
                    {t('detail.orders.order')}
                  </th>
                  <th className='px-sm py-1.5 text-start font-medium'>
                    {t('detail.orders.status')}
                  </th>
                  <th className='px-sm py-1.5 text-start font-medium'>{t('detail.orders.city')}</th>
                  <th className='px-sm py-1.5 text-start font-medium'>
                    {t('detail.orders.distance')}
                  </th>
                  <th className='ps-sm py-1.5 text-end font-medium'>
                    {t('detail.orders.earnings')}
                  </th>
                  <th className='ps-sm py-1.5 text-end font-medium'>
                    {t('detail.orders.delivered')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {orders.map(order => (
                  <OrderHistoryRow key={order._id} order={order} locale={locale} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className='mt-md flex items-center justify-end gap-sm'>
            <span className='text-[11px] text-muted-foreground'>
              {t('detail.orders.page', { page, total: totalPages })}
            </span>
            <Button
              variant='outline'
              size='sm'
              className='h-6 w-6 p-0'
              onClick={goPrev}
              disabled={page <= 1}
              aria-label={t('detail.orders.previous')}
            >
              <ChevronLeft className='size-3' />
            </Button>
            <Button
              variant='outline'
              size='sm'
              className='h-6 w-6 p-0'
              onClick={goNext}
              disabled={page >= totalPages}
              aria-label={t('detail.orders.next')}
            >
              <ChevronRight className='size-3' />
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}

// ── Unassignment trail ────────────────────────────────────────────────────────

const ReleaseRow = memo(function ReleaseRow({
  release,
  locale,
}: {
  release: DriverUnassignment;
  locale: string;
}) {
  const t = useTranslations('adminDrivers');
  return (
    <li className='flex items-start gap-sm border-b border-border/40 py-sm last:border-0'>
      <Ban
        aria-hidden='true'
        className={cn(
          'mt-xxs size-3 shrink-0',
          release.auto ? 'text-muted-foreground' : 'text-warning',
        )}
      />
      <div className='min-w-0 flex-1'>
        <p className='text-[11px] font-medium'>
          <span className='font-mono'>{release.orderNumber}</span>
          <span className='ms-sm font-normal text-muted-foreground'>
            {release.auto ? t('detail.releases.auto') : t('detail.releases.manual')}
          </span>
        </p>
        <p className='truncate text-[10px] text-muted-foreground'>
          {release.reason ?? t('detail.releases.noReason')}
        </p>
      </div>
      <span className='shrink-0 text-[10px] text-muted-foreground'>
        {formatRelative(locale, release.at) ?? EM_DASH}
      </span>
    </li>
  );
});

// ── Body ──────────────────────────────────────────────────────────────────────

function DriverDetailBody({ detail, locale }: { detail: DriverDetail; locale: string }) {
  const t = useTranslations('adminDrivers');
  const { driver, earnings, unassignments } = detail;
  const stats: DriverStats = driver.stats;
  const profile = driver.driverProfile;

  const initials = `${driver.firstName.charAt(0)}${driver.lastName.charAt(0)}`.toUpperCase();

  return (
    <div className='space-y-xl'>
      {/* Identity header */}
      <div className='flex items-start gap-md'>
        <Avatar className='size-10'>
          <AvatarFallback className='bg-primary/10 text-sm font-semibold text-primary'>
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className='min-w-0 flex-1'>
          <p className='truncate text-sm font-semibold'>
            {driver.firstName} {driver.lastName}
          </p>
          <p className='truncate text-xs text-muted-foreground'>{driver.email}</p>
        </div>
        {driver.requiresPasswordChange && (
          <Badge
            variant='outline'
            className='shrink-0 border-warning bg-warning/10 py-0 text-[10px] text-warning'
          >
            {t('accountStatus.pendingSetup')}
          </Badge>
        )}
      </div>

      <AvailabilityPanel detail={detail} locale={locale} />

      {/* Lifetime performance */}
      <section>
        <SectionTitle>{t('detail.stats.title')}</SectionTitle>
        <div className='grid grid-cols-2 gap-sm sm:grid-cols-3'>
          <StatTile
            icon={CheckCircle2}
            label={t('detail.stats.delivered')}
            value={String(stats.totalDelivered)}
          />
          <StatTile
            icon={Package}
            label={t('detail.stats.assigned')}
            value={String(stats.totalAssigned)}
          />
          <StatTile
            icon={TrendingUp}
            label={t('detail.stats.active')}
            value={String(stats.activeCount)}
          />
          <StatTile
            icon={Wallet}
            label={t('detail.stats.earnings')}
            value={formatMoney(locale, stats.totalEarnings, earnings.currency)}
          />
          <StatTile
            icon={Timer}
            label={t('detail.stats.avgTime')}
            value={
              stats.avgDeliveryMinutes !== null
                ? t('detail.stats.minutes', { count: stats.avgDeliveryMinutes })
                : EM_DASH
            }
          />
          <StatTile
            icon={Ban}
            label={t('detail.stats.cancellations')}
            value={String(stats.cancellationCount)}
            {...(stats.cancellationCount > 0 ? { tone: 'warning' as const } : {})}
          />
        </div>
      </section>

      {/* Earnings buckets */}
      <section>
        <SectionTitle>{t('detail.earnings.title')}</SectionTitle>
        <div className='grid grid-cols-2 gap-sm sm:grid-cols-4'>
          <StatTile
            icon={Wallet}
            label={t('detail.earnings.today')}
            value={formatMoney(locale, earnings.today, earnings.currency)}
          />
          <StatTile
            icon={Wallet}
            label={t('detail.earnings.thisWeek')}
            value={formatMoney(locale, earnings.thisWeek, earnings.currency)}
          />
          <StatTile
            icon={Wallet}
            label={t('detail.earnings.thisMonth')}
            value={formatMoney(locale, earnings.thisMonth, earnings.currency)}
          />
          <StatTile
            icon={Wallet}
            label={t('detail.earnings.allTime')}
            value={formatMoney(locale, earnings.allTime, earnings.currency)}
          />
        </div>
      </section>

      {/* Identity details */}
      <section>
        <SectionTitle>{t('detail.identity')}</SectionTitle>
        <div className='divide-y divide-border/40 rounded-lg border border-border/60 bg-card px-md py-xs'>
          <InfoRow
            label={t('detail.phone')}
            value={driver.phoneNumber ?? t('detail.notProvided')}
          />
          <InfoRow
            label={t('detail.cin')}
            value={profile?.idCardNumber ?? t('detail.notProvided')}
          />
          <InfoRow
            label={t('detail.address')}
            value={profile?.address ?? t('detail.notProvided')}
          />
          <InfoRow
            label={t('detail.joined')}
            value={formatDate(locale, driver.createdAt) ?? EM_DASH}
          />
          <InfoRow
            label={t('detail.lastLogin')}
            value={formatDateTime(locale, driver.lastLoginAt) ?? t('detail.never')}
          />
          <InfoRow
            label={t('detail.stats.lastDelivery')}
            value={formatDateTime(locale, stats.lastDeliveredAt) ?? t('detail.stats.none')}
          />
        </div>
      </section>

      <OrderHistory driverId={driver._id} locale={locale} />

      {/* Unassignment trail */}
      <section>
        <SectionTitle>{t('detail.releases.title')}</SectionTitle>
        <div className='rounded-lg border border-border/60 bg-card px-md py-xs'>
          {unassignments.length === 0 ? (
            <p className='py-md text-center text-xs text-muted-foreground'>
              {t('detail.releases.empty')}
            </p>
          ) : (
            <ul>
              {unassignments.map(release => (
                <ReleaseRow
                  key={`${release.orderId}-${release.at}`}
                  release={release}
                  locale={locale}
                />
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

// ── Sheet shell ───────────────────────────────────────────────────────────────

export function DriverDetailSheet({ driverId, open, onClose }: DriverDetailSheetProps) {
  const t = useTranslations('adminDrivers');
  const locale = useLocale();
  const { data, isLoading, isError } = useDriverDetail(open ? driverId : null);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) onClose();
    },
    [onClose],
  );

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className='w-full overflow-y-auto sm:max-w-2xl'>
        <SheetTitle className='mb-lg flex items-center gap-sm text-base'>
          <Clock className='size-4 text-primary' aria-hidden='true' />
          {t('detail.title')}
        </SheetTitle>

        {isError ? (
          <p className='py-6xl text-center text-sm text-muted-foreground'>{t('detail.error')}</p>
        ) : isLoading || !data ? (
          <div className='space-y-md'>
            {SKELETON_BLOCKS.map(i => (
              <Skeleton key={i} className='h-20 w-full' />
            ))}
          </div>
        ) : (
          <DriverDetailBody detail={data} locale={locale} />
        )}
      </SheetContent>
    </Sheet>
  );
}
