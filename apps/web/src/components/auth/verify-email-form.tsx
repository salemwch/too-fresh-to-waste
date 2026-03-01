'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@foodwaste/ui';
import { Loader2, MailCheck, CheckCircle2, AlertCircle } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { authService } from '@/services/auth.service';

const RESEND_COOLDOWN_SECONDS = 60;

export function VerifyEmailForm() {
  const t = useTranslations('auth');
  const searchParams = useSearchParams();
  const email = searchParams.get('email') ?? '';

  const [isResending, setIsResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleResend = useCallback(async () => {
    if (cooldown > 0 || isResending || !email) return;

    setIsResending(true);
    setFeedback(null);
    try {
      await authService.resendVerification(email);
      setFeedback({ type: 'success', text: t('resendSuccess') });
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch {
      setFeedback({ type: 'error', text: t('resendError') });
    } finally {
      setIsResending(false);
    }
  }, [cooldown, isResending, email, t]);

  return (
    <Card>
      <CardHeader className="space-y-3 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <MailCheck className="h-8 w-8 text-green-600" />
        </div>
        <CardTitle className="text-2xl">{t('checkInboxTitle')}</CardTitle>
        <CardDescription className="text-base leading-relaxed">
          {email
            ? t('checkInboxDescription', { email })
            : t('checkInboxDescriptionGeneric')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-center text-muted-foreground">
          {t('checkSpamHint')}
        </p>
      </CardContent>
      <CardFooter className="flex flex-col gap-3">
        {email && (
          <Button
            variant="outline"
            className="w-full"
            onClick={handleResend}
            disabled={isResending || cooldown > 0}
          >
            {isResending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {cooldown > 0
              ? t('resendCooldown', { seconds: cooldown })
              : t('resendEmail')}
          </Button>
        )}
        {feedback && (
          <div
            className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2.5 text-sm ${
              feedback.type === 'success'
                ? 'border-green-200 bg-green-50 text-green-700'
                : 'border-destructive/30 bg-destructive/5 text-destructive'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
        )}
        <Link
          href="/login"
          className="inline-flex items-center justify-center text-sm text-primary hover:underline font-medium"
        >
          {t('backToLogin')}
        </Link>
      </CardFooter>
    </Card>
  );
}
