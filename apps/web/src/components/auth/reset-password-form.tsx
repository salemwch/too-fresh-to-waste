'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import {
  Button,
  Input,
  Label,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@foodwaste/ui';
import { Eye, EyeOff, Lock, Loader2, AlertCircle } from 'lucide-react';
import { PasswordStrengthIndicator } from './password-strength-indicator';
import { authService } from '@/services/auth.service';

export function ResetPasswordForm() {
  const t = useTranslations('auth');
  const router = useRouter();
  const locale = useLocale();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
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
      // Redirect is the success feedback — no toast needed
      router.push(`/${locale}/login`);
    } catch {
      setError(t('resetPasswordError'));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader className='space-y-1'>
        <CardTitle className='text-2xl'>{t('resetPasswordTitle')}</CardTitle>
        <CardDescription>{t('resetPasswordDescription')}</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className='space-y-4'>
          <div className='space-y-2'>
            <Label htmlFor='password'>{t('newPassword')}</Label>
            <div className='relative'>
              <Lock className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none' />
              <Input
                id='password'
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                disabled={isLoading}
                autoComplete='new-password'
                className='pl-7'
              />
              <button
                type='button'
                onClick={() => setShowPassword(!showPassword)}
                className='absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground'
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className='h-4 w-4' /> : <Eye className='h-4 w-4' />}
              </button>
            </div>
            <PasswordStrengthIndicator password={password} />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='confirmPassword'>{t('confirmPassword')}</Label>
            <div className='relative'>
              <Lock className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none' />
              <Input
                id='confirmPassword'
                type='password'
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
                disabled={isLoading}
                autoComplete='new-password'
                className='pl-7'
              />
            </div>
          </div>
        </CardContent>
        <CardFooter className='flex flex-col gap-4'>
          {error && (
            <div className='flex w-full items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive'>
              <AlertCircle className='h-4 w-4 shrink-0' />
              <span>{error}</span>
            </div>
          )}
          <Button type='submit' className='w-full' disabled={isLoading}>
            {isLoading && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
            {t('resetPasswordButton')}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
