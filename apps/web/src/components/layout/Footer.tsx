'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { seoConfig } from '@/config/seo.config';

// Footer link type
interface FooterLink {
  label: string;
  href: string;
}

// Footer section type
interface FooterSection {
  title: string;
  links: FooterLink[];
}

export default function Footer() {
  const t = useTranslations('footer');
  const currentYear = new Date().getFullYear();

  // Footer sections configuration
  const footerSections: FooterSection[] = [
    {
      title: t('sections.services.title'),
      links: [
        { label: t('sections.services.consumer'), href: '/#app' },
        { label: t('sections.services.business'), href: '/business-signup' },
        { label: t('sections.services.companies'), href: '/companies' },
        { label: t('sections.services.partners'), href: '/partners' },
      ],
    },
    {
      title: t('sections.support.title'),
      links: [
        { label: t('sections.support.blog'), href: '/blog' },
        { label: t('sections.support.faq'), href: '/#faq' },
        { label: t('sections.support.contact'), href: '/contact' },
      ],
    },
    {
      title: t('sections.legal.title'),
      links: [
        { label: t('sections.legal.terms'), href: '/terms-and-conditions' },
        { label: t('sections.legal.privacy'), href: '/privacy-policy' },
        { label: t('sections.legal.cookies'), href: '/cookie-policy' },
        { label: t('sections.legal.security'), href: '/security' },
      ],
    },
  ];

  // Social media links
  const socialLinks = [
    {
      name: 'Facebook',
      href: seoConfig.socialUrls.facebook,
      icon: (
        <svg
          xmlns='http://www.w3.org/2000/svg'
          className='fill-blue-600 w-7 h-7 sm:w-8 sm:h-8'
          viewBox='0 0 49.652 49.652'
          aria-hidden='true'
        >
          <path d='M24.826 0C11.137 0 0 11.137 0 24.826c0 13.688 11.137 24.826 24.826 24.826 13.688 0 24.826-11.138 24.826-24.826C49.652 11.137 38.516 0 24.826 0zM31 25.7h-4.039v14.396h-5.985V25.7h-2.845v-5.088h2.845v-3.291c0-2.357 1.12-6.04 6.04-6.04l4.435.017v4.939h-3.219c-.524 0-1.269.262-1.269 1.386v2.99h4.56z' />
        </svg>
      ),
    },
    {
      name: 'Instagram',
      href: seoConfig.socialUrls.instagram,
      icon: (
        <svg
          xmlns='http://www.w3.org/2000/svg'
          className='w-7 h-7 sm:w-8 sm:h-8'
          viewBox='0 0 152 152'
          aria-hidden='true'
        >
          <linearGradient
            id='instagram-gradient'
            x1='22.26'
            x2='129.74'
            y1='22.26'
            y2='129.74'
            gradientUnits='userSpaceOnUse'
          >
            <stop offset='0' stopColor='#fae100' />
            <stop offset='.15' stopColor='#fcb720' />
            <stop offset='.3' stopColor='#ff7950' />
            <stop offset='.5' stopColor='#ff1c74' />
            <stop offset='1' stopColor='#6c1cd1' />
          </linearGradient>
          <g data-name='Layer 2'>
            <g data-name='03.Instagram'>
              <rect width='152' height='152' fill='url(#instagram-gradient)' rx='76' />
              <g fill='#fff'>
                <path
                  fill='#ffffff10'
                  d='M133.2 26c-11.08 20.34-26.75 41.32-46.33 60.9S46.31 122.12 26 133.2q-1.91-1.66-3.71-3.46A76 76 0 1 1 129.74 22.26q1.8 1.8 3.46 3.74z'
                />
                <path d='M94 36H58a22 22 0 0 0-22 22v36a22 22 0 0 0 22 22h36a22 22 0 0 0 22-22V58a22 22 0 0 0-22-22zm15 54.84A18.16 18.16 0 0 1 90.84 109H61.16A18.16 18.16 0 0 1 43 90.84V61.16A18.16 18.16 0 0 1 61.16 43h29.68A18.16 18.16 0 0 1 109 61.16z' />
                <path d='m90.59 61.56-.19-.19-.16-.16A20.16 20.16 0 0 0 76 55.33 20.52 20.52 0 0 0 55.62 76a20.75 20.75 0 0 0 6 14.61 20.19 20.19 0 0 0 14.42 6 20.73 20.73 0 0 0 14.55-35.05zM76 89.56A13.56 13.56 0 1 1 89.37 76 13.46 13.46 0 0 1 76 89.56zm26.43-35.18a4.88 4.88 0 0 1-4.85 4.92 4.81 4.81 0 0 1-3.42-1.43 4.93 4.93 0 0 1 3.43-8.39 4.82 4.82 0 0 1 3.09 1.12l.1.1a3.05 3.05 0 0 1 .44.44l.11.12a4.92 4.92 0 0 1 1.1 3.12z' />
              </g>
            </g>
          </g>
        </svg>
      ),
    },
    {
      name: 'X (Twitter)',
      href: seoConfig.socialUrls.x,
      icon: (
        <svg
          xmlns='http://www.w3.org/2000/svg'
          className='w-7 h-7 sm:w-8 sm:h-8'
          viewBox='0 0 1227 1227'
          aria-hidden='true'
        >
          <path d='M613.5 0C274.685 0 0 274.685 0 613.5S274.685 1227 613.5 1227 1227 952.315 1227 613.5 952.315 0 613.5 0z' />
          <path
            fill='#fff'
            d='m680.617 557.98 262.632-305.288h-62.235L652.97 517.77 470.833 252.692H260.759l275.427 400.844-275.427 320.142h62.239l240.82-279.931 192.35 279.931h210.074L680.601 557.98zM345.423 299.545h95.595l440.024 629.411h-95.595z'
          />
        </svg>
      ),
    },
    {
      name: 'LinkedIn',
      href: seoConfig.socialUrls.linkedin,
      icon: (
        <svg
          xmlns='http://www.w3.org/2000/svg'
          className='w-7 h-7 sm:w-8 sm:h-8'
          viewBox='0 0 112.196 112.196'
          aria-hidden='true'
        >
          <circle cx='56.098' cy='56.097' r='56.098' fill='#007ab9' />
          <path
            fill='#fff'
            d='M89.616 60.611v23.128H76.207V62.161c0-5.418-1.936-9.118-6.791-9.118-3.705 0-5.906 2.491-6.878 4.903-.353.862-.444 2.059-.444 3.268v22.524h-13.41s.18-36.546 0-40.329h13.411v5.715c-.027.045-.065.089-.089.132h.089v-.132c1.782-2.742 4.96-6.662 12.085-6.662 8.822 0 15.436 5.764 15.436 18.149zm-54.96-36.642c-4.587 0-7.588 3.011-7.588 6.967 0 3.872 2.914 6.97 7.412 6.97h.087c4.677 0 7.585-3.098 7.585-6.97-.089-3.956-2.908-6.967-7.496-6.967zm-6.791 59.77H41.27v-40.33H27.865v40.33z'
          />
        </svg>
      ),
    },
  ];

  return (
    <footer
      className='tracking-wide bg-primary-500 px-3 sm:px-6 lg:px-12 pt-8 pb-4 overflow-hidden'
      role='contentinfo'
      aria-label='Footer'
    >
      <div className='grid min-[1200px]:grid-cols-3 gap-6 lg:gap-8 max-w-full'>
        {/* Company Info Section */}
        <div className='min-[1200px]:max-w-sm w-full'>
          <div className='pr-2'>
            <p className='text-white/80 leading-relaxed text-sm'>{t('description')}</p>
            <p className='text-white/80 leading-relaxed text-sm mt-1.5'>{t('tagline')}</p>
          </div>

          {/* Social Media Links */}
          <div className='mt-4'>
            <h3 className='text-white font-semibold text-base mb-3'>{t('social.followUs')}</h3>
            <ul className='flex gap-3 sm:gap-4 md:gap-4 flex-wrap' aria-label='Social media links'>
              {socialLinks.map(social => (
                <li key={social.name} className='flex-shrink-0'>
                  <a
                    href={social.href}
                    target='_blank'
                    rel='noopener noreferrer'
                    aria-label={`${t('social.followUsOn')} ${social.name}`}
                    className='block transition-opacity hover:opacity-75'
                  >
                    {social.icon}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Footer Links Grid */}
        <div className='min-[1200px]:col-span-2 grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6'>
          {footerSections.map(section => (
            <div key={section.title} className='min-w-0'>
              <h3 className='text-white font-semibold text-sm sm:text-base mb-2 sm:mb-3'>
                {section.title}
              </h3>
              <ul className='space-y-1'>
                {section.links.map(link => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className='hover:text-white text-white/70 text-xs sm:text-sm font-normal transition-colors inline-flex items-center py-0.5'
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Be With Us — download buttons */}
          <div className='min-w-0'>
            <h3 className='text-white font-semibold text-sm sm:text-base mb-2 sm:mb-3'>
              {t('beWithUs.title')}
            </h3>
            <div className='flex flex-col gap-2'>
              {/* App Store */}
              <Link
                href='#'
                className='flex items-center gap-2 bg-black text-white px-3 py-2 rounded-full hover:bg-gray-800 transition-all duration-300 shadow-md hover:shadow-lg w-fit'
                aria-label='Download on the App Store'
              >
                <svg className='w-5 h-5 flex-shrink-0' viewBox='0 0 24 24' fill='currentColor'>
                  <path d='M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z' />
                </svg>
                <div className='flex flex-col items-start justify-center'>
                  <div className='text-[8px] leading-tight opacity-80'>
                    {t('beWithUs.appStore.prefix')}
                  </div>
                  <div className='text-sm font-semibold leading-tight'>
                    {t('beWithUs.appStore.name')}
                  </div>
                </div>
              </Link>

              {/* Google Play */}
              <Link
                href='#'
                className='flex items-center gap-2 bg-black text-white px-3 py-2 rounded-full hover:bg-gray-800 transition-all duration-300 shadow-md hover:shadow-lg w-fit'
                aria-label='Get it on Google Play'
              >
                <svg className='w-5 h-5 flex-shrink-0' viewBox='0 0 24 24' fill='currentColor'>
                  <path d='M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.5,12.92 20.16,13.19L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z' />
                </svg>
                <div className='flex flex-col items-start justify-center'>
                  <div className='text-[8px] leading-tight opacity-80'>
                    {t('beWithUs.playStore.prefix')}
                  </div>
                  <div className='text-sm font-semibold leading-tight'>
                    {t('beWithUs.playStore.name')}
                  </div>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Divider */}
      <hr className='mt-6 mb-4 border-white/20' />

      {/* Copyright */}
      <div className='flex items-center justify-center sm:justify-end'>
        <p className='text-white/70 text-xs sm:text-sm'>{t('copyright', { year: currentYear })}</p>
      </div>
    </footer>
  );
}
