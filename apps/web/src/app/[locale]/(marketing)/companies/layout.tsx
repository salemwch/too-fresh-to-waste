import type { Metadata } from 'next';
import { buildLocalizedPageMetadata, type LocalizedMeta } from '@/lib/seo-metadata';

import type { Locale } from '@/i18n/config';

const PATH = '/companies';

const COPY: LocalizedMeta = {
  en: {
    title: 'For Companies — Corporate Food Waste Solutions in Tunisia',
    description:
      'Cut your food waste, hit your ESG targets and recover revenue on unsold stock. Too Fresh To Waste gives Tunisian companies measurable waste reduction with reporting built in.',
  },
  fr: {
    title: 'Entreprises — Solutions Anti-Gaspillage Alimentaire en Tunisie',
    description:
      "Réduisez votre gaspillage alimentaire, atteignez vos objectifs ESG et récupérez du chiffre d'affaires sur vos invendus. Une réduction mesurable avec reporting intégré.",
  },
  ar: {
    title: 'للشركات — حلول مكافحة هدر الطعام في تونس',
    description:
      'قلل هدر الطعام، حقق أهداف الاستدامة الخاصة بك، واسترد الإيرادات من المخزون غير المباع مع تقارير مدمجة.',
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

export default function CompaniesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
