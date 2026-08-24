import { useTranslations } from 'next-intl';
import { ArrowRight, ShoppingBasket, Store } from 'lucide-react';

import { Link } from '@/i18n/routing';

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
    // The merchant door is the emphasised one because the hero already spoke to
    // them; this confirms rather than redirects.
    primary: true,
  },
  {
    key: 'consumer',
    href: '/consumer',
    Icon: ShoppingBasket,
    primary: false,
  },
] as const;

export default function AudienceSplit() {
  const t = useTranslations('audienceSplit');

  return (
    <section
      aria-labelledby='audience-split-heading'
      className='bg-primary-500 border-t border-white/10 px-lg py-14 md:py-5xl'
    >
      <div className='mx-auto flex max-w-5xl flex-col gap-4xl'>
        <div className='flex flex-col gap-sm text-center'>
          <h2
            id='audience-split-heading'
            className='font-heading text-2xl leading-tight text-white md:text-3xl'
          >
            {t('title')}
          </h2>
          <p className='text-sm text-white/60'>{t('description')}</p>
        </div>

        <div className='grid gap-lg md:grid-cols-2'>
          {DOORS.map(({ key, href, Icon, primary }) => (
            <Link
              key={key}
              href={href}
              className={
                primary
                  ? 'group border-secondary/50 hover:border-secondary flex flex-col gap-md rounded-2xl border bg-white/[0.06] p-2xl transition-colors md:p-4xl'
                  : 'group flex flex-col gap-md rounded-2xl border border-white/15 bg-white/[0.03] p-2xl transition-colors hover:border-white/35 md:p-4xl'
              }
            >
              <Icon
                className={primary ? 'text-secondary size-7' : 'size-7 text-white/70'}
                strokeWidth={1.5}
                aria-hidden='true'
              />

              <h3 className='font-heading text-xl text-white md:text-2xl'>{t(`${key}.label`)}</h3>

              <p className='text-sm leading-relaxed text-white/70'>{t(`${key}.body`)}</p>

              <span
                className={
                  primary
                    ? 'text-secondary mt-xs inline-flex items-center gap-sm text-sm font-bold'
                    : 'mt-xs inline-flex items-center gap-sm text-sm font-bold text-white'
                }
              >
                {t(`${key}.cta`)}
                <ArrowRight
                  className='size-4 shrink-0 transition-transform group-hover:translate-x-xxs rtl:rotate-180 rtl:group-hover:-translate-x-xxs'
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
