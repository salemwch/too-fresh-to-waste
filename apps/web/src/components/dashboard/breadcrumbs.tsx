'use client';

import { usePathname } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronRight } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { cn } from '@foodwaste/ui';

export function Breadcrumbs() {
  const pathname = usePathname();
  const locale = useLocale();
  const t = useTranslations('dashboard.nav');

  // Remove locale prefix and split
  const withoutLocale = pathname.replace(`/${locale}`, '');
  const segments = withoutLocale.split('/').filter(Boolean);

  if (segments.length <= 1) return null;

  return (
    <nav aria-label='Breadcrumb' className='flex items-center gap-xs text-sm text-muted-foreground'>
      {segments.map((segment, index) => {
        const href = '/' + segments.slice(0, index + 1).join('/');
        const isLast = index === segments.length - 1;

        let label: string;
        try {
          label = t(segment);
        } catch {
          label = segment.charAt(0).toUpperCase() + segment.slice(1);
        }

        return (
          <span key={href} className='flex items-center gap-xs'>
            {index > 0 && <ChevronRight className='h-3 w-3' />}
            {isLast ? (
              <span className={cn('text-foreground font-medium')}>{label}</span>
            ) : (
              <Link href={href} className='hover:text-foreground transition-colors'>
                {label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
