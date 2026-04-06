'use client';

import { useLocale } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/routing';
import { locales, type Locale, localeConfig } from '@/i18n/config';
import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@foodwaste/ui';

interface LanguageSwitcherProps {
  variant?: 'dropdown' | 'inline';
  className?: string;
  buttonClassName?: string;
}

export function LanguageSwitcher({
  variant = 'dropdown',
  className = '',
  buttonClassName,
}: LanguageSwitcherProps) {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Set mounted state for portal
  useEffect(() => {
    setMounted(true);
  }, []);

  // Update dropdown position when opened
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      // Since header is fixed, rect.bottom is already viewport-relative
      // No need to add window.scrollY
      setDropdownPosition({
        top: rect.bottom,
        left: rect.left + rect.width / 2,
        width: rect.width,
      });
    }
  }, [isOpen]);

  // Close dropdown when clicking outside (handle both mouse and touch events)
  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  const handleLocaleChange = (newLocale: Locale) => {
    // Set cookie to persist language preference (1 year expiry)
    const maxAge = 365 * 24 * 60 * 60; // 1 year in seconds
    document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=${maxAge}; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;

    // Navigate to the new locale
    router.replace(pathname, { locale: newLocale });
    setIsOpen(false);
  };

  const currentLocale = localeConfig[locale];

  if (variant === 'inline') {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        {locales.map((loc) => (
          <button
            key={loc}
            onClick={() => handleLocaleChange(loc)}
            className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
              locale === loc
                ? 'bg-primary-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            aria-label={`Switch to ${localeConfig[loc].name}`}
            aria-current={locale === loc ? 'true' : undefined}
          >
            {localeConfig[loc].nativeName}
          </button>
        ))}
      </div>
    );
  }

  // Render dropdown content
  const dropdownContent =
    isOpen && mounted ? (
      <div
        ref={dropdownRef}
        className="fixed bg-white rounded-lg shadow-xl py-1 z-[99999] max-h-[300px] overflow-y-auto"
        role="listbox"
        aria-label="Available languages"
        style={{
          top: `${dropdownPosition.top + 8}px`,
          left: `${dropdownPosition.left}px`,
          width: `${dropdownPosition.width}px`,
          transform: 'translateX(-50%)',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3), 0 4px 6px rgba(0, 0, 0, 0.2)',
        }}
      >
        {locales.map((loc) => {
          const config = localeConfig[loc];
          const isSelected = locale === loc;

          return (
            <button
              key={loc}
              onClick={() => handleLocaleChange(loc)}
              className={`w-full flex items-center justify-center px-3 py-2.5 text-sm transition-colors ${
                isSelected
                  ? 'bg-primary-50 text-primary-700 font-semibold'
                  : 'text-gray-700 hover:bg-gray-50 active:bg-gray-100'
              }`}
              role="option"
              aria-selected={isSelected}
              style={{ minHeight: '44px' }}
            >
              <span
                className={`flex items-center gap-2 ${config.direction === 'rtl' ? 'font-arabic' : ''}`}
              >
                {isSelected && (
                  <svg
                    className="w-3.5 h-3.5 text-primary-600 flex-shrink-0"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
                <span className="text-sm font-medium">{config.nativeName}</span>
              </span>
            </button>
          );
        })}
      </div>
    ) : null;

  return (
    <>
      <div className={className}>
        <button
          ref={buttonRef}
          onClick={() => setIsOpen(!isOpen)}
          className={
            buttonClassName ||
            'flex items-center gap-2 px-3 py-2 rounded-md bg-white/10 hover:bg-white/20 transition-colors text-white'
          }
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-label="Select language"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
            />
          </svg>
          <span className="text-sm font-medium">{currentLocale.nativeName}</span>
          <svg
            className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Render dropdown via portal to escape stacking context */}
      {mounted &&
        typeof document !== 'undefined' &&
        dropdownContent &&
        createPortal(dropdownContent, document.body)}
    </>
  );
}

// Compact version for mobile
export function LanguageSwitcherCompact({ className = '' }: { className?: string }) {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();

  const cycleLocale = () => {
    const currentIndex = locales.indexOf(locale);
    const nextIndex = (currentIndex + 1) % locales.length;
    const nextLocale = locales[nextIndex] ?? locales[0];

    // Set cookie to persist language preference (1 year expiry)
    const maxAge = 365 * 24 * 60 * 60; // 1 year in seconds
    document.cookie = `NEXT_LOCALE=${nextLocale}; path=/; max-age=${maxAge}; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;

    router.replace(pathname, { locale: nextLocale });
  };

  return (
    <button
      onClick={cycleLocale}
      className={cn(
        'flex items-center justify-center w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white',
        className,
      )}
      aria-label={`Current language: ${localeConfig[locale].name}. Click to change.`}
    >
      <span className="text-xs font-bold uppercase">{locale}</span>
    </button>
  );
}
