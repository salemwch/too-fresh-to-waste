'use client';

import { useTranslations } from 'next-intl';
import Image from 'next/image';

interface StepCard {
  id: number;
  icon: string;
  iconAlt: string;
}

/*
 * Three steps, not six.
 *
 * Steps four to six used to be "enjoy your food", "earn points" and "get rewards".
 * None of those is a step in collecting a bag - they are what happens afterwards -
 * and listing them here made an easy process look like a long one. Points and
 * rewards now have their own section.
 *
 * One entry per `slides.stepN` key in the locale files. A test pins the two
 * together, because a card without copy renders an empty slide.
 */
const STEP_CARDS: StepCard[] = [
  { id: 1, icon: '/icons/browsing.png', iconAlt: 'Browse offers' },
  { id: 2, icon: '/icons/booking.png', iconAlt: 'Reserve a bag' },
  { id: 3, icon: '/icons/order.png', iconAlt: 'Collect your food' },
];

export default function Section4() {
  const t = useTranslations('section4');

  return (
    <section
      id='how-to-use'
      className='bg-primary-500 flex justify-center items-center pt-2xl md:pt-0 pb-3xl md:pb-4xl px-lg relative z-10'
      aria-labelledby='how-to-use-heading'
    >
      {/* Wave at the top */}
      <svg
        xmlns='http://www.w3.org/2000/svg'
        viewBox='0 0 1440 320'
        className='absolute top-0 left-0 w-full'
        style={{ transform: 'translateY(-99%)' }}
        preserveAspectRatio='none'
      >
        <path
          fill='hsl(var(--primary))'
          fillOpacity='1.00'
          d='M 0 270 L 0 185.52490399562885 C 102.85714285714286 185.52490399562885 102.85714285714286 278.99517607344757 205.71428571428572 278.99517607344757 C 308.57142857142856 278.99517607344757 308.57142857142856 202.65754578736295 411.42857142857144 202.65754578736295 C 514.2857142857142 202.65754578736295 514.2857142857142 211.86036557464226 617.1428571428571 211.86036557464226 C 720 211.86036557464226 720 155.39411761119555 822.8571428571429 155.39411761119555 C 925.7142857142858 155.39411761119555 925.7142857142858 242.90942100346388 1028.5714285714287 242.90942100346388 C 1131.4285714285716 242.90942100346388 1131.4285714285716 227.68305379355218 1234.2857142857142 227.68305379355218 C 1337.142857142857 227.68305379355218 1337.142857142857 242.284257936268 1440 242.284257936268 C 1440 242.284257936268 1440 320 1440 320 L 1440 320 L 0 320 Z'
        />
      </svg>

      <div className='w-full max-w-[1200px] text-center'>
        {/* Title */}
        <h2
          id='how-to-use-heading'
          className='text-secondary text-xl md:text-3xl leading-tight font-bold mb-sm'
        >
          {t('title')}
        </h2>

        {/* Description */}
        <p className='text-brand-cream/70 text-base leading-normal mb-2xl'>{t('description')}</p>

        {/* Grid Layout */}
        <div className='steps-grid'>
          {STEP_CARDS.map(card => (
            <article key={card.id} className='card-wrapper'>
              {/* Circle Badge with Icon */}
              <div className='card-circle'>
                <Image
                  src={card.icon}
                  alt={card.iconAlt}
                  width={32}
                  height={32}
                  className='card-circle-icon'
                  loading='lazy'
                />
              </div>

              {/* Card */}
              <div className='card'>
                {/* Card Title */}
                <h3 className='card-title'>{t(`slides.step${card.id}.title`)}</h3>

                {/* Card Description */}
                <p className='card-desc'>{t(`slides.step${card.id}.description`)}</p>
              </div>
            </article>
          ))}
        </div>
      </div>

      {/* Styles */}
      <style jsx global>{`
        /* Grid Layout - Responsive */
        .steps-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 24px;
          width: 100%;
        }

        /* Tablet: 2 columns */
        @media (min-width: 768px) {
          .steps-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 28px;
          }
        }

        /* Desktop: 3 columns */
        @media (min-width: 1024px) {
          .steps-grid {
            grid-template-columns: repeat(3, 1fr);
            gap: 32px;
          }
        }

        /* Card Wrapper */
        .card-wrapper {
          position: relative;
          display: flex;
          flex-direction: column;
        }

        /* Card */
        .card {
          background-color: #fff;
          padding: 24px;
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          text-align: left;
          border-radius: 30px;
        }

        /* Circle Badge */
        .card-circle {
          width: 60px;
          height: 60px;
          background-color: #fff;
          position: absolute;
          top: -10px;
          right: -10px;
          border-radius: 50%;
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 1;
          padding: 14px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
        }

        /* Circle Icon */
        .card-circle-icon {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }

        /* Card Title */
        .card-title {
          font-size: 1.2rem;
          font-weight: 700;
          margin-bottom: 10px;
          padding-right: 70px;
          color: #1a1a1a;
        }

        /* Card Description */
        .card-desc {
          font-size: 0.875rem;
          line-height: 1.5;
          color: #666;
          margin-bottom: 0;
          padding-right: 65px;
          flex-grow: 1; /* Allows description to expand and fill remaining space */
        }
      `}</style>
    </section>
  );
}
