'use client';

import { AlertTriangle } from 'lucide-react';
import { Button } from '@foodwaste/ui';

interface AdminErrorStateProps {
  title: string;
  description: string;
  retryLabel: string;
  onRetry: () => void;
  /** `compact` fits inside a card slot; `block` stands alone as a section. */
  variant?: 'compact' | 'block';
}

/**
 * Section-scoped failure, with a way out.
 *
 * ## Why every section needs its own
 *
 * The admin dashboard reads nine independent queries and did not check
 * `isError` on a single one. A failed analytics call rendered exactly like an
 * empty platform: dashes in the KPIs, zeroes in the impact banner. An admin
 * could not tell "nothing happened today" from "the request failed", which are
 * opposite conclusions.
 *
 * DESIGN.md §15.4 puts this at section scope: "Inline block with retry; rest of
 * page still works." One dead query must not blank the screen, and it must not
 * quietly masquerade as data either.
 *
 * The copy says what failed and offers the retry. No status codes, no exception
 * names - CLAUDE.md's completeness protocol: "No technical text reaches the
 * user."
 */
export function AdminErrorState({
  title,
  description,
  retryLabel,
  onRetry,
  variant = 'compact',
}: AdminErrorStateProps) {
  return (
    <div
      role='alert'
      className={
        variant === 'block'
          ? 'border-border bg-card flex flex-col items-center gap-sm rounded-lg border p-4xl text-center'
          : 'border-border flex flex-col items-center gap-sm rounded-lg border border-dashed p-lg text-center'
      }
    >
      <AlertTriangle aria-hidden='true' className='text-muted-foreground size-8' />
      <p className='font-semibold'>{title}</p>
      <p className='text-muted-foreground max-w-xs text-sm'>{description}</p>
      <Button type='button' variant='outline' size='sm' className='mt-xs' onClick={onRetry}>
        {retryLabel}
      </Button>
    </div>
  );
}
