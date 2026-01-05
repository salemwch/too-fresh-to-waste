'use client';

import { useLocale } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/routing';
import { locales, type Locale, localeConfig } from '@/i18n/config';
import { useState, useRef, useEffect } from 'react';

interface LanguageSwitcherProps {
  variant?: 'dropdown' | 'inline';
  className?: string;
  buttonClassName?: string;
}

export function LanguageSwitcher({ variant = 'dropdown', className = '', buttonClassName }: LanguageSwitcherProps) {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLocaleChange = (newLocale: Locale) => {
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

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={buttonClassName || "flex items-center gap-2 px-3 py-2 rounded-md bg-white/10 hover:bg-white/20 transition-colors text-white"}
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

      {isOpen && (
        <div
          className="absolute top-full right-0 mt-2 w-48 bg-white rounded-lg shadow-lg py-1 z-50"
          role="listbox"
          aria-label="Available languages"
        >
          {locales.map((loc) => {
            const config = localeConfig[loc];
            const isSelected = locale === loc;

            return (
              <button
                key={loc}
                onClick={() => handleLocaleChange(loc)}
                className={`w-full flex items-center justify-between px-4 py-2 text-sm transition-colors ${
                  isSelected
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
                role="option"
                aria-selected={isSelected}
              >
                <span className={config.direction === 'rtl' ? 'font-arabic' : ''}>
                  {config.nativeName}
                </span>
                <span className="text-gray-400 text-xs">{config.name}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
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
    router.replace(pathname, { locale: nextLocale });
  };

  return (
    <button
      onClick={cycleLocale}
      className={`flex items-center justify-center w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white ${className}`}
      aria-label={`Current language: ${localeConfig[locale].name}. Click to change.`}
    >
      <span className="text-xs font-bold uppercase">{locale}</span>
    </button>
  );
}
