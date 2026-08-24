import { Building2, Flag, Users, Settings, type LucideIcon } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { cn } from '@/lib/utils';

interface QuickAction {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: number;
  color: string;
  bgColor: string;
}

interface QuickActionsProps {
  labels: {
    title: string;
    approvePending: string;
    reviewReports: string;
    manageUsers: string;
    systemConfig: string;
  };
  pendingApprovals?: number;
  pendingReports?: number;
}

export function QuickActions({
  labels,
  pendingApprovals = 0,
  pendingReports = 0,
}: QuickActionsProps) {
  const actions: QuickAction[] = [
    {
      label: labels.approvePending,
      href: '/admin/establishments',
      icon: Building2,
      ...(pendingApprovals > 0 ? { badge: pendingApprovals } : {}),
      color: 'text-amber-600',
      bgColor: 'bg-amber-50 hover:bg-amber-100 border-amber-200/60',
    },
    {
      label: labels.reviewReports,
      href: '/admin/moderation',
      icon: Flag,
      ...(pendingReports > 0 ? { badge: pendingReports } : {}),
      color: 'text-rose-600',
      bgColor: 'bg-rose-50 hover:bg-rose-100 border-rose-200/60',
    },
    {
      label: labels.manageUsers,
      href: '/admin/users',
      icon: Users,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50 hover:bg-indigo-100 border-indigo-200/60',
    },
    {
      label: labels.systemConfig,
      href: '/admin/settings',
      icon: Settings,
      color: 'text-slate-600',
      bgColor: 'bg-slate-50 hover:bg-slate-100 border-slate-200/60',
    },
  ];

  return (
    <div className='grid grid-cols-2 gap-sm'>
      {actions.map(action => {
        const Icon = action.icon;
        return (
          <Link
            key={action.href}
            href={action.href}
            className={cn(
              'relative flex flex-col items-center gap-sm rounded-lg border p-md text-center transition-colors',
              action.bgColor,
            )}
          >
            {action.badge !== undefined && (
              <span className='absolute end-sm top-sm flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-xs text-[10px] font-bold text-white tabular-nums'>
                {action.badge > 99 ? '99+' : action.badge}
              </span>
            )}
            <Icon className={cn('size-5', action.color)} />
            <span className='text-[11px] font-medium leading-tight text-foreground'>
              {action.label}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
