import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import Image from 'next/image';
import { Link } from '@/i18n/routing';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { pickMessages } from '@/lib/pick-messages';

// Only the namespaces used by auth client components (login, register,
// forgot-password, reset-password, verify-email).
// Saves ~83 % of the serialised translation payload vs. sending all messages.
const AUTH_NAMESPACES = ['auth', 'merchantSignup', 'common'] as const;

interface AuthLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function AuthLayout({ children, params }: AuthLayoutProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const allMessages = await getMessages();
  const messages = pickMessages(allMessages, AUTH_NAMESPACES);

  return (
    <NextIntlClientProvider messages={messages}>
      <div className='min-h-screen flex flex-col bg-muted/30'>
        {/* Minimal header with logo and locale switcher */}
        <header className='flex items-center justify-between px-6 py-4'>
          <Link href='/' className='flex items-center gap-2'>
            <Image
              src='/images/green-header-center.png'
              alt='Too Fresh To Waste'
              width={160}
              height={40}
              className='h-10 w-auto'
            />
          </Link>
          <LanguageSwitcher />
        </header>

        {/* Centered content area */}
        <main className='flex-1 flex items-center justify-center px-4 py-8'>
          <div className='w-full max-w-md'>{children}</div>
        </main>

        {/* Minimal footer */}
        <footer className='py-4 text-center text-sm text-muted-foreground'>
          &copy; {new Date().getFullYear()} Too Fresh To Waste
        </footer>
      </div>
    </NextIntlClientProvider>
  );
}
