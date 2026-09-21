'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
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

// ─── Form defaults ────────────────────────────────────────────────────────────
// Shared by a brand-new cycle and by an older one that predates the field, so
// both land the admin on an editable number rather than an empty input.

const DEFAULT_GOAL_TARGET = 30000;
const DEFAULT_MINIMUM_BAGS = 50;
const DEFAULT_RECIPIENT_COUNT = 5;

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
  const t = useTranslations('adminVoting.form');
  const tStatus = useTranslations('adminVoting.status');
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
  const [goalTarget, setGoalTarget] = useState(DEFAULT_GOAL_TARGET);
  const [minimumBags, setMinimumBags] = useState(DEFAULT_MINIMUM_BAGS);
  const [recipientCount, setRecipientCount] = useState(DEFAULT_RECIPIENT_COUNT);
  const [prizes, setPrizes] = useState<PrizeFormItem[]>(DEFAULT_PRIZES);

  /*
   * Load the cycle being edited, or clear the form for a new one.
   *
   * Adjusted during render on a change of cycle or open state: React re-runs
   * with the right values before committing, so the previous cycle is never
   * shown for a frame in the dialog for a different one.
   */
  const [lastSync, setLastSync] = useState({ editingCycle, open });
  if (lastSync.editingCycle !== editingCycle || lastSync.open !== open) {
    setLastSync({ editingCycle, open });
    if (editingCycle) {
      setName(editingCycle.name);
      setStartDate(toDateInput(editingCycle.cycleStartDate));
      setEndDate(toDateInput(editingCycle.cycleEndDate));
      // A legacy cycle can be missing these entirely, and the number inputs
      // below cannot hold `undefined` — they would flip to uncontrolled and warn.
      // Falling back to the same defaults a new cycle starts from keeps the form
      // editable, and the admin sees a value they can correct.
      setGoalTarget(editingCycle.seasonBagTarget ?? DEFAULT_GOAL_TARGET);
      setMinimumBags(editingCycle.minimumBags ?? DEFAULT_MINIMUM_BAGS);
      setRecipientCount(editingCycle.recipientCount ?? DEFAULT_RECIPIENT_COUNT);
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
  }

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
          <DialogTitle>{isEdit ? t('editTitle') : t('createTitle')}</DialogTitle>
        </DialogHeader>

        {isLocked && (
          <p className='rounded-lg border border-warning/30 bg-warning/10 px-md py-sm text-xs text-warning'>
            {/* The status was interpolated raw, so a French page read
                "This cycle is BALLOT_OPEN". */}
            {t('lockedNotice', {
              status: editingCycle
                ? tStatus(editingCycle.status.toLowerCase() as Parameters<typeof tStatus>[0])
                : '',
            })}
          </p>
        )}

        <form onSubmit={handleSubmit} className='space-y-lg'>
          {/* Name */}
          <div className='space-y-1.5'>
            <Label className='text-xs font-medium'>{t('name')} *</Label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={t('namePlaceholder')}
              required
              disabled={isLocked}
              className='h-8 text-xs'
            />
          </div>

          {/* Dates */}
          <div className='grid grid-cols-2 gap-lg'>
            <div className='space-y-1.5'>
              <Label className='text-xs font-medium'>{t('startDate')} *</Label>
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
              <Label className='text-xs font-medium'>{t('endDate')} *</Label>
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
          <div className='grid grid-cols-3 gap-lg'>
            <div className='space-y-1.5'>
              <Label className='text-xs font-medium'>{t('communityGoal')} *</Label>
              <Input
                type='number'
                value={goalTarget}
                onChange={e => setGoalTarget(Number(e.target.value))}
                min={1}
                required
                disabled={isLocked}
                className='h-8 text-xs'
              />
              <p className='text-[10px] text-muted-foreground'>{t('communityGoalHelp')}</p>
            </div>
            <div className='space-y-1.5'>
              <Label className='text-xs font-medium'>{t('minBags')} *</Label>
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
              <p className='text-[10px] text-muted-foreground'>{t('minBagsHelp')}</p>
            </div>
            <div className='space-y-1.5'>
              <Label className='text-xs font-medium'>{t('recipients')} *</Label>
              <Input
                type='number'
                value={recipientCount}
                onChange={e => setRecipientCount(Number(e.target.value))}
                min={1}
                max={50}
                required
                className='h-8 text-xs'
              />
              <p className='text-[10px] text-muted-foreground'>{t('recipientsHelp')}</p>
            </div>
          </div>

          {/* Prize builder */}
          <PrizeBuilder prizes={prizes} onChange={setPrizes} disabled={isLocked} />

          {/* Footer */}
          <div className='flex justify-end gap-sm pt-sm border-t border-border/60'>
            <Button
              type='button'
              variant='outline'
              onClick={() => onOpenChange(false)}
              className='h-8 px-lg text-xs'
            >
              {t('cancel')}
            </Button>
            <Button type='submit' disabled={isSubmitting} className='px-lg text-xs'>
              {isSubmitting ? t('saving') : isEdit ? t('update') : t('create')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
