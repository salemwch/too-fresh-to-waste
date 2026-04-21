'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useLocale } from 'next-intl';
import { useAuth } from '@/hooks/use-auth';
import { Button, Input } from '@foodwaste/ui';
import { Link } from '@/i18n/routing';
import Image from 'next/image';
import {
  ChevronLeft,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  TrendingUp,
  Store,
  Rocket,
  AlertCircle,
} from 'lucide-react';
import { UserRole } from '@foodwaste/shared';
import '../../(merchant-onboarding)/merchant-signup/merchant-signup.css';

// ── Inner form (uses useSearchParams — must be inside Suspense) ──────────────
function LoginFormInner() {
  const t = useTranslations('auth');
  const tHero = useTranslations('merchantSignup');
  const { login } = useAuth();
  const router = useRouter();
  const locale = useLocale();
  const searchParams = useSearchParams();
  const rawCallback = searchParams.get('callbackUrl');
  // Only allow same-origin relative paths — reject external redirects
  const callbackUrl =
    rawCallback && /^\/(?!\/)/.test(decodeURIComponent(rawCallback)) ? rawCallback : null;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  // Track only this form's own submission — not the global auth store's isLoading
  // (which starts true so AuthGuard skeletons work, but should not freeze the login form).
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoginError('');
    setIsSubmitting(true);
    try {
      const result = await login({ email, password, rememberMe: false });

      if (callbackUrl) {
        router.push(callbackUrl);
      } else if (result.user.role === UserRole.ADMIN || result.user.role === UserRole.MODERATOR) {
        router.push(`/${locale}/admin/dashboard`);
      } else if (result.user.role === UserRole.MERCHANT) {
        router.push(`/${locale}/merchant/dashboard`);
      } else {
        router.push(`/${locale}`);
      }
    } catch {
      setLoginError(t('loginError'));
    } finally {
      setIsSubmitting(false);
    }
  }

  const stats = [
    { value: '34%', label: tHero('statRevenue'), Icon: TrendingUp },
    { value: '2+', label: tHero('statStores'), Icon: Store },
    { value: '∞', label: tHero('statGrowth'), Icon: Rocket },
  ];

  return (
    // Fixed overlay that covers the (auth) layout header/footer entirely
    <div className='merchant-signup-theme fixed inset-0 z-50 flex flex-col overflow-hidden lg:flex-row'>
      {/* ================================================================
          LEFT HERO SECTION — identical to merchant-signup
          ================================================================ */}
      {/* bg-[hsl(174,72%,17%)] is the base colour: keeps the panel dark while the
          hero-bg.jpg is loading, matching the LoginFallback exactly so there
          is no flash on hydration. */}
      <div className='relative flex flex-[1.1] flex-col justify-between px-5 py-3 sm:py-6 sm:px-8 lg:flex-1 lg:p-12 bg-[hsl(174,72%,17%)]'>
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

        <div className='relative z-10 flex h-full flex-col justify-between gap-2 sm:gap-5 lg:gap-8'>
          {/* Logo */}
          <div className='flex items-center gap-2'>
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
          </div>

          {/* Main hero content */}
          <div className='flex max-w-xl flex-1 flex-col justify-center'>
            <span className='mb-1 inline-block w-fit rounded-full bg-white/15 px-3 py-1 text-[8px] font-semibold uppercase tracking-[0.2em] text-white/80 sm:mb-4 sm:px-5 sm:py-1.5 sm:text-[10px] sm:tracking-[0.25em]'>
              {tHero('heroBadge')}
            </span>
            <h1
              className='mb-1 text-xl font-bold leading-[1.2] text-white sm:mb-2 sm:text-2xl lg:mb-3 lg:text-4xl'
              style={{ fontFamily: 'var(--font-serif)' }}
            >
              {tHero('heroTitle')}
            </h1>
            <p className='mb-1 text-xs leading-snug text-white/75 sm:mb-4 sm:text-sm sm:leading-relaxed lg:mb-6 lg:text-lg'>
              {tHero('heroTitleAccent')}
            </p>
            <p className='hidden text-white/60 sm:block sm:text-xs lg:text-base'>
              {tHero('heroDescription')}
            </p>
          </div>

          {/* Stats */}
          <div className='space-y-2 sm:space-y-4 lg:space-y-8'>
            <div className='flex gap-2 sm:gap-3'>
              {stats.map(stat => (
                <div
                  key={stat.label}
                  className='flex min-w-0 flex-1 items-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-2 py-2 backdrop-blur-md sm:gap-2 sm:rounded-xl sm:px-3 sm:py-3 lg:gap-3 lg:rounded-2xl lg:px-5 lg:py-4'
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
            <div className='border-t border-white/15 pt-2 sm:pt-4'>
              <p className='text-[10px] italic leading-relaxed text-white/70 sm:text-xs lg:text-sm'>
                &ldquo;{tHero('testimonialQuote')}&rdquo;
              </p>
              <p className='mt-1 text-[9px] font-medium text-white/50 sm:text-[10px] lg:text-xs'>
                {tHero('testimonialAuthor')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ================================================================
          RIGHT LOGIN FORM
          ================================================================ */}
      <div className='flex flex-1 flex-col items-center justify-center bg-background px-5 py-6 sm:p-8 lg:p-16'>
        <div className='w-full max-w-md space-y-5 sm:space-y-6'>
          {/* Back chevron */}
          <button
            type='button'
            onClick={() => router.back()}
            className='flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground'
            aria-label='Go back'
          >
            <ChevronLeft className='h-5 w-5' />
          </button>

          {/* Title */}
          <div>
            <h2
              className='flex items-center gap-2 text-xl font-bold text-black sm:text-2xl lg:text-3xl'
              style={{ fontFamily: 'var(--font-serif)' }}
            >
              {t('loginPageTitle')}
              <Image
                src='/icons/Blue Bold Modern How to Get Verified Instagram Post.svg'
                alt='Verified'
                width={22}
                height={22}
                className='h-3 w-3 shrink-0 sm:h-4 sm:w-4'
              />
            </h2>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className='space-y-4 sm:space-y-5'>
            {/* Email */}
            <div className='space-y-2'>
              <label htmlFor='email' className='text-sm font-medium text-muted-foreground'>
                {t('email')}
                <span className='text-destructive'>*</span>
              </label>
              <div className='relative'>
                <Mail className='absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
                <Input
                  id='email'
                  type='email'
                  placeholder={t('emailPlaceholder')}
                  className='h-11 rounded-xl border-input bg-secondary/50 pl-7 text-sm sm:h-12'
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete='email'
                  disabled={isSubmitting}
                />
              </div>
            </div>

            {/* Password */}
            <div className='space-y-2'>
              <label htmlFor='password' className='text-sm font-medium text-muted-foreground'>
                {t('password')}
                <span className='text-destructive'>*</span>
              </label>
              <div className='relative'>
                <Lock className='absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none' />
                <Input
                  id='password'
                  type={showPassword ? 'text' : 'password'}
                  className='h-11 rounded-xl border-input bg-secondary/50 pl-7 pr-10 text-sm sm:h-12'
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete='current-password'
                  disabled={isSubmitting}
                />
                <button
                  type='button'
                  onClick={() => setShowPassword(v => !v)}
                  className='absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground'
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className='h-4 w-4' /> : <Eye className='h-4 w-4' />}
                </button>
              </div>
            </div>

            {/* Forgot password */}
            <div className='flex justify-end'>
              <Link
                href='/forgot-password'
                className='text-sm font-medium text-primary hover:text-primary/80'
              >
                {t('forgotPassword')}
              </Link>
            </div>

            {/* Inline error */}
            {loginError && (
              <div className='flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive'>
                <AlertCircle className='h-4 w-4 shrink-0' />
                <span>{loginError}</span>
              </div>
            )}

            {/* Login button */}
            <Button
              type='submit'
              className='h-11 w-full rounded-xl text-sm font-semibold sm:h-12'
              disabled={isSubmitting}
            >
              {isSubmitting && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
              {t('loginButton')}
            </Button>

            {/* Sign up food business */}
            <Button
              type='button'
              variant='outline'
              className='h-11 w-full rounded-xl text-sm font-semibold sm:h-12'
              onClick={() => router.push(`/${locale}/merchant-signup`)}
              disabled={isSubmitting}
            >
              {t('signUpBusiness')}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ── Full-screen fallback shown while useSearchParams resolves ────────────────
// Covers the (auth) layout header so it never flashes through during streaming.
function LoginFallback() {
  return (
    <div className='merchant-signup-theme fixed inset-0 z-50 flex flex-col overflow-hidden lg:flex-row'>
      {/* Left hero — static, no interactivity needed */}
      <div className='relative flex flex-[1.1] flex-col justify-between px-5 py-3 sm:py-6 sm:px-8 lg:flex-1 lg:p-12 bg-[hsl(174,72%,17%)]' />
      {/* Right — blank white panel while JS loads */}
      <div className='flex flex-1 bg-background' />
    </div>
  );
}

// ── Page export — wraps inner form in Suspense for useSearchParams ────────────
export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginFormInner />
    </Suspense>
  );
}
