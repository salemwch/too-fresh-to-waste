'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Bell,
  Send,
  Clock,
  CheckCircle2,
  Users,
  Store,
  Plus,
  Eye,
  Target,
  Megaphone,
  Copy,
  Pencil,
} from 'lucide-react';
import {
  Card,
  CardContent,
  Button,
  Input,
  Label,
  Sheet,
  SheetContent,
  SheetTitle,
  Separator,
} from '@foodwaste/ui';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AdminModuleHeader } from '@/components/dashboard/admin/admin-module-header';
import { AdminTabNav, type AdminTab } from '@/components/dashboard/admin/admin-tab-nav';
import { AdminKpiRow, type KpiItem } from '@/components/dashboard/admin/admin-kpi-row';
import { AdminDataTable, type ColumnDef } from '@/components/dashboard/admin/admin-data-table';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Campaign {
  id: string;
  title: string;
  message: string;
  targetSegment: 'all' | 'consumers' | 'merchants' | 'custom';
  channel: 'push' | 'in_app' | 'both';
  status: 'draft' | 'scheduled' | 'sent' | 'completed';
  scheduledAt?: string;
  sentAt?: string;
  recipientCount: number;
  deliveryRate?: number;
  openRate?: number;
}

interface NotificationTemplate {
  id: string;
  name: string;
  description: string;
  category: 'welcome' | 'order' | 'promotion' | 'system';
  lastUsed?: string;
}

// ─── Mock data ───────────────────────────────────────────────────────────────

const MOCK_CAMPAIGNS: Campaign[] = [
  {
    id: '1',
    title: 'Summer Savings Week',
    message: 'Save up to 60% on fresh food this week!',
    targetSegment: 'consumers',
    channel: 'both',
    status: 'completed',
    sentAt: '2026-07-15T10:00:00Z',
    recipientCount: 1240,
    deliveryRate: 94,
    openRate: 38,
  },
  {
    id: '2',
    title: 'New Merchant Welcome',
    message: 'Welcome to TFTW! Set up your first offer today.',
    targetSegment: 'merchants',
    channel: 'push',
    status: 'sent',
    sentAt: '2026-07-17T09:00:00Z',
    recipientCount: 12,
    deliveryRate: 100,
    openRate: 75,
  },
  {
    id: '3',
    title: 'Weekend Flash Sale',
    message: 'Flash sale this weekend — extra points on every order!',
    targetSegment: 'all',
    channel: 'both',
    status: 'scheduled',
    scheduledAt: '2026-07-20T08:00:00Z',
    recipientCount: 2800,
  },
  {
    id: '4',
    title: 'Ramadan Special',
    message: 'Special offers for Ramadan — save food, earn rewards.',
    targetSegment: 'consumers',
    channel: 'push',
    status: 'draft',
    recipientCount: 0,
  },
];

const MOCK_TEMPLATES: NotificationTemplate[] = [
  {
    id: 't1',
    name: 'Welcome Message',
    description: 'Sent to new users after registration',
    category: 'welcome',
    lastUsed: '2026-07-17T00:00:00Z',
  },
  {
    id: 't2',
    name: 'Order Ready',
    description: 'Notifies customer their order is ready for pickup',
    category: 'order',
    lastUsed: '2026-07-18T00:00:00Z',
  },
  {
    id: 't3',
    name: 'Weekly Promotion',
    description: 'Template for weekly promotional push notifications',
    category: 'promotion',
    lastUsed: '2026-07-15T00:00:00Z',
  },
  {
    id: 't4',
    name: 'System Maintenance',
    description: 'Scheduled maintenance notification',
    category: 'system',
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getCampaignStatusStyle(status: Campaign['status']) {
  const map = {
    draft: 'bg-gray-100 text-gray-600 border-gray-200',
    scheduled: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    sent: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    completed: 'bg-sky-50 text-sky-700 border-sky-200',
  };
  return map[status];
}

function getSegmentIcon(segment: Campaign['targetSegment']) {
  switch (segment) {
    case 'consumers':
      return Users;
    case 'merchants':
      return Store;
    case 'custom':
      return Target;
    default:
      return Megaphone;
  }
}

function getChannelLabel(channel: Campaign['channel']) {
  const map = { push: 'Push', in_app: 'In-App', both: 'Push + In-App' };
  return map[channel];
}

// ─── Campaign Builder Drawer ─────────────────────────────────────────────────

function CampaignBuilderDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations('adminNotifications');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [segment, setSegment] = useState('all');
  const [channel, setChannel] = useState('both');

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent className='w-full overflow-y-auto sm:max-w-xl'>
        <SheetTitle className='sr-only'>Create Campaign</SheetTitle>
        <div className='space-y-0'>
          <div className='-mx-6 -mt-6 mb-0 border-b border-border/60 bg-muted/20 px-6 pb-5 pt-5 pe-14'>
            <h2 className='text-base font-semibold'>{t('builder.title')}</h2>
            <p className='mt-0.5 text-xs text-muted-foreground'>{t('builder.subtitle')}</p>
          </div>

          <div className='space-y-5 py-5'>
            <div className='space-y-1.5'>
              <Label className='text-xs font-medium'>{t('builder.campaignTitle')}</Label>
              <Input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder={t('builder.titlePlaceholder')}
                className='h-8 text-xs'
              />
            </div>

            <div className='space-y-1.5'>
              <Label className='text-xs font-medium'>{t('builder.message')}</Label>
              <Textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder={t('builder.messagePlaceholder')}
                rows={3}
                className='text-xs resize-none'
              />
              <p className='text-[10px] text-muted-foreground'>{message.length}/200</p>
            </div>

            <Separator />

            <div className='grid grid-cols-2 gap-3'>
              <div className='space-y-1.5'>
                <Label className='text-xs font-medium'>{t('builder.targetSegment')}</Label>
                <Select value={segment} onValueChange={setSegment}>
                  <SelectTrigger className='h-8 text-xs'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='all'>{t('segments.all')}</SelectItem>
                    <SelectItem value='consumers'>{t('segments.consumers')}</SelectItem>
                    <SelectItem value='merchants'>{t('segments.merchants')}</SelectItem>
                    <SelectItem value='custom'>{t('segments.custom')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className='space-y-1.5'>
                <Label className='text-xs font-medium'>{t('builder.channel')}</Label>
                <Select value={channel} onValueChange={setChannel}>
                  <SelectTrigger className='h-8 text-xs'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='push'>Push</SelectItem>
                    <SelectItem value='in_app'>In-App</SelectItem>
                    <SelectItem value='both'>Push + In-App</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            {/* Preview */}
            <div className='space-y-2'>
              <h3 className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
                {t('builder.preview')}
              </h3>
              <div className='rounded-lg border border-border/60 bg-muted/20 p-4'>
                <div className='flex items-start gap-3'>
                  <div className='rounded-lg bg-primary/10 p-2 shrink-0'>
                    <Bell className='size-4 text-primary' />
                  </div>
                  <div className='min-w-0'>
                    <p className='text-sm font-semibold'>{title || t('builder.previewTitle')}</p>
                    <p className='text-xs text-muted-foreground mt-0.5'>
                      {message || t('builder.previewMessage')}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className='flex gap-2 pt-2'>
              <Button size='sm' className='flex-1 h-8 text-xs'>
                <Send className='me-1.5 size-3.5' />
                {t('builder.sendNow')}
              </Button>
              <Button size='sm' variant='outline' className='flex-1 h-8 text-xs'>
                <Clock className='me-1.5 size-3.5' />
                {t('builder.schedule')}
              </Button>
              <Button size='sm' variant='ghost' className='h-8 text-xs' onClick={onClose}>
                {t('builder.saveDraft')}
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Content ─────────────────────────────────────────────────────────────────

function NotificationsContent() {
  const t = useTranslations('adminNotifications');
  const searchParams = useSearchParams();
  const currentTab = searchParams.get('tab') ?? 'campaigns';
  const [builderOpen, setBuilderOpen] = useState(false);

  const tabs: AdminTab[] = [
    { key: 'campaigns', label: t('tabs.campaigns') },
    { key: 'history', label: t('tabs.history') },
    { key: 'templates', label: t('tabs.templates') },
  ];

  const kpis: KpiItem[] = [
    {
      label: t('kpi.totalSent'),
      value: '3,240',
      icon: Send,
      iconBg: 'bg-indigo-50',
      iconColor: 'text-indigo-600',
    },
    {
      label: t('kpi.deliveryRate'),
      value: '96%',
      icon: CheckCircle2,
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
    },
    {
      label: t('kpi.openRate'),
      value: '42%',
      icon: Eye,
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-600',
    },
    {
      label: t('kpi.activeCampaigns'),
      value: '2',
      icon: Megaphone,
      iconBg: 'bg-violet-50',
      iconColor: 'text-violet-600',
    },
  ];

  const campaignColumns: ColumnDef<Campaign>[] = [
    {
      key: 'title',
      header: t('columns.campaign'),
      render: c => (
        <div>
          <p className='text-xs font-semibold'>{c.title}</p>
          <p className='text-[10px] text-muted-foreground truncate max-w-[200px]'>{c.message}</p>
        </div>
      ),
    },
    {
      key: 'segment',
      header: t('columns.target'),
      render: c => {
        const Icon = getSegmentIcon(c.targetSegment);
        return (
          <div className='flex items-center gap-1.5'>
            <Icon className='size-3.5 text-muted-foreground' />
            <span className='text-xs capitalize'>{c.targetSegment}</span>
          </div>
        );
      },
    },
    {
      key: 'channel',
      header: t('columns.channel'),
      render: c => <span className='text-xs'>{getChannelLabel(c.channel)}</span>,
    },
    {
      key: 'status',
      header: t('columns.status'),
      render: c => (
        <span
          className={cn(
            'inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize',
            getCampaignStatusStyle(c.status),
          )}
        >
          {c.status}
        </span>
      ),
    },
    {
      key: 'recipients',
      header: t('columns.recipients'),
      render: c => (
        <span className='text-xs tabular-nums'>{c.recipientCount.toLocaleString()}</span>
      ),
    },
    {
      key: 'performance',
      header: t('columns.performance'),
      render: c =>
        c.deliveryRate ? (
          <div className='text-[10px] text-muted-foreground'>
            <span className='font-medium text-foreground'>{c.deliveryRate}%</span> delivered ·{' '}
            <span className='font-medium text-foreground'>{c.openRate}%</span> opened
          </div>
        ) : (
          <span className='text-[10px] text-muted-foreground'>—</span>
        ),
    },
  ];

  const templateCategoryStyles: Record<string, string> = {
    welcome: 'bg-emerald-50 text-emerald-700',
    order: 'bg-sky-50 text-sky-700',
    promotion: 'bg-amber-50 text-amber-700',
    system: 'bg-gray-100 text-gray-600',
  };

  return (
    <div className='space-y-5'>
      <AdminModuleHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <Button size='sm' className='h-8 text-xs' onClick={() => setBuilderOpen(true)}>
            <Plus className='me-1.5 size-3.5' />
            {t('createCampaign')}
          </Button>
        }
      />

      <AdminKpiRow items={kpis} />

      <Card className='border-border/60'>
        <CardContent className='p-0'>
          <AdminTabNav tabs={tabs} />
          <div className='p-4'>
            {currentTab === 'campaigns' && (
              <AdminDataTable
                columns={campaignColumns}
                data={MOCK_CAMPAIGNS}
                isLoading={false}
                page={1}
                totalPages={1}
                total={MOCK_CAMPAIGNS.length}
                onPageChange={() => {}}
                searchPlaceholder={t('searchCampaigns')}
                onSearchChange={() => {}}
                emptyIcon={Bell}
                emptyTitle={t('empty.title')}
                emptyDescription={t('empty.description')}
              />
            )}

            {currentTab === 'history' && (
              <AdminDataTable
                columns={campaignColumns.filter(c => c.key !== 'channel')}
                data={MOCK_CAMPAIGNS.filter(c => c.status === 'completed' || c.status === 'sent')}
                isLoading={false}
                page={1}
                totalPages={1}
                total={
                  MOCK_CAMPAIGNS.filter(c => c.status === 'completed' || c.status === 'sent').length
                }
                onPageChange={() => {}}
                searchPlaceholder={t('searchHistory')}
                onSearchChange={() => {}}
                emptyIcon={Clock}
                emptyTitle={t('emptyHistory.title')}
                emptyDescription={t('emptyHistory.description')}
              />
            )}

            {currentTab === 'templates' && (
              <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
                {MOCK_TEMPLATES.map(tmpl => (
                  <Card key={tmpl.id} className='border-border/60'>
                    <CardContent className='p-4'>
                      <div className='flex items-start justify-between'>
                        <div>
                          <div className='flex items-center gap-2'>
                            <p className='text-sm font-semibold'>{tmpl.name}</p>
                            <span
                              className={cn(
                                'rounded-full px-2 py-0.5 text-[10px] font-medium capitalize',
                                templateCategoryStyles[tmpl.category],
                              )}
                            >
                              {tmpl.category}
                            </span>
                          </div>
                          <p className='text-xs text-muted-foreground mt-0.5'>{tmpl.description}</p>
                          {tmpl.lastUsed && (
                            <p className='text-[10px] text-muted-foreground mt-2'>
                              Last used: {new Date(tmpl.lastUsed).toLocaleDateString('en-GB')}
                            </p>
                          )}
                        </div>
                        <div className='flex gap-1'>
                          <Button variant='ghost' size='sm' className='h-7 w-7 p-0'>
                            <Pencil className='size-3.5' />
                          </Button>
                          <Button
                            variant='ghost'
                            size='sm'
                            className='h-7 w-7 p-0 text-muted-foreground'
                          >
                            <Copy className='size-3.5' />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <CampaignBuilderDrawer open={builderOpen} onClose={() => setBuilderOpen(false)} />
    </div>
  );
}

export default function AdminNotificationsPage() {
  return (
    <Suspense
      fallback={
        <div className='space-y-5'>
          <Skeleton className='h-16 rounded-lg' />
          <div className='grid grid-cols-2 md:grid-cols-4 gap-3'>
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className='h-24 rounded-lg' />
            ))}
          </div>
          <Skeleton className='h-96 rounded-lg' />
        </div>
      }
    >
      <NotificationsContent />
    </Suspense>
  );
}
