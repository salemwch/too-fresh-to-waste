'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@foodwaste/ui';
import { Button } from '@foodwaste/ui';
import { Plus, RefreshCw, Vote } from 'lucide-react';
import { votingAdminService } from '@/services/voting.service';
import type { VotingCycleRow, CreateCyclePayload } from '@/types/voting';
import { CycleTable } from '@/components/dashboard/admin/voting/CycleTable';
import { CycleFormDialog } from '@/components/dashboard/admin/voting/CycleFormDialog';

// ─── Query key factory ────────────────────────────────────────────────────────

const votingKeys = {
  all: ['admin', 'voting'] as const,
  cycles: (page: number, limit: number) => ['admin', 'voting', 'cycles', page, limit] as const,
};

const PAGE_LIMIT = 10;

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function VotingAdminPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCycle, setEditingCycle] = useState<VotingCycleRow | null>(null);

  // ─── Data fetching ────────────────────────────────────────────────────────

  const {
    data: cyclesRes,
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: votingKeys.cycles(page, PAGE_LIMIT),
    queryFn: () => votingAdminService.listCycles(page, PAGE_LIMIT),
  });

  const cycles: VotingCycleRow[] = cyclesRes?.data.data ?? [];
  const meta = cyclesRes?.data.meta;
  const total = meta?.total ?? 0;
  const totalPages = meta?.totalPages ?? 1;

  // ─── Mutations ────────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: (payload: CreateCyclePayload) =>
      editingCycle
        ? votingAdminService.updateCycle(editingCycle._id, payload)
        : votingAdminService.createCycle(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: votingKeys.all });
      setDialogOpen(false);
      setEditingCycle(null);
    },
  });

  const activateMutation = useMutation({
    mutationFn: (id: string) => votingAdminService.activateCycle(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: votingKeys.all }),
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => votingAdminService.archiveCycle(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: votingKeys.all }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => votingAdminService.deleteCycle(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: votingKeys.all }),
  });

  // ─── Handlers ─────────────────────────────────────────────────────────────

  function handleCreate() {
    setEditingCycle(null);
    setDialogOpen(true);
  }

  function handleEdit(cycle: VotingCycleRow) {
    setEditingCycle(cycle);
    setDialogOpen(true);
  }

  function handleDialogClose(open: boolean) {
    setDialogOpen(open);
    if (!open) setEditingCycle(null);
  }

  function handleSubmit(payload: CreateCyclePayload) {
    createMutation.mutate(payload);
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className='space-y-5'>
      {/* Header */}
      <div className='flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between'>
        <div>
          <h1 className='text-xl font-bold tracking-tight'>Voting Cycles</h1>
          <p className='mt-0.5 text-sm text-muted-foreground'>
            Manage community voting cycles, prizes, and eligibility settings.
          </p>
        </div>
        <div className='flex items-center gap-2'>
          <Button
            size='sm'
            variant='outline'
            onClick={() => void refetch()}
            disabled={isFetching}
            className='h-7 px-2.5 text-xs'
          >
            <RefreshCw className={`me-1.5 size-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button size='sm' onClick={handleCreate} className='h-7 px-3 text-xs'>
            <Plus className='me-1.5 size-3.5' />
            Create Cycle
          </Button>
        </div>
      </div>

      {/* Stats row */}
      <div className='flex flex-wrap gap-3'>
        <div className='flex items-center gap-1.5 rounded-lg border border-border/60 bg-card px-3 py-1.5'>
          <Vote className='size-3.5 text-primary' />
          <span className='text-xs font-semibold tabular-nums'>{total}</span>
          <span className='text-xs text-muted-foreground'>total cycle(s)</span>
        </div>
      </div>

      {/* Table card */}
      <Card className='border-border/60'>
        <CardHeader className='pb-3'>
          <CardTitle className='text-sm'>All Cycles</CardTitle>
          <CardDescription className='text-xs'>
            Showing {cycles.length} of {total} cycle(s)
          </CardDescription>
        </CardHeader>
        <CardContent className='p-0'>
          <CycleTable
            cycles={cycles}
            total={total}
            totalPages={totalPages}
            page={page}
            isLoading={isLoading}
            onPageChange={setPage}
            onEdit={handleEdit}
            onActivate={id => activateMutation.mutate(id)}
            onArchive={id => archiveMutation.mutate(id)}
            onDelete={id => deleteMutation.mutate(id)}
          />
        </CardContent>
      </Card>

      {/* Create / Edit dialog */}
      <CycleFormDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        editingCycle={editingCycle}
        onSubmit={handleSubmit}
        isSubmitting={createMutation.isPending}
      />
    </div>
  );
}
