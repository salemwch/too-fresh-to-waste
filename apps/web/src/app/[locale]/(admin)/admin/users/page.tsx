'use client';

import { useState, useCallback, useRef } from 'react';
import { useTranslations } from 'next-intl';
import type { LucideIcon } from 'lucide-react';
import {
  Users,
  UserCheck,
  UserX,
  Clock,
  MoreHorizontal,
  Eye,
  Trash2,
  Activity,
  ShieldAlert,
  LogIn,
  AlertCircle,
  Copy,
  TrendingUp,
  TrendingDown,
  Minus,
  Mail,
  Phone,
  Calendar,
  Hash,
  Shield,
  CheckCircle2,
  XCircle,
  ChevronRight,
} from 'lucide-react';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Sheet,
  SheetContent,
  SheetTitle,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Separator,
} from '@foodwaste/ui';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { UserRole, UserStatus } from '@foodwaste/shared';
import { AdminDataTable, type ColumnDef } from '@/components/dashboard/admin/admin-data-table';
import { StatusBadge } from '@/components/dashboard/admin/status-badge';
import { AdminDetailSheetSkeleton } from '@/components/dashboard/admin/admin-skeletons';
import { ConfirmActionDialog } from '@/components/dashboard/admin/confirm-action-dialog';
import {
  useUserSearch,
  useUserDetail,
  useUpdateUserStatus,
  useUserOverview,
  useUserActivity,
  useDeleteUser,
} from '@/hooks/use-admin';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { resolveProfileImage } from '@/lib/media';
import type { AdminUser, UserSearchParams } from '@/types/admin';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getInitials(first: string, last: string) {
  return `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase();
}

function relativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

// Returns label + semantic color class for the last-activity column
function formatLastActivity(iso: string | undefined): { label: string; dot: string; text: string } {
  if (!iso)
    return { label: 'Never', dot: 'bg-muted-foreground/30', text: 'text-muted-foreground/60' };

  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);

  if (minutes < 60)
    return { label: `${minutes}m ago`, dot: 'bg-[#2E7D32]', text: 'text-[#2E7D32]' };
  if (hours < 24) return { label: `${hours}h ago`, dot: 'bg-[#2E7D32]', text: 'text-[#2E7D32]' };
  if (days === 1) return { label: 'Yesterday', dot: 'bg-emerald-400', text: 'text-foreground' };
  if (days < 7) return { label: `${days}d ago`, dot: 'bg-emerald-400', text: 'text-foreground' };
  if (days < 30)
    return { label: `${days}d ago`, dot: 'bg-amber-400', text: 'text-muted-foreground' };
  if (days < 90)
    return { label: `${Math.floor(days / 30)}mo ago`, dot: 'bg-[#F57C00]', text: 'text-[#F57C00]' };
  return {
    label: `${Math.floor(days / 30)}mo ago`,
    dot: 'bg-destructive/70',
    text: 'text-destructive/70',
  };
}

type ActionType = 'suspend' | 'activate' | 'block' | 'delete';

// ─── Sub-components ───────────────────────────────────────────────────────────

function InfoRow({
  icon: Icon,
  label,
  value,
  badge,
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  badge?: React.ReactNode;
}) {
  return (
    <div className='flex items-center justify-between gap-4'>
      <div className='flex items-center gap-1.5 text-muted-foreground'>
        <Icon className='size-3 shrink-0' />
        <span className='text-xs'>{label}</span>
      </div>
      <div className='flex items-center gap-1.5'>
        <span className='text-xs font-medium'>{value}</span>
        {badge}
      </div>
    </div>
  );
}

function VerifiedBadge({ ok }: { ok: boolean }) {
  return ok ? (
    <CheckCircle2 className='size-3.5 shrink-0 text-[#2E7D32]' />
  ) : (
    <XCircle className='size-3.5 shrink-0 text-muted-foreground/50' />
  );
}

function VerificationCard({
  label,
  ok,
  icon: Icon,
}: {
  label: string;
  ok: boolean;
  icon: LucideIcon;
}) {
  return (
    <div
      className={`flex items-center gap-2.5 rounded-lg border p-3 ${
        ok ? 'border-[#2E7D32]/20 bg-[#2E7D32]/5' : 'border-border/60 bg-muted/20'
      }`}
    >
      <Icon className={`size-4 shrink-0 ${ok ? 'text-[#2E7D32]' : 'text-muted-foreground'}`} />
      <div>
        <p className='text-xs font-medium'>{label}</p>
        <p className={`text-[10px] ${ok ? 'text-[#2E7D32]' : 'text-muted-foreground'}`}>
          {ok ? 'Verified' : 'Not verified'}
        </p>
      </div>
    </div>
  );
}

function AdminActionRow({
  label,
  description,
  colorClass,
  borderClass,
  onClick,
}: {
  label: string;
  description: string;
  colorClass: string;
  borderClass: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center justify-between rounded-lg border px-4 py-3 text-start transition-colors ${borderClass}`}
    >
      <div>
        <p className={`text-sm font-medium ${colorClass}`}>{label}</p>
        <p className='mt-0.5 text-xs text-muted-foreground'>{description}</p>
      </div>
      <ChevronRight className={`size-4 shrink-0 opacity-60 ${colorClass}`} />
    </button>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminUsersPage() {
  const t = useTranslations('dashboard.admin.users');

  const [params, setParams] = useState<UserSearchParams>({ page: 1, limit: 20 });
  const [searchInput, setSearchInput] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [actionDialog, setActionDialog] = useState<{
    open: boolean;
    type: ActionType;
    userId: string;
    userName: string;
  } | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const { data: userList, isLoading } = useUserSearch(params);
  const {
    data: selectedUser,
    isLoading: loadingDetail,
    isError: isUserDetailError,
    refetch: refetchUser,
  } = useUserDetail(selectedUserId);
  const { data: overview } = useUserOverview();
  const { data: userActivity, isLoading: loadingActivity } = useUserActivity(selectedUserId);
  const updateStatus = useUpdateUserStatus();
  const deleteUser = useDeleteUser();

  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setParams(p => {
        const { search: _s, ...rest } = p;
        return { ...rest, page: 1, ...(value ? { search: value } : {}) };
      });
    }, 300);
  }, []);

  function handleRoleFilter(value: string) {
    setParams(p => {
      const { role: _r, ...rest } = p;
      return value !== 'all' ? { ...rest, page: 1, role: value as UserRole } : { ...rest, page: 1 };
    });
  }

  function handleStatusFilter(value: string) {
    setParams(p => {
      const { status: _s, ...rest } = p;
      return value !== 'all'
        ? { ...rest, page: 1, status: value as UserStatus }
        : { ...rest, page: 1 };
    });
  }

  function openAction(user: AdminUser, type: ActionType) {
    setActionDialog({
      open: true,
      type,
      userId: user.id,
      userName: `${user.firstName} ${user.lastName}`,
    });
  }

  function handleConfirmAction(reason?: string) {
    if (!actionDialog) return;

    if (actionDialog.type === 'delete') {
      deleteUser.mutate(
        { userId: actionDialog.userId, reason: reason ?? '' },
        {
          onSuccess: () => {
            setActionDialog(null);
            setSelectedUserId(null);
          },
        },
      );
      return;
    }

    const statusMap: Record<Exclude<ActionType, 'delete'>, UserStatus> = {
      suspend: UserStatus.SUSPENDED,
      activate: UserStatus.ACTIVE,
      block: UserStatus.BLOCKED,
    };
    updateStatus.mutate(
      {
        userId: actionDialog.userId,
        payload: { status: statusMap[actionDialog.type], reason: reason ?? '' },
      },
      { onSuccess: () => setActionDialog(null) },
    );
  }

  const users = userList?.users ?? [];
  const total = userList?.total ?? 0;
  const totalPages = userList?.totalPages ?? 1;

  const columns: ColumnDef<AdminUser>[] = [
    {
      key: 'user',
      header: t('columns.user'),
      render: user => (
        <div className='flex items-center gap-2.5'>
          <Avatar className='size-7 shrink-0'>
            <AvatarImage src={resolveProfileImage(user.profileImage, user.avatar) ?? undefined} />
            <AvatarFallback className='text-[10px]'>
              {getInitials(user.firstName, user.lastName)}
            </AvatarFallback>
          </Avatar>
          <span className='text-xs font-medium'>
            {user.firstName} {user.lastName}
          </span>
        </div>
      ),
    },
    {
      key: 'email',
      header: t('columns.email'),
      render: user => <span className='text-xs text-muted-foreground'>{user.email}</span>,
    },
    {
      key: 'role',
      header: t('columns.role'),
      render: user => <StatusBadge status={user.role} variant='role' />,
    },
    {
      key: 'status',
      header: t('columns.status'),
      render: user => <StatusBadge status={user.status} variant='user' />,
    },
    {
      key: 'lastActivity',
      header: 'Last Activity',
      render: user => {
        const { label, dot, text } = formatLastActivity(user.lastLoginAt);
        return (
          <div className='flex items-center gap-1.5'>
            <span className={`size-1.5 shrink-0 rounded-full ${dot}`} />
            <span className={`text-xs tabular-nums ${text}`}>{label}</span>
          </div>
        );
      },
    },
    {
      key: 'noShows',
      header: 'No-shows',
      render: user => {
        const count = user.noShowCount ?? 0;
        if (count === 0) return <span className='text-xs text-muted-foreground/50'>—</span>;
        return (
          <span
            className={`text-xs font-medium tabular-nums ${count >= 3 ? 'text-rose-600' : 'text-orange-500'}`}
          >
            {count}
          </span>
        );
      },
    },
    {
      key: 'actions',
      header: t('columns.actions'),
      render: user => (
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button variant='ghost' size='sm' className='h-7 w-7 p-0'>
              <MoreHorizontal className='size-3.5' />
              <span className='sr-only'>Actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end' className='w-36'>
            <DropdownMenuItem onClick={() => setSelectedUserId(user.id)}>
              <Eye className='me-2 size-3.5' />
              {t('actions.view')}
            </DropdownMenuItem>
            {user.status !== UserStatus.SUSPENDED && user.status !== UserStatus.BLOCKED && (
              <DropdownMenuItem
                className='text-orange-600'
                onClick={() => openAction(user, 'suspend')}
              >
                <UserX className='me-2 size-3.5' />
                {t('actions.suspend')}
              </DropdownMenuItem>
            )}
            {(user.status === UserStatus.SUSPENDED || user.status === UserStatus.PENDING) && (
              <DropdownMenuItem
                className='text-emerald-600'
                onClick={() => openAction(user, 'activate')}
              >
                <UserCheck className='me-2 size-3.5' />
                {t('actions.activate')}
              </DropdownMenuItem>
            )}
            {user.status !== UserStatus.BLOCKED && (
              <DropdownMenuItem className='text-rose-600' onClick={() => openAction(user, 'block')}>
                <UserX className='me-2 size-3.5' />
                {t('actions.block')}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem className='text-rose-700' onClick={() => openAction(user, 'delete')}>
              <Trash2 className='me-2 size-3.5' />
              {t('actions.delete')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const overviewStats = [
    {
      label: t('totalUsers'),
      value: overview?.totalUsers ?? total,
      icon: Users,
      color: 'text-indigo-600',
    },
    {
      label: 'Active (30d)',
      value: overview?.activeUsers ?? 0,
      icon: UserCheck,
      color: 'text-emerald-600',
    },
    {
      label: t('suspendedUsers'),
      value: overview?.suspendedUsers ?? 0,
      icon: UserX,
      color: 'text-orange-600',
    },
    {
      label: t('pendingUsers'),
      value: overview?.pendingUsers ?? 0,
      icon: Clock,
      color: 'text-amber-600',
    },
  ];

  return (
    <div className='space-y-5'>
      {/* Header + Stats */}
      <div className='flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between'>
        <div>
          <h1 className='text-xl font-bold tracking-tight'>{t('title')}</h1>
          <p className='mt-0.5 text-sm text-muted-foreground'>{t('description')}</p>
        </div>
        <div className='flex flex-wrap gap-3'>
          {overviewStats.map(stat => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.label}
                className='flex items-center gap-1.5 rounded-lg border border-border/60 bg-card px-3 py-1.5'
              >
                <Icon className={`size-3.5 ${stat.color}`} />
                <span className='text-xs font-semibold tabular-nums'>{stat.value}</span>
                <span className='text-xs text-muted-foreground'>{stat.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Table */}
      <AdminDataTable
        columns={columns}
        data={users}
        isLoading={isLoading}
        page={params.page ?? 1}
        totalPages={totalPages}
        total={total}
        onPageChange={p => setParams(prev => ({ ...prev, page: p }))}
        searchValue={searchInput}
        searchPlaceholder={t('searchPlaceholder')}
        onSearchChange={handleSearchChange}
        filterSlot={
          <>
            <Select value={params.role ?? 'all'} onValueChange={handleRoleFilter}>
              <SelectTrigger className='h-7 w-28 text-xs'>
                <SelectValue placeholder={t('filterRole')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>{t('allRoles')}</SelectItem>
                <SelectItem value={UserRole.CONSUMER}>Consumer</SelectItem>
                <SelectItem value={UserRole.MERCHANT}>Merchant</SelectItem>
                <SelectItem value={UserRole.ADMIN}>Admin</SelectItem>
                <SelectItem value={UserRole.MODERATOR}>Moderator</SelectItem>
              </SelectContent>
            </Select>
            <Select value={params.status ?? 'all'} onValueChange={handleStatusFilter}>
              <SelectTrigger className='h-7 w-28 text-xs'>
                <SelectValue placeholder={t('filterStatus')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>{t('allStatuses')}</SelectItem>
                <SelectItem value={UserStatus.ACTIVE}>Active</SelectItem>
                <SelectItem value={UserStatus.PENDING}>Pending</SelectItem>
                <SelectItem value={UserStatus.SUSPENDED}>Suspended</SelectItem>
                <SelectItem value={UserStatus.BLOCKED}>Blocked</SelectItem>
              </SelectContent>
            </Select>
          </>
        }
        emptyIcon={Users}
        emptyTitle={t('empty')}
        emptyDescription={t('emptyDescription')}
      />

      {/* ── User Detail Sheet ─────────────────────────────────────────────── */}
      <Sheet open={!!selectedUserId} onOpenChange={open => !open && setSelectedUserId(null)}>
        {/* w-full overrides the sm:max-w-sm from sheetVariants; xl gives 560 px */}
        <SheetContent className='w-full overflow-y-auto sm:max-w-xl'>
          {/* Always-present title satisfies Radix a11y requirement */}
          <SheetTitle className='sr-only'>User Details</SheetTitle>

          {loadingDetail ? (
            <AdminDetailSheetSkeleton />
          ) : isUserDetailError || !selectedUser ? (
            /* ── Error / empty state ── */
            <div className='flex flex-col items-center justify-center gap-3 py-20 text-center'>
              <AlertCircle className='size-10 text-muted-foreground/40' />
              <p className='text-sm font-medium'>Could not load user details</p>
              <p className='max-w-[220px] text-xs text-muted-foreground'>
                The request may have failed or the user was not found.
              </p>
              <Button variant='outline' size='sm' onClick={() => void refetchUser()}>
                Try again
              </Button>
            </div>
          ) : (
            /* ── Main content ── */
            <div className='space-y-0'>
              {/* Header — bleeds to sheet edges via negative margins */}
              <div className='-mx-6 -mt-6 mb-0 border-b border-border/60 bg-muted/20 px-6 pb-5 pt-5 pe-14'>
                <div className='flex items-start gap-4'>
                  <Avatar className='size-16 shrink-0'>
                    <AvatarImage
                      src={
                        resolveProfileImage(selectedUser.profileImage, selectedUser.avatar) ??
                        undefined
                      }
                    />
                    <AvatarFallback className='text-base font-semibold'>
                      {getInitials(selectedUser.firstName, selectedUser.lastName)}
                    </AvatarFallback>
                  </Avatar>

                  <div className='min-w-0 flex-1 space-y-1'>
                    <p className='text-base font-semibold leading-tight'>
                      {selectedUser.firstName} {selectedUser.lastName}
                    </p>
                    <div className='flex items-center gap-1.5 text-xs text-muted-foreground'>
                      <Mail className='size-3 shrink-0' />
                      <span className='truncate'>{selectedUser.email}</span>
                    </div>
                    {selectedUser.phoneNumber && (
                      <div className='flex items-center gap-1.5 text-xs text-muted-foreground'>
                        <Phone className='size-3 shrink-0' />
                        <span>{selectedUser.phoneNumber}</span>
                      </div>
                    )}
                    <div className='flex flex-wrap gap-1.5 pt-1'>
                      <StatusBadge status={selectedUser.role} variant='role' />
                      <StatusBadge status={selectedUser.status} variant='user' />
                    </div>
                  </div>
                </div>
              </div>

              {/* Tabs — also bleed to edges */}
              <Tabs defaultValue='overview' className='-mx-6'>
                <TabsList className='h-9 w-full rounded-none border-b border-border/60 bg-transparent px-0'>
                  <TabsTrigger
                    value='overview'
                    className='h-full flex-1 rounded-none border-b-2 border-transparent text-xs shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none'
                  >
                    Overview
                  </TabsTrigger>
                  <TabsTrigger
                    value='activity'
                    className='h-full flex-1 rounded-none border-b-2 border-transparent text-xs shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none'
                  >
                    Activity
                  </TabsTrigger>
                  <TabsTrigger
                    value='actions'
                    className='h-full flex-1 rounded-none border-b-2 border-transparent text-xs shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none'
                  >
                    Actions
                  </TabsTrigger>
                </TabsList>

                {/* ── Overview tab ── */}
                <TabsContent value='overview' className='mt-0 space-y-5 px-6 py-5'>
                  {/* Identity */}
                  <section className='space-y-3'>
                    <h3 className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
                      Identity
                    </h3>
                    <div className='space-y-2.5'>
                      <InfoRow
                        icon={Mail}
                        label='Email'
                        value={selectedUser.email}
                        badge={<VerifiedBadge ok={selectedUser.isEmailVerified} />}
                      />
                      <InfoRow
                        icon={Phone}
                        label='Phone'
                        value={selectedUser.phoneNumber ?? '—'}
                        badge={
                          selectedUser.phoneNumber ? (
                            <VerifiedBadge ok={selectedUser.isPhoneVerified} />
                          ) : undefined
                        }
                      />
                      {/* User ID row */}
                      <div className='flex items-center justify-between gap-4'>
                        <div className='flex items-center gap-1.5 text-muted-foreground'>
                          <Hash className='size-3 shrink-0' />
                          <span className='text-xs'>User ID</span>
                        </div>
                        <div className='flex items-center gap-1.5'>
                          <span className='font-mono text-[11px] text-muted-foreground'>
                            …{selectedUser.id.slice(-12)}
                          </span>
                          <button
                            onClick={() => void navigator.clipboard.writeText(selectedUser.id)}
                            className='text-muted-foreground transition-colors hover:text-foreground'
                            aria-label='Copy full user ID'
                          >
                            <Copy className='size-3' />
                          </button>
                        </div>
                      </div>
                    </div>
                  </section>

                  <Separator />

                  {/* Account */}
                  <section className='space-y-3'>
                    <h3 className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
                      Account
                    </h3>
                    <div className='space-y-2.5'>
                      <InfoRow
                        icon={Calendar}
                        label='Member since'
                        value={new Date(selectedUser.createdAt).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      />
                      <InfoRow
                        icon={LogIn}
                        label='Last login'
                        value={
                          selectedUser.lastLoginAt
                            ? relativeDate(selectedUser.lastLoginAt)
                            : 'Never logged in'
                        }
                      />
                      <InfoRow
                        icon={Calendar}
                        label='Profile updated'
                        value={relativeDate(selectedUser.updatedAt)}
                      />
                    </div>
                  </section>

                  <Separator />

                  {/* Verification cards */}
                  <section className='space-y-3'>
                    <h3 className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
                      Verification
                    </h3>
                    <div className='grid grid-cols-2 gap-2'>
                      <VerificationCard
                        label='Email'
                        ok={selectedUser.isEmailVerified}
                        icon={Mail}
                      />
                      <VerificationCard
                        label='Phone'
                        ok={selectedUser.isPhoneVerified}
                        icon={Phone}
                      />
                    </div>
                  </section>
                </TabsContent>

                {/* ── Activity tab ── */}
                <TabsContent value='activity' className='mt-0 px-6 py-5'>
                  {loadingActivity ? (
                    <div className='space-y-3'>
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Skeleton key={i} className='h-14 rounded-lg' />
                      ))}
                    </div>
                  ) : userActivity ? (
                    <div className='space-y-5'>
                      {/* Summary stats grid */}
                      <div className='grid grid-cols-2 gap-2'>
                        {[
                          {
                            label: 'Total Actions',
                            value: userActivity.summary.totalActions,
                            icon: Activity,
                          },
                          {
                            label: 'Status Changes',
                            value: userActivity.summary.statusChanges,
                            icon: UserX,
                          },
                          {
                            label: 'Logins',
                            value: userActivity.summary.loginAttempts,
                            icon: LogIn,
                          },
                          {
                            label: 'Activity Score',
                            value: userActivity.summary.activityScore,
                            icon: Shield,
                          },
                        ].map(({ label, value, icon: Icon }) => (
                          <div
                            key={label}
                            className='rounded-lg border border-border/60 bg-card p-3 text-center'
                          >
                            <Icon className='mx-auto mb-1.5 size-4 text-muted-foreground' />
                            <p className='text-xl font-bold tabular-nums'>{value}</p>
                            <p className='text-[10px] leading-tight text-muted-foreground'>
                              {label}
                            </p>
                          </div>
                        ))}
                      </div>

                      {/* Risk + Trend */}
                      <div className='grid grid-cols-2 gap-2'>
                        <div className='rounded-lg border border-border/60 bg-muted/30 p-3'>
                          <p className='mb-1.5 flex items-center gap-1.5 text-[10px] text-muted-foreground'>
                            <ShieldAlert className='size-3' />
                            Risk Score
                          </p>
                          <p
                            className={`text-2xl font-bold tabular-nums ${
                              userActivity.metrics.riskScore > 60
                                ? 'text-destructive'
                                : userActivity.metrics.riskScore > 30
                                  ? 'text-[#F57C00]'
                                  : 'text-[#2E7D32]'
                            }`}
                          >
                            {userActivity.metrics.riskScore}
                            <span className='text-xs font-normal text-muted-foreground'>/100</span>
                          </p>
                        </div>
                        <div className='rounded-lg border border-border/60 bg-muted/30 p-3'>
                          <p className='mb-1.5 flex items-center gap-1.5 text-[10px] text-muted-foreground'>
                            {userActivity.metrics.activityTrend === 'increasing' ? (
                              <TrendingUp className='size-3 text-emerald-600' />
                            ) : userActivity.metrics.activityTrend === 'decreasing' ? (
                              <TrendingDown className='size-3 text-rose-600' />
                            ) : (
                              <Minus className='size-3' />
                            )}
                            Activity Trend
                          </p>
                          <p
                            className={`text-sm font-semibold capitalize ${
                              userActivity.metrics.activityTrend === 'increasing'
                                ? 'text-emerald-600'
                                : userActivity.metrics.activityTrend === 'decreasing'
                                  ? 'text-rose-600'
                                  : 'text-muted-foreground'
                            }`}
                          >
                            {userActivity.metrics.activityTrend}
                          </p>
                          <p className='mt-0.5 text-[10px] text-muted-foreground'>
                            {userActivity.metrics.averageActionsPerDay.toFixed(1)} avg/day
                          </p>
                        </div>
                      </div>

                      {/* Extra metadata */}
                      <div className='space-y-2 rounded-lg border border-border/60 bg-muted/20 p-3 text-xs'>
                        {userActivity.metrics.mostActiveDay && (
                          <div className='flex justify-between'>
                            <span className='text-muted-foreground'>Most active day</span>
                            <span className='font-medium'>
                              {userActivity.metrics.mostActiveDay}
                            </span>
                          </div>
                        )}
                        {userActivity.summary.lastActivity && (
                          <div className='flex justify-between'>
                            <span className='text-muted-foreground'>Last activity</span>
                            <span className='font-medium'>
                              {relativeDate(userActivity.summary.lastActivity)}
                            </span>
                          </div>
                        )}
                        <div className='flex justify-between'>
                          <span className='text-muted-foreground'>Account age</span>
                          <span className='font-medium'>
                            {userActivity.summary.accountAge} days
                          </span>
                        </div>
                        <div className='flex justify-between'>
                          <span className='text-muted-foreground'>Total events tracked</span>
                          <span className='font-medium tabular-nums'>
                            {userActivity.totalEvents}
                          </span>
                        </div>
                        <div className='flex justify-between'>
                          <span className='text-muted-foreground'>Analysis period</span>
                          <span className='font-medium'>{userActivity.period.days} days</span>
                        </div>
                      </div>

                      {/* Event timeline */}
                      {userActivity.recentEvents.length > 0 && (
                        <div className='space-y-2'>
                          <h4 className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
                            Recent Events
                          </h4>
                          <div className='divide-y divide-border/40 overflow-hidden rounded-lg border border-border/60'>
                            {userActivity.recentEvents.map((ev, i) => {
                              const Icon =
                                ev.type === 'login'
                                  ? LogIn
                                  : ev.type === 'admin_action'
                                    ? ShieldAlert
                                    : ev.type === 'status_change'
                                      ? UserX
                                      : ev.type === 'security_event'
                                        ? Shield
                                        : Activity;
                              const dotColor =
                                ev.severity === 'critical'
                                  ? 'bg-rose-100 text-rose-600'
                                  : ev.severity === 'high'
                                    ? 'bg-orange-100 text-orange-600'
                                    : ev.severity === 'medium'
                                      ? 'bg-amber-100 text-amber-600'
                                      : 'bg-muted text-muted-foreground';
                              return (
                                <div key={i} className='flex items-start gap-2.5 px-3 py-2.5'>
                                  <span
                                    className={`mt-0.5 shrink-0 rounded-full p-1.5 ${dotColor}`}
                                  >
                                    <Icon className='size-3' />
                                  </span>
                                  <div className='min-w-0 flex-1'>
                                    <p className='text-xs font-medium leading-snug'>
                                      {ev.description}
                                    </p>
                                    <p className='mt-0.5 text-[10px] capitalize text-muted-foreground'>
                                      {ev.type.replace(/_/g, ' ')} · {relativeDate(ev.timestamp)}
                                    </p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Audit trail */}
                      {userActivity.auditTrail.length > 0 && (
                        <div className='space-y-2'>
                          <h4 className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
                            Admin Audit Trail
                          </h4>
                          <div className='divide-y divide-border/40 overflow-hidden rounded-lg border border-border/60'>
                            {userActivity.auditTrail.slice(0, 6).map((ev, i) => (
                              <div key={ev.id ?? i} className='px-3 py-2.5'>
                                <div className='flex items-start justify-between gap-2'>
                                  <p className='text-xs font-medium leading-snug'>
                                    {ev.description}
                                  </p>
                                  <span className='shrink-0 text-[10px] text-muted-foreground'>
                                    {relativeDate(ev.timestamp)}
                                  </span>
                                </div>
                                {ev.adminEmail && (
                                  <p className='mt-0.5 text-[10px] text-muted-foreground'>
                                    by {ev.adminEmail}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Empty events fallback */}
                      {userActivity.recentEvents.length === 0 &&
                        userActivity.auditTrail.length === 0 && (
                          <div className='flex flex-col items-center gap-3 py-8 text-center'>
                            <Activity className='size-8 text-muted-foreground/40' />
                            <p className='text-sm text-muted-foreground'>No recent activity</p>
                          </div>
                        )}
                    </div>
                  ) : (
                    <div className='flex flex-col items-center gap-3 py-12 text-center'>
                      <Activity className='size-10 text-muted-foreground/40' />
                      <p className='text-sm text-muted-foreground'>No activity data available</p>
                    </div>
                  )}
                </TabsContent>

                {/* ── Actions tab ── */}
                <TabsContent value='actions' className='mt-0 px-6 py-5'>
                  <div className='space-y-5'>
                    <p className='text-xs text-muted-foreground'>
                      Status changes take effect immediately and notify the user.
                    </p>

                    <div className='space-y-2'>
                      {selectedUser.status !== UserStatus.SUSPENDED &&
                        selectedUser.status !== UserStatus.BLOCKED && (
                          <AdminActionRow
                            label='Suspend User'
                            description='Temporarily restrict access to the platform'
                            colorClass='text-orange-700'
                            borderClass='border-orange-200 hover:bg-orange-50/60'
                            onClick={() => openAction(selectedUser, 'suspend')}
                          />
                        )}
                      {(selectedUser.status === UserStatus.SUSPENDED ||
                        selectedUser.status === UserStatus.PENDING) && (
                        <AdminActionRow
                          label='Activate User'
                          description='Restore full platform access'
                          colorClass='text-emerald-700'
                          borderClass='border-emerald-200 hover:bg-emerald-50/60'
                          onClick={() => openAction(selectedUser, 'activate')}
                        />
                      )}
                      {selectedUser.status !== UserStatus.BLOCKED && (
                        <AdminActionRow
                          label='Block User'
                          description='Permanently revoke platform access'
                          colorClass='text-rose-700'
                          borderClass='border-rose-200 hover:bg-rose-50/60'
                          onClick={() => openAction(selectedUser, 'block')}
                        />
                      )}
                    </div>

                    <Separator />

                    <div className='space-y-3 rounded-lg border border-destructive/20 bg-destructive/5 p-4'>
                      <div>
                        <p className='text-xs font-semibold text-destructive'>Danger Zone</p>
                        <p className='mt-0.5 text-xs text-muted-foreground'>
                          Account deletion is permanent and cannot be undone. All associated data
                          will be removed.
                        </p>
                      </div>
                      <Button
                        variant='outline'
                        size='sm'
                        className='w-full border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive'
                        onClick={() => openAction(selectedUser, 'delete')}
                      >
                        <Trash2 className='me-1.5 size-3.5' />
                        Delete User Account
                      </Button>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Confirm Dialog */}
      {actionDialog && (
        <ConfirmActionDialog
          open={actionDialog.open}
          onOpenChange={open => !open && setActionDialog(null)}
          title={t(
            `confirm${actionDialog.type.charAt(0).toUpperCase() + actionDialog.type.slice(1)}.title` as Parameters<
              typeof t
            >[0],
          )}
          description={t(
            `confirm${actionDialog.type.charAt(0).toUpperCase() + actionDialog.type.slice(1)}.description` as Parameters<
              typeof t
            >[0],
          )}
          confirmLabel={t(`actions.${actionDialog.type}` as Parameters<typeof t>[0])}
          variant={
            actionDialog.type === 'block' || actionDialog.type === 'delete'
              ? 'danger'
              : actionDialog.type === 'suspend'
                ? 'warning'
                : 'default'
          }
          isLoading={updateStatus.isPending || deleteUser.isPending}
          onConfirm={handleConfirmAction}
          reasonConfig={{
            label: t(
              `confirm${actionDialog.type.charAt(0).toUpperCase() + actionDialog.type.slice(1)}.reasonLabel` as Parameters<
                typeof t
              >[0],
            ),
            placeholder: t(
              `confirm${actionDialog.type.charAt(0).toUpperCase() + actionDialog.type.slice(1)}.reasonPlaceholder` as Parameters<
                typeof t
              >[0],
            ),
            required: true,
          }}
        />
      )}
    </div>
  );
}
