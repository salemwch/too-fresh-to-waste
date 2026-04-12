'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Flag,
  User,
  Building2,
  ShoppingBag,
  Tag,
  Star,
  MoreHorizontal,
  Eye,
  AlertTriangle,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  Button,
  Separator,
  Label,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@foodwaste/ui';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AdminDataTable, type ColumnDef } from '@/components/dashboard/admin/admin-data-table';
import { StatusBadge } from '@/components/dashboard/admin/status-badge';
import { AdminStatCard } from '@/components/dashboard/admin/admin-stat-card';
import { ConfirmActionDialog } from '@/components/dashboard/admin/confirm-action-dialog';
import {
  useModerationStats,
  useReports,
  useReportDetail,
  useUpdateReport,
  useCreateModerationAction,
  useAssignReport,
} from '@/hooks/use-admin';
import type {
  ModerationReport,
  ReportStatus,
  ReportPriority,
  ReportSearchParams,
  ModerationActionType,
  ModerationSeverity,
} from '@/types/admin';

const REPORT_TYPE_ICONS: Record<string, React.ElementType> = {
  user: User,
  establishment: Building2,
  order: ShoppingBag,
  offer: Tag,
  review: Star,
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

const STATUS_TABS = ['all', 'pending', 'in_review', 'resolved', 'escalated'] as const;

export default function AdminModerationPage() {
  const t = useTranslations('dashboard.admin.moderation');

  const [activeTab, setActiveTab] = useState<string>('pending');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);

  // Action state
  const [resolveDialog, setResolveDialog] = useState(false);
  const [actionForm, setActionForm] = useState<{
    actionType: ModerationActionType;
    severity: ModerationSeverity;
    notes: string;
  }>({ actionType: 'warn', severity: 'minor', notes: '' });

  const searchParams: ReportSearchParams = {
    ...(activeTab !== 'all' ? { status: activeTab as ReportStatus } : {}),
    ...(priorityFilter !== 'all' ? { priority: priorityFilter as ReportPriority } : {}),
    page,
    limit: 20,
  };

  const [assignDialog, setAssignDialog] = useState(false);

  const { data: stats, isLoading: loadingStats } = useModerationStats();
  const { data: reports, isLoading: loadingReports } = useReports(searchParams);
  const { data: reportDetail, isLoading: loadingDetail } = useReportDetail(selectedReportId);
  const updateReport = useUpdateReport();
  const createAction = useCreateModerationAction();
  const assignReport = useAssignReport();

  const reportList = Array.isArray(reports) ? reports : [];

  function handleResolve(resolutionNotes?: string) {
    if (!selectedReportId) return;
    updateReport.mutate(
      {
        id: selectedReportId,
        payload: { status: 'resolved', ...(resolutionNotes ? { resolutionNotes } : {}) },
      },
      { onSuccess: () => setResolveDialog(false) },
    );
  }

  function handleAssign(moderatorId?: string) {
    if (!selectedReportId || !moderatorId?.trim()) return;
    assignReport.mutate(
      { id: selectedReportId, moderatorId: moderatorId.trim() },
      { onSuccess: () => setAssignDialog(false) },
    );
  }

  function handleTakeAction() {
    if (!reportDetail) return;
    createAction.mutate(
      {
        reportId: reportDetail._id,
        targetUserId: reportDetail.reporterId,
        actionType: actionForm.actionType,
        severity: actionForm.severity,
        reason: actionForm.notes,
      },
      {
        onSuccess: () => {
          setActionForm({ actionType: 'warn', severity: 'minor', notes: '' });
          updateReport.mutate({ id: reportDetail._id, payload: { status: 'resolved' } });
        },
      },
    );
  }

  const columns: ColumnDef<ModerationReport>[] = [
    {
      key: 'type',
      header: t('columns.type'),
      render: report => {
        const Icon = REPORT_TYPE_ICONS[report.type] ?? Flag;
        return (
          <div className='flex items-center gap-1.5'>
            <Icon className='size-3.5 text-muted-foreground' />
            <span className='text-xs capitalize'>{report.type}</span>
          </div>
        );
      },
    },
    {
      key: 'reason',
      header: t('columns.reason'),
      render: report => (
        <span className='text-xs capitalize text-muted-foreground'>
          {report.reason.replace(/_/g, ' ')}
        </span>
      ),
    },
    {
      key: 'priority',
      header: t('columns.priority'),
      render: report => <StatusBadge status={report.priority} variant='priority' />,
    },
    {
      key: 'status',
      header: t('columns.status'),
      render: report => <StatusBadge status={report.status} variant='report' />,
    },
    {
      key: 'reported',
      header: t('columns.reported'),
      render: report => (
        <span className='text-xs text-muted-foreground tabular-nums'>
          {formatDate(report.createdAt)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: t('columns.actions'),
      render: report => (
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button variant='ghost' size='sm' className='h-7 w-7 p-0'>
              <MoreHorizontal className='size-3.5' />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end' className='w-36'>
            <DropdownMenuItem onClick={() => setSelectedReportId(report._id)}>
              <Eye className='me-2 size-3.5' />
              {t('actions.view')}
            </DropdownMenuItem>
            {(report.status === 'pending' || report.status === 'in_review') && (
              <DropdownMenuItem
                onClick={() => {
                  setSelectedReportId(report._id);
                  setAssignDialog(true);
                }}
              >
                {t('actions.assign')}
              </DropdownMenuItem>
            )}
            {(report.status === 'pending' || report.status === 'in_review') && (
              <>
                <DropdownMenuItem
                  className='text-emerald-600'
                  onClick={() => {
                    setSelectedReportId(report._id);
                    setResolveDialog(true);
                  }}
                >
                  {t('actions.resolve')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className='text-rose-600'
                  onClick={() =>
                    updateReport.mutate({ id: report._id, payload: { status: 'escalated' } })
                  }
                >
                  {t('actions.escalate')}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className='space-y-5'>
      {/* Header */}
      <div>
        <h1 className='text-xl font-bold tracking-tight'>{t('title')}</h1>
        <p className='mt-0.5 text-sm text-muted-foreground'>{t('description')}</p>
      </div>

      {/* Stats */}
      <div className='grid grid-cols-2 gap-3 sm:grid-cols-4'>
        <AdminStatCard
          label={t('stats.totalReports')}
          value={stats?.totalReports ?? '—'}
          icon={Flag}
          iconBg='bg-slate-100'
          iconColor='text-slate-600'
          loading={loadingStats}
        />
        <AdminStatCard
          label={t('stats.pending')}
          value={stats?.pendingReports ?? '—'}
          icon={AlertTriangle}
          iconBg='bg-amber-50'
          iconColor='text-amber-600'
          highlight={(stats?.pendingReports ?? 0) > 0}
          loading={loadingStats}
        />
        <AdminStatCard
          label={t('stats.inReview')}
          value={stats?.inReviewReports ?? '—'}
          icon={Eye}
          iconBg='bg-blue-50'
          iconColor='text-blue-600'
          loading={loadingStats}
        />
        <AdminStatCard
          label={t('stats.resolved')}
          value={stats?.resolvedReports ?? '—'}
          icon={Flag}
          iconBg='bg-emerald-50'
          iconColor='text-emerald-600'
          loading={loadingStats}
        />
      </div>

      {/* Tabs + Table */}
      <div className='space-y-3'>
        <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
          <Tabs
            value={activeTab}
            onValueChange={v => {
              setActiveTab(v);
              setPage(1);
            }}
          >
            <TabsList className='h-8'>
              {STATUS_TABS.map(tab => (
                <TabsTrigger key={tab} value={tab} className='h-6 px-3 text-xs'>
                  {t(`tabs.${tab === 'in_review' ? 'inReview' : tab}` as Parameters<typeof t>[0])}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <Select onValueChange={setPriorityFilter} defaultValue='all'>
            <SelectTrigger className='h-8 w-28 text-xs'>
              <SelectValue placeholder='Priority' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>All Priority</SelectItem>
              <SelectItem value='critical'>Critical</SelectItem>
              <SelectItem value='high'>High</SelectItem>
              <SelectItem value='medium'>Medium</SelectItem>
              <SelectItem value='low'>Low</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <AdminDataTable
          columns={columns}
          data={reportList}
          isLoading={loadingReports}
          page={page}
          totalPages={Math.max(1, Math.ceil(reportList.length / 20))}
          total={reportList.length}
          onPageChange={setPage}
          searchValue={search}
          searchPlaceholder='Search reports…'
          onSearchChange={setSearch}
          emptyIcon={Flag}
          emptyTitle={t('empty')}
          emptyDescription={t('emptyDescription')}
        />
      </div>

      {/* Report Detail Sheet */}
      <Sheet open={!!selectedReportId} onOpenChange={open => !open && setSelectedReportId(null)}>
        <SheetContent className='w-full overflow-y-auto sm:max-w-lg'>
          {loadingDetail ? (
            <div className='p-6 space-y-4'>
              <div className='h-6 w-48 bg-muted animate-pulse rounded' />
              <div className='h-4 w-32 bg-muted animate-pulse rounded' />
            </div>
          ) : reportDetail ? (
            <div className='space-y-6 py-6'>
              <SheetHeader>
                <div className='flex items-center gap-2'>
                  {(() => {
                    const Icon = REPORT_TYPE_ICONS[reportDetail.type] ?? Flag;
                    return <Icon className='size-5 text-muted-foreground' />;
                  })()}
                  <div>
                    <SheetTitle className='text-base capitalize'>
                      {reportDetail.type} Report
                    </SheetTitle>
                    <div className='mt-1 flex gap-1.5'>
                      <StatusBadge status={reportDetail.status} variant='report' />
                      <StatusBadge status={reportDetail.priority} variant='priority' />
                    </div>
                  </div>
                </div>
              </SheetHeader>

              <Separator />

              <div className='space-y-3 text-sm'>
                {[
                  { label: t('detail.reason'), value: reportDetail.reason.replace(/_/g, ' ') },
                  { label: t('detail.description'), value: reportDetail.description },
                  {
                    label: 'Reported by',
                    value: reportDetail.reporter
                      ? `${reportDetail.reporter.firstName} ${reportDetail.reporter.lastName} (${reportDetail.reporter.email})`
                      : reportDetail.reporterId,
                  },
                  { label: 'Reported at', value: formatDate(reportDetail.createdAt) },
                  ...(reportDetail.assignedToModerator
                    ? [{ label: 'Assigned to', value: reportDetail.assignedToModerator }]
                    : []),
                  ...(reportDetail.resolutionNotes
                    ? [{ label: t('detail.resolutionNotes'), value: reportDetail.resolutionNotes }]
                    : []),
                ].map(row => (
                  <div key={row.label}>
                    <p className='mb-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground'>
                      {row.label}
                    </p>
                    <p className='text-xs capitalize'>{row.value}</p>
                  </div>
                ))}
              </div>

              {/* Assign button in sheet */}
              {(reportDetail.status === 'pending' || reportDetail.status === 'in_review') && (
                <Button
                  size='sm'
                  variant='outline'
                  className='w-full border-indigo-300 text-indigo-600 hover:bg-indigo-50'
                  onClick={() => setAssignDialog(true)}
                >
                  {reportDetail.assignedToModerator ? 'Reassign Moderator' : 'Assign to Moderator'}
                </Button>
              )}

              {(reportDetail.status === 'pending' || reportDetail.status === 'in_review') && (
                <>
                  <Separator />
                  <div className='space-y-3'>
                    <p className='text-xs font-semibold'>{t('detail.takeAction')}</p>
                    <div className='grid grid-cols-2 gap-2'>
                      <div className='space-y-1'>
                        <Label className='text-xs'>{t('detail.actionType')}</Label>
                        <Select
                          value={actionForm.actionType}
                          onValueChange={v =>
                            setActionForm(f => ({ ...f, actionType: v as ModerationActionType }))
                          }
                        >
                          <SelectTrigger className='h-8 text-xs'>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value='warn'>Warn</SelectItem>
                            <SelectItem value='suspend'>Suspend</SelectItem>
                            <SelectItem value='ban'>Ban</SelectItem>
                            <SelectItem value='hide_content'>Hide Content</SelectItem>
                            <SelectItem value='delete_content'>Delete Content</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className='space-y-1'>
                        <Label className='text-xs'>{t('detail.severity')}</Label>
                        <Select
                          value={actionForm.severity}
                          onValueChange={v =>
                            setActionForm(f => ({ ...f, severity: v as ModerationSeverity }))
                          }
                        >
                          <SelectTrigger className='h-8 text-xs'>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value='minor'>Minor</SelectItem>
                            <SelectItem value='moderate'>Moderate</SelectItem>
                            <SelectItem value='severe'>Severe</SelectItem>
                            <SelectItem value='critical'>Critical</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className='space-y-1'>
                      <Label className='text-xs'>{t('detail.resolutionNotes')}</Label>
                      <textarea
                        value={actionForm.notes}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                          setActionForm(f => ({ ...f, notes: e.target.value }))
                        }
                        placeholder={t('detail.resolutionPlaceholder')}
                        rows={3}
                        className='w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
                      />
                    </div>
                    <div className='flex gap-2'>
                      <Button
                        size='sm'
                        className='flex-1 bg-rose-600 hover:bg-rose-700'
                        onClick={handleTakeAction}
                        disabled={createAction.isPending}
                      >
                        {t('detail.takeAction')}
                      </Button>
                      <Button
                        size='sm'
                        variant='outline'
                        className='flex-1 border-emerald-300 text-emerald-700 hover:bg-emerald-50'
                        onClick={() => setResolveDialog(true)}
                      >
                        {t('actions.resolve')}
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      {/* Assign Moderator Dialog */}
      <ConfirmActionDialog
        open={assignDialog}
        onOpenChange={open => {
          if (!open) setAssignDialog(false);
        }}
        title='Assign to Moderator'
        description='Enter the moderator user ID to assign this report. The report status will be set to In Review.'
        confirmLabel='Assign'
        variant='default'
        isLoading={assignReport.isPending}
        onConfirm={handleAssign}
        reasonConfig={{
          label: 'Moderator ID',
          placeholder: 'Enter moderator user ID…',
          required: true,
        }}
      />

      {/* Resolve Dialog */}
      <ConfirmActionDialog
        open={resolveDialog}
        onOpenChange={setResolveDialog}
        title='Resolve Report'
        description='Mark this report as resolved. Add optional resolution notes.'
        confirmLabel={t('actions.resolve')}
        variant='default'
        isLoading={updateReport.isPending}
        onConfirm={handleResolve}
        reasonConfig={{
          label: t('detail.resolutionNotes'),
          placeholder: t('detail.resolutionPlaceholder'),
        }}
      />
    </div>
  );
}
