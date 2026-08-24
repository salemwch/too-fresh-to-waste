'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Megaphone, Plus, MoreHorizontal, Send, Archive, Trash2 } from 'lucide-react';
import {
  Button,
  Badge,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@foodwaste/ui';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmActionDialog } from '@/components/dashboard/admin/confirm-action-dialog';
import {
  useAnnouncements,
  useCreateAnnouncement,
  usePublishAnnouncement,
  useArchiveAnnouncement,
  useDeleteAnnouncement,
} from '@/hooks/use-admin';
import type {
  AnnouncementRow,
  AnnouncementSearchParams,
  AnnouncementType,
  AnnouncementStatusType,
  CreateAnnouncementPayload,
} from '@/types/admin';

const TYPE_COLORS: Record<AnnouncementType, string> = {
  banner: 'bg-blue-500/10 text-blue-600',
  maintenance: 'bg-orange-500/10 text-orange-600',
  promotion: 'bg-green-500/10 text-green-700',
  update: 'bg-purple-500/10 text-purple-600',
  alert: 'bg-destructive/10 text-destructive',
};

const STATUS_COLORS: Record<AnnouncementStatusType, string> = {
  draft: 'bg-muted text-muted-foreground',
  scheduled: 'bg-blue-500/10 text-blue-600',
  active: 'bg-green-500/10 text-green-700',
  expired: 'bg-orange-500/10 text-orange-600',
  archived: 'bg-muted text-muted-foreground',
};

export default function AnnouncementsPage() {
  const t = useTranslations('adminAnnouncements');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const params: AnnouncementSearchParams = {
    page: 1,
    limit: 50,
    ...(search ? { search } : {}),
    ...(statusFilter !== 'all' ? { status: statusFilter as AnnouncementStatusType } : {}),
  };

  const { data: announcements, isLoading } = useAnnouncements(params);

  return (
    <div className='space-y-2xl p-2xl'>
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-semibold'>{t('title')}</h1>
          <p className='text-sm text-muted-foreground'>{t('subtitle')}</p>
        </div>
        <CreateAnnouncementDialog />
      </div>

      <div className='flex items-center gap-sm'>
        <Input
          placeholder={t('searchPlaceholder')}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className='h-9 max-w-[220px] text-sm'
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className='h-9 w-[150px] text-sm'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>{t('allStatuses')}</SelectItem>
            <SelectItem value='draft'>{t('status.draft')}</SelectItem>
            <SelectItem value='active'>{t('status.active')}</SelectItem>
            <SelectItem value='scheduled'>{t('status.scheduled')}</SelectItem>
            <SelectItem value='expired'>{t('status.expired')}</SelectItem>
            <SelectItem value='archived'>{t('status.archived')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <AnnouncementSkeleton />
      ) : !announcements || announcements.length === 0 ? (
        <div className='flex flex-col items-center justify-center py-4xl gap-md text-center'>
          <Megaphone className='size-12 text-muted-foreground' />
          <h3 className='text-md font-semibold'>{t('noAnnouncements')}</h3>
          <p className='text-sm text-muted-foreground max-w-xs'>{t('noAnnouncementsDesc')}</p>
        </div>
      ) : (
        <div className='grid gap-lg'>
          {announcements.map(item => (
            <AnnouncementCard key={item._id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

function AnnouncementCard({ item }: { item: AnnouncementRow }) {
  const t = useTranslations('adminAnnouncements');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const publish = usePublishAnnouncement();
  const archive = useArchiveAnnouncement();
  const remove = useDeleteAnnouncement();

  return (
    <>
      <div className='rounded-md border p-lg flex items-start justify-between gap-lg'>
        <div className='min-w-0 flex-1'>
          <div className='flex items-center gap-sm mb-xs'>
            <h3 className='text-sm font-medium truncate'>{item.title}</h3>
            <Badge className={`text-xs ${TYPE_COLORS[item.type]}`}>{item.type}</Badge>
            <Badge className={`text-xs ${STATUS_COLORS[item.status]}`}>{item.status}</Badge>
          </div>
          <p className='text-xs text-muted-foreground line-clamp-2'>{item.content}</p>
          <div className='flex items-center gap-md mt-sm text-xs text-muted-foreground'>
            <span>
              {t('target')}: {item.target}
            </span>
            {item.startsAt && (
              <span>
                {t('starts')}: {new Date(item.startsAt).toLocaleDateString()}
              </span>
            )}
            {item.expiresAt && (
              <span>
                {t('expires')}: {new Date(item.expiresAt).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant='ghost' size='icon' className='size-8 shrink-0'>
              <MoreHorizontal className='size-4' />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end'>
            {item.status === 'draft' && (
              <DropdownMenuItem onClick={() => publish.mutate(item._id)}>
                <Send className='size-4 me-sm' />
                {t('publish')}
              </DropdownMenuItem>
            )}
            {item.status === 'active' && (
              <DropdownMenuItem onClick={() => archive.mutate(item._id)}>
                <Archive className='size-4 me-sm' />
                {t('archive')}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => setDeleteOpen(true)} className='text-destructive'>
              <Trash2 className='size-4 me-sm' />
              {t('delete')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ConfirmActionDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t('deleteConfirmTitle')}
        description={t('deleteConfirmDesc')}
        confirmLabel={t('delete')}
        variant='danger'
        isLoading={remove.isPending}
        onConfirm={() => {
          remove.mutate(item._id, { onSuccess: () => setDeleteOpen(false) });
        }}
      />
    </>
  );
}

function CreateAnnouncementDialog() {
  const t = useTranslations('adminAnnouncements');
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState<AnnouncementType>('banner');
  const create = useCreateAnnouncement();

  const handleSubmit = () => {
    const payload: CreateAnnouncementPayload = { title, content, type };
    create.mutate(payload, {
      onSuccess: () => {
        setOpen(false);
        setTitle('');
        setContent('');
        setType('banner');
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size='sm'>
          <Plus className='size-3.5 me-1.5' />
          {t('create')}
        </Button>
      </DialogTrigger>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>{t('createDialog.title')}</DialogTitle>
          <DialogDescription>{t('createDialog.desc')}</DialogDescription>
        </DialogHeader>
        <div className='space-y-md py-sm'>
          <div className='space-y-xs'>
            <Label className='text-xs'>{t('createDialog.titleLabel')}</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} className='h-9 text-sm' />
          </div>
          <div className='space-y-xs'>
            <Label className='text-xs'>{t('createDialog.content')}</Label>
            <textarea
              className='w-full rounded-md border border-input bg-background px-md py-sm text-sm min-h-[80px] resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
              value={content}
              onChange={e => setContent(e.target.value)}
            />
          </div>
          <div className='space-y-xs'>
            <Label className='text-xs'>{t('createDialog.type')}</Label>
            <Select value={type} onValueChange={v => setType(v as AnnouncementType)}>
              <SelectTrigger className='h-9 text-sm'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='banner'>Banner</SelectItem>
                <SelectItem value='maintenance'>Maintenance</SelectItem>
                <SelectItem value='promotion'>Promotion</SelectItem>
                <SelectItem value='update'>Update</SelectItem>
                <SelectItem value='alert'>Alert</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            size='sm'
            className='w-full'
            onClick={handleSubmit}
            disabled={!title || !content || create.isPending}
          >
            {t('createDialog.submit')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AnnouncementSkeleton() {
  return (
    <div className='space-y-lg'>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className='rounded-md border p-lg space-y-sm'>
          <Skeleton className='h-5 w-48' />
          <Skeleton className='h-4 w-full' />
          <Skeleton className='h-3 w-32' />
        </div>
      ))}
    </div>
  );
}
