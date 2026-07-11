'use client';

import { useState, useRef, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import {
  User,
  Shield,
  Monitor,
  Camera,
  Lock,
  ShieldCheck,
  ShieldOff,
  Trash2,
  LogOut,
  AlertCircle,
  Smartphone,
  Globe,
  Laptop,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import Image from 'next/image';
import { toast } from 'sonner';
import {
  useProfile,
  useUpdateProfile,
  useUploadProfileImage,
  useChangePassword,
  useSessions,
  useTerminateSession,
  useLogoutAll,
  useDeleteAccount,
  useMfaStatus,
} from '@/hooks/use-settings';
import type { ActiveSession } from '@/types/settings';

// ─── Skeleton ───────────────────────────────────────────────────────────────

function SettingsSkeleton() {
  return (
    <div className='space-y-6'>
      <div className='glass rounded-2xl p-[24px] shadow-soft space-y-4'>
        <Skeleton className='h-6 w-48' />
        <Skeleton className='h-4 w-64' />
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4 pt-4'>
          <Skeleton className='h-10 w-full' />
          <Skeleton className='h-10 w-full' />
          <Skeleton className='h-10 w-full' />
          <Skeleton className='h-10 w-full' />
        </div>
        <Skeleton className='h-10 w-32 mt-4' />
      </div>
    </div>
  );
}

// ─── Error state ────────────────────────────────────────────────────────────

function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className='glass rounded-2xl p-[24px] shadow-soft'>
      <div className='flex flex-col items-center justify-center py-10 gap-3 text-center'>
        <AlertCircle className='size-12 text-muted-foreground' />
        <p className='text-sm text-muted-foreground'>{message}</p>
        {onRetry && (
          <Button variant='outline' size='sm' onClick={onRetry}>
            Retry
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Profile Tab ────────────────────────────────────────────────────────────

function ProfileTab() {
  const t = useTranslations('dashboard.settings');
  const { data: profile, isLoading, isError, refetch } = useProfile();
  const updateProfile = useUpdateProfile();
  const uploadImage = useUploadProfileImage();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [initialized, setInitialized] = useState(false);

  if (profile && !initialized) {
    setFirstName(profile.firstName || '');
    setLastName(profile.lastName || '');
    setPhone(profile.phoneNumber || '');
    setInitialized(true);
  }

  if (isLoading) return <SettingsSkeleton />;
  if (isError || !profile) {
    return <ErrorState message={t('profile.error')} onRetry={() => void refetch()} />;
  }

  const profileImageUrl = profile.profileImage || profile.avatar || null;
  const initials =
    `${(profile.firstName || '')[0] || ''}${(profile.lastName || '')[0] || ''}`.toUpperCase();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    updateProfile.mutate(
      {
        ...(firstName ? { firstName } : {}),
        ...(lastName ? { lastName } : {}),
        ...(phone ? { phoneNumber: phone } : {}),
      },
      {
        onSuccess: () => toast.success(t('profile.saved')),
        onError: () => toast.error(t('profile.error')),
      },
    );
  }

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadImage.mutate(file, {
      onSuccess: () => toast.success(t('profile.saved')),
      onError: () => toast.error(t('profile.error')),
    });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className='glass rounded-2xl p-[24px] shadow-soft'>
        <h2 className='font-display text-xl text-primary-500 font-semibold'>
          {t('profile.title')}
        </h2>
        <p className='text-sm text-muted-foreground mt-1'>{t('profile.subtitle')}</p>

        {/* Avatar section */}
        <div className='flex items-center gap-4 mt-6'>
          <div className='relative'>
            {profileImageUrl ? (
              <Image
                src={profileImageUrl}
                alt={t('profile.avatar')}
                width={64}
                height={64}
                className='size-16 rounded-xl object-cover ring-2 ring-primary-500/10'
              />
            ) : (
              <div className='size-16 rounded-xl bg-primary-500/10 flex items-center justify-center text-primary-500 font-semibold text-lg'>
                {initials}
              </div>
            )}
            <button
              type='button'
              onClick={() => fileInputRef.current?.click()}
              className='absolute -bottom-1 -end-1 size-7 rounded-full bg-primary-500 text-white flex items-center justify-center shadow-md hover:bg-primary-500/90 transition-colors'
            >
              <Camera className='size-3.5' />
            </button>
            <input
              ref={fileInputRef}
              type='file'
              accept='image/*'
              className='hidden'
              onChange={handleImageUpload}
            />
          </div>
          <div>
            <p className='text-sm font-medium'>
              {profile.firstName} {profile.lastName}
            </p>
            <p className='text-xs text-muted-foreground'>{profile.email}</p>
            {profile.authProvider !== 'local' && (
              <Badge variant='secondary' className='mt-1 text-xs'>
                {t('profile.authProvider', { provider: profile.authProvider })}
              </Badge>
            )}
          </div>
        </div>

        <Separator className='my-6' />

        {/* Profile form */}
        <form onSubmit={handleSubmit} className='space-y-4'>
          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            <div className='space-y-2'>
              <Label htmlFor='firstName'>{t('profile.firstName')}</Label>
              <Input
                id='firstName'
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='lastName'>{t('profile.lastName')}</Label>
              <Input id='lastName' value={lastName} onChange={e => setLastName(e.target.value)} />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='email'>{t('profile.email')}</Label>
              <Input id='email' value={profile.email} disabled className='bg-muted' />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='phone'>{t('profile.phone')}</Label>
              <Input id='phone' value={phone} onChange={e => setPhone(e.target.value)} type='tel' />
            </div>
          </div>

          <Button
            type='submit'
            disabled={updateProfile.isPending}
            className='bg-primary-500 hover:bg-primary-500/90 text-white'
          >
            {updateProfile.isPending ? t('profile.saving') : t('profile.save')}
          </Button>
        </form>
      </div>
    </motion.div>
  );
}

// ─── Security Tab ───────────────────────────────────────────────────────────

function SecurityTab() {
  const t = useTranslations('dashboard.settings');
  const { data: profile, isLoading: profileLoading } = useProfile();
  const { data: mfaStatus } = useMfaStatus();
  const changePassword = useChangePassword();
  const logoutAll = useLogoutAll();
  const deleteAccount = useDeleteAccount();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  if (profileLoading) return <SettingsSkeleton />;

  const isOAuth = profile?.authProvider !== 'local';

  function handleChangePassword(e: FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error(t('security.passwordMismatch'));
      return;
    }
    changePassword.mutate(
      { currentPassword, newPassword },
      {
        onSuccess: () => {
          toast.success(t('security.passwordChanged'));
          setCurrentPassword('');
          setNewPassword('');
          setConfirmPassword('');
        },
        onError: () => toast.error(t('security.passwordError')),
      },
    );
  }

  function handleLogoutAll() {
    logoutAll.mutate(undefined, {
      onSuccess: () => {
        toast.success(t('security.logoutAllConfirm'));
      },
    });
  }

  function handleDeleteAccount() {
    deleteAccount.mutate(undefined, {
      onSuccess: () => {
        window.location.href = '/';
      },
    });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className='space-y-6'
    >
      {/* Password change section */}
      <div className='glass rounded-2xl p-[24px] shadow-soft'>
        <div className='flex items-center gap-3 mb-1'>
          <Lock className='size-5 text-primary-500' />
          <h2 className='font-display text-xl text-primary-500 font-semibold'>
            {t('security.changePassword')}
          </h2>
        </div>
        <p className='text-sm text-muted-foreground mb-6'>{t('security.subtitle')}</p>

        {isOAuth ? (
          <div className='flex items-center gap-3 rounded-xl bg-muted/50 p-4'>
            <AlertCircle className='size-5 text-muted-foreground shrink-0' />
            <p className='text-sm text-muted-foreground'>
              {t('security.oauthNote', { provider: profile?.authProvider || '' })}
            </p>
          </div>
        ) : (
          <form onSubmit={handleChangePassword} className='space-y-4 max-w-md'>
            <div className='space-y-2'>
              <Label htmlFor='currentPassword'>{t('security.currentPassword')}</Label>
              <Input
                id='currentPassword'
                type='password'
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                required
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='newPassword'>{t('security.newPassword')}</Label>
              <Input
                id='newPassword'
                type='password'
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='confirmPassword'>{t('security.confirmPassword')}</Label>
              <Input
                id='confirmPassword'
                type='password'
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <Button
              type='submit'
              disabled={changePassword.isPending}
              className='bg-primary-500 hover:bg-primary-500/90 text-white'
            >
              {changePassword.isPending ? t('profile.saving') : t('security.changePassword')}
            </Button>
          </form>
        )}
      </div>

      {/* MFA status */}
      <div className='glass rounded-2xl p-[24px] shadow-soft'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-3'>
            {mfaStatus?.enabled ? (
              <ShieldCheck className='size-5 text-emerald-500' />
            ) : (
              <ShieldOff className='size-5 text-muted-foreground' />
            )}
            <div>
              <h3 className='font-semibold text-sm'>{t('security.mfa')}</h3>
              <p className='text-xs text-muted-foreground'>
                {mfaStatus?.enabled ? t('security.mfaEnabled') : t('security.mfaDisabled')}
              </p>
            </div>
          </div>
          <Badge variant={mfaStatus?.enabled ? 'default' : 'secondary'}>
            {mfaStatus?.enabled ? t('security.mfaEnabled') : t('security.mfaDisabled')}
          </Badge>
        </div>
      </div>

      {/* Danger zone */}
      <div className='rounded-2xl border border-destructive/20 bg-destructive/5 p-[24px]'>
        <h3 className='font-semibold text-destructive mb-4'>{t('security.dangerZone')}</h3>
        <div className='space-y-4'>
          {/* Logout all */}
          <div className='flex items-center justify-between'>
            <div>
              <p className='text-sm font-medium'>{t('security.logoutAll')}</p>
              <p className='text-xs text-muted-foreground'>{t('security.logoutAllConfirm')}</p>
            </div>
            <Button
              variant='outline'
              size='sm'
              onClick={handleLogoutAll}
              disabled={logoutAll.isPending}
              className='border-destructive/30 text-destructive hover:bg-destructive/10'
            >
              <LogOut className='size-4 me-2' />
              {t('security.logoutAll')}
            </Button>
          </div>

          <Separator />

          {/* Delete account */}
          <div className='flex items-center justify-between'>
            <div>
              <p className='text-sm font-medium text-destructive'>{t('security.deleteAccount')}</p>
              <p className='text-xs text-muted-foreground'>{t('security.deleteWarning')}</p>
            </div>
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
              <DialogTrigger asChild>
                <Button variant='destructive' size='sm'>
                  <Trash2 className='size-4 me-2' />
                  {t('security.deleteAccount')}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t('security.deleteAccount')}</DialogTitle>
                  <DialogDescription>{t('security.deleteWarning')}</DialogDescription>
                </DialogHeader>
                <div className='space-y-2 py-4'>
                  <Label>{t('security.deleteConfirm')}</Label>
                  <Input
                    value={deleteConfirmText}
                    onChange={e => setDeleteConfirmText(e.target.value)}
                    placeholder='DELETE'
                  />
                </div>
                <DialogFooter>
                  <Button
                    variant='destructive'
                    disabled={deleteConfirmText !== 'DELETE' || deleteAccount.isPending}
                    onClick={handleDeleteAccount}
                  >
                    {deleteAccount.isPending ? t('security.deleting') : t('security.deleteAccount')}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Sessions Tab ───────────────────────────────────────────────────────────

function getDeviceIcon(deviceInfo: string | undefined) {
  if (!deviceInfo) return Monitor;
  const lower = deviceInfo.toLowerCase();
  if (lower.includes('mobile') || lower.includes('android') || lower.includes('iphone'))
    return Smartphone;
  if (lower.includes('chrome') || lower.includes('firefox') || lower.includes('safari'))
    return Globe;
  return Laptop;
}

function SessionCard({ session }: { session: ActiveSession }) {
  const t = useTranslations('dashboard.settings.sessions');
  const terminateSession = useTerminateSession();
  const DeviceIcon = getDeviceIcon(session.deviceInfo);

  return (
    <div className='flex items-center justify-between rounded-xl border border-border p-4'>
      <div className='flex items-center gap-3'>
        <div className='size-10 rounded-lg bg-primary-500/[0.08] flex items-center justify-center'>
          <DeviceIcon className='size-5 text-primary-500' />
        </div>
        <div>
          <div className='flex items-center gap-2'>
            <p className='text-sm font-medium'>{session.deviceInfo || 'Unknown Device'}</p>
            {session.isCurrent && (
              <Badge
                variant='default'
                className='text-xs bg-emerald-500/10 text-emerald-600 border-emerald-200'
              >
                {t('currentSession')}
              </Badge>
            )}
          </div>
          <p className='text-xs text-muted-foreground'>
            {session.ipAddress && <span>{session.ipAddress} · </span>}
            {t('lastActive', { date: new Date(session.lastActive).toLocaleDateString() })}
          </p>
        </div>
      </div>
      {!session.isCurrent && (
        <Button
          variant='outline'
          size='sm'
          onClick={() =>
            terminateSession.mutate(session.sessionId, {
              onSuccess: () => toast.success(t('terminateSuccess')),
            })
          }
          disabled={terminateSession.isPending}
          className='text-destructive border-destructive/30 hover:bg-destructive/10'
        >
          {t('terminate')}
        </Button>
      )}
    </div>
  );
}

function SessionsTab() {
  const t = useTranslations('dashboard.settings.sessions');
  const { data: sessions, isLoading, isError, refetch } = useSessions();

  if (isLoading) {
    return (
      <div className='glass rounded-2xl p-[24px] shadow-soft space-y-3'>
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className='h-16 w-full rounded-xl' />
        ))}
      </div>
    );
  }

  if (isError) {
    return <ErrorState message={t('error')} onRetry={() => void refetch()} />;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className='glass rounded-2xl p-[24px] shadow-soft'>
        <h2 className='font-display text-xl text-primary-500 font-semibold'>{t('title')}</h2>
        <p className='text-sm text-muted-foreground mt-1 mb-6'>{t('subtitle')}</p>

        {!sessions || sessions.length === 0 ? (
          <div className='flex flex-col items-center justify-center py-10 gap-3 text-center'>
            <Monitor className='size-12 text-muted-foreground' />
            <p className='text-sm text-muted-foreground'>{t('noSessions')}</p>
          </div>
        ) : (
          <div className='space-y-3'>
            {sessions.map(session => (
              <SessionCard key={session.sessionId} session={session} />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Main Settings Page ─────────────────────────────────────────────────────

export function SettingsPage() {
  const t = useTranslations('dashboard.settings');

  return (
    <div className='space-y-6'>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className='font-display text-3xl md:text-4xl text-primary-500 font-bold'>
          {t('title')}
        </h1>
        <p className='text-sm text-muted-foreground mt-1'>{t('subtitle')}</p>
      </motion.div>

      {/* Tabs */}
      <Tabs defaultValue='profile' className='w-full'>
        <TabsList className='glass shadow-soft mb-6'>
          <TabsTrigger value='profile' className='gap-2'>
            <User className='size-4' />
            {t('tabs.profile')}
          </TabsTrigger>
          <TabsTrigger value='security' className='gap-2'>
            <Shield className='size-4' />
            {t('tabs.security')}
          </TabsTrigger>
          <TabsTrigger value='sessions' className='gap-2'>
            <Monitor className='size-4' />
            {t('tabs.sessions')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value='profile'>
          <ProfileTab />
        </TabsContent>
        <TabsContent value='security'>
          <SecurityTab />
        </TabsContent>
        <TabsContent value='sessions'>
          <SessionsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
