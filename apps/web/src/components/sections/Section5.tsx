'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { BedDouble, Bike, Dumbbell, Gift, Smartphone, Ticket } from 'lucide-react';
import Image from 'next/image';

interface FAQ {
  id: number;
  question: string;
  answer: string;
}

export default function Section5() {
  const t = useTranslations('section5');
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  // FAQ data - using translation keys
  const faqs: FAQ[] = [
    { id: 1, question: t('faqs.faq1.question'), answer: t('faqs.faq1.answer') },
    { id: 2, question: t('faqs.faq2.question'), answer: t('faqs.faq2.answer') },
    { id: 3, question: t('faqs.faq3.question'), answer: t('faqs.faq3.answer') },
    { id: 4, question: t('faqs.faq4.question'), answer: t('faqs.faq4.answer') },
  ];

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section
      id='faq'
      className='bg-[#f9f3f0] flex justify-center items-center py-12 md:py-16 px-4 relative'
      aria-labelledby='faq-heading'
    >
      <div className='max-w-6xl mx-auto w-full'>
        {/* Main Title */}
        <div className='flex flex-col md:flex-row items-start justify-center '>
          {/* Left Side: Image */}
          <div className='w-full md:w-5/12 flex-shrink-0'>
            <div className='w-full md:w-7/12 flex-shrink-0'>
              {' '}
              {/* Increased from 5/12 to 7/12 */}
              <Image
                src='/images/buy-screen-onoarding/home-screen.webp'
                alt={t('imageAlt')}
                width={520}
                height={530}
                className='w-full max-w-xl mx-auto h-auto object-contain'
                loading='lazy'
              />
            </div>
          </div>

          {/* Right Side: FAQ Content */}
          <div className='w-full md:w-7/12'>
            {/* Section Label */}
            <p className='text-primary-500 text-sm font-semibold uppercase tracking-wide mb-2'>
              {t('sectionLabel')}
            </p>

            {/* Heading */}
            <h2 id='faq-heading' className='text-slate-900 text-2xl md:text-3xl font-bold mb-3'>
              {t('title')}
            </h2>

            {/* Description */}
            <p className='text-slate-600 text-sm md:text-base leading-relaxed mb-6'>
              {t('description')}
            </p>

            {/* FAQ Accordion */}
            <div className='space-y-0'>
              {faqs.map((faq, index) => {
                const isExpanded = openIndex === index;

                return (
                  <div key={faq.id} className='border-b border-slate-300'>
                    <h3>
                      <button
                        type='button'
                        className='flex items-center justify-between gap-4 w-full py-4 text-left cursor-pointer focus:outline-none'
                        onClick={() => toggleFAQ(index)}
                        aria-expanded={isExpanded ? 'true' : 'false'}
                        aria-controls={`faq-answer-${faq.id}`}
                        id={`faq-trigger-${faq.id}`}
                      >
                        <span className='text-slate-900 text-base md:text-lg font-semibold'>
                          {faq.question}
                        </span>

                        <svg
                          width='18'
                          height='18'
                          viewBox='0 0 18 18'
                          fill='none'
                          xmlns='http://www.w3.org/2000/svg'
                          className={`flex-shrink-0 transition-transform duration-500 ease-in-out text-primary-500 ${
                            isExpanded ? 'rotate-180' : ''
                          }`}
                          aria-hidden='true'
                        >
                          <path
                            d='m4.5 7.2 3.793 3.793a1 1 0 0 0 1.414 0L13.5 7.2'
                            stroke='currentColor'
                            strokeWidth='1.5'
                            strokeLinecap='round'
                            strokeLinejoin='round'
                          />
                        </svg>
                      </button>
                    </h3>

                    {/* Answer panel - sibling of button, not nested inside it */}
                    <div
                      id={`faq-answer-${faq.id}`}
                      role='region'
                      aria-labelledby={`faq-trigger-${faq.id}`}
                      className='overflow-hidden'
                      style={{
                        maxHeight: isExpanded ? '250px' : '0px',
                        paddingBottom: isExpanded ? '16px' : '0px',
                        opacity: isExpanded ? 1 : 0,
                        transition:
                          'max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1), padding-bottom 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease-in-out',
                      }}
                    >
                      {faq.id === 4 ? (
                        <div className='text-slate-700 text-sm md:text-base leading-relaxed space-y-3'>
                          {/* Sits above the list rather than inside the answer:
                              the answer is split on newlines and paired with
                              icons by position, so a sentence added to it would
                              take an icon and shift every prize after it. */}
                          <p className='mb-4'>{t('faqs.faq4.intro')}</p>
                          {(() => {
                            const items = faq.answer.split('\n').filter(item => item.trim());
                            // One icon per prize, in the order the answer
                            // lists them. Falling back to Gift means a prize
                            // added to the copy without an icon still renders.
                            const icons = [BedDouble, Bike, Dumbbell, Smartphone, Ticket];
                            return items.map((item, idx) => {
                              const Icon = icons[idx] ?? Gift;
                              return (
                                <div key={idx} className='flex items-center gap-3'>
                                  <Icon
                                    className='text-primary-500 mt-0.5 h-5 w-5 flex-shrink-0'
                                    strokeWidth={1.75}
                                    aria-hidden='true'
                                  />
                                  <span className='flex-1'>{item}</span>
                                </div>
                              );
                            });
                          })()}
                        </div>
                      ) : (
                        <p className='faq-answer text-slate-700 text-sm md:text-base leading-relaxed whitespace-pre-line'>
                          {faq.answer}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* CTA Button (Optional) */}
            <div className='mt-8 text-center md:text-left'>
              <a
                href='mailto:support@toofreshtoowaste.com?subject=Support Inquiry - Too Fresh To Waste'
                className='inline-block px-6 py-3 bg-primary-500 text-white rounded-full font-bold text-sm md:text-base transition-all duration-300 hover:bg-primary-600 hover:scale-105 outline-none'
                aria-label={t('ctaButton')}
              >
                {t('ctaButton')}
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* FAQ typography - self-hosted Inter (no external font fetch) */}
      <style jsx global>{`
        #faq * {
          font-family: var(--font-quicksand), system-ui, sans-serif;
        }

        /* FAQ answer sizing */
        #faq .faq-answer {
          font-size: 1.125rem;
          line-height: 1.75rem;
        }

        @media (max-width: 768px) {
          #faq .faq-answer {
            font-size: 1rem;
            line-height: 1.625rem;
          }
        }
      `}</style>
    </section>
  );
}
