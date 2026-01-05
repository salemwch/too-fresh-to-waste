'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';

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
      title: t('sections.about.title'),
      links: [
        { label: t('sections.about.whoWeAre'), href: '/about' },
        { label: t('sections.about.mission'), href: '/mission' },
        { label: t('sections.about.careers'), href: '/careers' },
        { label: t('sections.about.blog'), href: '/blog' },
        { label: t('sections.about.press'), href: '/press' },
      ],
    },
    {
      title: t('sections.services.title'),
      links: [
        { label: t('sections.services.forConsumers'), href: '/#app' },
        { label: t('sections.services.forBusinesses'), href: '/business-signup' },
        { label: t('sections.services.howItWorks'), href: '/#features' },
        { label: t('sections.services.pricing'), href: '/pricing' },
      ],
    },
    {
      title: t('sections.support.title'),
      links: [
        { label: t('sections.support.helpCenter'), href: '/help' },
        { label: t('sections.support.faq'), href: '/#faq' },
        { label: t('sections.support.contact'), href: '/contact' },
        { label: t('sections.support.partners'), href: '/partners' },
      ],
    },
    {
      title: t('sections.legal.title'),
      links: [
        { label: t('sections.legal.terms'), href: '/terms' },
        { label: t('sections.legal.privacy'), href: '/privacy' },
        { label: t('sections.legal.cookies'), href: '/cookies' },
        { label: t('sections.legal.security'), href: '/security' },
      ],
    },
  ];

  // Social media links
  const socialLinks = [
    {
      name: 'Facebook',
      href: 'https://www.facebook.com/profile.php?id=61585767061906',
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="fill-blue-600 w-7 h-7 sm:w-8 sm:h-8"
          viewBox="0 0 49.652 49.652"
          aria-hidden="true"
        >
          <path d="M24.826 0C11.137 0 0 11.137 0 24.826c0 13.688 11.137 24.826 24.826 24.826 13.688 0 24.826-11.138 24.826-24.826C49.652 11.137 38.516 0 24.826 0zM31 25.7h-4.039v14.396h-5.985V25.7h-2.845v-5.088h2.845v-3.291c0-2.357 1.12-6.04 6.04-6.04l4.435.017v4.939h-3.219c-.524 0-1.269.262-1.269 1.386v2.99h4.56z" />
        </svg>
      ),
    },
    {
      name: 'Instagram',
      href: 'https://www.instagram.com/toofreshtowaste.tn/',
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="w-7 h-7 sm:w-8 sm:h-8"
          viewBox="0 0 152 152"
          aria-hidden="true"
        >
          <linearGradient
            id="instagram-gradient"
            x1="22.26"
            x2="129.74"
            y1="22.26"
            y2="129.74"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0" stopColor="#fae100" />
            <stop offset=".15" stopColor="#fcb720" />
            <stop offset=".3" stopColor="#ff7950" />
            <stop offset=".5" stopColor="#ff1c74" />
            <stop offset="1" stopColor="#6c1cd1" />
          </linearGradient>
          <g data-name="Layer 2">
            <g data-name="03.Instagram">
              <rect width="152" height="152" fill="url(#instagram-gradient)" rx="76" />
              <g fill="#fff">
                <path
                  fill="#ffffff10"
                  d="M133.2 26c-11.08 20.34-26.75 41.32-46.33 60.9S46.31 122.12 26 133.2q-1.91-1.66-3.71-3.46A76 76 0 1 1 129.74 22.26q1.8 1.8 3.46 3.74z"
                />
                <path d="M94 36H58a22 22 0 0 0-22 22v36a22 22 0 0 0 22 22h36a22 22 0 0 0 22-22V58a22 22 0 0 0-22-22zm15 54.84A18.16 18.16 0 0 1 90.84 109H61.16A18.16 18.16 0 0 1 43 90.84V61.16A18.16 18.16 0 0 1 61.16 43h29.68A18.16 18.16 0 0 1 109 61.16z" />
                <path d="m90.59 61.56-.19-.19-.16-.16A20.16 20.16 0 0 0 76 55.33 20.52 20.52 0 0 0 55.62 76a20.75 20.75 0 0 0 6 14.61 20.19 20.19 0 0 0 14.42 6 20.73 20.73 0 0 0 14.55-35.05zM76 89.56A13.56 13.56 0 1 1 89.37 76 13.46 13.46 0 0 1 76 89.56zm26.43-35.18a4.88 4.88 0 0 1-4.85 4.92 4.81 4.81 0 0 1-3.42-1.43 4.93 4.93 0 0 1 3.43-8.39 4.82 4.82 0 0 1 3.09 1.12l.1.1a3.05 3.05 0 0 1 .44.44l.11.12a4.92 4.92 0 0 1 1.1 3.12z" />
              </g>
            </g>
          </g>
        </svg>
      ),
    },
    {
      name: 'X (Twitter)',
      href: 'https://x.com/TooFresh2Waste',
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="w-7 h-7 sm:w-8 sm:h-8"
          viewBox="0 0 1227 1227"
          aria-hidden="true"
        >
          <path d="M613.5 0C274.685 0 0 274.685 0 613.5S274.685 1227 613.5 1227 1227 952.315 1227 613.5 952.315 0 613.5 0z" />
          <path
            fill="#fff"
            d="m680.617 557.98 262.632-305.288h-62.235L652.97 517.77 470.833 252.692H260.759l275.427 400.844-275.427 320.142h62.239l240.82-279.931 192.35 279.931h210.074L680.601 557.98zM345.423 299.545h95.595l440.024 629.411h-95.595z"
          />
        </svg>
      ),
    },
    {
      name: 'LinkedIn',
      href: 'https://www.linkedin.com/company/too-fresh-to-waste/?viewAsMember=true',
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="w-7 h-7 sm:w-8 sm:h-8"
          viewBox="0 0 112.196 112.196"
          aria-hidden="true"
        >
          <circle cx="56.098" cy="56.097" r="56.098" fill="#007ab9" />
          <path
            fill="#fff"
            d="M89.616 60.611v23.128H76.207V62.161c0-5.418-1.936-9.118-6.791-9.118-3.705 0-5.906 2.491-6.878 4.903-.353.862-.444 2.059-.444 3.268v22.524h-13.41s.18-36.546 0-40.329h13.411v5.715c-.027.045-.065.089-.089.132h.089v-.132c1.782-2.742 4.96-6.662 12.085-6.662 8.822 0 15.436 5.764 15.436 18.149zm-54.96-36.642c-4.587 0-7.588 3.011-7.588 6.967 0 3.872 2.914 6.97 7.412 6.97h.087c4.677 0 7.585-3.098 7.585-6.97-.089-3.956-2.908-6.967-7.496-6.967zm-6.791 59.77H41.27v-40.33H27.865v40.33z"
          />
        </svg>
      ),
    },
  ];

  return (
    <footer
      className="tracking-wide bg-primary-500 px-3 sm:px-6 lg:px-12 pt-8 pb-4 overflow-hidden"
      role="contentinfo"
      aria-label="Footer"
    >
      <div className="grid min-[1200px]:grid-cols-3 gap-6 lg:gap-8 max-w-full">
        {/* Company Info Section */}
        <div className="min-[1200px]:max-w-sm w-full">
          <div className="pr-2">
            <p className="text-white/80 leading-relaxed text-sm">
              {t('description')}
            </p>
            <p className="text-white/80 leading-relaxed text-sm mt-1.5">
              {t('tagline')}
            </p>
          </div>

          {/* Social Media Links */}
          <div className="mt-4">
            <h4 className="text-white font-semibold text-base mb-3">
              {t('social.followUs')}
            </h4>
            <ul className="flex gap-3 sm:gap-4 md:gap-4 flex-wrap" aria-label="Social media links">
              {socialLinks.map((social) => (
                <li key={social.name} className="flex-shrink-0">
                  <a
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${t('social.followUsOn')} ${social.name}`}
                    className="block transition-opacity hover:opacity-75"
                  >
                    {social.icon}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Footer Links Grid */}
        <div className="min-[1200px]:col-span-2 grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {footerSections.map((section) => (
            <div key={section.title} className="min-w-0">
              <h4 className="text-white font-semibold text-sm sm:text-base mb-2 sm:mb-3">
                {section.title}
              </h4>
              <ul className="space-y-2">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="hover:text-white text-white/70 text-xs sm:text-sm font-normal transition-colors block"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Divider */}
      <hr className="mt-6 mb-4 border-white/20" />

      {/* Copyright */}
      <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-end gap-2 sm:gap-4">
        <p className="text-white/70 text-xs sm:text-sm">
          {t('copyright', { year: currentYear })}
        </p>
        <p className="text-white/70 text-xs sm:text-sm">
          Created By{' '}
          <a
            href="https://www.linkedin.com/in/salem-wachwacha-h/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white/90 hover:text-white transition-colors underline"
          >
            Salem Ouachouacha
          </a>
        </p>
      </div>
    </footer>
  );
}
