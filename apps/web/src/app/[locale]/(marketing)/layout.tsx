import { type Locale } from '@/i18n/config';
import {
  OrganizationStructuredData,
  WebsiteStructuredData,
  MobileApplicationStructuredData,
} from '@/components/StructuredData';
import { Footer } from '@/components/layout';
import { Newsletter } from '@/components/sections';

interface MarketingLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function MarketingLayout({ children, params }: MarketingLayoutProps) {
  const { locale } = await params;

  return (
    <>
      {/* Structured Data for SEO */}
      <OrganizationStructuredData locale={locale as Locale} />
      <WebsiteStructuredData locale={locale as Locale} />
      <MobileApplicationStructuredData locale={locale as Locale} />

      {/* Main content */}
      <div id='main-content'>{children}</div>

      {/* Newsletter */}
      <Newsletter />

      {/* Footer */}
      <Footer />
    </>
  );
}
