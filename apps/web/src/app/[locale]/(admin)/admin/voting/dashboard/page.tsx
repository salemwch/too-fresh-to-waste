'use client';

import { useQuery } from '@tanstack/react-query';
import { CycleStatus } from '@foodwaste/shared';
import { Card, CardContent, Button } from '@foodwaste/ui';
import { ArrowLeft } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { votingAdminService } from '@/services/voting.service';
import type { VotingCycleRow } from '@/types/voting';
import { VotingDashboard } from '@/components/dashboard/admin/voting/VotingDashboard';

// ─── Live statuses — cycles to surface on this page ──────────────────────────

const LIVE_STATUSES = new Set<string>([
  CycleStatus.ACTIVE,
  CycleStatus.BALLOT_OPEN,
  CycleStatus.TALLYING,
  CycleStatus.COMPLETED,
  CycleStatus.EXPIRED,
]);

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function VotingDashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'voting', 'cycles', 1, 50],
    queryFn: () => votingAdminService.listCycles(1, 50),
  });

  const cycles: VotingCycleRow[] = data?.data.data ?? [];

  // Find the most recent live cycle — ordering: BALLOT_OPEN > TALLYING > ACTIVE > COMPLETED > EXPIRED
  const STATUS_PRIORITY: Record<string, number> = {
    [CycleStatus.BALLOT_OPEN]: 0,
    [CycleStatus.TALLYING]: 1,
    [CycleStatus.ACTIVE]: 2,
    [CycleStatus.COMPLETED]: 3,
    [CycleStatus.EXPIRED]: 4,
  };

  const liveCycle = cycles
    .filter(c => LIVE_STATUSES.has(c.status))
    .sort((a, b) => (STATUS_PRIORITY[a.status] ?? 99) - (STATUS_PRIORITY[b.status] ?? 99))[0];

  // ─── Loading skeleton ─────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className='space-y-xl p-2xl'>
        <div className='h-7 w-48 rounded bg-muted animate-pulse' />
        <div className='h-28 w-full rounded-lg bg-muted animate-pulse' />
        <div className='h-24 w-full rounded-lg bg-muted animate-pulse' />
        <div className='h-48 w-full rounded-lg bg-muted animate-pulse' />
      </div>
    );
  }

  // ─── Empty state ──────────────────────────────────────────────────────────

  if (!liveCycle) {
    return (
      <div className='p-2xl'>
        <div className='mb-lg flex items-center gap-md'>
          <Link href='/admin/voting'>
            <Button size='sm' variant='ghost' className='h-7 px-sm text-xs'>
              <ArrowLeft className='me-xs size-3.5' />
              Cycles
            </Button>
          </Link>
          <h1 className='text-xl font-bold tracking-tight'>Voting Dashboard</h1>
        </div>
        <Card className='border-border/60'>
          <CardContent className='flex flex-col items-center justify-center py-3xl text-center'>
            <p className='text-sm font-medium'>No active voting cycle</p>
            <p className='mt-xs text-xs text-muted-foreground'>
              Create a cycle from Cycle Management and activate it to see live data here.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Dashboard ────────────────────────────────────────────────────────────

  return (
    <div className='p-2xl'>
      <div className='mb-xl flex items-center justify-between'>
        <div className='flex items-center gap-md'>
          <Link href='/admin/voting'>
            <Button size='sm' variant='ghost' className='h-7 px-sm text-xs'>
              <ArrowLeft className='me-xs size-3.5' />
              Cycles
            </Button>
          </Link>
          <h1 className='text-xl font-bold tracking-tight'>Voting Dashboard</h1>
        </div>
      </div>
      <VotingDashboard cycle={liveCycle} />
    </div>
  );
}
