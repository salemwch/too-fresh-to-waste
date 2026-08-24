'use client';

import { useState, useRef, useEffect } from 'react';
import { Bell, ShoppingBag, CheckCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { cn } from '@foodwaste/ui';
import { useNotificationStore, type NewOrderNotification } from '@/lib/notification-store';

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const { notifications, unreadCount, markRead, markAllRead } = useNotificationStore();
  const router = useRouter();
  const locale = useLocale();

  // Close dropdown when clicking outside
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  function handleNotificationClick(n: NewOrderNotification) {
    markRead(n.id);
    setOpen(false);
    router.push(`/${locale}/merchant/orders`);
  }

  return (
    <div ref={panelRef} className='relative'>
      {/* Bell button */}
      <button
        onClick={() => setOpen(prev => !prev)}
        className='relative w-7 h-7 rounded-full bg-slate-50 flex items-center justify-center hover:bg-slate-100 transition-colors'
        aria-label='Notifications'
        aria-expanded={open}
      >
        <Bell className='w-3.5 h-3.5 text-slate-600' />
        {unreadCount > 0 && (
          <span className='absolute -top-xxs -right-xxs min-w-[14px] h-3.5 rounded-full bg-red-500 text-white text-[8px] font-bold flex items-center justify-center px-[2px] leading-none pointer-events-none'>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className='absolute right-0 top-full mt-sm w-80 rounded-xl bg-white border border-slate-200 shadow-xl z-50 overflow-hidden'>
          {/* Panel header */}
          <div className='flex items-center justify-between px-md py-2.5 border-b border-slate-100'>
            <div className='flex items-center gap-sm'>
              <span className='text-xs font-semibold text-slate-900'>Notifications</span>
              {unreadCount > 0 && (
                <span className='rounded-full bg-red-100 text-red-600 text-[9px] font-bold px-1.5 py-xxs leading-tight'>
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className='flex items-center gap-xxs text-[11px] text-primary-600 hover:text-primary-700 font-medium transition-colors'
              >
                <CheckCheck className='w-3 h-3' />
                Mark all read
              </button>
            )}
          </div>

          {/* Notification list */}
          <div className='max-h-72 overflow-y-auto divide-y divide-slate-50'>
            {notifications.length === 0 ? (
              <div className='flex flex-col items-center justify-center py-4xl text-center px-lg'>
                <Bell className='w-7 h-7 text-slate-300 mb-sm' />
                <p className='text-xs text-slate-500'>No notifications yet</p>
              </div>
            ) : (
              notifications.map(n => (
                <button
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={cn(
                    'w-full text-left flex items-start gap-md px-md py-2.5 transition-colors hover:bg-slate-50',
                    !n.read && 'bg-primary-50',
                  )}
                >
                  <div
                    className={cn(
                      'mt-xxs w-7 h-7 rounded-lg flex items-center justify-center shrink-0',
                      n.read ? 'bg-slate-100' : 'bg-primary-100',
                    )}
                  >
                    <ShoppingBag
                      className={cn('w-3.5 h-3.5', n.read ? 'text-slate-400' : 'text-primary-600')}
                    />
                  </div>
                  <div className='flex-1 min-w-0'>
                    <div className='flex items-center justify-between gap-sm'>
                      <p className='text-xs font-semibold text-slate-900 truncate'>
                        New Order #{n.orderNumber}
                      </p>
                      {!n.read && <span className='w-1.5 h-1.5 rounded-full bg-red-500 shrink-0' />}
                    </div>
                    <p className='text-[11px] text-slate-500 mt-xxs'>
                      {n.customerName} &middot; &euro;{n.total.toFixed(2)}
                    </p>
                    <p className='text-[10px] text-slate-400 mt-xxs'>
                      {formatRelativeTime(n.createdAt)}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* View all link */}
          <div className='border-t border-slate-100'>
            <button
              onClick={() => {
                setOpen(false);
                router.push(`/${locale}/merchant/notifications`);
              }}
              className='w-full text-center py-2.5 text-[11px] font-semibold text-primary-600 hover:text-primary-700 hover:bg-slate-50 transition-colors'
            >
              View All Notifications
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
