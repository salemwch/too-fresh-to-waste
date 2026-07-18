'use client';

import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Menu } from 'lucide-react';
import { Button, Sheet, SheetContent, SheetTrigger, SheetTitle } from '@foodwaste/ui';
import { Link } from '@/i18n/routing';
import { cn } from '@foodwaste/ui';
import type { NavGroup } from '@/config/navigation.config';

interface AdminMobileNavProps {
  groups: NavGroup[];
}

export function AdminMobileNav({ groups }: AdminMobileNavProps) {
  const pathname = usePathname();
  const locale = useLocale();
  const tNav = useTranslations('dashboard.nav');
  const tGroups = useTranslations('dashboard.nav.groups');

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant='ghost' className='xl:hidden h-7 w-7 p-0 flex items-center justify-center'>
          <Menu className='h-4 w-4' />
          <span className='sr-only'>Toggle navigation</span>
        </Button>
      </SheetTrigger>
      <SheetContent side='left' className='w-64 p-0 overflow-y-auto'>
        <SheetTitle className='sr-only'>Admin Navigation</SheetTitle>

        <div className='flex h-12 items-center border-b px-4'>
          <Link href='/' className='flex items-center gap-2'>
            <Image
              src='/images/green-header-center.png'
              alt='Logo'
              width={28}
              height={28}
              className='h-7 w-auto'
            />
            <span className='text-sm font-bold text-foreground'>TFTW Admin</span>
          </Link>
        </div>

        <nav className='py-3 px-3 space-y-1'>
          {groups.map(group => (
            <div key={group.groupKey}>
              <div className='px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground'>
                {tGroups(group.groupKey)}
              </div>
              <div className='space-y-0.5'>
                {group.items
                  .filter(item => item.titleKey !== 'settings')
                  .map(item => {
                    const isActive = pathname.startsWith(`/${locale}${item.href}`);
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                          isActive
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                        )}
                      >
                        <Icon className='size-4 shrink-0' />
                        <span>{tNav(item.titleKey)}</span>
                      </Link>
                    );
                  })}
              </div>
            </div>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
