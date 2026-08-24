'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'cookie-consent';

type ConsentValue = 'accepted' | 'declined';

function CookieIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      className={className}
      aria-hidden='true'
    >
      <circle cx='12' cy='12' r='10' fill='hsl(var(--primary))' opacity='0.15' />
      <path
        d='M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10c0-.34-.02-.675-.055-1.006a1 1 0 0 0-1.213-.862 3 3 0 0 1-3.465-1.932 1 1 0 0 0-1.052-.612A3.5 3.5 0 0 1 13 4.5a1 1 0 0 0-.465-1.11A10.06 10.06 0 0 0 12 2Z'
        fill='hsl(var(--primary))'
        opacity='0.85'
      />
      <circle cx='7.5' cy='11' r='1.25' fill='hsl(var(--primary-foreground))' opacity='0.9' />
      <circle cx='11' cy='15' r='1' fill='hsl(var(--primary-foreground))' opacity='0.7' />
      <circle cx='15' cy='12.5' r='0.75' fill='hsl(var(--primary-foreground))' opacity='0.5' />
      <circle cx='9' cy='7.5' r='0.75' fill='hsl(var(--primary-foreground))' opacity='0.6' />
    </svg>
  );
}

export function CookieConsent() {
  const t = useTranslations('cookieConsent');
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as ConsentValue | null;
    if (!stored) {
      const timer = setTimeout(() => setVisible(true), 1500);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, []);

  function handleConsent(value: ConsentValue) {
    setExiting(true);
    setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, value);
      setVisible(false);
      setExiting(false);

      if (value === 'declined') {
        window.dispatchEvent(new CustomEvent('cookie-consent-declined'));
      }
    }, 300);
  }

  if (!visible) return null;

  return (
    <div
      role='dialog'
      aria-label='Cookie consent'
      className={cn(
        'fixed z-50 bottom-lg start-lg end-lg sm:end-auto sm:max-w-sm',
        'rounded-2xl border border-border/50',
        'bg-background/80 backdrop-blur-xl shadow-2xl shadow-black/10',
        'p-xl',
        'transition-all duration-500 ease-out',
        exiting
          ? 'translate-y-lg opacity-0 scale-95'
          : 'translate-y-0 opacity-100 scale-100 animate-in slide-in-from-bottom-8 fade-in duration-700',
      )}
    >
      <div className='flex items-start gap-3.5'>
        <CookieIcon className='size-10 shrink-0 mt-xxs' />
        <div className='flex-1 min-w-0'>
          <p className='text-sm leading-relaxed text-foreground/90'>{t('message')}</p>

          <Link
            href='/cookie-policy'
            className='inline-block mt-1.5 text-xs text-primary hover:text-primary/80 underline underline-offset-2 transition-colors'
          >
            {t('learnMore')}
          </Link>

          <div className='flex items-center gap-2.5 mt-3.5'>
            <button
              type='button'
              onClick={() => handleConsent('accepted')}
              className={cn(
                'flex-1 h-9 rounded-full text-sm font-medium',
                'bg-primary text-primary-foreground',
                'hover:bg-primary/90 active:scale-[0.97]',
                'transition-all duration-200',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              )}
            >
              {t('accept')}
            </button>
            <button
              type='button'
              onClick={() => handleConsent('declined')}
              className={cn(
                'flex-1 h-9 rounded-full text-sm font-medium',
                'border border-border text-foreground/70',
                'hover:bg-muted hover:text-foreground active:scale-[0.97]',
                'transition-all duration-200',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              )}
            >
              {t('decline')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
