'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useCurrentHour, MS_PER_HOUR } from '@/hooks/useClock';
import {
  useOfferStats,
  useAdminOffers,
  useLowPickupOffers,
  usePriceViolations,
  useDeletedOffers,
  useBulkOfferAction,
  useRestoreOffer,
  useOfferDetail,
  useExpiringOffers,
  useTriggerAutoFeaturing,
  useUpdateExpiredOffers,
  useReserveOfferQuantity,
  useCancelOfferReservation,
} from '@/hooks/use-admin';
import { toast } from 'sonner';
import { adminService } from '@/services/admin.service';
import { Card, CardContent } from '@foodwaste/ui';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@foodwaste/ui';
import {
  Tag,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Star,
  Trash2,
  Eye,
  EyeOff,
  RotateCcw,
  Download,
  Search,
  ShoppingBag,
  Percent,
  X,
  Building2,
  User,
  Calendar,
  Package,
  Clock,
  Zap,
  RefreshCw,
  BookmarkPlus,
  BookmarkMinus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  AdminOfferItem,
  AdminLowPickupItem,
  AdminPriceViolationItem,
  AdminDeletedOfferItem,
  BulkOfferAction,
  ExpiringOfferItem,
} from '@/types/admin';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtPct(v: number) {
  return `${Math.round(v * 100)}%`;
}

function fmtDiscount(v: number) {
  return `${v}%`;
}

function pickupRateColor(rate: number) {
  if (rate >= 0.7) return 'text-success';
  if (rate >= 0.4) return 'text-warning';
  return 'text-destructive';
}

function statusVariant(status: string): React.ComponentProps<typeof Badge>['variant'] {
  if (status === 'active') return 'default';
  if (status === 'expired' || status === 'cancelled') return 'destructive';
  return 'secondary';
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  iconColor,
  sub,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  sub?: string;
}) {
  return (
    <Card className='border-border/60'>
      <CardContent className='px-md py-md'>
        <div className='flex items-center gap-2.5'>
          <Icon className={cn('size-4 shrink-0', iconColor)} />
          <p className='truncate text-[11px] text-muted-foreground'>{label}</p>
        </div>
        <p className='mt-1.5 text-xl font-bold tabular-nums leading-none'>{value}</p>
        {sub && <p className='mt-xs text-[10px] text-muted-foreground'>{sub}</p>}
      </CardContent>
    </Card>
  );
}

// ─── Bulk action bar ──────────────────────────────────────────────────────────

function BulkBar({
  selected,
  onAction,
  onClear,
  isPending,
  t,
}: {
  selected: string[];
  onAction: (action: BulkOfferAction) => void;
  onClear: () => void;
  isPending: boolean;
  t: ReturnType<typeof useTranslations>;
}) {
  if (selected.length === 0) return null;
  return (
    <div className='flex items-center gap-sm rounded-lg border border-primary/20 bg-primary/5 px-md py-sm flex-wrap'>
      <span className='text-xs font-semibold text-primary'>
        {t('bulk.selected', { count: selected.length })}
      </span>
      <Separator orientation='vertical' className='h-4' />
      {[
        { action: 'feature' as BulkOfferAction, icon: Star, label: t('bulk.feature') },
        { action: 'unfeature' as BulkOfferAction, icon: Star, label: t('bulk.unfeature') },
        { action: 'enable' as BulkOfferAction, icon: Eye, label: t('bulk.enable') },
        { action: 'disable' as BulkOfferAction, icon: EyeOff, label: t('bulk.disable') },
      ].map(({ action, icon: Icon, label }) => (
        <Button
          key={action}
          size='sm'
          variant='ghost'
          className='gap-xs px-sm text-xs'
          disabled={isPending}
          onClick={() => onAction(action)}
        >
          <Icon className='size-3' />
          {label}
        </Button>
      ))}
      <Button
        size='sm'
        variant='ghost'
        className='gap-xs px-sm text-xs text-destructive hover:text-destructive'
        disabled={isPending}
        onClick={() => onAction('delete')}
      >
        <Trash2 className='size-3' />
        {t('bulk.delete')}
      </Button>
      <button
        onClick={onClear}
        className='ms-auto rounded p-xs text-muted-foreground hover:text-foreground'
        aria-label={t('bulk.clearSelection')}
      >
        <X className='size-3.5' />
      </button>
    </div>
  );
}

// ─── All offers table ─────────────────────────────────────────────────────────

function AllOffersTable({
  t,
  selected,
  onToggle,
  onToggleAll,
  onView,
}: {
  t: ReturnType<typeof useTranslations>;
  selected: string[];
  onToggle: (id: string) => void;
  onToggleAll: (ids: string[]) => void;
  onView: (id: string) => void;
}) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const { data, isLoading } = useAdminOffers({
    page,
    limit: 20,
    ...(debouncedSearch && { search: debouncedSearch }),
    ...(status && { status }),
  });

  const offers = data?.data ?? [];
  const total = data?.meta?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  const handleSearch = useCallback((v: string) => {
    setSearch(v);
    const t = setTimeout(() => {
      setDebouncedSearch(v);
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className='space-y-md'>
      {/* Filters */}
      <div className='flex flex-wrap gap-sm'>
        <div className='relative flex-1 min-w-48'>
          <Search className='absolute start-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground' />
          <Input
            value={search}
            onChange={e => handleSearch(e.target.value)}
            placeholder={t('filters.searchPlaceholder')}
            className='ps-4xl h-8 text-sm'
          />
        </div>
        <Select
          value={status || '_all'}
          onValueChange={v => {
            setStatus(v === '_all' ? '' : v);
            setPage(1);
          }}
        >
          <SelectTrigger className='h-8 w-36 text-sm'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='_all'>{t('filters.allStatuses')}</SelectItem>
            {['active', 'draft', 'expired', 'sold_out', 'cancelled'].map(s => (
              <SelectItem key={s} value={s} className='capitalize'>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className='overflow-x-auto rounded-lg border border-border/60'>
        <table className='w-full text-sm'>
          <thead>
            <tr className='border-b border-border/60 bg-muted/40'>
              <th className='w-8 px-md py-2.5'>
                <input
                  type='checkbox'
                  className='rounded'
                  checked={offers.length > 0 && offers.every(o => selected.includes(o._id))}
                  onChange={() => onToggleAll(offers.map(o => o._id))}
                  aria-label='Select all'
                />
              </th>
              <th className='px-md py-2.5 text-start text-xs font-medium text-muted-foreground'>
                {t('columns.offer')}
              </th>
              <th className='px-md py-2.5 text-start text-xs font-medium text-muted-foreground hidden md:table-cell'>
                {t('columns.establishment')}
              </th>
              <th className='px-md py-2.5 text-start text-xs font-medium text-muted-foreground'>
                {t('columns.status')}
              </th>
              <th className='px-md py-2.5 text-end text-xs font-medium text-muted-foreground hidden lg:table-cell'>
                {t('columns.discount')}
              </th>
              <th className='px-md py-2.5 text-end text-xs font-medium text-muted-foreground hidden lg:table-cell'>
                {t('columns.pickupRate')}
              </th>
              <th className='px-md py-2.5 text-end text-xs font-medium text-muted-foreground hidden xl:table-cell'>
                {t('columns.quantity')}
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              [...Array(8)].map((_, i) => (
                <tr key={i} className='border-b border-border/40'>
                  <td className='px-md py-2.5'>
                    <Skeleton className='size-4 rounded' />
                  </td>
                  <td className='px-md py-2.5'>
                    <Skeleton className='h-4 w-40 rounded' />
                  </td>
                  <td className='hidden px-md py-2.5 md:table-cell'>
                    <Skeleton className='h-4 w-28 rounded' />
                  </td>
                  <td className='px-md py-2.5'>
                    <Skeleton className='h-5 w-16 rounded-full' />
                  </td>
                  <td className='hidden px-md py-2.5 lg:table-cell'>
                    <Skeleton className='h-4 w-10 rounded ms-auto' />
                  </td>
                  <td className='hidden px-md py-2.5 lg:table-cell'>
                    <Skeleton className='h-4 w-12 rounded ms-auto' />
                  </td>
                  <td className='hidden px-md py-2.5 xl:table-cell'>
                    <Skeleton className='h-4 w-10 rounded ms-auto' />
                  </td>
                </tr>
              ))
            ) : offers.length === 0 ? (
              <tr>
                <td colSpan={7} className='py-3xl text-center text-sm text-muted-foreground'>
                  {t('empty')}
                </td>
              </tr>
            ) : (
              offers.map(offer => (
                <OfferRow
                  key={offer._id}
                  offer={offer}
                  selected={selected.includes(offer._id)}
                  onToggle={() => onToggle(offer._id)}
                  onView={() => onView(offer._id)}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className='flex items-center justify-between text-xs text-muted-foreground'>
          <span>{total} offers</span>
          <div className='flex gap-xs'>
            <Button
              size='sm'
              variant='outline'
              className='px-sm'
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
            >
              ←
            </Button>
            <span className='flex items-center px-sm'>
              {page} / {totalPages}
            </span>
            <Button
              size='sm'
              variant='outline'
              className='px-sm'
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
            >
              →
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function OfferRow({
  offer,
  selected,
  onToggle,
  onView,
}: {
  offer: AdminOfferItem;
  selected: boolean;
  onToggle: () => void;
  onView: () => void;
}) {
  return (
    <tr
      className={cn(
        'border-b border-border/40 transition-colors hover:bg-muted/30 cursor-pointer',
        selected && 'bg-primary/5',
      )}
    >
      <td className='px-md py-2.5' onClick={e => e.stopPropagation()}>
        <input
          type='checkbox'
          className='rounded'
          checked={selected}
          onChange={onToggle}
          aria-label='Select offer'
        />
      </td>
      <td className='px-md py-2.5' onClick={onView}>
        <div className='flex items-center gap-sm'>
          {offer.isFeaturedManual && <Star className='size-3 shrink-0 text-[#FFA000]' />}
          <p className='max-w-[200px] truncate text-sm font-medium'>{offer.title}</p>
        </div>
      </td>
      <td className='hidden px-md py-2.5 md:table-cell' onClick={onView}>
        <p className='max-w-[160px] truncate text-xs text-muted-foreground'>
          {offer.establishment?.name ?? '—'}
        </p>
      </td>
      <td className='px-md py-2.5' onClick={onView}>
        <Badge variant={statusVariant(offer.status)} className='capitalize text-[10px]'>
          {offer.status}
        </Badge>
      </td>
      <td
        className='hidden px-md py-2.5 text-end text-xs tabular-nums lg:table-cell'
        onClick={onView}
      >
        {fmtDiscount(offer.pricing.discountPercentage)}
      </td>
      <td className='hidden px-md py-2.5 text-end lg:table-cell' onClick={onView}>
        <span className={cn('text-xs font-medium tabular-nums', pickupRateColor(offer.pickupRate))}>
          {fmtPct(offer.pickupRate)}
        </span>
      </td>
      <td
        className='hidden px-md py-2.5 text-end text-xs tabular-nums text-muted-foreground xl:table-cell'
        onClick={onView}
      >
        {offer.soldQuantity}/{offer.totalQuantity}
      </td>
    </tr>
  );
}

// ─── Low pickup tab ───────────────────────────────────────────────────────────

function LowPickupTab({ t }: { t: ReturnType<typeof useTranslations> }) {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useLowPickupOffers(0.2, page);
  const items = data?.data ?? [];
  const total = data?.total ?? 0;

  return (
    <div className='space-y-md'>
      {isLoading ? (
        <div className='space-y-sm'>
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className='h-14 rounded-lg' />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className='py-6xl text-center text-sm text-muted-foreground'>{t('lowPickupEmpty')}</p>
      ) : (
        <div className='space-y-sm'>
          {items.map((item: AdminLowPickupItem) => (
            <div
              key={item._id}
              className='flex items-center gap-md rounded-lg border border-border/60 px-md py-2.5'
            >
              <TrendingDown className='size-4 shrink-0 text-destructive' />
              <div className='flex-1 min-w-0'>
                <p className='truncate text-sm font-medium'>{item.title}</p>
                <p className='text-xs text-muted-foreground'>{item.establishment?.name ?? '—'}</p>
              </div>
              <div className='text-end shrink-0'>
                <p
                  className={cn('text-sm font-bold tabular-nums', pickupRateColor(item.pickupRate))}
                >
                  {fmtPct(item.pickupRate)}
                </p>
                <p className='text-[10px] text-muted-foreground'>
                  {item.soldQuantity}/{item.totalQuantity} bags
                </p>
              </div>
              <Badge variant='secondary' className='capitalize text-[10px]'>
                {item.status}
              </Badge>
            </div>
          ))}
        </div>
      )}
      {total > 20 && (
        <div className='flex items-center justify-between text-xs text-muted-foreground'>
          <span>{total} offers</span>
          <div className='flex gap-xs'>
            <Button
              size='sm'
              variant='outline'
              className='px-sm'
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
            >
              ←
            </Button>
            <Button
              size='sm'
              variant='outline'
              className='px-sm'
              disabled={page * 20 >= total}
              onClick={() => setPage(p => p + 1)}
            >
              →
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Price violations tab ─────────────────────────────────────────────────────

function PriceViolationsTab({ t }: { t: ReturnType<typeof useTranslations> }) {
  const [page, setPage] = useState(1);
  const { data, isLoading } = usePriceViolations(30, page);
  const items = data?.data ?? [];
  const total = data?.total ?? 0;

  return (
    <div className='space-y-md'>
      {isLoading ? (
        <div className='space-y-sm'>
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className='h-14 rounded-lg' />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className='py-6xl text-center text-sm text-muted-foreground'>{t('violationsEmpty')}</p>
      ) : (
        <div className='space-y-sm'>
          {items.map((item: AdminPriceViolationItem) => (
            <div
              key={item._id}
              className='flex items-center gap-md rounded-lg border border-warning/30 bg-warning/5 px-md py-2.5'
            >
              <AlertTriangle className='size-4 shrink-0 text-warning' />
              <div className='flex-1 min-w-0'>
                <p className='truncate text-sm font-medium'>{item.title}</p>
                <p className='text-xs text-muted-foreground'>
                  {item.establishment?.name ?? '—'} · {item.merchant?.email ?? '—'}
                </p>
              </div>
              <div className='text-end shrink-0'>
                <p className='text-sm font-bold text-warning tabular-nums'>
                  {fmtDiscount(item.pricing.discountPercentage)}
                </p>
                <p className='text-[10px] text-muted-foreground'>below 30% min</p>
              </div>
              <Badge variant='secondary' className='capitalize text-[10px]'>
                {item.status}
              </Badge>
            </div>
          ))}
        </div>
      )}
      {total > 20 && (
        <div className='flex justify-end'>
          <div className='flex gap-xs'>
            <Button
              size='sm'
              variant='outline'
              className='px-sm'
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
            >
              ←
            </Button>
            <Button
              size='sm'
              variant='outline'
              className='px-sm'
              disabled={page * 20 >= total}
              onClick={() => setPage(p => p + 1)}
            >
              →
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Deleted tab ──────────────────────────────────────────────────────────────

function DeletedTab({ t }: { t: ReturnType<typeof useTranslations> }) {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useDeletedOffers(page);
  const restoreMutation = useRestoreOffer();
  const items = data?.data ?? [];
  const total = data?.total ?? 0;

  return (
    <div className='space-y-md'>
      {isLoading ? (
        <div className='space-y-sm'>
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className='h-14 rounded-lg' />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className='py-6xl text-center text-sm text-muted-foreground'>{t('deletedEmpty')}</p>
      ) : (
        <div className='space-y-sm'>
          {items.map((item: AdminDeletedOfferItem) => (
            <div
              key={item._id}
              className='flex items-center gap-md rounded-lg border border-border/60 px-md py-2.5 opacity-70'
            >
              <Trash2 className='size-4 shrink-0 text-muted-foreground' />
              <div className='flex-1 min-w-0'>
                <p className='truncate text-sm font-medium'>{item.title}</p>
                <p className='text-xs text-muted-foreground'>
                  {item.establishment?.name ?? '—'} · {item.deletionReason ?? 'No reason'}
                </p>
              </div>
              <p className='text-[10px] text-muted-foreground shrink-0'>
                {new Date(item.deletedAt).toLocaleDateString()}
              </p>
              <Button
                size='sm'
                variant='outline'
                className='gap-xs px-sm text-xs shrink-0'
                disabled={restoreMutation.isPending}
                onClick={() => restoreMutation.mutate(item._id)}
              >
                <RotateCcw className='size-3' />
                {t('actions.restore')}
              </Button>
            </div>
          ))}
        </div>
      )}
      {total > 20 && (
        <div className='flex justify-end'>
          <div className='flex gap-xs'>
            <Button
              size='sm'
              variant='outline'
              className='px-sm'
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
            >
              ←
            </Button>
            <Button
              size='sm'
              variant='outline'
              className='px-sm'
              disabled={page * 20 >= total}
              onClick={() => setPage(p => p + 1)}
            >
              →
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Offer detail sheet ───────────────────────────────────────────────────────

function OfferDetailSheet({ offerId, onClose }: { offerId: string | null; onClose: () => void }) {
  const t = useTranslations('dashboard.adminOffers');
  const { data: offer, isLoading } = useOfferDetail(offerId);
  const reserveMutation = useReserveOfferQuantity();
  const cancelReservationMutation = useCancelOfferReservation();
  const [reserveQty, setReserveQty] = useState('1');
  const [cancelQty, setCancelQty] = useState('1');

  return (
    <Sheet open={!!offerId} onOpenChange={open => !open && onClose()}>
      <SheetContent className='w-full overflow-y-auto sm:max-w-lg'>
        {isLoading ? (
          <div className='space-y-lg py-2xl'>
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className={`h-4 rounded ${i === 0 ? 'w-48' : 'w-full'}`} />
            ))}
          </div>
        ) : offer ? (
          <div className='space-y-xl py-2xl'>
            <SheetHeader>
              <div className='flex items-start gap-md'>
                <div className='flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50'>
                  <Tag className='size-5 text-emerald-600' />
                </div>
                <div className='min-w-0'>
                  <SheetTitle className='text-base leading-tight'>{offer.title}</SheetTitle>
                  <div className='mt-1.5 flex flex-wrap gap-1.5'>
                    <Badge variant={statusVariant(offer.status)} className='capitalize text-[10px]'>
                      {offer.status}
                    </Badge>
                    {offer.isFeaturedManual && (
                      <Badge className='border-amber-200 bg-amber-50 text-amber-700 text-[10px]'>
                        <Star className='me-xs size-2.5' />
                        Featured
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </SheetHeader>

            <Separator />

            {/* Pricing */}
            <div className='grid grid-cols-3 gap-md text-center'>
              <div className='rounded-lg bg-muted/40 px-sm py-md'>
                <p className='text-xs text-muted-foreground'>Original</p>
                <p className='text-sm font-bold tabular-nums'>{offer.pricing.originalPrice} TND</p>
              </div>
              <div className='rounded-lg bg-emerald-50 px-sm py-md'>
                <p className='text-xs text-muted-foreground'>Discounted</p>
                <p className='text-sm font-bold tabular-nums text-emerald-700'>
                  {offer.pricing.discountedPrice} TND
                </p>
              </div>
              <div className='rounded-lg bg-violet-50 px-sm py-md'>
                <p className='text-xs text-muted-foreground'>Discount</p>
                <p className='text-sm font-bold tabular-nums text-violet-700'>
                  {offer.pricing.discountPercentage}%
                </p>
              </div>
            </div>

            {/* Performance */}
            <div className='grid grid-cols-2 gap-md'>
              <div className='space-y-xxs rounded-lg border border-border/60 px-md py-2.5'>
                <p className='text-[10px] text-muted-foreground uppercase tracking-wide'>
                  Pickup Rate
                </p>
                <p
                  className={cn(
                    'text-lg font-bold tabular-nums',
                    pickupRateColor(offer.pickupRate),
                  )}
                >
                  {fmtPct(offer.pickupRate)}
                </p>
              </div>
              <div className='space-y-xxs rounded-lg border border-border/60 px-md py-2.5'>
                <p className='text-[10px] text-muted-foreground uppercase tracking-wide'>Bags</p>
                <p className='text-lg font-bold tabular-nums'>
                  {offer.soldQuantity}
                  <span className='text-sm font-normal text-muted-foreground'>
                    /{offer.totalQuantity}
                  </span>
                </p>
              </div>
              <div className='space-y-xxs rounded-lg border border-border/60 px-md py-2.5'>
                <p className='text-[10px] text-muted-foreground uppercase tracking-wide'>Views</p>
                <p className='text-lg font-bold tabular-nums'>{offer.viewCount.toLocaleString()}</p>
              </div>
              <div className='space-y-xxs rounded-lg border border-border/60 px-md py-2.5'>
                <p className='text-[10px] text-muted-foreground uppercase tracking-wide'>
                  Favorites
                </p>
                <p className='text-lg font-bold tabular-nums'>
                  {offer.favoriteCount.toLocaleString()}
                </p>
              </div>
            </div>

            <Separator />

            {/* Details */}
            <div className='space-y-2.5'>
              {[
                {
                  icon: Building2,
                  label: 'Establishment',
                  value: offer.establishment?.name ?? '—',
                },
                { icon: User, label: 'Merchant', value: offer.merchant?.email ?? '—' },
                { icon: Package, label: 'Type', value: offer.type.replace(/_/g, ' ') },
                {
                  icon: Calendar,
                  label: 'Available',
                  value: `${new Date(offer.availableFrom).toLocaleDateString()} → ${new Date(offer.availableUntil).toLocaleDateString()}`,
                },
                {
                  icon: Calendar,
                  label: 'Created',
                  value: new Date(offer.createdAt).toLocaleDateString(),
                },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className='flex items-start gap-md'>
                  <Icon className='mt-xxs size-3.5 shrink-0 text-muted-foreground' />
                  <div className='flex flex-1 items-start justify-between gap-sm text-xs'>
                    <span className='text-muted-foreground'>{label}</span>
                    <span className='text-end font-medium capitalize'>{value}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Categories */}
            {offer.categories.length > 0 && (
              <>
                <Separator />
                <div>
                  <p className='mb-sm text-[11px] font-medium uppercase tracking-wide text-muted-foreground'>
                    Categories
                  </p>
                  <div className='flex flex-wrap gap-1.5'>
                    {offer.categories.map(cat => (
                      <Badge key={cat} variant='secondary' className='capitalize text-[10px]'>
                        {cat.replace(/_/g, ' ')}
                      </Badge>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Reserve / Cancel Reservation */}
            {offer.status === 'active' && (
              <>
                <Separator />
                <div className='space-y-md'>
                  <p className='text-[11px] font-medium uppercase tracking-wide text-muted-foreground'>
                    {t('reservation.title')}
                  </p>
                  <div className='flex items-end gap-sm'>
                    <div className='flex-1 space-y-xs'>
                      <Label className='text-xs'>{t('reservation.reserveLabel')}</Label>
                      <Input
                        type='number'
                        min={1}
                        max={offer.totalQuantity - offer.soldQuantity}
                        value={reserveQty}
                        onChange={e => setReserveQty(e.target.value)}
                        className='h-8 text-sm'
                      />
                    </div>
                    <Button
                      size='sm'
                      variant='outline'
                      className='gap-1.5 shrink-0'
                      disabled={reserveMutation.isPending || !reserveQty || Number(reserveQty) <= 0}
                      onClick={() => {
                        reserveMutation.mutate(
                          { id: offer._id, quantity: Number(reserveQty) },
                          { onSuccess: () => toast.success(t('reservation.reserved')) },
                        );
                      }}
                    >
                      <BookmarkPlus className='size-3.5' />
                      {t('reservation.reserve')}
                    </Button>
                  </div>
                  <div className='flex items-end gap-sm'>
                    <div className='flex-1 space-y-xs'>
                      <Label className='text-xs'>{t('reservation.cancelLabel')}</Label>
                      <Input
                        type='number'
                        min={1}
                        value={cancelQty}
                        onChange={e => setCancelQty(e.target.value)}
                        className='h-8 text-sm'
                      />
                    </div>
                    <Button
                      size='sm'
                      variant='outline'
                      className='gap-1.5 shrink-0 text-destructive border-destructive/30'
                      disabled={
                        cancelReservationMutation.isPending || !cancelQty || Number(cancelQty) <= 0
                      }
                      onClick={() => {
                        cancelReservationMutation.mutate(
                          { id: offer._id, quantity: Number(cancelQty) },
                          { onSuccess: () => toast.success(t('reservation.cancelled')) },
                        );
                      }}
                    >
                      <BookmarkMinus className='size-3.5' />
                      {t('reservation.cancel')}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

// ─── Expiring offers tab ─────────────────────────────────────────────────────

function ExpiringTab({ t }: { t: ReturnType<typeof useTranslations> }) {
  // Hour-quantised clock, not Date.now() in render: this list shows whole hours,
  // so it re-computes on the hour instead of drifting per render.
  const currentHour = useCurrentHour();
  const { data, isLoading } = useExpiringOffers(24);
  const items = (data ?? []) as ExpiringOfferItem[];

  return (
    <div className='space-y-md'>
      {isLoading ? (
        <div className='space-y-sm'>
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className='h-14 rounded-lg' />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className='py-6xl text-center text-sm text-muted-foreground'>{t('expiringEmpty')}</p>
      ) : (
        <div className='space-y-sm'>
          {items.map((item: ExpiringOfferItem) => {
            const hoursLeft = Math.max(
              0,
              Math.round((new Date(item.availableUntil).getTime() - currentHour) / MS_PER_HOUR),
            );
            return (
              <div
                key={item.id}
                className='flex items-center gap-md rounded-lg border border-warning/30 bg-warning/5 px-md py-2.5'
              >
                <Clock className='size-4 shrink-0 text-warning' />
                <div className='flex-1 min-w-0'>
                  <p className='truncate text-sm font-medium'>{item.title}</p>
                  <p className='text-xs text-muted-foreground'>{item.establishment?.name ?? '—'}</p>
                </div>
                <div className='text-end shrink-0'>
                  <p className='text-sm font-bold text-warning tabular-nums'>{hoursLeft}h left</p>
                  <p className='text-[10px] text-muted-foreground'>
                    {item.availableQuantity} bags left
                  </p>
                </div>
                <Badge variant='secondary' className='capitalize text-[10px]'>
                  {item.status}
                </Badge>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminOffersPage() {
  const t = useTranslations('dashboard.adminOffers');
  const { data: stats, isLoading: loadingStats } = useOfferStats();
  const bulkMutation = useBulkOfferAction();
  const autoFeatureMutation = useTriggerAutoFeaturing();
  const updateExpiredMutation = useUpdateExpiredOffers();

  const [selected, setSelected] = useState<string[]>([]);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null);

  const toggleSelect = useCallback((id: string) => {
    setSelected(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  }, []);

  const toggleAll = useCallback(
    (ids: string[]) => {
      const allSelected = ids.every(id => selected.includes(id));
      if (allSelected) {
        setSelected(prev => prev.filter(id => !ids.includes(id)));
      } else {
        setSelected(prev => [...new Set([...prev, ...ids])]);
      }
    },
    [selected],
  );

  const handleBulkAction = (action: BulkOfferAction) => {
    if (action === 'delete') {
      setDeleteDialog(true);
      return;
    }
    bulkMutation.mutate({ action, offerIds: selected }, { onSuccess: () => setSelected([]) });
  };

  const confirmDelete = () => {
    bulkMutation.mutate(
      { action: 'delete', offerIds: selected, reason: deleteReason },
      {
        onSuccess: () => {
          setSelected([]);
          setDeleteDialog(false);
          setDeleteReason('');
        },
      },
    );
  };

  const handleExport = () => {
    void adminService.exportOffers('csv').then(response => {
      const blob = new Blob([response.data as unknown as BlobPart], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `offers-export-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    });
  };

  return (
    <div className='space-y-xl'>
      {/* Header */}
      <div className='flex items-start justify-between gap-lg'>
        <div>
          <h1 className='text-xl font-bold tracking-tight'>{t('title')}</h1>
          <p className='mt-xxs text-sm text-muted-foreground'>{t('description')}</p>
        </div>
        <div className='flex gap-sm shrink-0'>
          <Button
            variant='outline'
            size='sm'
            className='gap-1.5'
            disabled={autoFeatureMutation.isPending}
            onClick={() =>
              autoFeatureMutation.mutate(undefined, {
                onSuccess: data => {
                  const result = data as {
                    offersAutoFeatured: number;
                    offersAutoUnfeatured: number;
                  };
                  toast.success(
                    t('actions.autoFeatureSuccess', {
                      featured: result.offersAutoFeatured,
                      unfeatured: result.offersAutoUnfeatured,
                    }),
                  );
                },
              })
            }
          >
            <Zap className='size-3.5' />
            {t('actions.autoFeature')}
          </Button>
          <Button
            variant='outline'
            size='sm'
            className='gap-1.5'
            disabled={updateExpiredMutation.isPending}
            onClick={() =>
              updateExpiredMutation.mutate(undefined, {
                onSuccess: () => toast.success(t('actions.expiredUpdated')),
              })
            }
          >
            <RefreshCw className='size-3.5' />
            {t('actions.updateExpired')}
          </Button>
          <Button variant='outline' size='sm' className='gap-1.5' onClick={handleExport}>
            <Download className='size-3.5' />
            {t('actions.export')}
          </Button>
        </div>
      </div>

      {/* Stats row */}
      {loadingStats ? (
        <div className='grid grid-cols-2 gap-md sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-7'>
          {[...Array(7)].map((_, i) => (
            <Skeleton key={i} className='h-[76px] rounded-xl' />
          ))}
        </div>
      ) : (
        <div className='grid grid-cols-2 gap-md sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-7'>
          <StatCard
            label={t('stats.totalActive')}
            value={(stats?.countByStatus?.['active'] ?? 0).toLocaleString()}
            icon={Tag}
            iconBg='bg-emerald-50'
            iconColor='text-emerald-600'
          />
          <StatCard
            label={t('stats.totalBagsSold')}
            value={(stats?.totalSoldBags ?? 0).toLocaleString()}
            icon={ShoppingBag}
            iconBg='bg-sky-50'
            iconColor='text-sky-600'
          />
          <StatCard
            label={t('stats.avgDiscount')}
            value={`${stats?.avgDiscountPercentage ?? 0}%`}
            icon={Percent}
            iconBg='bg-violet-50'
            iconColor='text-violet-600'
          />
          <StatCard
            label={t('stats.pickupRate')}
            value={fmtPct(stats?.platformPickupRate ?? 0)}
            icon={TrendingUp}
            iconBg='bg-amber-50'
            iconColor='text-amber-600'
          />
          <StatCard
            label={t('stats.featured')}
            value={stats?.featuredCount ?? 0}
            icon={Star}
            iconBg='bg-yellow-50'
            iconColor='text-yellow-600'
          />
          <StatCard
            label={t('stats.priceViolations')}
            value='—'
            icon={AlertTriangle}
            iconBg='bg-orange-50'
            iconColor='text-orange-600'
          />
          <StatCard
            label={t('stats.lowPickup')}
            value='—'
            icon={TrendingDown}
            iconBg='bg-red-50'
            iconColor='text-red-500'
          />
        </div>
      )}

      {/* Main content */}
      <Card className='border-border/60'>
        <CardContent className='p-0'>
          <Tabs defaultValue='all'>
            <div className='border-b border-border/60 px-lg pt-xs'>
              <TabsList className='h-auto gap-0 rounded-none border-none bg-transparent p-0'>
                {[
                  { value: 'all', label: t('tabs.all'), icon: null },
                  { value: 'expiring', label: t('tabs.expiring'), icon: Clock },
                  { value: 'lowPickup', label: t('tabs.lowPickup'), icon: TrendingDown },
                  { value: 'violations', label: t('tabs.violations'), icon: AlertTriangle },
                  { value: 'deleted', label: t('tabs.deleted'), icon: Trash2 },
                ].map(tab => (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className='relative rounded-none border-none bg-transparent px-md py-2.5 text-xs font-medium text-muted-foreground shadow-none transition-colors hover:text-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none after:absolute after:inset-x-0 after:bottom-0 after:h-[2px] after:rounded-full after:bg-transparent data-[state=active]:after:bg-primary'
                  >
                    {tab.icon && <tab.icon className='me-1.5 size-3' />}
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
            <div className='p-lg'>
              {/* Bulk action bar — only on All tab */}
              <BulkBar
                selected={selected}
                onAction={handleBulkAction}
                onClear={() => setSelected([])}
                isPending={bulkMutation.isPending}
                t={t}
              />

              <TabsContent value='all' className='mt-md'>
                <AllOffersTable
                  t={t}
                  selected={selected}
                  onToggle={toggleSelect}
                  onToggleAll={toggleAll}
                  onView={setSelectedOfferId}
                />
              </TabsContent>

              <TabsContent value='expiring' className='mt-md'>
                <ExpiringTab t={t} />
              </TabsContent>

              <TabsContent value='lowPickup' className='mt-md'>
                <LowPickupTab t={t} />
              </TabsContent>

              <TabsContent value='violations' className='mt-md'>
                <PriceViolationsTab t={t} />
              </TabsContent>

              <TabsContent value='deleted' className='mt-md'>
                <DeletedTab t={t} />
              </TabsContent>
            </div>
          </Tabs>
        </CardContent>
      </Card>

      {/* Offer detail sheet */}
      <OfferDetailSheet offerId={selectedOfferId} onClose={() => setSelectedOfferId(null)} />

      {/* Delete reason dialog */}
      <Dialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <DialogContent className='max-w-md'>
          <DialogHeader>
            <DialogTitle>{t('bulk.delete')}</DialogTitle>
          </DialogHeader>
          <div className='space-y-md py-sm'>
            <p className='text-sm text-muted-foreground'>
              You are about to delete <strong>{selected.length}</strong> offer(s). This action
              creates a soft-delete record and can be reversed from the Deleted tab.
            </p>
            <div className='space-y-1.5'>
              <Label htmlFor='delete-reason'>{t('bulk.deleteReason')} *</Label>
              <Textarea
                id='delete-reason'
                value={deleteReason}
                onChange={e => setDeleteReason(e.target.value)}
                placeholder={t('bulk.deleteReasonPlaceholder')}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={() => setDeleteDialog(false)}>
              Cancel
            </Button>
            <Button
              variant='destructive'
              disabled={!deleteReason.trim() || bulkMutation.isPending}
              onClick={confirmDelete}
            >
              {bulkMutation.isPending ? 'Deleting…' : `Delete ${selected.length} offer(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
