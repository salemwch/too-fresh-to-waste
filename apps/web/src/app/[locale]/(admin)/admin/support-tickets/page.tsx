'use client';

import { useState } from 'react';
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

export default function SupportTicketsPage() {
  const t = useTranslations('adminTickets');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const params: TicketSearchParams = {
    page: 1,
    limit: 50,
    ...(search ? { search } : {}),
    ...(statusFilter !== 'all' ? { status: statusFilter as TicketStatus } : {}),
    ...(priorityFilter !== 'all' ? { priority: priorityFilter as TicketPriority } : {}),
  };

  const { data: tickets, isLoading } = useTickets(params);
  const { data: stats } = useTicketStats();

  return (
    <div className='space-y-6 p-6'>
      <div>
        <h1 className='text-2xl font-semibold'>{t('title')}</h1>
        <p className='text-sm text-muted-foreground'>{t('subtitle')}</p>
      </div>

      {/* Stats cards */}
      {stats && (
        <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
          <StatCard icon={Ticket} label={t('totalTickets')} value={stats.total} />
          <StatCard icon={AlertTriangle} label={t('openTickets')} value={stats.open} />
          <StatCard icon={Clock} label={t('urgentCount')} value={stats.byPriority['urgent'] ?? 0} />
          <StatCard icon={CheckCircle2} label={t('resolvedTickets')} value={stats.resolved} />
        </div>
      )}

      {/* Filters */}
      <div className='flex items-center gap-3'>
        <Input
          placeholder={t('searchPlaceholder')}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className='max-w-xs'
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className='w-[160px]'>
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
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className='w-[140px]'>
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
      </div>

      {/* Ticket list */}
      {isLoading ? (
        <TicketSkeleton />
      ) : !tickets || tickets.length === 0 ? (
        <div className='flex flex-col items-center justify-center py-16 gap-3 text-center'>
          <Ticket className='size-12 text-muted-foreground' />
          <h3 className='text-md font-semibold'>{t('noTickets')}</h3>
          <p className='text-sm text-muted-foreground max-w-xs'>{t('noTicketsDesc')}</p>
        </div>
      ) : (
        <div className='rounded-md border'>
          <div className='grid grid-cols-[1fr_120px_100px_100px_80px] gap-4 p-3 border-b bg-muted/50 text-xs font-medium text-muted-foreground'>
            <span>{t('subject')}</span>
            <span>{t('category')}</span>
            <span>{t('priorityLabel')}</span>
            <span>{t('statusLabel')}</span>
            <span>{t('actions')}</span>
          </div>
          {tickets.map(ticket => (
            <div
              key={ticket._id}
              className='grid grid-cols-[1fr_120px_100px_100px_80px] gap-4 p-3 border-b last:border-0 items-center cursor-pointer hover:bg-muted/30'
              onClick={() => setSelectedId(ticket._id)}
            >
              <div className='min-w-0'>
                <p className='text-sm font-medium truncate'>{ticket.subject}</p>
                <p className='text-xs text-muted-foreground truncate'>
                  {getUserName(ticket.userId)}
                </p>
              </div>
              <Badge variant='outline' className='text-xs capitalize'>
                {t(`category.${ticket.category}` as Parameters<typeof t>[0])}
              </Badge>
              <Badge className={`text-xs capitalize ${PRIORITY_COLORS[ticket.priority]}`}>
                {t(`priority.${ticket.priority}` as Parameters<typeof t>[0])}
              </Badge>
              <Badge className={`text-xs ${STATUS_COLORS[ticket.status]}`}>
                {t(
                  `status.${ticket.status === 'in_progress' ? 'inProgress' : ticket.status === 'awaiting_user' ? 'awaitingUser' : ticket.status}` as Parameters<
                    typeof t
                  >[0],
                )}
              </Badge>
              <div className='text-xs text-muted-foreground'>
                {ticket.replies.length} <MessageSquare className='size-3 inline' />
              </div>
            </div>
          ))}
        </div>
      )}

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
      <CardContent className='flex items-center gap-3 p-4'>
        <div className='rounded-md bg-primary/10 p-2'>
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
          <div className='space-y-4'>
            <Skeleton className='h-6 w-48' />
            <Skeleton className='h-4 w-full' />
            <Skeleton className='h-4 w-3/4' />
          </div>
        ) : (
          <div className='space-y-4'>
            <SheetTitle>{ticket.subject}</SheetTitle>
            <div className='flex gap-2'>
              <Badge className={STATUS_COLORS[ticket.status]}>{ticket.status}</Badge>
              <Badge className={PRIORITY_COLORS[ticket.priority]}>{ticket.priority}</Badge>
            </div>

            <p className='text-sm'>{ticket.description}</p>

            <Separator />

            {/* Status actions */}
            <div className='flex flex-wrap gap-2'>
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
            <div className='space-y-3 max-h-64 overflow-y-auto'>
              {ticket.replies.map((r, i) => (
                <div
                  key={i}
                  className={`rounded-md p-3 text-sm ${
                    r.authorRole === 'admin' ? 'bg-primary/5 ms-4' : 'bg-muted me-4'
                  }`}
                >
                  <p className='text-xs text-muted-foreground mb-1 capitalize'>{r.authorRole}</p>
                  <p>{r.message}</p>
                </div>
              ))}
            </div>

            {/* Reply input */}
            <div className='flex gap-2'>
              <Input
                value={replyMsg}
                onChange={e => setReplyMsg(e.target.value)}
                placeholder={t('replyPlaceholder')}
                onKeyDown={e => e.key === 'Enter' && handleReply()}
              />
              <Button
                size='icon'
                onClick={handleReply}
                disabled={reply.isPending || !replyMsg.trim()}
              >
                <Send className='size-4' />
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function TicketSkeleton() {
  return (
    <div className='space-y-3'>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className='flex items-center gap-4 p-3'>
          <Skeleton className='h-4 w-48' />
          <Skeleton className='h-4 w-20' />
          <Skeleton className='h-4 w-16' />
          <Skeleton className='h-4 w-16' />
        </div>
      ))}
    </div>
  );
}
