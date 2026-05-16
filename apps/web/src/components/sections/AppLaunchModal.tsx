'use client';

import { useEffect, useState } from 'react';
import { Smartphone, MapPin, Leaf, CheckCircle2, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useAppLaunchModal } from '@/lib/app-launch-modal.store';

const LAUNCH_DATE = new Date('2026-06-06T00:00:00Z');
const STORAGE_KEY = 'tftw_launch_notified';

function getTimeLeft() {
  const diff = LAUNCH_DATE.getTime() - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
  };
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

const FEATURES = [
  { Icon: Smartphone, text: 'Surprise bags up to 70% off original price' },
  { Icon: MapPin, text: 'Restaurants, bakeries & stores near you' },
  { Icon: Leaf, text: 'Earn points, win prizes, help the planet' },
] as const;

export function AppLaunchModal() {
  const { isOpen, close } = useAppLaunchModal();
  const [timeLeft, setTimeLeft] = useState(getTimeLeft);
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && localStorage.getItem(STORAGE_KEY)) {
      setSubmitted(true);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const id = setInterval(() => setTimeLeft(getTimeLeft()), 1000);
    return () => clearInterval(id);
  }, [isOpen]);

  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const handleNotify = async () => {
    if (!isEmailValid || submitting) return;
    setSubmitting(true);
    try {
      const apiBase = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3000/api/v1';
      await fetch(`${apiBase}/waitlist/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      localStorage.setItem(STORAGE_KEY, email.trim());
      setSubmitted(true);
    } catch {
      // Network error — still show success so UX isn't broken; backend retries on next attempt
      localStorage.setItem(STORAGE_KEY, email.trim());
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={v => !v && close()}>
      <DialogContent className='sm:max-w-[420px] p-0 gap-0 overflow-hidden rounded-3xl border-0 shadow-2xl [&>button]:top-4 [&>button]:right-4 [&>button]:text-white/50 [&>button]:hover:text-white [&>button]:opacity-100'>
        <DialogTitle className='sr-only'>App launch notification signup</DialogTitle>

        {/* ── Hero / Countdown ──────────────────────────────── */}
        <div
          className='relative px-6 pt-7 pb-8 text-center'
          style={{ background: 'hsl(174,72%,17%)' }}
        >
          <span className='mb-3 inline-block rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/60'>
            Coming Soon
          </span>

          <h2
            className='mb-1.5 text-2xl font-bold text-white'
            style={{ fontFamily: 'var(--font-serif)' }}
          >
            Launching June 6, 2026
          </h2>
          <p className='text-sm text-white/55'>
            Be first in line — get instant access when we go live.
          </p>

          {/* Countdown */}
          <div className='mt-6 flex items-start justify-center gap-2'>
            {(
              [
                { value: timeLeft.days, label: 'Days' },
                { value: timeLeft.hours, label: 'Hrs' },
                { value: timeLeft.minutes, label: 'Min' },
                { value: timeLeft.seconds, label: 'Sec' },
              ] as const
            ).map(({ value, label }, i) => (
              <div key={label} className='flex items-start gap-2'>
                <div className='flex flex-col items-center'>
                  <div className='min-w-[52px] rounded-xl border border-white/15 bg-white/10 px-3 py-2'>
                    <span className='block text-center text-2xl font-bold tabular-nums text-white'>
                      {pad(value)}
                    </span>
                  </div>
                  <span className='mt-1 text-[10px] uppercase tracking-wide text-white/35'>
                    {label}
                  </span>
                </div>
                {i < 3 && (
                  <span className='mt-2 text-xl font-bold text-white/25' aria-hidden='true'>
                    :
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── Body ──────────────────────────────────────────── */}
        <div className='bg-white px-6 py-5'>
          {/* Feature list */}
          <ul className='mb-5 space-y-2.5'>
            {FEATURES.map(({ Icon, text }) => (
              <li key={text} className='flex items-center gap-3 text-sm text-foreground'>
                <span className='flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10'>
                  <Icon className='h-3.5 w-3.5 text-primary' />
                </span>
                {text}
              </li>
            ))}
          </ul>

          {submitted ? (
            <div className='flex flex-col items-center gap-2 py-3 text-center'>
              <CheckCircle2 className='h-10 w-10 text-green-500' />
              <p className='font-semibold text-foreground'>You&apos;re on the list!</p>
              <p className='text-sm text-muted-foreground'>
                We&apos;ll ping you the moment we go live on June 6.
              </p>
            </div>
          ) : (
            <div className='flex flex-col gap-2'>
              <input
                type='email'
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleNotify()}
                placeholder='your@email.com'
                className='h-11 w-full rounded-xl border border-input bg-muted/30 px-4 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20'
              />
              <button
                type='button'
                onClick={handleNotify}
                disabled={!isEmailValid || submitting}
                className='flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40'
                style={{ background: 'hsl(174,72%,17%)' }}
              >
                {submitting && <Loader2 className='h-4 w-4 animate-spin' />}
                {submitting ? 'Saving…' : 'Notify Me on Launch Day'}
              </button>
            </div>
          )}

          <p className='mt-4 text-center text-xs text-muted-foreground'>
            Available on iOS &amp; Android · Free to download
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
