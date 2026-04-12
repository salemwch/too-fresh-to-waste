'use client';

import { useRef } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Button,
} from '@foodwaste/ui';
import { cn } from '@/lib/utils';

interface ConfirmActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'default';
  isLoading?: boolean;
  onConfirm: (reason?: string) => void;
  // When provided, shows a textarea for the user to enter a reason
  reasonConfig?: {
    label: string;
    placeholder: string;
    required?: boolean;
  };
}

export function ConfirmActionDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  isLoading,
  onConfirm,
  reasonConfig,
}: ConfirmActionDialogProps) {
  const reasonRef = useRef<HTMLTextAreaElement>(null);

  function handleConfirm() {
    const reason = reasonRef.current?.value.trim();
    if (reasonConfig?.required && !reason) {
      reasonRef.current?.focus();
      return;
    }
    onConfirm(reason);
  }

  const confirmBtnClass =
    variant === 'danger'
      ? 'bg-rose-600 hover:bg-rose-700 text-white'
      : variant === 'warning'
        ? 'bg-amber-500 hover:bg-amber-600 text-white'
        : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-md'>
        <DialogHeader>
          <div className='flex items-start gap-3'>
            {variant !== 'default' && (
              <div
                className={cn(
                  'mt-0.5 rounded-full p-1.5 shrink-0',
                  variant === 'danger'
                    ? 'bg-rose-100 text-rose-600'
                    : 'bg-amber-100 text-amber-600',
                )}
              >
                <AlertTriangle className='size-4' />
              </div>
            )}
            <div>
              <DialogTitle className='text-base'>{title}</DialogTitle>
              <DialogDescription className='mt-1 text-sm'>{description}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {reasonConfig && (
          <div className='mt-2 space-y-1.5'>
            <label className='text-xs font-medium text-foreground'>
              {reasonConfig.label}
              {reasonConfig.required && <span className='ms-1 text-rose-500'>*</span>}
            </label>
            <textarea
              ref={reasonRef}
              placeholder={reasonConfig.placeholder}
              rows={3}
              className='w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
            />
          </div>
        )}

        <div className='mt-4 flex justify-end gap-2'>
          <Button
            variant='outline'
            size='sm'
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
            className='h-7 px-3 text-xs'
          >
            {cancelLabel}
          </Button>
          <Button
            size='sm'
            onClick={handleConfirm}
            disabled={isLoading}
            className={cn('h-7 px-3 text-xs', confirmBtnClass)}
          >
            {isLoading ? (
              <>
                <Loader2 className='me-2 size-3.5 animate-spin' />
                Loading…
              </>
            ) : (
              confirmLabel
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
