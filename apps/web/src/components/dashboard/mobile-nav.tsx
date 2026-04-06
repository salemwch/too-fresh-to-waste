'use client';

import Image from 'next/image';
import { Menu } from 'lucide-react';
import { Button, Sheet, SheetContent, SheetTrigger, SheetTitle } from '@foodwaste/ui';
import { SidebarNav } from './sidebar-nav';
import type { NavItem } from '@/config/navigation.config';
import { Link } from '@/i18n/routing';

interface MobileNavProps {
  items: NavItem[];
}

export function MobileNav({ items }: MobileNavProps) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant='ghost' className='lg:hidden h-7 w-7 p-0 flex items-center justify-center'>
          <Menu className='h-4 w-4' />
          <span className='sr-only'>Toggle navigation</span>
        </Button>
      </SheetTrigger>
      <SheetContent side='left' className='w-56 p-0'>
        <SheetTitle className='sr-only'>Navigation</SheetTitle>
        <div className='flex h-12 items-center border-b px-4'>
          <Link href='/' className='flex items-center gap-2'>
            <Image
              src='/images/green-header-center.png'
              alt='Logo'
              width={28}
              height={28}
              className='h-7 w-auto'
            />
            <span className='text-sm font-bold text-foreground'>TFTW</span>
          </Link>
        </div>
        <div className='py-3'>
          <SidebarNav items={items} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
