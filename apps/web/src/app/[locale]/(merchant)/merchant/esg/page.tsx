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
      a.download = `bilan-carbone-${new Date().toISOString().split('T')[0]}.pdf`;
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
            Rapport ESG · ISO 14001
          </div>
          <h1 className='font-display text-3xl md:text-4xl text-primary-500 leading-[1.05]'>
            Bilan Carbone
          </h1>
          <p className='mt-2 text-primary-500/65 text-sm max-w-xl'>
            Toutes vos données d&apos;impact environnemental et social, calculées selon les
            coefficients ADEME 2023.
          </p>
        </div>
        <button
          onClick={handleDownload}
          disabled={downloading}
          className='inline-flex items-center gap-2 px-5 py-3 rounded-full bg-primary-500 text-white text-sm font-medium hover:opacity-90 transition shadow-soft disabled:opacity-60 shrink-0'
        >
          {downloading ? <Loader2 size={16} className='animate-spin' /> : <Download size={16} />}
          {downloading ? 'Génération…' : 'Télécharger le rapport PDF'}
        </button>
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
              Progression ESG
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
            <div className='text-xs text-primary-500/60'>Paniers sauvés (total)</div>
            <div className='font-display text-2xl text-primary-500'>
              {fmt(tier?.bagsSaved ?? 0)}
            </div>
          </div>
        </div>

        <div className='space-y-3'>
          {(tier?.allTiers ?? []).map(t => (
            <div key={t.name} className='flex items-center gap-3'>
              {t.reached ? (
                <CheckCircle2 size={18} className='text-brand-coral shrink-0' />
              ) : (
                <Circle size={18} className='text-primary-500/25 shrink-0' />
              )}
              <div className='flex-1 min-w-0'>
                <div
                  className={`text-sm font-medium ${t.reached ? 'text-primary-500' : 'text-primary-500/40'}`}
                >
                  {t.label}
                </div>
                <div className='text-xs text-primary-500/50'>{fmt(t.threshold)}+ paniers</div>
              </div>
              {t.reached && (
                <span className='text-[10px] px-2 py-0.5 rounded-full bg-brand-coral/10 text-brand-coral font-medium'>
                  Atteint
                </span>
              )}
            </div>
          ))}
        </div>

        {tier?.remaining != null && tier.remaining > 0 && (
          <div className='mt-[24px] p-3 rounded-xl bg-primary-500/[0.04]'>
            <p className='text-xs text-primary-500/70'>
              Il vous reste{' '}
              <span className='font-semibold text-primary-500'>{fmt(tier.remaining)} paniers</span>{' '}
              pour atteindre le prochain palier{tier.nextTier ? ` (${tier.nextTier})` : ''}.
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
            Impact Carbone · Scope 3 (ADEME 2023)
          </div>
          {carbon ? (
            <div>
              <MetricRow
                label='Paniers sauvés'
                value={`${fmt(carbon.bagsSaved)} paniers`}
                icon={Package}
              />
              <MetricRow
                label='Poids alimentaire rescapé'
                value={`${fmt(carbon.foodWeightKg, 1)} kg`}
                icon={Package}
              />
              <MetricRow
                label='CO₂ évité'
                value={`${fmt(carbon.carbonKgAvoided, 1)} kg CO₂`}
                icon={Leaf}
              />
              <MetricRow
                label='Eau économisée'
                value={`${fmt(carbon.waterLitersAvoided)} litres`}
                icon={Droplets}
              />
              <MetricRow
                label='Emballages évités'
                value={`${fmt(carbon.packagingKgSaved, 1)} kg plastique`}
                icon={Package}
              />
              <MetricRow
                label='Énergie économisée'
                value={`${fmt(carbon.energyKwhSaved, 1)} kWh`}
                icon={Zap}
              />
              <MetricRow
                label='Équivalent voiture'
                value={`${fmt(carbon.carKmEquivalent)} km non parcourus`}
                icon={Car}
              />
              <MetricRow
                label='Équivalent arbres'
                value={`${fmt(carbon.treesEquivalent)} arbres plantés`}
                icon={TreePine}
              />
              <div className='mt-4 text-[10px] text-primary-500/45 italic'>
                Période : {carbon.periodLabel}
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
            Impact Social
          </div>
          {social ? (
            <div>
              <MetricRow
                label='Repas distribués'
                value={`${fmt(social.mealsDistributed)} repas`}
                icon={Users}
              />
              <MetricRow
                label='Personnes servies (estimé)'
                value={`~${fmt(social.peopleServedEstimate)} bénéficiaires`}
                icon={Users}
              />
              <MetricRow
                label='Valeur alimentaire sauvée'
                value={`~${fmt(social.estimatedValueTnd, 2)} TND`}
                icon={Leaf}
              />
              <MetricRow
                label='Poids rescapé'
                value={`${fmt(social.foodWeightKg, 1)} kg`}
                icon={Package}
              />
              <div className='mt-4 text-[10px] text-primary-500/45 italic'>
                Période : {social.periodLabel}
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
              Objectif mensuel · {goal.month}
            </div>
            <span className='font-semibold text-primary-500'>{goal.progressPercentage}%</span>
          </div>
          <div className='flex items-end justify-between mb-2'>
            <span className='text-sm text-primary-500/70'>
              <span className='font-semibold text-primary-500'>{fmt(goal.currentMonthBags)}</span> /{' '}
              {fmt(goal.targetBagsPerMonth)} paniers ce mois
            </span>
            <span className='text-xs text-primary-500/60'>
              {fmt(goal.treesEquivalent)} arbres ≡
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
        Calculs basés sur les coefficients ADEME 2023 (Guide BILAN CARBONE®). Facteur moyen : 3.5 kg
        CO₂/kg aliment rescapé. Ce rapport est formaté pour un audit ISO 14001. Données certifiées
        par Too Fresh to Waste.
      </div>
    </div>
  );
}
