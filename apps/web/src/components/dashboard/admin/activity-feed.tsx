'use client';

import { useState, useMemo } from 'react';
import {
  User,
  Building2,
  ShoppingBag,
  Star,
  Settings,
  Shield,
  LogIn,
  LogOut,
  Search,
  ChevronDown,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AuditLogItem, AdminAction } from '@/types/admin';
import { AdminTableSkeleton } from './admin-skeletons';

// ─── Config maps ──────────────────────────────────────────────────────────────

const ACTION_ICON: Partial<Record<AdminAction, LucideIcon>> = {
  user_created: User,
  user_updated: User,
  user_suspended: User,
  user_blocked: User,
  user_activated: User,
  user_deleted: User,
  establishment_approved: Building2,
  establishment_rejected: Building2,
  establishment_suspended: Building2,
  establishment_reactivated: Building2,
  establishment_updated: Building2,
  order_cancelled: ShoppingBag,
  order_refunded: ShoppingBag,
  order_updated: ShoppingBag,
  review_flagged: Star,
  review_approved: Star,
  review_rejected: Star,
  review_deleted: Star,
  system_config_updated: Settings,
  bulk_operation: Shield,
  data_export: Shield,
  login: LogIn,
  logout: LogOut,
};

const ACTION_COLOR: Partial<Record<AdminAction, string>> = {
  user_created: 'bg-indigo-100 text-indigo-600',
  user_updated: 'bg-indigo-100 text-indigo-600',
  user_activated: 'bg-emerald-100 text-emerald-600',
  user_suspended: 'bg-orange-100 text-orange-600',
  user_blocked: 'bg-rose-100 text-rose-600',
  user_deleted: 'bg-rose-100 text-rose-600',
  establishment_approved: 'bg-emerald-100 text-emerald-600',
  establishment_reactivated: 'bg-emerald-100 text-emerald-600',
  establishment_rejected: 'bg-rose-100 text-rose-600',
  establishment_suspended: 'bg-orange-100 text-orange-600',
  establishment_updated: 'bg-indigo-100 text-indigo-600',
  order_cancelled: 'bg-rose-100 text-rose-600',
  order_refunded: 'bg-orange-100 text-orange-600',
  order_updated: 'bg-sky-100 text-sky-600',
  review_flagged: 'bg-amber-100 text-amber-600',
  review_approved: 'bg-emerald-100 text-emerald-600',
  review_rejected: 'bg-rose-100 text-rose-600',
  review_deleted: 'bg-rose-100 text-rose-600',
  system_config_updated: 'bg-violet-100 text-violet-600',
  bulk_operation: 'bg-indigo-100 text-indigo-600',
  data_export: 'bg-slate-100 text-slate-600',
  login: 'bg-emerald-100 text-emerald-600',
  logout: 'bg-slate-100 text-slate-500',
};

const ACTION_LABEL: Record<AdminAction, string> = {
  user_created: 'Created user',
  user_updated: 'Updated user',
  user_suspended: 'Suspended user',
  user_blocked: 'Blocked user',
  user_activated: 'Activated user',
  user_deleted: 'Deleted user',
  establishment_approved: 'Approved establishment',
  establishment_rejected: 'Rejected establishment',
  establishment_suspended: 'Suspended establishment',
  establishment_reactivated: 'Reactivated establishment',
  establishment_updated: 'Updated establishment',
  order_cancelled: 'Cancelled order',
  order_refunded: 'Refunded order',
  order_updated: 'Updated order',
  review_flagged: 'Flagged review',
  review_approved: 'Approved review',
  review_rejected: 'Rejected review',
  review_deleted: 'Deleted review',
  system_config_updated: 'System config updated',
  bulk_operation: 'Bulk operation',
  data_export: 'Data export',
  login: 'Admin login',
  logout: 'Admin logout',
};

// Avatar color palette — deterministic from email
const AVATAR_COLORS = [
  'bg-indigo-500',
  'bg-violet-500',
  'bg-emerald-600',
  'bg-sky-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-teal-500',
  'bg-orange-500',
];

function emailToColor(email: string): string {
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = email.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]!;
}

function initials(email: string): string {
  const name = email.split('@')[0] ?? '';
  const parts = name.split(/[._-]/);
  if (parts.length >= 2) {
    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function AdminAvatar({ firstName, email }: { firstName: string; email: string }) {
  return (
    <div
      className={cn(
        'flex size-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white',
        emailToColor(email),
      )}
    >
      {(firstName?.[0] ?? initials(email)[0] ?? '').toUpperCase()}
    </div>
  );
}

function formatDate(ts: string) {
  return new Date(ts).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function formatTime(ts: string) {
  return new Date(ts).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function DetailCell({ item }: { item: AuditLogItem }) {
  const parts: string[] = [];
  if (item.targetType && item.targetType !== 'system') {
    parts.push(item.targetType);
  }
  if (item.targetId) {
    parts.push(`#${item.targetId.slice(-6)}`);
  }
  if (item.reason) {
    parts.push(item.reason);
  }
  if (parts.length === 0) return <span className='text-muted-foreground/50'>—</span>;

  return (
    <span className='text-[11px] text-muted-foreground'>
      <span className='font-medium capitalize text-foreground/70'>{parts[0]}</span>
      {parts.slice(1).map((p, i) => (
        <span key={i} className='ms-1'>
          {p}
        </span>
      ))}
    </span>
  );
}

// ─── Filter select ────────────────────────────────────────────────────────────

function FilterSelect({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
}) {
  return (
    <div className='relative'>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className='h-7 appearance-none rounded-md border border-border/60 bg-background pe-6 ps-2.5 text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40'
      >
        <option value='all'>{placeholder}</option>
        {options.map(o => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className='pointer-events-none absolute end-1.5 top-1/2 size-3 -translate-y-1/2 text-muted-foreground' />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface ActivityFeedProps {
  activities: AuditLogItem[];
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
}

export function ActivityFeed({
  activities,
  loading,
  emptyTitle = 'No recent activity',
  emptyDescription,
}: ActivityFeedProps) {
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [adminFilter, setAdminFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  const uniqueActions = useMemo(
    () => [...new Set(activities.map(a => a.action))].sort(),
    [activities],
  );

  const uniqueAdmins = useMemo(
    () => [...new Set(activities.map(a => a.adminEmail))].sort(),
    [activities],
  );

  const filtered = useMemo(() => {
    return activities.filter(item => {
      if (actionFilter !== 'all' && item.action !== actionFilter) return false;
      if (adminFilter !== 'all' && item.adminEmail !== adminFilter) return false;
      if (search) {
        const label = ACTION_LABEL[item.action] ?? item.action;
        if (!label.toLowerCase().includes(search.toLowerCase())) return false;
      }
      return true;
    });
  }, [activities, actionFilter, adminFilter, search]);

  if (loading) return <AdminTableSkeleton rows={5} cols={4} />;

  return (
    <div className='space-y-3'>
      {/* Filters row */}
      <div className='flex flex-wrap items-center gap-2'>
        <FilterSelect
          value={actionFilter}
          onChange={setActionFilter}
          placeholder='All Actions'
          options={uniqueActions.map(a => ({
            value: a,
            label: ACTION_LABEL[a] ?? a,
          }))}
        />
        <FilterSelect
          value={adminFilter}
          onChange={setAdminFilter}
          placeholder='All Admins'
          options={uniqueAdmins.map(e => ({
            value: e,
            label: activities.find(a => a.adminEmail === e)?.adminFirstName ?? e,
          }))}
        />
        <div className='relative ms-auto'>
          <Search className='absolute start-2 top-1/2 size-3 -translate-y-1/2 text-muted-foreground' />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder='Search action…'
            className='h-7 w-36 rounded-md border border-border/60 bg-background ps-6 pe-2 text-[11px] placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary/40'
          />
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className='flex flex-col items-center justify-center gap-2 py-8 text-center'>
          <Shield className='size-8 text-muted-foreground/30' />
          <p className='text-sm font-medium text-muted-foreground'>{emptyTitle}</p>
          {emptyDescription && (
            <p className='max-w-xs text-xs text-muted-foreground/60'>{emptyDescription}</p>
          )}
        </div>
      ) : (
        <div className='overflow-hidden rounded-lg border border-border/60'>
          <table className='w-full table-fixed'>
            <colgroup>
              <col className='w-[82px]' />
              <col className='w-[18%]' />
              <col className='w-[32%]' />
              <col />
            </colgroup>
            <thead>
              <tr className='border-b border-border/60 bg-muted/40'>
                <th className='px-2 py-2 text-start text-[11px] font-medium text-muted-foreground'>
                  Date
                </th>
                <th className='px-2 py-2 text-start text-[11px] font-medium text-muted-foreground'>
                  Admin
                </th>
                <th className='px-2 py-2 text-start text-[11px] font-medium text-muted-foreground'>
                  Action
                </th>
                <th className='px-2 py-2 text-start text-[11px] font-medium text-muted-foreground'>
                  Details
                </th>
              </tr>
            </thead>
            <tbody className='divide-y divide-border/40'>
              {filtered.map((item, idx) => {
                const Icon = ACTION_ICON[item.action] ?? Shield;
                const color = ACTION_COLOR[item.action] ?? 'bg-slate-100 text-slate-500';
                const label = ACTION_LABEL[item.action] ?? item.action;

                return (
                  <tr key={item.id ?? idx} className='transition-colors hover:bg-muted/20'>
                    {/* Date — fixed-width, never wraps */}
                    <td className='whitespace-nowrap px-2 py-2'>
                      <p className='text-[11px] font-medium tabular-nums text-foreground'>
                        {formatDate(item.timestamp)}
                      </p>
                      <p className='text-[10px] tabular-nums text-muted-foreground'>
                        {formatTime(item.timestamp)}
                      </p>
                    </td>

                    {/* Admin */}
                    <td className='px-2 py-2'>
                      <div className='flex min-w-0 items-center gap-1.5'>
                        <AdminAvatar firstName={item.adminFirstName} email={item.adminEmail} />
                        <p className='min-w-0 truncate text-[11px] font-medium text-foreground'>
                          {item.adminFirstName || item.adminEmail.split('@')[0]}
                        </p>
                      </div>
                    </td>

                    {/* Action */}
                    <td className='px-2 py-2'>
                      <div className='flex items-center gap-1.5'>
                        <span className={cn('rounded-full p-1 shrink-0', color)}>
                          <Icon className='size-3' />
                        </span>
                        <span className='text-[11px] font-medium text-foreground'>{label}</span>
                      </div>
                    </td>

                    {/* Details — takes all remaining width */}
                    <td className='px-2 py-2'>
                      <DetailCell item={item} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
