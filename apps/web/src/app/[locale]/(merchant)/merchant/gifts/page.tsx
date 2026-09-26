'use client';

import { useTranslations } from 'next-intl';
import { Gift, Package, Refrigerator, ShieldCheck, ShoppingBasket, Tag, Wheat } from 'lucide-react';
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
 *
 * ## What the page is for (2026-09-24, product owner)
 *
 * Every partner shop will be able to buy here the supplies it already buys
 * elsewhere, for less - TFTW groups the orders of all partner shops and
 * negotiates as one large buyer. The page sells that idea: a value headline,
 * how it works in three steps, and the categories with concrete examples, so a
 * pastry chef recognises their own shopping list. The internet perk was
 * removed; hygiene and branding were added because pastry shops buy them
 * weekly. Still no prices, percentages or dates, for the reason above.
 */

interface ComingPerk {
  id: 'packaging' | 'supplies' | 'ingredients' | 'hygiene' | 'branding' | 'equipment';
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
}

/**
 * Frozen - a fresh array in render would give every child a new identity.
 *
 * Only the two existing token pairs are used, alternating. Six perks do not
 * justify six colours: coral is not a decorative accent (`.claude/rules/ui-ux.md`),
 * and inventing another swatch here would be a DESIGN.md §20 governance event.
 * Packaging leads: it is what every pastry shop buys most often.
 */
const GOLD = { iconBg: 'bg-secondary/[0.12]', iconColor: 'text-secondary' } as const;
const PRIMARY = { iconBg: 'bg-primary-500/[0.08]', iconColor: 'text-primary-500' } as const;

const COMING_PERKS: readonly ComingPerk[] = Object.freeze([
  { id: 'packaging', icon: Package, ...GOLD },
  { id: 'supplies', icon: ShoppingBasket, ...PRIMARY },
  { id: 'ingredients', icon: Wheat, ...GOLD },
  { id: 'hygiene', icon: ShieldCheck, ...PRIMARY },
  { id: 'branding', icon: Tag, ...GOLD },
  { id: 'equipment', icon: Refrigerator, ...PRIMARY },
]);

const STEPS = Object.freeze(['group', 'negotiate', 'order'] as const);

export default function MerchantGiftsPage() {
  const t = useTranslations('merchantGifts');

  return (
    <div className='flex flex-col gap-lg'>
      {/* ── Value ── */}
      <section
        aria-labelledby='gifts-title'
        className='glass rounded-2xl shadow-soft flex flex-col items-center px-lg py-3xl text-center'
      >
        <div className='bg-secondary/[0.12] text-secondary grid size-14 shrink-0 place-items-center rounded-2xl'>
          {/* Decorative - the heading below carries the meaning. */}
          <Gift size={26} aria-hidden='true' />
        </div>
        <p className='mt-lg text-xs font-semibold uppercase tracking-wider text-secondary'>
          {t('eyebrow')}
        </p>
        <h1
          id='gifts-title'
          className='font-heading mt-xs max-w-xl text-2xl leading-tight text-primary-500'
        >
          {t('title')}
        </h1>
        <p className='mt-sm max-w-lg text-base leading-relaxed text-primary-500/65'>
          {t('subtitle')}
        </p>
      </section>

      {/* ── How it works ── */}
      <section aria-labelledby='gifts-how' className='glass rounded-2xl shadow-soft p-lg'>
        <h2 id='gifts-how' className='font-heading text-lg text-primary-500'>
          {t('howTitle')}
        </h2>
        <ol className='mt-md grid grid-cols-1 gap-md md:grid-cols-3'>
          {STEPS.map((step, index) => (
            <li key={step} className='flex items-start gap-sm'>
              <span
                aria-hidden='true'
                className='grid size-8 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground'
              >
                {index + 1}
              </span>
              <div className='min-w-0'>
                <h3 className='text-sm font-semibold text-primary-500'>
                  {t(`steps.${step}.title`)}
                </h3>
                <p className='mt-xxs text-sm leading-relaxed text-primary-500/65'>
                  {t(`steps.${step}.body`)}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* ── What is coming ── */}
      <section aria-labelledby='gifts-categories' className='flex flex-col gap-md'>
        <h2 id='gifts-categories' className='font-heading text-lg text-primary-500'>
          {t('categoriesTitle')}
        </h2>
        <div className='grid grid-cols-1 gap-lg md:grid-cols-2 xl:grid-cols-3'>
          {COMING_PERKS.map(perk => {
            const Icon = perk.icon;
            const items = t.raw(`perks.${perk.id}.items`) as string[];

            return (
              <article
                key={perk.id}
                aria-labelledby={`perk-${perk.id}`}
                className='glass rounded-2xl shadow-soft flex flex-col p-lg'
              >
                <div className='flex items-start gap-sm'>
                  <div
                    className={`grid size-10 shrink-0 place-items-center rounded-xl ${perk.iconBg} ${perk.iconColor}`}
                  >
                    <Icon size={18} aria-hidden='true' />
                  </div>
                  <div className='min-w-0 flex-1'>
                    <div className='flex flex-wrap items-center gap-sm'>
                      <h3
                        id={`perk-${perk.id}`}
                        className='font-heading text-md leading-tight text-primary-500'
                      >
                        {t(`perks.${perk.id}.title`)}
                      </h3>
                      <span className='bg-secondary/[0.12] text-secondary rounded-full px-sm py-xxs text-xs font-semibold'>
                        {t('soon')}
                      </span>
                    </div>
                    <p className='mt-xs text-sm leading-relaxed text-primary-500/65'>
                      {t(`perks.${perk.id}.subtitle`)}
                    </p>
                  </div>
                </div>

                <p className='sr-only'>{t('examplesLabel')}</p>
                <ul className='mt-md flex flex-wrap gap-xs'>
                  {items.map(item => (
                    <li
                      key={item}
                      className='rounded-full border border-primary-500/10 bg-background/60 px-sm py-xxs text-xs text-primary-500/80'
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>
      </section>

      <p className='text-center text-sm text-primary-500/60'>{t('notify')}</p>
    </div>
  );
}
