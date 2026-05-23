'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useAuthStore } from '@/lib/auth';
import { userService } from '@/services/user.service';
import { Input, Button, Label } from '@foodwaste/ui';
import {
  User,
  Mail,
  Phone,
  Camera,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Trophy,
  Lock,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useUpdateLeaderboardPreference } from '@/hooks/use-merchant-dashboard';

const ACCEPTED_IMAGE_TYPES = 'image/jpeg,image/png,image/webp';
const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB

export default function MerchantProfilePage() {
  const t = useTranslations('dashboard.merchantProfile');
  const user = useAuthStore(s => s.user);
  const setUser = useAuthStore(s => s.setUser);

  const [firstName, setFirstName] = useState(user?.firstName ?? '');
  const [lastName, setLastName] = useState(user?.lastName ?? '');
  const [phone, setPhone] = useState(user?.phoneNumber ?? '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // ── Password state ────────────────────────────────────────────────────────
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);

  const PW_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&.])[A-Za-z\d@$!%*?&.]{8,}$/;

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPwError('');
    setPwSuccess(false);

    if (!PW_REGEX.test(newPassword)) {
      setPwError(t('passwordRequirements'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError(t('passwordMismatch'));
      return;
    }

    setPwLoading(true);
    try {
      await userService.changePassword(newPassword);
      setPwSuccess(true);
      setNewPassword('');
      setConfirmPassword('');
    } catch {
      setPwError(t('passwordError'));
    } finally {
      setPwLoading(false);
    }
  }

  const updateLeaderboardPref = useUpdateLeaderboardPreference();
  const isPublicOnLeaderboard = user?.leaderboardAnonymous === false;
  const [leaderboardToggleError, setLeaderboardToggleError] = useState(false);

  async function handleLeaderboardToggle() {
    if (!user || updateLeaderboardPref.isPending) return;
    setLeaderboardToggleError(false);
    const newAnonymous = isPublicOnLeaderboard; // currently public → make anonymous, and vice versa
    setUser({ ...user, leaderboardAnonymous: newAnonymous });
    try {
      await updateLeaderboardPref.mutateAsync(newAnonymous);
    } catch {
      setUser({ ...user, leaderboardAnonymous: !newAnonymous });
      setLeaderboardToggleError(true);
    }
  }

  // ── Avatar state ──────────────────────────────────────────────────────────
  const [isUploading, setIsUploading] = useState(false);
  const [avatarImgFailed, setAvatarImgFailed] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  const [avatarSuccess, setAvatarSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const avatarSrc = user?.profileImage ?? null;
  const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(' ');
  const initials = displayName
    .split(' ')
    .slice(0, 2)
    .map(p => p[0]?.toUpperCase() ?? '')
    .join('');

  async function handleAvatarSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // reset so the same file can be re-selected
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setAvatarError(t('avatarTypeError'));
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setAvatarError(t('avatarSizeError'));
      return;
    }

    setAvatarError('');
    setAvatarSuccess(false);
    setIsUploading(true);

    try {
      const res = await userService.uploadAvatar(file);
      const { profileImage } = res.data.data;
      setUser({ ...user!, profileImage });
      setAvatarSuccess(true);
    } catch {
      setAvatarError(t('avatarError'));
    } finally {
      setIsUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setIsLoading(true);

    try {
      const res = await userService.updateProfile({ firstName, lastName, phone });
      const updated = res.data.data;
      const updatedUser = { ...user!, firstName: updated.firstName, lastName: updated.lastName };
      if (updated.phoneNumber) updatedUser.phoneNumber = updated.phoneNumber;
      setUser(updatedUser);
      setSuccess(true);
    } catch {
      setError(t('error'));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className='max-w-md'>
      <div className='mb-5'>
        <h1 className='font-display text-lg font-semibold text-slate-900'>{t('title')}</h1>
        <p className='text-xs text-slate-500 mt-0.5'>{t('description')}</p>
      </div>

      {/* ── Profile photo ─────────────────────────────────────────────────── */}
      <div className='mb-5 flex items-center gap-4'>
        <button
          type='button'
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          aria-label={t('changePhoto')}
          className='group relative h-16 w-16 shrink-0 overflow-hidden rounded-full border-2 border-slate-200 bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed'
        >
          {avatarSrc && !avatarImgFailed ? (
            <Image
              src={avatarSrc}
              alt={displayName || t('profilePhoto')}
              fill
              sizes='64px'
              className='object-cover'
              onError={() => setAvatarImgFailed(true)}
            />
          ) : (
            <span className='flex h-full w-full items-center justify-center text-lg font-semibold text-slate-400'>
              {initials || <User className='h-6 w-6' />}
            </span>
          )}
          {/* Hover / uploading overlay */}
          <span className='absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100 group-disabled:opacity-0'>
            {isUploading ? (
              <Loader2 className='h-4 w-4 animate-spin text-white' />
            ) : (
              <Camera className='h-4 w-4 text-white' />
            )}
          </span>
        </button>

        <div className='min-w-0'>
          <p className='truncate text-sm font-medium text-slate-900'>
            {displayName || t('noName')}
          </p>
          <button
            type='button'
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className='text-xs text-primary hover:underline disabled:cursor-not-allowed disabled:opacity-50'
          >
            {isUploading ? t('uploading') : t('changePhoto')}
          </button>
          <p className='mt-0.5 text-[11px] text-slate-400'>{t('avatarHint')}</p>
        </div>

        <input
          ref={fileInputRef}
          type='file'
          accept={ACCEPTED_IMAGE_TYPES}
          aria-hidden='true'
          className='sr-only'
          onChange={handleAvatarSelect}
        />
      </div>

      {/* Avatar feedback */}
      {avatarError && (
        <div className='mb-3 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive'>
          <AlertCircle className='h-3.5 w-3.5 shrink-0' />
          <span>{avatarError}</span>
        </div>
      )}
      {avatarSuccess && (
        <div className='mb-3 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700'>
          <CheckCircle2 className='h-3.5 w-3.5 shrink-0' />
          <span>{t('avatarSuccess')}</span>
        </div>
      )}

      {/* ── Profile fields form ────────────────────────────────────────────── */}
      <form onSubmit={handleSubmit} className='space-y-3'>
        {/* First Name */}
        <div className='space-y-1'>
          <Label htmlFor='firstName' className='text-xs font-medium text-slate-700'>
            {t('firstName')}
          </Label>
          <div className='relative'>
            <User className='absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 pointer-events-none' />
            <Input
              id='firstName'
              value={firstName}
              onChange={e => setFirstName(e.target.value)}
              required
              disabled={isLoading}
              className='h-[36px] pl-8 text-sm'
            />
          </div>
        </div>

        {/* Last Name */}
        <div className='space-y-1'>
          <Label htmlFor='lastName' className='text-xs font-medium text-slate-700'>
            {t('lastName')}
          </Label>
          <div className='relative'>
            <User className='absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 pointer-events-none' />
            <Input
              id='lastName'
              value={lastName}
              onChange={e => setLastName(e.target.value)}
              required
              disabled={isLoading}
              className='h-[36px] pl-8 text-sm'
            />
          </div>
        </div>

        {/* Email — read only */}
        <div className='space-y-1'>
          <Label htmlFor='email' className='text-xs font-medium text-slate-700'>
            {t('email')}
          </Label>
          <div className='relative'>
            <Mail className='absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 pointer-events-none' />
            <Input
              id='email'
              type='email'
              value={user?.email ?? ''}
              readOnly
              disabled
              className='h-[36px] pl-8 text-sm bg-slate-50 text-slate-500 cursor-not-allowed'
            />
          </div>
          <p className='text-[11px] text-slate-400'>{t('emailReadOnly')}</p>
        </div>

        {/* Phone */}
        <div className='space-y-1'>
          <Label htmlFor='phone' className='text-xs font-medium text-slate-700'>
            {t('phone')}
          </Label>
          <div className='relative'>
            <Phone className='absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 pointer-events-none' />
            <Input
              id='phone'
              type='tel'
              value={phone}
              onChange={e => setPhone(e.target.value)}
              disabled={isLoading}
              className='h-[36px] pl-8 text-sm'
            />
          </div>
        </div>

        {/* Form feedback */}
        {error && (
          <div className='flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive'>
            <AlertCircle className='h-3.5 w-3.5 shrink-0' />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className='flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700'>
            <CheckCircle2 className='h-3.5 w-3.5 shrink-0' />
            <span>{t('success')}</span>
          </div>
        )}

        <Button type='submit' disabled={isLoading} className='mt-1 h-[36px] px-4 text-sm'>
          {isLoading && <Loader2 className='mr-1.5 h-3.5 w-3.5 animate-spin' />}
          {isLoading ? t('saving') : t('saveChanges')}
        </Button>
      </form>

      {/* ── Change password ───────────────────────────────────────────────── */}
      <div className='mt-6 pt-5 border-t border-slate-100'>
        <div className='flex items-center gap-2 mb-3'>
          <Lock className='h-3.5 w-3.5 text-slate-400' />
          <span className='text-xs font-medium text-slate-700'>{t('changePassword')}</span>
        </div>

        <form onSubmit={handlePasswordSubmit} className='space-y-3'>
          {/* New password */}
          <div className='space-y-1'>
            <Label htmlFor='newPassword' className='text-xs font-medium text-slate-700'>
              {t('newPassword')}
            </Label>
            <div className='relative'>
              <Lock className='absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 pointer-events-none' />
              <Input
                id='newPassword'
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                required
                disabled={pwLoading}
                className='h-[36px] pl-8 pr-9 text-sm'
                autoComplete='new-password'
              />
              <button
                type='button'
                onClick={() => setShowNew(v => !v)}
                className='absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600'
                aria-label={showNew ? t('hidePassword') : t('showPassword')}
              >
                {showNew ? <EyeOff className='h-3.5 w-3.5' /> : <Eye className='h-3.5 w-3.5' />}
              </button>
            </div>
          </div>

          {/* Confirm password */}
          <div className='space-y-1'>
            <Label htmlFor='confirmPassword' className='text-xs font-medium text-slate-700'>
              {t('confirmPassword')}
            </Label>
            <div className='relative'>
              <Lock className='absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 pointer-events-none' />
              <Input
                id='confirmPassword'
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
                disabled={pwLoading}
                className='h-[36px] pl-8 pr-9 text-sm'
                autoComplete='new-password'
              />
              <button
                type='button'
                onClick={() => setShowConfirm(v => !v)}
                className='absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600'
                aria-label={showConfirm ? t('hidePassword') : t('showPassword')}
              >
                {showConfirm ? <EyeOff className='h-3.5 w-3.5' /> : <Eye className='h-3.5 w-3.5' />}
              </button>
            </div>
          </div>

          <p className='text-[11px] text-slate-400'>{t('passwordRequirementsHint')}</p>

          {/* Feedback */}
          {pwError && (
            <div className='flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive'>
              <AlertCircle className='h-3.5 w-3.5 shrink-0' />
              <span>{pwError}</span>
            </div>
          )}
          {pwSuccess && (
            <div className='flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700'>
              <CheckCircle2 className='h-3.5 w-3.5 shrink-0' />
              <span>{t('passwordSuccess')}</span>
            </div>
          )}

          <Button type='submit' disabled={pwLoading} className='h-[36px] px-4 text-sm'>
            {pwLoading && <Loader2 className='mr-1.5 h-3.5 w-3.5 animate-spin' />}
            {pwLoading ? t('updatingPassword') : t('updatePassword')}
          </Button>
        </form>
      </div>

      {/* ── Leaderboard preference ─────────────────────────────────────────── */}
      <div className='mt-6 pt-5 border-t border-slate-100'>
        <div className='flex items-center gap-2 mb-3'>
          <Trophy className='h-3.5 w-3.5 text-slate-400' />
          <span className='text-xs font-medium text-slate-700'>Leaderboard</span>
        </div>
        <button
          type='button'
          onClick={handleLeaderboardToggle}
          disabled={user?.leaderboardAnonymous === null || user?.leaderboardAnonymous === undefined}
          className='w-full flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-left hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
        >
          <div>
            <div className='text-xs font-medium text-slate-800'>Show my real name and photo</div>
            <div className='text-[11px] text-slate-400 mt-0.5'>
              Appears in the merchant rankings leaderboard
            </div>
          </div>
          <div
            className={`relative h-[24px] w-[42px] rounded-full transition-colors duration-200 shrink-0 ${
              isPublicOnLeaderboard ? 'bg-primary-500' : 'bg-slate-200'
            }`}
          >
            <div
              className={`absolute top-[4px] left-[4px] h-[16px] w-[16px] rounded-full bg-white shadow-sm transition-transform duration-200 ${
                isPublicOnLeaderboard ? 'translate-x-[18px]' : 'translate-x-0'
              }`}
            />
          </div>
        </button>
        {(user?.leaderboardAnonymous === null || user?.leaderboardAnonymous === undefined) && (
          <p className='mt-1.5 text-[11px] text-slate-400'>
            Visit the Leaderboard page to set your initial preference.
          </p>
        )}
        {leaderboardToggleError && (
          <p className='mt-1.5 text-[11px] text-red-500'>
            Failed to save preference. Please try again.
          </p>
        )}
      </div>
    </div>
  );
}
