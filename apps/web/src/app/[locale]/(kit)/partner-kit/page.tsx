import type { Metadata } from 'next';
import Image from 'next/image';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { buildPageMetadata } from '@/lib/seo-metadata';

import type { Locale } from '@/i18n/config';
import { PrintTrigger } from './PrintTrigger';
import { PrintButton } from './PrintButton';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'partnerKit' });
  return buildPageMetadata({
    path: '/partner-kit',
    locale: locale as Locale,
    title: t('meta.title'),
    description: t('meta.description'),
  });
}

interface PartnerKitPageProps {
  params: Promise<{ locale: string }>;
}

/** Paired by index with `benefits` in the messages. */
const BENEFIT_EMOJI = ['💰', '📣', '🔁', '📊', '🗑️', '📰'] as const;

/**
 * Brand names and their categories, paired by index with  in
 * the messages. Bonépi is Bonépi in every language; the blurb is ours.
 */
const FOUNDING_PARTNERS = [
  { name: 'Bonépi', cat: 'Premium Patisserie & Bakery' },
  { name: 'BigBen', cat: 'Fast Food & Café Chain' },
  { name: "L'Opéra", cat: 'Established Restaurant' },
  { name: 'Kohn', cat: 'Fine Dining & Bakery' },
] as const;

interface KitStat {
  value: string;
  label: string;
  source: string;
}
interface KitStep {
  n: string;
  title: string;
  body: string;
}
interface KitPoint {
  title: string;
  body: string;
}

export default async function PartnerKitPage({ params }: PartnerKitPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'partnerKit' });

  const coverStats = t.raw('coverStats') as KitStat[];
  const problemStats = t.raw('problemStats') as KitStat[];
  const whyNowStats = t.raw('whyNowStats') as KitStat[];
  const steps = t.raw('steps') as KitStep[];
  const benefits = t.raw('benefits') as KitPoint[];
  const whyUs = t.raw('whyUs') as KitPoint[];
  const nextSteps = t.raw('nextSteps.items') as KitPoint[];
  const foundingBlurbs = t.raw('foundingBlurbs') as string[];

  return (
    <>
      <PrintTrigger />

      <div className='kit-root font-sans text-[#1E4448] bg-white'>
        <style>{`
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { background: white; }

          .kit-root {
            font-family: var(--font-quicksand), system-ui, sans-serif;
            color: #1E4448;
            background: white;
            /* Force background colors to print */
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .page {
            width: 210mm;
            min-height: 297mm;
            margin: 0 auto;
            background: white;
            position: relative;
            overflow: hidden;
          }

          .page + .page {
            border-top: 2px dashed #e5e7eb;
            margin-top: 2rem;
          }

          @media print {
            html, body { background: white !important; }
            .no-print { display: none !important; }
            .page {
              width: 210mm;
              min-height: 297mm;
              margin: 0;
              page-break-after: always;
              break-after: page;
              border: none !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .page:last-child { page-break-after: avoid; break-after: avoid; }
            @page { size: A4; margin: 0; }
          }

          @media screen {
            body { background: #f3f4f6; padding: 2rem; }
            .page { box-shadow: 0 4px 32px rgba(0,0,0,0.12); margin-bottom: 2rem; }
          }
        `}</style>

        <PrintButton />

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            PAGE 1 — COVER (white background, dark text)
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <div className='page' style={{ background: 'white' }}>
          {/* Left brand stripe */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: 8,
              height: '100%',
              background: '#1E4448',
            }}
          />

          {/* Top coral accent line */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 8,
              right: 0,
              height: 3,
              background: '#017C6E',
            }}
          />

          {/* Top bar */}
          <div
            style={{
              padding: '36px 48px 0 40px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Image
                src='/images/green-leaf-logo.png'
                alt='Too Fresh To Waste'
                width={30}
                height={30}
                style={{ objectFit: 'contain' }}
              />
              <span
                style={{ color: '#1E4448', fontSize: 13, fontWeight: 600, letterSpacing: '0.04em' }}
              >
                Too Fresh To Waste
              </span>
            </div>
            <span
              style={{
                color: '#1E4448',
                fontSize: 10,
                letterSpacing: '0.20em',
                textTransform: 'uppercase',
                opacity: 0.45,
              }}
            >
              {t('cover.kitLabel')}
            </span>
          </div>

          {/* Cover body */}
          <div
            style={{
              padding: '0 48px 0 40px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              minHeight: '220mm',
            }}
          >
            <p
              style={{
                color: '#017C6E',
                fontSize: 10,
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                marginBottom: 32,
              }}
            >
              {t('cover.confidential')}
            </p>

            <h1
              style={{
                color: '#1E4448',
                fontSize: 72,
                fontWeight: 300,
                lineHeight: 0.92,
                letterSpacing: '-0.02em',
              }}
            >
              {t('cover.titleStart')}
              <br />
              <em style={{ color: '#017C6E', fontStyle: 'italic' }}>{t('cover.titleEm')}</em>
            </h1>

            <div style={{ width: 56, height: 2, background: '#017C6E', margin: '32px 0' }} />

            <p
              style={{
                color: '#1E4448',
                fontSize: 17,
                fontWeight: 300,
                lineHeight: 1.75,
                maxWidth: 460,
                opacity: 0.72,
              }}
            >
              {t('cover.lede')}
            </p>

            {/* Stats grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 12,
                marginTop: 52,
              }}
            >
              {coverStats.map((s, i) => (
                <div
                  key={i}
                  style={{
                    padding: '20px 18px',
                    background: '#F9F3F0',
                    borderTop: '2px solid #1E4448',
                  }}
                >
                  <p style={{ color: '#1E4448', fontSize: 38, fontWeight: 300, lineHeight: 1 }}>
                    {s.value}
                  </p>
                  <p
                    style={{
                      color: '#1E4448',
                      fontSize: 11,
                      marginTop: 10,
                      lineHeight: 1.4,
                      opacity: 0.65,
                    }}
                  >
                    {s.label}
                  </p>
                  <p
                    style={{
                      color: '#017C6E',
                      fontSize: 9,
                      marginTop: 8,
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {s.source}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom bar */}
          <div
            style={{
              padding: '20px 48px 20px 40px',
              borderTop: '1px solid #e5e7eb',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ fontSize: 10, color: '#1E4448', opacity: 0.35 }}>
              toofreshtowaste.com
            </span>
            <span style={{ fontSize: 10, color: '#1E4448', opacity: 0.35 }}>1 / 4</span>
          </div>
        </div>

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            PAGE 2 — THE PROBLEM + THE SOLUTION
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <div className='page'>
          <KitPageHeader title={t('pages.problemSolution')} page={2} brand={t('footer.short')} />

          <div style={{ padding: '0 48px 40px' }}>
            <div style={{ marginBottom: 36 }}>
              <SectionLabel label='The Problem' />
              <h2 style={{ fontSize: 34, fontWeight: 300, lineHeight: 1.1, marginBottom: 20 }}>
                Every day,{' '}
                <em style={{ fontStyle: 'italic', color: '#017C6E' }}>good food disappears</em>.
              </h2>

              <p
                style={{
                  fontSize: 13,
                  lineHeight: 1.8,
                  color: '#1E4448',
                  opacity: 0.75,
                  marginBottom: 14,
                }}
              >
                Bakeries, restaurants, hotels, and supermarkets across Tunisia discard between{' '}
                <strong style={{ opacity: 1, color: '#1E4448' }}>
                  10–20% of their daily production
                </strong>{' '}
                every evening — not because the food has gone bad, but because the shelf ran out of
                time.{' '}
                <SourceRef
                  href='https://wrap.org.uk/taking-action/food-drink/hospitality-food-service'
                  label='WRAP'
                />
              </p>

              <p
                style={{
                  fontSize: 13,
                  lineHeight: 1.8,
                  color: '#1E4448',
                  opacity: 0.75,
                  marginBottom: 24,
                }}
              >
                Tunisia generates{' '}
                <strong style={{ opacity: 1, color: '#1E4448' }}>
                  172 kg of food waste per person per year
                </strong>{' '}
                <SourceRef
                  href='https://www.unep.org/resources/publication/food-waste-index-report-2024'
                  label='UNEP 2024'
                />{' '}
                — above the global average. Food waste costs{' '}
                <strong style={{ opacity: 1, color: '#1E4448' }}>$1 trillion per year</strong>{' '}
                <SourceRef href='https://www.fao.org/3/i3991e/i3991e.pdf' label='FAO 2014' /> and
                drives{' '}
                <strong style={{ opacity: 1, color: '#1E4448' }}>
                  10% of global GHG emissions
                </strong>{' '}
                <SourceRef
                  href='https://www.unep.org/resources/report/unep-food-waste-index-report-2021'
                  label='UNEP'
                />
                . Decomposing food emits methane —{' '}
                <strong style={{ opacity: 1, color: '#1E4448' }}>80× more potent than CO₂</strong>{' '}
                <SourceRef href='https://www.epa.gov/gmi/importance-methane' label='US EPA' />.
              </p>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: 10,
                }}
              >
                {problemStats.map((s, i) => (
                  <div key={i} style={{ borderTop: '2px solid #1E4448', paddingTop: 12 }}>
                    <p style={{ fontSize: 26, fontWeight: 300, color: '#1E4448', lineHeight: 1 }}>
                      {s.value}
                    </p>
                    <p
                      style={{
                        fontSize: 11,
                        color: '#1E4448',
                        opacity: 0.55,
                        marginTop: 6,
                        lineHeight: 1.4,
                      }}
                    >
                      {s.label}
                    </p>
                    <p
                      style={{
                        fontSize: 9,
                        color: '#017C6E',
                        marginTop: 5,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                      }}
                    >
                      {s.source}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <SectionLabel label='The Solution' />
              <h2 style={{ fontSize: 34, fontWeight: 300, lineHeight: 1.1, marginBottom: 16 }}>
                A marketplace for{' '}
                <em style={{ fontStyle: 'italic', color: '#017C6E' }}>last-minute surplus</em>.
              </h2>

              <p
                style={{
                  fontSize: 13,
                  lineHeight: 1.8,
                  color: '#1E4448',
                  opacity: 0.75,
                  marginBottom: 20,
                }}
              >
                Too Fresh To Waste lets food businesses list unsold daily inventory as discounted{' '}
                <strong style={{ color: '#1E4448', opacity: 1 }}>
                  &ldquo;Surprise Bags&rdquo;
                </strong>{' '}
                — discovered and reserved by local consumers in real time, picked up before closing.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
                {steps.map(step => (
                  <div key={step.n} style={{ borderLeft: '3px solid #017C6E', paddingLeft: 14 }}>
                    <p
                      style={{
                        color: '#017C6E',
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: '0.1em',
                        marginBottom: 6,
                      }}
                    >
                      {step.n}
                    </p>
                    <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 5, color: '#1E4448' }}>
                      {step.title}
                    </p>
                    <p style={{ fontSize: 11, color: '#1E4448', opacity: 0.6, lineHeight: 1.55 }}>
                      {step.body}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <KitPageFooter page={2} note={t('footer.long')} endLabel={t('footer.endOfDocument')} />
        </div>

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            PAGE 3 — BENEFITS + WHY NOW + WHY TFTW
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <div className='page'>
          <KitPageHeader title={t('pages.benefits')} page={3} brand={t('footer.short')} />

          <div style={{ padding: '0 48px 40px' }}>
            <div style={{ marginBottom: 28 }}>
              <SectionLabel label='Partner Benefits' />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                {benefits.map((b, i) => (
                  <div
                    key={i}
                    style={{
                      padding: '14px 16px',
                      background: '#F9F3F0',
                      borderTop: '2px solid #1E4448',
                    }}
                  >
                    <span style={{ fontSize: 18 }}>{BENEFIT_EMOJI[i] ?? BENEFIT_EMOJI[0]}</span>
                    <p
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        marginTop: 7,
                        marginBottom: 5,
                        color: '#1E4448',
                      }}
                    >
                      {b.title}
                    </p>
                    <p style={{ fontSize: 10, color: '#1E4448', opacity: 0.6, lineHeight: 1.5 }}>
                      {b.body}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 28 }}>
              <SectionLabel label='Why Now?' />
              <p
                style={{
                  fontSize: 13,
                  lineHeight: 1.75,
                  color: '#1E4448',
                  opacity: 0.72,
                  marginBottom: 14,
                }}
              >
                Regulatory pressure, consumer expectations, and competitive dynamics are converging.
                Early partners gain first-mover advantages that followers will have to buy their way
                into.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
                {whyNowStats.map((w, i) => (
                  <div key={i} style={{ borderTop: '2px solid #1E4448', paddingTop: 12 }}>
                    <p style={{ fontSize: 36, fontWeight: 300, lineHeight: 1, color: '#1E4448' }}>
                      {w.value}
                    </p>
                    <p
                      style={{
                        fontSize: 11,
                        color: '#1E4448',
                        opacity: 0.6,
                        marginTop: 8,
                        lineHeight: 1.5,
                      }}
                    >
                      {w.label}
                    </p>
                    <p
                      style={{
                        fontSize: 9,
                        color: '#017C6E',
                        marginTop: 6,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                      }}
                    >
                      {w.source}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <SectionLabel label='Why Too Fresh To Waste?' />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                {whyUs.map((item, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      gap: 10,
                      paddingBottom: 9,
                      borderBottom: '1px solid #e5e7eb',
                    }}
                  >
                    <span style={{ color: '#017C6E', marginTop: 2, fontSize: 8, flexShrink: 0 }}>
                      ●
                    </span>
                    <div>
                      <p
                        style={{ fontSize: 12, fontWeight: 600, marginBottom: 2, color: '#1E4448' }}
                      >
                        {item.title}
                      </p>
                      <p
                        style={{ fontSize: 10, color: '#1E4448', opacity: 0.55, lineHeight: 1.45 }}
                      >
                        {item.body}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <KitPageFooter page={3} note={t('footer.long')} endLabel={t('footer.endOfDocument')} />
        </div>

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            PAGE 4 — FOUNDING PARTNERS + NEXT STEPS
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <div className='page'>
          <KitPageHeader title={t('pages.partnersNextSteps')} page={4} brand={t('footer.short')} />

          <div style={{ padding: '0 48px 40px' }}>
            <div style={{ marginBottom: 36 }}>
              <SectionLabel label='Founding Partners' />
              <h2 style={{ fontSize: 30, fontWeight: 300, lineHeight: 1.1, marginBottom: 8 }}>
                They moved first.
              </h2>
              <p
                style={{
                  fontSize: 13,
                  lineHeight: 1.75,
                  color: '#1E4448',
                  opacity: 0.7,
                  marginBottom: 20,
                }}
              >
                These brands believed in the mission before we had scale. They helped us build the
                product, prove the model, and set the standard for what a TFTW partner looks like.
              </p>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: 10,
                  marginBottom: 24,
                }}
              >
                {FOUNDING_PARTNERS.map((p, i) => (
                  <div
                    key={i}
                    style={{
                      padding: '16px 20px',
                      background: '#F9F3F0',
                      borderTop: '2px solid #1E4448',
                    }}
                  >
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}
                    >
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          border: '1.5px solid #017C6E',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <span style={{ color: '#017C6E', fontWeight: 700, fontSize: 13 }}>
                          {p.name.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <p style={{ fontSize: 16, fontWeight: 600, color: '#1E4448' }}>{p.name}</p>
                        <p style={{ fontSize: 10, color: '#1E4448', opacity: 0.55 }}>{p.cat}</p>
                      </div>
                    </div>
                    <p style={{ fontSize: 11, color: '#1E4448', opacity: 0.65, lineHeight: 1.55 }}>
                      {foundingBlurbs[i]}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 32 }}>
              <SectionLabel label={t('nextSteps.label')} />
              <h2 style={{ fontSize: 28, fontWeight: 300, lineHeight: 1.1, marginBottom: 18 }}>
                {t('nextSteps.title')}
              </h2>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 14,
                  marginBottom: 28,
                }}
              >
                {nextSteps.map((s, i) => (
                  <div key={s.title} style={{ borderTop: '2px solid #017C6E', paddingTop: 12 }}>
                    <p
                      style={{
                        color: '#017C6E',
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: '0.1em',
                        marginBottom: 5,
                      }}
                    >
                      {t('nextSteps.stepLabel', { n: i + 1 })}
                    </p>
                    <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 5, color: '#1E4448' }}>
                      {s.title}
                    </p>
                    <p style={{ fontSize: 11, color: '#1E4448', opacity: 0.6, lineHeight: 1.5 }}>
                      {s.body}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Contact block — white bg, bordered */}
            <div
              style={{
                border: '2px solid #1E4448',
                borderRadius: 4,
                padding: '24px 28px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* left coral accent */}
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: 5,
                  background: '#017C6E',
                }}
              />
              <div style={{ paddingLeft: 12 }}>
                <p
                  style={{
                    color: '#017C6E',
                    fontSize: 10,
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                    marginBottom: 8,
                  }}
                >
                  {t('contact.label')}
                </p>
                <p style={{ color: '#1E4448', fontSize: 20, fontWeight: 300 }}>
                  {t('contact.title')}
                </p>
                <p style={{ color: '#1E4448', fontSize: 12, marginTop: 6, opacity: 0.6 }}>
                  toofreshtowaste.com · contact@toofreshtowaste.com
                </p>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <p
                  style={{
                    color: '#1E4448',
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                  }}
                >
                  Tunisia
                </p>
                <p style={{ color: '#1E4448', fontSize: 11, marginTop: 4, opacity: 0.45 }}>
                  {t('contact.place')}
                </p>
              </div>
            </div>
          </div>

          <KitPageFooter
            page={4}
            last
            note={t('footer.long')}
            endLabel={t('footer.endOfDocument')}
          />
        </div>
      </div>
    </>
  );
}

/* ── Helper components ────────────────────────────────────────── */

function KitPageHeader({ title, brand }: { title: string; page: number; brand: string }) {
  return (
    <div
      style={{
        padding: '28px 48px 20px',
        borderBottom: '1px solid #e5e7eb',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Image
          src='/images/green-leaf-logo.png'
          alt='Too Fresh To Waste'
          width={20}
          height={20}
          style={{ objectFit: 'contain', flexShrink: 0 }}
        />
        <span style={{ fontSize: 10, color: '#1E4448', opacity: 0.55, letterSpacing: '0.05em' }}>
          {brand}
        </span>
      </div>
      <span style={{ fontSize: 10, color: '#1E4448', opacity: 0.45 }}>{title}</span>
    </div>
  );
}

function KitPageFooter({
  page,
  last,
  note,
  endLabel,
}: {
  page: number;
  last?: boolean;
  note: string;
  endLabel: string;
}) {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '14px 48px',
        borderTop: '1px solid #e5e7eb',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <span style={{ fontSize: 9, color: '#1E4448', opacity: 0.35 }}>{note}</span>
      <span style={{ fontSize: 9, color: '#1E4448', opacity: 0.35 }}>
        {page} / 4{last ? ` - ${endLabel}` : ''}
      </span>
    </div>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <p
      style={{
        color: '#017C6E',
        fontSize: 9,
        letterSpacing: '0.22em',
        textTransform: 'uppercase',
        marginBottom: 10,
      }}
    >
      {label}
    </p>
  );
}

function SourceRef({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target='_blank'
      rel='noopener noreferrer'
      style={{ color: '#017C6E', fontSize: 10, textDecoration: 'none' }}
    >
      [{label}]
    </a>
  );
}
