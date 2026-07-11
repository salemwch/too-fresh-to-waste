'use client';

import { useState, useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  Bell,
  ShoppingBag,
  Tag,
  Shield,
  Trophy,
  Megaphone,
  Clock,
  CheckCheck,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  useNotifications,
  useUnreadCount,
  useMarkAsRead,
  useMarkAllAsRead,
  useNotificationPreferences,
  useUpdateNotificationPreferences,
} from '@/hooks/use-notifications';
import type {
  NotificationItem,
  NotificationChannel,
  UpdateNotificationPreferencesPayload,
} from '@/types/notifications';

// ─── Time ago utility ───────────────────────────────────────────────────────

function timeAgo(dateStr: string, t: ReturnType<typeof useTranslations>): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const minutes = Math.floor(diffMs / 60_000);
  const hours = Math.floor(diffMs / 3_600_000);
  const days = Math.floor(diffMs / 86_400_000);

  if (minutes < 1) return t('timeAgo.justNow');
  if (minutes < 60) return t('timeAgo.minutesAgo', { count: minutes });
  if (hours < 24) return t('timeAgo.hoursAgo', { count: hours });
  return t('timeAgo.daysAgo', { count: days });
}

// ─── Channel icon mapping ───────────────────────────────────────────────────

function getChannelIcon(channel: NotificationChannel) {
  switch (channel) {
    case 'order_updates':
      return ShoppingBag;
    case 'offers':
      return Tag;
    case 'marketing':
      return Megaphone;
    case 'pickup_reminders':
      return Clock;
    case 'security':
      return Shield;
    case 'leaderboard':
      return Trophy;
    default:
      return Bell;
  }
}

// ─── Channel filter tabs ────────────────────────────────────────────────────

type ChannelFilter = 'all' | 'order_updates' | 'offers' | 'security' | 'leaderboard';

const CHANNEL_FILTERS: ChannelFilter[] = [
  'all',
  'order_updates',
  'offers',
  'security',
  'leaderboard',
];

function ChannelFilterTabs({
  active,
  onChange,
  unreadOnly,
  onUnreadToggle,
  t,
}: {
  active: ChannelFilter;
  onChange: (c: ChannelFilter) => void;
  unreadOnly: boolean;
  onUnreadToggle: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const labels: Record<ChannelFilter, string> = {
    all: t('filters.all'),
    order_updates: t('filters.orders'),
    offers: t('filters.offers'),
    security: t('filters.system'),
    leaderboard: t('filters.reviews'),
  };

  return (
    <div className='flex items-center gap-2 flex-wrap'>
      {CHANNEL_FILTERS.map(c => (
        <button
          key={c}
          onClick={() => onChange(c)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
            active === c
              ? 'bg-primary-500 text-white'
              : 'text-primary-500/60 hover:text-primary-500'
          }`}
        >
          {labels[c]}
        </button>
      ))}
      <div className='h-4 w-px bg-primary-500/20 mx-1' />
      <button
        onClick={onUnreadToggle}
        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
          unreadOnly ? 'bg-brand-coral text-white' : 'text-primary-500/60 hover:text-primary-500'
        }`}
      >
        {t('filters.unreadOnly')}
      </button>
    </div>
  );
}

// ─── Notification Item ──────────────────────────────────────────────────────

function NotificationRow({
  item,
  onMarkRead,
  t,
}: {
  item: NotificationItem;
  onMarkRead: (id: string) => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const Icon = getChannelIcon(item.channel);

  return (
    <motion.button
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      onClick={() => {
        if (!item.isRead) onMarkRead(item.id);
      }}
      className={`w-full flex items-start gap-3 p-[16px] rounded-xl text-start transition-colors ${
        item.isRead
          ? 'hover:bg-primary-500/[0.02]'
          : 'bg-primary-500/[0.04] hover:bg-primary-500/[0.06]'
      }`}
    >
      {/* Unread indicator */}
      <div className='relative shrink-0 mt-0.5'>
        <div
          className={`h-10 w-10 rounded-xl grid place-items-center ${
            item.isRead ? 'bg-primary-500/[0.06]' : 'bg-primary-500/[0.12]'
          }`}
        >
          <Icon size={18} className='text-primary-500' />
        </div>
        {!item.isRead && (
          <span className='absolute -top-0.5 -end-0.5 h-2.5 w-2.5 rounded-full bg-brand-coral ring-2 ring-white' />
        )}
      </div>

      <div className='flex-1 min-w-0'>
        <div className='flex items-start justify-between gap-2'>
          <p
            className={`text-sm leading-snug ${
              item.isRead ? 'text-primary-500/70' : 'text-primary-500 font-medium'
            }`}
          >
            {item.title}
          </p>
          <span className='text-[10px] text-primary-500/40 whitespace-nowrap shrink-0'>
            {timeAgo(item.createdAt, t)}
          </span>
        </div>
        <p className='text-xs text-primary-500/50 mt-0.5 line-clamp-2'>{item.body}</p>
      </div>
    </motion.button>
  );
}

// ─── Notification List ──────────────────────────────────────────────────────

function NotificationList({ t }: { t: ReturnType<typeof useTranslations> }) {
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>('all');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [offset, setOffset] = useState(0);
  const limit = 20;

  const channel = channelFilter === 'all' ? undefined : channelFilter;
  const notificationsQuery = useNotifications(offset, limit, channel, unreadOnly || undefined);
  const unreadCountQuery = useUnreadCount();
  const markAsReadMutation = useMarkAsRead();
  const markAllAsReadMutation = useMarkAllAsRead();

  const handleMarkRead = useCallback(
    (id: string) => {
      markAsReadMutation.mutate(id);
    },
    [markAsReadMutation],
  );

  const handleMarkAllRead = useCallback(() => {
    markAllAsReadMutation.mutate(undefined, {
      onSuccess: () => toast.success(t('markAllRead')),
    });
  }, [markAllAsReadMutation, t]);

  const notifications = notificationsQuery.data?.notifications ?? [];
  const hasMore = notificationsQuery.data?.hasMore ?? false;
  const unreadCount = unreadCountQuery.data ?? 0;

  return (
    <div className='flex flex-col gap-[16px]'>
      {/* Filter bar + mark all */}
      <div className='flex items-center justify-between gap-3 flex-wrap'>
        <ChannelFilterTabs
          active={channelFilter}
          onChange={c => {
            setChannelFilter(c);
            setOffset(0);
          }}
          unreadOnly={unreadOnly}
          onUnreadToggle={() => {
            setUnreadOnly(v => !v);
            setOffset(0);
          }}
          t={t}
        />

        {unreadCount > 0 && (
          <Button
            variant='ghost'
            size='sm'
            onClick={handleMarkAllRead}
            disabled={markAllAsReadMutation.isPending}
            className='text-xs text-primary-500/60 hover:text-primary-500'
          >
            <CheckCheck size={14} className='me-1.5' />
            {t('markAllRead')}
          </Button>
        )}
      </div>

      {/* List */}
      {notificationsQuery.isLoading ? (
        <NotificationListSkeleton />
      ) : notificationsQuery.isError ? (
        <ErrorState message={t('error')} />
      ) : notifications.length === 0 ? (
        <EmptyState t={t} />
      ) : (
        <div className='glass rounded-2xl shadow-soft overflow-hidden divide-y divide-primary-500/[0.06]'>
          <AnimatePresence mode='popLayout'>
            {notifications.map(item => (
              <NotificationRow key={item.id} item={item} onMarkRead={handleMarkRead} t={t} />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Load more */}
      {hasMore && (
        <div className='flex justify-center'>
          <Button
            variant='ghost'
            size='sm'
            onClick={() => setOffset(prev => prev + limit)}
            className='text-xs text-primary-500/60'
          >
            {t('loadMore')}
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Inline Toggle ──────────────────────────────────────────────────────────

function Toggle({
  checked,
  onCheckedChange,
  disabled,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      role='switch'
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? 'bg-primary-500' : 'bg-primary-500/20'
      }`}
    >
      <span
        className={`pointer-events-none block h-4 w-4 rounded-full bg-white shadow-lg transition-transform ${
          checked ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

// ─── Preferences Panel ──────────────────────────────────────────────────────

const PREF_CHANNELS: NotificationChannel[] = [
  'order_updates',
  'marketing',
  'pickup_reminders',
  'security',
  'offers',
  'leaderboard',
];

function PreferencesPanel({ t }: { t: ReturnType<typeof useTranslations> }) {
  const prefsQuery = useNotificationPreferences();
  const updateMutation = useUpdateNotificationPreferences();

  const [localPrefs, setLocalPrefs] = useState<UpdateNotificationPreferencesPayload | null>(null);

  const prefs = useMemo(() => {
    if (localPrefs) return localPrefs;
    if (!prefsQuery.data) return null;
    return {
      globalPushEnabled: prefsQuery.data.globalPushEnabled,
      globalEmailEnabled: prefsQuery.data.globalEmailEnabled,
      globalSmsEnabled: prefsQuery.data.globalSmsEnabled,
      channels: prefsQuery.data.channels,
      quietHours: prefsQuery.data.quietHours,
    } as UpdateNotificationPreferencesPayload;
  }, [localPrefs, prefsQuery.data]);

  const handleGlobalToggle = useCallback(
    (key: 'globalPushEnabled' | 'globalEmailEnabled' | 'globalSmsEnabled', value: boolean) => {
      setLocalPrefs(prev => {
        const base = prev ?? {
          globalPushEnabled: prefsQuery.data?.globalPushEnabled ?? true,
          globalEmailEnabled: prefsQuery.data?.globalEmailEnabled ?? true,
          globalSmsEnabled: prefsQuery.data?.globalSmsEnabled ?? true,
          channels: prefsQuery.data?.channels ?? {},
        };
        return { ...base, [key]: value };
      });
    },
    [prefsQuery.data],
  );

  const handleChannelToggle = useCallback(
    (channel: string, type: 'push' | 'email' | 'sms', value: boolean) => {
      setLocalPrefs(prev => {
        const base = prev ?? {
          globalPushEnabled: prefsQuery.data?.globalPushEnabled ?? true,
          globalEmailEnabled: prefsQuery.data?.globalEmailEnabled ?? true,
          globalSmsEnabled: prefsQuery.data?.globalSmsEnabled ?? true,
          channels: prefsQuery.data?.channels ?? {},
        };
        const channels = { ...(base.channels ?? {}) };
        channels[channel] = {
          push: channels[channel]?.push ?? true,
          email: channels[channel]?.email ?? true,
          sms: channels[channel]?.sms ?? true,
          [type]: value,
        };
        return { ...base, channels };
      });
    },
    [prefsQuery.data],
  );

  const handleSave = useCallback(async () => {
    if (!localPrefs) return;
    try {
      await updateMutation.mutateAsync(localPrefs);
      toast.success(t('preferences.saved'));
      setLocalPrefs(null);
    } catch {
      toast.error(t('preferences.error'));
    }
  }, [localPrefs, updateMutation, t]);

  if (prefsQuery.isLoading) {
    return (
      <div className='glass rounded-2xl p-[24px] shadow-soft h-[400px] animate-pulse bg-white/30' />
    );
  }

  if (prefsQuery.isError) {
    return <ErrorState message={t('preferences.error')} />;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.5 }}
      className='glass rounded-2xl p-[24px] shadow-soft'
    >
      <div className='mb-[24px]'>
        <div className='text-xs uppercase tracking-wider text-primary-500/60 mb-1'>
          {t('preferences.subtitle')}
        </div>
        <h3 className='font-display text-2xl text-primary-500'>{t('preferences.title')}</h3>
      </div>

      {/* Global toggles */}
      <div className='space-y-4 mb-[24px]'>
        {(['globalPushEnabled', 'globalEmailEnabled', 'globalSmsEnabled'] as const).map(key => {
          const label = t(
            `preferences.globalToggles.${key === 'globalPushEnabled' ? 'push' : key === 'globalEmailEnabled' ? 'email' : 'sms'}`,
          );
          return (
            <div key={key} className='flex items-center justify-between'>
              <span className='text-sm font-medium text-primary-500'>{label}</span>
              <Toggle
                checked={prefs?.[key] ?? true}
                onCheckedChange={v => handleGlobalToggle(key, v)}
              />
            </div>
          );
        })}
      </div>

      {/* Per-channel table */}
      <div className='border border-primary-500/[0.08] rounded-xl overflow-hidden'>
        <div className='grid grid-cols-4 gap-0 bg-primary-500/[0.04] px-[16px] py-2'>
          <span className='text-xs font-semibold text-primary-500/60 col-span-1'>Channel</span>
          <span className='text-xs font-semibold text-primary-500/60 text-center'>Push</span>
          <span className='text-xs font-semibold text-primary-500/60 text-center'>Email</span>
          <span className='text-xs font-semibold text-primary-500/60 text-center'>SMS</span>
        </div>
        {PREF_CHANNELS.map(channel => {
          const channelPref = prefs?.channels?.[channel] ?? { push: true, email: true, sms: true };
          return (
            <div
              key={channel}
              className='grid grid-cols-4 gap-0 px-[16px] py-3 border-t border-primary-500/[0.06]'
            >
              <span className='text-sm text-primary-500'>
                {t(`preferences.channels.${channel}`)}
              </span>
              {(['push', 'email', 'sms'] as const).map(type => (
                <div key={type} className='flex justify-center'>
                  <Toggle
                    checked={channelPref[type]}
                    onCheckedChange={v => handleChannelToggle(channel, type, v)}
                  />
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* Save button */}
      {localPrefs && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className='mt-[24px] flex justify-end'
        >
          <Button
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className='bg-primary-500 hover:bg-primary-600 text-white'
          >
            {updateMutation.isPending ? (
              <>
                <Loader2 size={14} className='me-1.5 animate-spin' />
                {t('preferences.saving')}
              </>
            ) : (
              t('preferences.save')
            )}
          </Button>
        </motion.div>
      )}
    </motion.div>
  );
}

// ─── Error State ────────────────────────────────────────────────────────────

function ErrorState({ message }: { message: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className='flex items-center gap-3 rounded-xl bg-brand-coral/10 border border-brand-coral/20 p-[16px]'
    >
      <AlertCircle size={18} className='text-brand-coral shrink-0' />
      <p className='text-sm text-brand-coral'>{message}</p>
    </motion.div>
  );
}

// ─── Empty State ────────────────────────────────────────────────────────────

function EmptyState({ t }: { t: ReturnType<typeof useTranslations> }) {
  return (
    <div className='flex flex-col items-center justify-center py-10 gap-3 text-center'>
      <div className='h-16 w-16 rounded-2xl bg-primary-500/[0.06] grid place-items-center'>
        <Bell size={28} className='text-primary-500/30' />
      </div>
      <h3 className='font-display text-lg text-primary-500'>{t('empty.title')}</h3>
      <p className='text-sm text-primary-500/60 max-w-xs'>{t('empty.description')}</p>
    </div>
  );
}

// ─── List Skeleton ──────────────────────────────────────────────────────────

function NotificationListSkeleton() {
  return (
    <div className='glass rounded-2xl shadow-soft overflow-hidden'>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className='p-[16px] animate-pulse'>
          <div className='flex items-start gap-3'>
            <div className='h-10 w-10 rounded-xl bg-white/30' />
            <div className='flex-1'>
              <div className='h-4 w-3/4 rounded bg-white/30 mb-2' />
              <div className='h-3 w-1/2 rounded bg-white/30' />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export function NotificationsPage() {
  const t = useTranslations('dashboard.notifications');
  const unreadCountQuery = useUnreadCount();
  const unreadCount = unreadCountQuery.data ?? 0;

  return (
    <div className='flex flex-col gap-[24px] p-[24px]'>
      {/* Header */}
      <div className='flex flex-col sm:flex-row sm:items-start justify-between gap-[16px]'>
        <div>
          <div className='text-xs uppercase tracking-[0.18em] text-primary-500/60 mb-2'>
            {t('subtitle')}
          </div>
          <div className='flex items-center gap-3'>
            <h1 className='font-display text-3xl md:text-4xl text-primary-500'>{t('title')}</h1>
            {unreadCount > 0 && (
              <span className='inline-flex items-center justify-center h-6 min-w-6 px-2 rounded-full bg-brand-coral text-white text-xs font-bold'>
                {unreadCount}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue='inbox'>
        <TabsList className='mb-[16px]'>
          <TabsTrigger value='inbox'>{t('tabs.inbox')}</TabsTrigger>
          <TabsTrigger value='preferences'>{t('tabs.preferences')}</TabsTrigger>
        </TabsList>

        <TabsContent value='inbox' className='mt-0'>
          <NotificationList t={t} />
        </TabsContent>

        <TabsContent value='preferences' className='mt-0'>
          <PreferencesPanel t={t} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
