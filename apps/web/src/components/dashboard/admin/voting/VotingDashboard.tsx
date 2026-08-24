'use client';

import { useLocale } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from '@foodwaste/ui';
import { CycleStatus } from '@foodwaste/shared';
import { votingAdminService } from '@/services/voting.service';
import type { VotingCycleRow } from '@/types/voting';
import { formatCount, MISSING_COUNT, seasonProgressPercent } from '@/lib/format';

// ─── Status badge styles ──────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  [CycleStatus.DRAFT]: 'bg-muted text-muted-foreground border-border',
  [CycleStatus.ACTIVE]: 'bg-primary/10 text-primary border-primary/20',
  [CycleStatus.BALLOT_OPEN]: 'bg-warning/10 text-warning border-warning/20',
  [CycleStatus.TALLYING]: 'bg-warning/10 text-warning border-warning/20',
  [CycleStatus.COMPLETED]: 'bg-success/10 text-success border-success/20',
  [CycleStatus.EXPIRED]: 'bg-destructive/10 text-destructive border-destructive/20',
  [CycleStatus.ARCHIVED]: 'bg-muted text-muted-foreground border-border',
};

// ─── Simple progress bar (no shadcn Progress in this project) ─────────────────

function ProgressBar({ value, className = '' }: { value: number; className?: string }) {
  const clamped = Math.min(Math.max(value, 0), 100);
  return (
    <div className={`h-2 w-full overflow-hidden rounded-full bg-muted ${className}`}>
      <div
        className='h-full rounded-full bg-primary transition-all duration-300'
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

// ─── Countdown helper ─────────────────────────────────────────────────────────

function getCountdown(cycle: VotingCycleRow): string {
  const target =
    cycle.status === CycleStatus.BALLOT_OPEN ? cycle.ballotClosesAt : cycle.cycleEndDate;
  if (!target) return '';
  const diff = new Date(target).getTime() - Date.now();
  if (diff <= 0) return 'Ended';
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const mins = Math.floor((diff % 3_600_000) / 60_000);
  if (days > 0) return `${days}d ${hours}h remaining`;
  if (hours > 0) return `${hours}h ${mins}m remaining`;
  return `${mins}m remaining`;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface VotingDashboardProps {
  cycle: VotingCycleRow;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function VotingDashboard({ cycle }: VotingDashboardProps) {
  const queryClient = useQueryClient();
  const locale = useLocale();

  const isBallotPhase = [
    CycleStatus.BALLOT_OPEN,
    CycleStatus.TALLYING,
    CycleStatus.COMPLETED,
  ].includes(cycle.status as CycleStatus);

  // ─── Stats query (auto-refresh every 60s during BALLOT_OPEN) ───────────────

  const { data: statsRes } = useQuery({
    queryKey: ['admin', 'voting', 'stats', cycle._id],
    queryFn: () => votingAdminService.getCycleStats(cycle._id),
    enabled: isBallotPhase,
    refetchInterval: cycle.status === CycleStatus.BALLOT_OPEN ? 60_000 : false,
  });

  const statsData = statsRes?.data.data;

  // ─── Mutations ────────────────────────────────────────────────────────────

  const tallyMutation = useMutation({
    mutationFn: () => votingAdminService.manualTally(cycle._id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'voting'] }),
  });

  const retrySnapshotMutation = useMutation({
    mutationFn: () => votingAdminService.retrySnapshot(cycle._id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'voting'] }),
  });

  // ─── Derived values ───────────────────────────────────────────────────────

  // null when the cycle carries no target — the bar then sits at zero without
  // the label claiming the season has made 0% progress.
  const goalPercent = seasonProgressPercent(cycle.seasonBagProgress, cycle.seasonBagTarget);

  const countdown = getCountdown(cycle);

  const sortedResults = statsData?.results
    ? [...statsData.results].sort((a, b) => b.totalWeightedVotes - a.totalWeightedVotes)
    : [];

  const maxVotes = sortedResults[0]?.totalWeightedVotes ?? 1;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className='space-y-xl'>
      {/* ── Status Header ── */}
      <Card className='border-border/60'>
        <CardHeader className='pb-md'>
          <div className='flex flex-col gap-sm sm:flex-row sm:items-start sm:justify-between'>
            <CardTitle className='text-lg'>{cycle.name}</CardTitle>
            <Badge className={STATUS_STYLES[cycle.status] ?? ''}>{cycle.status}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className='flex flex-wrap gap-lg text-sm text-muted-foreground'>
            {countdown && <span className='font-medium text-foreground'>{countdown}</span>}
            <span>Cycle #{cycle.cycleNumber}</span>
            {cycle.ballotOpensAt && (
              <span>
                Ballot:{' '}
                {new Date(cycle.ballotOpensAt).toLocaleDateString('en-GB', {
                  day: '2-digit',
                  month: 'short',
                })}
                {cycle.ballotClosesAt &&
                  ` → ${new Date(cycle.ballotClosesAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}`}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Community Goal ── */}
      <Card className='border-border/60'>
        <CardHeader className='pb-md'>
          <CardTitle className='text-sm font-semibold'>Community Goal</CardTitle>
        </CardHeader>
        <CardContent className='space-y-md'>
          <ProgressBar value={goalPercent ?? 0} />
          <div className='flex items-center justify-between text-sm'>
            <span className='text-muted-foreground'>
              {formatCount(locale, cycle.seasonBagProgress)} /{' '}
              {formatCount(locale, cycle.seasonBagTarget)} bags saved
            </span>
            <span className='font-semibold tabular-nums'>
              {goalPercent === null ? MISSING_COUNT : `${goalPercent.toFixed(0)}%`}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* ── Snapshot Warning ── */}
      {cycle.status === CycleStatus.BALLOT_OPEN && !cycle.snapshotReady && (
        <Card className='border-warning/50 bg-warning/5'>
          <CardContent className='flex items-center justify-between pt-xl pb-xl'>
            <div>
              <p className='text-sm font-medium text-warning'>Snapshot not ready</p>
              <p className='text-xs text-muted-foreground mt-xxs'>
                Voting is blocked until the eligibility snapshot completes.
              </p>
            </div>
            <Button
              size='sm'
              variant='outline'
              className='shrink-0 border-warning text-warning hover:bg-warning/10 ms-lg'
              onClick={() => retrySnapshotMutation.mutate()}
              disabled={retrySnapshotMutation.isPending}
            >
              {retrySnapshotMutation.isPending ? 'Retrying…' : 'Retry Snapshot'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Ballot Results ── */}
      {isBallotPhase && (
        <Card className='border-border/60'>
          <CardHeader className='pb-md'>
            <div className='flex items-center justify-between'>
              <CardTitle className='text-sm font-semibold'>Ballot Results</CardTitle>
              {statsData && (
                <span className='text-xs text-muted-foreground'>
                  {statsData.totalVoters} / {statsData.totalEligible} eligible (
                  {(statsData.participationRate * 100).toFixed(1)}% participation)
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent className='space-y-lg'>
            {!statsData ? (
              <div className='space-y-md'>
                {[1, 2, 3].map(i => (
                  <div key={i} className='space-y-1.5'>
                    <div className='h-3 w-1/3 rounded bg-muted animate-pulse' />
                    <div className='h-2 w-full rounded-full bg-muted animate-pulse' />
                  </div>
                ))}
              </div>
            ) : sortedResults.length === 0 ? (
              <p className='py-lg text-center text-sm text-muted-foreground'>No votes cast yet.</p>
            ) : (
              sortedResults.map((result, index) => {
                const pct = maxVotes > 0 ? (result.totalWeightedVotes / maxVotes) * 100 : 0;
                const isLeading = index === 0;
                return (
                  <div
                    key={result.prizeId}
                    className={`space-y-1.5 rounded-lg p-md ${isLeading ? 'bg-primary/5 ring-1 ring-primary/20' : ''}`}
                  >
                    <div className='flex items-center justify-between text-sm'>
                      <span className={isLeading ? 'font-semibold text-primary' : 'font-medium'}>
                        {isLeading && (
                          <span className='me-1.5 inline-block rounded-sm bg-primary/10 px-xs py-xxs text-[10px] font-bold uppercase tracking-wide text-primary'>
                            Leading
                          </span>
                        )}
                        {result.name}
                      </span>
                      <span className='text-xs text-muted-foreground tabular-nums'>
                        {result.totalWeightedVotes.toLocaleString()} pts · {result.voterCount} voter
                        {result.voterCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <ProgressBar value={pct} />
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Manual Tally Button ── */}
      {cycle.status === CycleStatus.TALLYING && (
        <div className='flex justify-end'>
          <Button
            onClick={() => tallyMutation.mutate()}
            disabled={tallyMutation.isPending}
            className='min-w-36'
          >
            {tallyMutation.isPending ? 'Running tally…' : 'Run Manual Tally'}
          </Button>
        </div>
      )}

      {/* ── Winner Panel ── */}
      {cycle.status === CycleStatus.COMPLETED && cycle.winner && (
        <Card className='border-success/50 bg-success/5'>
          <CardHeader className='pb-md'>
            <CardTitle className='text-sm font-semibold text-success'>Winner Announced</CardTitle>
          </CardHeader>
          <CardContent className='space-y-xs'>
            <p className='text-xl font-bold'>{cycle.winner.name}</p>
            <p className='text-sm text-muted-foreground'>
              {formatCount(locale, cycle.winner.totalWeightedVotes)} weighted votes ·{' '}
              {formatCount(locale, cycle.winner.voterCount)} voter
              {cycle.winner.voterCount !== 1 ? 's' : ''}
            </p>
            <p className='text-sm text-muted-foreground'>
              Top {cycle.recipientCount} leaderboard users receive this prize.
            </p>
          </CardContent>
        </Card>
      )}

      {/* ── Expired State ── */}
      {cycle.status === CycleStatus.EXPIRED && (
        <Card className='border-destructive/50 bg-destructive/5'>
          <CardContent className='pt-xl pb-xl'>
            <p className='text-sm font-medium text-destructive'>Cycle expired</p>
            <p className='text-xs text-muted-foreground mt-xxs'>
              The community goal was not met. Archive this cycle to start a new one.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
