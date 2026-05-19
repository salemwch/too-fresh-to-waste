'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/i18n/routing';
import { Header } from '@/components/layout';
import { motion } from 'framer-motion';
import type { Locale } from '@/i18n/config';

// Dynamically import Lottie to avoid SSR issues
const Lottie = dynamic(() => import('lottie-react'), {
  ssr: false,
  loading: () => (
    <div className='w-full h-[400px] flex items-center justify-center'>
      <div className='animate-pulse text-white text-xl'>Loading...</div>
    </div>
  ),
});

export default function BusinessSignUpPage() {
  const t = useTranslations('businessSignup');
  const tCommon = useTranslations('common');
  const locale = useLocale() as Locale;
  const isRTL = locale === 'ar';

  const [animationData, setAnimationData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load the Lottie animation JSON
  useEffect(() => {
    setIsLoading(true);
    fetch('/json_animation/coming soon.json')
      .then(response => {
        if (!response.ok) {
          throw new Error('Failed to load animation');
        }
        return response.json();
      })
      .then(data => {
        setAnimationData(data);
        setIsLoading(false);
      })
      .catch(error => {
        console.error('Failed to load Lottie animation:', error);
        setIsLoading(false);
      });
  }, []);

  // Features data with translations
  const features = [
    {
      icon: '\ud83d\udcca',
      title: t('features.analytics.title'),
      description: t('features.analytics.description'),
    },
    {
      icon: '\ud83d\udcb0',
      title: t('features.revenue.title'),
      description: t('features.revenue.description'),
    },
    {
      icon: '\ud83c\udf0d',
      title: t('features.sustainability.title'),
      description: t('features.sustainability.description'),
    },
    {
      icon: '\u23f0',
      title: t('features.expiry.title'),
      description: t('features.expiry.description'),
    },
  ];

  return (
    <>
      <Header />

      {/* Main Content Section */}
      <section
        dir={isRTL ? 'rtl' : 'ltr'}
        className='min-h-screen flex items-center justify-center px-4 py-20 relative overflow-hidden'
        style={{
          background: 'linear-gradient(135deg, #0B1819 0%, #1E4448 50%, #0B1819 100%)',
        }}
      >
        {/* Animated Background Circles */}
        <div className='absolute inset-0 overflow-hidden pointer-events-none'>
          <motion.div
            className='absolute top-20 left-10 w-64 h-64 rounded-full opacity-10'
            style={{ background: '#ff7973' }}
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.1, 0.2, 0.1],
            }}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
          <motion.div
            className='absolute bottom-20 right-10 w-96 h-96 rounded-full opacity-10'
            style={{ background: 'hsl(var(--secondary))' }}
            animate={{
              scale: [1.2, 1, 1.2],
              opacity: [0.1, 0.15, 0.1],
            }}
            transition={{
              duration: 10,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
          <motion.div
            className='absolute top-1/2 left-1/2 w-80 h-80 rounded-full opacity-5'
            style={{ background: '#f9f3f0', transform: 'translate(-50%, -50%)' }}
            animate={{
              rotate: [0, 360],
            }}
            transition={{
              duration: 20,
              repeat: Infinity,
              ease: 'linear',
            }}
          />
        </div>

        {/* Content Container */}
        <div className='max-w-4xl w-full mx-auto relative z-10'>
          <div className='text-center space-y-8'>
            {/* Lottie Animation */}
            {(() => {
              let lottieContent;
              if (isLoading) {
                lottieContent = (
                  <div className='animate-pulse text-white text-xl'>{tCommon('loading')}</div>
                );
              } else if (animationData) {
                lottieContent = (
                  <Lottie
                    animationData={animationData}
                    loop={true}
                    style={{ width: '100%', height: 'auto' }}
                  />
                );
              } else {
                lottieContent = (
                  <div className='text-white/70 text-lg'>{t('animationNotAvailable')}</div>
                );
              }
              return (
                <div className='w-full max-w-md mx-auto min-h-[400px] flex items-center justify-center'>
                  {lottieContent}
                </div>
              );
            })()}

            {/* Description */}
            <div className='space-y-4'>
              <p className='text-lg md:text-xl text-white/90 max-w-2xl mx-auto leading-relaxed'>
                {t('description')}
              </p>
              <p className='text-base md:text-lg text-white/70 max-w-xl mx-auto'>
                {t('subDescription')}
              </p>
            </div>

            {/* Features Preview */}
            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pt-8'>
              {features.map((feature, index) => (
                <div
                  key={index}
                  className='bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 hover:bg-white/10 transition-all duration-300'
                >
                  <div className='text-4xl mb-3'>{feature.icon}</div>
                  <h3 className='text-white font-bold text-lg mb-2'>{feature.title}</h3>
                  <p className='text-white/70 text-sm'>{feature.description}</p>
                </div>
              ))}
            </div>

            {/* CTA Section */}
            <div className='pt-8'>
              <p className='text-secondary text-lg font-semibold mb-4'>{t('notifyQuestion')}</p>
              <div className='flex flex-col sm:flex-row gap-4 justify-center items-center'>
                <a
                  href='mailto:contact@toofreshwaste.tn?subject=Business Sign-Up Interest'
                  className='px-8 py-4 bg-[#ff7973] hover:bg-[#ff8983] text-white font-bold text-lg rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1'
                >
                  {tCommon('contactUs')}
                </a>
                <Link
                  href='/'
                  className='px-8 py-4 border-2 border-white/30 hover:border-white/50 text-white font-bold text-lg rounded-lg transition-all duration-300 backdrop-blur-sm'
                >
                  {t('backToHome')}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
