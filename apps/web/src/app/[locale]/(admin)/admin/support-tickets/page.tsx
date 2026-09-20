'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Ticket, AlertTriangle, Clock, CheckCircle2, MessageSquare, Send } from 'lucide-react';
import { Button, Badge, Sheet, SheetContent, SheetTitle, Separator } from '@foodwaste/ui';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { AdminDataTable, type ColumnDef } from '@/components/dashboard/admin/admin-data-table';
import {
  useTickets,
  useTicketStats,
  useTicketDetail,
  useUpdateTicketStatus,
  useReplyToTicket,
} from '@/hooks/use-admin';
import type {
  SupportTicketRow,
  TicketSearchParams,
  TicketStatus,
  TicketPriority,
} from '@/types/admin';

const PRIORITY_COLORS: Record<TicketPriority, string> = {
  low: 'bg-muted text-muted-foreground',
  medium: 'bg-blue-500/10 text-blue-600 border-blue-200',
  high: 'bg-orange-500/10 text-orange-600 border-orange-200',
  urgent: 'bg-destructive/10 text-destructive border-destructive',
};

const STATUS_COLORS: Record<TicketStatus, string> = {
  open: 'bg-blue-500/10 text-blue-600',
  in_progress: 'bg-yellow-500/10 text-yellow-700',
  awaiting_user: 'bg-purple-500/10 text-purple-600',
  resolved: 'bg-green-500/10 text-green-700',
  closed: 'bg-muted text-muted-foreground',
};

function getUserName(user: SupportTicketRow['userId']): string {
  if (typeof user === 'string') return user;
  return `${user.firstName} ${user.lastName}`;
}

const TICKETS_PER_PAGE = 20;

/**
 * Stable identity for "no tickets". `?? []` allocated a fresh array every
 * render - .claude/rules/performance.md rule 1.
 */
const NO_TICKETS: readonly SupportTicketRow[] = Object.freeze([]);

/**
 * The status enum and its translation keys disagree on casing, so the row used
 * a nested ternary inline. A lookup keeps the mapping in one place and makes a
 * newly-added status a missing key rather than a silently wrong one.
 */
const TICKET_STATUS_KEYS: Record<TicketStatus, string> = {
  open: 'status.open',
  in_progress: 'status.inProgress',
  awaiting_user: 'status.awaitingUser',
  resolved: 'status.resolved',
  closed: 'status.closed',
};

export default function SupportTicketsPage() {
  const t = useTranslations('adminTickets');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const params: TicketSearchParams = {
    page,
    limit: TICKETS_PER_PAGE,
    ...(search ? { search } : {}),
    ...(statusFilter !== 'all' ? { status: statusFilter as TicketStatus } : {}),
    ...(priorityFilter !== 'all' ? { priority: priorityFilter as TicketPriority } : {}),
  };

  const { data: ticketData, isLoading } = useTickets(params);
  const { data: stats } = useTicketStats();

  const tickets = ticketData?.data ?? NO_TICKETS;
  const total = ticketData?.meta?.total ?? 0;
  const totalPages = Math.ceil(total / TICKETS_PER_PAGE);

  /**
   * Column definitions for `AdminDataTable`, memoised so the array keeps one
   * identity across renders - .claude/rules/performance.md rule 1.
   */
  const columns: readonly ColumnDef<SupportTicketRow>[] = useMemo(
    () => [
      {
        key: 'subject',
        header: t('subject'),
        render: ticket => (
          <div className='min-w-0'>
            <p className='truncate text-sm font-medium'>{ticket.subject}</p>
            <p className='truncate text-xs text-muted-foreground'>{getUserName(ticket.userId)}</p>
          </div>
        ),
      },
      {
        key: 'category',
        header: t('category'),
        className: 'hidden md:table-cell',
        render: ticket => (
          <Badge variant='outline' className='text-xs'>
            {t(`category.${ticket.category}` as Parameters<typeof t>[0])}
          </Badge>
        ),
      },
      {
        key: 'priority',
        header: t('priorityLabel'),
        render: ticket => (
          <Badge className={`text-xs ${PRIORITY_COLORS[ticket.priority]}`}>
            {t(`priority.${ticket.priority}` as Parameters<typeof t>[0])}
          </Badge>
        ),
      },
      {
        key: 'status',
        header: t('statusLabel'),
        render: ticket => (
          <Badge className={`text-xs ${STATUS_COLORS[ticket.status]}`}>
            {t(TICKET_STATUS_KEYS[ticket.status] as Parameters<typeof t>[0])}
          </Badge>
        ),
      },
      {
        key: 'replies',
        header: t('actions'),
        className: 'hidden text-end lg:table-cell',
        render: ticket => (
          <span className='inline-flex items-center gap-xs text-xs text-muted-foreground tabular-nums'>
            {ticket.replies.length}
            <MessageSquare className='size-3' />
          </span>
        ),
      },
    ],
    [t],
  );

  return (
    <div className='space-y-2xl p-2xl'>
      <div>
        <h1 className='text-2xl font-semibold'>{t('title')}</h1>
        <p className='text-sm text-muted-foreground'>{t('subtitle')}</p>
      </div>

      {/* Stats cards */}
      {stats && (
        <div className='grid grid-cols-2 md:grid-cols-4 gap-lg'>
          <StatCard icon={Ticket} label={t('totalTickets')} value={stats.total} />
          <StatCard icon={AlertTriangle} label={t('openTickets')} value={stats.open} />
          <StatCard icon={Clock} label={t('urgentCount')} value={stats.byPriority['urgent'] ?? 0} />
          <StatCard icon={CheckCircle2} label={t('resolvedTickets')} value={stats.resolved} />
        </div>
      )}

      {/*
        Was a CSS-grid pseudo-table with its own header row, skeleton, empty
        state and no pagination at all - the query was pinned to page 1 of 50,
        so the fifty-first ticket was unreachable. AdminDataTable supplies all
        four, and the fix for the pagination is structural rather than a button
        bolted onto the old markup.
      */}
      <AdminDataTable
        columns={columns}
        data={tickets}
        isLoading={isLoading}
        page={page}
        totalPages={totalPages}
        total={total}
        onPageChange={setPage}
        searchValue={search}
        searchPlaceholder={t('searchPlaceholder')}
        onSearchChange={value => {
          setSearch(value);
          setPage(1);
        }}
        onRowClick={ticket => setSelectedId(ticket._id)}
        filterSlot={
          <>
            <Select
              value={statusFilter}
              onValueChange={v => {
                setStatusFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger className='h-9 w-[150px] text-sm'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>{t('allStatuses')}</SelectItem>
                <SelectItem value='open'>{t('status.open')}</SelectItem>
                <SelectItem value='in_progress'>{t('status.inProgress')}</SelectItem>
                <SelectItem value='awaiting_user'>{t('status.awaitingUser')}</SelectItem>
                <SelectItem value='resolved'>{t('status.resolved')}</SelectItem>
                <SelectItem value='closed'>{t('status.closed')}</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={priorityFilter}
              onValueChange={v => {
                setPriorityFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger className='h-9 w-[130px] text-sm'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>{t('allPriorities')}</SelectItem>
                <SelectItem value='urgent'>{t('priority.urgent')}</SelectItem>
                <SelectItem value='high'>{t('priority.high')}</SelectItem>
                <SelectItem value='medium'>{t('priority.medium')}</SelectItem>
                <SelectItem value='low'>{t('priority.low')}</SelectItem>
              </SelectContent>
            </Select>
          </>
        }
        emptyIcon={Ticket}
        emptyTitle={t('noTickets')}
        emptyDescription={t('noTicketsDesc')}
      />

      {/* Detail sheet */}
      <TicketDetailSheet
        ticketId={selectedId}
        open={!!selectedId}
        onOpenChange={v => !v && setSelectedId(null)}
      />
    </div>
  );
}

// ─── Stat Card ───────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Ticket;
  label: string;
  value: number;
}) {
  return (
    <Card>
      <CardContent className='flex items-center gap-md p-lg'>
        <div className='rounded-md bg-primary/10 p-sm'>
          <Icon className='size-5 text-primary' />
        </div>
        <div>
          <p className='text-2xl font-semibold'>{value}</p>
          <p className='text-xs text-muted-foreground'>{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Detail Sheet ────────────────────────────────────────────────────────────

function TicketDetailSheet({
  ticketId,
  open,
  onOpenChange,
}: {
  ticketId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const t = useTranslations('adminTickets');
  const { data: ticket } = useTicketDetail(ticketId);
  const updateStatus = useUpdateTicketStatus();
  const reply = useReplyToTicket();
  const [replyMsg, setReplyMsg] = useState('');

  const handleReply = () => {
    if (!ticketId || !replyMsg.trim()) return;
    reply.mutate(
      { id: ticketId, payload: { message: replyMsg } },
      { onSuccess: () => setReplyMsg('') },
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='overflow-y-auto sm:max-w-lg'>
        {!ticket ? (
          <div className='space-y-lg'>
            <Skeleton className='h-6 w-48' />
            <Skeleton className='h-4 w-full' />
            <Skeleton className='h-4 w-3/4' />
          </div>
        ) : (
          <div className='space-y-lg'>
            <SheetTitle>{ticket.subject}</SheetTitle>
            <div className='flex gap-sm'>
              <Badge className={STATUS_COLORS[ticket.status]}>{ticket.status}</Badge>
              <Badge className={PRIORITY_COLORS[ticket.priority]}>{ticket.priority}</Badge>
            </div>

            <p className='text-sm'>{ticket.description}</p>

            <Separator />

            {/* Status actions */}
            <div className='flex flex-wrap gap-sm'>
              {ticket.status !== 'resolved' && (
                <Button
                  size='sm'
                  variant='outline'
                  onClick={() =>
                    updateStatus.mutate({ id: ticket._id, payload: { status: 'resolved' } })
                  }
                >
                  {t('resolve')}
                </Button>
              )}
              {ticket.status !== 'closed' && (
                <Button
                  size='sm'
                  variant='outline'
                  onClick={() =>
                    updateStatus.mutate({ id: ticket._id, payload: { status: 'closed' } })
                  }
                >
                  {t('close')}
                </Button>
              )}
            </div>

            <Separator />

            {/* Replies */}
            <h4 className='text-sm font-medium'>
              {t('replies')} ({ticket.replies.length})
            </h4>
            <div className='space-y-md max-h-64 overflow-y-auto'>
              {ticket.replies.map((r, i) => (
                <div
                  key={i}
                  className={`rounded-md p-md text-sm ${
                    r.authorRole === 'admin' ? 'bg-primary/5 ms-lg' : 'bg-muted me-lg'
                  }`}
                >
                  {/* Was the raw enum under a `capitalize` class, so an Arabic
                      admin read "Admin" / "User" in Latin script. */}
                  <p className='mb-xs text-xs text-muted-foreground'>
                    {t(`authorRole.${r.authorRole}` as Parameters<typeof t>[0])}
                  </p>
                  <p>{r.message}</p>
                </div>
              ))}
            </div>

            {/* Reply input */}
            <div className='flex gap-sm'>
              <Input
                value={replyMsg}
                onChange={e => setReplyMsg(e.target.value)}
                placeholder={t('replyPlaceholder')}
                onKeyDown={e => e.key === 'Enter' && handleReply()}
                className='h-9 text-sm'
              />
              <Button
                size='sm'
                className='px-md'
                onClick={handleReply}
                disabled={reply.isPending || !replyMsg.trim()}
              >
                <Send className='size-3.5' />
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
