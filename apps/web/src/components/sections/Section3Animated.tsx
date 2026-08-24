'use client';

import Image from 'next/image';
import { Trophy } from 'lucide-react';
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
    <section id='features' className='bg-[#f9f3f0] md:pb-3xl' aria-labelledby='features-heading'>
      <div className='container mx-auto max-w-7xl'>
        {/* Title Section */}
        <div className='text-center mb-xs'>
          <h2
            id='features-heading'
            className='text-primary-500 text-3xl md:text-4xl lg:text-5xl mb-sm'
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
        <div className='hidden xl:grid grid-cols-3 gap-x-4xl lg:gap-x-6xl gap-y-lg lg:gap-y-2xl pb-4xl items-center justify-items-center max-w-[1400px] mx-auto'>
          {/* Row 1, Col 1: Enjoy Good Food - 75% OFF */}
          <div className='flex flex-col items-end text-end w-[320px] self-end'>
            <Image
              src='/images/low-price.png'
              alt='Low Price'
              width={60}
              height={60}
              className='mb-md'
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
              src='/images/bag.webp'
              alt='Too Fresh To Waste bag'
              fill
              className='object-contain drop-shadow-2xl'
              style={{ top: '40px' }}
              sizes='(min-width: 1024px) 600px, 500px'
              loading='lazy'
            />
          </div>

          {/* Row 1, Col 3: Help Others Live */}
          <div className='flex flex-col items-start text-start w-[320px] self-end'>
            <Image
              src='/icons/share.png'
              alt='Help Others'
              width={60}
              height={60}
              className='mb-md'
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
          <div className='flex flex-col items-end text-end w-[320px]'>
            {/* A trophy rather than a gift box: this benefit is about winning
                the Big Prize, and a wrapped present read as a giveaway. Drawn
                rather than a raster asset so it stays sharp at any density. */}
            <Trophy
              className='text-secondary mb-md h-[60px] w-[60px]'
              strokeWidth={1.5}
              aria-hidden='true'
            />
            <p
              className='text-primary-500 text-2xl leading-tight min-h-[3.5rem]'
              style={{ fontWeight: 900 }}
            >
              {t('benefits.getRewards')}
            </p>
          </div>

          {/* Row 2, Col 3: Help the Planet */}
          <div className='flex flex-col items-start text-start w-[320px]'>
            <Image
              src='/images/help.png'
              alt='Help Planet'
              width={60}
              height={60}
              className='mb-md'
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
        <div className='xl:hidden flex flex-col items-center px-lg md:px-4xl lg:px-3xl'>
          {/* Icons and Text Grid - 2 columns */}
          <div className='grid grid-cols-2 gap-x-lg gap-y-2xl md:gap-x-2xl md:gap-y-4xl lg:gap-x-6xl lg:gap-y-6xl mb-4xl w-full max-w-md md:max-w-lg lg:max-w-2xl'>
            {/* 1. Enjoy Good Food - 75% OFF */}
            <div className='flex flex-col items-center text-center px-sm'>
              <Image
                src='/images/low-price.png'
                alt='Low Price'
                width={50}
                height={50}
                className='mb-sm md:w-14 md:h-14 lg:w-16 lg:h-16'
                loading='lazy'
              />
              <p
                className='text-primary-500 text-sm md:text-base lg:text-lg font-bold leading-tight'
                style={{ fontWeight: 900 }}
              >
                {t('benefits.saveMoney')}
              </p>
            </div>

            {/* 2. Help Others Live */}
            <div className='flex flex-col items-center text-center px-sm'>
              <Image
                src='/icons/share.png'
                alt='Help Others'
                width={50}
                height={50}
                className='mb-sm md:w-14 md:h-14 lg:w-16 lg:h-16'
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
            <div className='flex flex-col items-center text-center px-sm'>
              <Trophy
                className='text-secondary mb-sm h-12 w-12'
                strokeWidth={1.5}
                aria-hidden='true'
              />
              <p
                className='text-primary-500 text-sm md:text-base lg:text-lg font-bold leading-tight'
                style={{ fontWeight: 900 }}
              >
                {t('benefits.getRewards')}
              </p>
            </div>

            {/* 4. Help the Planet */}
            <div className='flex flex-col items-center text-center px-sm'>
              <Image
                src='/images/help.png'
                alt='Help Planet'
                width={50}
                height={50}
                className='mb-sm md:w-14 md:h-14 lg:w-16 lg:h-16'
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
              src='/images/bag.webp'
              alt='Too Fresh To Waste bag'
              width={500}
              height={500}
              className='w-full h-auto object-contain drop-shadow-xl'
              sizes='(max-width: 640px) calc(100vw - 2rem), (max-width: 768px) 384px, (max-width: 1024px) 448px, 512px'
              loading='lazy'
            />
          </div>
        </div>
      </div>
    </section>
  );
}
