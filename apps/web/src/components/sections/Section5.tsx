'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';

/**
 * Section 5: FAQ (Frequently Asked Questions)
 * Features:
 * - Background color #f9f3f0 (warm beige)
 * - Accordion-style FAQ component
 * - Image on left, FAQ list on right (responsive)
 * - Smooth expand/collapse animations
 * - Based on design from carrousel.md
 */

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
      id="faq"
      className="bg-[#f9f3f0] flex justify-center items-center py-12 md:py-16 px-4 relative"
      aria-labelledby="faq-heading"
    >
      <div className="max-w-6xl mx-auto w-full">
        {/* Main Title */}
        <h2 className="text-center text-2xl md:text-4xl font-bold mb-8 md:mb-12">
          <span style={{ color: '#005250' }}>{t('mainTitle.businessSolution')}</span>
          {' & '}
          <span style={{ color: '#ff7973' }}>{t('mainTitle.bigPrize')}</span>
        </h2>

        <div className="flex flex-col md:flex-row items-start justify-center gap-8 md:gap-12">
          {/* Left Side: Image */}
          <div className="w-full md:w-5/12 flex-shrink-0">
            <Image
              src="/images/faq-illustration.png"
              alt={t('imageAlt')}
              width={520}
              height={530}
              className="w-full max-w-md mx-auto rounded-xl h-auto object-cover"
              priority={false}
            />
          </div>

          {/* Right Side: FAQ Content */}
          <div className="w-full md:w-7/12">
          {/* Section Label */}
          <p className="text-primary-500 text-sm font-semibold uppercase tracking-wide mb-2">
            {t('sectionLabel')}
          </p>

          {/* Heading */}
          <h2
            id="faq-heading"
            className="text-slate-900 text-2xl md:text-3xl font-bold mb-3"
          >
            {t('title')}
          </h2>

          {/* Description */}
          <p className="text-slate-600 text-sm md:text-base leading-relaxed mb-6">
            {t('description')}
          </p>

          {/* FAQ Accordion */}
          <div className="space-y-0">
            {faqs.map((faq, index) => (
              <div
                key={faq.id}
                className="border-b border-slate-300 py-4 cursor-pointer"
                onClick={() => toggleFAQ(index)}
                role="button"
                aria-expanded={openIndex === index}
                aria-controls={`faq-answer-${faq.id}`}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleFAQ(index);
                  }
                }}
              >
                {/* Question */}
                <div className="flex items-center justify-between gap-4">
                  <h3 className="text-slate-900 text-base md:text-lg font-semibold">
                    {faq.question}
                  </h3>

                  {/* Chevron Icon */}
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 18 18"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className={`flex-shrink-0 transition-transform duration-500 ease-in-out ${
                      openIndex === index ? 'rotate-180' : ''
                    }`}
                    aria-hidden="true"
                  >
                    <path
                      d="m4.5 7.2 3.793 3.793a1 1 0 0 0 1.414 0L13.5 7.2"
                      stroke="#005250"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>

                {/* Answer */}
                <div
                  id={`faq-answer-${faq.id}`}
                  className="overflow-hidden"
                  style={{
                    maxHeight: openIndex === index ? '250px' : '0px',
                    paddingTop: openIndex === index ? '16px' : '0px',
                    opacity: openIndex === index ? 1 : 0,
                    transition: 'max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1), padding-top 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease-in-out',
                  }}
                >
                  {faq.id === 4 ? (
                    <div className="text-slate-700 text-sm md:text-base leading-relaxed space-y-3">
                      {(() => {
                        const items = faq.answer.split('\n').filter(item => item.trim());
                        const icons = [
                          <svg key="bag" className="w-5 h-5 flex-shrink-0 mt-0.5 text-primary-500" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M18 6H16C16 3.79 14.21 2 12 2C9.79 2 8 3.79 8 6H6C4.9 6 4 6.9 4 8V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8C20 6.9 19.1 6 18 6ZM12 4C13.1 4 14 4.9 14 6H10C10 4.9 10.9 4 12 4ZM18 20H6V8H8V10C8 10.55 8.45 11 9 11C9.55 11 10 10.55 10 10V8H14V10C14 10.55 14.45 11 15 11C15.55 11 16 10.55 16 10V8H18V20Z"/>
                          </svg>,
                          <svg key="people" className="w-5 h-5 flex-shrink-0 mt-0.5 text-primary-500" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M16 11C17.66 11 18.99 9.66 18.99 8C18.99 6.34 17.66 5 16 5C14.34 5 13 6.34 13 8C13 9.66 14.34 11 16 11ZM8 11C9.66 11 10.99 9.66 10.99 8C10.99 6.34 9.66 5 8 5C6.34 5 5 6.34 5 8C5 9.66 6.34 11 8 11ZM8 13C5.67 13 1 14.17 1 16.5V19H15V16.5C15 14.17 10.33 13 8 13ZM16 13C15.71 13 15.38 13.02 15.03 13.05C16.19 13.89 17 15.02 17 16.5V19H23V16.5C23 14.17 18.33 13 16 13Z"/>
                          </svg>,
                          <svg key="star" className="w-5 h-5 flex-shrink-0 mt-0.5 text-primary-500" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 17.27L18.18 21L16.54 13.97L22 9.24L14.81 8.63L12 2L9.19 8.63L2 9.24L7.46 13.97L5.82 21L12 17.27Z"/>
                          </svg>,
                          <svg key="refresh" className="w-5 h-5 flex-shrink-0 mt-0.5 text-primary-500" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 6V9L16 5L12 1V4C7.58 4 4 7.58 4 12C4 13.57 4.46 15.03 5.24 16.26L6.7 14.8C6.25 13.97 6 13 6 12C6 8.69 8.69 6 12 6ZM18.76 7.74L17.3 9.2C17.74 10.04 18 11 18 12C18 15.31 15.31 18 12 18V15L8 19L12 23V20C16.42 20 20 16.42 20 12C20 10.43 19.54 8.97 18.76 7.74Z"/>
                          </svg>,
                          <svg key="calendar" className="w-5 h-5 flex-shrink-0 mt-0.5 text-primary-500" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M19 4H18V2H16V4H8V2H6V4H5C3.89 4 3.01 4.9 3.01 6L3 20C3 21.1 3.89 22 5 22H19C20.1 22 21 21.1 21 20V6C21 4.9 20.1 4 19 4ZM19 20H5V10H19V20ZM19 8H5V6H19V8ZM12 13H17V18H12V13Z"/>
                          </svg>
                        ];
                        return items.map((item, idx) => (
                          <div key={idx} className="flex items-start gap-3">
                            {icons[idx]}
                            <span className="flex-1">{item}</span>
                          </div>
                        ));
                      })()}
                    </div>
                  ) : (
                    <p className="faq-answer text-slate-700 text-sm md:text-base leading-relaxed whitespace-pre-line">
                      {faq.answer}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* CTA Button (Optional) */}
          <div className="mt-8">
            <a
              href="#contact"
              className="inline-block px-6 py-3 bg-primary-500 text-white rounded-lg font-bold text-sm md:text-base transition-all duration-300 hover:bg-primary-600 hover:scale-105 outline-none focus:ring-2 focus:ring-primary-400"
              aria-label={t('ctaButton')}
            >
              {t('ctaButton')}
            </a>
          </div>
        </div>
      </div>
      </div>

      {/* Poppins Font Import and Emoji Styling */}
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap');

        #faq * {
          font-family: 'Poppins', sans-serif;
        }

        /* Make emojis in FAQ answers larger and more visible */
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
