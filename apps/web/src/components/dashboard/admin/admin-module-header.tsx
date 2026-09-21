'use client';

import { useTranslations } from 'next-intl';
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

/**
 * The period values only.
 *
 * The labels used to sit here as English string literals, so every admin screen
 * carrying a period filter offered "This week" and "Quarter" in French and
 * Arabic. Labels now come from `dashboard.adminShared.period`, keyed by the
 * value, which also means a period added later is a missing key rather than a
 * silently English one.
 */
const PERIOD_VALUES: AnalyticsPeriod[] = ['day', 'week', 'month', 'quarter', 'year'];

export function AdminModuleHeader({
  title,
  subtitle,
  period,
  onPeriodChange,
  onExport,
  /** Defaults to the translated "Export" rather than the English literal. */
  exportLabel,
  actions,
}: AdminModuleHeaderProps) {
  const t = useTranslations('dashboard.adminShared');

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
              {PERIOD_VALUES.map(value => (
                <SelectItem key={value} value={value}>
                  {t(`period.${value}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {onExport && (
          <Button size='sm' variant='outline' onClick={onExport} className='px-md text-xs'>
            <Download className='me-1.5 size-3.5' />
            {exportLabel ?? t('export')}
          </Button>
        )}
      </div>
    </div>
  );
}
