import { setRequestLocale } from 'next-intl/server';
import { PrintTrigger } from './PrintTrigger';
import { PrintButton } from './PrintButton';

interface PartnerKitPageProps {
  params: Promise<{ locale: string }>;
}

export default async function PartnerKitPage({ params }: PartnerKitPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <PrintTrigger />

      <div className='kit-root font-sans text-[#1E4448] bg-white'>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

          * { box-sizing: border-box; margin: 0; padding: 0; }

          body { background: white; }

          .kit-root {
            font-family: 'Inter', sans-serif;
            color: #1E4448;
            background: white;
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
            }
            .page:last-child { page-break-after: avoid; break-after: avoid; }
            @page {
              size: A4;
              margin: 0;
            }
          }

          @media screen {
            body { background: #f3f4f6; padding: 2rem; }
            .page { box-shadow: 0 4px 32px rgba(0,0,0,0.12); margin-bottom: 2rem; }
          }
        `}</style>

        {/* ── PRINT BUTTON (screen only) ─────────────────────────── */}
        <PrintButton />

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            PAGE 1 — COVER
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <div className='page' style={{ background: '#1E4448' }}>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'radial-gradient(ellipse at 80% 20%, rgba(255,121,115,0.18) 0%, transparent 60%)',
            }}
          />

          {/* Top bar */}
          <div
            style={{
              padding: '40px 48px 0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              position: 'relative',
              zIndex: 1,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: '#ff7973',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span style={{ color: '#1E4448', fontWeight: 700, fontSize: 14 }}>T</span>
              </div>
              <span
                style={{
                  color: 'rgba(249,243,240,0.85)',
                  fontSize: 13,
                  fontWeight: 500,
                  letterSpacing: '0.05em',
                }}
              >
                Too Fresh To Waste
              </span>
            </div>
            <span
              style={{
                color: 'rgba(249,243,240,0.45)',
                fontSize: 11,
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
              }}
            >
              Partner Kit · 2025
            </span>
          </div>

          {/* Cover body */}
          <div
            style={{
              padding: '0 48px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              minHeight: '220mm',
              position: 'relative',
              zIndex: 1,
            }}
          >
            <p
              style={{
                color: '#ff7973',
                fontSize: 11,
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                marginBottom: 28,
              }}
            >
              Confidential — For Partner Use
            </p>
            <h1
              style={{
                color: '#F9F3F0',
                fontSize: 68,
                fontWeight: 300,
                lineHeight: 0.9,
                letterSpacing: '-0.02em',
              }}
            >
              Turn Surplus
              <br />
              <em style={{ color: '#ff7973', fontStyle: 'italic' }}>Into Sales.</em>
            </h1>
            <div style={{ width: 60, height: 2, background: '#ff7973', margin: '36px 0' }} />
            <p
              style={{
                color: 'rgba(249,243,240,0.70)',
                fontSize: 18,
                fontWeight: 300,
                lineHeight: 1.7,
                maxWidth: 460,
              }}
            >
              A partnership with Too Fresh To Waste recovers real margin from unsold daily inventory
              — same day, same city, zero effort.
            </p>

            {/* Stats row */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 1,
                marginTop: 56,
                background: 'rgba(249,243,240,0.1)',
                borderRadius: 4,
                overflow: 'hidden',
              }}
            >
              {[
                { v: '40%', l: 'of food produced globally is wasted', src: 'WWF 2021' },
                { v: '91 kg', l: 'wasted per person/year in Tunisia', src: 'UNEP 2021' },
                { v: '49%', l: 'pay more for sustainable brands', src: 'IBM IBV 2022' },
              ].map((s, i) => (
                <div key={i} style={{ padding: '24px 20px', background: 'rgba(249,243,240,0.06)' }}>
                  <p style={{ color: '#F9F3F0', fontSize: 36, fontWeight: 300, lineHeight: 1 }}>
                    {s.v}
                  </p>
                  <p
                    style={{
                      color: 'rgba(249,243,240,0.65)',
                      fontSize: 12,
                      marginTop: 10,
                      lineHeight: 1.4,
                    }}
                  >
                    {s.l}
                  </p>
                  <p
                    style={{
                      color: '#ff7973',
                      fontSize: 10,
                      marginTop: 8,
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {s.src}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom */}
          <div
            style={{
              padding: '24px 48px',
              borderTop: '1px solid rgba(249,243,240,0.12)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              position: 'relative',
              zIndex: 1,
            }}
          >
            <span style={{ color: 'rgba(249,243,240,0.35)', fontSize: 11 }}>
              toofresh2waste.com
            </span>
            <span style={{ color: 'rgba(249,243,240,0.35)', fontSize: 11 }}>1 / 4</span>
          </div>
        </div>

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            PAGE 2 — THE PROBLEM + THE SOLUTION
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <div className='page'>
          <KitPageHeader title='The Problem — & The Solution' page={2} />

          <div style={{ padding: '0 48px 40px' }}>
            {/* Problem */}
            <div style={{ marginBottom: 36 }}>
              <SectionLabel label='The Problem' />
              <h2 style={{ fontSize: 36, fontWeight: 300, lineHeight: 1.1, marginBottom: 20 }}>
                Every day,{' '}
                <em style={{ fontStyle: 'italic', color: '#ff7973' }}>good food disappears</em>.
              </h2>

              <p style={{ fontSize: 14, lineHeight: 1.75, color: '#1E4448CC', marginBottom: 16 }}>
                Bakeries, restaurants, hotels, and supermarkets across Tunisia discard between{' '}
                <strong>10–20% of their daily production</strong> every evening — not because the
                food has gone bad, but because the shelf ran out of time.{' '}
                <SourceRef
                  href='https://wrap.org.uk/taking-action/food-drink/hospitality-food-service'
                  label='WRAP'
                />
              </p>

              <p style={{ fontSize: 14, lineHeight: 1.75, color: '#1E4448CC', marginBottom: 24 }}>
                Tunisia generates <strong>91 kg of food waste per person per year</strong>{' '}
                <SourceRef
                  href='https://www.unep.org/resources/report/unep-food-waste-index-report-2021'
                  label='UNEP 2021'
                />{' '}
                — above the global household average. Globally, food waste costs{' '}
                <strong>$1 trillion per year</strong>{' '}
                <SourceRef href='https://www.fao.org/3/i3991e/i3991e.pdf' label='FAO 2014' /> and
                drives <strong>10% of all greenhouse gas emissions</strong>{' '}
                <SourceRef
                  href='https://www.unep.org/resources/report/unep-food-waste-index-report-2021'
                  label='UNEP / WWF'
                />
                . Decomposing food in landfill emits methane — a gas{' '}
                <strong>80× more potent than CO₂</strong> over 20 years{' '}
                <SourceRef href='https://www.epa.gov/gmi/importance-methane' label='US EPA' />.
              </p>

              {/* Problem stat grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: 1,
                  background: '#e5e7eb',
                  borderRadius: 4,
                  overflow: 'hidden',
                }}
              >
                {[
                  { v: '10–20%', l: 'of daily bakery output discarded', src: 'WRAP' },
                  { v: '$1T', l: 'annual economic cost of food waste', src: 'FAO 2014' },
                  { v: '91 kg', l: 'wasted per Tunisian per year', src: 'UNEP 2021' },
                  { v: '80×', l: 'more warming than CO₂ (methane)', src: 'US EPA' },
                ].map((s, i) => (
                  <div key={i} style={{ padding: '20px 24px', background: '#F9F3F0' }}>
                    <p style={{ fontSize: 32, fontWeight: 300, color: '#1E4448', lineHeight: 1 }}>
                      {s.v}
                    </p>
                    <p style={{ fontSize: 12, color: '#1E4448AA', marginTop: 8, lineHeight: 1.4 }}>
                      {s.l}
                    </p>
                    <p
                      style={{
                        fontSize: 10,
                        color: '#ff7973',
                        marginTop: 6,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                      }}
                    >
                      {s.src}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Solution */}
            <div>
              <SectionLabel label='The Solution' />
              <h2 style={{ fontSize: 36, fontWeight: 300, lineHeight: 1.1, marginBottom: 20 }}>
                A marketplace for{' '}
                <em style={{ fontStyle: 'italic', color: '#ff7973' }}>last-minute surplus</em>.
              </h2>

              <p style={{ fontSize: 14, lineHeight: 1.75, color: '#1E4448CC', marginBottom: 20 }}>
                Too Fresh To Waste is a mobile marketplace that lets food businesses list unsold
                daily inventory as discounted <strong>&ldquo;Surprise Bags&rdquo;</strong> —
                discovered and reserved by local consumers in real time, picked up before closing.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                {[
                  {
                    n: '01',
                    t: 'List your surplus',
                    b: 'Create a Surprise Bag in 2 minutes — price, photo, pickup window.',
                  },
                  {
                    n: '02',
                    t: 'Customers reserve & pay',
                    b: 'Users on the TFTW app book and pay in-app. You get notified instantly.',
                  },
                  {
                    n: '03',
                    t: 'They pick up, you scan',
                    b: 'Scan their code. Bag handed over. Done. No admin, no chasing.',
                  },
                ].map(step => (
                  <div key={step.n} style={{ borderLeft: '2px solid #ff7973', paddingLeft: 14 }}>
                    <p
                      style={{
                        color: '#ff7973',
                        fontSize: 10,
                        fontWeight: 600,
                        letterSpacing: '0.1em',
                        marginBottom: 6,
                      }}
                    >
                      {step.n}
                    </p>
                    <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>{step.t}</p>
                    <p style={{ fontSize: 12, color: '#1E4448AA', lineHeight: 1.5 }}>{step.b}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <KitPageFooter page={2} />
        </div>

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            PAGE 3 — BENEFITS + WHY NOW + WHY TFTW
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <div className='page'>
          <KitPageHeader title='Benefits, Market Timing & Why Us' page={3} />

          <div style={{ padding: '0 48px 40px' }}>
            {/* Benefits */}
            <div style={{ marginBottom: 32 }}>
              <SectionLabel label='Partner Benefits' />
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 1,
                  background: '#e5e7eb',
                  borderRadius: 4,
                  overflow: 'hidden',
                }}
              >
                {[
                  {
                    icon: '💰',
                    t: 'Revenue from waste',
                    b: 'Recover margin on inventory you would have discarded. 50% of something beats 0% of nothing.',
                  },
                  {
                    icon: '📣',
                    t: 'Zero marketing effort',
                    b: 'Your surplus is visible to thousands of TFTW users searching nearby — instantly.',
                  },
                  {
                    icon: '🤝',
                    t: 'New loyal customers',
                    b: 'Surprise Bag buyers become regulars. Many return at full price once they discover a brand they love.',
                  },
                  {
                    icon: '🌿',
                    t: 'ESG & CSR reporting',
                    b: 'Every bag saved is tracked. Export carbon and waste-diversion data for sustainability reports.',
                  },
                  {
                    icon: '🗑️',
                    t: 'Lower disposal costs',
                    b: 'Less unsold stock going to landfill means smaller bins and fewer waste collection fees.',
                  },
                  {
                    icon: '📰',
                    t: 'Positive PR',
                    b: 'Your brand is featured as a sustainability partner — in-app, on our social channels, and in press.',
                  },
                ].map((b, i) => (
                  <div key={i} style={{ padding: '16px 18px', background: '#F9F3F0' }}>
                    <span style={{ fontSize: 20 }}>{b.icon}</span>
                    <p style={{ fontSize: 13, fontWeight: 600, marginTop: 8, marginBottom: 6 }}>
                      {b.t}
                    </p>
                    <p style={{ fontSize: 11, color: '#1E4448AA', lineHeight: 1.5 }}>{b.b}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Why now */}
            <div style={{ marginBottom: 32 }}>
              <SectionLabel label='Why Now?' />
              <p style={{ fontSize: 14, lineHeight: 1.7, color: '#1E4448CC', marginBottom: 16 }}>
                Regulatory pressure, consumer expectations, and competitive dynamics are converging.
                Early partners gain first-mover advantages — brand visibility, platform prominence,
                and customer relationships — that followers will have to buy their way into.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                {[
                  {
                    v: '49%',
                    l: 'of consumers say they pay more for demonstrably sustainable brands',
                    src: 'IBM IBV Consumer Study 2022',
                    href: 'https://www.ibm.com/thought-leadership/institute-business-value/en-us/report/2022-consumer-study',
                  },
                  {
                    v: '40%',
                    l: 'of all food produced globally is lost or wasted every year',
                    src: 'WWF Driven to Waste, 2021',
                    href: 'https://wwf.panda.org/wwf_news/?5131564/',
                  },
                ].map((w, i) => (
                  <div key={i} style={{ borderTop: '2px solid #1E4448', paddingTop: 14 }}>
                    <p style={{ fontSize: 36, fontWeight: 300, lineHeight: 1 }}>{w.v}</p>
                    <p style={{ fontSize: 12, color: '#1E4448AA', marginTop: 8, lineHeight: 1.5 }}>
                      {w.l}
                    </p>
                    <p
                      style={{
                        fontSize: 10,
                        color: '#ff7973',
                        marginTop: 8,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                      }}
                    >
                      {w.src}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Why TFTW */}
            <div>
              <SectionLabel label='Why Too Fresh To Waste?' />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                {[
                  {
                    t: 'Live in under 48 hours',
                    b: 'Onboarding is one call. Your first listing can go live the same week.',
                  },
                  {
                    t: 'Full-language support',
                    b: 'Platform, support, and communications in Arabic, French, and English.',
                  },
                  {
                    t: 'Real-time merchant dashboard',
                    b: 'Track bags sold, revenue recovered, CO₂ saved, and customer ratings.',
                  },
                  {
                    t: 'No exclusivity, no lock-in',
                    b: 'You remain free to use any other channel. We earn when you earn.',
                  },
                  {
                    t: 'Dedicated account support',
                    b: 'A real person, reachable directly. Not a ticket queue.',
                  },
                  {
                    t: 'Built for Tunisia',
                    b: 'We are not adapting a European model. We built for the Tunisian food market from day one.',
                  },
                ].map((item, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      gap: 10,
                      paddingBottom: 10,
                      borderBottom: '1px solid #e5e7eb',
                    }}
                  >
                    <span style={{ color: '#ff7973', marginTop: 2, fontSize: 8 }}>●</span>
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 2 }}>{item.t}</p>
                      <p style={{ fontSize: 11, color: '#1E4448AA', lineHeight: 1.45 }}>{item.b}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <KitPageFooter page={3} />
        </div>

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            PAGE 4 — FOUNDING PARTNERS + NEXT STEPS
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <div className='page'>
          <KitPageHeader title='Founding Partners & Next Steps' page={4} />

          <div style={{ padding: '0 48px 40px' }}>
            {/* Founding partners */}
            <div style={{ marginBottom: 40 }}>
              <SectionLabel label='Founding Partners' />
              <h2 style={{ fontSize: 32, fontWeight: 300, lineHeight: 1.1, marginBottom: 8 }}>
                They moved first.
              </h2>
              <p style={{ fontSize: 14, lineHeight: 1.75, color: '#1E4448CC', marginBottom: 24 }}>
                These brands believed in the mission before we had scale. They helped us build the
                product, prove the model, and set the standard for what a TFTW partner looks like.
              </p>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: 1,
                  background: '#e5e7eb',
                  borderRadius: 4,
                  overflow: 'hidden',
                  marginBottom: 24,
                }}
              >
                {[
                  {
                    name: 'Bonépi',
                    cat: 'Premium Patisserie & Bakery',
                    detail:
                      'A benchmark for quality in the Tunis pastry market. Bonépi joined TFTW to put its commitment to craftsmanship into environmental action.',
                  },
                  {
                    name: 'BigBen',
                    cat: 'Fast Food & Café Chain',
                    detail:
                      'One of the most recognized café and fast-food brands in Tunisia. BigBen uses TFTW to reduce end-of-day surplus across multiple locations.',
                  },
                  {
                    name: "L'Opéra",
                    cat: 'Established Restaurant',
                    detail:
                      "A Tunis dining institution. L'Opéra brings TFTW access to restaurant-quality meals at end-of-service prices — a new audience for a beloved brand.",
                  },
                  {
                    name: 'Kohn',
                    cat: 'Fine Dining & Bakery',
                    detail:
                      'Kohn is known for premium quality and uncompromising standards. Partnering with TFTW lets Kohn recover value while staying true to a zero-waste commitment.',
                  },
                ].map((p, i) => (
                  <div key={i} style={{ padding: '20px 24px', background: '#F9F3F0' }}>
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}
                    >
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: '50%',
                          background: 'rgba(255,121,115,0.15)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <span style={{ color: '#ff7973', fontWeight: 700, fontSize: 15 }}>
                          {p.name.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <p style={{ fontSize: 18, fontWeight: 600 }}>{p.name}</p>
                        <p style={{ fontSize: 11, color: '#1E4448AA' }}>{p.cat}</p>
                      </div>
                    </div>
                    <p style={{ fontSize: 12, color: '#1E4448BB', lineHeight: 1.55 }}>{p.detail}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Next steps */}
            <div style={{ marginBottom: 40 }}>
              <SectionLabel label='Next Steps' />
              <h2 style={{ fontSize: 32, fontWeight: 300, lineHeight: 1.1, marginBottom: 20 }}>
                Ready when you are.
              </h2>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 12,
                  marginBottom: 28,
                }}
              >
                {[
                  {
                    step: '1',
                    t: 'Intro call (30 min)',
                    b: 'We walk through the platform, answer your questions, and agree on a pilot scope.',
                  },
                  {
                    step: '2',
                    t: 'Onboarding (48 h)',
                    b: 'We set up your merchant profile, train your team, and make your first listing live.',
                  },
                  {
                    step: '3',
                    t: 'First bag sold',
                    b: 'You recover your first sale from inventory you would have discarded. We iterate from there.',
                  },
                ].map(s => (
                  <div key={s.step} style={{ borderTop: '2px solid #ff7973', paddingTop: 14 }}>
                    <p
                      style={{
                        color: '#ff7973',
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: '0.1em',
                        marginBottom: 6,
                      }}
                    >
                      STEP {s.step}
                    </p>
                    <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>{s.t}</p>
                    <p style={{ fontSize: 12, color: '#1E4448AA', lineHeight: 1.5 }}>{s.b}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Contact */}
            <div
              style={{
                background: '#1E4448',
                borderRadius: 6,
                padding: '28px 32px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <p
                  style={{
                    color: 'rgba(249,243,240,0.60)',
                    fontSize: 11,
                    letterSpacing: '0.15em',
                    textTransform: 'uppercase',
                    marginBottom: 8,
                  }}
                >
                  Get in touch
                </p>
                <p style={{ color: '#F9F3F0', fontSize: 22, fontWeight: 300 }}>
                  Let&rsquo;s start with a conversation.
                </p>
                <p style={{ color: 'rgba(249,243,240,0.60)', fontSize: 13, marginTop: 6 }}>
                  toofresh2waste.com · hello@toofresh2waste.com
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p
                  style={{
                    color: '#ff7973',
                    fontSize: 11,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                  }}
                >
                  Tunisia
                </p>
                <p style={{ color: 'rgba(249,243,240,0.50)', fontSize: 11, marginTop: 4 }}>
                  Tunis · 2025
                </p>
              </div>
            </div>
          </div>

          <KitPageFooter page={4} last />
        </div>
      </div>
    </>
  );
}

/* ── Small helper components ──────────────────────────────────── */

function KitPageHeader({ title }: { title: string; page: number }) {
  return (
    <div
      style={{
        padding: '32px 48px 24px',
        borderBottom: '1px solid #e5e7eb',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: '50%',
            background: '#ff7973',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <span style={{ color: '#1E4448', fontWeight: 700, fontSize: 11 }}>T</span>
        </div>
        <span style={{ fontSize: 11, color: '#1E4448AA', letterSpacing: '0.05em' }}>
          Too Fresh To Waste — Partner Kit
        </span>
      </div>
      <span style={{ fontSize: 11, color: '#1E4448AA' }}>{title}</span>
    </div>
  );
}

function KitPageFooter({ page, last }: { page: number; last?: boolean }) {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '16px 48px',
        borderTop: '1px solid #e5e7eb',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <span style={{ fontSize: 10, color: '#1E4448AA' }}>
        Confidential — Too Fresh To Waste Partner Programme · 2025
      </span>
      <span style={{ fontSize: 10, color: '#1E4448AA' }}>
        {page} / 4{last ? ' — End of Document' : ''}
      </span>
    </div>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <p
      style={{
        color: '#ff7973',
        fontSize: 10,
        letterSpacing: '0.20em',
        textTransform: 'uppercase',
        marginBottom: 12,
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
      style={{ color: '#ff7973', fontSize: 11, textDecoration: 'none' }}
    >
      [{label}]
    </a>
  );
}
