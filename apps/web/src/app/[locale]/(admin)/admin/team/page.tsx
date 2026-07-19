'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import {
  Users,
  Shield,
  ShieldCheck,
  UserPlus,
  MoreHorizontal,
  Trash2,
  Key,
  ArrowUpDown,
  Copy,
  Check,
} from 'lucide-react';
import {
  Button,
  Badge,
  Avatar,
  AvatarFallback,
  Sheet,
  SheetContent,
  SheetTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Separator,
} from '@foodwaste/ui';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmActionDialog } from '@/components/dashboard/admin/confirm-action-dialog';
import {
  useTeamMembers,
  useInviteTeamMember,
  useUpdateTeamMemberRole,
  useUpdateTeamMemberPermissions,
  useRemoveTeamMember,
} from '@/hooks/use-admin';
import type {
  TeamMemberRow,
  TeamSearchParams,
  AdminPermission,
  InviteTeamMemberPayload,
} from '@/types/admin';

// ─── Permission grouping ─────────────────────────────────────────────────────

const PERMISSION_GROUPS: Record<string, AdminPermission[]> = {
  users: ['users:view', 'users:edit', 'users:suspend', 'users:delete'],
  establishments: ['establishments:view', 'establishments:approve', 'establishments:suspend'],
  orders: ['orders:view', 'orders:cancel', 'orders:refund'],
  offers: ['offers:view', 'offers:edit', 'offers:feature', 'offers:delete'],
  moderation: ['moderation:view', 'moderation:action'],
  analytics: ['analytics:view', 'analytics:export'],
  notifications: ['notifications:view', 'notifications:broadcast'],
  payments: ['payments:view', 'payments:refund'],
  voting: ['voting:view', 'voting:manage'],
  system: ['system:config', 'team:manage', 'audit:view'],
};

// ─── Page ────────────────────────────────────────────────────────────────────

export default function TeamManagementPage() {
  const t = useTranslations('adminTeam');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [page] = useState(1);

  const params: TeamSearchParams = {
    page,
    limit: 50,
    ...(search ? { search } : {}),
    ...(roleFilter !== 'all' ? { role: roleFilter as 'admin' | 'moderator' } : {}),
  };

  const { data: members, isLoading } = useTeamMembers(params);

  return (
    <div className='space-y-6 p-6'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-semibold'>{t('title')}</h1>
          <p className='text-sm text-muted-foreground'>{t('subtitle')}</p>
        </div>
        <InviteDialog />
      </div>

      {/* Filters */}
      <div className='flex items-center gap-2'>
        <Input
          placeholder={t('searchPlaceholder')}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className='h-9 max-w-[220px] text-sm'
        />
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className='h-9 w-[140px] text-sm'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>{t('allRoles')}</SelectItem>
            <SelectItem value='admin'>{t('admin')}</SelectItem>
            <SelectItem value='moderator'>{t('moderator')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Members list */}
      {isLoading ? (
        <TeamSkeleton />
      ) : !members || members.length === 0 ? (
        <EmptyState />
      ) : (
        <div className='rounded-md border'>
          <div className='grid grid-cols-[1fr_120px_180px_120px_80px] gap-4 p-3 border-b bg-muted/50 text-xs font-medium text-muted-foreground'>
            <span>Member</span>
            <span>{t('role')}</span>
            <span>{t('permissions')}</span>
            <span>{t('lastLogin')}</span>
            <span>{t('actions')}</span>
          </div>
          {members.map(member => (
            <MemberRow key={member._id} member={member} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Member Row ──────────────────────────────────────────────────────────────

function MemberRow({ member }: { member: TeamMemberRow }) {
  const t = useTranslations('adminTeam');
  const [permissionsOpen, setPermissionsOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const updateRole = useUpdateTeamMemberRole();
  const removeMember = useRemoveTeamMember();

  const handleChangeRole = useCallback(() => {
    const newRole = member.role === 'admin' ? 'moderator' : 'admin';
    updateRole.mutate({ id: member._id, payload: { role: newRole } });
  }, [member, updateRole]);

  const initials = `${member.firstName[0] ?? ''}${member.lastName[0] ?? ''}`.toUpperCase();

  return (
    <>
      <div className='grid grid-cols-[1fr_120px_180px_120px_80px] gap-4 p-3 border-b last:border-0 items-center'>
        {/* Name & email */}
        <div className='flex items-center gap-3 min-w-0'>
          <Avatar className='size-8 shrink-0'>
            <AvatarFallback className='text-xs'>{initials}</AvatarFallback>
          </Avatar>
          <div className='min-w-0'>
            <p className='text-sm font-medium truncate'>
              {member.firstName} {member.lastName}
            </p>
            <p className='text-xs text-muted-foreground truncate'>{member.email}</p>
          </div>
        </div>

        {/* Role badge */}
        <div>
          <Badge variant={member.role === 'admin' ? 'default' : 'secondary'} className='capitalize'>
            {member.role === 'admin' ? (
              <ShieldCheck className='size-3 me-1' />
            ) : (
              <Shield className='size-3 me-1' />
            )}
            {t(member.role)}
          </Badge>
        </div>

        {/* Permissions count */}
        <div className='text-sm text-muted-foreground'>
          {member.permissions.length} {t('permissions').toLowerCase()}
        </div>

        {/* Last login */}
        <div className='text-xs text-muted-foreground'>
          {member.lastLoginAt ? new Date(member.lastLoginAt).toLocaleDateString() : t('never')}
        </div>

        {/* Actions */}
        <div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant='ghost' size='icon' className='size-8'>
                <MoreHorizontal className='size-4' />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end'>
              <DropdownMenuItem onClick={() => setPermissionsOpen(true)}>
                <Key className='size-4 me-2' />
                {t('editPermissions')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleChangeRole}>
                <ArrowUpDown className='size-4 me-2' />
                {t('changeRole')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setRemoveOpen(true)} className='text-destructive'>
                <Trash2 className='size-4 me-2' />
                {t('remove')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Permissions Sheet */}
      <PermissionsSheet member={member} open={permissionsOpen} onOpenChange={setPermissionsOpen} />

      {/* Remove confirm */}
      <ConfirmActionDialog
        open={removeOpen}
        onOpenChange={setRemoveOpen}
        title={t('removeConfirmTitle')}
        description={t('removeConfirmDesc')}
        confirmLabel={t('remove')}
        variant='danger'
        isLoading={removeMember.isPending}
        onConfirm={() => {
          removeMember.mutate(member._id, { onSuccess: () => setRemoveOpen(false) });
        }}
      />
    </>
  );
}

// ─── Permissions Sheet ───────────────────────────────────────────────────────

function PermissionsSheet({
  member,
  open,
  onOpenChange,
}: {
  member: TeamMemberRow;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const t = useTranslations('adminTeam');
  const [selected, setSelected] = useState<Set<string>>(new Set(member.permissions));
  const updatePermissions = useUpdateTeamMemberPermissions();

  const toggle = (perm: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(perm)) next.delete(perm);
      else next.add(perm);
      return next;
    });
  };

  const handleSave = () => {
    updatePermissions.mutate(
      { id: member._id, payload: { permissions: [...selected] as AdminPermission[] } },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  const allPerms = Object.values(PERMISSION_GROUPS).flat();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='overflow-y-auto'>
        <SheetTitle>{t('permissionsDialog.title')}</SheetTitle>
        <p className='text-sm text-muted-foreground mb-4'>{t('permissionsDialog.desc')}</p>

        <div className='flex gap-2 mb-4'>
          <Button variant='outline' size='sm' onClick={() => setSelected(new Set(allPerms))}>
            {t('permissionsDialog.selectAll')}
          </Button>
          <Button variant='outline' size='sm' onClick={() => setSelected(new Set())}>
            {t('permissionsDialog.deselectAll')}
          </Button>
        </div>

        <div className='space-y-4'>
          {Object.entries(PERMISSION_GROUPS).map(([group, perms]) => (
            <div key={group}>
              <h4 className='text-sm font-medium mb-2 capitalize'>
                {t(`permissionGroups.${group}` as Parameters<typeof t>[0])}
              </h4>
              <div className='space-y-2 ps-2'>
                {perms.map(perm => (
                  <label key={perm} className='flex items-center gap-2 text-sm cursor-pointer'>
                    <input
                      type='checkbox'
                      checked={selected.has(perm)}
                      onChange={() => toggle(perm)}
                      className='size-4 rounded border-border accent-primary'
                    />
                    <span>{t(`permissionLabels.${perm}` as Parameters<typeof t>[0])}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        <Separator className='my-4' />

        <Button
          size='sm'
          onClick={handleSave}
          disabled={updatePermissions.isPending}
          className='w-full'
        >
          {t('permissionsDialog.save')}
        </Button>
      </SheetContent>
    </Sheet>
  );
}

// ─── Invite Dialog ───────────────────────────────────────────────────────────

function InviteDialog() {
  const t = useTranslations('adminTeam');
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState<'admin' | 'moderator'>('moderator');
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const invite = useInviteTeamMember();

  const handleSubmit = () => {
    const payload: InviteTeamMemberPayload = {
      email,
      firstName,
      lastName,
      role,
    };
    invite.mutate(payload, {
      onSuccess: data => {
        setTempPassword(data.temporaryPassword);
      },
    });
  };

  const handleCopy = async () => {
    if (tempPassword) {
      await navigator.clipboard.writeText(tempPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setEmail('');
    setFirstName('');
    setLastName('');
    setRole('moderator');
    setTempPassword(null);
    setCopied(false);
    invite.reset();
  };

  return (
    <Dialog open={open} onOpenChange={v => (v ? setOpen(true) : handleClose())}>
      <DialogTrigger asChild>
        <Button size='sm'>
          <UserPlus className='size-3.5 me-1.5' />
          {t('invite')}
        </Button>
      </DialogTrigger>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>{t('inviteDialog.title')}</DialogTitle>
          <DialogDescription>{t('inviteDialog.desc')}</DialogDescription>
        </DialogHeader>

        {tempPassword ? (
          <div className='space-y-4 py-2'>
            <div className='rounded-md bg-muted p-4 text-center'>
              <p className='text-sm text-muted-foreground mb-1'>{t('inviteDialog.tempPassword')}</p>
              <p className='font-mono text-lg font-semibold'>{tempPassword}</p>
            </div>
            <p className='text-xs text-muted-foreground'>{t('inviteDialog.tempPasswordNote')}</p>
            <div className='flex gap-2'>
              <Button variant='outline' size='sm' className='flex-1' onClick={handleCopy}>
                {copied ? (
                  <Check className='size-3.5 me-1.5' />
                ) : (
                  <Copy className='size-3.5 me-1.5' />
                )}
                {copied ? t('inviteDialog.copied') : t('inviteDialog.copyPassword')}
              </Button>
              <Button size='sm' className='flex-1' onClick={handleClose}>
                {t('inviteDialog.close')}
              </Button>
            </div>
          </div>
        ) : (
          <div className='space-y-3 py-2'>
            <div className='space-y-1'>
              <Label className='text-xs'>{t('inviteDialog.email')}</Label>
              <Input
                type='email'
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder='team@example.com'
                className='h-9 text-sm'
              />
            </div>
            <div className='grid grid-cols-2 gap-3'>
              <div className='space-y-1'>
                <Label className='text-xs'>{t('inviteDialog.firstName')}</Label>
                <Input
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  className='h-9 text-sm'
                />
              </div>
              <div className='space-y-1'>
                <Label className='text-xs'>{t('inviteDialog.lastName')}</Label>
                <Input
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  className='h-9 text-sm'
                />
              </div>
            </div>
            <div className='space-y-1'>
              <Label className='text-xs'>{t('inviteDialog.role')}</Label>
              <Select value={role} onValueChange={v => setRole(v as 'admin' | 'moderator')}>
                <SelectTrigger className='h-9 text-sm'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='admin'>{t('admin')}</SelectItem>
                  <SelectItem value='moderator'>{t('moderator')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              size='sm'
              className='w-full'
              onClick={handleSubmit}
              disabled={!email || !firstName || !lastName || invite.isPending}
            >
              {t('inviteDialog.send')}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────────

function EmptyState() {
  const t = useTranslations('adminTeam');
  return (
    <div className='flex flex-col items-center justify-center py-16 gap-3 text-center'>
      <Users className='size-12 text-muted-foreground' />
      <h3 className='text-md font-semibold'>{t('noMembers')}</h3>
      <p className='text-sm text-muted-foreground max-w-xs'>{t('noMembersDesc')}</p>
    </div>
  );
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function TeamSkeleton() {
  return (
    <div className='space-y-3'>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className='flex items-center gap-4 p-3'>
          <Skeleton className='size-8 rounded-full' />
          <Skeleton className='h-4 w-40' />
          <Skeleton className='h-4 w-20' />
          <Skeleton className='h-4 w-24' />
          <Skeleton className='h-4 w-16' />
        </div>
      ))}
    </div>
  );
}
