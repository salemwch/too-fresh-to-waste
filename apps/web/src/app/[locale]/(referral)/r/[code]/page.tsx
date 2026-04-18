import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Join Too Fresh To Waste',
  description: 'Help reduce food waste and earn rewards. Sign up today!',
  robots: { index: false, follow: false },
};

interface ReferralPageProps {
  params: Promise<{ code: string; locale: string }>;
}

export default async function ReferralPage({ params }: ReferralPageProps) {
  const { code, locale } = await params;

  const consumerAppLink = `toofreshtowaste://register?referralCode=${code}`;
  const businessSignupLink = `/${locale}/merchant-signup?ref=${code}`;

  return (
    <main className='flex min-h-screen flex-col items-center justify-center px-4 py-12'>
      <div className='w-full max-w-md space-y-8 text-center'>
        {/* Logo / Brand */}
        <div className='space-y-2'>
          <div className='mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary'>
            <span className='text-2xl font-bold text-white'>TF</span>
          </div>
          <h1 className='font-heading text-3xl font-bold tracking-tight text-foreground'>
            Too Fresh To Waste
          </h1>
          <p className='text-muted-foreground'>
            You&apos;ve been invited to join the food waste reduction movement!
          </p>
        </div>

        {/* Referral code badge */}
        <div className='rounded-xl border border-primary/20 bg-primary/5 px-4 py-3'>
          <p className='text-xs font-medium text-muted-foreground'>Your referral code</p>
          <p className='font-mono text-lg font-bold text-primary'>{code}</p>
        </div>

        {/* Two paths */}
        <div className='space-y-4'>
          <p className='text-sm font-medium text-muted-foreground'>How do you want to join?</p>

          {/* Consumer path — opens mobile app via deep link */}
          <a
            href={consumerAppLink}
            className='flex w-full items-center justify-center gap-3 rounded-xl bg-primary px-6 py-4 text-white shadow-md transition-shadow hover:shadow-lg'
          >
            <svg
              xmlns='http://www.w3.org/2000/svg'
              className='h-6 w-6'
              fill='none'
              viewBox='0 0 24 24'
              stroke='currentColor'
              strokeWidth={2}
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                d='M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z'
              />
            </svg>
            <div className='text-start'>
              <p className='font-semibold'>Sign up as Consumer</p>
              <p className='text-xs text-white/80'>Open in the mobile app</p>
            </div>
          </a>

          {/* Business path — web signup (plain anchor; path includes dynamic query string) */}
          <a
            href={businessSignupLink}
            className='flex w-full items-center justify-center gap-3 rounded-xl border-2 border-primary bg-white px-6 py-4 text-primary shadow-sm transition-shadow hover:shadow-md'
          >
            <svg
              xmlns='http://www.w3.org/2000/svg'
              className='h-6 w-6'
              fill='none'
              viewBox='0 0 24 24'
              stroke='currentColor'
              strokeWidth={2}
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                d='M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4'
              />
            </svg>
            <div className='text-start'>
              <p className='font-semibold'>Sign up as Business</p>
              <p className='text-xs text-primary/70'>Continue on web</p>
            </div>
          </a>
        </div>

        {/* Footer info */}
        <div className='space-y-1 pt-4 text-xs text-muted-foreground'>
          <p>Save food. Save money. Earn rewards.</p>
        </div>
      </div>
    </main>
  );
}
