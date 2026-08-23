import { useTranslations } from 'next-intl';
import { HeartHandshake, Sparkles, Trophy } from 'lucide-react';

/**
 * Points and prizes, taken out of the step flow.
 *
 * These used to be steps five and six of "how to use the app", which is what made
 * getting a bag look like a six-step process. Earning points is not a step in
 * collecting food; it is what happens because you did. Separating them lets the
 * journey read as three steps and gives the rewards somewhere to be explained
 * properly.
 *
 * Distinct from the Big Prize FAQ below it: the FAQ answers how the prize is won,
 * this says that points exist at all, and most readers never reach the FAQ.
 */
const CARDS = [
  { key: 'points', Icon: Sparkles },
  { key: 'families', Icon: HeartHandshake },
  { key: 'prize', Icon: Trophy },
] as const;

export default function Rewards() {
  const t = useTranslations('rewards');

  return (
    <section
      aria-labelledby='rewards-heading'
      className='bg-primary-500 border-t border-white/10 px-4 py-14 md:py-20'
    >
      <div className='mx-auto flex max-w-5xl flex-col gap-8'>
        <div className='flex flex-col gap-3'>
          <p className='text-[11px] font-medium tracking-[0.2em] text-white/50 uppercase'>
            {t('eyebrow')}
          </p>
          <h2
            id='rewards-heading'
            className='font-heading max-w-[20ch] text-2xl leading-tight text-white md:text-4xl'
          >
            {t('title')}
          </h2>
          <p className='max-w-2xl text-sm leading-relaxed text-white/70 md:text-base'>
            {t('description')}
          </p>
        </div>

        <div className='grid gap-px overflow-hidden rounded-2xl border border-white/15 bg-white/10 sm:grid-cols-3'>
          {CARDS.map(({ key, Icon }) => (
            <div key={key} className='bg-primary-500 flex flex-col gap-3 p-6'>
              <Icon className='text-secondary size-6' strokeWidth={1.5} aria-hidden='true' />
              <h3 className='font-heading text-lg text-white'>{t(`${key}.label`)}</h3>
              <p className='text-sm leading-relaxed text-white/65'>{t(`${key}.body`)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
