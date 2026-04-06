'use client';

import {
  TrendingUp,
  Tag,
  Users,
  Leaf,
  Star,
  Download,
  BarChart3,
  Sparkles,
  Bell,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

// ─── Feature cards config ────────────────────────────────────────────────────

type FeatureKey = 'revenue' | 'offers' | 'customers' | 'sustainability' | 'ratings' | 'exports';

const FEATURE_ICONS: Record<FeatureKey, React.ElementType> = {
  revenue: TrendingUp,
  offers: Tag,
  customers: Users,
  sustainability: Leaf,
  ratings: Star,
  exports: Download,
};

const FEATURE_COLORS: Record<FeatureKey, { bg: string; icon: string; ring: string }> = {
  revenue: {
    bg: 'bg-emerald-50',
    icon: 'text-emerald-600',
    ring: 'ring-emerald-100',
  },
  offers: {
    bg: 'bg-orange-50',
    icon: 'text-orange-500',
    ring: 'ring-orange-100',
  },
  customers: {
    bg: 'bg-blue-50',
    icon: 'text-blue-600',
    ring: 'ring-blue-100',
  },
  sustainability: {
    bg: 'bg-teal-50',
    icon: 'text-teal-600',
    ring: 'ring-teal-100',
  },
  ratings: {
    bg: 'bg-amber-50',
    icon: 'text-amber-500',
    ring: 'ring-amber-100',
  },
  exports: {
    bg: 'bg-violet-50',
    icon: 'text-violet-600',
    ring: 'ring-violet-100',
  },
};

const FEATURE_KEYS: FeatureKey[] = [
  'revenue',
  'offers',
  'customers',
  'sustainability',
  'ratings',
  'exports',
];

// ─── Page ────────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const t = useTranslations('dashboard.analytics');

  return (
    <div className='flex flex-col items-center justify-start min-h-full py-10 px-4'>
      {/* ── Hero block ── */}
      <div className='flex flex-col items-center text-center max-w-xl'>
        {/* Animated icon */}
        <div className='relative mb-6'>
          <div className='w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-200'>
            <BarChart3 className='w-10 h-10 text-white' />
          </div>
          <span className='absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 shadow'>
            <Sparkles className='w-3 h-3 text-white' />
          </span>
        </div>

        {/* Badge */}
        <span className='inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200 mb-4'>
          <Bell className='w-3 h-3' />
          {t('comingSoonTitle')}
        </span>

        <h1 className='text-2xl font-bold text-slate-800 mb-2'>{t('comingSoonSubtitle')}</h1>
        <p className='text-sm text-slate-500 leading-relaxed mb-2'>{t('comingSoonDescription')}</p>
        <p className='text-xs text-slate-400 italic'>{t('notifyLabel')}</p>
      </div>

      {/* ── Divider ── */}
      <div className='w-full max-w-2xl my-8 border-t border-slate-100' />

      {/* ── Feature grid ── */}
      <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full max-w-2xl'>
        {FEATURE_KEYS.map(key => {
          const Icon = FEATURE_ICONS[key];
          const colors = FEATURE_COLORS[key];
          return (
            <div
              key={key}
              className={`relative flex flex-col gap-3 rounded-xl p-4 ring-1 ${colors.bg} ${colors.ring}`}
            >
              {/* Lock overlay */}
              <span className='absolute top-3 right-3 rounded-full bg-white/80 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 ring-1 ring-slate-200'>
                Soon
              </span>

              <div
                className={`w-9 h-9 rounded-lg bg-white flex items-center justify-center shadow-sm ring-1 ${colors.ring}`}
              >
                <Icon className={`w-4.5 h-4.5 ${colors.icon}`} />
              </div>

              <div>
                <p className='text-sm font-semibold text-slate-700'>{t(`features.${key}.title`)}</p>
                <p className='mt-0.5 text-xs text-slate-500 leading-relaxed'>
                  {t(`features.${key}.description`)}
                </p>
              </div>

              {/* Shimmer progress bar — decorative */}
              <div className='h-1 w-full rounded-full bg-slate-200 overflow-hidden'>
                <div className='h-full w-1/3 rounded-full bg-gradient-to-r from-slate-300 via-white to-slate-300 animate-[shimmer_2s_infinite]' />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
