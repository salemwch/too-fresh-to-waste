'use client';

import { Download } from 'lucide-react';
import { Button } from '@foodwaste/ui';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { AnalyticsPeriod } from '@/types/admin';

interface AdminModuleHeaderProps {
  title: string;
  subtitle: string;
  period?: AnalyticsPeriod;
  onPeriodChange?: (period: AnalyticsPeriod) => void;
  onExport?: () => void;
  exportLabel?: string;
  actions?: React.ReactNode;
}

const PERIOD_OPTIONS: { value: AnalyticsPeriod; label: string }[] = [
  { value: 'day', label: 'Today' },
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: 'quarter', label: 'Quarter' },
  { value: 'year', label: 'Year' },
];

export function AdminModuleHeader({
  title,
  subtitle,
  period,
  onPeriodChange,
  onExport,
  exportLabel = 'Export',
  actions,
}: AdminModuleHeaderProps) {
  return (
    <div className='flex flex-col gap-md sm:flex-row sm:items-start sm:justify-between'>
      <div>
        <h1 className='text-xl font-bold tracking-tight'>{title}</h1>
        <p className='mt-xxs text-sm text-muted-foreground'>{subtitle}</p>
      </div>
      <div className='flex items-center gap-sm'>
        {actions}
        {period !== undefined && onPeriodChange && (
          <Select value={period} onValueChange={v => onPeriodChange(v as AnalyticsPeriod)}>
            <SelectTrigger className='h-8 w-28 text-xs'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {onExport && (
          <Button size='sm' variant='outline' onClick={onExport} className='h-8 px-md text-xs'>
            <Download className='me-1.5 size-3.5' />
            {exportLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
