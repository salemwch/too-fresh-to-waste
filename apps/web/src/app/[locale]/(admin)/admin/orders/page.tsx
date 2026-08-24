'use client';

import { useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  ShoppingBag,
  Truck,
  AlertTriangle,
  RotateCcw,
  DollarSign,
  Eye,
  Ban,
  MoreHorizontal,
  Clock,
  CheckCircle2,
  XCircle,
  MapPin,
  User,
  Store,
  Hash,
  Calendar,
  CreditCard,
  Copy,
  MessageSquare,
  Trash2,
  RefreshCw,
} from 'lucide-react';
import {
  Card,
  CardContent,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Sheet,
  SheetContent,
  SheetTitle,
  Separator,
  Avatar,
  AvatarFallback,
} from '@foodwaste/ui';
import { AdminModuleHeader } from '@/components/dashboard/admin/admin-module-header';
import { AdminTabNav } from '@/components/dashboard/admin/admin-tab-nav';
import { AdminKpiRow } from '@/components/dashboard/admin/admin-kpi-row';
import { AdminDataTable, type ColumnDef } from '@/components/dashboard/admin/admin-data-table';
import { ConfirmActionDialog } from '@/components/dashboard/admin/confirm-action-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { orderStatusColor } from '@/lib/order-status';
import { toast } from 'sonner';
import {
  useAdminOrders,
  useAdminOrderStats,
  useAdminOrderDetail,
  useAdminCancelOrder,
  useAdminRefundOrder,
  useDeleteOrder,
  useUpdateExpiredOrders,
} from '@/hooks/use-admin';
import type { KpiItem } from '@/components/dashboard/admin/admin-kpi-row';
import type { AdminTab } from '@/components/dashboard/admin/admin-tab-nav';
import type {
  AdminOrderItem,
  AdminOrderStatus,
  AdminPaymentStatus,
  AdminOrderQuery,
} from '@/types/admin';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCurrency(v: number) {
  return `${v.toFixed(2)} TND`;
}

function relativeDate(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  return `${days}d ago`;
}

const EM_DASH = '—';

/** One timestamp in the delivery leg, or the pending placeholder. */
function DeliveryStep({
  label,
  at,
  pending,
}: {
  label: string;
  at?: string | undefined;
  pending: string;
}) {
  return (
    <div className='flex items-center justify-between'>
      <span className='text-xs text-muted-foreground'>{label}</span>
      <span className={cn('text-xs', at ? 'font-medium' : 'text-muted-foreground')}>
        {at
          ? new Date(at).toLocaleString(undefined, {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })
          : pending}
      </span>
    </div>
  );
}

function getPaymentStatusIcon(status: string) {
  switch (status) {
    case 'paid':
    case 'held':
      return <CheckCircle2 className='size-3.5 text-emerald-600' />;
    case 'refunded':
    case 'refund_pending':
    case 'partially_refunded':
      return <RotateCcw className='size-3.5 text-sky-600' />;
    case 'failed':
      return <XCircle className='size-3.5 text-rose-600' />;
    default:
      return <Clock className='size-3.5 text-amber-600' />;
  }
}

const TERMINAL_STATUSES: AdminOrderStatus[] = [
  'completed',
  'picked_up',
  'delivered',
  'cancelled',
  'expired',
  'refunded',
];

const CANCELLABLE_STATUSES: AdminOrderStatus[] = [
  'pending',
  'pending_payment',
  'reserved',
  'confirmed',
  'ready_for_pickup',
];

const REFUNDABLE_PAYMENT_STATUSES: AdminPaymentStatus[] = ['paid', 'held'];

// ─── Order Detail Drawer ─────────────────────────────────────────────────────

function OrderDetailDrawer({
  orderId,
  open,
  onClose,
}: {
  orderId: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const tStatus = useTranslations('adminOrders.statuses');
  const tDelivery = useTranslations('adminOrders.delivery');
  const { data: order } = useAdminOrderDetail(orderId);

  if (!order) {
    return (
      <Sheet open={open} onOpenChange={v => !v && onClose()}>
        <SheetContent className='w-full overflow-y-auto sm:max-w-xl'>
          <SheetTitle className='sr-only'>Order Details</SheetTitle>
          <div className='space-y-lg p-lg'>
            <Skeleton className='h-20' />
            <Skeleton className='h-40' />
            <Skeleton className='h-32' />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent className='w-full overflow-y-auto sm:max-w-xl'>
        <SheetTitle className='sr-only'>Order Details</SheetTitle>

        <div className='space-y-0'>
          {/* Header */}
          <div className='-mx-2xl -mt-2xl mb-0 border-b border-border/60 bg-muted/20 px-2xl pb-xl pt-xl pe-14'>
            <div className='flex items-start justify-between gap-md'>
              <div>
                <p className='text-base font-semibold'>{order.orderNumber}</p>
                <p className='mt-xxs text-xs text-muted-foreground'>
                  {new Date(order.createdAt).toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
              <span
                className={cn(
                  'inline-flex items-center rounded-full border px-2.5 py-xxs text-xs font-semibold',
                  orderStatusColor(order.status),
                )}
              >
                {tStatus(order.status)}
              </span>
            </div>
            <div className='mt-md flex gap-sm'>
              <div className='flex-1 rounded-lg bg-background/60 border border-border/40 px-md py-sm text-center'>
                <p className='text-lg font-bold tabular-nums'>
                  {formatCurrency(order.pricing.total)}
                </p>
                <p className='text-[10px] text-muted-foreground'>Amount</p>
              </div>
              <div className='flex-1 rounded-lg bg-background/60 border border-border/40 px-md py-sm text-center'>
                <p className='text-lg font-bold tabular-nums'>{order.items?.length ?? 0}</p>
                <p className='text-[10px] text-muted-foreground'>Items</p>
              </div>
              <div className='flex-1 rounded-lg bg-background/60 border border-border/40 px-md py-sm text-center'>
                <div className='flex items-center justify-center gap-xs'>
                  {getPaymentStatusIcon(order.paymentStatus)}
                  <p className='text-sm font-semibold capitalize'>
                    {order.paymentStatus.replace(/_/g, ' ')}
                  </p>
                </div>
                <p className='text-[10px] text-muted-foreground'>Payment</p>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className='space-y-xl px-0 py-xl'>
            {/* Customer */}
            <section className='space-y-md'>
              <h3 className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
                Customer
              </h3>
              <div className='flex items-center gap-md rounded-lg border border-border/60 p-md'>
                <Avatar className='size-9'>
                  <AvatarFallback className='text-xs'>
                    {order.customer.name
                      .split(' ')
                      .map(n => n[0])
                      .join('')}
                  </AvatarFallback>
                </Avatar>
                <div className='min-w-0 flex-1'>
                  <p className='text-sm font-medium'>{order.customer.name}</p>
                  <p className='text-xs text-muted-foreground'>{order.customer.email}</p>
                  {order.customer.phone && (
                    <p className='text-xs text-muted-foreground'>{order.customer.phone}</p>
                  )}
                </div>
              </div>
            </section>

            {/* Merchant */}
            <section className='space-y-md'>
              <h3 className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
                Merchant
              </h3>
              <div className='flex items-center gap-md rounded-lg border border-border/60 p-md'>
                <div className='size-9 rounded-lg bg-primary/10 grid place-items-center'>
                  <Store className='size-4 text-primary' />
                </div>
                <div className='min-w-0 flex-1'>
                  <p className='text-sm font-medium'>{order.merchant.name}</p>
                  <p className='text-xs text-muted-foreground'>{order.establishment.name}</p>
                </div>
              </div>
            </section>

            {/* Delivery — only rendered for delivery orders; pickup is the
                default mode and has no driver leg to show. */}
            {order.deliveryMode === 'delivery' && (
              <>
                <Separator />
                <section className='space-y-md'>
                  <h3 className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
                    {tDelivery('title')}
                  </h3>
                  <div className='flex items-center gap-md rounded-lg border border-border/60 p-md'>
                    <div className='grid size-9 place-items-center rounded-lg bg-blue-50'>
                      <Truck className='size-4 text-blue-700' />
                    </div>
                    <div className='min-w-0 flex-1'>
                      <p className='text-sm font-medium'>
                        {order.driver?.name ?? tDelivery('unassigned')}
                      </p>
                      <p className='text-xs text-muted-foreground'>
                        {order.deliveryAddress?.city ?? EM_DASH}
                        {order.estimatedDistanceKm != null &&
                          ` · ${order.estimatedDistanceKm.toFixed(1)} km`}
                      </p>
                    </div>
                  </div>
                  <div className='space-y-sm'>
                    <DeliveryStep
                      label={tDelivery('assignedAt')}
                      at={order.driverAssignedAt}
                      pending={tDelivery('pending')}
                    />
                    <DeliveryStep
                      label={tDelivery('pickedUpAt')}
                      at={order.driverPickedUpAt}
                      pending={tDelivery('pending')}
                    />
                    <DeliveryStep
                      label={tDelivery('deliveredAt')}
                      at={order.deliveredAt}
                      pending={tDelivery('pending')}
                    />
                    {order.driverEarnings != null && (
                      <div className='flex items-center justify-between'>
                        <span className='text-xs text-muted-foreground'>
                          {tDelivery('driverEarnings')}
                        </span>
                        <span className='text-xs font-medium tabular-nums'>
                          {formatCurrency(order.driverEarnings)}
                        </span>
                      </div>
                    )}
                  </div>
                </section>
              </>
            )}

            <Separator />

            {/* Order Details */}
            <section className='space-y-md'>
              <h3 className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
                Details
              </h3>
              <div className='space-y-2.5'>
                <div className='flex items-center justify-between'>
                  <div className='flex items-center gap-1.5 text-muted-foreground'>
                    <Hash className='size-3' />
                    <span className='text-xs'>Order ID</span>
                  </div>
                  <div className='flex items-center gap-1.5'>
                    <span className='font-mono text-[11px] text-muted-foreground'>
                      ...{order._id.slice(-8)}
                    </span>
                    <button
                      onClick={() => void navigator.clipboard.writeText(order._id)}
                      className='text-muted-foreground hover:text-foreground transition-colors'
                      aria-label='Copy order ID'
                    >
                      <Copy className='size-3' />
                    </button>
                  </div>
                </div>
                <div className='flex items-center justify-between'>
                  <div className='flex items-center gap-1.5 text-muted-foreground'>
                    <CreditCard className='size-3' />
                    <span className='text-xs'>Payment Provider</span>
                  </div>
                  <span className='text-xs font-medium capitalize'>{order.paymentProvider}</span>
                </div>
                <div className='flex items-center justify-between'>
                  <div className='flex items-center gap-1.5 text-muted-foreground'>
                    <Calendar className='size-3' />
                    <span className='text-xs'>Created</span>
                  </div>
                  <span className='text-xs font-medium'>
                    {new Date(order.createdAt).toLocaleString('en-GB')}
                  </span>
                </div>
                {order.expiresAt && (
                  <div className='flex items-center justify-between'>
                    <div className='flex items-center gap-1.5 text-muted-foreground'>
                      <MapPin className='size-3' />
                      <span className='text-xs'>Pickup Before</span>
                    </div>
                    <span className='text-xs font-medium'>
                      {new Date(order.expiresAt).toLocaleTimeString('en-GB', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                )}
              </div>
            </section>

            {/* Cancellation info */}
            {order.cancellationReason && (
              <>
                <Separator />
                <section className='space-y-md'>
                  <h3 className='text-xs font-semibold uppercase tracking-wide text-rose-600'>
                    Cancellation
                  </h3>
                  <div className='rounded-lg border border-rose-200 bg-rose-50/50 p-md'>
                    <div className='flex items-start gap-sm'>
                      <MessageSquare className='size-4 text-rose-600 mt-xxs shrink-0' />
                      <p className='text-xs text-rose-800'>{order.cancellationReason}</p>
                    </div>
                  </div>
                </section>
              </>
            )}

            {/* Refund requests */}
            {order.refundRequests.length > 0 && (
              <>
                <Separator />
                <section className='space-y-md'>
                  <h3 className='text-xs font-semibold uppercase tracking-wide text-sky-600'>
                    Refund Requests
                  </h3>
                  {order.refundRequests.map((refund, i) => (
                    <div key={i} className='rounded-lg border border-sky-200 bg-sky-50/50 p-md'>
                      <div className='flex items-center justify-between mb-xs'>
                        <span className='text-[10px] font-medium uppercase text-sky-600'>
                          {refund.status}
                        </span>
                        <span className='text-sm font-bold text-sky-700'>
                          {formatCurrency(refund.amount)}
                        </span>
                      </div>
                      <p className='text-xs text-sky-800'>{refund.reason}</p>
                      {refund.notes && (
                        <p className='mt-xs text-[11px] text-sky-600 italic'>{refund.notes}</p>
                      )}
                    </div>
                  ))}
                </section>
              </>
            )}

            <Separator />

            {/* Admin Actions */}
            <section className='space-y-md'>
              <h3 className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
                Actions
              </h3>
              <div className='flex flex-wrap gap-sm'>
                {CANCELLABLE_STATUSES.includes(order.status) && (
                  <Button
                    size='sm'
                    variant='outline'
                    className='text-xs text-rose-600 border-rose-200 hover:bg-rose-50'
                  >
                    <Ban className='me-1.5 size-3.5' />
                    Cancel Order
                  </Button>
                )}
                {REFUNDABLE_PAYMENT_STATUSES.includes(order.paymentStatus) &&
                  order.paymentProvider === 'konnect' &&
                  !TERMINAL_STATUSES.includes(order.status) && (
                    <Button
                      size='sm'
                      variant='outline'
                      className='text-xs text-sky-600 border-sky-200 hover:bg-sky-50'
                    >
                      <RotateCcw className='me-1.5 size-3.5' />
                      Issue Refund
                    </Button>
                  )}
              </div>
            </section>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Orders Content (with searchParams) ──────────────────────────────────────

function OrdersContent() {
  const t = useTranslations('adminOrders');
  const tStatus = useTranslations('adminOrders.statuses');
  const tDelivery = useTranslations('adminOrders.delivery');
  const searchParams = useSearchParams();
  const currentTab = searchParams.get('tab') ?? 'all';

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [cancelDialog, setCancelDialog] = useState<{ open: boolean; orderId: string | null }>({
    open: false,
    orderId: null,
  });
  const [refundDialog, setRefundDialog] = useState<{ open: boolean; orderId: string | null }>({
    open: false,
    orderId: null,
  });

  const queryParams: AdminOrderQuery = {
    page,
    limit: 20,
    ...(search ? { search } : {}),
    ...(currentTab === 'pending' ? { status: 'pending' as AdminOrderStatus } : {}),
    ...(currentTab === 'disputes' ? { status: 'cancelled' as AdminOrderStatus } : {}),
    ...(currentTab === 'refunds' ? { paymentStatus: 'refunded' as AdminPaymentStatus } : {}),
  };

  const { data: ordersResponse, isLoading: ordersLoading } = useAdminOrders(queryParams);
  const { data: stats } = useAdminOrderStats();
  const cancelMutation = useAdminCancelOrder();
  const refundMutation = useAdminRefundOrder();
  const deleteMutation = useDeleteOrder();
  const updateExpiredMutation = useUpdateExpiredOrders();
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; orderId: string | null }>({
    open: false,
    orderId: null,
  });

  const orders = ordersResponse?.data ?? [];
  const meta = ordersResponse?.meta;
  const totalPages = meta?.totalPages ?? 1;

  const tabs: AdminTab[] = [
    { key: 'all', label: t('tabs.all') },
    { key: 'pending', label: t('tabs.pending') },
    {
      key: 'disputes',
      label: t('tabs.disputes'),
      ...(stats && stats.countByStatus['cancelled']
        ? { badge: stats.countByStatus['cancelled'] }
        : {}),
    },
    { key: 'refunds', label: t('tabs.refunds') },
  ];

  const kpis: KpiItem[] = [
    {
      label: t('kpi.totalOrders'),
      value: stats?.totalOrders.toString() ?? '—',
      icon: ShoppingBag,
      iconBg: 'bg-sky-50',
      iconColor: 'text-sky-600',
    },
    {
      label: t('kpi.activeOrders'),
      value: stats?.activeOrders.toString() ?? '—',
      icon: Clock,
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-600',
    },
    {
      label: t('kpi.disputeRate'),
      value: stats ? `${(stats.disputeRate * 100).toFixed(1)}%` : '—',
      icon: AlertTriangle,
      iconBg: 'bg-orange-50',
      iconColor: 'text-orange-600',
      highlight: (stats?.disputeRate ?? 0) > 0.05,
    },
    {
      label: t('kpi.totalRevenue'),
      value: stats ? formatCurrency(stats.totalRevenue) : '—',
      icon: DollarSign,
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
    },
  ];

  const handleSearch = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  const handleCancelConfirm = useCallback(
    (reason?: string) => {
      if (!cancelDialog.orderId || !reason) return;
      cancelMutation.mutate(
        { orderId: cancelDialog.orderId, payload: { reason } },
        { onSettled: () => setCancelDialog({ open: false, orderId: null }) },
      );
    },
    [cancelDialog.orderId, cancelMutation],
  );

  const handleRefundConfirm = useCallback(
    (reason?: string) => {
      if (!refundDialog.orderId || !reason) return;
      refundMutation.mutate(
        { orderId: refundDialog.orderId, payload: { reason } },
        { onSettled: () => setRefundDialog({ open: false, orderId: null }) },
      );
    },
    [refundDialog.orderId, refundMutation],
  );

  const columns: ColumnDef<AdminOrderItem>[] = [
    {
      key: 'orderNumber',
      header: t('columns.order'),
      render: order => (
        <div>
          <p className='text-xs font-semibold tabular-nums'>{order.orderNumber}</p>
          <p className='text-[10px] text-muted-foreground'>{relativeDate(order.createdAt)}</p>
        </div>
      ),
    },
    {
      key: 'customer',
      header: t('columns.customer'),
      render: order => (
        <div className='flex items-center gap-sm'>
          <User className='size-3.5 text-muted-foreground shrink-0' />
          <span className='text-xs truncate max-w-[120px]'>{order.customer.name}</span>
        </div>
      ),
    },
    {
      key: 'merchant',
      header: t('columns.merchant'),
      render: order => (
        <div className='flex items-center gap-sm'>
          <Store className='size-3.5 text-muted-foreground shrink-0' />
          <span className='text-xs truncate max-w-[120px]'>{order.merchant.name}</span>
        </div>
      ),
    },
    {
      key: 'delivery',
      header: tDelivery('title'),
      render: order =>
        order.deliveryMode === 'delivery' ? (
          <div className='flex items-center gap-1.5'>
            <Truck className='size-3 shrink-0 text-blue-600' aria-hidden='true' />
            <span className='truncate text-[11px]'>
              {order.driver?.name ?? tDelivery('unassigned')}
            </span>
          </div>
        ) : (
          <span className='text-[11px] text-muted-foreground'>{tDelivery('pickup')}</span>
        ),
    },
    {
      key: 'status',
      header: t('columns.status'),
      render: order => (
        <span
          className={cn(
            'inline-flex items-center rounded-full border px-sm py-xxs text-[10px] font-semibold',
            orderStatusColor(order.status),
          )}
        >
          {tStatus(order.status)}
        </span>
      ),
    },
    {
      key: 'amount',
      header: t('columns.amount'),
      render: order => (
        <span className='text-xs font-semibold tabular-nums'>
          {formatCurrency(order.pricing.total)}
        </span>
      ),
    },
    {
      key: 'payment',
      header: t('columns.payment'),
      render: order => (
        <div className='flex items-center gap-1.5'>
          {getPaymentStatusIcon(order.paymentStatus)}
          <span className='text-xs capitalize'>{order.paymentProvider}</span>
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: order => (
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button variant='ghost' size='sm' className='h-9 w-9 p-0'>
              <MoreHorizontal className='size-3.5' />
              <span className='sr-only'>Actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end' className='w-36'>
            <DropdownMenuItem onClick={() => setSelectedOrderId(order._id)}>
              <Eye className='me-sm size-3.5' />
              {t('actions.viewDetails')}
            </DropdownMenuItem>
            {CANCELLABLE_STATUSES.includes(order.status) && (
              <DropdownMenuItem
                className='text-rose-600'
                onClick={() => setCancelDialog({ open: true, orderId: order._id })}
              >
                <Ban className='me-sm size-3.5' />
                {t('actions.cancel')}
              </DropdownMenuItem>
            )}
            {REFUNDABLE_PAYMENT_STATUSES.includes(order.paymentStatus) &&
              order.paymentProvider === 'konnect' && (
                <DropdownMenuItem
                  className='text-sky-600'
                  onClick={() => setRefundDialog({ open: true, orderId: order._id })}
                >
                  <RotateCcw className='me-sm size-3.5' />
                  {t('actions.refund')}
                </DropdownMenuItem>
              )}
            <DropdownMenuItem
              className='text-destructive'
              onClick={() => setDeleteDialog({ open: true, orderId: order._id })}
            >
              <Trash2 className='me-sm size-3.5' />
              {t('actions.delete')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className='space-y-xl'>
      <div className='flex items-start justify-between gap-lg'>
        <AdminModuleHeader title={t('title')} subtitle={t('subtitle')} />
        <div className='flex gap-sm shrink-0'>
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
            {t('actions.processExpired')}
          </Button>
        </div>
      </div>

      <AdminKpiRow items={kpis} loading={!stats} />

      <Card className='border-border/60'>
        <CardContent className='p-0'>
          <AdminTabNav tabs={tabs} />

          <div className='p-lg'>
            <AdminDataTable
              columns={columns}
              data={orders}
              isLoading={ordersLoading}
              page={page}
              totalPages={totalPages}
              total={meta?.total ?? 0}
              onPageChange={setPage}
              searchPlaceholder={t('searchPlaceholder')}
              onSearchChange={handleSearch}
              onRowClick={row => setSelectedOrderId(row._id)}
              emptyIcon={ShoppingBag}
              emptyTitle={t('empty.title')}
              emptyDescription={t('empty.description')}
            />
          </div>
        </CardContent>
      </Card>

      <OrderDetailDrawer
        orderId={selectedOrderId}
        open={!!selectedOrderId}
        onClose={() => setSelectedOrderId(null)}
      />

      <ConfirmActionDialog
        open={cancelDialog.open}
        onOpenChange={open => !open && setCancelDialog({ open: false, orderId: null })}
        title={t('cancelDialog.title')}
        description={t('cancelDialog.description')}
        confirmLabel={t('actions.cancel')}
        variant='danger'
        isLoading={cancelMutation.isPending}
        onConfirm={handleCancelConfirm}
        reasonConfig={{
          label: t('cancelDialog.reasonLabel'),
          placeholder: t('cancelDialog.reasonPlaceholder'),
          required: true,
        }}
      />

      <ConfirmActionDialog
        open={refundDialog.open}
        onOpenChange={open => !open && setRefundDialog({ open: false, orderId: null })}
        title={t('refundDialog.title')}
        description={t('refundDialog.description')}
        confirmLabel={t('actions.refund')}
        variant='danger'
        isLoading={refundMutation.isPending}
        onConfirm={handleRefundConfirm}
        reasonConfig={{
          label: t('refundDialog.reasonLabel'),
          placeholder: t('refundDialog.reasonPlaceholder'),
          required: true,
        }}
      />

      <ConfirmActionDialog
        open={deleteDialog.open}
        onOpenChange={open => !open && setDeleteDialog({ open: false, orderId: null })}
        title={t('deleteDialog.title')}
        description={t('deleteDialog.description')}
        confirmLabel={t('actions.delete')}
        variant='danger'
        isLoading={deleteMutation.isPending}
        onConfirm={() => {
          if (!deleteDialog.orderId) return;
          deleteMutation.mutate(deleteDialog.orderId, {
            onSettled: () => setDeleteDialog({ open: false, orderId: null }),
          });
        }}
      />
    </div>
  );
}

// ─── Page (Suspense boundary for searchParams) ───────────────────────────────

export default function AdminOrdersPage() {
  return (
    <Suspense
      fallback={
        <div className='space-y-xl'>
          <Skeleton className='h-16 rounded-lg' />
          <div className='grid grid-cols-2 md:grid-cols-4 gap-md'>
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className='h-24 rounded-lg' />
            ))}
          </div>
          <Skeleton className='h-96 rounded-lg' />
        </div>
      }
    >
      <OrdersContent />
    </Suspense>
  );
}
