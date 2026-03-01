'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@foodwaste/ui';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import Image from 'next/image';
import { Link } from '@/i18n/routing';
import { authService } from '@/services/auth.service';
import { useAuthStore } from '@/lib/auth';
import { UserRole } from '@foodwaste/shared';

type VerifyState = 'loading' | 'success-merchant' | 'success-consumer' | 'error';

// ── Inner component (uses useSearchParams — must be inside Suspense) ──────────
function VerifyCallbackInner() {
  const t = useTranslations('auth');
  const searchParams = useSearchParams();
  const router = useRouter();
  const locale = useLocale();
  const store = useAuthStore();

  const token = searchParams.get('token') ?? '';
  const email = searchParams.get('email') ?? '';

  const [state, setState] = useState<VerifyState>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const calledRef = useRef(false);

  useEffect(() => {
    if (calledRef.current || !token || !email) {
      if (!token || !email) {
        setState('error');
        setErrorMessage(t('verifyMissingParams'));
      }
      return;
    }
    calledRef.current = true;

    async function verify() {
      try {
        const response = await authService.verifyEmail({ email, token });
        const data = response.data.data;

        const userRole = data.user?.role;
        const isMerchant =
          userRole === UserRole.MERCHANT || userRole === UserRole.ADMIN;

        if (isMerchant && data.tokens && data.user) {
          store.setTokens(data.tokens.accessToken, data.tokens.refreshToken);
          store.setUser(data.user);

          setState('success-merchant');

          setTimeout(() => {
            router.push(`/${locale}/merchant/dashboard`);
          }, 1500);
        } else {
          setState('success-consumer');
        }
      } catch {
        setState('error');
        setErrorMessage(t('verifyError'));
      }
    }

    verify();
  }, [token, email, store, router, locale, t]);

  return (
    <Card>
      {state === 'loading' && (
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
          </div>
          <CardTitle className="text-2xl">{t('verifyingTitle')}</CardTitle>
          <CardDescription>{t('verifyingDescription')}</CardDescription>
        </CardHeader>
      )}

      {state === 'success-merchant' && (
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>
          <CardTitle className="text-2xl">{t('verifySuccessTitle')}</CardTitle>
          <CardDescription className="text-base">
            {t('verifySuccessRedirecting')}
          </CardDescription>
        </CardHeader>
      )}

      {state === 'success-consumer' && (
        <>
          <CardHeader className="space-y-3 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <CardTitle className="text-2xl">{t('verifySuccessTitle')}</CardTitle>
            <CardDescription className="text-base leading-relaxed">
              {t('verifySuccessConsumer')}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-3 pt-2">
            <p className="text-sm font-medium text-muted-foreground">
              {t('verifySuccessOpenApp')}
            </p>
            {/* Google Play */}
            <a
              href={process.env.NEXT_PUBLIC_PLAY_STORE_URL ?? '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full max-w-[200px] items-center gap-3 rounded-xl bg-black px-4 py-2.5 transition-opacity hover:opacity-80"
              aria-label="Get it on Google Play"
            >
              <Image
                src="/images/image.svg"
                alt=""
                width={20}
                height={20}
                className="brightness-0 invert shrink-0"
              />
              <div className="leading-tight text-white">
                <div className="text-[9px] font-normal uppercase tracking-wide">GET IT ON</div>
                <div className="text-sm font-semibold">Google Play</div>
              </div>
            </a>
            {/* App Store */}
            <a
              href={process.env.NEXT_PUBLIC_APP_STORE_URL ?? '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full max-w-[200px] items-center gap-3 rounded-xl bg-black px-4 py-2.5 transition-opacity hover:opacity-80"
              aria-label="Download on the App Store"
            >
              <svg
                className="h-5 w-5 shrink-0 text-white"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
              </svg>
              <div className="leading-tight text-white">
                <div className="text-[9px] font-normal uppercase tracking-wide">DOWNLOAD ON THE</div>
                <div className="text-sm font-semibold">App Store</div>
              </div>
            </a>
          </CardContent>
        </>
      )}

      {state === 'error' && (
        <>
          <CardHeader className="space-y-3 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
              <XCircle className="h-8 w-8 text-red-600" />
            </div>
            <CardTitle className="text-2xl">{t('verifyFailedTitle')}</CardTitle>
            <CardDescription className="text-base">
              {errorMessage || t('verifyError')}
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex justify-center">
            <Link
              href="/login"
              className="inline-flex items-center justify-center text-sm text-primary hover:underline font-medium"
            >
              {t('backToLogin')}
            </Link>
          </CardFooter>
        </>
      )}
    </Card>
  );
}

// ── Page export — covers auth layout (fixed overlay), wraps inner in Suspense ──
export default function VerifyCallbackPage() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <Suspense
          fallback={
            <Card>
              <CardHeader className="space-y-3 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center">
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                </div>
              </CardHeader>
            </Card>
          }
        >
          <VerifyCallbackInner />
        </Suspense>
      </div>
    </div>
  );
}
