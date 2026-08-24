'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import Image from 'next/image';
import {
  ChevronLeft,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  TrendingUp,
  Store,
  Rocket,
} from 'lucide-react';
import { Button, Input } from '@foodwaste/ui';
import { Link } from '@/i18n/routing';
import { PasswordStrengthIndicator } from './password-strength-indicator';
import { isAxiosError } from 'axios';
import { authService } from '@/services/auth.service';
import '../../app/[locale]/(merchant-onboarding)/merchant-signup/merchant-signup.css';

export function ResetPasswordForm() {
  const t = useTranslations('auth');
  const tHero = useTranslations('merchantSignup');
  const locale = useLocale();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError(t('passwordMismatch'));
      return;
    }

    setIsLoading(true);
    try {
      await authService.resetPassword({ token, newPassword: password });
      setIsSuccess(true);
    } catch (err) {
      if (isAxiosError(err) && err.response?.data?.message?.type === 'PASSWORD_REUSE_VIOLATION') {
        setError(t('passwordReuseViolation'));
      } else {
        setError(t('resetPasswordError'));
      }
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
      {/* ── Left hero (identical to login / forgot-password) ── */}
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
            onClick={() => window.location.replace(`/${locale}/login`)}
            className='flex items-center gap-xs text-muted-foreground transition-colors hover:text-foreground'
            aria-label='Back to login'
          >
            <ChevronLeft className='h-5 w-5' />
          </button>

          {isSuccess ? (
            /* ── Success state ── */
            <div className='flex flex-col items-center gap-lg py-2xl text-center'>
              <div className='flex h-14 w-14 items-center justify-center rounded-full bg-primary/10'>
                <CheckCircle2 className='h-7 w-7 text-primary' />
              </div>
              <div>
                <h2
                  className='text-xl font-bold text-black sm:text-2xl lg:text-3xl'
                  style={{ fontFamily: 'var(--font-serif)' }}
                >
                  {t('resetPasswordTitle')}
                </h2>
                <p className='mt-sm text-sm text-muted-foreground'>{t('resetPasswordSuccess')}</p>
              </div>
              <button
                type='button'
                onClick={() => window.location.replace(`/${locale}/login`)}
                className='mt-sm flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80'
              >
                <ArrowLeft className='h-3.5 w-3.5' />
                {t('backToLogin')}
              </button>
            </div>
          ) : (
            /* ── Form state ── */
            <>
              <div>
                <h2
                  className='text-xl font-bold text-black sm:text-2xl lg:text-3xl'
                  style={{ fontFamily: 'var(--font-serif)' }}
                >
                  {t('resetPasswordTitle')}
                </h2>
                <p className='mt-xs text-sm text-muted-foreground'>
                  {t('resetPasswordDescription')}
                </p>
              </div>

              <form onSubmit={handleSubmit} className='space-y-lg sm:space-y-xl'>
                {/* New password */}
                <div className='space-y-sm'>
                  <label htmlFor='password' className='text-sm font-medium text-muted-foreground'>
                    {t('newPassword')}
                    <span className='text-destructive'>*</span>
                  </label>
                  <div className='relative'>
                    <Lock className='absolute left-3.5 top-xs/2 h-4 w-4 -translate-y-xs/2 text-muted-foreground pointer-events-none' />
                    <Input
                      id='password'
                      type={showPassword ? 'text' : 'password'}
                      className='h-11 rounded-xl border-input bg-secondary/50 pl-3xl pr-6xl text-sm sm:h-12'
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      disabled={isLoading}
                      autoComplete='new-password'
                    />
                    <button
                      type='button'
                      onClick={() => setShowPassword(v => !v)}
                      className='absolute right-3.5 top-xs/2 -translate-y-xs/2 text-muted-foreground hover:text-foreground'
                      tabIndex={-1}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className='h-4 w-4' /> : <Eye className='h-4 w-4' />}
                    </button>
                  </div>
                  <PasswordStrengthIndicator password={password} />
                </div>

                {/* Confirm password */}
                <div className='space-y-sm'>
                  <label
                    htmlFor='confirmPassword'
                    className='text-sm font-medium text-muted-foreground'
                  >
                    {t('confirmPassword')}
                    <span className='text-destructive'>*</span>
                  </label>
                  <div className='relative'>
                    <Lock className='absolute left-3.5 top-xs/2 h-4 w-4 -translate-y-xs/2 text-muted-foreground pointer-events-none' />
                    <Input
                      id='confirmPassword'
                      type={showConfirm ? 'text' : 'password'}
                      className='h-11 rounded-xl border-input bg-secondary/50 pl-3xl pr-6xl text-sm sm:h-12'
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      required
                      disabled={isLoading}
                      autoComplete='new-password'
                    />
                    <button
                      type='button'
                      onClick={() => setShowConfirm(v => !v)}
                      className='absolute right-3.5 top-xs/2 -translate-y-xs/2 text-muted-foreground hover:text-foreground'
                      tabIndex={-1}
                      aria-label={showConfirm ? 'Hide password' : 'Show password'}
                    >
                      {showConfirm ? <EyeOff className='h-4 w-4' /> : <Eye className='h-4 w-4' />}
                    </button>
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
                  {isLoading && <Loader2 className='mr-sm h-4 w-4 animate-spin' />}
                  {t('resetPasswordButton')}
                </Button>

                {/* Back to login */}
                <button
                  type='button'
                  onClick={() => window.location.replace(`/${locale}/login`)}
                  className='flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground'
                >
                  <ArrowLeft className='h-3.5 w-3.5' />
                  {t('backToLogin')}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
