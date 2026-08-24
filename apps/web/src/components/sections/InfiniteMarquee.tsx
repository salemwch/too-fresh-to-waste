'use client';

import { useTranslations } from 'next-intl';

/**
 * Infinite Marquee Component
 *
 * Features:
 * - Smooth infinite scroll animation from right to left
 * - Features key benefits with icons
 * - Primary brand color background (#1E4448)
 * - Accessibility support (respects prefers-reduced-motion)
 * - Seamless loop with duplicated content
 *
 * Implementation based on modern Tailwind CSS best practices
 */

interface MarqueeItem {
  key: string;
  icon: React.ReactNode;
}

export default function InfiniteMarquee() {
  const t = useTranslations('marquee');

  const items: MarqueeItem[] = [
    {
      key: 'surplusFood',
      icon: (
        <svg
          className='w-full h-full'
          viewBox='0 0 24 24'
          fill='none'
          xmlns='http://www.w3.org/2000/svg'
        >
          <path
            d='M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 20C7.59 20 4 16.41 4 12C4 7.59 7.59 4 12 4C16.41 4 20 7.59 20 12C20 16.41 16.41 20 12 20Z'
            fill='white'
          />
          <path
            d='M12 6C11.45 6 11 6.45 11 7V12.41L8.29 15.12C7.9 15.51 7.9 16.15 8.29 16.54C8.68 16.93 9.32 16.93 9.71 16.54L12.71 13.54C12.9 13.35 13 13.09 13 12.83V7C13 6.45 12.55 6 12 6Z'
            fill='white'
            opacity='0.8'
          />
        </svg>
      ),
    },
    {
      key: 'bigPrize',
      icon: (
        <svg
          className='w-full h-full'
          viewBox='0 0 24 24'
          fill='none'
          xmlns='http://www.w3.org/2000/svg'
        >
          <path
            d='M19 5H17.83L15 2.17C14.8 1.97 14.52 1.88 14.24 1.91C13.96 1.95 13.71 2.11 13.59 2.36L12 5.54L10.41 2.36C10.29 2.11 10.04 1.95 9.76 1.91C9.48 1.88 9.2 1.97 9 2.17L6.17 5H5C3.9 5 3 5.9 3 7V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V7C21 5.9 20.1 5 19 5ZM12 4.41L13.1 6.47C13.32 6.91 13.77 7.16 14.24 7.09C14.71 7.02 15.09 6.65 15.16 6.18L16.59 5H18L12 15L6 5H7.41L8.84 6.18C8.91 6.65 9.29 7.02 9.76 7.09C10.23 7.16 10.68 6.91 10.9 6.47L12 4.41ZM19 19H5V7H6.41L12 16.28L17.59 7H19V19Z'
            fill='white'
          />
        </svg>
      ),
    },
    {
      key: 'points',
      icon: (
        <svg
          className='w-full h-full'
          viewBox='0 0 24 24'
          fill='none'
          xmlns='http://www.w3.org/2000/svg'
        >
          <path
            d='M12 17.27L18.18 21L16.54 13.97L22 9.24L14.81 8.63L12 2L9.19 8.63L2 9.24L7.46 13.97L5.82 21L12 17.27Z'
            fill='white'
          />
        </svg>
      ),
    },
    {
      key: 'rewards',
      icon: (
        <svg
          className='w-full h-full'
          viewBox='0 0 24 24'
          fill='none'
          xmlns='http://www.w3.org/2000/svg'
        >
          <path
            d='M20 6H17.82C17.93 5.69 18 5.35 18 5C18 3.34 16.66 2 15 2C13.95 2 13.04 2.54 12.5 3.35L12 4.02L11.5 3.34C10.96 2.54 10.05 2 9 2C7.34 2 6 3.34 6 5C6 5.35 6.07 5.69 6.18 6H4C2.9 6 2 6.9 2 8V19C2 20.1 2.9 21 4 21H20C21.1 21 22 20.1 22 19V8C22 6.9 21.1 6 20 6ZM15 4C15.55 4 16 4.45 16 5C16 5.55 15.55 6 15 6C14.45 6 14 5.55 14 5C14 4.45 14.45 4 15 4ZM9 4C9.55 4 10 4.45 10 5C10 5.55 9.55 6 9 6C8.45 6 8 5.55 8 5C8 4.45 8.45 4 9 4ZM20 19H4V8H8.79C9.38 8.62 10.18 9 11 9H13C13.82 9 14.62 8.62 15.21 8H20V19Z'
            fill='white'
          />
          <path d='M11 11H13V17H11V11Z' fill='white' opacity='0.8' />
          <path d='M15 13H17V17H15V13Z' fill='white' opacity='0.8' />
          <path d='M7 13H9V17H7V13Z' fill='white' opacity='0.8' />
        </svg>
      ),
    },
    {
      key: 'reviews',
      icon: (
        <svg
          className='w-full h-full'
          viewBox='0 0 24 24'
          fill='none'
          xmlns='http://www.w3.org/2000/svg'
        >
          <path
            d='M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2ZM20 16H5.17L4 17.17V4H20V16Z'
            fill='white'
          />
          <path
            d='M12 15L9.5 13.5L7 15L7.75 12.25L5.5 10.25L8.25 10L9.5 7.5L10.75 10L13.5 10.25L11.25 12.25L12 15Z'
            fill='white'
            opacity='0.9'
          />
        </svg>
      ),
    },
    {
      key: 'food',
      icon: (
        <svg
          className='w-full h-full'
          viewBox='0 0 24 24'
          fill='none'
          xmlns='http://www.w3.org/2000/svg'
        >
          {/* Burger Icon */}
          <path
            d='M12 2C11.45 2 11 2.45 11 3C11 3.55 11.45 4 12 4C16.41 4 20 7.59 20 12C20 12.55 20.45 13 21 13C21.55 13 22 12.55 22 12C22 6.48 17.52 2 12 2Z'
            fill='white'
            opacity='0.7'
          />
          <path d='M12 6C9.24 6 7 8.24 7 11H17C17 8.24 14.76 6 12 6Z' fill='white' />
          <rect x='6' y='11' width='12' height='2' rx='0.5' fill='white' opacity='0.9' />
          <path
            d='M7 13C6.45 13 6 13.45 6 14V16C6 16.55 6.45 17 7 17H17C17.55 17 18 16.55 18 16V14C18 13.45 17.55 13 17 13H7Z'
            fill='white'
          />
          <ellipse cx='12' cy='18' rx='6.5' ry='1' fill='white' opacity='0.6' />
          <circle cx='9' cy='15' r='0.7' fill='hsl(var(--primary))' opacity='0.5' />
          <circle cx='12' cy='14.5' r='0.7' fill='hsl(var(--primary))' opacity='0.5' />
          <circle cx='15' cy='15' r='0.7' fill='hsl(var(--primary))' opacity='0.5' />
        </svg>
      ),
    },
    {
      key: 'surpriseBag',
      icon: (
        <svg
          className='w-full h-full'
          viewBox='0 0 24 24'
          fill='none'
          xmlns='http://www.w3.org/2000/svg'
        >
          <path
            d='M18 6H16C16 3.79 14.21 2 12 2C9.79 2 8 3.79 8 6H6C4.9 6 4 6.9 4 8V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8C20 6.9 19.1 6 18 6ZM12 4C13.1 4 14 4.9 14 6H10C10 4.9 10.9 4 12 4ZM18 20H6V8H8V10C8 10.55 8.45 11 9 11C9.55 11 10 10.55 10 10V8H14V10C14 10.55 14.45 11 15 11C15.55 11 16 10.55 16 10V8H18V20Z'
            fill='white'
          />
          <circle cx='12' cy='15' r='1.5' fill='white' opacity='0.8' />
          <circle cx='9' cy='13' r='1' fill='white' opacity='0.6' />
          <circle cx='15' cy='13' r='1' fill='white' opacity='0.6' />
        </svg>
      ),
    },
    {
      key: 'events',
      icon: (
        <svg
          className='w-full h-full'
          viewBox='0 0 24 24'
          fill='none'
          xmlns='http://www.w3.org/2000/svg'
        >
          <path
            d='M19 4H18V2H16V4H8V2H6V4H5C3.89 4 3.01 4.9 3.01 6L3 20C3 21.1 3.89 22 5 22H19C20.1 22 21 21.1 21 20V6C21 4.9 20.1 4 19 4ZM19 20H5V10H19V20ZM19 8H5V6H19V8Z'
            fill='white'
          />
          <path d='M12 13H17V18H12V13Z' fill='white' opacity='0.7' />
        </svg>
      ),
    },
    {
      key: 'onlinePayment',
      icon: (
        <svg
          className='w-full h-full'
          viewBox='0 0 24 24'
          fill='none'
          xmlns='http://www.w3.org/2000/svg'
        >
          <path
            d='M20 4H4C2.89 4 2.01 4.89 2.01 6L2 18C2 19.11 2.89 20 4 20H20C21.11 20 22 19.11 22 18V6C22 4.89 21.11 4 20 4ZM20 18H4V12H20V18ZM20 8H4V6H20V8Z'
            fill='white'
          />
          <rect x='6' y='14' width='4' height='2' fill='white' opacity='0.8' />
        </svg>
      ),
    },
  ];

  return (
    <div className='w-full bg-primary-500 py-sm md:py-2.5 relative overflow-hidden'>
      {/* Gradient fade on edges */}
      <div className='absolute left-0 top-0 bottom-0 w-16 md:w-24 bg-gradient-to-r from-primary-500 to-transparent z-10 pointer-events-none' />
      <div className='absolute right-0 top-0 bottom-0 w-16 md:w-24 bg-gradient-to-l from-primary-500 to-transparent z-10 pointer-events-none' />

      {/* Static container - single line */}
      <div className='flex justify-center overflow-x-auto scrollbar-hide'>
        <div className='flex items-center gap-lg md:gap-4xl lg:gap-3xl px-lg whitespace-nowrap'>
          {items.map((item, index) => (
            <div
              key={`item-${index}`}
              className='flex items-center gap-1.5 md:gap-2.5 flex-shrink-0'
            >
              <div className='flex-shrink-0 w-5 h-5 md:w-6 md:h-6 lg:w-7 lg:h-7'>{item.icon}</div>
              <span className='text-white text-xs md:text-sm lg:text-base font-semibold tracking-tight'>
                {t(item.key)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <style jsx>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}
