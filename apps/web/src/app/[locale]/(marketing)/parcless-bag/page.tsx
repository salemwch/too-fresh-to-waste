import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { Cormorant_Garamond } from 'next/font/google';
import { Header } from '@/components/layout';
import ParclessBagClient from './_components/ParclessBagClient';

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-cormorant',
  display: 'swap',
});

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Parcless Bag - Transformez vos surplus en revenus | Too Fresh To Waste',
    description:
      'Le Parcless Bag transforme vos invendus et surplus de production en revenus réels, tout en réduisant votre empreinte environnementale et en nourrissant des familles tunisiennes.',
  };
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
      <div className={cormorant.variable}>
        <ParclessBagClient />
      </div>
    </>
  );
}
