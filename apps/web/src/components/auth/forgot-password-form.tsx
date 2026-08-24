'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import Image from 'next/image';
import {
  ChevronLeft,
  Mail,
  Loader2,
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  TrendingUp,
  Store,
  Rocket,
} from 'lucide-react';
import { Button, Input } from '@foodwaste/ui';
import { Link } from '@/i18n/routing';
import { authService } from '@/services/auth.service';
import '../../app/[locale]/(merchant-onboarding)/merchant-signup/merchant-signup.css';

export function ForgotPasswordForm() {
  const t = useTranslations('auth');
  const tHero = useTranslations('merchantSignup');
  const router = useRouter();
  const locale = useLocale();

  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      await authService.forgotPassword({ email });
      setIsSubmitted(true);
    } catch {
      setError(t('forgotPasswordError'));
    } finally {
      setIsLoading(false);
    }
  }

  const stats = [
    { value: '34%', label: tHero('statRevenue'), Icon: TrendingUp },
    { value: '2+', label: tHero('statStores'), Icon: Store },
    { value: '∞', label: tHero('statGrowth'), Icon: Rocket },
  ];

  return (
    <div className='merchant-signup-theme fixed inset-0 z-50 flex flex-col overflow-hidden lg:flex-row'>
      {/* ── Left hero (identical to login) ── */}
      <div className='relative flex flex-[1.1] flex-col justify-between px-xl py-md sm:py-2xl sm:px-4xl lg:flex-1 lg:p-3xl'>
        <Image
          src='/images/hero-bg.jpg'
          alt=''
          fill
          sizes='(max-width: 1024px) 100vw, 55vw'
          className='object-cover'
          priority
          quality={85}
        />
        <div className='absolute inset-0 bg-[hsl(174,72%,17%)] opacity-85' />

        <div className='relative z-10 flex h-full flex-col justify-between gap-sm sm:gap-xl lg:gap-4xl'>
          {/* Logo */}
          <Link href='/' className='flex items-center gap-sm transition-opacity hover:opacity-80'>
            <Image
              src='/images/image.svg'
              alt='Too Fresh To Waste'
              width={32}
              height={32}
              className='brightness-0 invert sm:w-6'
            />
            <span className='text-sm font-semibold tracking-wide text-white sm:text-base lg:text-lg'>
              Too Fresh To Waste
            </span>
          </Link>

          {/* Hero content */}
          <div className='flex max-w-xl flex-1 flex-col justify-center'>
            <span className='mb-xs inline-block w-fit rounded-full bg-white/15 px-md py-xs text-[8px] font-semibold uppercase tracking-[0.2em] text-white/80 sm:mb-lg sm:px-xl sm:py-1.5 sm:text-[10px] sm:tracking-[0.25em]'>
              {tHero('heroBadge')}
            </span>
            <h1
              className='mb-xs text-xl font-bold leading-[1.2] text-white sm:mb-sm sm:text-2xl lg:mb-md lg:text-4xl'
              style={{ fontFamily: 'var(--font-serif)' }}
            >
              {tHero('heroTitle')}
            </h1>
            <p className='mb-xs text-xs leading-snug text-white/75 sm:mb-lg sm:text-sm sm:leading-relaxed lg:mb-2xl lg:text-lg'>
              {tHero('heroTitleAccent')}
            </p>
            <p className='hidden text-white/60 sm:block sm:text-xs lg:text-base'>
              {tHero('heroDescription')}
            </p>
          </div>

          {/* Stats */}
          <div className='space-y-sm sm:space-y-lg lg:space-y-4xl'>
            <div className='flex gap-sm sm:gap-md'>
              {stats.map(stat => (
                <div
                  key={stat.label}
                  className='flex min-w-0 flex-1 items-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-sm py-sm backdrop-blur-md sm:gap-sm sm:rounded-xl sm:px-md sm:py-md lg:gap-md lg:rounded-2xl lg:px-xl lg:py-lg'
                >
                  <stat.Icon className='h-3.5 w-3.5 shrink-0 text-white/70 sm:h-4 sm:w-4 lg:h-5 lg:w-5' />
                  <div className='min-w-0'>
                    <div
                      className='text-sm font-bold leading-tight text-white sm:text-base lg:text-lg'
                      style={{ fontFamily: 'var(--font-serif)' }}
                    >
                      {stat.value}
                    </div>
                    <div className='truncate text-[9px] text-white/60 sm:text-[10px] lg:text-xs'>
                      {stat.label}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Testimonial */}
            <div className='border-t border-white/15 pt-sm sm:pt-lg'>
              <p className='text-[10px] italic leading-relaxed text-white/70 sm:text-xs lg:text-sm'>
                &ldquo;{tHero('testimonialQuote')}&rdquo;
              </p>
              <p className='mt-xs text-[9px] font-medium text-white/50 sm:text-[10px] lg:text-xs'>
                {tHero('testimonialAuthor')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right form ── */}
      <div className='flex flex-1 flex-col items-center justify-center bg-background px-xl py-2xl sm:p-4xl lg:p-4xl'>
        <div className='w-full max-w-md space-y-xl sm:space-y-2xl'>
          {/* Back chevron */}
          <button
            type='button'
            onClick={() => router.push(`/${locale}/login`)}
            className='flex items-center gap-xs text-muted-foreground transition-colors hover:text-foreground'
            aria-label='Back to login'
          >
            <ChevronLeft className='h-5 w-5' />
          </button>

          {isSubmitted ? (
            /* ── Success state ── */
            <div className='flex flex-col items-center gap-lg text-center py-2xl'>
              <div className='flex h-14 w-14 items-center justify-center rounded-full bg-primary/10'>
                <CheckCircle2 className='h-7 w-7 text-primary' />
              </div>
              <div>
                <h2
                  className='text-xl font-bold text-black sm:text-2xl lg:text-3xl'
                  style={{ fontFamily: 'var(--font-serif)' }}
                >
                  {t('checkEmail')}
                </h2>
                <p className='mt-sm text-sm text-muted-foreground'>{t('checkEmailDescription')}</p>
              </div>
              <Link
                href='/login'
                className='mt-sm flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80'
              >
                <ArrowLeft className='h-3.5 w-3.5' />
                {t('backToLogin')}
              </Link>
            </div>
          ) : (
            /* ── Form state ── */
            <>
              <div>
                <h2
                  className='text-xl font-bold text-black sm:text-2xl lg:text-3xl'
                  style={{ fontFamily: 'var(--font-serif)' }}
                >
                  {t('forgotPasswordTitle')}
                </h2>
                <p className='mt-xs text-sm text-muted-foreground'>
                  {t('forgotPasswordDescription')}
                </p>
              </div>

              <form onSubmit={handleSubmit} className='space-y-lg sm:space-y-xl'>
                {/* Email */}
                <div className='space-y-sm'>
                  <label htmlFor='email' className='text-sm font-medium text-muted-foreground'>
                    {t('email')}
                    <span className='text-destructive'>*</span>
                  </label>
                  <div className='relative'>
                    <Mail className='absolute left-3.5 top-xs/2 h-4 w-4 -translate-y-xs/2 text-muted-foreground pointer-events-none' />
                    <Input
                      id='email'
                      type='email'
                      placeholder={t('emailPlaceholder')}
                      className='h-11 rounded-xl border-input bg-secondary/50 ps-3xl text-sm sm:h-12'
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                      autoComplete='email'
                      disabled={isLoading}
                    />
                  </div>
                </div>

                {/* Error */}
                {error && (
                  <div className='flex items-center gap-sm rounded-lg border border-destructive/30 bg-destructive/5 px-md py-2.5 text-sm text-destructive'>
                    <AlertCircle className='h-4 w-4 shrink-0' />
                    <span>{error}</span>
                  </div>
                )}

                {/* Submit */}
                <Button
                  type='submit'
                  className='h-11 w-full rounded-xl text-sm font-semibold sm:h-12'
                  disabled={isLoading}
                >
                  {isLoading && <Loader2 className='me-sm h-4 w-4 animate-spin' />}
                  {t('sendResetLink')}
                </Button>

                {/* Back to login */}
                <Link
                  href='/login'
                  className='flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground'
                >
                  <ArrowLeft className='h-3.5 w-3.5' />
                  {t('backToLogin')}
                </Link>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
