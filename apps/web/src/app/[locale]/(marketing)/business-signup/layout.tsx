import type { Metadata } from 'next';
import { buildLocalizedPageMetadata, type LocalizedMeta } from '@/lib/seo-metadata';

import type { Locale } from '@/i18n/config';

const PATH = '/business-signup';

const COPY: LocalizedMeta = {
  en: {
    title: 'Sell Your Surplus Food — Partner With Too Fresh To Waste',
    description:
      'Bakeries, restaurants, hotels and grocers in Tunisia: turn unsold food into revenue instead of waste. Free to join, no fixed fees, new customers through the door.',
  },
  fr: {
    title: 'Vendez Vos Invendus — Devenez Partenaire Too Fresh To Waste',
    description:
      "Boulangeries, restaurants, hôtels et épiceries en Tunisie : transformez vos invendus en chiffre d'affaires plutôt qu'en déchets. Inscription gratuite, sans frais fixes.",
  },
  ar: {
    title: 'بِع طعامك الفائض — كن شريكًا مع Too Fresh To Waste',
    description:
      'المخابز والمطاعم والفنادق والبقالات في تونس: حوّل الطعام غير المباع إلى إيرادات بدلاً من النفايات. الانضمام مجاني ودون رسوم ثابتة.',
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return buildLocalizedPageMetadata(PATH, locale as Locale, COPY);
}

export default function BusinessSignupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
