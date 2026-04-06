'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';

/**
 * Section 3: Why Use Too Fresh To Waste
 *
 * Features:
 * - Background color #f9f3f0 (cream/beige)
 * - Two-line title: "WHY USE" (green) + "TOO FRESH TO WASTE" (coral red)
 * - Centered bag image with 4 benefit icons
 * - Grid layout with text positioned around the bag
 * - Fully responsive (grid on desktop, stacked on mobile)
 */
export default function Section3Animated() {
  const t = useTranslations('section3');

  return (
    <section id='features' className='bg-[#f9f3f0] md:pb-12' aria-labelledby='features-heading'>
      <div className='container mx-auto max-w-7xl'>
        {/* Title Section */}
        <div className='text-center mb-1'>
          <h2
            id='features-heading'
            className='text-primary-500 text-3xl md:text-4xl lg:text-5xl mb-2'
            style={{ fontWeight: 900 }}
          >
            {t('titleLine1')}
            <span
              className='text-[#ff7973] text-4xl md:text-5xl lg:text-6xl block'
              style={{ fontWeight: 999 }}
            >
              {t('titleLine2')}
            </span>
          </h2>
        </div>

        {/* Desktop: Bag with Left and Right Text - Grid Layout */}
        <div className='hidden xl:grid grid-cols-3 gap-x-16 lg:gap-x-24 gap-y-4 lg:gap-y-6 pb-8 items-center justify-items-center max-w-[1400px] mx-auto'>
          {/* Row 1, Col 1: Enjoy Good Food - 75% OFF */}
          <div className='flex flex-col items-end text-right w-[320px] self-end'>
            <Image
              src='/images/low-price.png'
              alt='Low Price'
              width={60}
              height={60}
              className='mb-3'
              loading='lazy'
            />
            <p
              className='text-primary-500 text-2xl leading-tight min-h-[3.5rem]'
              style={{ fontWeight: 900 }}
            >
              {t('benefits.saveMoney')}
            </p>
          </div>

          {/* Row 1-2, Col 2: Center - Bag Image (spans 2 rows) */}
          <div className='relative w-[500px] h-[500px] lg:w-[600px] lg:h-[600px] row-span-2'>
            <Image
              src='/images/bag.png'
              alt='Too Fresh To Waste bag'
              fill
              className='object-contain drop-shadow-2xl'
              style={{ top: '40px' }}
              sizes='(min-width: 1024px) 600px, 500px'
              loading='lazy'
            />
          </div>

          {/* Row 1, Col 3: Earn Points */}
          <div className='flex flex-col items-start text-left w-[320px] self-end'>
            <Image
              src='/images/points.png'
              alt='Points'
              width={60}
              height={60}
              className='mb-3'
              loading='lazy'
            />
            <p
              className='text-primary-500 text-2xl leading-tight min-h-[3.5rem]'
              style={{ fontWeight: 900 }}
            >
              {t('benefits.earnPoints')}
            </p>
          </div>

          {/* Row 2, Col 1: Get Rewards */}
          <div className='flex flex-col items-end text-right w-[320px]'>
            <Image
              src='/images/reward.png'
              alt='Rewards'
              width={60}
              height={60}
              className='mb-3'
              loading='lazy'
            />
            <p
              className='text-primary-500 text-2xl leading-tight min-h-[3.5rem]'
              style={{ fontWeight: 900 }}
            >
              {t('benefits.getRewards')}
            </p>
          </div>

          {/* Row 2, Col 3: Help the Planet */}
          <div className='flex flex-col items-start text-left w-[320px]'>
            <Image
              src='/images/help.png'
              alt='Help Planet'
              width={60}
              height={60}
              className='mb-3'
              loading='lazy'
            />
            <p
              className='text-primary-500 text-2xl leading-tight min-h-[3.5rem]'
              style={{ fontWeight: 900 }}
            >
              {t('benefits.helpPlanet')}
            </p>
          </div>
        </div>

        {/* Mobile & Tablet: Icons and Text Above Bag */}
        <div className='xl:hidden flex flex-col items-center px-4 md:px-8 lg:px-12'>
          {/* Icons and Text Grid - 2 columns */}
          <div className='grid grid-cols-2 gap-x-4 gap-y-6 md:gap-x-6 md:gap-y-8 lg:gap-x-10 lg:gap-y-10 mb-8 w-full max-w-md md:max-w-lg lg:max-w-2xl'>
            {/* 1. Enjoy Good Food - 75% OFF */}
            <div className='flex flex-col items-center text-center px-2'>
              <Image
                src='/images/low-price.png'
                alt='Low Price'
                width={50}
                height={50}
                className='mb-2 md:w-14 md:h-14 lg:w-16 lg:h-16'
                loading='lazy'
              />
              <p
                className='text-primary-500 text-sm md:text-base lg:text-lg font-bold leading-tight'
                style={{ fontWeight: 900 }}
              >
                {t('benefits.saveMoney')}
              </p>
            </div>

            {/* 2. Earn Points */}
            <div className='flex flex-col items-center text-center px-2'>
              <Image
                src='/images/points.png'
                alt='Points'
                width={50}
                height={50}
                className='mb-2 md:w-14 md:h-14 lg:w-16 lg:h-16'
                loading='lazy'
              />
              <p
                className='text-primary-500 text-sm md:text-base lg:text-lg font-bold leading-tight'
                style={{ fontWeight: 900 }}
              >
                {t('benefits.earnPoints')}
              </p>
            </div>

            {/* 3. Get Rewards */}
            <div className='flex flex-col items-center text-center px-2'>
              <Image
                src='/images/reward.png'
                alt='Rewards'
                width={50}
                height={50}
                className='mb-2 md:w-14 md:h-14 lg:w-16 lg:h-16'
                loading='lazy'
              />
              <p
                className='text-primary-500 text-sm md:text-base lg:text-lg font-bold leading-tight'
                style={{ fontWeight: 900 }}
              >
                {t('benefits.getRewards')}
              </p>
            </div>

            {/* 4. Help the Planet */}
            <div className='flex flex-col items-center text-center px-2'>
              <Image
                src='/images/help.png'
                alt='Help Planet'
                width={50}
                height={50}
                className='mb-2 md:w-14 md:h-14 lg:w-16 lg:h-16'
                loading='lazy'
              />
              <p
                className='text-primary-500 text-sm md:text-base lg:text-lg font-bold leading-tight'
                style={{ fontWeight: 900 }}
              >
                {t('benefits.helpPlanet')}
              </p>
            </div>
          </div>

          {/* Bag Image */}
          <div className='w-full max-w-sm md:max-w-md lg:max-w-lg mx-auto'>
            <Image
              src='/images/bag.png'
              alt='Too Fresh To Waste bag'
              width={500}
              height={500}
              className='w-full h-auto object-contain drop-shadow-xl'
              loading='lazy'
            />
          </div>
        </div>
      </div>
    </section>
  );
}
