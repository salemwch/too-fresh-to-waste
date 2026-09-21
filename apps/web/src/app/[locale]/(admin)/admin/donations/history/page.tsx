'use client';

import { useTranslations } from 'next-intl';
import {
  HeartHandshake,
  Loader2,
  ArrowLeft,
  Trophy,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button } from '@foodwaste/ui';
import { useAdminDonationHistory } from '@/hooks/use-admin';
import { Link } from '@/i18n/routing';
import { useFormat, MISSING_COUNT } from '@/lib/use-format';

const CATEGORY_LABELS: Record<string, string> = {
  TSHIRTS: 'T-Shirts',
  PANTS: 'Pants',
  SHOES: 'Shoes',
  CHILDREN_STUDIES: "Children's Studies",
  MEDICINE: 'Medicine',
};

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  funded: 'bg-blue-50 text-blue-700 border-blue-200',
  distributed: 'bg-purple-50 text-purple-700 border-purple-200',
  archived: 'bg-gray-100 text-gray-500 border-gray-200',
  season_complete: 'bg-amber-50 text-amber-700 border-amber-200',
};

export default function AdminDonationHistoryPage() {
  const fmt = useFormat();
  const t = useTranslations('dashboard.adminDonationPool');
  const { data: history, isLoading } = useAdminDonationHistory();
  const [expandedSeasons, setExpandedSeasons] = useState<Set<number>>(new Set());

  function toggleSeason(season: number) {
    setExpandedSeasons(prev => {
      const next = new Set(prev);
      if (next.has(season)) {
        next.delete(season);
      } else {
        next.add(season);
      }
      return next;
    });
  }

  if (isLoading) {
    return (
      <div className='flex items-center justify-center py-6xl'>
        <Loader2 className='size-6 animate-spin text-muted-foreground' />
      </div>
    );
  }

  const hasHistory = history && history.length > 0;

  return (
    <div className='space-y-2xl'>
      {/* Header */}
      <div className='flex items-start justify-between gap-lg'>
        <div>
          <div className='flex items-center gap-sm mb-xs'>
            <Link href='/admin/donations'>
              <Button variant='ghost' size='sm' className='px-sm text-xs'>
                <ArrowLeft className='me-xs size-3.5' />
                {t('title')}
              </Button>
            </Link>
          </div>
          <h1 className='text-xl font-bold tracking-tight'>{t('history.title')}</h1>
          <p className='mt-xxs text-sm text-muted-foreground'>{t('history.description')}</p>
        </div>
      </div>

      {!hasHistory ? (
        <Card className='border-border/60'>
          <CardContent className='flex flex-col items-center justify-center py-4xl gap-md text-center'>
            <HeartHandshake className='size-12 text-muted-foreground' />
            <h3 className='text-md font-semibold'>{t('history.empty')}</h3>
            <p className='text-sm text-muted-foreground max-w-xs'>
              {t('history.emptyDescription')}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className='space-y-lg'>
          {history.map(({ season, pools }) => {
            const isExpanded = expandedSeasons.has(season);
            const totalRaised = pools.reduce((sum, p) => sum + p.currentAmount, 0);
            const totalContributors = pools.reduce((sum, p) => sum + p.contributorCount, 0);
            const goalsCompleted = pools.filter(
              p =>
                p.status === 'funded' || p.status === 'archived' || p.status === 'season_complete',
            ).length;

            return (
              <Card key={season} className='border-border/60'>
                <CardHeader
                  className='cursor-pointer select-none'
                  onClick={() => toggleSeason(season)}
                >
                  <div className='flex items-center justify-between'>
                    <div className='flex items-center gap-md'>
                      <div className='rounded-lg bg-primary-500/10 p-sm'>
                        <Trophy className='size-4 text-primary-500' />
                      </div>
                      <div>
                        <CardTitle className='text-sm'>
                          {t('history.seasonLabel', { number: season })}
                        </CardTitle>
                        <p className='text-xs text-muted-foreground mt-xxs'>
                          {t('history.seasonSummary', {
                            goals: goalsCompleted,
                            total: pools.length,
                            raised: totalRaised.toFixed(2),
                            contributors: totalContributors,
                          })}
                        </p>
                      </div>
                    </div>
                    {isExpanded ? (
                      <ChevronDown className='size-4 text-muted-foreground' />
                    ) : (
                      <ChevronRight className='size-4 text-muted-foreground' />
                    )}
                  </div>
                </CardHeader>

                {isExpanded && (
                  <CardContent className='pt-0'>
                    <div className='rounded-lg border border-border/60 overflow-hidden'>
                      <table className='w-full text-xs'>
                        <thead>
                          <tr className='bg-muted/50'>
                            <th className='text-start px-md py-sm font-medium text-muted-foreground'>
                              {t('history.goal')}
                            </th>
                            <th className='text-start px-md py-sm font-medium text-muted-foreground'>
                              {t('history.status')}
                            </th>
                            <th className='text-end px-md py-sm font-medium text-muted-foreground'>
                              {t('history.raised')}
                            </th>
                            <th className='text-end px-md py-sm font-medium text-muted-foreground'>
                              {t('history.target')}
                            </th>
                            <th className='text-end px-md py-sm font-medium text-muted-foreground'>
                              {t('history.progressCol')}
                            </th>
                            <th className='text-end px-md py-sm font-medium text-muted-foreground'>
                              {t('history.date')}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {pools.map(pool => {
                            const progress =
                              pool.targetAmount > 0
                                ? Math.min((pool.currentAmount / pool.targetAmount) * 100, 100)
                                : 0;
                            return (
                              <tr key={pool._id} className='border-t border-border/40'>
                                <td className='px-md py-sm font-medium'>
                                  {CATEGORY_LABELS[pool.activeGoalCategory] ??
                                    pool.activeGoalCategory}
                                </td>
                                <td className='px-md py-sm'>
                                  <span
                                    className={`inline-flex items-center rounded-full border px-sm py-xxs text-[10px] font-semibold ${STATUS_STYLES[pool.status] ?? STATUS_STYLES.active}`}
                                  >
                                    {t(`status.${pool.status}`)}
                                  </span>
                                </td>
                                <td className='px-md py-sm text-end tabular-nums'>
                                  {pool.currentAmount.toFixed(2)} TND
                                </td>
                                <td className='px-md py-sm text-end tabular-nums'>
                                  {pool.targetAmount.toFixed(0)} TND
                                </td>
                                <td className='px-md py-sm text-end'>
                                  <div className='flex items-center justify-end gap-sm'>
                                    <div className='h-1.5 w-16 overflow-hidden rounded-full bg-muted'>
                                      <div
                                        className='h-full rounded-full bg-primary-500'
                                        style={{
                                          width: `${Math.min(progress, 100)}%`,
                                        }}
                                      />
                                    </div>
                                    <span className='tabular-nums text-muted-foreground'>
                                      {progress.toFixed(0)}%
                                    </span>
                                  </div>
                                </td>
                                <td className='px-md py-sm text-end text-muted-foreground'>
                                  {fmt.date(pool.startDate) ?? MISSING_COUNT}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
