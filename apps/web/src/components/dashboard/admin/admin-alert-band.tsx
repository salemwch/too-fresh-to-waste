'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { AlertTriangle, ShieldAlert, Activity, Scale } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

/** Not exported: callers reach it as `AdminAlert['severity']`, so there is one name for it. */
type AlertSeverity = 'critical' | 'warning';

export interface AdminAlert {
  id: string;
  severity: AlertSeverity;
  icon: LucideIcon;
  title: string;
  detail: string;
  /** Where an admin goes to act on it. */
  href: string;
  actionLabel: string;
}

interface AdminAlertBandProps {
  alerts: AdminAlert[];
}

/**
 * The band that only appears when something is wrong.
 *
 * ## Why this leads the dashboard
 *
 * DESIGN.md §17: "a grid of identical stat tiles with no ranking is a data
 * dump, not a dashboard. Lead with the number that drives a decision." Totals
 * do not drive decisions - exceptions do. So the first thing on the screen is
 * the set of things that need a human, and on a healthy day it renders nothing
 * at all.
 *
 * **Nothing here is decorative.** An alert that fires on a normal day trains an
 * admin to scroll past the band, and then it is worse than absent. Every entry
 * must be actionable and must carry a link to the place it is actioned.
 *
 * Severity is binary on purpose. A four-level scale invites arguing about
 * whether something is "high" or "medium" instead of fixing it: either it needs
 * attention now (critical) or it needs attention today (warning).
 */
export function AdminAlertBand({ alerts }: AdminAlertBandProps) {
  // Critical first, then insertion order within a severity, so the list is
  // stable between renders rather than reshuffling as counts tick.
  const ordered = useMemo(
    () =>
      [...alerts].sort(
        (a, b) => Number(b.severity === 'critical') - Number(a.severity === 'critical'),
      ),
    [alerts],
  );

  if (ordered.length === 0) {
    return null;
  }

  return (
    <section
      aria-label='Alerts'
      className='flex flex-col gap-sm'
      // Announced when an alert appears while the admin is already on the page.
      aria-live='polite'
    >
      {ordered.map(alert => {
        const Icon = alert.icon;
        const critical = alert.severity === 'critical';

        return (
          <div
            key={alert.id}
            role='alert'
            className={cn(
              'flex flex-col gap-sm rounded-lg border p-md sm:flex-row sm:items-center sm:justify-between',
              critical
                ? 'border-destructive/40 bg-destructive/5'
                : 'border-warning/40 bg-warning/5',
            )}
          >
            <div className='flex items-start gap-sm'>
              <Icon
                aria-hidden='true'
                className={cn(
                  'mt-0.5 size-5 shrink-0',
                  critical ? 'text-destructive' : 'text-warning',
                )}
              />
              <div className='min-w-0'>
                <p
                  className={cn('font-semibold', critical ? 'text-destructive' : 'text-foreground')}
                >
                  {alert.title}
                </p>
                <p className='text-muted-foreground mt-xxs text-sm'>{alert.detail}</p>
              </div>
            </div>

            {/*
              A link, not a button: this navigates. DESIGN.md §14.2 - "Navigate:
              Link. Never a button that navigates."
            */}
            <Link
              href={alert.href}
              className={cn(
                'shrink-0 rounded-md px-md py-2 text-center text-sm font-semibold outline-none transition-colors',
                'focus-visible:ring-2 focus-visible:ring-offset-2',
                critical
                  ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-destructive'
                  : 'border border-border bg-background hover:bg-muted focus-visible:ring-ring',
              )}
            >
              {alert.actionLabel}
            </Link>
          </div>
        );
      })}
    </section>
  );
}

/** Icons the dashboard passes in, kept here so callers share one vocabulary. */
export const ALERT_ICONS = {
  reconciliation: Scale,
  health: Activity,
  anomaly: ShieldAlert,
  disputes: AlertTriangle,
} as const;
