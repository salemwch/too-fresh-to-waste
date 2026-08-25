'use client';

import { useTranslations } from 'next-intl';
import { useAppLaunchModal } from '@/lib/app-launch-modal.store';

/**
 * Section 2: App Introduction
 *
 * Features:
 * - Background color #f9f3f0 (cream/beige)
 * - Title with primary green color and rewards icon
 * - Subtitle with #5F6D6D color
 * - App Store and Google Play download buttons
 */
export default function Section2() {
  const t = useTranslations('section2');
  const { open: openLaunchModal } = useAppLaunchModal();

  return (
    <section
      id='app'
      className='bg-brand-cream pt-4xl md:pt-3xl lg:pt-4xl pb-lg md:pb-2xl lg:pb-4xl px-lg'
      aria-labelledby='app-heading'
    >
      <div className='container mx-auto max-w-6xl'>
        {/* Title with rewards icon */}
        <h2
          id='app-heading'
          className='text-primary-500 text-3xl md:text-4xl lg:text-5xl font-bold text-center mb-2xl leading-tight'
        >
          {t('title')}
          <span
            className='inline-block ms-sm text-4xl md:text-5xl lg:text-6xl'
            role='img'
            aria-label='rewards'
          >
            🎁
          </span>
        </h2>

        {/* Secondary title line */}
        {/* Subtitle */}
        <p className='text-[#5F6D6D] text-base md:text-lg lg:text-xl text-center mb-3xl max-w-4xl mx-auto leading-relaxed'>
          {t.rich('description', {
            discount: chunks => <span className='font-bold text-primary-500'>{chunks}</span>,
          })}
        </p>

        {/* Download Buttons */}
        <div className='flex flex-col sm:flex-row gap-md justify-center items-center'>
          {/* App Store Button */}
          <button
            type='button'
            onClick={openLaunchModal}
            className='group flex items-center justify-center gap-sm bg-black text-white px-lg py-2.5 rounded-full hover:bg-gray-800 transition-all duration-300 shadow-md hover:shadow-lg w-full sm:w-auto'
            aria-label='Download on the App Store'
          >
            <svg className='w-6 h-6 flex-shrink-0' viewBox='0 0 24 24' fill='currentColor'>
              <path d='M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z' />
            </svg>
            <div className='flex flex-col items-start justify-center'>
              <div className='text-[9px] leading-tight'>{t('downloadButtons.appStore.prefix')}</div>
              <div className='text-base font-semibold leading-tight'>
                {t('downloadButtons.appStore.name')}
              </div>
            </div>
          </button>

          {/* Google Play Button */}
          <button
            type='button'
            onClick={openLaunchModal}
            className='group flex items-center justify-center gap-sm bg-black text-white px-lg py-2.5 rounded-full hover:bg-gray-800 transition-all duration-300 shadow-md hover:shadow-lg w-full sm:w-auto'
            aria-label='Get it on Google Play'
          >
            <svg className='w-6 h-6 flex-shrink-0' viewBox='0 0 24 24' fill='currentColor'>
              <path d='M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.5,12.92 20.16,13.19L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z' />
            </svg>
            <div className='flex flex-col items-start justify-center'>
              <div className='text-[9px] leading-tight'>
                {t('downloadButtons.playStore.prefix')}
              </div>
              <div className='text-base font-semibold leading-tight'>
                {t('downloadButtons.playStore.name')}
              </div>
            </div>
          </button>
        </div>
      </div>
    </section>
  );
}
