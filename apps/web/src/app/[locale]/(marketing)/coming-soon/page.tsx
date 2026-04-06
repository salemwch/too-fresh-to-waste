'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useTranslations, useLocale } from 'next-intl';
import { Header } from '@/components/layout';
import type { Locale } from '@/i18n/config';

// Dynamically import Lottie to avoid SSR issues
const Lottie = dynamic(() => import('lottie-react'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[300px] flex items-center justify-center">
      <div className="animate-pulse text-white text-xl">Loading...</div>
    </div>
  ),
});

export default function ComingSoonPage() {
  const tCommon = useTranslations('common');
  const tComingSoon = useTranslations('comingSoon');
  const locale = useLocale() as Locale;
  const isRTL = locale === 'ar';

  const [animationData, setAnimationData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load the Lottie animation JSON
  useEffect(() => {
    setIsLoading(true);
    fetch('/json_animation/Waiting.json')
      .then((response) => {
        if (!response.ok) {
          throw new Error('Failed to load animation');
        }
        return response.json();
      })
      .then((data) => {
        setAnimationData(data);
        setIsLoading(false);
      })
      .catch((error) => {
        console.error('Failed to load Lottie animation:', error);
        setIsLoading(false);
      });
  }, []);

  return (
    <>
      <Header />

      {/* Main Content Section with Background Image */}
      <section
        dir={isRTL ? 'rtl' : 'ltr'}
        className="min-h-screen flex items-center justify-center px-4 py-20 relative overflow-hidden bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: 'url(/images/coming-background.jpg)',
        }}
      >
        {/* Overlay for better text readability */}
        <div className="absolute inset-0 bg-black/40" />

        {/* Content Container */}
        <div className="max-w-3xl w-full mx-auto relative z-10">
          <div className="text-center space-y-8">
            {/* Coming Soon Title */}
            <h1
              className="font-bold text-white drop-shadow-2xl"
              style={{
                fontSize: '80px',
                textShadow: '0 4px 6px rgba(0, 0, 0, 0.5)',
              }}
            >
              {tComingSoon('title')}
            </h1>

            {/* Lottie Animation */}
            {(() => {
              let lottieContent;
              if (isLoading) {
                lottieContent = (
                  <div className="animate-pulse text-white text-xl drop-shadow-lg">
                    {tCommon('loading')}
                  </div>
                );
              } else if (animationData) {
                lottieContent = (
                  <Lottie
                    animationData={animationData}
                    loop={true}
                    style={{ width: '100%', height: 'auto', maxHeight: '400px' }}
                  />
                );
              } else {
                lottieContent = (
                  <div className="text-white/70 text-lg drop-shadow-lg">
                    Animation not available
                  </div>
                );
              }
              return (
                <div className="w-full max-w-lg mx-auto min-h-[300px] flex items-start justify-center pt-2 pb-12">
                  {lottieContent}
                </div>
              );
            })()}

            {/* Description */}
            <div className="space-y-4 mt-20">
              <p className="text-lg sm:text-xl lg:text-2xl text-white/90 max-w-2xl mx-auto leading-relaxed drop-shadow-lg">
                {tComingSoon('workingHard')}
              </p>
              <p className="text-base sm:text-lg text-white/80 max-w-xl mx-auto drop-shadow-lg">
                {tComingSoon('stayTuned')}
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
