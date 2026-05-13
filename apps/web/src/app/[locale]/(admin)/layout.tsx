import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { pickMessages } from '@/lib/pick-messages';
import { AdminLayoutShell } from './admin-layout-shell';

// Only the namespaces used by admin dashboard client components.
// Saves ~41 % of the serialised translation payload vs. sending all messages.
const ADMIN_NAMESPACES = ['dashboard', 'common', 'accessibility'] as const;

interface AdminLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function AdminLayout({ children, params }: AdminLayoutProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const allMessages = await getMessages();
  const messages = pickMessages(allMessages, ADMIN_NAMESPACES);

  return (
    <NextIntlClientProvider messages={messages}>
      <AdminLayoutShell>{children}</AdminLayoutShell>
    </NextIntlClientProvider>
  );
}
