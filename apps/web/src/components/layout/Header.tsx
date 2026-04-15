'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useScrollPosition } from '@/hooks/useScrollPosition';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Link, usePathname } from '@/i18n/routing';

// Navigation link type
interface NavLink {
  label: string;
  href: string;
}

export default function Header() {
  const t = useTranslations('header');
  const { isScrolled } = useScrollPosition(50);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);
  const pathname = usePathname();

  // Check if we're on the home page
  // Note: usePathname() from @/i18n/routing returns pathname WITHOUT locale prefix
  const isHomePage = pathname === '/';

  // Navigation configuration
  // When on home page: use hash links (#app)
  // When on other pages: use full path with hash (/#app) - locale prefix added automatically by Link
  const NAV_LINKS: NavLink[] = [
    { label: t('nav.theApp'), href: isHomePage ? '#app' : '/#app' },
    { label: t('nav.whyChooseUs'), href: isHomePage ? '#features' : '/#features' },
    { label: t('nav.businessSolution'), href: isHomePage ? '#faq' : '/#faq' },
  ];

  // Prevent hydration mismatch by waiting for client-side mount
  useEffect(() => {
    setHasMounted(true);
  }, []);

  // CRITICAL: Reset scroll position on route change to prevent header color persistence
  // This ensures the header always starts with the primary color on new pages
  useEffect(() => {
    // Immediately scroll to top
    window.scrollTo(0, 0);

    // Force a small delay to ensure scroll position is properly reset
    // This prevents the useScrollPosition hook from retaining old scroll state
    const timer = setTimeout(() => {
      window.scrollTo(0, 0);
    }, 10);

    return () => clearTimeout(timer);
  }, [pathname]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isMobileMenuOpen]);

  // Close mobile menu on scroll
  useEffect(() => {
    if (isMobileMenuOpen) {
      setIsMobileMenuOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isScrolled]);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  // Use scroll state only after mount to prevent hydration mismatch
  const isScrolledState = hasMounted ? isScrolled : false;

  // Dynamic classes based on scroll state (optimized for performance)
  const headerBgClass = isScrolledState ? 'bg-[#f9f3f0]' : 'bg-primary-500';
  const linkColorClass = isScrolledState ? 'text-primary-500' : 'text-white';
  const buttonBorderClass = isScrolledState
    ? 'border-primary-500 text-primary-500'
    : 'border-white text-white';
  // Shadow changes based on scroll state
  const headerShadow = isScrolledState
    ? '0 4px 6px -1px rgba(0, 37, 32, 0.5), 0 2px 4px -2px rgba(0, 37, 32, 0.3)'
    : 'none';

  return (
    <>
      {/* Fixed Header */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-colors duration-200 ease-in-out ${headerBgClass}`}
        style={{
          boxShadow: headerShadow,
          transition: 'background-color 200ms ease-in-out, box-shadow 200ms ease-in-out',
        }}
        role='banner'
      >
        <div className='w-full px-3 lg:px-6 pt-[5px]'>
          <nav
            className='grid grid-cols-[1fr_auto_1fr] items-center h-14 gap-2'
            role='navigation'
            aria-label='Main navigation'
          >
            {/* LEFT — Nav links (desktop) / Language switcher (mobile) */}
            <div className='flex items-center justify-start'>
              {/* Mobile: Language Switcher */}
              <div className='lg:hidden'>
                <LanguageSwitcher
                  buttonClassName={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors ${
                    isScrolledState
                      ? 'bg-primary-500/10 text-primary-500 hover:bg-primary-500/20'
                      : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                />
              </div>

              {/* Desktop: Navigation Links */}
              <div className='hidden lg:flex items-center gap-3 xl:gap-6'>
                {NAV_LINKS.map(link => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`text-[10px] lg:text-xs xl:text-sm font-bold tracking-tighter lg:tracking-tight xl:tracking-wide transition-colors duration-200 hover:opacity-75 whitespace-nowrap outline-none ${linkColorClass}`}
                    aria-label={link.label}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>

            {/* CENTER — Logo (always centered) */}
            <div className='flex items-center justify-center'>
              <Link href='/' aria-label='Too Fresh To Waste Home'>
                <div className='relative w-20 lg:w-24 xl:w-32 h-10 lg:h-12 xl:h-16'>
                  {/* Primary-bg logo (when not scrolled) */}
                  <Image
                    src='/images/green-header-center.png'
                    alt='Too Fresh To Waste Logo'
                    fill
                    className={`object-contain transition-opacity duration-200 ${
                      isScrolledState ? 'opacity-0' : 'opacity-100'
                    }`}
                    sizes='(max-width: 1024px) 64px, (max-width: 1280px) 80px, 112px'
                    loading='eager'
                  />
                  {/* Scrolled logo */}
                  <Image
                    src='/images/white-header-center-logo.png'
                    alt='Too Fresh To Waste Logo'
                    fill
                    className={`object-contain transition-opacity duration-200 ${
                      isScrolledState ? 'opacity-100' : 'opacity-0'
                    }`}
                    sizes='(max-width: 1024px) 64px, (max-width: 1280px) 80px, 112px'
                    loading='eager'
                  />
                </div>
              </Link>
            </div>

            {/* RIGHT — CTA buttons (desktop) / Hamburger (mobile) */}
            <div className='flex items-center justify-end gap-2'>
              {/* Desktop: CTA Buttons */}
              <div className='hidden lg:flex items-center gap-2 xl:gap-3'>
                <Link
                  href='/coming-soon'
                  className={`px-4 xl:px-5 py-2 border-[0.5px] rounded-full font-bold text-xs xl:text-sm tracking-tight transition-all duration-200 hover:opacity-90 whitespace-nowrap outline-none ${
                    isScrolledState
                      ? 'bg-primary-500 text-white border-primary-500'
                      : 'bg-white text-primary-500 border-white'
                  }`}
                  aria-label={t('cta.downloadApp')}
                >
                  {t('cta.downloadApp')}
                </Link>
                <Link
                  href='/merchant-signup'
                  className={`px-4 xl:px-5 py-2 border-[0.5px] rounded-full font-bold text-xs xl:text-sm tracking-tight transition-all duration-200 hover:opacity-75 whitespace-nowrap outline-none ${buttonBorderClass}`}
                  aria-label={t('cta.businessSignup')}
                >
                  {t('cta.businessSignupShort')}
                </Link>
                {/* Language Switcher — between Sign Up and Login */}
                <LanguageSwitcher
                  showIcon={false}
                  buttonClassName={`flex items-center gap-2 px-4 xl:px-5 py-2 rounded-full border-[0.5px] font-bold text-xs xl:text-sm tracking-tight transition-all duration-200 hover:opacity-75 whitespace-nowrap outline-none ${buttonBorderClass}`}
                />
                <Link
                  href='/login'
                  className={`flex flex-col items-center gap-0.5 shrink-0 transition-all duration-200 hover:opacity-75 outline-none ${linkColorClass}`}
                  aria-label={t('cta.login')}
                >
                  <Image
                    src='/icons/login.svg'
                    alt=''
                    width={22}
                    height={22}
                    aria-hidden='true'
                    className={`transition-all duration-200 ${isScrolledState ? '' : 'brightness-0 invert'}`}
                  />
                  <span className='text-xs xl:text-sm font-bold tracking-wide whitespace-nowrap'>
                    {t('cta.login')}
                  </span>
                </Link>
              </div>

              {/* Mobile: Hamburger Menu Button */}
              <button
                onClick={toggleMobileMenu}
                className={`lg:hidden p-2 rounded-md transition-colors duration-300 ${linkColorClass}`}
                aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={isMobileMenuOpen}
                aria-controls='mobile-menu'
              >
                <svg
                  className='w-5 h-5'
                  fill='none'
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth='2'
                  viewBox='0 0 24 24'
                  stroke='currentColor'
                >
                  {isMobileMenuOpen ? (
                    <path d='M6 18L18 6M6 6l12 12' />
                  ) : (
                    <path d='M4 6h16M4 12h16M4 18h16' />
                  )}
                </svg>
              </button>
            </div>
          </nav>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div
          className='fixed inset-0 z-40 lg:hidden'
          onClick={() => setIsMobileMenuOpen(false)}
          role='presentation'
        >
          {/* Backdrop */}
          <div className='absolute inset-0 bg-black/50 backdrop-blur-sm' />

          {/* Menu Panel */}
          <div
            id='mobile-menu'
            className={`absolute top-16 left-0 right-0 max-h-[calc(100vh-4rem)] overflow-y-auto shadow-xl ${
              isScrolledState ? 'bg-[#f9f3f0]' : 'bg-primary-500'
            }`}
            onClick={e => e.stopPropagation()}
            role='menu'
          >
            <div className='px-4 py-6 space-y-1'>
              {/* Navigation Links */}
              {NAV_LINKS.map(link => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`block px-4 py-3 text-base font-semibold tracking-wide transition-colors duration-200 hover:bg-white/10 rounded-lg outline-none ${linkColorClass}`}
                  onClick={() => setIsMobileMenuOpen(false)}
                  role='menuitem'
                >
                  {link.label}
                </Link>
              ))}

              {/* Divider */}
              <div
                className={`my-4 border-t ${isScrolledState ? 'border-primary-500/20' : 'border-white/20'}`}
              />

              {/* CTA Buttons */}
              <div className='space-y-3 px-4'>
                <Link
                  href='/coming-soon'
                  className={`block text-center px-6 py-3 border-[0.5px] rounded-full font-semibold text-sm tracking-wide transition-all duration-200 whitespace-nowrap outline-none ${buttonBorderClass}`}
                  onClick={() => setIsMobileMenuOpen(false)}
                  role='menuitem'
                >
                  {t('cta.downloadApp')}
                </Link>
                <Link
                  href='/merchant-signup'
                  className={`block text-center px-6 py-3 border-[0.5px] rounded-full font-semibold text-sm tracking-wide transition-all duration-200 whitespace-nowrap outline-none ${buttonBorderClass}`}
                  onClick={() => setIsMobileMenuOpen(false)}
                  role='menuitem'
                >
                  {t('cta.businessSignup')}
                </Link>
                <Link
                  href='/login'
                  className={`flex items-center justify-center gap-2 px-6 py-3 border-[0.5px] rounded-full font-semibold text-sm tracking-wide transition-all duration-200 whitespace-nowrap outline-none ${buttonBorderClass}`}
                  onClick={() => setIsMobileMenuOpen(false)}
                  role='menuitem'
                >
                  <Image
                    src='/icons/login.svg'
                    alt=''
                    width={20}
                    height={20}
                    aria-hidden='true'
                    className={`transition-all duration-200 ${isScrolledState ? '' : 'brightness-0 invert'}`}
                  />
                  {t('cta.login')}
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Spacer — matches header height; mirrors header bg to avoid a gap on pages
          where the first section shares the header's initial primary color */}
      <div
        className={`h-16 ${isHomePage && !isScrolledState ? 'bg-primary-500' : ''}`}
        aria-hidden='true'
      />
    </>
  );
}
