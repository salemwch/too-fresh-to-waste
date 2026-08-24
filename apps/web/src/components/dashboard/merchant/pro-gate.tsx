'use client';

import { useState } from 'react';
import { BarChart3, FileText, Lock, Star } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMyEstablishment } from '@/hooks/use-merchant-dashboard';
import { SubscriptionModal } from './subscription-modal';

function PlaceholderSkeleton() {
  return (
    <div className='space-y-2xl pointer-events-none select-none' aria-hidden='true'>
      <div className='flex items-center justify-between'>
        <div>
          <div className='h-3 w-24 rounded bg-muted' />
          <div className='h-8 w-56 rounded bg-muted mt-sm' />
          <div className='h-3 w-72 rounded bg-muted mt-sm' />
        </div>
        <div className='h-10 w-32 rounded-full bg-muted' />
      </div>

      <div className='grid grid-cols-1 md:grid-cols-3 gap-lg'>
        {[BarChart3, Star, FileText].map((Icon, i) => (
          <div key={i} className='rounded-2xl border border-border bg-card p-2xl space-y-lg'>
            <div className='flex items-center gap-md'>
              <div className='h-10 w-10 rounded-xl bg-muted grid place-items-center'>
                <Icon className='size-5 text-muted-foreground/30' />
              </div>
              <div className='space-y-1.5 flex-1'>
                <div className='h-3 w-20 rounded bg-muted' />
                <div className='h-5 w-16 rounded bg-muted' />
              </div>
            </div>
            <div className='h-2 w-full rounded-full bg-muted' />
          </div>
        ))}
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-2 gap-2xl'>
        {[0, 1].map(i => (
          <div key={i} className='rounded-2xl border border-border bg-card p-2xl space-y-md'>
            <div className='h-3 w-32 rounded bg-muted' />
            {Array.from({ length: 5 }).map((_, j) => (
              <div key={j} className='flex items-center justify-between py-sm'>
                <div className='flex items-center gap-md'>
                  <div className='h-4 w-4 rounded bg-muted' />
                  <div className='h-3 w-28 rounded bg-muted' />
                </div>
                <div className='h-3 w-16 rounded bg-muted' />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ProGate({ children }: { children: React.ReactNode }) {
  const { data: establishment } = useMyEstablishment();
  const t = useTranslations('subscription');
  const [modalOpen, setModalOpen] = useState(false);

  // TODO: remove this bypass after video recording
  const BYPASS_FOR_VIDEO = true;
  const isPro = BYPASS_FOR_VIDEO || establishment?.subscriptionTier === 'pro';

  if (isPro) return <>{children}</>;

  return (
    <>
      <div className='relative min-h-[60vh]'>
        <div className='opacity-40 blur-[2px]'>
          <PlaceholderSkeleton />
        </div>
        <div className='absolute inset-0 flex flex-col items-center justify-center'>
          <div className='flex flex-col items-center gap-lg text-center max-w-sm'>
            <div className='h-14 w-14 rounded-2xl bg-primary/10 grid place-items-center'>
              <Lock className='size-7 text-primary' />
            </div>
            <h3 className='text-lg font-semibold text-foreground'>{t('proOnly')}</h3>
            <p className='text-sm text-muted-foreground'>{t('proOnlyDescription')}</p>
            <button
              type='button'
              onClick={() => setModalOpen(true)}
              className='inline-flex items-center gap-sm rounded-lg bg-primary px-xl py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90'
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
