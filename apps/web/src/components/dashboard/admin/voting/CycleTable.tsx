'use client';

import { useLocale } from 'next-intl';
import { Badge } from '@foodwaste/ui';
import { Button } from '@foodwaste/ui';
import { CycleStatus } from '@foodwaste/shared';
import { CalendarDays, Target } from 'lucide-react';
import type { VotingCycleRow } from '@/types/voting';
import { AdminDataTable, type ColumnDef } from '@/components/dashboard/admin/admin-data-table';
import { formatCount, seasonProgressPercent } from '@/lib/format';

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

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface CycleTableProps {
  cycles: VotingCycleRow[];
  total: number;
  totalPages: number;
  page: number;
  isLoading: boolean;
  onPageChange: (page: number) => void;
  onEdit: (cycle: VotingCycleRow) => void;
  onActivate: (id: string) => void;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function CycleTable({
  cycles,
  total,
  totalPages,
  page,
  isLoading,
  onPageChange,
  onEdit,
  onActivate,
  onArchive,
  onDelete,
}: CycleTableProps) {
  const locale = useLocale();

  const columns: ColumnDef<VotingCycleRow>[] = [
    {
      key: 'name',
      header: 'Name',
      render: cycle => (
        <div>
          <p className='text-xs font-medium'>{cycle.name}</p>
          <p className='text-[10px] text-muted-foreground'>Cycle #{cycle.cycleNumber}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: cycle => (
        <Badge className={`text-[10px] ${STATUS_STYLES[cycle.status] ?? ''}`}>
          {cycle.status.replace('_', ' ')}
        </Badge>
      ),
    },
    {
      key: 'dates',
      header: 'Dates',
      render: cycle => (
        <div className='flex items-center gap-1.5 text-xs text-muted-foreground'>
          <CalendarDays className='size-3 shrink-0' />
          <span>
            {formatDate(cycle.cycleStartDate)} — {formatDate(cycle.cycleEndDate)}
          </span>
        </div>
      ),
    },
    {
      key: 'goal',
      header: 'Season Bag Goal',
      render: cycle => {
        // An absent target is not a zero target: with no denominator there is no
        // percentage to draw, so the bar stays empty rather than claiming 0%.
        const pct = seasonProgressPercent(cycle.seasonBagProgress, cycle.seasonBagTarget);
        return (
          <div className='min-w-[120px]'>
            <div className='flex items-center gap-xs text-xs'>
              <Target className='size-3 shrink-0 text-muted-foreground' />
              <span className='tabular-nums'>
                {formatCount(locale, cycle.seasonBagProgress)} /{' '}
                {formatCount(locale, cycle.seasonBagTarget)}
              </span>
              {pct !== null && <span className='text-[10px] text-muted-foreground'>({pct}%)</span>}
            </div>
            <div className='mt-xs h-1 w-full overflow-hidden rounded-full bg-muted'>
              <div
                className='h-full rounded-full bg-primary transition-all'
                style={{ width: `${pct ?? 0}%` }}
              />
            </div>
          </div>
        );
      },
    },
    {
      key: 'prizes',
      header: 'Prizes',
      render: cycle => (
        <span className='text-xs text-muted-foreground'>{cycle.prizes.length} prize(s)</span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: cycle => (
        <div className='flex flex-wrap gap-1.5'>
          {cycle.status === CycleStatus.DRAFT && (
            <>
              <Button
                size='sm'
                variant='outline'
                className='h-6 px-sm text-[10px]'
                onClick={() => onEdit(cycle)}
              >
                Edit
              </Button>
              <Button
                size='sm'
                className='h-6 px-sm text-[10px]'
                onClick={() => onActivate(cycle._id)}
              >
                Activate
              </Button>
              <Button
                size='sm'
                variant='outline'
                className='h-6 px-sm text-[10px] border-destructive/40 text-destructive hover:bg-destructive/5'
                onClick={() => onDelete(cycle._id)}
              >
                Delete
              </Button>
            </>
          )}
          {cycle.status === CycleStatus.ACTIVE && (
            <Button
              size='sm'
              variant='outline'
              className='h-6 px-sm text-[10px]'
              onClick={() => onEdit(cycle)}
            >
              Edit
            </Button>
          )}
          {(cycle.status === CycleStatus.COMPLETED || cycle.status === CycleStatus.EXPIRED) && (
            <Button
              size='sm'
              variant='outline'
              className='h-6 px-sm text-[10px]'
              onClick={() => onArchive(cycle._id)}
            >
              Archive
            </Button>
          )}
          {cycle.status !== CycleStatus.DRAFT &&
            cycle.status !== CycleStatus.ACTIVE &&
            cycle.status !== CycleStatus.COMPLETED &&
            cycle.status !== CycleStatus.EXPIRED && (
              <span className='text-[10px] text-muted-foreground/50'>—</span>
            )}
        </div>
      ),
    },
  ];

  return (
    <AdminDataTable
      columns={columns}
      data={cycles}
      isLoading={isLoading}
      page={page}
      totalPages={totalPages}
      total={total}
      onPageChange={onPageChange}
      searchValue=''
      searchPlaceholder='Search cycles…'
      onSearchChange={() => {}}
      emptyTitle='No voting cycles yet'
      emptyDescription='Create your first voting cycle to get started.'
    />
  );
}
