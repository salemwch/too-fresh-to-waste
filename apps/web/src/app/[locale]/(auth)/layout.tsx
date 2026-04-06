import Image from 'next/image';
import { Link } from '@/i18n/routing';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

interface AuthLayoutProps {
  children: React.ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
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
  );
}
