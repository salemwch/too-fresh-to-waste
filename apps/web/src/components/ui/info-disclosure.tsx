'use client';

import { Info } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * Info disclosure - DESIGN.md §13.12.
 *
 * For a figure or label a merchant may not understand. An `Info` glyph button
 * beside the label reveals one or two sentences in the flow, below; pressing
 * again hides them. Not a tooltip: hover does not exist on the tablets and
 * phones the dashboard runs on, and a tooltip hides the answer the moment the
 * pointer moves. Works by touch, keyboard and screen reader.
 *
 * - 44 x 44 px hit area (§5.6) around a 14 px glyph; negative margin keeps the
 *   visual footprint small so the label row does not grow.
 * - `aria-expanded` / `aria-controls` on the button; the panel carries the id.
 */
export interface InfoDisclosureProps {
  /** The label the explanation belongs to, rendered before the button. */
  label: ReactNode;
  /** Accessible name of the button, e.g. "What is Pending?". */
  buttonLabel: string;
  /** The explanation: what the number is and when it changes. */
  children: ReactNode;
  className?: string;
}

export function InfoDisclosure({ label, buttonLabel, children, className }: InfoDisclosureProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <div className={className}>
      <div className='flex items-center gap-xs'>
        {label}
        <button
          type='button'
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={buttonLabel}
          onClick={() => setOpen(value => !value)}
          className={cn(
            'inline-grid size-11 -m-3.5 place-items-center rounded-full text-muted-foreground',
            'hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            open && 'text-foreground',
          )}
        >
          <Info size={14} aria-hidden='true' />
        </button>
      </div>
      <p id={panelId} hidden={!open} className='mt-xs text-sm leading-snug text-muted-foreground'>
        {children}
      </p>
    </div>
  );
}
