'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { userService } from '@/services/user.service';
import { Input, Button, Label } from '@foodwaste/ui';
import { Lock, Eye, EyeOff, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { PasswordStrengthIndicator } from '@/components/auth/password-strength-indicator';

export default function MerchantSecurityPage() {
  const t = useTranslations('dashboard.merchantSecurity');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (newPassword !== confirmPassword) {
      setError(t('passwordMismatch'));
      return;
    }

    setIsLoading(true);
    try {
      await userService.changePassword(currentPassword, newPassword);
      setSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch {
      setError(t('error'));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className='max-w-md'>
      <div className='mb-xl'>
        <h1 className='font-display text-lg font-semibold text-slate-900'>{t('title')}</h1>
        <p className='text-xs text-slate-500 mt-xxs'>{t('description')}</p>
      </div>

      <form onSubmit={handleSubmit} className='space-y-md'>
        {/* Current Password */}
        <div className='space-y-xs'>
          <Label htmlFor='currentPassword' className='text-xs font-medium text-slate-700'>
            {t('currentPassword')}
          </Label>
          <div className='relative'>
            <Lock className='absolute left-2.5 top-xs/2 h-3.5 w-3.5 -translate-y-xs/2 text-slate-400 pointer-events-none' />
            <Input
              id='currentPassword'
              type={showCurrent ? 'text' : 'password'}
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              required
              disabled={isLoading}
              autoComplete='current-password'
              className='h-[36px] ps-4xl pe-5xl text-sm'
            />
            <button
              type='button'
              onClick={() => setShowCurrent(v => !v)}
              className='absolute right-2.5 top-xs/2 -translate-y-xs/2 text-slate-400 hover:text-slate-600'
              tabIndex={-1}
              aria-label={showCurrent ? 'Hide password' : 'Show password'}
            >
              {showCurrent ? <EyeOff className='h-3.5 w-3.5' /> : <Eye className='h-3.5 w-3.5' />}
            </button>
          </div>
        </div>

        {/* New Password */}
        <div className='space-y-xs'>
          <Label htmlFor='newPassword' className='text-xs font-medium text-slate-700'>
            {t('newPassword')}
          </Label>
          <div className='relative'>
            <Lock className='absolute left-2.5 top-xs/2 h-3.5 w-3.5 -translate-y-xs/2 text-slate-400 pointer-events-none' />
            <Input
              id='newPassword'
              type={showNew ? 'text' : 'password'}
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              required
              disabled={isLoading}
              autoComplete='new-password'
              className='h-[36px] ps-4xl pe-5xl text-sm'
            />
            <button
              type='button'
              onClick={() => setShowNew(v => !v)}
              className='absolute right-2.5 top-xs/2 -translate-y-xs/2 text-slate-400 hover:text-slate-600'
              tabIndex={-1}
              aria-label={showNew ? 'Hide password' : 'Show password'}
            >
              {showNew ? <EyeOff className='h-3.5 w-3.5' /> : <Eye className='h-3.5 w-3.5' />}
            </button>
          </div>
          <PasswordStrengthIndicator password={newPassword} />
        </div>

        {/* Confirm Password */}
        <div className='space-y-xs'>
          <Label htmlFor='confirmPassword' className='text-xs font-medium text-slate-700'>
            {t('confirmPassword')}
          </Label>
          <div className='relative'>
            <Lock className='absolute left-2.5 top-xs/2 h-3.5 w-3.5 -translate-y-xs/2 text-slate-400 pointer-events-none' />
            <Input
              id='confirmPassword'
              type={showConfirm ? 'text' : 'password'}
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
              disabled={isLoading}
              autoComplete='new-password'
              className='h-[36px] ps-4xl pe-5xl text-sm'
            />
            <button
              type='button'
              onClick={() => setShowConfirm(v => !v)}
              className='absolute right-2.5 top-xs/2 -translate-y-xs/2 text-slate-400 hover:text-slate-600'
              tabIndex={-1}
              aria-label={showConfirm ? 'Hide password' : 'Show password'}
            >
              {showConfirm ? <EyeOff className='h-3.5 w-3.5' /> : <Eye className='h-3.5 w-3.5' />}
            </button>
          </div>
        </div>

        {/* Feedback */}
        {error && (
          <div className='flex items-center gap-sm rounded-lg border border-destructive/30 bg-destructive/5 px-md py-sm text-xs text-destructive'>
            <AlertCircle className='h-3.5 w-3.5 shrink-0' />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className='flex items-center gap-sm rounded-lg border border-green-200 bg-green-50 px-md py-sm text-xs text-green-700'>
            <CheckCircle2 className='h-3.5 w-3.5 shrink-0' />
            <span>{t('success')}</span>
          </div>
        )}

        <Button type='submit' disabled={isLoading} className='mt-xs h-[36px] px-lg text-sm'>
          {isLoading && <Loader2 className='me-1.5 h-3.5 w-3.5 animate-spin' />}
          {isLoading ? t('updating') : t('updatePassword')}
        </Button>
      </form>
    </div>
  );
}
