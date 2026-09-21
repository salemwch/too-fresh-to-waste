'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Trophy, Crown, Medal, CheckCircle2, Package, XCircle, Eye, ArrowLeft } from 'lucide-react';
import { Link } from '@/i18n/routing';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  Badge,
  Avatar,
  AvatarFallback,
  Sheet,
  SheetContent,
  SheetTitle,
  Separator,
} from '@foodwaste/ui';
import { Skeleton } from '@/components/ui/skeleton';
import { votingAdminService } from '@/services/voting.service';
import type { VotingCycleRow, PrizeClaimRow, UpdatePrizeClaimPayload } from '@/types/voting';
import { activateOnKey, cn } from '@/lib/utils';
import { useFormat } from '@/lib/use-format';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getRankIcon(rank: number) {
  if (rank === 1) return <Crown className='size-4 text-amber-500' />;
  if (rank === 2) return <Medal className='size-4 text-gray-400' />;
  if (rank === 3) return <Medal className='size-4 text-amber-700' />;
  return <span className='text-xs font-bold text-muted-foreground tabular-nums'>#{rank}</span>;
}

function getClaimStatusStyle(status: string | null) {
  const map: Record<string, string> = {
    pending: 'bg-amber-50 text-amber-700 border-amber-200',
    verified: 'bg-sky-50 text-sky-700 border-sky-200',
    delivered: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    rejected: 'bg-rose-50 text-rose-700 border-rose-200',
  };
  return map[status ?? ''] ?? 'bg-muted text-muted-foreground border-border';
}

function getUserName(userId: PrizeClaimRow['userId']) {
  if (typeof userId === 'string') return userId;
  return `${userId.firstName} ${userId.lastName}`;
}

function getUserEmail(userId: PrizeClaimRow['userId']) {
  if (typeof userId === 'string') return '';
  return userId.email;
}

// ─── Winners Tab ─────────────────────────────────────────────────────────────

function WinnersSection({ cycleId }: { cycleId: string | null }) {
  const fmt = useFormat();
  const t = useTranslations('adminVotingWinners');

  const { data: winners, isLoading } = useQuery({
    queryKey: ['admin', 'voting', 'winners', cycleId],
    queryFn: () => votingAdminService.getCycleWinners(cycleId!).then(r => r.data.data),
    enabled: !!cycleId,
  });

  if (!cycleId) {
    return (
      <div className='flex flex-col items-center justify-center py-6xl gap-md text-center'>
        <Trophy className='size-12 text-muted-foreground' />
        <h3 className='text-md font-semibold'>{t('noCompletedCycle')}</h3>
        <p className='text-sm text-muted-foreground max-w-xs'>{t('noCompletedCycleDesc')}</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className='space-y-md'>
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className='h-16 rounded-lg' />
        ))}
      </div>
    );
  }

  if (!winners || winners.length === 0) {
    return (
      <div className='flex flex-col items-center justify-center py-6xl gap-md text-center'>
        <Trophy className='size-12 text-muted-foreground' />
        <h3 className='text-md font-semibold'>{t('noWinners')}</h3>
        <p className='text-sm text-muted-foreground max-w-xs'>{t('noWinnersDesc')}</p>
      </div>
    );
  }

  return (
    <div className='space-y-sm'>
      {winners.map(winner => (
        <div
          key={winner.userId}
          className='flex items-center gap-md rounded-lg border border-border/60 p-md'
        >
          <div className='flex items-center justify-center w-8'>{getRankIcon(winner.rank)}</div>
          <Avatar className='size-9'>
            <AvatarFallback className='text-[10px]'>
              {`${winner.firstName?.[0] ?? ''}${winner.lastName?.[0] ?? ''}`}
            </AvatarFallback>
          </Avatar>
          <div className='flex-1 min-w-0'>
            <p className='text-xs font-medium'>
              {winner.firstName} {winner.lastName}
            </p>
            <p className='text-[10px] text-muted-foreground'>{winner.email}</p>
          </div>
          <div className='text-end'>
            <p className='text-xs font-bold tabular-nums text-amber-600'>
              {fmt.count(winner.pointsSnapshot)} pts
            </p>
            {winner.hasClaimed ? (
              <Badge
                variant='outline'
                className={cn('text-[10px] mt-xxs', getClaimStatusStyle(winner.claimStatus))}
              >
                {winner.claimStatus}
              </Badge>
            ) : (
              <span className='text-[10px] text-muted-foreground'>{t('notClaimed')}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Prize Claims Tab ────────────────────────────────────────────────────────

function PrizeClaimsSection() {
  const fmt = useFormat();
  const t = useTranslations('adminVotingWinners');
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [selectedClaim, setSelectedClaim] = useState<PrizeClaimRow | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'voting', 'prize-claims', page, statusFilter],
    queryFn: () =>
      votingAdminService.listPrizeClaims(page, 20, statusFilter || undefined).then(r => r.data),
  });

  const claims = data?.data ?? [];
  const meta = data?.meta;

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdatePrizeClaimPayload }) =>
      votingAdminService.updatePrizeClaim(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'voting', 'prize-claims'] });
      setSelectedClaim(null);
    },
  });

  return (
    <div className='space-y-lg'>
      {/* Filters */}
      <div className='flex flex-wrap gap-sm'>
        {['', 'pending', 'verified', 'delivered', 'rejected'].map(s => (
          <Button
            key={s}
            size='sm'
            variant={statusFilter === s ? 'default' : 'outline'}
            className='text-xs'
            onClick={() => {
              setStatusFilter(s);
              setPage(1);
            }}
          >
            {s === '' ? t('allClaims') : s}
          </Button>
        ))}
      </div>

      {/* Claims list */}
      {isLoading ? (
        <div className='space-y-sm'>
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className='h-14 rounded-lg' />
          ))}
        </div>
      ) : claims.length === 0 ? (
        <div className='flex flex-col items-center justify-center py-6xl gap-md text-center'>
          <Package className='size-12 text-muted-foreground' />
          <h3 className='text-md font-semibold'>{t('noClaims')}</h3>
          <p className='text-sm text-muted-foreground max-w-xs'>{t('noClaimsDesc')}</p>
        </div>
      ) : (
        <div className='space-y-sm'>
          {claims.map(claim => (
            <div
              key={claim._id}
              role='button'
              tabIndex={0}
              className='flex items-center gap-md rounded-lg border border-border/60 p-md cursor-pointer hover:bg-muted/30 transition-colors'
              onClick={() => setSelectedClaim(claim)}
              onKeyDown={activateOnKey(() => setSelectedClaim(claim))}
            >
              <Avatar className='size-8'>
                <AvatarFallback className='text-[10px]'>
                  {typeof claim.userId !== 'string'
                    ? `${claim.userId.firstName?.[0] ?? ''}${claim.userId.lastName?.[0] ?? ''}`
                    : '?'}
                </AvatarFallback>
              </Avatar>
              <div className='flex-1 min-w-0'>
                <p className='text-xs font-medium'>{getUserName(claim.userId)}</p>
                <p className='text-[10px] text-muted-foreground'>
                  {t('rank')} #{claim.rank} · {claim.source} · {claim.prizeType}
                </p>
              </div>
              <div className='flex items-center gap-sm'>
                <Badge
                  variant='outline'
                  className={cn('text-[10px]', getClaimStatusStyle(claim.status))}
                >
                  {claim.status}
                </Badge>
                <Eye className='size-3.5 text-muted-foreground' />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <div className='flex justify-center gap-sm pt-sm'>
          <Button
            size='sm'
            variant='outline'
            className='text-xs'
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
          >
            {t('prev')}
          </Button>
          <span className='text-xs self-center tabular-nums'>
            {page} / {meta.totalPages}
          </span>
          <Button
            size='sm'
            variant='outline'
            className='text-xs'
            disabled={page >= meta.totalPages}
            onClick={() => setPage(p => p + 1)}
          >
            {t('next')}
          </Button>
        </div>
      )}

      {/* Claim Detail Drawer */}
      <Sheet open={!!selectedClaim} onOpenChange={v => !v && setSelectedClaim(null)}>
        <SheetContent className='w-full overflow-y-auto sm:max-w-md'>
          <SheetTitle className='sr-only'>{t('claimDetails')}</SheetTitle>
          {selectedClaim && (
            <div className='space-y-xl'>
              <div className='space-y-sm'>
                <h3 className='text-sm font-semibold'>{getUserName(selectedClaim.userId)}</h3>
                <p className='text-xs text-muted-foreground'>
                  {getUserEmail(selectedClaim.userId)}
                </p>
              </div>
              <Separator />
              <div className='grid grid-cols-2 gap-md text-xs'>
                <div>
                  <span className='text-muted-foreground'>{t('rank')}</span>
                  <p className='font-semibold'>#{selectedClaim.rank}</p>
                </div>
                <div>
                  <span className='text-muted-foreground'>{t('points')}</span>
                  <p className='font-semibold tabular-nums'>
                    {fmt.count(selectedClaim.totalPoints)}
                  </p>
                </div>
                <div>
                  <span className='text-muted-foreground'>{t('source')}</span>
                  <p className='font-semibold'>{selectedClaim.source}</p>
                </div>
                <div>
                  <span className='text-muted-foreground'>{t('prizeType')}</span>
                  <p className='font-semibold'>{selectedClaim.prizeType}</p>
                </div>
                {selectedClaim.voucherCode && (
                  <div className='col-span-2'>
                    <span className='text-muted-foreground'>{t('voucherCode')}</span>
                    <p className='font-mono font-semibold'>{selectedClaim.voucherCode}</p>
                  </div>
                )}
                {selectedClaim.establishmentName && (
                  <div className='col-span-2'>
                    <span className='text-muted-foreground'>{t('establishment')}</span>
                    <p className='font-semibold'>{selectedClaim.establishmentName}</p>
                  </div>
                )}
              </div>
              <Separator />
              <div className='space-y-sm'>
                <p className='text-xs font-medium'>{t('currentStatus')}</p>
                <Badge
                  variant='outline'
                  className={cn('text-xs', getClaimStatusStyle(selectedClaim.status))}
                >
                  {selectedClaim.status}
                </Badge>
              </div>
              {selectedClaim.status === 'pending' && (
                <div className='flex gap-sm'>
                  <Button
                    size='sm'
                    variant='outline'
                    className='text-xs text-emerald-600 border-emerald-200 hover:bg-emerald-50'
                    disabled={updateMutation.isPending}
                    onClick={() =>
                      updateMutation.mutate({
                        id: selectedClaim._id,
                        payload: { status: 'verified' },
                      })
                    }
                  >
                    <CheckCircle2 className='me-xs size-3' /> {t('verify')}
                  </Button>
                  <Button
                    size='sm'
                    variant='outline'
                    className='text-xs text-rose-600 border-rose-200 hover:bg-rose-50'
                    disabled={updateMutation.isPending}
                    onClick={() =>
                      updateMutation.mutate({
                        id: selectedClaim._id,
                        payload: { status: 'rejected' },
                      })
                    }
                  >
                    <XCircle className='me-xs size-3' /> {t('reject')}
                  </Button>
                </div>
              )}
              {selectedClaim.status === 'verified' && (
                <Button
                  size='sm'
                  className='text-xs'
                  disabled={updateMutation.isPending}
                  onClick={() =>
                    updateMutation.mutate({
                      id: selectedClaim._id,
                      payload: { status: 'delivered' },
                    })
                  }
                >
                  <Package className='me-xs size-3' /> {t('markDelivered')}
                </Button>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function VotingWinnersPage() {
  const t = useTranslations('adminVotingWinners');
  const [tab, setTab] = useState<'winners' | 'claims'>('winners');

  const { data: cyclesData } = useQuery({
    queryKey: ['admin', 'voting', 'cycles', 1, 50],
    queryFn: () => votingAdminService.listCycles(1, 50),
  });

  const cycles: VotingCycleRow[] = cyclesData?.data.data ?? [];
  const completedCycle = cycles.find(c => c.status === 'COMPLETED');
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null);

  const activeCycleId = selectedCycleId ?? completedCycle?._id ?? null;

  return (
    <div className='space-y-xl'>
      <div className='flex items-center gap-md'>
        <Link href='/admin/voting'>
          <Button size='sm' variant='ghost' className='px-sm text-xs'>
            <ArrowLeft className='me-xs size-3.5' />
            Cycles
          </Button>
        </Link>
        <div>
          <h1 className='text-xl font-bold tracking-tight'>{t('title')}</h1>
          <p className='mt-xxs text-sm text-muted-foreground'>{t('subtitle')}</p>
        </div>
      </div>

      {/* Tab buttons */}
      <div className='flex gap-sm border-b border-border pb-sm'>
        <Button
          size='sm'
          variant={tab === 'winners' ? 'default' : 'ghost'}
          className='text-xs'
          onClick={() => setTab('winners')}
        >
          <Trophy className='me-1.5 size-3.5' />
          {t('tabs.winners')}
        </Button>
        <Button
          size='sm'
          variant={tab === 'claims' ? 'default' : 'ghost'}
          className='text-xs'
          onClick={() => setTab('claims')}
        >
          <Package className='me-1.5 size-3.5' />
          {t('tabs.claims')}
        </Button>
      </div>

      {/* Cycle selector for winners tab */}
      {tab === 'winners' && cycles.filter(c => c.status === 'COMPLETED').length > 1 && (
        <div className='flex flex-wrap gap-sm'>
          {cycles
            .filter(c => c.status === 'COMPLETED')
            .map(c => (
              <Button
                key={c._id}
                size='sm'
                variant={activeCycleId === c._id ? 'default' : 'outline'}
                className='text-xs'
                onClick={() => setSelectedCycleId(c._id)}
              >
                {c.name}
              </Button>
            ))}
        </div>
      )}

      <Card className='border-border/60'>
        <CardHeader className='pb-md'>
          <CardTitle className='text-sm'>
            {tab === 'winners' ? t('tabs.winners') : t('tabs.claims')}
          </CardTitle>
          <CardDescription className='text-xs'>
            {tab === 'winners' ? t('winnersDesc') : t('claimsDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {tab === 'winners' ? <WinnersSection cycleId={activeCycleId} /> : <PrizeClaimsSection />}
        </CardContent>
      </Card>
    </div>
  );
}
