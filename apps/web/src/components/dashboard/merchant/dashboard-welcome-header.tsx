'use client';

import { useState, useRef, useEffect } from 'react';
import { Bell, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { enUS, fr, ar as arLocale } from 'date-fns/locale';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter, usePathname } from '@/i18n/routing';
import { useAuthStore } from '@/lib/auth';
import { useNotificationStore } from '@/lib/notification-store';
import { resolveProfileImage } from '@/lib/media';
import { useMerchantRank, useMonthlyGoal } from '@/hooks/use-merchant-dashboard';
import type { MyEstablishment } from '@/types/dashboard';

interface DashboardWelcomeHeaderProps {
  establishment: MyEstablishment | null | undefined;
}

const LOCALES = [
  { code: 'en', label: 'EN' },
  { code: 'fr', label: 'FR' },
  { code: 'ar', label: 'AR' },
] as const;

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function DashboardWelcomeHeader({ establishment }: DashboardWelcomeHeaderProps) {
  const user = useAuthStore(s => s.user);
  const unreadCount = useNotificationStore(s => s.unreadCount);
  const rankQuery = useMerchantRank();
  const goalQuery = useMonthlyGoal();
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const t = useTranslations('dashboard');
  const [langOpen, setLangOpen] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (langRef.current && !langRef.current.contains(e.target as Node)) {
        setLangOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function switchLocale(next: string) {
    router.replace(pathname, { locale: next });
    setLangOpen(false);
  }

  const city = establishment?.address?.city;
  const dateFnsLocale = locale === 'fr' ? fr : locale === 'ar' ? arLocale : enUS;
  const dateFormat = locale === 'en' ? 'EEEE, MMMM d' : 'EEEE d MMMM';
  const dateLabel =
    capitalize(format(new Date(), dateFormat, { locale: dateFnsLocale })) +
    (city ? ` · ${city}` : '');

  const rank = rankQuery.data?.rank ?? 0;

  const treesEquivalent = goalQuery.data?.treesEquivalent ?? 1;
  const currentMonthBags = goalQuery.data?.currentMonthBags ?? 0;
  const targetBags = goalQuery.data?.targetBagsPerMonth ?? 300;
  const goalProgress = goalQuery.data?.progressPercentage ?? 0;

  const avatar = user
    ? resolveProfileImage(user.profileImage ?? undefined, user.avatar ?? undefined)
    : null;

  const currentLangLabel = LOCALES.find(l => l.code === locale)?.label ?? 'EN';

  return (
    <header className='space-y-[24px]'>
      <div className='flex items-start justify-between gap-[24px] flex-wrap'>
        {/* Greeting */}
        <div className='flex-1 min-w-[280px]'>
          <div className='text-xs uppercase tracking-[0.18em] text-primary-500/60 mb-2'>
            {dateLabel}
          </div>
          <h1 className='font-display text-3xl md:text-4xl lg:text-5xl text-primary-500 leading-[1.05]'>
            {t('greeting', { name: user?.firstName ?? 'Merchant' })}
          </h1>
          <p className='mt-3 text-primary-500/70 text-base md:text-lg max-w-2xl'>
            {t('impactStatement', { trees: treesEquivalent })}
          </p>
        </div>

        {/* Action circles + ESG badge */}
        <div className='flex items-center gap-[10px]'>
          {/* Search */}
          <button
            className='h-[44px] w-[44px] grid place-items-center rounded-full glass shadow-soft'
            aria-label='Search'
          >
            <Search size={17} className='text-primary-500' />
          </button>

          {/* Notifications */}
          <button
            className='relative h-[44px] w-[44px] grid place-items-center rounded-full glass shadow-soft'
            aria-label='Notifications'
          >
            <Bell size={17} className='text-primary-500' />
            {unreadCount > 0 && (
              <span className='absolute top-[10px] right-[10px] h-[8px] w-[8px] rounded-full bg-brand-coral' />
            )}
          </button>

          {/* Language switcher */}
          <div ref={langRef} className='relative'>
            <button
              onClick={() => setLangOpen(v => !v)}
              className='h-[44px] w-[44px] grid place-items-center rounded-full glass shadow-soft text-[11px] font-bold text-primary-500 tracking-wide'
              aria-label='Switch language'
            >
              {currentLangLabel}
            </button>

            <AnimatePresence>
              {langOpen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className='absolute right-0 top-[50px] z-50 glass rounded-xl shadow-soft py-[6px] min-w-[72px] overflow-hidden'
                >
                  {LOCALES.map(l => (
                    <button
                      key={l.code}
                      onClick={() => switchLocale(l.code)}
                      className={`w-full px-[14px] py-[8px] text-[12px] font-medium text-left transition-colors
                        ${
                          locale === l.code
                            ? 'text-primary-500 font-bold bg-primary-500/[0.06]'
                            : 'text-primary-500/60 hover:text-primary-500 hover:bg-primary-500/[0.04]'
                        }`}
                    >
                      {l.label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ESG badge pill */}
          <div className='flex items-center gap-[12px] pl-[12px] pr-[18px] py-[6px] rounded-full glass shadow-soft'>
            {/* Avatar */}
            {avatar && !avatarError ? (
              <img
                src={avatar}
                alt={user?.firstName ?? ''}
                className='shrink-0 rounded-full object-cover'
                style={{ width: 36, height: 36 }}
                onError={() => setAvatarError(true)}
              />
            ) : (
              <div
                className='shrink-0 rounded-full flex items-center justify-center text-[11px] font-semibold text-primary-500'
                style={{ width: 36, height: 36, background: 'rgba(30,68,72,0.12)' }}
              >
                {user?.firstName?.[0]}
                {user?.lastName?.[0]}
              </div>
            )}

            <div className='hidden sm:block leading-tight'>
              <div className='text-[10px] uppercase tracking-wider text-primary-500/60'>Rank</div>
              <div className='text-[13px] font-semibold text-primary-500'>
                {rank > 0 ? (
                  <span className='text-brand-coral'>#{rank}</span>
                ) : (
                  <span className='text-primary-500/40'>—</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Monthly Green Goal */}
      <div>
        <div className='flex items-center justify-between text-xs mb-2'>
          <span className='text-primary-500/70'>
            Monthly Green Goal ·{' '}
            <span className='font-medium text-primary-500'>
              {currentMonthBags} / {targetBags} paniers sauvés
            </span>
          </span>
          <span className='font-semibold text-primary-500'>{goalProgress}%</span>
        </div>
        <div className='h-[6px] w-full rounded-full bg-primary-500/[0.08] overflow-hidden'>
          <motion.div
            className='h-full rounded-full bg-brand-coral'
            initial={{ width: 0 }}
            animate={{ width: `${goalProgress}%` }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
          />
        </div>
      </div>
    </header>
  );
}
