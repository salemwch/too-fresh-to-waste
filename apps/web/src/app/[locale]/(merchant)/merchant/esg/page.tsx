'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Leaf,
  Droplets,
  Zap,
  Car,
  TreePine,
  Package,
  Users,
  Download,
  Loader2,
  CheckCircle2,
  Circle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import {
  useEsgTier,
  useCarbonMetrics,
  useSocialImpact,
  useMonthlyGoal,
} from '@/hooks/use-merchant-dashboard';
import { LocationSwitcher } from '@/components/dashboard/organization/location-switcher';
import { dashboardService } from '@/services/dashboard.service';

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number, decimals = 0) {
  return n.toLocaleString(undefined, { maximumFractionDigits: decimals });
}

function MetricRow({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
}) {
  return (
    <div className='flex items-center justify-between py-3 border-b border-primary-500/[0.06] last:border-0'>
      <div className='flex items-center gap-3 text-sm text-primary-500/75'>
        <Icon size={15} className='text-primary-500/50 shrink-0' />
        {label}
      </div>
      <span className='text-sm font-semibold text-primary-500'>{value}</span>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function EsgPage() {
  const t = useTranslations('dashboard.merchantEsg');
  const [downloading, setDownloading] = useState(false);
  const tierQuery = useEsgTier();
  const carbonQuery = useCarbonMetrics();
  const socialQuery = useSocialImpact();
  const goalQuery = useMonthlyGoal();

  const tier = tierQuery.data;
  const carbon = carbonQuery.data;
  const social = socialQuery.data;
  const goal = goalQuery.data;

  async function handleDownload() {
    if (downloading) return;
    setDownloading(true);
    try {
      const response = await dashboardService.downloadCarbonBalanceReport();
      const blob = new Blob([response.data as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `carbon-balance-${new Date().toISOString().split('T')[0]}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t('pdfDownloaded'));
    } catch {
      toast.error(t('pdfError'));
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className='space-y-[32px]'>
      {/* Page header */}
      <div className='flex items-start justify-between gap-4 flex-wrap'>
        <div>
          <div className='text-xs uppercase tracking-[0.18em] text-primary-500/60 mb-2'>
            {t('breadcrumb')}
          </div>
          <h1 className='font-display text-3xl md:text-4xl text-primary-500 leading-[1.05]'>
            {t('title')}
          </h1>
          <p className='mt-2 text-primary-500/65 text-sm max-w-xl'>{t('subtitle')}</p>
        </div>
        <div className='flex items-center gap-3'>
          <LocationSwitcher />
          <button
            onClick={handleDownload}
            disabled={downloading}
            className='inline-flex items-center gap-2 px-5 py-3 rounded-full bg-primary-500 text-white text-sm font-medium hover:opacity-90 transition shadow-soft disabled:opacity-60 shrink-0'
          >
            {downloading ? <Loader2 size={16} className='animate-spin' /> : <Download size={16} />}
            {downloading ? t('downloading') : t('downloadPdf')}
          </button>
        </div>
      </div>

      {/* ESG Tier progression */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className='glass rounded-2xl p-[24px] shadow-soft'
      >
        <div className='flex items-center gap-3 mb-[24px]'>
          <div className='h-10 w-10 rounded-xl bg-primary-500/[0.08] grid place-items-center text-primary-500'>
            <Leaf size={18} />
          </div>
          <div>
            <div className='text-xs uppercase tracking-wider text-primary-500/60'>
              {t('esgProgression')}
            </div>
            <div className='font-semibold text-primary-500'>
              {tier
                ? tier.currentBadge
                  ? `${tier.currentLabel} ${tier.currentBadge}`
                  : tier.currentLabel
                : '—'}
            </div>
          </div>
          <div className='ml-auto text-right'>
            <div className='text-xs text-primary-500/60'>{t('bagsSavedTotal')}</div>
            <div className='font-display text-2xl text-primary-500'>
              {fmt(tier?.bagsSaved ?? 0)}
            </div>
          </div>
        </div>

        <div className='space-y-3'>
          {(tier?.allTiers ?? []).map(tierItem => (
            <div key={tierItem.name} className='flex items-center gap-3'>
              {tierItem.reached ? (
                <CheckCircle2 size={18} className='text-brand-coral shrink-0' />
              ) : (
                <Circle size={18} className='text-primary-500/25 shrink-0' />
              )}
              <div className='flex-1 min-w-0'>
                <div
                  className={`text-sm font-medium ${tierItem.reached ? 'text-primary-500' : 'text-primary-500/40'}`}
                >
                  {tierItem.label}
                </div>
                <div className='text-xs text-primary-500/50'>
                  {fmt(tierItem.threshold)}+ {t('bags')}
                </div>
              </div>
              {tierItem.reached && (
                <span className='text-[10px] px-2 py-0.5 rounded-full bg-brand-coral/10 text-brand-coral font-medium'>
                  {t('reached')}
                </span>
              )}
            </div>
          ))}
        </div>

        {tier?.remaining != null && tier.remaining > 0 && (
          <div className='mt-[24px] p-3 rounded-xl bg-primary-500/[0.04]'>
            <p className='text-xs text-primary-500/70'>
              {t('remaining', {
                count: fmt(tier.remaining),
                tier: tier.nextTier ? ` (${tier.nextTier})` : '',
              })}
            </p>
            <div className='mt-2 h-1.5 w-full rounded-full bg-primary-500/[0.08] overflow-hidden'>
              <motion.div
                className='h-full rounded-full bg-brand-coral'
                initial={{ width: 0 }}
                animate={{ width: `${tier.ringProgress}%` }}
                transition={{ duration: 1.2, ease: 'easeOut' }}
              />
            </div>
          </div>
        )}
      </motion.div>

      {/* Carbon + Social side by side */}
      <div className='grid grid-cols-1 lg:grid-cols-2 gap-[24px]'>
        {/* Carbon Metrics */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className='glass rounded-2xl p-[24px] shadow-soft'
        >
          <div className='text-xs uppercase tracking-wider text-primary-500/60 mb-[16px]'>
            {t('carbonTitle')}
          </div>
          {carbon ? (
            <div>
              <MetricRow
                label={t('bagsSaved')}
                value={`${fmt(carbon.bagsSaved)} ${t('bags')}`}
                icon={Package}
              />
              <MetricRow
                label={t('foodWeight')}
                value={`${fmt(carbon.foodWeightKg, 1)} kg`}
                icon={Package}
              />
              <MetricRow
                label={t('co2Avoided')}
                value={`${fmt(carbon.carbonKgAvoided, 1)} kg CO₂`}
                icon={Leaf}
              />
              <MetricRow
                label={t('waterSaved')}
                value={`${fmt(carbon.waterLitersAvoided)} ${t('liters')}`}
                icon={Droplets}
              />
              <MetricRow
                label={t('packagingSaved')}
                value={`${fmt(carbon.packagingKgSaved, 1)} ${t('plastic')}`}
                icon={Package}
              />
              <MetricRow
                label={t('energySaved')}
                value={`${fmt(carbon.energyKwhSaved, 1)} kWh`}
                icon={Zap}
              />
              <MetricRow
                label={t('carEquivalent')}
                value={`${fmt(carbon.carKmEquivalent)} ${t('kmNotDriven')}`}
                icon={Car}
              />
              <MetricRow
                label={t('treesEquivalent')}
                value={`${fmt(carbon.treesEquivalent)} ${t('treesPlanted')}`}
                icon={TreePine}
              />
              <div className='mt-4 text-[10px] text-primary-500/45 italic'>
                {t('period')} : {carbon.periodLabel}
              </div>
            </div>
          ) : (
            <div className='h-[200px] animate-pulse rounded-xl bg-primary-500/[0.05]' />
          )}
        </motion.div>

        {/* Social Impact */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.18 }}
          className='glass rounded-2xl p-[24px] shadow-soft'
        >
          <div className='text-xs uppercase tracking-wider text-primary-500/60 mb-[16px]'>
            {t('socialTitle')}
          </div>
          {social ? (
            <div>
              <MetricRow
                label={t('mealsDistributed')}
                value={`${fmt(social.mealsDistributed)} ${t('meals')}`}
                icon={Users}
              />
              <MetricRow
                label={t('peopleServed')}
                value={`~${fmt(social.peopleServedEstimate)} ${t('beneficiaries')}`}
                icon={Users}
              />
              <MetricRow
                label={t('foodValueSaved')}
                value={`~${fmt(social.estimatedValueTnd, 2)} TND`}
                icon={Leaf}
              />
              <MetricRow
                label={t('weightRescued')}
                value={`${fmt(social.foodWeightKg, 1)} kg`}
                icon={Package}
              />
              <div className='mt-4 text-[10px] text-primary-500/45 italic'>
                {t('period')} : {social.periodLabel}
              </div>
            </div>
          ) : (
            <div className='h-[200px] animate-pulse rounded-xl bg-primary-500/[0.05]' />
          )}
        </motion.div>
      </div>

      {/* Monthly goal */}
      {goal && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.25 }}
          className='glass rounded-2xl p-[24px] shadow-soft'
        >
          <div className='flex items-center justify-between mb-3'>
            <div className='text-xs uppercase tracking-wider text-primary-500/60'>
              {t('monthlyGoal')} · {goal.month}
            </div>
            <span className='font-semibold text-primary-500'>{goal.progressPercentage}%</span>
          </div>
          <div className='flex items-end justify-between mb-2'>
            <span className='text-sm text-primary-500/70'>
              {t('bagsThisMonth', {
                current: fmt(goal.currentMonthBags),
                target: fmt(goal.targetBagsPerMonth),
              })}
            </span>
            <span className='text-xs text-primary-500/60'>
              {t('treesEq', { count: fmt(goal.treesEquivalent) })}
            </span>
          </div>
          <div className='h-2 w-full rounded-full bg-primary-500/[0.08] overflow-hidden'>
            <motion.div
              className='h-full rounded-full bg-brand-coral'
              initial={{ width: 0 }}
              animate={{ width: `${goal.progressPercentage}%` }}
              transition={{ duration: 1.2, ease: 'easeOut' }}
            />
          </div>
        </motion.div>
      )}

      {/* Methodology note */}
      <div className='text-[11px] text-primary-500/40 italic leading-relaxed'>
        {t('methodology')}
      </div>
    </div>
  );
}
