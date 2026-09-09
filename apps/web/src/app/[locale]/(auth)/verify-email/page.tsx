'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import Image from 'next/image';
import {
  Loader2,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  TrendingUp,
  Store,
  Rocket,
} from 'lucide-react';
import { Link } from '@/i18n/routing';
import { authService } from '@/services/auth.service';
import { UserRole } from '@foodwaste/shared';
import '../../(merchant-onboarding)/merchant-signup/merchant-signup.css';

type VerifyState = 'loading' | 'success-merchant' | 'success-consumer' | 'error';

function VerifyEmailInner() {
  const t = useTranslations('auth');
  const tHero = useTranslations('merchantSignup');
  const locale = useLocale();
  const searchParams = useSearchParams();

  const token = searchParams.get('token') ?? '';
  const statusParam = searchParams.get('status');

  const [state, setState] = useState<VerifyState>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const calledRef = useRef(false);
  const appRedirectAttempted = useRef(false);

  useEffect(() => {
    if (calledRef.current) return;

    // Case 1: Arrived via backend GET redirect with status param (no token needed)
    if (statusParam === 'success') {
      setState('success-consumer');
      calledRef.current = true;
      return;
    }
    if (statusParam === 'error') {
      setState('error');
      setErrorMessage(t('verifyEmailFailedMessage'));
      calledRef.current = true;
      return;
    }

    // Case 2: Direct link with token — verify via POST
    if (!token) {
      setState('error');
      setErrorMessage(t('verifyEmailMissingToken'));
      return;
    }

    calledRef.current = true;

    async function verify() {
      try {
        const response = await authService.verifyEmail({ token });
        const data = response.data.data;

        const userRole = data.user?.role;
        const isMerchant = userRole === UserRole.MERCHANT || userRole === UserRole.ADMIN;

        if (isMerchant) {
          setState('success-merchant');
        } else {
          setState('success-consumer');
        }
      } catch {
        setState('error');
        setErrorMessage(t('verifyEmailFailedMessage'));
      }
    }

    verify();
  }, [token, statusParam, t]);

  // On mobile browsers: try to open the app after successful consumer verification.
  // If the app is installed, the custom scheme redirect opens it; otherwise nothing happens.
  useEffect(() => {
    if (state !== 'success-consumer' || appRedirectAttempted.current) return;
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (!isMobile) return;

    appRedirectAttempted.current = true;
    window.location.href = 'foodwaste://verify-email?status=success';
  }, [state]);

  const stats = [
    { value: '34%', label: tHero('statRevenue'), Icon: TrendingUp },
    { value: '2+', label: tHero('statStores'), Icon: Store },
    { value: '∞', label: tHero('statGrowth'), Icon: Rocket },
  ];

  return (
    <div className='merchant-signup-theme fixed inset-0 z-50 flex flex-col overflow-hidden lg:flex-row'>
      {/* LEFT HERO SECTION */}
      <div className='relative flex flex-[1.1] flex-col justify-between px-xl py-md sm:py-2xl sm:px-4xl lg:flex-1 lg:p-3xl bg-[hsl(174,72%,17%)]'>
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

          <div className='flex max-w-xl flex-1 flex-col justify-center'>
            <span className='mb-xs inline-block w-fit rounded-full bg-white/15 px-md py-xs text-xs font-semibold uppercase tracking-[0.2em] text-white/80 sm:mb-lg sm:px-xl sm:py-1.5 sm:text-[10px] sm:tracking-[0.25em]'>
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
            <p className='hidden text-white/75 sm:block sm:text-xs lg:text-base'>
              {tHero('heroDescription')}
            </p>
          </div>

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
                    <div className='truncate text-xs text-white/75 sm:text-[10px] lg:text-xs'>
                      {stat.label}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className='border-t border-white/15 pt-sm sm:pt-lg'>
              <p className='text-[10px] italic leading-relaxed text-white/70 sm:text-xs lg:text-sm'>
                &ldquo;{tHero('testimonialQuote')}&rdquo;
              </p>
              <p className='mt-xs text-xs font-medium text-white/75 sm:text-[10px] lg:text-xs'>
                {tHero('testimonialAuthor')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT CONTENT */}
      <div className='flex flex-1 flex-col items-center justify-center bg-background px-xl py-2xl sm:p-4xl lg:p-4xl'>
        <div className='w-full max-w-md space-y-2xl'>
          {/* Back to home */}
          <Link
            href='/'
            className='flex items-center gap-xs text-muted-foreground transition-colors hover:text-foreground'
            aria-label='Go to home page'
          >
            <ChevronLeft className='h-5 w-5' />
          </Link>
          {state === 'loading' && (
            <div className='flex flex-col items-center gap-lg text-center'>
              <Loader2 className='h-12 w-12 animate-spin text-primary' />
              <h2 className='text-2xl font-semibold'>{t('verifyEmailTitle')}</h2>
            </div>
          )}

          {state === 'success-consumer' && (
            <div className='flex flex-col items-center gap-lg text-center'>
              <div className='flex h-20 w-20 items-center justify-center rounded-full bg-green-100'>
                <CheckCircle2 className='h-10 w-10 text-green-600' />
              </div>
              <h2 className='text-2xl font-semibold'>{t('verifyEmailSuccessTitle')}</h2>
              <p className='text-base leading-relaxed text-muted-foreground'>
                {t('verifyEmailConsumerMessage')}
              </p>
              <a
                href={`/${locale}`}
                className='mt-lg inline-flex h-11 items-center justify-center rounded-lg bg-primary px-4xl text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90'
              >
                {t('verifyEmailGoToHome')}
              </a>
            </div>
          )}

          {state === 'success-merchant' && (
            <div className='flex flex-col items-center gap-lg text-center'>
              <div className='flex h-20 w-20 items-center justify-center rounded-full bg-green-100'>
                <CheckCircle2 className='h-10 w-10 text-green-600' />
              </div>
              <h2 className='text-2xl font-semibold'>{t('verifyEmailSuccessTitle')}</h2>
              <p className='text-base leading-relaxed text-muted-foreground'>
                {t('verifyEmailMerchantMessage')}
              </p>
              <a
                href={`/${locale}/merchant/dashboard`}
                className='mt-lg inline-flex h-11 items-center justify-center rounded-lg bg-primary px-4xl text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90'
              >
                {t('verifyEmailGoToDashboard')}
              </a>
            </div>
          )}

          {state === 'error' && (
            <div className='flex flex-col items-center gap-lg text-center'>
              <div className='flex h-20 w-20 items-center justify-center rounded-full bg-red-100'>
                <XCircle className='h-10 w-10 text-red-600' />
              </div>
              <h2 className='text-2xl font-semibold'>{t('verifyEmailFailedTitle')}</h2>
              <p className='text-base leading-relaxed text-muted-foreground'>
                {errorMessage || t('verifyEmailFailedMessage')}
              </p>
              <Link
                href='/login'
                className='mt-lg inline-flex h-11 items-center justify-center rounded-lg bg-primary px-4xl text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90'
              >
                {t('verifyEmailFailedBackToLogin')}
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-background'>
          <Loader2 className='h-10 w-10 animate-spin text-primary' />
        </div>
      }
    >
      <VerifyEmailInner />
    </Suspense>
  );
}
