'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Medal,
  Trophy,
  Crown,
  Gift,
  AlertTriangle,
  Users,
  Flame,
  Share2,
  Star,
  CheckCircle2,
  XCircle,
  Eye,
  ShieldAlert,
  Calendar,
  Smartphone,
  Package,
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
} from '@foodwaste/ui';
import { AdminModuleHeader } from '@/components/dashboard/admin/admin-module-header';
import { AdminTabNav, type AdminTab } from '@/components/dashboard/admin/admin-tab-nav';
import { AdminKpiRow, type KpiItem } from '@/components/dashboard/admin/admin-kpi-row';
import { AdminDataTable, type ColumnDef } from '@/components/dashboard/admin/admin-data-table';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────

interface LeaderboardUser {
  id: string;
  rank: number;
  name: string;
  email: string;
  totalPoints: number;
  streakPoints: number;
  referralPoints: number;
  orderPoints: number;
  currentStreak: number;
  totalOrders: number;
  isSuspicious: boolean;
  suspiciousReason?: string;
  joinedAt: string;
}

interface PrizeFulfillment {
  id: string;
  userId: string;
  userName: string;
  rank: number;
  season: string;
  prize: string;
  status: 'pending_verification' | 'verified' | 'shipped' | 'delivered' | 'flagged';
  flagReason?: string;
  address?: string;
  phone?: string;
}

interface PastSeason {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  totalParticipants: number;
  totalPointsDistributed: number;
  winner: string;
  prizesAwarded: number;
}

// ─── Mock data ───────────────────────────────────────────────────────────────

const MOCK_LEADERBOARD: LeaderboardUser[] = [
  {
    id: '1',
    rank: 1,
    name: 'Amira Ben Salah',
    email: 'amira@example.com',
    totalPoints: 2450,
    streakPoints: 800,
    referralPoints: 650,
    orderPoints: 1000,
    currentStreak: 28,
    totalOrders: 45,
    isSuspicious: false,
    joinedAt: '2026-01-15T00:00:00Z',
  },
  {
    id: '2',
    rank: 2,
    name: 'Karim Chaari',
    email: 'karim@example.com',
    totalPoints: 2180,
    streakPoints: 500,
    referralPoints: 880,
    orderPoints: 800,
    currentStreak: 14,
    totalOrders: 38,
    isSuspicious: true,
    suspiciousReason: 'Unusual referral pattern — 12 referrals from same IP range',
    joinedAt: '2026-02-01T00:00:00Z',
  },
  {
    id: '3',
    rank: 3,
    name: 'Nour El Houda',
    email: 'nour@example.com',
    totalPoints: 1920,
    streakPoints: 720,
    referralPoints: 200,
    orderPoints: 1000,
    currentStreak: 21,
    totalOrders: 42,
    isSuspicious: false,
    joinedAt: '2026-01-20T00:00:00Z',
  },
  {
    id: '4',
    rank: 4,
    name: 'Yassine Mansouri',
    email: 'yassine@example.com',
    totalPoints: 1650,
    streakPoints: 450,
    referralPoints: 400,
    orderPoints: 800,
    currentStreak: 9,
    totalOrders: 31,
    isSuspicious: false,
    joinedAt: '2026-03-10T00:00:00Z',
  },
  {
    id: '5',
    rank: 5,
    name: 'Salma Dridi',
    email: 'salma@example.com',
    totalPoints: 1480,
    streakPoints: 380,
    referralPoints: 300,
    orderPoints: 800,
    currentStreak: 7,
    totalOrders: 28,
    isSuspicious: true,
    suspiciousReason: 'Multiple accounts linked to same phone number',
    joinedAt: '2026-02-28T00:00:00Z',
  },
];

const MOCK_PRIZES: PrizeFulfillment[] = [
  {
    id: 'pf1',
    userId: '1',
    userName: 'Amira Ben Salah',
    rank: 1,
    season: 'Q2 2026',
    prize: 'iPhone 15',
    status: 'pending_verification',
    phone: '+216 55 123 456',
  },
  {
    id: 'pf2',
    userId: '2',
    userName: 'Karim Chaari',
    rank: 2,
    season: 'Q2 2026',
    prize: 'Samsung Galaxy S24',
    status: 'flagged',
    flagReason: 'Suspicious referral activity — manual review required',
    phone: '+216 55 789 012',
  },
  {
    id: 'pf3',
    userId: '3',
    userName: 'Nour El Houda',
    rank: 3,
    season: 'Q2 2026',
    prize: 'AirPods Pro',
    status: 'verified',
  },
];

const MOCK_SEASONS: PastSeason[] = [
  {
    id: 's1',
    name: 'Q1 2026',
    startDate: '2026-01-01',
    endDate: '2026-03-31',
    totalParticipants: 842,
    totalPointsDistributed: 156000,
    winner: 'Ahmed Ben Ali',
    prizesAwarded: 5,
  },
  {
    id: 's2',
    name: 'Q4 2025',
    startDate: '2025-10-01',
    endDate: '2025-12-31',
    totalParticipants: 614,
    totalPointsDistributed: 98000,
    winner: 'Fatma Trabelsi',
    prizesAwarded: 3,
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getRankIcon(rank: number) {
  if (rank === 1) return <Crown className='size-4 text-amber-500' />;
  if (rank === 2) return <Medal className='size-4 text-gray-400' />;
  if (rank === 3) return <Medal className='size-4 text-amber-700' />;
  return <span className='text-xs font-bold text-muted-foreground tabular-nums'>#{rank}</span>;
}

function getPrizeStatusStyle(status: PrizeFulfillment['status']) {
  const map = {
    pending_verification: 'bg-amber-50 text-amber-700 border-amber-200',
    verified: 'bg-sky-50 text-sky-700 border-sky-200',
    shipped: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    delivered: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    flagged: 'bg-rose-50 text-rose-700 border-rose-200',
  };
  return map[status];
}

// ─── User Detail Drawer ──────────────────────────────────────────────────────

function UserDetailDrawer({
  user,
  open,
  onClose,
}: {
  user: LeaderboardUser | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!user) return null;
  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent className='w-full overflow-y-auto sm:max-w-lg'>
        <SheetTitle className='sr-only'>User Leaderboard Details</SheetTitle>
        <div className='space-y-0'>
          <div className='-mx-6 -mt-6 mb-0 border-b border-border/60 bg-muted/20 px-6 pb-5 pt-5 pe-14'>
            <div className='flex items-start gap-3'>
              <div className='relative'>
                <Avatar className='size-14'>
                  <AvatarFallback className='text-base font-semibold'>
                    {user.name
                      .split(' ')
                      .map(n => n[0])
                      .join('')}
                  </AvatarFallback>
                </Avatar>
                <div className='absolute -top-1 -end-1'>{getRankIcon(user.rank)}</div>
              </div>
              <div>
                <p className='text-base font-semibold'>{user.name}</p>
                <p className='text-xs text-muted-foreground'>{user.email}</p>
                {user.isSuspicious && (
                  <div className='flex items-center gap-1 mt-1.5 text-rose-600'>
                    <ShieldAlert className='size-3.5' />
                    <span className='text-[10px] font-semibold'>Flagged</span>
                  </div>
                )}
              </div>
            </div>
            <div className='mt-3 grid grid-cols-3 gap-2'>
              <div className='rounded-lg bg-background/60 border border-border/40 px-3 py-2 text-center'>
                <p className='text-lg font-bold tabular-nums text-amber-600'>
                  {user.totalPoints.toLocaleString()}
                </p>
                <p className='text-[10px] text-muted-foreground'>Total Points</p>
              </div>
              <div className='rounded-lg bg-background/60 border border-border/40 px-3 py-2 text-center'>
                <p className='text-lg font-bold tabular-nums'>{user.currentStreak}</p>
                <p className='text-[10px] text-muted-foreground'>Day Streak</p>
              </div>
              <div className='rounded-lg bg-background/60 border border-border/40 px-3 py-2 text-center'>
                <p className='text-lg font-bold tabular-nums'>{user.totalOrders}</p>
                <p className='text-[10px] text-muted-foreground'>Orders</p>
              </div>
            </div>
          </div>

          <div className='space-y-5 py-5'>
            <section className='space-y-3'>
              <h3 className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
                Points Breakdown
              </h3>
              <div className='space-y-2'>
                {[
                  {
                    label: 'Order Points',
                    value: user.orderPoints,
                    icon: Package,
                    pct: (user.orderPoints / user.totalPoints) * 100,
                  },
                  {
                    label: 'Streak Points',
                    value: user.streakPoints,
                    icon: Flame,
                    pct: (user.streakPoints / user.totalPoints) * 100,
                  },
                  {
                    label: 'Referral Points',
                    value: user.referralPoints,
                    icon: Share2,
                    pct: (user.referralPoints / user.totalPoints) * 100,
                  },
                ].map(item => (
                  <div key={item.label}>
                    <div className='flex items-center justify-between mb-1'>
                      <div className='flex items-center gap-1.5'>
                        <item.icon className='size-3 text-muted-foreground' />
                        <span className='text-xs'>{item.label}</span>
                      </div>
                      <span className='text-xs font-medium tabular-nums'>
                        {item.value.toLocaleString()}
                      </span>
                    </div>
                    <div className='h-1.5 w-full rounded-full bg-muted overflow-hidden'>
                      <div
                        className='h-full rounded-full bg-primary/60'
                        style={{ width: `${item.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {user.isSuspicious && user.suspiciousReason && (
              <>
                <Separator />
                <section className='space-y-2'>
                  <h3 className='text-xs font-semibold uppercase tracking-wide text-rose-600'>
                    Suspicious Activity
                  </h3>
                  <div className='rounded-lg border border-rose-200 bg-rose-50/50 p-3'>
                    <div className='flex items-start gap-2'>
                      <ShieldAlert className='size-4 text-rose-600 mt-0.5 shrink-0' />
                      <p className='text-xs text-rose-800'>{user.suspiciousReason}</p>
                    </div>
                  </div>
                  <div className='flex gap-2'>
                    <Button
                      size='sm'
                      variant='outline'
                      className='h-7 text-xs text-rose-600 border-rose-200 hover:bg-rose-50'
                    >
                      <XCircle className='me-1 size-3' /> Disqualify
                    </Button>
                    <Button
                      size='sm'
                      variant='outline'
                      className='h-7 text-xs text-emerald-600 border-emerald-200 hover:bg-emerald-50'
                    >
                      <CheckCircle2 className='me-1 size-3' /> Clear Flag
                    </Button>
                  </div>
                </section>
              </>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Content ─────────────────────────────────────────────────────────────────

function LeaderboardsContent() {
  const t = useTranslations('adminLeaderboards');
  const searchParams = useSearchParams();
  const currentTab = searchParams.get('tab') ?? 'standings';
  const [selectedUser, setSelectedUser] = useState<LeaderboardUser | null>(null);

  const tabs: AdminTab[] = [
    { key: 'standings', label: t('tabs.standings') },
    {
      key: 'prizes',
      label: t('tabs.prizes'),
      badge: MOCK_PRIZES.filter(p => p.status === 'flagged').length,
    },
    { key: 'history', label: t('tabs.history') },
  ];

  const flaggedCount = MOCK_LEADERBOARD.filter(u => u.isSuspicious).length;

  const kpis: KpiItem[] = [
    {
      label: t('kpi.totalParticipants'),
      value: '1,247',
      icon: Users,
      iconBg: 'bg-indigo-50',
      iconColor: 'text-indigo-600',
    },
    {
      label: t('kpi.currentSeason'),
      value: 'Q3 2026',
      icon: Trophy,
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-600',
    },
    {
      label: t('kpi.totalPoints'),
      value: '284K',
      icon: Star,
      iconBg: 'bg-violet-50',
      iconColor: 'text-violet-600',
    },
    {
      label: t('kpi.flaggedAccounts'),
      value: String(flaggedCount),
      icon: AlertTriangle,
      iconBg: 'bg-rose-50',
      iconColor: 'text-rose-600',
      highlight: flaggedCount > 0,
    },
  ];

  const standingsColumns: ColumnDef<LeaderboardUser>[] = [
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
              {u.name
                .split(' ')
                .map(n => n[0])
                .join('')}
            </AvatarFallback>
          </Avatar>
          <div className='min-w-0'>
            <div className='flex items-center gap-1.5'>
              <span className='text-xs font-medium'>{u.name}</span>
              {u.isSuspicious && <ShieldAlert className='size-3 text-rose-500 shrink-0' />}
            </div>
            <p className='text-[10px] text-muted-foreground'>{u.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'total',
      header: t('columns.totalPoints'),
      render: u => (
        <span className='text-xs font-bold tabular-nums text-amber-600'>
          {u.totalPoints.toLocaleString()}
        </span>
      ),
    },
    {
      key: 'streak',
      header: t('columns.streak'),
      render: u => (
        <div className='flex items-center gap-1'>
          <Flame
            className={cn(
              'size-3',
              u.currentStreak >= 14 ? 'text-orange-500' : 'text-muted-foreground',
            )}
          />
          <span className='text-xs tabular-nums'>{u.currentStreak}d</span>
        </div>
      ),
    },
    {
      key: 'referrals',
      header: t('columns.referralPts'),
      render: u => <span className='text-xs tabular-nums'>{u.referralPoints}</span>,
    },
    {
      key: 'orders',
      header: t('columns.orders'),
      render: u => <span className='text-xs tabular-nums'>{u.totalOrders}</span>,
    },
    {
      key: 'actions',
      header: '',
      render: u => (
        <Button
          variant='ghost'
          size='sm'
          className='h-7 w-7 p-0'
          onClick={() => setSelectedUser(u)}
        >
          <Eye className='size-3.5' />
        </Button>
      ),
    },
  ];

  const prizeColumns: ColumnDef<PrizeFulfillment>[] = [
    {
      key: 'rank',
      header: '#',
      render: p => <div className='flex items-center justify-center'>{getRankIcon(p.rank)}</div>,
      className: 'w-12 text-center',
    },
    {
      key: 'user',
      header: t('columns.user'),
      render: p => <span className='text-xs font-medium'>{p.userName}</span>,
    },
    {
      key: 'prize',
      header: t('columns.prize'),
      render: p => (
        <div className='flex items-center gap-1.5'>
          <Smartphone className='size-3.5 text-muted-foreground' />
          <span className='text-xs'>{p.prize}</span>
        </div>
      ),
    },
    {
      key: 'season',
      header: t('columns.season'),
      render: p => <span className='text-xs text-muted-foreground'>{p.season}</span>,
    },
    {
      key: 'status',
      header: t('columns.status'),
      render: p => (
        <span
          className={cn(
            'inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold',
            getPrizeStatusStyle(p.status),
          )}
        >
          {p.status.replace(/_/g, ' ')}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: p =>
        p.status === 'pending_verification' ? (
          <div className='flex gap-1'>
            <Button
              size='sm'
              variant='outline'
              className='h-6 px-2 text-[10px] text-emerald-600 border-emerald-200'
            >
              <CheckCircle2 className='me-1 size-3' /> Verify
            </Button>
            <Button
              size='sm'
              variant='outline'
              className='h-6 px-2 text-[10px] text-rose-600 border-rose-200'
            >
              <ShieldAlert className='me-1 size-3' /> Flag
            </Button>
          </div>
        ) : null,
    },
  ];

  const seasonColumns: ColumnDef<PastSeason>[] = [
    {
      key: 'name',
      header: t('columns.season'),
      render: s => <span className='text-xs font-semibold'>{s.name}</span>,
    },
    {
      key: 'dates',
      header: t('columns.period'),
      render: s => (
        <span className='text-xs text-muted-foreground'>
          {new Date(s.startDate).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })} —{' '}
          {new Date(s.endDate).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
        </span>
      ),
    },
    {
      key: 'participants',
      header: t('columns.participants'),
      render: s => (
        <span className='text-xs tabular-nums'>{s.totalParticipants.toLocaleString()}</span>
      ),
    },
    {
      key: 'points',
      header: t('columns.totalPoints'),
      render: s => (
        <span className='text-xs tabular-nums'>{s.totalPointsDistributed.toLocaleString()}</span>
      ),
    },
    {
      key: 'winner',
      header: t('columns.winner'),
      render: s => (
        <div className='flex items-center gap-1.5'>
          <Crown className='size-3 text-amber-500' />
          <span className='text-xs font-medium'>{s.winner}</span>
        </div>
      ),
    },
    {
      key: 'prizes',
      header: t('columns.prizes'),
      render: s => <span className='text-xs tabular-nums'>{s.prizesAwarded}</span>,
    },
  ];

  return (
    <div className='space-y-5'>
      <AdminModuleHeader title={t('title')} subtitle={t('subtitle')} />

      <AdminKpiRow items={kpis} />

      {/* Flagged accounts banner */}
      {flaggedCount > 0 && (
        <Card className='border-rose-200 bg-rose-50/30'>
          <CardContent className='p-3 flex items-center gap-3'>
            <ShieldAlert className='size-5 text-rose-600 shrink-0' />
            <div className='flex-1'>
              <p className='text-xs font-semibold text-rose-800'>
                {flaggedCount} account{flaggedCount > 1 ? 's' : ''} flagged for suspicious activity
              </p>
              <p className='text-[10px] text-rose-600'>Review before distributing prizes</p>
            </div>
            <Button
              size='sm'
              variant='outline'
              className='h-7 text-xs border-rose-200 text-rose-700 hover:bg-rose-100'
            >
              Review
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className='border-border/60'>
        <CardContent className='p-0'>
          <AdminTabNav tabs={tabs} />
          <div className='p-4'>
            {currentTab === 'standings' && (
              <AdminDataTable
                columns={standingsColumns}
                data={MOCK_LEADERBOARD}
                isLoading={false}
                page={1}
                totalPages={1}
                total={MOCK_LEADERBOARD.length}
                onPageChange={() => {}}
                searchPlaceholder={t('searchUsers')}
                onSearchChange={() => {}}
                onRowClick={row => setSelectedUser(row)}
                emptyIcon={Trophy}
                emptyTitle={t('empty.title')}
                emptyDescription={t('empty.description')}
              />
            )}
            {currentTab === 'prizes' && (
              <AdminDataTable
                columns={prizeColumns}
                data={MOCK_PRIZES}
                isLoading={false}
                page={1}
                totalPages={1}
                total={MOCK_PRIZES.length}
                onPageChange={() => {}}
                searchPlaceholder={t('searchPrizes')}
                onSearchChange={() => {}}
                emptyIcon={Gift}
                emptyTitle={t('emptyPrizes.title')}
                emptyDescription={t('emptyPrizes.description')}
              />
            )}
            {currentTab === 'history' && (
              <AdminDataTable
                columns={seasonColumns}
                data={MOCK_SEASONS}
                isLoading={false}
                page={1}
                totalPages={1}
                total={MOCK_SEASONS.length}
                onPageChange={() => {}}
                searchPlaceholder={t('searchSeasons')}
                onSearchChange={() => {}}
                emptyIcon={Calendar}
                emptyTitle={t('emptySeasons.title')}
                emptyDescription={t('emptySeasons.description')}
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
    </div>
  );
}

export default function AdminLeaderboardsPage() {
  return (
    <Suspense
      fallback={
        <div className='space-y-5'>
          <Skeleton className='h-16 rounded-lg' />
          <div className='grid grid-cols-2 md:grid-cols-4 gap-3'>
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
