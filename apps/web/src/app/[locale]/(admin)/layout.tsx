import { cookies } from 'next/headers';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { pickMessages } from '@/lib/pick-messages';
import { AdminLayoutShell } from './admin-layout-shell';
import { NOINDEX_METADATA } from '@/lib/seo-metadata';

// Authenticated / transactional area — must never enter the search index.
export const metadata = NOINDEX_METADATA;

const ADMIN_NAMESPACES = [
  'dashboard',
  'common',
  'accessibility',
  'adminOrders',
  'adminAuditLog',
  'adminPayments',
  'adminAnalytics',
  'adminNotifications',
  'adminLeaderboards',
  'adminVotingWinners',
  'adminTeam',
  'adminTickets',
  'adminAnnouncements',
  'adminGeozones',
  'adminSecurity',
  'adminOrganizations',
  'adminDrivers',
  'adminCommission',
] as const;

const SIDEBAR_COOKIE = 'admin_sidebar_collapsed';

interface AdminLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function AdminLayout({ children, params }: AdminLayoutProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const allMessages = await getMessages();
  const messages = pickMessages(allMessages, ADMIN_NAMESPACES);

  const cookieStore = await cookies();
  const raw = cookieStore.get(SIDEBAR_COOKIE)?.value;
  let collapsedGroups: string[] = [];
  if (raw) {
    try {
      const parsed: unknown = JSON.parse(decodeURIComponent(raw));
      if (Array.isArray(parsed) && parsed.every(v => typeof v === 'string')) {
        collapsedGroups = parsed as string[];
      }
    } catch {
      // malformed cookie — use default (all expanded)
    }
  }

  return (
    <NextIntlClientProvider messages={messages}>
      <AdminLayoutShell collapsedGroups={collapsedGroups}>{children}</AdminLayoutShell>
    </NextIntlClientProvider>
  );
}
