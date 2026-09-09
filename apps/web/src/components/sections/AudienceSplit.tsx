'use client';

import { useTranslations } from 'next-intl';
import { ArrowRight, ShoppingBasket, Store } from 'lucide-react';

import { Link } from '@/i18n/routing';
import { useScrollReveal } from '@/hooks/useScrollReveal';

/**
 * The two doorways, directly under the hero.
 *
 * The hero speaks to merchants, and everything below it speaks to shoppers. Without
 * this block a merchant scrolls into a consumer app tour and a shopper reads a headline
 * about their own profit margin, and both conclude they are on the wrong page. Both
 * destinations already exist; the page simply never offered them.
 *
 * Placed immediately after the hero on purpose: a reader who is in the wrong place
 * should find that out on the first scroll, not the fourth.
 */
const DOORS = [
  {
    key: 'merchant',
    href: '/merchant-signup',
    Icon: Store,
    primary: true,
    reveal: 'sr-left',
  },
  {
    key: 'consumer',
    href: '/consumer',
    Icon: ShoppingBasket,
    primary: false,
    reveal: 'sr-right',
  },
] as const;

export default function AudienceSplit() {
  const t = useTranslations('audienceSplit');
  const sectionRef = useScrollReveal<HTMLElement>();

  return (
    <section
      ref={sectionRef}
      aria-labelledby='audience-split-heading'
      className='bg-primary-500 border-t border-white/10 px-lg py-14 md:py-5xl'
    >
      <div className='mx-auto flex max-w-5xl flex-col gap-4xl'>
        <div className='sr-up flex flex-col gap-sm text-center'>
          <h2
            id='audience-split-heading'
            className='font-heading text-2xl leading-tight text-white md:text-3xl'
          >
            {t('title')}
          </h2>
          <p className='text-base text-white/75'>{t('description')}</p>
        </div>

        <div className='grid gap-lg md:grid-cols-2'>
          {DOORS.map(({ key, href, Icon, primary, reveal }, i) => (
            <Link
              key={key}
              href={href}
              className={
                primary
                  ? `${reveal} group border-secondary/50 hover:border-secondary flex flex-col gap-md rounded-2xl border bg-white/[0.06] p-2xl transition-colors md:p-4xl`
                  : `${reveal} group flex flex-col gap-md rounded-2xl border border-white/15 bg-white/[0.03] p-2xl transition-colors hover:border-white/35 md:p-4xl`
              }
              style={{ '--sr-delay': `${0.3 + i * 0.4}s` } as React.CSSProperties}
            >
              <Icon
                className={primary ? 'text-secondary size-7' : 'size-7 text-white/70'}
                strokeWidth={1.5}
                aria-hidden='true'
              />

              <h3 className='font-heading text-xl text-white md:text-2xl'>{t(`${key}.label`)}</h3>

              <p className='text-base leading-relaxed text-white/70'>{t(`${key}.body`)}</p>

              {/*
                Gold moved off the label and onto the arrow. #C4A25A measures
                4.38 on the flat teal and only 3.68 here, because the card's
                6% white tint lifts the ground to #2C4F53 - either way it is
                under the 4.5 that 12px text needs. An arrow is a non-text
                mark, judged at 3:1, which 3.68 clears, so the gold accent on
                the primary door survives while the label becomes readable.
                Lightening the gold instead was measured and rejected: it only
                reaches 4.56 on flat teal, still fails on the tinted card, and
                a second gold breaks the one-accent rule.
              */}
              <span className='mt-xs inline-flex items-center gap-sm text-sm font-bold text-white'>
                {t(`${key}.cta`)}
                <ArrowRight
                  className={`size-4 shrink-0 transition-transform group-hover:translate-x-xxs rtl:rotate-180 rtl:group-hover:-translate-x-xxs ${
                    primary ? 'text-secondary' : ''
                  }`}
                  aria-hidden='true'
                />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
