import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { buildPageMetadata } from '@/lib/seo-metadata';
import { LegalDocument } from '@/components/legal/legal-document';

import type { Locale } from '@/i18n/config';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'legal.security' });
  return buildPageMetadata({
    path: '/security',
    locale: locale as Locale,
    title: t('meta.title'),
    description: t('meta.description'),
  });
}

const SECURITY_EMAIL = 'support@toofreshtowaste.com';

export default async function SecurityPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <LegalDocument locale={locale as Locale} document='security' contactEmail={SECURITY_EMAIL} />
  );
}
