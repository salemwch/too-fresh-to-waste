'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

type BadgeVariant = 'user' | 'establishment' | 'report' | 'priority' | 'role';

const USER_STATUS_MAP: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  suspended: 'bg-orange-50 text-orange-700 border-orange-200',
  blocked: 'bg-rose-50 text-rose-700 border-rose-200',
  deleted: 'bg-slate-100 text-slate-500 border-slate-200',
  anonymized: 'bg-slate-100 text-slate-500 border-slate-200',
};

const ESTABLISHMENT_STATUS_MAP: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  suspended: 'bg-orange-50 text-orange-700 border-orange-200',
  rejected: 'bg-rose-50 text-rose-700 border-rose-200',
  inactive: 'bg-slate-100 text-slate-500 border-slate-200',
};

const REPORT_STATUS_MAP: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  in_review: 'bg-blue-50 text-blue-700 border-blue-200',
  resolved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected: 'bg-slate-100 text-slate-500 border-slate-200',
  escalated: 'bg-rose-50 text-rose-700 border-rose-200',
};

const PRIORITY_MAP: Record<string, string> = {
  low: 'bg-slate-100 text-slate-600 border-slate-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  high: 'bg-orange-50 text-orange-700 border-orange-200',
  critical: 'bg-rose-50 text-rose-700 border-rose-200',
};

const ROLE_MAP: Record<string, string> = {
  consumer: 'bg-sky-50 text-sky-700 border-sky-200',
  merchant: 'bg-violet-50 text-violet-700 border-violet-200',
  admin: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  moderator: 'bg-teal-50 text-teal-700 border-teal-200',
};

function getClasses(variant: BadgeVariant, status: string): string {
  const map =
    variant === 'user'
      ? USER_STATUS_MAP
      : variant === 'establishment'
        ? ESTABLISHMENT_STATUS_MAP
        : variant === 'report'
          ? REPORT_STATUS_MAP
          : variant === 'priority'
            ? PRIORITY_MAP
            : ROLE_MAP;

  return map[status.toLowerCase()] ?? 'bg-slate-100 text-slate-600 border-slate-200';
}

function formatLabel(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

interface StatusBadgeProps {
  status: string;
  variant: BadgeVariant;
  className?: string;
  /**
   * Overrides the looked-up translation. Only needed when a screen has a more
   * specific wording than the shared `common.badges` label.
   */
  label?: string;
}

/**
 * A coloured status pill.
 *
 * ## Why it translates itself
 *
 * `label` used to be the only route to a translated string, with a comment
 * asking call sites to pass one. Ten of the eleven usages did not, so French
 * and Arabic admins read "Suspended", "In Review" and "Merchant" in English -
 * the `formatLabel` fallback title-cases the raw enum and looks deliberate,
 * which is why it survived review.
 *
 * Opt-in i18n on a shared primitive fails this way every time: the default has
 * to be the correct behaviour, or the call site that forgets is the bug. So the
 * lookup happens here, keyed by `common.badges.<variant>.<value>`, and `label`
 * is now only an override.
 *
 * `formatLabel` stays as a last resort for a status the backend adds before the
 * translations catch up - an English word beats a raw `common.badges.user.foo`
 * key rendered at the user.
 */
export function StatusBadge({ status, variant, className, label }: StatusBadgeProps) {
  const t = useTranslations('common.badges');
  const key = `${variant}.${status.toLowerCase()}`;

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-sm py-xxs text-xs font-medium',
        getClasses(variant, status),
        className,
      )}
    >
      {label ?? (t.has(key) ? t(key) : formatLabel(status))}
    </span>
  );
}
