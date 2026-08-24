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
   * Translated text to display. Without it the raw status is title-cased,
   * which leaks untranslated enum values ("Out For Delivery") into the UI —
   * pass a translated label on any screen that has one.
   */
  label?: string;
}

export function StatusBadge({ status, variant, className, label }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-sm py-xxs text-xs font-medium',
        getClasses(variant, status),
        className,
      )}
    >
      {label ?? formatLabel(status)}
    </span>
  );
}
