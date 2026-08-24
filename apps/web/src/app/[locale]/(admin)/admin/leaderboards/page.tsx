'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Medal,
  Trophy,
  Crown,
  Users,
  Star,
  Eye,
  TrendingUp,
  Award,
  Package,
  UserPlus,
  Plus,
} from 'lucide-react';
import {
  Card,
  CardContent,
  Button,
  Avatar,
  AvatarFallback,
  Sheet,
  SheetContent,
  SheetTitle,
  Separator,
  Badge,
} from '@foodwaste/ui';
import { AdminModuleHeader } from '@/components/dashboard/admin/admin-module-header';
import { AdminTabNav, type AdminTab } from '@/components/dashboard/admin/admin-tab-nav';
import { AdminKpiRow, type KpiItem } from '@/components/dashboard/admin/admin-kpi-row';
import { AdminDataTable, type ColumnDef } from '@/components/dashboard/admin/admin-data-table';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  useAdminLeaderboardStats,
  useAdminTopUsers,
  useAdminTopMerchants,
  useAddLoyaltyPoints,
} from '@/hooks/use-admin';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { AdminLeaderboardEntry } from '@/types/admin';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getRankIcon(rank: number) {
  if (rank === 1) return <Crown className='size-4 text-amber-500' />;
  if (rank === 2) return <Medal className='size-4 text-gray-400' />;
  if (rank === 3) return <Medal className='size-4 text-amber-700' />;
  return <span className='text-xs font-bold text-muted-foreground tabular-nums'>#{rank}</span>;
}

function getTierColor(tier: string) {
  const map: Record<string, string> = {
    bronze: 'bg-amber-700/10 text-amber-700 border-amber-700/20',
    silver: 'bg-gray-400/10 text-gray-600 border-gray-400/20',
    gold: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
    platinum: 'bg-violet-500/10 text-violet-600 border-violet-500/20',
  };
  return map[tier.toLowerCase()] ?? 'bg-muted text-muted-foreground border-border';
}

function formatNumber(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return n.toLocaleString();
}

// ─── User Detail Drawer ──────────────────────────────────────────────────────

function UserDetailDrawer({
  user,
  open,
  onClose,
}: {
  user: AdminLeaderboardEntry | null;
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations('adminLeaderboards');
  if (!user) return null;

  const initials = `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase();

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent className='w-full overflow-y-auto sm:max-w-lg'>
        <SheetTitle className='sr-only'>{t('userDetails')}</SheetTitle>
        <div className='space-y-0'>
          <div className='-mx-2xl -mt-2xl mb-0 border-b border-border/60 bg-muted/20 px-2xl pb-xl pt-xl pe-14'>
            <div className='flex items-start gap-md'>
              <div className='relative'>
                <Avatar className='size-14'>
                  <AvatarFallback className='text-base font-semibold'>{initials}</AvatarFallback>
                </Avatar>
                <div className='absolute -top-xs -end-xs'>{getRankIcon(user.rank)}</div>
              </div>
              <div>
                <p className='text-base font-semibold'>
                  {user.firstName} {user.lastName}
                </p>
                <p className='text-xs text-muted-foreground'>{user.email}</p>
                <Badge
                  variant='outline'
                  className={cn('mt-1.5 text-[10px] capitalize', getTierColor(user.currentTier))}
                >
                  {user.currentTier}
                </Badge>
              </div>
            </div>
            <div className='mt-md grid grid-cols-3 gap-sm'>
              <div className='rounded-lg bg-background/60 border border-border/40 px-md py-sm text-center'>
                <p className='text-lg font-bold tabular-nums text-amber-600'>
                  {user.totalPoints.toLocaleString()}
                </p>
                <p className='text-[10px] text-muted-foreground'>{t('columns.totalPoints')}</p>
              </div>
              <div className='rounded-lg bg-background/60 border border-border/40 px-md py-sm text-center'>
                <p className='text-lg font-bold tabular-nums'>{user.totalBagsSaved}</p>
                <p className='text-[10px] text-muted-foreground'>{t('columns.bagsSaved')}</p>
              </div>
              <div className='rounded-lg bg-background/60 border border-border/40 px-md py-sm text-center'>
                <p className='text-lg font-bold tabular-nums'>{user.totalOrdersCount}</p>
                <p className='text-[10px] text-muted-foreground'>{t('columns.orders')}</p>
              </div>
            </div>
          </div>

          <div className='space-y-xl py-xl'>
            <section className='space-y-md'>
              <h3 className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
                {t('activityBreakdown')}
              </h3>
              <div className='space-y-sm'>
                {[
                  {
                    label: t('columns.orders'),
                    value: user.totalOrdersCount,
                    icon: Package,
                  },
                  {
                    label: t('columns.bagsSaved'),
                    value: user.totalBagsSaved,
                    icon: Award,
                  },
                  {
                    label: t('columns.referrals'),
                    value: user.referralCount,
                    icon: UserPlus,
                  },
                ].map(item => (
                  <div key={item.label} className='flex items-center justify-between py-1.5'>
                    <div className='flex items-center gap-sm'>
                      <item.icon className='size-3.5 text-muted-foreground' />
                      <span className='text-xs'>{item.label}</span>
                    </div>
                    <span className='text-xs font-semibold tabular-nums'>
                      {item.value.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Content ─────────────────────────────────────────────────────────────────

function AddPointsDialog({
  user,
  open,
  onClose,
}: {
  user: AdminLeaderboardEntry | null;
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations('adminLeaderboards');
  const addPointsMutation = useAddLoyaltyPoints();
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');

  const handleSubmit = () => {
    if (!user || !amount || !reason.trim()) return;
    addPointsMutation.mutate(
      { userId: user.userId, payload: { amount: Number(amount), reason } },
      {
        onSuccess: () => {
          toast.success(
            t('addPoints.success', { points: amount, name: `${user.firstName} ${user.lastName}` }),
          );
          setAmount('');
          setReason('');
          onClose();
        },
      },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={v => {
        if (!v) {
          onClose();
          setAmount('');
          setReason('');
        }
      }}
    >
      <DialogContent className='max-w-md'>
        <DialogHeader>
          <DialogTitle>{t('addPoints.title')}</DialogTitle>
        </DialogHeader>
        <div className='space-y-lg py-sm'>
          {user && (
            <p className='text-sm text-muted-foreground'>
              {t('addPoints.description', { name: `${user.firstName} ${user.lastName}` })}
            </p>
          )}
          <div className='space-y-1.5'>
            <Label htmlFor='points-amount'>{t('addPoints.amountLabel')}</Label>
            <Input
              id='points-amount'
              type='number'
              min={1}
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder='e.g. 50'
            />
          </div>
          <div className='space-y-1.5'>
            <Label htmlFor='points-reason'>{t('addPoints.reasonLabel')}</Label>
            <Textarea
              id='points-reason'
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder={t('addPoints.reasonPlaceholder')}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant='outline'
            onClick={() => {
              onClose();
              setAmount('');
              setReason('');
            }}
          >
            {t('addPoints.cancel')}
          </Button>
          <Button
            disabled={
              !amount || Number(amount) <= 0 || !reason.trim() || addPointsMutation.isPending
            }
            onClick={handleSubmit}
          >
            {addPointsMutation.isPending ? t('addPoints.adding') : t('addPoints.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LeaderboardsContent() {
  const t = useTranslations('adminLeaderboards');
  const searchParams = useSearchParams();
  const currentTab = searchParams.get('tab') ?? 'overview';
  const [page, setPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState<AdminLeaderboardEntry | null>(null);
  const [addPointsUser, setAddPointsUser] = useState<AdminLeaderboardEntry | null>(null);

  const { data: stats, isLoading: statsLoading } = useAdminLeaderboardStats();
  const { data: topUsersData, isLoading: usersLoading } = useAdminTopUsers(page);
  const { data: topMerchants } = useAdminTopMerchants();

  const topUsers = topUsersData?.data ?? [];
  const meta = topUsersData?.meta;

  const tabs: AdminTab[] = [
    { key: 'overview', label: t('tabs.overview') },
    { key: 'topUsers', label: t('tabs.topUsers') },
  ];

  const kpis: KpiItem[] = [
    {
      label: t('kpi.totalParticipants'),
      value: stats ? formatNumber(stats.totalParticipants) : '—',
      icon: Users,
      iconBg: 'bg-indigo-50',
      iconColor: 'text-indigo-600',
    },
    {
      label: t('kpi.totalPoints'),
      value: stats ? formatNumber(stats.totalPointsDistributed) : '—',
      icon: Star,
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-600',
    },
    {
      label: t('kpi.averagePoints'),
      value: stats ? formatNumber(stats.averagePoints) : '—',
      icon: TrendingUp,
      iconBg: 'bg-violet-50',
      iconColor: 'text-violet-600',
    },
    {
      label: t('kpi.topTier'),
      value: stats?.topTier ? stats.topTier.charAt(0).toUpperCase() + stats.topTier.slice(1) : '—',
      icon: Trophy,
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
    },
  ];

  const columns: ColumnDef<AdminLeaderboardEntry>[] = [
    {
      key: 'rank',
      header: '#',
      render: u => <div className='flex items-center justify-center'>{getRankIcon(u.rank)}</div>,
      className: 'w-12 text-center',
    },
    {
      key: 'user',
      header: t('columns.user'),
      render: u => (
        <div className='flex items-center gap-2.5'>
          <Avatar className='size-7'>
            <AvatarFallback className='text-[10px]'>
              {`${u.firstName?.[0] ?? ''}${u.lastName?.[0] ?? ''}`}
            </AvatarFallback>
          </Avatar>
          <div className='min-w-0'>
            <span className='text-xs font-medium'>
              {u.firstName} {u.lastName}
            </span>
            <p className='text-[10px] text-muted-foreground'>{u.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'points',
      header: t('columns.totalPoints'),
      render: u => (
        <span className='text-xs font-bold tabular-nums text-amber-600'>
          {u.totalPoints.toLocaleString()}
        </span>
      ),
    },
    {
      key: 'tier',
      header: t('columns.tier'),
      render: u => (
        <Badge
          variant='outline'
          className={cn('text-[10px] capitalize', getTierColor(u.currentTier))}
        >
          {u.currentTier}
        </Badge>
      ),
    },
    {
      key: 'bags',
      header: t('columns.bagsSaved'),
      render: u => <span className='text-xs tabular-nums'>{u.totalBagsSaved}</span>,
    },
    {
      key: 'orders',
      header: t('columns.orders'),
      render: u => <span className='text-xs tabular-nums'>{u.totalOrdersCount}</span>,
    },
    {
      key: 'referrals',
      header: t('columns.referrals'),
      render: u => <span className='text-xs tabular-nums'>{u.referralCount}</span>,
    },
    {
      key: 'actions',
      header: '',
      render: u => (
        <div className='flex items-center gap-xs'>
          <Button
            variant='ghost'
            size='sm'
            className='h-7 w-7 p-0'
            onClick={() => setSelectedUser(u)}
          >
            <Eye className='size-3.5' />
          </Button>
          <Button
            variant='ghost'
            size='sm'
            className='h-7 w-7 p-0 text-amber-600'
            onClick={e => {
              e.stopPropagation();
              setAddPointsUser(u);
            }}
          >
            <Plus className='size-3.5' />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className='space-y-xl'>
      <AdminModuleHeader title={t('title')} subtitle={t('subtitle')} />

      <AdminKpiRow items={kpis} loading={statsLoading} />

      <Card className='border-border/60'>
        <CardContent className='p-0'>
          <AdminTabNav tabs={tabs} />
          <div className='p-lg'>
            {currentTab === 'overview' && (
              <div className='space-y-lg'>
                {statsLoading ? (
                  <div className='grid grid-cols-2 md:grid-cols-4 gap-md'>
                    {[...Array(4)].map((_, i) => (
                      <Skeleton key={i} className='h-24 rounded-lg' />
                    ))}
                  </div>
                ) : stats?.tierBreakdown && stats.tierBreakdown.length > 0 ? (
                  <>
                    <h3 className='text-sm font-semibold'>{t('tierDistribution')}</h3>
                    <div className='grid grid-cols-2 md:grid-cols-4 gap-md'>
                      {stats.tierBreakdown.map(tb => (
                        <Card key={tb.tier} className='border-border/60'>
                          <CardContent className='p-lg text-center'>
                            <Badge
                              variant='outline'
                              className={cn('mb-sm text-[10px] capitalize', getTierColor(tb.tier))}
                            >
                              {tb.tier}
                            </Badge>
                            <p className='text-2xl font-bold tabular-nums'>
                              {tb.count.toLocaleString()}
                            </p>
                            <p className='text-[10px] text-muted-foreground mt-xs'>{t('users')}</p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                    <Separator />
                    <div className='grid grid-cols-1 md:grid-cols-3 gap-lg'>
                      <Card className='border-border/60'>
                        <CardContent className='p-lg'>
                          <div className='flex items-center gap-sm mb-sm'>
                            <Users className='size-4 text-indigo-600' />
                            <span className='text-xs font-medium'>
                              {t('kpi.totalParticipants')}
                            </span>
                          </div>
                          <p className='text-xl font-bold tabular-nums'>
                            {stats.totalParticipants.toLocaleString()}
                          </p>
                        </CardContent>
                      </Card>
                      <Card className='border-border/60'>
                        <CardContent className='p-lg'>
                          <div className='flex items-center gap-sm mb-sm'>
                            <Star className='size-4 text-amber-600' />
                            <span className='text-xs font-medium'>{t('kpi.totalPoints')}</span>
                          </div>
                          <p className='text-xl font-bold tabular-nums'>
                            {stats.totalPointsDistributed.toLocaleString()}
                          </p>
                        </CardContent>
                      </Card>
                      <Card className='border-border/60'>
                        <CardContent className='p-lg'>
                          <div className='flex items-center gap-sm mb-sm'>
                            <TrendingUp className='size-4 text-violet-600' />
                            <span className='text-xs font-medium'>{t('kpi.averagePoints')}</span>
                          </div>
                          <p className='text-xl font-bold tabular-nums'>
                            {Math.round(stats.averagePoints).toLocaleString()}
                          </p>
                        </CardContent>
                      </Card>
                    </div>
                    {topMerchants && topMerchants.length > 0 && (
                      <>
                        <Separator />
                        <h3 className='text-sm font-semibold'>{t('topMerchants')}</h3>
                        <p className='text-xs text-muted-foreground'>{t('topMerchantsDesc')}</p>
                        <div className='space-y-sm'>
                          {topMerchants.map(m => (
                            <div
                              key={m.establishmentId}
                              className='flex items-center gap-md rounded-lg border border-border/60 p-md'
                            >
                              <div className='flex items-center justify-center w-8'>
                                {getRankIcon(m.rank)}
                              </div>
                              <div className='flex-1 min-w-0'>
                                <p className='text-xs font-medium'>{m.establishmentName}</p>
                              </div>
                              <div className='flex items-center gap-sm'>
                                <span className='text-xs font-bold tabular-nums'>
                                  {m.bagsSaved.toLocaleString()} {t('bags')}
                                </span>
                                <Badge className='text-[10px] bg-primary/10 text-primary border-primary/20'>
                                  2 {t('sponsorDays')}
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <div className='flex flex-col items-center justify-center py-6xl gap-md text-center'>
                    <Trophy className='size-12 text-muted-foreground' />
                    <h3 className='text-md font-semibold'>{t('empty.title')}</h3>
                    <p className='text-sm text-muted-foreground max-w-xs'>
                      {t('empty.description')}
                    </p>
                  </div>
                )}
              </div>
            )}

            {currentTab === 'topUsers' && (
              <AdminDataTable
                columns={columns}
                data={topUsers}
                isLoading={usersLoading}
                page={page}
                totalPages={meta?.totalPages ?? 1}
                total={meta?.total ?? 0}
                onPageChange={setPage}
                searchPlaceholder={t('searchUsers')}
                onSearchChange={() => {}}
                onRowClick={row => setSelectedUser(row)}
                emptyIcon={Trophy}
                emptyTitle={t('empty.title')}
                emptyDescription={t('empty.description')}
              />
            )}
          </div>
        </CardContent>
      </Card>

      <UserDetailDrawer
        user={selectedUser}
        open={!!selectedUser}
        onClose={() => setSelectedUser(null)}
      />

      <AddPointsDialog
        user={addPointsUser}
        open={!!addPointsUser}
        onClose={() => setAddPointsUser(null)}
      />
    </div>
  );
}

export default function AdminLeaderboardsPage() {
  return (
    <Suspense
      fallback={
        <div className='space-y-xl'>
          <Skeleton className='h-16 rounded-lg' />
          <div className='grid grid-cols-2 md:grid-cols-4 gap-md'>
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className='h-24 rounded-lg' />
            ))}
          </div>
          <Skeleton className='h-96 rounded-lg' />
        </div>
      }
    >
      <LeaderboardsContent />
    </Suspense>
  );
}
