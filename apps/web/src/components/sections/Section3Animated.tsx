'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';

import { useScrollReveal } from '@/hooks/useScrollReveal';

/**
 * Section 3: why use Too Fresh To Waste.
 *
 * "Unpack". The four benefits are not captions floating around a photograph -
 * they are things that came out of the bag, hung as paper tags on strings and
 * pegged around it. Each tag swings on its own punch hole when you reach it.
 *
 * The four are two pairs, and the layout says so without a label: the start
 * column is what you take home, the end column is what everyone else gets.
 *
 * One DOM tree, not two. The previous version rendered every benefit twice,
 * once for desktop and once for mobile, which meant every copy change had to
 * be made in two places and the two drifted. Below xl these are a plain
 * responsive grid; at xl they become a three-column grid with the bag in the
 * middle column, spanning both rows. Everything directional - rotation, string origin, the RTL mirror -
 * lives in the `.tftw-tag` block in globals.css, because all of it is gated on
 * breakpoint and writing direction together.
 */

/** Position at xl. `t`/`b` is the row, `l`/`r` the column. */
type Slot = 'tl' | 'bl' | 'tr' | 'br';

interface Benefit {
  /** key under the `section3.benefits` namespace */
  key: 'saveMoney' | 'yourMoney' | 'community' | 'planet';
  slot: Slot;
  /** grid cell plus any hand-hung offset, applied at xl and above only */
  place: string;
  reveal: 'sr-left' | 'sr-right';
  delay: string;
}

/*
 * DOM order is the order these stack on mobile: the two you take home, then
 * the two the city keeps. `place` carries the desktop cell, so the stacked
 * order and the placed order can differ without a second copy of the markup.
 *
 * These are grid cells, not absolute offsets. An earlier version pinned the
 * top card with `top-[76px]` and the bottom one with `bottom-[96px]` inside a
 * fixed `min-h-[720px]`, which only holds while the copy stays the length it
 * was when the numbers were picked. It did not: the taller community and
 * planet cards ran into each other. Rows that size to their content cannot
 * overlap at any copy length, in any of the three locales.
 *
 * Placement is by column number, and the grid itself mirrors in Arabic, so
 * column 1 is the reading-start side in every locale.
 *
 * No per-card `mt-*` offsets. Two of these carried a small "hand-hung" stagger,
 * which is precisely what made the gap between the left pair differ from the
 * gap between the right pair. Row one now tops out level across both columns.
 */
const BENEFITS: readonly Benefit[] = [
  {
    key: 'saveMoney',
    slot: 'tl',
    place: 'xl:col-start-1 xl:row-start-1',
    reveal: 'sr-left',
    delay: '0.25s',
  },
  {
    key: 'yourMoney',
    slot: 'bl',
    place: 'xl:col-start-1 xl:row-start-2',
    reveal: 'sr-left',
    delay: '0.7s',
  },
  {
    key: 'community',
    slot: 'tr',
    place: 'xl:col-start-3 xl:row-start-1',
    reveal: 'sr-right',
    delay: '0.25s',
  },
  {
    key: 'planet',
    slot: 'br',
    place: 'xl:col-start-3 xl:row-start-2',
    reveal: 'sr-right',
    delay: '0.7s',
  },
];

export default function Section3Animated() {
  const t = useTranslations('section3');
  const sectionRef = useScrollReveal<HTMLElement>();

  return (
    <section
      ref={sectionRef}
      id='features'
      // pb-0 on mobile: the next section's wave rises ~43px above its own top
      // edge at the deepest dip, so a 64px gap parked the bag just clear of it.
      // At 0 the bag bottom falls inside the wave and is covered by it.
      className='bg-brand-cream pb-0 md:pb-5xl'
      aria-labelledby='features-heading'
    >
      <div className='container relative z-10 mx-auto max-w-7xl px-lg'>
        <div className='sr-up text-center'>
          <p className='text-brand-green mb-md text-sm font-bold uppercase tracking-[0.28em]'>
            {t('eyebrow')}
          </p>
          {/*
            Line two is the brand name, so it outranks the question that
            introduces it.

            brand-green, not brand-coral. The comment here used to cite ~3.2:1
            and call it "large text only", but that figure belongs to
            accent-500 (#F55449). This element renders brand-coral (#ff7973),
            measured at 2.32 on cream - which fails even the 3:1 large-text
            bar. tailwind.config.ts already records that number and names
            #017C6E as the light-surface accent for exactly this reason; it
            measures 4.65 here, clearing AA for normal text, never mind large.
          */}
          <h2
            id='features-heading'
            className='text-primary-500 text-3xl leading-none md:text-4xl lg:text-5xl'
            style={{ fontWeight: 900 }}
          >
            {t('titleLine1')}
            <span
              className='text-brand-green block text-4xl md:text-5xl lg:text-6xl'
              style={{ fontWeight: 900 }}
            >
              {t('titleLine2')}
            </span>
          </h2>
        </div>

        {/*
          The xl row gap is generous because each tag's string and peg hang
          about 40px above it, outside the card box. The container's own top
          margin does the same job for row one.

          `items-start` at xl so each card sizes to its own content rather
          than stretching to fill the row. This avoids the visible bottom
          whitespace that stretch creates on the shorter card of each pair.
        */}
        <div className='mt-2xl grid grid-cols-1 gap-lg md:grid-cols-2 xl:mt-4xl xl:items-start xl:grid-cols-[268px_1fr_268px] xl:gap-x-3xl xl:gap-y-4xl'>
          {BENEFITS.map(benefit => (
            <article
              key={benefit.key}
              className={`${benefit.reveal} tftw-tag tftw-tag--${benefit.slot} ${benefit.place} bg-card pt-lg px-lg pb-sm shadow-lg relative rounded-md`}
              style={{ '--sr-delay': benefit.delay } as React.CSSProperties}
            >
              <span className='tftw-tag__peg' aria-hidden='true' />
              <span className='tftw-tag__string' aria-hidden='true' />
              <span className='tftw-tag__hole' aria-hidden='true' />

              <p className='bg-primary-500/5 text-primary-500 px-sm py-xxs mb-sm inline-block rounded-sm text-sm font-bold tracking-[0.1em]'>
                {t(`benefits.${benefit.key}.chip`)}
              </p>
              <h3 className='text-primary-500 mb-xs text-md font-bold leading-tight'>
                {t(`benefits.${benefit.key}.title`)}
              </h3>
              <p className='text-muted-foreground text-md leading-normal'>
                {t(`benefits.${benefit.key}.body`)}
              </p>
            </article>
          ))}

          <div
            className='sr-scale mt-xl flex justify-center md:col-span-2 xl:col-span-1 xl:col-start-2 xl:row-start-1 xl:row-span-2 xl:mt-0 xl:self-center'
            style={{ '--sr-delay': '0.5s' } as React.CSSProperties}
          >
            <Image
              src='/images/bag.webp'
              alt={t('bagAlt')}
              width={520}
              height={520}
              className='h-auto w-[min(74vw,380px)] object-contain drop-shadow-2xl xl:w-[520px]'
              sizes='(min-width: 1280px) 520px, (min-width: 768px) 380px, 74vw'
              loading='lazy'
            />
          </div>
        </div>
      </div>
    </section>
  );
}
