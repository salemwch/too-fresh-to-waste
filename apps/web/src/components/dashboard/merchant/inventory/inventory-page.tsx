'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import {
  Package,
  AlertTriangle,
  BarChart3,
  Search,
  AlertCircle,
  Clock,
  TrendingDown,
  Archive,
  ArrowUpDown,
  XCircle,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  useInventoryItems,
  useUpdateStock,
  useInventoryAnalytics,
  useInventoryAlerts,
} from '@/hooks/use-inventory';
import type {
  InventoryItem,
  InventoryStatus,
  InventoryFilters,
  StockUpdateReason,
} from '@/types/inventory';

// ─── Status badge config ────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  available: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
  low_stock: 'bg-amber-500/10 text-amber-600 border-amber-200',
  out_of_stock: 'bg-destructive/10 text-destructive border-destructive/20',
  expired: 'bg-muted text-muted-foreground border-border',
  reserved: 'bg-blue-500/10 text-blue-600 border-blue-200',
};

// ─── Skeletons ──────────────────────────────────────────────────────────────

function ItemListSkeleton() {
  return (
    <div className='space-y-3'>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className='glass rounded-xl p-4 shadow-soft'>
          <div className='flex items-center justify-between'>
            <div className='space-y-2'>
              <Skeleton className='h-5 w-48' />
              <Skeleton className='h-4 w-32' />
            </div>
            <Skeleton className='h-8 w-24' />
          </div>
        </div>
      ))}
    </div>
  );
}

function AnalyticsSkeleton() {
  return (
    <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className='glass rounded-2xl p-[24px] shadow-soft'>
          <Skeleton className='h-4 w-24 mb-2' />
          <Skeleton className='h-8 w-16' />
        </div>
      ))}
    </div>
  );
}

// ─── Error state ────────────────────────────────────────────────────────────

function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className='glass rounded-2xl p-[24px] shadow-soft'>
      <div className='flex flex-col items-center justify-center py-10 gap-3 text-center'>
        <AlertCircle className='size-12 text-muted-foreground' />
        <p className='text-sm text-muted-foreground'>{message}</p>
        {onRetry && (
          <Button variant='outline' size='sm' onClick={onRetry}>
            Retry
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Stock Update Dialog ────────────────────────────────────────────────────

const REASON_KEYS: StockUpdateReason[] = [
  'restock',
  'sale',
  'waste',
  'adjustment',
  'return',
  'correction',
];

const REASON_LABEL_MAP: Record<string, string> = {
  restock: 'received',
  sale: 'sold',
  waste: 'spoiled',
  adjustment: 'adjustment',
  return: 'returned',
  correction: 'adjustment',
  reservation: 'adjustment',
  release: 'adjustment',
};

function StockUpdateDialog({
  item,
  open,
  onOpenChange,
}: {
  item: InventoryItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('dashboard.inventory.stockUpdate');
  const updateStock = useUpdateStock();
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState<StockUpdateReason>('adjustment');
  const [notes, setNotes] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!item) return;
    updateStock.mutate(
      {
        id: item.id,
        payload: {
          quantity: Number(quantity),
          reason,
          ...(notes ? { notes } : {}),
        },
      },
      {
        onSuccess: () => {
          toast.success(t('success'));
          onOpenChange(false);
          setQuantity('');
          setReason('adjustment');
          setNotes('');
        },
        onError: () => toast.error(t('error')),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t('title')}
            {item ? ` — ${item.name}` : ''}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className='space-y-4'>
          <div className='space-y-2'>
            <Label>{t('quantity')}</Label>
            <Input
              type='number'
              value={quantity}
              onChange={e => setQuantity(e.target.value)}
              required
              min={0}
            />
          </div>
          <div className='space-y-2'>
            <Label>{t('reason')}</Label>
            <Select value={reason} onValueChange={v => setReason(v as StockUpdateReason)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REASON_KEYS.map(r => (
                  <SelectItem key={r} value={r}>
                    {t(`reasons.${REASON_LABEL_MAP[r] || r}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className='space-y-2'>
            <Label>{t('notes')}</Label>
            <Input value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
          <DialogFooter>
            <Button
              type='submit'
              disabled={updateStock.isPending || !quantity}
              className='bg-primary-500 hover:bg-primary-500/90 text-white'
            >
              {updateStock.isPending ? t('submitting') : t('submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Item Card ──────────────────────────────────────────────────────────────

function InventoryItemCard({
  item,
  onUpdateStock,
}: {
  item: InventoryItem;
  onUpdateStock: (item: InventoryItem) => void;
}) {
  const t = useTranslations('dashboard.inventory');

  const daysUntilExpiry = Math.ceil(
    (new Date(item.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );
  const isExpiringSoon = daysUntilExpiry > 0 && daysUntilExpiry <= 3;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className='glass rounded-xl p-4 shadow-soft hover:shadow-md transition-shadow'
    >
      <div className='flex items-start justify-between'>
        <div className='flex-1 min-w-0'>
          <div className='flex items-center gap-2 mb-1'>
            <h3 className='text-sm font-semibold truncate'>{item.name}</h3>
            <Badge
              variant='outline'
              className={`text-xs shrink-0 ${STATUS_STYLES[item.status] || STATUS_STYLES.available}`}
            >
              {t(`item.status.${item.status}`)}
            </Badge>
            {isExpiringSoon && (
              <Badge
                variant='outline'
                className='text-xs shrink-0 bg-amber-500/10 text-amber-600 border-amber-200'
              >
                <Clock className='size-3 me-1' />
                {daysUntilExpiry}d
              </Badge>
            )}
          </div>
          <div className='flex items-center gap-4 text-xs text-muted-foreground mt-1'>
            <span>
              {t('item.quantity')}:{' '}
              <span className='font-medium text-foreground'>{item.availableStock}</span>
              {item.reservedStock > 0 && (
                <span className='text-amber-600'> (+{item.reservedStock} reserved)</span>
              )}
            </span>
            {item.categories && item.categories.length > 0 && (
              <span>
                {t('item.category')}: {item.categories[0]}
              </span>
            )}
            <span>
              {t('item.expiresAt')}: {new Date(item.expiryDate).toLocaleDateString()}
            </span>
          </div>
          <div className='flex items-center gap-2 mt-2'>
            <span className='text-xs text-muted-foreground line-through'>
              {(item.originalPrice ?? 0).toFixed(2)} TND
            </span>
            <span className='text-sm font-semibold text-primary-500'>
              {(item.discountedPrice ?? 0).toFixed(2)} TND
            </span>
          </div>
        </div>
        <Button
          variant='outline'
          size='sm'
          onClick={() => onUpdateStock(item)}
          className='shrink-0 ms-4'
        >
          <ArrowUpDown className='size-4 me-1' />
          {t('item.updateStock')}
        </Button>
      </div>
    </motion.div>
  );
}

// ─── Items Tab ──────────────────────────────────────────────────────────────

function ItemsTab() {
  const t = useTranslations('dashboard.inventory');
  const [filters, setFilters] = useState<InventoryFilters>({ page: 1, limit: 20 });
  const [search, setSearch] = useState('');
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [stockDialogOpen, setStockDialogOpen] = useState(false);

  const { data, isLoading, isError, refetch } = useInventoryItems(filters);

  const items = data?.items || [];
  const filteredItems = search
    ? items.filter(item => item.name.toLowerCase().includes(search.toLowerCase()))
    : items;

  function handleStatusFilter(value: string) {
    setFilters(prev => {
      if (value === 'all') {
        const { status: _, ...rest } = prev;
        return { ...rest, page: 1 };
      }
      return { ...prev, status: value as InventoryStatus, page: 1 };
    });
  }

  function handleUpdateStock(item: InventoryItem) {
    setSelectedItem(item);
    setStockDialogOpen(true);
  }

  if (isLoading) return <ItemListSkeleton />;
  if (isError) return <ErrorState message={t('error')} onRetry={() => void refetch()} />;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className='space-y-4'
    >
      {/* Filters */}
      <div className='flex flex-wrap gap-2'>
        <div className='relative flex-1 min-w-[160px]'>
          <Search className='absolute start-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground' />
          <Input
            placeholder={t('filters.searchPlaceholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className='ps-8 h-8 text-xs'
          />
        </div>
        <Select value={filters.status || 'all'} onValueChange={handleStatusFilter}>
          <SelectTrigger className='h-8 w-auto min-w-[120px] text-xs'>
            <SelectValue placeholder={t('filters.allStatuses')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>{t('filters.allStatuses')}</SelectItem>
            <SelectItem value='available'>{t('filters.inStock')}</SelectItem>
            <SelectItem value='low_stock'>{t('filters.lowStock')}</SelectItem>
            <SelectItem value='out_of_stock'>{t('filters.outOfStock')}</SelectItem>
            <SelectItem value='expired'>{t('filters.expired')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Item list */}
      {filteredItems.length === 0 ? (
        <div className='glass rounded-2xl p-[24px] shadow-soft'>
          <div className='flex flex-col items-center justify-center py-10 gap-3 text-center'>
            <Package className='size-12 text-muted-foreground' />
            <h3 className='text-md font-semibold'>{t('empty.title')}</h3>
            <p className='text-sm text-muted-foreground max-w-xs'>{t('empty.description')}</p>
          </div>
        </div>
      ) : (
        <div className='space-y-3'>
          {filteredItems.map(item => (
            <InventoryItemCard key={item.id} item={item} onUpdateStock={handleUpdateStock} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {data?.meta && data.meta.totalPages > 1 && (
        <div className='flex items-center justify-center gap-2 pt-4'>
          <Button
            variant='outline'
            size='sm'
            disabled={filters.page <= 1}
            onClick={() => setFilters(prev => ({ ...prev, page: prev.page - 1 }))}
          >
            Previous
          </Button>
          <span className='text-sm text-muted-foreground'>
            {filters.page} / {data.meta.totalPages}
          </span>
          <Button
            variant='outline'
            size='sm'
            disabled={filters.page >= data.meta.totalPages}
            onClick={() => setFilters(prev => ({ ...prev, page: prev.page + 1 }))}
          >
            Next
          </Button>
        </div>
      )}

      <StockUpdateDialog
        item={selectedItem}
        open={stockDialogOpen}
        onOpenChange={setStockDialogOpen}
      />
    </motion.div>
  );
}

// ─── Alerts Tab ─────────────────────────────────────────────────────────────

const ALERT_ICONS: Record<string, typeof AlertTriangle> = {
  low_stock: TrendingDown,
  expiring: Clock,
  expired: XCircle,
  out_of_stock: Archive,
};

const ALERT_STYLES: Record<string, string> = {
  warning: 'border-amber-200 bg-amber-500/5',
  critical: 'border-destructive/20 bg-destructive/5',
};

function AlertsTab() {
  const t = useTranslations('dashboard.inventory.alerts');
  const { data: alerts, isLoading, isError, refetch } = useInventoryAlerts();

  if (isLoading) {
    return (
      <div className='space-y-3'>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className='h-16 w-full rounded-xl' />
        ))}
      </div>
    );
  }

  if (isError) return <ErrorState message={t('noAlerts')} onRetry={() => void refetch()} />;

  if (!alerts || alerts.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className='glass rounded-2xl p-[24px] shadow-soft'
      >
        <div className='flex flex-col items-center justify-center py-10 gap-3 text-center'>
          <AlertTriangle className='size-12 text-muted-foreground' />
          <h3 className='text-md font-semibold'>{t('noAlerts')}</h3>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className='space-y-3'
    >
      {alerts.map(alert => {
        const Icon = ALERT_ICONS[alert.type] || AlertTriangle;
        return (
          <div
            key={alert.id}
            className={`rounded-xl border p-4 ${ALERT_STYLES[alert.severity] || ''}`}
          >
            <div className='flex items-start gap-3'>
              <Icon
                className={`size-5 shrink-0 mt-0.5 ${alert.severity === 'critical' ? 'text-destructive' : 'text-amber-500'}`}
              />
              <div className='flex-1 min-w-0'>
                <p className='text-sm font-medium'>{alert.itemName}</p>
                <p className='text-xs text-muted-foreground mt-0.5'>{alert.message}</p>
                <p className='text-xs text-muted-foreground mt-1'>
                  {new Date(alert.createdAt).toLocaleDateString()}
                </p>
              </div>
              <Badge
                variant='outline'
                className={`text-xs shrink-0 ${alert.severity === 'critical' ? 'border-destructive/30 text-destructive' : 'border-amber-200 text-amber-600'}`}
              >
                {t(
                  alert.type === 'low_stock'
                    ? 'lowStock'
                    : alert.type === 'expiring'
                      ? 'expiringSoon'
                      : 'outOfStock',
                )}
              </Badge>
            </div>
          </div>
        );
      })}
    </motion.div>
  );
}

// ─── Analytics Tab ──────────────────────────────────────────────────────────

function AnalyticsTab() {
  const t = useTranslations('dashboard.inventory.analytics');
  const { data: analytics, isLoading, isError, refetch } = useInventoryAnalytics();

  if (isLoading) return <AnalyticsSkeleton />;
  if (isError) {
    return <ErrorState message={t('title')} onRetry={() => void refetch()} />;
  }
  if (!analytics) return null;

  const metrics = [
    { label: t('totalItems'), value: analytics.totalItems, icon: Package },
    {
      label: t('totalValue'),
      value: `${(analytics.totalValue ?? 0).toFixed(2)} TND`,
      icon: BarChart3,
    },
    { label: t('expiringThisWeek'), value: analytics.expiringItems, icon: Clock },
    {
      label: t('wasteRate'),
      value: `${(analytics.wastePercentage ?? 0).toFixed(1)}%`,
      icon: TrendingDown,
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className='grid grid-cols-2 lg:grid-cols-4 gap-3'>
        {metrics.map((metric, i) => {
          const Icon = metric.icon;
          return (
            <motion.div
              key={metric.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.08, duration: 0.3 }}
              className='glass rounded-xl p-4 shadow-soft relative overflow-hidden'
            >
              <div className='absolute -top-4 -end-4 w-16 h-16 rounded-full bg-brand-coral/10 blur-2xl' />
              <div className='relative'>
                <div className='h-8 w-8 rounded-lg bg-primary-500/[0.08] flex items-center justify-center mb-2'>
                  <Icon className='size-4 text-primary-500' />
                </div>
                <p className='text-[11px] text-muted-foreground'>{metric.label}</p>
                <p className='font-display text-lg text-primary-500 font-bold mt-0.5'>
                  {metric.value}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Status breakdown */}
      <div className='glass rounded-2xl p-[24px] shadow-soft mt-6'>
        <h3 className='font-semibold text-sm mb-4'>{t('stockHistory')}</h3>
        <div className='grid grid-cols-2 sm:grid-cols-4 gap-4'>
          {[
            { label: 'Available', value: analytics.activeItems, color: 'text-emerald-600' },
            { label: 'Low Stock', value: analytics.lowStockItems, color: 'text-amber-600' },
            { label: 'Out of Stock', value: analytics.outOfStockItems, color: 'text-destructive' },
            { label: 'Expiring', value: analytics.expiringItems, color: 'text-amber-500' },
          ].map(item => (
            <div key={item.label} className='text-center'>
              <p className={`font-display text-2xl font-bold ${item.color}`}>{item.value}</p>
              <p className='text-xs text-muted-foreground mt-1'>{item.label}</p>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Main Inventory Page ────────────────────────────────────────────────────

export function InventoryPage() {
  const t = useTranslations('dashboard.inventory');

  return (
    <div className='space-y-6'>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className='font-display text-3xl md:text-4xl text-primary-500 font-bold'>
          {t('title')}
        </h1>
        <p className='text-sm text-muted-foreground mt-1'>{t('subtitle')}</p>
      </motion.div>

      {/* Tabs */}
      <Tabs defaultValue='items' className='w-full'>
        <TabsList className='glass shadow-soft mb-4 h-9'>
          <TabsTrigger value='items' className='gap-1.5 text-xs px-3 h-7'>
            <Package className='size-3.5' />
            {t('tabs.items')}
          </TabsTrigger>
          <TabsTrigger value='alerts' className='gap-1.5 text-xs px-3 h-7'>
            <AlertTriangle className='size-3.5' />
            {t('tabs.alerts')}
          </TabsTrigger>
          <TabsTrigger value='analytics' className='gap-1.5 text-xs px-3 h-7'>
            <BarChart3 className='size-3.5' />
            {t('tabs.analytics')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value='items'>
          <ItemsTab />
        </TabsContent>
        <TabsContent value='alerts'>
          <AlertsTab />
        </TabsContent>
        <TabsContent value='analytics'>
          <AnalyticsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
