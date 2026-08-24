'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

export default function Newsletter() {
  const t = useTranslations('newsletter');
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setMessage({ type: 'error', text: t('errors.invalidEmail') });
      setIsSubmitting(false);
      return;
    }

    try {
      // Call server-side API route (secure, API key not exposed)
      const response = await fetch('/api/newsletter', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: t('success') });
        setEmail('');
      } else {
        // Handle specific error codes from server
        let errorMessage = t('errors.general');

        if (response.status === 409 && data.code === 'ALREADY_SUBSCRIBED') {
          // User is already subscribed
          errorMessage = t('errors.alreadySubscribed');
        } else if (data.error) {
          // Use server-provided error message
          errorMessage = data.error;
        }

        setMessage({ type: 'error', text: errorMessage });
      }
    } catch (error) {
      console.error('Newsletter subscription error:', error);
      setMessage({ type: 'error', text: t('errors.general') });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    // No role='region': a <section> with an accessible name already exposes
    // one, so declaring it again was redundant.
    <section
      className='w-full bg-[#f9f3f0] px-lg sm:px-4xl lg:px-3xl text-center py-3xl sm:py-4xl lg:py-5xl flex flex-col items-center justify-center'
      aria-labelledby='newsletter-heading'
    >
      {/* Label */}
      <p className='text-primary-500 font-medium text-sm sm:text-base'>{t('label')}</p>

      {/* Heading */}
      <h2
        id='newsletter-heading'
        className='max-w-3xl font-semibold text-2xl sm:text-3xl lg:text-4xl leading-tight mt-sm px-lg text-primary-500'
      >
        {t('heading')}
      </h2>

      {/* Subscription Form */}
      <form
        onSubmit={handleSubmit}
        className='flex flex-col sm:flex-row items-center justify-center mt-4xl sm:mt-6xl w-full max-w-md gap-md sm:gap-0'
      >
        <div className='flex items-center justify-center sm:border sm:border-slate-400 focus-within:outline focus-within:outline-2 focus-within:outline-primary-500 text-sm rounded-full h-12 sm:h-14 w-full'>
          <input
            type='email'
            value={email}
            onChange={e => setEmail(e.target.value)}
            className='bg-white sm:bg-transparent border border-slate-400 sm:border-0 outline-none rounded-full px-lg sm:px-lg h-full flex-1 text-slate-900 placeholder:text-slate-500 w-full focus:outline-primary-500 focus:outline focus:outline-2 sm:focus:outline-0'
            placeholder={t('placeholder')}
            aria-label={t('placeholder')}
            required
            disabled={isSubmitting}
          />
          <button
            type='submit'
            disabled={isSubmitting}
            className='hidden sm:flex bg-primary-500 text-white rounded-full h-11 mr-xs px-2xl lg:px-4xl items-center justify-center font-medium hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-primary-500'
            aria-label={t('button')}
          >
            {isSubmitting ? t('submitting') : t('button')}
          </button>
        </div>

        {/* Mobile button (outside the bordered container) */}
        <button
          type='submit'
          disabled={isSubmitting}
          className='sm:hidden bg-primary-500 text-white rounded-full h-12 px-4xl flex items-center justify-center font-medium hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-primary-500 w-full'
          aria-label={t('button')}
        >
          {isSubmitting ? t('submitting') : t('button')}
        </button>
      </form>

      {/* Status Message */}
      {message && (
        <div
          className={`mt-lg text-sm ${
            message.type === 'success' ? 'text-green-600' : 'text-red-600'
          }`}
          role={message.type === 'error' ? 'alert' : 'status'}
          aria-live='polite'
        >
          {message.text}
        </div>
      )}

      {/* Privacy Note */}
      <p className='text-slate-600 text-xs sm:text-sm mt-lg max-w-md'>{t('privacy')}</p>
    </section>
  );
}
