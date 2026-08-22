import type { Metadata } from 'next';
import { buildLocalizedPageMetadata, type LocalizedMeta } from '@/lib/seo-metadata';

import type { Locale } from '@/i18n/config';

// The page itself is a client component, which cannot export metadata.
// A co-located server layout is the supported way to give it a title,
// description and canonical without refactoring the interactive UI.

const PATH = '/careers';

const COPY: LocalizedMeta = {
  en: {
    title: 'Careers - Build the Anti-Waste Economy in Tunisia',
    description:
      'Join Too Fresh To Waste and help Tunisian businesses turn surplus food into revenue instead of landfill. See open roles in engineering, operations and partnerships.',
  },
  fr: {
    title: "Carrières - Construisez l'Économie Anti-Gaspi en Tunisie",
    description:
      "Rejoignez Too Fresh To Waste et aidez les commerces tunisiens à transformer leurs invendus en chiffre d'affaires plutôt qu'en déchets. Découvrez nos postes ouverts.",
  },
  ar: {
    title: 'الوظائف - ابنِ اقتصاد مكافحة الهدر في تونس',
    description:
      'انضم إلى Too Fresh To Waste وساعد الشركات التونسية على تحويل الطعام الفائض إلى إيرادات بدلاً من النفايات. اطلع على الوظائف المتاحة.',
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

export default function CareersLayout({ children }: { children: React.ReactNode }) {
  return children;
}
