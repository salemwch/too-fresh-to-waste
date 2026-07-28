'use client';

import { useState, useEffect } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from '@foodwaste/ui';
import { CycleStatus } from '@foodwaste/shared';
import type { VotingCycleRow, CreateCyclePayload } from '@/types/voting';
import { PrizeBuilder, DEFAULT_PRIZES, type PrizeFormItem } from './PrizeBuilder';

// ─── Props ────────────────────────────────────────────────────────────────────

interface CycleFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingCycle: VotingCycleRow | null;
  onSubmit: (payload: CreateCyclePayload) => void;
  isSubmitting: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDateInput(iso: string | null | undefined): string {
  if (!iso) return '';
  return iso.split('T')[0] ?? '';
}

// ─── Component ───────────────────────────────────────────────────────────────

export function CycleFormDialog({
  open,
  onOpenChange,
  editingCycle,
  onSubmit,
  isSubmitting,
}: CycleFormDialogProps) {
  const isEdit = !!editingCycle;

  // Fields that are locked once the cycle is no longer a DRAFT
  const isLocked = isEdit && editingCycle.status !== CycleStatus.DRAFT;
  // End date stays editable even when ACTIVE
  const isEndDateLocked =
    isEdit &&
    editingCycle.status !== CycleStatus.DRAFT &&
    editingCycle.status !== CycleStatus.ACTIVE;

  // ─── Form state ───────────────────────────────────────────────────────────

  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [goalTarget, setGoalTarget] = useState(30000);
  const [minimumBags, setMinimumBags] = useState(50);
  const [recipientCount, setRecipientCount] = useState(5);
  const [prizes, setPrizes] = useState<PrizeFormItem[]>(DEFAULT_PRIZES);

  // Sync state when editingCycle changes (or dialog opens for a new cycle)
  useEffect(() => {
    if (editingCycle) {
      setName(editingCycle.name);
      setStartDate(toDateInput(editingCycle.cycleStartDate));
      setEndDate(toDateInput(editingCycle.cycleEndDate));
      setGoalTarget(editingCycle.seasonBagTarget);
      setMinimumBags(editingCycle.minimumBags);
      setRecipientCount(editingCycle.recipientCount);
      setPrizes(
        editingCycle.prizes.map(p => ({
          name: p.name,
          description: p.description,
          ...(p.imageUrl ? { imageUrl: p.imageUrl } : {}),
          category: p.category,
          value: p.value,
        })),
      );
    } else {
      // Reset to defaults for new cycle
      setName('');
      setStartDate('');
      setEndDate('');
      setGoalTarget(30000);
      setMinimumBags(50);
      setRecipientCount(5);
      setPrizes(DEFAULT_PRIZES);
    }
  }, [editingCycle, open]);

  // ─── Submit ───────────────────────────────────────────────────────────────

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      name,
      cycleStartDate: new Date(startDate).toISOString(),
      cycleEndDate: new Date(endDate).toISOString(),
      seasonBagTarget: goalTarget,
      minimumBags,
      recipientCount,
      prizes: prizes.map(({ imageUrl, ...rest }) => ({
        ...rest,
        ...(imageUrl ? { imageUrl } : {}),
      })),
    });
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-2xl max-h-[85vh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Voting Cycle' : 'Create Voting Cycle'}</DialogTitle>
        </DialogHeader>

        {isLocked && (
          <p className='rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning'>
            This cycle is <span className='font-semibold'>{editingCycle?.status}</span> — most
            fields are read-only. Only the end date and recipient count can be changed.
          </p>
        )}

        <form onSubmit={handleSubmit} className='space-y-4'>
          {/* Name */}
          <div className='space-y-1.5'>
            <Label className='text-xs font-medium'>Cycle Name *</Label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder='e.g. Q3 2026 Voting Cycle'
              required
              disabled={isLocked}
              className='h-8 text-xs'
            />
          </div>

          {/* Dates */}
          <div className='grid grid-cols-2 gap-4'>
            <div className='space-y-1.5'>
              <Label className='text-xs font-medium'>Start Date *</Label>
              <Input
                type='date'
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                required
                disabled={isLocked}
                className='h-8 text-xs'
              />
            </div>
            <div className='space-y-1.5'>
              <Label className='text-xs font-medium'>End Date *</Label>
              <Input
                type='date'
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                required
                disabled={isEndDateLocked}
                className='h-8 text-xs'
              />
            </div>
          </div>

          {/* Numeric fields */}
          <div className='grid grid-cols-3 gap-4'>
            <div className='space-y-1.5'>
              <Label className='text-xs font-medium'>Community Goal *</Label>
              <Input
                type='number'
                value={goalTarget}
                onChange={e => setGoalTarget(Number(e.target.value))}
                min={1}
                required
                disabled={isLocked}
                className='h-8 text-xs'
              />
              <p className='text-[10px] text-muted-foreground'>Bags saved target</p>
            </div>
            <div className='space-y-1.5'>
              <Label className='text-xs font-medium'>Min. Bags *</Label>
              <Input
                type='number'
                value={minimumBags}
                onChange={e => setMinimumBags(Number(e.target.value))}
                min={1}
                max={500}
                required
                disabled={isLocked}
                className='h-8 text-xs'
              />
              <p className='text-[10px] text-muted-foreground'>Eligibility threshold</p>
            </div>
            <div className='space-y-1.5'>
              <Label className='text-xs font-medium'>Recipients *</Label>
              <Input
                type='number'
                value={recipientCount}
                onChange={e => setRecipientCount(Number(e.target.value))}
                min={1}
                max={50}
                required
                className='h-8 text-xs'
              />
              <p className='text-[10px] text-muted-foreground'>Winners to select</p>
            </div>
          </div>

          {/* Prize builder */}
          <PrizeBuilder prizes={prizes} onChange={setPrizes} disabled={isLocked} />

          {/* Footer */}
          <div className='flex justify-end gap-2 pt-2 border-t border-border/60'>
            <Button
              type='button'
              variant='outline'
              onClick={() => onOpenChange(false)}
              className='h-8 px-4 text-xs'
            >
              Cancel
            </Button>
            <Button type='submit' disabled={isSubmitting} className='h-8 px-4 text-xs'>
              {isSubmitting ? 'Saving…' : isEdit ? 'Update Cycle' : 'Create Cycle'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
