'use client';

import { Sparkles, ArrowUpRight } from 'lucide-react';
import { useMerchantOffersFiltered } from '@/hooks/use-merchant-dashboard';
import type { OrderStatsResponse } from '@/types/dashboard';

interface CampaignSidePanelProps {
  stats: OrderStatsResponse | null | undefined;
  onLaunchCampaign: () => void;
  isTrialSuspended?: boolean;
}

// Static next-tier milestone until backend supports gamification
const NEXT_MILESTONE = 500;

export function CampaignSidePanel({
  stats,
  onLaunchCampaign,
  isTrialSuspended,
}: CampaignSidePanelProps) {
  const { data: offersData } = useMerchantOffersFiltered(1, 3, 'active');
  const bagsSaved = stats?.bagsSaved ?? 0;
  const remaining = Math.max(0, NEXT_MILESTONE - bagsSaved);

  const campaigns = (offersData?.offers ?? []).slice(0, 3).map(offer => {
    const total = offer.totalQuantity ?? 0;
    const available = offer.availableQuantity ?? 0;
    const sold = total - available;
    return {
      name: offer.title,
      saved: sold,
      total,
    };
  });

  return (
    <div className='space-y-[20px]'>
      {/* Quick action CTA */}
      <button
        type='button'
        onClick={onLaunchCampaign}
        disabled={isTrialSuspended}
        title={
          isTrialSuspended
            ? 'Your free trial has ended. Contact the admin team to reactivate your account.'
            : undefined
        }
        className='w-full flex items-center justify-between gap-3 px-[20px] py-[16px] rounded-2xl bg-primary-500 text-white shadow-elegant hover:opacity-95 transition group disabled:cursor-not-allowed disabled:opacity-50'
      >
        <div className='flex items-center gap-3'>
          <div className='h-9 w-9 rounded-xl bg-brand-coral grid place-items-center shrink-0'>
            <Sparkles size={16} className='text-white' />
          </div>
          <div className='text-left'>
            <div className='text-xs opacity-70'>Action rapide</div>
            <div className='font-medium text-sm'>Lancer une Campagne de Sauvetage</div>
          </div>
        </div>
        <ArrowUpRight
          size={18}
          className='opacity-70 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform shrink-0'
        />
      </button>

      {/* Active campaigns */}
      <div className='glass rounded-2xl p-[24px] shadow-soft'>
        <div className='flex items-center justify-between mb-[20px]'>
          <h3 className='font-display text-xl text-primary-500'>Campagnes actives</h3>
          <span className='text-xs text-primary-500/60'>
            {campaigns.length > 0 ? `${campaigns.length} en cours` : 'Aucune'}
          </span>
        </div>

        {campaigns.length === 0 ? (
          <p className='text-xs text-primary-500/50 italic text-center py-4'>
            Lancez votre première campagne de sauvetage.
          </p>
        ) : (
          <div className='space-y-[16px]'>
            {campaigns.map(c => {
              const pct = c.total > 0 ? Math.round((c.saved / c.total) * 100) : 0;
              return (
                <div key={c.name}>
                  <div className='flex items-center justify-between mb-1.5 text-sm'>
                    <span className='text-primary-500 font-medium truncate max-w-[70%]'>
                      {c.name}
                    </span>
                    <span className='text-primary-500/60 text-xs shrink-0'>
                      {c.saved}/{c.total}
                    </span>
                  </div>
                  <div className='h-1.5 rounded-full bg-primary-500/[0.08] overflow-hidden'>
                    <div
                      className={`h-full rounded-full transition-all ${
                        pct >= 75 ? 'bg-brand-coral' : 'bg-primary-500'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Next tier card */}
      <div className='rounded-2xl p-[24px] bg-gradient-primary text-white shadow-elegant relative overflow-hidden'>
        <div className='absolute -bottom-10 -right-10 h-40 w-40 rounded-full bg-brand-coral/30 blur-3xl pointer-events-none' />
        <div className='relative'>
          <div className='text-xs uppercase tracking-wider opacity-70 mb-2'>Prochain palier</div>
          <div className='font-display text-2xl leading-tight mb-3'>
            Plus que <span className='text-brand-coral'>{remaining} paniers</span> avant le statut
            Légende.
          </div>
          <div className='text-sm opacity-80'>
            Vous débloquerez un rapport ESG annuel certifié et la mise en avant prioritaire.
          </div>
        </div>
      </div>
    </div>
  );
}
