'use client';

import { useTranslations } from 'next-intl';
import { Gift, Package, Wifi } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/**
 * Merchant gifts - announcement only, for now.
 *
 * ## Why there are no numbers on this screen
 *
 * The unit economics are not decided: what a data bundle costs wholesale, what
 * margin a packaging supplier gives at volume, and how much of the 19%
 * commission each perk may consume before it stops paying for itself.
 *
 * Until those exist, the page names what is coming and nothing else. No tiers,
 * no thresholds, no progress, no eligibility. A merchant who reads a number
 * here treats it as a promise, and withdrawing a promise costs far more than
 * announcing late.
 *
 * ## What has to be true before tiers go back on this page
 *
 * For a tier awarded at some bag count to be worth running:
 *
 * ```
 *   perk cost  <  bagsRequired * averageSubtotal * 0.19 * upliftShare
 * ```
 *
 * where `upliftShare` is the portion of commission the perk may spend. The
 * trap: a perk handed to a merchant who would have hit the threshold anyway
 * costs full price and returns nothing, so tiers must sit above normal
 * behaviour rather than under it.
 *
 * ## No loading or error state
 *
 * Deliberate, not an omission against DESIGN.md §9. The screen reads no data,
 * so there is nothing to be pending or to fail. States return when it does.
 */

interface ComingPerk {
  id: 'internet' | 'packaging';
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
}

/** Frozen - a fresh array in render would give every child a new identity. */
const COMING_PERKS: readonly ComingPerk[] = Object.freeze([
  {
    id: 'internet',
    icon: Wifi,
    iconBg: 'bg-primary-500/[0.08]',
    iconColor: 'text-primary-500',
  },
  {
    id: 'packaging',
    icon: Package,
    iconBg: 'bg-secondary/[0.12]',
    iconColor: 'text-secondary',
  },
]);

export default function MerchantGiftsPage() {
  const t = useTranslations('merchantGifts');

  return (
    <div className='flex flex-col gap-lg'>
      {/* ── Announcement ── */}
      <div className='glass rounded-2xl shadow-soft flex flex-col items-center p-4xl text-center'>
        <div className='bg-secondary/[0.12] text-secondary grid size-14 shrink-0 place-items-center rounded-2xl'>
          {/* Decorative - the heading below carries the meaning. */}
          <Gift size={26} aria-hidden='true' />
        </div>

        <h1 className='font-heading mt-lg text-xl leading-tight text-primary-500'>{t('title')}</h1>

        <p className='mt-sm max-w-md text-sm leading-relaxed text-primary-500/65'>
          {t('subtitle')}
        </p>
      </div>

      {/* ── What is coming ── */}
      <div className='grid grid-cols-1 gap-lg lg:grid-cols-2'>
        {COMING_PERKS.map(perk => {
          const Icon = perk.icon;

          return (
            <section key={perk.id} className='glass rounded-2xl shadow-soft p-lg'>
              <div className='flex items-start gap-sm'>
                <div
                  className={`grid size-10 shrink-0 place-items-center rounded-xl ${perk.iconBg} ${perk.iconColor}`}
                >
                  <Icon size={18} aria-hidden='true' />
                </div>

                <div className='min-w-0 flex-1'>
                  <div className='flex flex-wrap items-center gap-sm'>
                    <h2 className='font-heading text-md leading-tight text-primary-500'>
                      {t(`perks.${perk.id}.title`)}
                    </h2>
                    <span className='bg-secondary/[0.12] text-secondary rounded-full px-sm py-xxs text-xs font-semibold'>
                      {t('soon')}
                    </span>
                  </div>
                  <p className='mt-xs text-sm leading-relaxed text-primary-500/65'>
                    {t(`perks.${perk.id}.subtitle`)}
                  </p>
                </div>
              </div>
            </section>
          );
        })}
      </div>

      <p className='text-center text-xs text-primary-500/50'>{t('notify')}</p>
    </div>
  );
}
