'use client';

import { Megaphone, ArrowUpRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMerchantOffersFiltered } from '@/hooks/use-merchant-dashboard';
import type { OrderStatsResponse } from '@/types/dashboard';

interface CampaignSidePanelProps {
  stats: OrderStatsResponse | null | undefined;
  onLaunchCampaign: () => void;
  isTrialSuspended?: boolean;
}

const NEXT_MILESTONE = 500;

export function CampaignSidePanel({
  stats,
  onLaunchCampaign,
  isTrialSuspended,
}: CampaignSidePanelProps) {
  const t = useTranslations('dashboard.campaign');
  const { data: offersData } = useMerchantOffersFiltered(1, 3, 'active');
  const bagsSaved = stats?.bagsSaved ?? 0;
  const remaining = Math.max(0, NEXT_MILESTONE - bagsSaved);

  const campaigns = (offersData?.offers ?? []).slice(0, 3).map(offer => {
    const total = offer.totalQuantity ?? 0;
    const available = offer.availableQuantity ?? 0;
    const sold = total - available;
    return { id: offer.id, name: offer.title, saved: sold, total };
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
        className='w-full flex items-center justify-between gap-sm px-[14px] py-[10px] rounded-xl bg-gradient-to-b from-[#2a5c62] to-primary-500 text-white shadow-[0_4px_0_0_#0f2e31] transition-[transform,box-shadow] duration-100 ease-out hover:brightness-105 active:translate-y-[4px] active:shadow-none group disabled:cursor-not-allowed disabled:opacity-50'
      >
        <div className='flex items-center gap-[10px]'>
          <div className='h-[30px] w-[30px] rounded-lg bg-brand-coral grid place-items-center shrink-0'>
            <Megaphone size={13} className='text-white' />
          </div>
          <div className='text-start'>
            <div className='text-[10px] opacity-70'>{t('quickAction')}</div>
            <div className='font-medium text-[12px]'>{t('launchCampaign')}</div>
          </div>
        </div>
        <ArrowUpRight
          size={14}
          className='opacity-70 group-hover:translate-x-xxs group-hover:-translate-y-xxs transition-transform shrink-0'
        />
      </button>

      {/* Active campaigns */}
      <div className='glass rounded-2xl p-[24px] shadow-soft'>
        <div className='flex items-center justify-between mb-[20px]'>
          <h3 className='font-display text-xl text-primary-500'>{t('activeCampaigns')}</h3>
          <span className='text-xs text-primary-500/60'>
            {campaigns.length > 0 ? t('inProgress', { count: campaigns.length }) : t('none')}
          </span>
        </div>

        {campaigns.length === 0 ? (
          <p className='text-xs text-primary-500/50 italic text-center py-lg'>{t('noCampaigns')}</p>
        ) : (
          <div className='space-y-[16px]'>
            {campaigns.map(c => {
              const pct = c.total > 0 ? Math.round((c.saved / c.total) * 100) : 0;
              return (
                <div key={c.id}>
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
        <div className='absolute -bottom-6xl -right-6xl h-40 w-40 rounded-full bg-brand-coral/30 blur-3xl pointer-events-none' />
        <div className='relative'>
          <div className='text-xs uppercase tracking-wider opacity-70 mb-sm'>{t('nextTier')}</div>
          <div className='font-display text-2xl leading-tight mb-md'>
            {t('nextTierText', { remaining })}
          </div>
          <div className='text-sm opacity-80'>{t('nextTierReward')}</div>
        </div>
      </div>
    </div>
  );
}
