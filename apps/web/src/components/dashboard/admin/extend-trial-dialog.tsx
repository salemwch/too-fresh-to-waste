'use client';

import { useEffect, useState } from 'react';
import { CalendarClock, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Button,
} from '@foodwaste/ui';
import { cn } from '@/lib/utils';
import type { ExtendTrialPayload } from '@/types/admin';

interface ExtendTrialDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** ISO string of the current trialEndsAt, if any — shown for context. */
  currentTrialEndsAt?: string;
  isLoading?: boolean;
  onConfirm: (payload: ExtendTrialPayload) => void;
}

type Mode = 'days' | 'date';

const DAY_PRESETS = [7, 14, 30, 60, 90] as const;

function toDateInputValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const tz = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

export function ExtendTrialDialog({
  open,
  onOpenChange,
  currentTrialEndsAt,
  isLoading,
  onConfirm,
}: ExtendTrialDialogProps) {
  const [mode, setMode] = useState<Mode>('days');
  const [days, setDays] = useState<number>(30);
  const [dateValue, setDateValue] = useState<string>('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!open) return;
    setMode('days');
    setDays(30);
    setNotes('');
    if (currentTrialEndsAt) {
      const base = new Date(currentTrialEndsAt);
      base.setDate(base.getDate() + 30);
      setDateValue(toDateInputValue(base.toISOString()));
    } else {
      const base = new Date();
      base.setDate(base.getDate() + 30);
      setDateValue(toDateInputValue(base.toISOString()));
    }
  }, [open, currentTrialEndsAt]);

  function handleConfirm() {
    const payload: ExtendTrialPayload = { sendNotification: true };
    if (mode === 'days') {
      payload.extendByDays = days;
    } else if (dateValue) {
      const endOfDay = new Date(`${dateValue}T23:59:59.999Z`);
      payload.trialEndsAt = endOfDay.toISOString();
    }
    if (notes.trim()) {
      payload.adminNotes = notes.trim();
    }
    onConfirm(payload);
  }

  const isValid = mode === 'days' ? days >= 1 && days <= 365 : dateValue.length > 0;

  const currentLabel = currentTrialEndsAt
    ? new Date(currentTrialEndsAt).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '—';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-md'>
        <DialogHeader>
          <div className='flex items-start gap-3'>
            <div className='mt-0.5 shrink-0 rounded-full bg-indigo-100 p-1.5 text-indigo-600'>
              <CalendarClock className='size-4' />
            </div>
            <div>
              <DialogTitle className='text-base'>Extend free trial</DialogTitle>
              <DialogDescription className='mt-1 text-sm'>
                Current trial ends: <span className='font-medium'>{currentLabel}</span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className='mt-3 space-y-4'>
          {/* Mode toggle */}
          <div className='flex gap-2'>
            <button
              type='button'
              onClick={() => setMode('days')}
              className={cn(
                'flex-1 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors',
                mode === 'days'
                  ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                  : 'border-border bg-background text-muted-foreground hover:bg-muted/50',
              )}
            >
              Extend by days
            </button>
            <button
              type='button'
              onClick={() => setMode('date')}
              className={cn(
                'flex-1 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors',
                mode === 'date'
                  ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                  : 'border-border bg-background text-muted-foreground hover:bg-muted/50',
              )}
            >
              Pick a date
            </button>
          </div>

          {mode === 'days' ? (
            <div className='space-y-2'>
              <div className='flex flex-wrap gap-1.5'>
                {DAY_PRESETS.map(preset => (
                  <button
                    key={preset}
                    type='button'
                    onClick={() => setDays(preset)}
                    className={cn(
                      'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
                      days === preset
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:bg-muted/50',
                    )}
                  >
                    {preset}d
                  </button>
                ))}
              </div>
              <label className='block'>
                <span className='text-xs font-medium text-foreground'>
                  Custom days <span className='text-muted-foreground'>(1–365)</span>
                </span>
                <input
                  type='number'
                  min={1}
                  max={365}
                  value={days}
                  onChange={e => setDays(Number(e.target.value) || 0)}
                  className='mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
                />
              </label>
            </div>
          ) : (
            <label className='block'>
              <span className='text-xs font-medium text-foreground'>New trial end date</span>
              <input
                type='date'
                value={dateValue}
                min={toDateInputValue(new Date().toISOString())}
                onChange={e => setDateValue(e.target.value)}
                className='mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
              />
            </label>
          )}

          <label className='block'>
            <span className='text-xs font-medium text-foreground'>
              Internal notes <span className='text-muted-foreground'>(optional)</span>
            </span>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder='Reason for the extension — visible in the audit log.'
              className='mt-1 w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
            />
          </label>
        </div>

        <div className='mt-4 flex justify-end gap-2'>
          <Button
            variant='outline'
            size='sm'
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
            className='h-7 px-3 text-xs'
          >
            Cancel
          </Button>
          <Button
            size='sm'
            onClick={handleConfirm}
            disabled={isLoading || !isValid}
            className='h-7 px-3 text-xs'
          >
            {isLoading ? (
              <>
                <Loader2 className='me-2 size-3.5 animate-spin' />
                Extending…
              </>
            ) : (
              'Extend trial'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
