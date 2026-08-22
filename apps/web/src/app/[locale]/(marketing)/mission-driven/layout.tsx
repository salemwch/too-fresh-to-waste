import type { Metadata } from 'next';
import { buildLocalizedPageMetadata, type LocalizedMeta } from '@/lib/seo-metadata';

import type { Locale } from '@/i18n/config';

const PATH = '/mission-driven';

const COPY: LocalizedMeta = {
  en: {
    title: 'Mission Driven - Why We Fight Food Waste in Tunisia',
    description:
      'A third of the food produced in the world is never eaten. This is the thinking behind Too Fresh To Waste: the tensions we navigate, the trade-offs we accept, and what we refuse to compromise on.',
  },
  fr: {
    title: 'Notre Mission - Pourquoi Nous Luttons Contre le Gaspillage',
    description:
      "Un tiers de la nourriture produite dans le monde n'est jamais consommé. Voici la réflexion derrière Too Fresh To Waste : nos tensions, nos arbitrages, et ce sur quoi nous ne transigeons pas.",
  },
  ar: {
    title: 'رسالتنا - لماذا نكافح هدر الطعام في تونس',
    description:
      'ثلث الطعام المنتج في العالم لا يُستهلك أبدًا. هذا هو التفكير وراء Too Fresh To Waste: التوازنات التي نتنقل بينها وما لا نساوم عليه.',
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

export default function MissionDrivenLayout({ children }: { children: React.ReactNode }) {
  return children;
}
