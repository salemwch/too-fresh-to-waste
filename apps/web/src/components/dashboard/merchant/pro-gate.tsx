'use client';

import { useState } from 'react';
import { Lock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMyEstablishment } from '@/hooks/use-merchant-dashboard';
import { SubscriptionModal } from './subscription-modal';

export function ProGate({ children }: { children: React.ReactNode }) {
  const { data: establishment } = useMyEstablishment();
  const t = useTranslations('subscription');
  const [modalOpen, setModalOpen] = useState(false);

  const isPro = establishment?.subscriptionTier === 'pro';

  if (isPro) return <>{children}</>;

  return (
    <>
      <div className='relative'>
        <div className='pointer-events-none select-none blur-sm opacity-50'>{children}</div>
        <div className='absolute inset-0 flex flex-col items-center justify-center bg-background/60 rounded-2xl'>
          <div className='flex flex-col items-center gap-4 text-center max-w-sm'>
            <div className='h-14 w-14 rounded-2xl bg-primary/10 grid place-items-center'>
              <Lock className='size-7 text-primary' />
            </div>
            <h3 className='text-lg font-semibold text-foreground'>{t('proOnly')}</h3>
            <p className='text-sm text-muted-foreground'>{t('proOnlyDescription')}</p>
            <button
              type='button'
              onClick={() => setModalOpen(true)}
              className='inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90'
            >
              {t('upgradeToPro')}
            </button>
          </div>
        </div>
      </div>
      {establishment && (
        <SubscriptionModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          establishmentId={establishment._id}
        />
      )}
    </>
  );
}
