'use client';

import { Smartphone } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useAppLaunchModal } from '@/lib/app-launch-modal.store';
import { useTranslations } from 'next-intl';

export function AppLaunchModal() {
  const { isOpen, close } = useAppLaunchModal();
  const t = useTranslations('appLaunchModal');

  return (
    <Dialog open={isOpen} onOpenChange={v => !v && close()}>
      <DialogContent className='sm:max-w-[380px] p-0 gap-0 overflow-hidden rounded-3xl border-0 shadow-2xl [&>button]:top-4 [&>button]:right-4 [&>button]:text-white/50 [&>button]:hover:text-white [&>button]:opacity-100'>
        <DialogTitle className='sr-only'>{t('title')}</DialogTitle>

        <div
          className='relative px-6 pt-8 pb-6 text-center'
          style={{ background: 'hsl(174,72%,17%)' }}
        >
          <span className='mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-white/15 bg-white/10'>
            <Smartphone className='h-7 w-7 text-white' />
          </span>

          <h2
            className='mb-2 text-xl font-bold text-white'
            style={{ fontFamily: 'var(--font-serif)' }}
          >
            {t('heading')}
          </h2>
          <p className='text-sm text-white/60'>{t('description')}</p>
        </div>

        <div className='bg-white px-6 py-5'>
          <p className='text-center text-xs text-muted-foreground'>{t('platforms')}</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
