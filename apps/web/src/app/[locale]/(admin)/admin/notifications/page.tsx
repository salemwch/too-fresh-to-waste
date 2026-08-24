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
  Target,
  Megaphone,
  AlertCircle,
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
import { Skeleton } from '@/components/ui/skeleton';
import { useAdminNotificationStats, useAdminBroadcast } from '@/hooks/use-admin';

// ─── Broadcast Builder Drawer ───────────────────────────────────────────────

function BroadcastBuilderDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations('adminNotifications');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [segment, setSegment] = useState<'all' | 'consumers' | 'merchants'>('all');
  const [channel, setChannel] = useState<'push' | 'in_app' | 'both'>('both');

  const broadcast = useAdminBroadcast();

  const handleSend = () => {
    if (!title.trim() || !message.trim()) return;
    broadcast.mutate(
      { title: title.trim(), body: message.trim(), targetSegment: segment, channel },
      {
        onSuccess: () => {
          setTitle('');
          setMessage('');
          onClose();
        },
      },
    );
  };

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent className='w-full overflow-y-auto sm:max-w-xl'>
        <SheetTitle className='sr-only'>Send Broadcast</SheetTitle>
        <div className='space-y-0'>
          <div className='-mx-2xl -mt-2xl mb-0 border-b border-border/60 bg-muted/20 px-2xl pb-xl pt-xl pe-14'>
            <h2 className='text-base font-semibold'>{t('builder.title')}</h2>
            <p className='mt-xxs text-xs text-muted-foreground'>{t('builder.subtitle')}</p>
          </div>

          <div className='space-y-xl py-xl'>
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

            <div className='grid grid-cols-2 gap-md'>
              <div className='space-y-1.5'>
                <Label className='text-xs font-medium'>{t('builder.targetSegment')}</Label>
                <Select value={segment} onValueChange={v => setSegment(v as typeof segment)}>
                  <SelectTrigger className='h-8 text-xs'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='all'>{t('segments.all')}</SelectItem>
                    <SelectItem value='consumers'>{t('segments.consumers')}</SelectItem>
                    <SelectItem value='merchants'>{t('segments.merchants')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className='space-y-1.5'>
                <Label className='text-xs font-medium'>{t('builder.channel')}</Label>
                <Select value={channel} onValueChange={v => setChannel(v as typeof channel)}>
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

            <div className='space-y-sm'>
              <h3 className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
                {t('builder.preview')}
              </h3>
              <div className='rounded-lg border border-border/60 bg-muted/20 p-lg'>
                <div className='flex items-start gap-md'>
                  <div className='rounded-lg bg-primary/10 p-sm shrink-0'>
                    <Bell className='size-4 text-primary' />
                  </div>
                  <div className='min-w-0'>
                    <p className='text-sm font-semibold'>{title || t('builder.previewTitle')}</p>
                    <p className='text-xs text-muted-foreground mt-xxs'>
                      {message || t('builder.previewMessage')}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className='flex gap-sm pt-sm'>
              <Button
                size='sm'
                className='flex-1 h-8 text-xs'
                onClick={handleSend}
                disabled={broadcast.isPending || !title.trim() || !message.trim()}
              >
                <Send className='me-1.5 size-3.5' />
                {broadcast.isPending ? t('builder.sending') : t('builder.sendNow')}
              </Button>
              <Button size='sm' variant='ghost' className='h-8 text-xs' onClick={onClose}>
                {t('builder.cancel')}
              </Button>
            </div>

            {broadcast.isError && <p className='text-xs text-destructive'>{t('builder.error')}</p>}
            {broadcast.isSuccess && (
              <p className='text-xs text-emerald-600'>{t('builder.success')}</p>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Channel Breakdown Card ─────────────────────────────────────────────────

function ChannelBreakdownCard({
  channels,
}: {
  channels: Array<{ channel: string; count: number }>;
}) {
  const t = useTranslations('adminNotifications');
  const totalCount = channels.reduce((s, c) => s + c.count, 0);

  const channelLabels: Record<string, { label: string; icon: typeof Bell }> = {
    order_updates: { label: t('channels.orderUpdates'), icon: CheckCircle2 },
    marketing: { label: t('channels.marketing'), icon: Megaphone },
    pickup_reminders: { label: t('channels.pickupReminders'), icon: Clock },
    security: { label: t('channels.security'), icon: AlertCircle },
    offers: { label: t('channels.offers'), icon: Target },
    admin: { label: t('channels.admin'), icon: Users },
    leaderboard: { label: t('channels.leaderboard'), icon: Store },
  };

  return (
    <Card className='border-border/60'>
      <CardContent className='p-xl'>
        <h3 className='text-sm font-semibold mb-lg'>{t('channelBreakdown')}</h3>
        <div className='space-y-md'>
          {channels.map(ch => {
            const pct = totalCount > 0 ? (ch.count / totalCount) * 100 : 0;
            const info = channelLabels[ch.channel] ?? { label: ch.channel, icon: Bell };
            const Icon = info.icon;
            return (
              <div key={ch.channel} className='space-y-1.5'>
                <div className='flex items-center justify-between'>
                  <div className='flex items-center gap-1.5'>
                    <Icon className='size-3 text-muted-foreground' />
                    <span className='text-xs font-medium'>{info.label}</span>
                  </div>
                  <span className='text-xs text-muted-foreground tabular-nums'>
                    {ch.count.toLocaleString()} ({pct.toFixed(0)}%)
                  </span>
                </div>
                <div className='h-1.5 w-full rounded-full bg-muted'>
                  <div
                    className='h-1.5 rounded-full bg-primary transition-all'
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
          {channels.length === 0 && (
            <p className='text-xs text-muted-foreground text-center py-lg'>{t('noChannelData')}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Content ─────────────────────────────────────────────────────────────────

function NotificationsContent() {
  const t = useTranslations('adminNotifications');
  const searchParams = useSearchParams();
  const currentTab = searchParams.get('tab') ?? 'overview';
  const [builderOpen, setBuilderOpen] = useState(false);

  const { data: stats, isLoading } = useAdminNotificationStats();

  const tabs: AdminTab[] = [
    { key: 'overview', label: t('tabs.overview') },
    { key: 'channels', label: t('tabs.channels') },
  ];

  const kpis: KpiItem[] = [
    {
      label: t('kpi.totalSent'),
      value: stats?.totalSent.toLocaleString() ?? '—',
      icon: Send,
      iconBg: 'bg-indigo-50',
      iconColor: 'text-indigo-600',
    },
    {
      label: t('kpi.deliveryRate'),
      value: stats ? `${stats.deliveryRate}%` : '—',
      icon: CheckCircle2,
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
    },
    {
      label: t('kpi.pending'),
      value: stats?.pendingCount.toLocaleString() ?? '—',
      icon: Clock,
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-600',
      highlight: (stats?.pendingCount ?? 0) > 0,
    },
    {
      label: t('kpi.failed'),
      value: stats?.failedCount.toLocaleString() ?? '—',
      icon: AlertCircle,
      iconBg: 'bg-rose-50',
      iconColor: 'text-rose-600',
      highlight: (stats?.failedCount ?? 0) > 0,
    },
  ];

  return (
    <div className='space-y-xl'>
      <AdminModuleHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <Button size='sm' className='h-8 text-xs' onClick={() => setBuilderOpen(true)}>
            <Plus className='me-1.5 size-3.5' />
            {t('sendBroadcast')}
          </Button>
        }
      />

      <AdminKpiRow items={kpis} loading={isLoading} />

      <Card className='border-border/60'>
        <CardContent className='p-0'>
          <AdminTabNav tabs={tabs} />
          <div className='p-lg'>
            {currentTab === 'overview' && (
              <div className='grid grid-cols-1 lg:grid-cols-2 gap-xl'>
                <Card className='border-border/60'>
                  <CardContent className='p-xl'>
                    <h3 className='text-sm font-semibold mb-lg'>{t('overview.summary')}</h3>
                    <div className='space-y-md'>
                      {[
                        {
                          label: t('overview.totalSent'),
                          value: stats?.totalSent.toLocaleString() ?? '—',
                        },
                        {
                          label: t('overview.delivered'),
                          value: stats?.deliveredCount.toLocaleString() ?? '—',
                        },
                        {
                          label: t('overview.failed'),
                          value: stats?.failedCount.toLocaleString() ?? '—',
                        },
                        {
                          label: t('overview.pending'),
                          value: stats?.pendingCount.toLocaleString() ?? '—',
                        },
                        {
                          label: t('overview.deliveryRate'),
                          value: stats ? `${stats.deliveryRate}%` : '—',
                        },
                      ].map(row => (
                        <div key={row.label} className='flex items-center justify-between'>
                          <span className='text-xs text-muted-foreground'>{row.label}</span>
                          <span className='text-xs font-semibold tabular-nums'>{row.value}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <ChannelBreakdownCard channels={stats?.channelBreakdown ?? []} />
              </div>
            )}

            {currentTab === 'channels' && (
              <ChannelBreakdownCard channels={stats?.channelBreakdown ?? []} />
            )}
          </div>
        </CardContent>
      </Card>

      <BroadcastBuilderDrawer open={builderOpen} onClose={() => setBuilderOpen(false)} />
    </div>
  );
}

export default function AdminNotificationsPage() {
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
      <NotificationsContent />
    </Suspense>
  );
}
