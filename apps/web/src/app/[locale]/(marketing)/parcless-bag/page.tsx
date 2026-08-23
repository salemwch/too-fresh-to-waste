import type { Metadata } from 'next';
import { buildPageMetadata } from '@/lib/seo-metadata';

import type { Locale } from '@/i18n/config';
import { setRequestLocale } from 'next-intl/server';
import { Header } from '@/components/layout';
import ParclessBagClient from './_components/ParclessBagClient';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  return buildPageMetadata({
    path: '/parcless-bag',
    locale: locale as Locale,
    title: 'Parcless Bag - Transformez vos surplus en revenus | Too Fresh To Waste',
    description:
      'Le Parcless Bag transforme vos invendus et surplus de production en revenus réels, tout en réduisant votre empreinte environnementale et en nourrissant des familles tunisiennes.',
  });
}

export default async function ParclessBagPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      {/* Scoped keyframes + scroll-reveal helpers for this page only */}
      <style>{`
        @keyframes fadeUp    { from{opacity:0;transform:translateY(28px)} to{opacity:1;transform:none} }
        @keyframes fadeIn    { from{opacity:0} to{opacity:1} }
        @keyframes floatItem { 0%,100%{transform:translateY(0) rotate(0deg)} 50%{transform:translateY(-11px) rotate(4deg)} }
        @keyframes marqueeScroll { from{transform:translateX(0)} to{transform:translateX(-50%)} }
        @keyframes slideLight    { from{transform:translateX(-100%)} to{transform:translateX(200%)} }
        .rv{opacity:0;transform:translateY(36px);transition:opacity .7s cubic-bezier(.25,.46,.45,.94),transform .7s cubic-bezier(.25,.46,.45,.94)}
        .rv.in{opacity:1;transform:none}
        .rv.d1{transition-delay:.1s}.rv.d2{transition-delay:.2s}.rv.d3{transition-delay:.3s}.rv.d4{transition-delay:.4s}
      `}</style>
      <Header />
      <ParclessBagClient />
    </>
  );
}
