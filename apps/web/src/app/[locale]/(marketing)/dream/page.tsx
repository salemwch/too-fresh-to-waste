import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { Header } from '@/components/layout';
import { buildLocalizedPageMetadata } from '@/lib/seo-metadata';
import type { Locale } from '@/i18n/config';

import DreamClient from './_components/DreamClient';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  return buildLocalizedPageMetadata('/dream', locale as Locale, {
    en: {
      title: 'The dream — one city at a time | Too Fresh To Waste',
      description:
        'Every city on earth throws food away. We started with ours. See where we are open, which city unlocks next, and how the people in it decide.',
    },
    fr: {
      title: 'Le rêve — une ville à la fois | Too Fresh To Waste',
      description:
        'Toutes les villes du monde jettent de la nourriture. Nous avons commencé par la nôtre. Découvrez où nous sommes ouverts et quelle ville ouvre ensuite.',
    },
    ar: {
      title: 'الحلم — مدينة تلو الأخرى | Too Fresh To Waste',
      description:
        'كل مدينة في العالم ترمي الطعام. بدأنا بمدينتنا. اكتشف أين نحن مفتوحون وأي مدينة تُفتح تاليًا ومن يقرّر ذلك.',
    },
  });
}

export default async function DreamPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      {/*
       * Scoped to this page. The reveal helper is opt-in per element rather than
       * a global observer, so nothing on the page animates unless it is asked to
       * — and `prefers-reduced-motion` disables the transition rather than the
       * visibility, so content never stays hidden for someone who needs it.
       */}
      <style>{`
        @keyframes dreamRise { from { opacity:0; transform:translateY(30px) } to { opacity:1; transform:none } }
        @keyframes dreamGlow { 0%,100% { opacity:.35 } 50% { opacity:.7 } }
        .dream-rise { animation: dreamRise .9s cubic-bezier(.22,.61,.36,1) both }
        .dream-rise.d1 { animation-delay:.12s } .dream-rise.d2 { animation-delay:.24s }
        .dream-rise.d3 { animation-delay:.36s } .dream-rise.d4 { animation-delay:.48s }
        .dream-glow { animation: dreamGlow 7s ease-in-out infinite }
        @media (prefers-reduced-motion: reduce) {
          .dream-rise, .dream-glow { animation: none }
        }
      `}</style>
      <Header />
      <DreamClient />
    </>
  );
}
