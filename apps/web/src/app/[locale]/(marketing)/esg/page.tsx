import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { Header } from '@/components/layout';
import { Link } from '@/i18n/routing';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'ESG — Why It Matters for Your Business | Too Fresh To Waste',
    description:
      'Understand what ESG is, why EU regulations like CBAM and CSRD make it mandatory, and how Tunisian companies can use food waste reduction to build a credible ESG strategy.',
  };
}

// ── SVG icons ─────────────────────────────────────────────────────────────────

function LeafIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth={1.8}
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
      aria-hidden='true'
    >
      <path d='M11 20A7 7 0 014 13c0-5 4-9 8-11 4 2 8 6 8 11a7 7 0 01-7 7c-1 0-1.4-.1-2-.3' />
      <path d='M12 9c0 5-4 9-8 11' />
    </svg>
  );
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth={1.8}
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
      aria-hidden='true'
    >
      <path d='M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2' />
      <circle cx='9' cy='7' r='4' />
      <path d='M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75' />
    </svg>
  );
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth={1.8}
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
      aria-hidden='true'
    >
      <path d='M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' />
    </svg>
  );
}

function AlertTriangleIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth={1.8}
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
      aria-hidden='true'
    >
      <path d='M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z' />
      <line x1='12' y1='9' x2='12' y2='13' />
      <line x1='12' y1='17' x2='12.01' y2='17' />
    </svg>
  );
}

function TrendingUpIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth={1.8}
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
      aria-hidden='true'
    >
      <polyline points='23 6 13.5 15.5 8.5 10.5 1 18' />
      <polyline points='17 6 23 6 23 12' />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox='0 0 20 20' fill='currentColor' className={className} aria-hidden='true'>
      <path
        fillRule='evenodd'
        d='M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z'
        clipRule='evenodd'
      />
    </svg>
  );
}

function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth={2}
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
      aria-hidden='true'
    >
      <path d='M5 12h14M12 5l7 7-7 7' />
    </svg>
  );
}

function ScaleIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth={1.8}
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
      aria-hidden='true'
    >
      <path d='M12 3v18M3 9l9-6 9 6M3 9l4 8a5 5 0 0010 0l4-8' />
    </svg>
  );
}

function BriefcaseIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth={1.8}
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
      aria-hidden='true'
    >
      <rect x='2' y='7' width='20' height='14' rx='2' ry='2' />
      <path d='M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16' />
    </svg>
  );
}

function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth={1.8}
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
      aria-hidden='true'
    >
      <circle cx='12' cy='12' r='10' />
      <path d='M2 12h20M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20' />
    </svg>
  );
}

function ZapIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth={1.8}
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
      aria-hidden='true'
    >
      <polygon points='13 2 3 14 12 14 11 22 21 10 12 10 13 2' />
    </svg>
  );
}

// ── Static data ───────────────────────────────────────────────────────────────

const esgPillars = [
  {
    letter: 'E',
    label: 'Environmental',
    icon: LeafIcon,
    color: 'text-primary-500',
    bg: 'bg-primary-500/10',
    border: 'border-primary-500/20',
    accent: 'bg-primary-500',
    headline: 'Your footprint on the planet.',
    body: "Carbon emissions, energy consumption, water usage, waste management, biodiversity impact, and your supply chain's environmental trail. Investors and regulators are now demanding hard numbers — not promises.",
    metrics: [
      'CO₂ & GHG emissions',
      'Energy & water consumption',
      'Waste diverted from landfill',
      'Supply chain carbon footprint',
    ],
  },
  {
    letter: 'S',
    label: 'Social',
    icon: UsersIcon,
    color: 'text-brand-coral',
    bg: 'bg-brand-coral/10',
    border: 'border-brand-coral/20',
    accent: 'bg-brand-coral',
    headline: 'Your impact on people.',
    body: 'Working conditions, fair wages, diversity and inclusion, community investment, human rights in the supply chain, and how your business treats every person it touches — from employee to end customer.',
    metrics: [
      'Employee wellbeing & diversity',
      'Community investment',
      'Supply chain labor rights',
      'Customer data protection',
    ],
  },
  {
    letter: 'G',
    label: 'Governance',
    icon: ShieldIcon,
    color: 'text-secondary-dark',
    bg: 'bg-secondary-dark/10',
    border: 'border-secondary-dark/20',
    accent: 'bg-secondary-dark',
    headline: 'How you run the business.',
    body: "Board independence, executive pay transparency, anti-corruption policies, ethical supply chains, audit quality, and whether your company can be trusted with other people's money and the planet's resources.",
    metrics: [
      'Board diversity & independence',
      'Anti-bribery & corruption',
      'Transparent financial reporting',
      'Executive pay ratio disclosure',
    ],
  },
];

const euRegulations = [
  {
    code: 'CBAM',
    full: 'Carbon Border Adjustment Mechanism',
    status: 'In force',
    statusColor: 'text-brand-coral bg-brand-coral/10 border-brand-coral/20',
    deadline: 'Full enforcement: 2026',
    flag: '🇪🇺',
    summary:
      'The EU now charges a carbon price on imported goods — cement, steel, aluminium, fertilisers, electricity, and hydrogen. If your product enters Europe and you cannot prove a low carbon footprint, your buyer pays the carbon tax. The more carbon in your product, the higher the cost — making high-emission Tunisian exporters structurally less competitive overnight.',
    impact:
      'Exporters to Europe who cannot document their emissions are losing contracts to greener competitors. CBAM is a permanent, escalating cost on carbon-heavy supply chains.',
    urgency: 'Immediate',
  },
  {
    code: 'CSRD',
    full: 'Corporate Sustainability Reporting Directive',
    status: 'Phase-in 2024–2028',
    statusColor: 'text-secondary-dark bg-secondary-dark/10 border-secondary-dark/20',
    deadline: 'Large companies: 2025 reports',
    flag: '🇪🇺',
    summary:
      'Over 50,000 EU companies — and their entire supply chains — must now publish detailed, audited sustainability reports. If you supply or partner with a European business, they will ask you for your ESG data. Without it, you lose the contract. The CSRD reaches deep into supplier relationships across MENA and Africa.',
    impact:
      'If you supply to EU companies or seek European investment, your ESG data is now a contractual requirement — not a "nice to have."',
    urgency: 'High',
  },
  {
    code: 'EU Taxonomy',
    full: 'EU Sustainable Finance Taxonomy',
    status: 'Active',
    statusColor: 'text-primary-500 bg-primary-500/10 border-primary-500/20',
    deadline: 'Ongoing classification',
    flag: '🇪🇺',
    summary:
      'A classification system that defines which economic activities are "green" for investment purposes. European banks and funds can only channel capital marked as "sustainable" into activities that qualify under the Taxonomy. This reshapes where money flows — and which businesses get funded at what cost.',
    impact:
      'If your business activity is not classifiable as sustainable under EU Taxonomy, access to green finance — increasingly the cheapest source of capital — is blocked.',
    urgency: 'Medium',
  },
  {
    code: 'CSDDD',
    full: 'Corporate Sustainability Due Diligence Directive',
    status: 'Adopted 2024',
    statusColor: 'text-brand-coral bg-brand-coral/10 border-brand-coral/20',
    deadline: 'Transposition by 2026',
    flag: '🇪🇺',
    summary:
      'Large EU companies are now legally liable for human rights and environmental violations anywhere in their supply chain — including in Tunisia, Morocco, Egypt, and across Africa. If your factory has poor labor conditions or high emissions, your EU client could face legal action for doing business with you.',
    impact:
      'Tunisian suppliers who cannot demonstrate compliant environmental and labor practices risk being cut from EU supply chains entirely.',
    urgency: 'High',
  },
  {
    code: 'SFDR',
    full: 'Sustainable Finance Disclosure Regulation',
    status: 'In force',
    statusColor: 'text-primary-500 bg-primary-500/10 border-primary-500/20',
    deadline: 'Ongoing',
    flag: '🇪🇺',
    summary:
      'European institutional investors — pension funds, insurance firms, asset managers — must now disclose how their investments impact sustainability. This is pushing trillions of euros away from companies with no ESG credentials. If you are seeking European institutional investment or listing, ESG credentials are a prerequisite.',
    impact:
      'EU-sourced institutional capital is actively moving away from companies without verifiable ESG records.',
    urgency: 'Medium',
  },
];

const tunisiaReasons = [
  {
    icon: GlobeIcon,
    title: '73% of Tunisian exports go to the EU',
    body: "The EU is Tunisia's largest trading partner. CBAM and CSRD directly affect the viability of those trade relationships. Every Tunisian exporter is already inside Europe's ESG regulatory reach — whether they know it or not.",
  },
  {
    icon: BriefcaseIcon,
    title: 'European investors require ESG data',
    body: 'Tunisia receives significant FDI from European companies. Post-CSRD, those investors now require ESG data from every entity in their portfolio. Tunisian subsidiaries and partners are being asked for sustainability reports — today.',
  },
  {
    icon: ScaleIcon,
    title: "Tunisia's own regulatory direction",
    body: 'The Tunisian government is progressively aligning with international sustainability standards through ALECA negotiations and climate commitments under the Paris Agreement. ESG is becoming a local compliance issue, not just an export market consideration.',
  },
  {
    icon: TrendingUpIcon,
    title: 'Banks are pricing ESG into lending',
    body: 'International financial institutions operating in Tunisia — EBRD, AFD, EIB, IFC — already apply ESG screens to lending decisions. Companies with documented sustainability practices access better terms. Those without them pay more — or are excluded.',
  },
  {
    icon: ZapIcon,
    title: 'Customers and talent are watching',
    body: 'A new generation of Tunisian consumers and professionals chooses brands and employers based on values. Companies with strong ESG credentials attract better talent and build deeper customer loyalty — a concrete commercial advantage.',
  },
  {
    icon: AlertTriangleIcon,
    title: 'The cost of doing nothing is compounding',
    body: 'Every quarter without an ESG baseline is a quarter of missed data. When reporting becomes mandatory — and it will — companies without history will face audits, fines, and reputational damage that years of data could have prevented.',
  },
];

const tftwesgContributions = [
  {
    pillar: 'E',
    pillarColor: 'bg-primary-500',
    title: 'Direct carbon reduction, documented',
    body: 'Every bag rescued through Too Fresh To Waste diverts food from landfill, preventing methane emissions. We provide per-bag CO₂ avoidance data — a verified, quantifiable contribution to your Scope 3 emissions reduction.',
    metric: '~2.5 kg CO₂',
    metricLabel: 'avoided per bag',
  },
  {
    pillar: 'S',
    pillarColor: 'bg-brand-coral',
    title: 'Community nourishment, traceable',
    body: 'Surplus food that reaches families instead of landfills is a measurable social impact. Partnerships with Too Fresh To Waste allow companies to document their contribution to food security — a core Social pillar metric under CSRD reporting frameworks.',
    metric: '1 in 3',
    metricLabel: 'people face food insecurity in MENA',
  },
  {
    pillar: 'G',
    pillarColor: 'bg-secondary-dark',
    title: 'Transparent, audit-ready impact data',
    body: 'Our platform generates structured impact reports — bags saved, CO₂ avoided, families reached — in formats compatible with GRI, SASB, and CSRD reporting templates. Give your auditors real numbers, not estimates.',
    metric: 'GRI · SASB',
    metricLabel: 'reporting compatible',
  },
];

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function ESGPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <Header />

      <main className='min-h-screen bg-white text-primary-500'>
        {/* ── HERO ─────────────────────────────────────────────────────────── */}
        <section className='bg-primary-500 relative overflow-hidden'>
          <div
            className='absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full pointer-events-none'
            style={{
              background: 'radial-gradient(circle, rgba(255,121,115,0.12) 0%, transparent 65%)',
            }}
            aria-hidden='true'
          />
          <div
            className='absolute bottom-0 left-[30%] w-96 h-64 pointer-events-none'
            style={{
              background: 'radial-gradient(ellipse, rgba(255,160,0,0.07) 0%, transparent 70%)',
            }}
            aria-hidden='true'
          />

          {/* Decorative acronym ghost */}
          <div
            className='absolute bottom-4 right-4 text-[200px] font-black text-white/[0.025] select-none pointer-events-none leading-none tracking-tighter hidden lg:block'
            aria-hidden='true'
          >
            ESG
          </div>

          <div className='relative mx-auto max-w-7xl px-6 lg:px-8 pt-16 pb-0 lg:pt-24'>
            <div className='grid lg:grid-cols-2 gap-12 lg:gap-20 items-center'>
              {/* Left — copy */}
              <div className='pb-16 lg:pb-24'>
                <div className='inline-flex items-center gap-2 bg-brand-coral/20 border border-brand-coral/40 text-brand-coral text-xs font-black uppercase tracking-[0.3em] px-4 py-2 rounded-full mb-7'>
                  <ShieldIcon className='w-3.5 h-3.5' />
                  For business leaders
                </div>

                <h1 className='font-playfair text-4xl lg:text-5xl xl:text-6xl font-bold text-white leading-tight mb-5'>
                  ESG is no longer <span className='text-brand-coral italic'>a choice.</span>
                  <br />
                  It is the price of <span className='text-brand-coral italic'>entry.</span>
                </h1>

                <p className='text-white/65 text-base lg:text-lg leading-relaxed mb-8 max-w-xl'>
                  European regulators, global investors, and your own customers are demanding it.
                  Tunisian companies that build their ESG baseline now will lead their markets in
                  five years. Those that wait will be locked out of them.
                </p>

                <div className='flex flex-wrap gap-3'>
                  <a
                    href='#what-is-esg'
                    className='inline-flex items-center gap-2 bg-white text-primary-500 font-bold px-6 py-3.5 rounded-full hover:bg-cream transition-colors shadow-lg text-sm'
                  >
                    Understand ESG
                    <ArrowRightIcon className='w-4 h-4' />
                  </a>
                  <a
                    href='#eu-regulations'
                    className='inline-flex items-center gap-2 border border-white/30 text-white font-bold px-6 py-3.5 rounded-full hover:border-white/60 hover:bg-white/5 transition-colors text-sm'
                  >
                    See EU laws
                    <ArrowRightIcon className='w-4 h-4' />
                  </a>
                </div>
              </div>

              {/* Right — stat cards */}
              <div className='hidden lg:flex flex-col gap-4 pb-16'>
                {[
                  {
                    n: '50 000+',
                    label: 'EU companies now legally required to report ESG',
                    color: 'border-brand-coral/30',
                  },
                  {
                    n: '€50B+',
                    label: 'in carbon border taxes via CBAM by 2030',
                    color: 'border-secondary-dark/30',
                  },
                  {
                    n: '73%',
                    label: "of Tunisia's exports go to the EU — already inside the scope",
                    color: 'border-white/20',
                  },
                ].map((s, i) => (
                  <div key={i} className={`bg-white/8 border ${s.color} rounded-2xl px-6 py-5`}>
                    <p className='font-playfair text-3xl font-bold text-white mb-1'>{s.n}</p>
                    <p className='text-white/55 text-sm leading-snug'>{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Wave */}
          <div className='absolute bottom-0 left-0 right-0' aria-hidden='true'>
            <svg
              viewBox='0 0 1440 72'
              xmlns='http://www.w3.org/2000/svg'
              className='block w-full'
              preserveAspectRatio='none'
            >
              <path d='M0,40 C360,72 1080,8 1440,40 L1440,72 L0,72 Z' fill='white' />
            </svg>
          </div>
        </section>

        {/* ── WHAT IS ESG ──────────────────────────────────────────────────── */}
        <section id='what-is-esg' className='bg-white py-16 lg:py-24 scroll-mt-20'>
          <div className='mx-auto max-w-7xl px-6 lg:px-8'>
            <div className='text-center mb-14'>
              <p className='text-xs font-bold uppercase tracking-[0.25em] text-brand-coral mb-3'>
                The fundamentals
              </p>
              <h2 className='font-playfair text-4xl lg:text-5xl font-bold text-primary-500 mb-4'>
                What exactly is ESG?
              </h2>
              <p className='text-primary-500/55 text-base lg:text-lg max-w-2xl mx-auto leading-relaxed'>
                Three letters. Three dimensions of how a company interacts with the world. Together
                they form the most important lens through which capital, regulators, and partners
                now evaluate your business.
              </p>
            </div>

            <div className='grid md:grid-cols-3 gap-6 lg:gap-8'>
              {esgPillars.map(pillar => (
                <div
                  key={pillar.letter}
                  className={`relative bg-cream rounded-3xl p-8 border-2 ${pillar.border} hover:shadow-lg transition-all duration-300 group overflow-hidden`}
                >
                  {/* Large letter bg */}
                  <div
                    className={`absolute -bottom-4 -right-2 text-[120px] font-black leading-none select-none pointer-events-none ${pillar.color} opacity-5`}
                    aria-hidden='true'
                  >
                    {pillar.letter}
                  </div>

                  {/* Icon */}
                  <div
                    className={`w-14 h-14 rounded-2xl ${pillar.bg} ${pillar.color} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300`}
                  >
                    <pillar.icon className='w-7 h-7' />
                  </div>

                  {/* Pillar badge */}
                  <div className='flex items-center gap-2 mb-3'>
                    <span
                      className={`w-8 h-8 rounded-xl ${pillar.accent} text-white font-black text-base flex items-center justify-center`}
                    >
                      {pillar.letter}
                    </span>
                    <p className={`text-xs font-black uppercase tracking-widest ${pillar.color}`}>
                      {pillar.label}
                    </p>
                  </div>

                  <h3 className='font-playfair text-xl font-bold text-primary-500 mb-3 leading-snug'>
                    {pillar.headline}
                  </h3>
                  <p className='text-sm text-primary-500/60 leading-relaxed mb-5'>{pillar.body}</p>

                  <ul className='space-y-2'>
                    {pillar.metrics.map((m, mi) => (
                      <li key={mi} className='flex items-center gap-2 text-xs text-primary-500/70'>
                        <span
                          className={`w-4 h-4 rounded-full ${pillar.bg} ${pillar.color} flex items-center justify-center shrink-0`}
                        >
                          <CheckIcon className='w-2.5 h-2.5' />
                        </span>
                        {m}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            {/* One-liner callout */}
            <div className='mt-10 bg-primary-500 rounded-3xl px-8 py-7 text-center'>
              <p className='font-playfair text-xl lg:text-2xl font-bold text-white leading-snug'>
                ESG is not a report you file once a year.{' '}
                <span className='text-brand-coral italic'>
                  It is how you run your company — measured, verified, and published.
                </span>
              </p>
            </div>
          </div>
        </section>

        {/* ── WHY YOU NEED IT ──────────────────────────────────────────────── */}
        <section className='bg-cream py-16 lg:py-24 relative overflow-hidden'>
          <div className='mx-auto max-w-7xl px-6 lg:px-8'>
            <div className='text-center mb-14'>
              <p className='text-xs font-bold uppercase tracking-[0.25em] text-brand-coral mb-3'>
                The business case
              </p>
              <h2 className='font-playfair text-4xl lg:text-5xl font-bold text-primary-500 mb-4'>
                Why every company needs an ESG strategy.{' '}
                <span className='text-brand-coral italic'>Now.</span>
              </h2>
            </div>

            <div className='grid md:grid-cols-2 lg:grid-cols-3 gap-5'>
              {[
                {
                  icon: GlobeIcon,
                  title: 'Access to global markets',
                  body: 'EU, UK, and US markets are raising the bar on supplier sustainability. Companies without ESG credentials are being removed from procurement lists — regardless of price.',
                  badge: 'Market Access',
                  badgeColor: 'bg-primary-500/10 text-primary-500',
                },
                {
                  icon: TrendingUpIcon,
                  title: 'Lower cost of capital',
                  body: 'Green bonds, sustainability-linked loans, and ESG-screened investment funds offer better rates to companies with documented practices. Your ESG score directly affects your borrowing cost.',
                  badge: 'Finance',
                  badgeColor: 'bg-secondary-dark/10 text-secondary-dark',
                },
                {
                  icon: ShieldIcon,
                  title: 'Regulatory compliance',
                  body: 'EU regulations like CBAM and CSRD are already in force. Being prepared is not optional — it is the difference between trading with Europe and being excluded from it.',
                  badge: 'Compliance',
                  badgeColor: 'bg-brand-coral/10 text-brand-coral',
                },
                {
                  icon: UsersIcon,
                  title: 'Talent and retention',
                  body: 'The best graduates and senior professionals choose employers with clear values. Companies with strong ESG programs reduce turnover and attract talent their competitors cannot.',
                  badge: 'HR',
                  badgeColor: 'bg-primary-500/10 text-primary-500',
                },
                {
                  icon: BriefcaseIcon,
                  title: 'Investor due diligence',
                  body: 'Every institutional investor, PE fund, and development finance institution now conducts ESG due diligence before deploying capital. Without an ESG baseline, fundraising is harder and slower.',
                  badge: 'Investment',
                  badgeColor: 'bg-secondary-dark/10 text-secondary-dark',
                },
                {
                  icon: ZapIcon,
                  title: 'Operational efficiency',
                  body: 'Measuring your energy, water, and waste forces you to find inefficiencies. Companies that adopt ESG practices typically reduce operating costs by 10–20% within three years of serious measurement.',
                  badge: 'Efficiency',
                  badgeColor: 'bg-primary-500/10 text-primary-500',
                },
              ].map((item, i) => (
                <div
                  key={i}
                  className='bg-white rounded-3xl p-7 border border-primary-500/8 hover:shadow-md hover:border-primary-500/20 transition-all duration-300 group'
                >
                  <div className='flex items-start justify-between mb-4'>
                    <div className='w-12 h-12 rounded-xl bg-primary-500/8 text-primary-500 flex items-center justify-center group-hover:scale-110 transition-transform duration-300'>
                      <item.icon className='w-6 h-6' />
                    </div>
                    <span
                      className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${item.badgeColor}`}
                    >
                      {item.badge}
                    </span>
                  </div>
                  <h3 className='font-bold text-base text-primary-500 mb-2 leading-snug'>
                    {item.title}
                  </h3>
                  <p className='text-sm text-primary-500/60 leading-relaxed'>{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── EU REGULATIONS ───────────────────────────────────────────────── */}
        <section id='eu-regulations' className='bg-white py-16 lg:py-24 scroll-mt-20'>
          <div className='mx-auto max-w-7xl px-6 lg:px-8'>
            <div className='text-center mb-14'>
              <p className='text-xs font-bold uppercase tracking-[0.25em] text-brand-coral mb-3'>
                The regulatory reality
              </p>
              <h2 className='font-playfair text-4xl lg:text-5xl font-bold text-primary-500 mb-4'>
                The EU already passed the laws.
                <br />
                <span className='text-brand-coral italic'>They apply to you.</span>
              </h2>
              <p className='text-primary-500/55 text-base lg:text-lg max-w-2xl mx-auto leading-relaxed'>
                These are not draft proposals. They are enacted legislation, with enforcement
                timelines, fines, and border-level application. If you trade with or seek capital
                from Europe, these regulations are already part of your operating environment.
              </p>
            </div>

            <div className='space-y-5'>
              {euRegulations.map((reg, i) => (
                <div
                  key={i}
                  className='bg-cream rounded-3xl p-7 lg:p-8 border border-primary-500/8 hover:border-primary-500/15 hover:shadow-md transition-all duration-300'
                >
                  <div className='flex flex-wrap items-start gap-4 mb-5'>
                    {/* Code badge */}
                    <div className='shrink-0'>
                      <span className='inline-flex items-center gap-1.5 bg-primary-500 text-white text-sm font-black px-4 py-2 rounded-full'>
                        <span>{reg.flag}</span>
                        {reg.code}
                      </span>
                    </div>

                    <div className='flex-1 min-w-0'>
                      <div className='flex flex-wrap items-center gap-3 mb-1'>
                        <h3 className='font-bold text-base lg:text-lg text-primary-500'>
                          {reg.full}
                        </h3>
                        <span
                          className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border ${reg.statusColor}`}
                        >
                          {reg.status}
                        </span>
                      </div>
                      <p className='text-xs font-bold text-primary-500/45 uppercase tracking-wider'>
                        {reg.deadline}
                      </p>
                    </div>

                    {/* Urgency pill */}
                    <span
                      className={`shrink-0 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full ${
                        reg.urgency === 'Immediate'
                          ? 'bg-brand-coral text-white'
                          : reg.urgency === 'High'
                            ? 'bg-secondary-dark/15 text-secondary-dark'
                            : 'bg-primary-500/8 text-primary-500/60'
                      }`}
                    >
                      {reg.urgency} urgency
                    </span>
                  </div>

                  <div className='grid lg:grid-cols-[1fr_auto] gap-5'>
                    <p className='text-sm text-primary-500/65 leading-relaxed'>{reg.summary}</p>
                    <div className='lg:w-72 shrink-0 bg-white rounded-2xl p-4 border border-primary-500/10'>
                      <p className='text-[10px] font-black uppercase tracking-widest text-primary-500/40 mb-2'>
                        Impact on your business
                      </p>
                      <p className='text-sm font-bold text-primary-500 leading-snug'>
                        {reg.impact}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Bottom note */}
            <div className='mt-8 flex items-start gap-3 bg-brand-coral/8 border border-brand-coral/20 rounded-2xl p-5'>
              <AlertTriangleIcon className='w-5 h-5 text-brand-coral shrink-0 mt-0.5' />
              <p className='text-sm text-primary-500/70 leading-relaxed'>
                <strong className='text-primary-500'>This list is not exhaustive.</strong> The
                EU&apos;s regulatory agenda on sustainability is expanding every year. The direction
                of travel is clear and irreversible: by 2030, ESG disclosure will be as standard as
                financial auditing for any company operating in or trading with Europe.
              </p>
            </div>
          </div>
        </section>

        {/* ── WHY TUNISIA ──────────────────────────────────────────────────── */}
        <section className='bg-primary-500 py-16 lg:py-24 relative overflow-hidden'>
          {/* Waves */}
          <div className='absolute top-0 left-0 right-0' aria-hidden='true'>
            <svg
              viewBox='0 0 1440 72'
              xmlns='http://www.w3.org/2000/svg'
              className='block w-full'
              preserveAspectRatio='none'
            >
              <path d='M0,32 C360,0 1080,64 1440,32 L1440,0 L0,0 Z' fill='white' />
            </svg>
          </div>
          <div className='absolute bottom-0 left-0 right-0' aria-hidden='true'>
            <svg
              viewBox='0 0 1440 72'
              xmlns='http://www.w3.org/2000/svg'
              className='block w-full'
              preserveAspectRatio='none'
            >
              <path d='M0,40 C360,72 1080,8 1440,40 L1440,72 L0,72 Z' fill='#f9f3f0' />
            </svg>
          </div>
          <div
            className='absolute top-20 right-0 w-96 h-96 pointer-events-none'
            style={{
              background: 'radial-gradient(circle, rgba(255,121,115,0.1) 0%, transparent 70%)',
            }}
            aria-hidden='true'
          />

          <div className='relative mx-auto max-w-7xl px-6 lg:px-8 pt-10 pb-8'>
            <div className='text-center mb-14'>
              <p className='text-xs font-bold uppercase tracking-[0.25em] text-brand-coral mb-3'>
                Tunisia specifically
              </p>
              <h2 className='font-playfair text-4xl lg:text-5xl font-bold text-white mb-4'>
                Why Tunisian companies <span className='text-brand-coral italic'>cannot wait.</span>
              </h2>
              <p className='text-white/55 text-base lg:text-lg max-w-2xl mx-auto leading-relaxed'>
                Tunisia is not isolated from the global ESG wave. It is directly in its path.
              </p>
            </div>

            <div className='grid sm:grid-cols-2 lg:grid-cols-3 gap-5'>
              {tunisiaReasons.map((item, i) => (
                <div
                  key={i}
                  className='bg-white/8 border border-white/12 rounded-3xl p-7 hover:bg-white/12 hover:border-white/20 transition-all duration-300 group'
                >
                  <div className='w-12 h-12 rounded-xl bg-brand-coral/20 text-brand-coral flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300'>
                    <item.icon className='w-6 h-6' />
                  </div>
                  <h3 className='font-bold text-base text-white mb-3 leading-snug'>{item.title}</h3>
                  <p className='text-sm text-white/55 leading-relaxed'>{item.body}</p>
                </div>
              ))}
            </div>

            {/* Flag + context */}
            <div className='mt-10 bg-white/8 border border-white/12 rounded-3xl p-7 lg:p-8 flex flex-col lg:flex-row items-center gap-6 text-center lg:text-left'>
              <div className='text-6xl shrink-0'>🇹🇳</div>
              <div>
                <p className='font-playfair text-xl lg:text-2xl font-bold text-white mb-2'>
                  Tunisia exports to Europe. Europe now has an ESG price of entry.
                </p>
                <p className='text-white/55 text-sm lg:text-base leading-relaxed'>
                  The Association Agreement, the ALECA framework, and the EU&apos;s Green Deal
                  create a direct and growing ESG obligation for every Tunisian company with
                  European commercial relationships. This is not speculation — it is the current
                  state of trade policy.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── HOW TFTW HELPS YOUR ESG ──────────────────────────────────────── */}
        <section className='bg-cream py-16 lg:py-24'>
          <div className='mx-auto max-w-7xl px-6 lg:px-8'>
            <div className='text-center mb-14'>
              <p className='text-xs font-bold uppercase tracking-[0.25em] text-brand-coral mb-3'>
                Our contribution to your score
              </p>
              <h2 className='font-playfair text-4xl lg:text-5xl font-bold text-primary-500 mb-4'>
                How Too Fresh To Waste{' '}
                <span className='text-brand-coral italic'>builds your ESG case.</span>
              </h2>
              <p className='text-primary-500/55 text-base lg:text-lg max-w-2xl mx-auto leading-relaxed'>
                Partnering with Too Fresh To Waste gives your company measurable, reportable
                contributions across all three ESG pillars — with the data to back it up.
              </p>
            </div>

            <div className='grid md:grid-cols-3 gap-6 lg:gap-8 mb-10'>
              {tftwesgContributions.map((item, i) => (
                <div
                  key={i}
                  className='bg-white rounded-3xl p-8 border border-primary-500/8 hover:shadow-lg transition-all duration-300 group relative overflow-hidden'
                >
                  <div
                    className='absolute -bottom-6 -right-6 w-32 h-32 rounded-full opacity-5 pointer-events-none'
                    style={{ background: '#005250' }}
                    aria-hidden='true'
                  />
                  <div className='flex items-center gap-3 mb-5'>
                    <span
                      className={`w-10 h-10 rounded-xl ${item.pillarColor} text-white font-black text-lg flex items-center justify-center shrink-0`}
                    >
                      {item.pillar}
                    </span>
                    <div>
                      <p className='font-black text-2xl text-primary-500 leading-none'>
                        {item.metric}
                      </p>
                      <p className='text-xs text-primary-500/45 leading-tight'>
                        {item.metricLabel}
                      </p>
                    </div>
                  </div>
                  <h3 className='font-bold text-base text-primary-500 mb-3 leading-snug'>
                    {item.title}
                  </h3>
                  <p className='text-sm text-primary-500/60 leading-relaxed'>{item.body}</p>
                </div>
              ))}
            </div>

            {/* Reporting frameworks row */}
            <div className='bg-white rounded-3xl p-7 lg:p-8 border border-primary-500/8'>
              <p className='text-xs font-bold uppercase tracking-widest text-primary-500/45 mb-5 text-center'>
                Our impact data is compatible with major reporting frameworks
              </p>
              <div className='flex flex-wrap justify-center gap-3 lg:gap-5'>
                {[
                  'GRI Standards',
                  'SASB',
                  'CSRD / ESRS',
                  'UN SDGs',
                  'CDP',
                  'TCFD',
                  'ISO 14001',
                ].map((f, fi) => (
                  <span
                    key={fi}
                    className='text-xs font-bold text-primary-500/70 bg-cream border border-primary-500/12 px-4 py-2 rounded-full'
                  >
                    {f}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── FINAL CTA ────────────────────────────────────────────────────── */}
        <section className='bg-white py-16 lg:py-24 relative overflow-hidden'>
          <div className='mx-auto max-w-4xl px-6 lg:px-8 text-center'>
            <div className='bg-primary-500 rounded-3xl px-8 lg:px-16 py-14 lg:py-16 relative overflow-hidden'>
              {/* Glow */}
              <div
                className='absolute -top-20 -right-20 w-80 h-80 rounded-full pointer-events-none'
                style={{
                  background: 'radial-gradient(circle, rgba(255,121,115,0.15) 0%, transparent 65%)',
                }}
                aria-hidden='true'
              />
              <div
                className='absolute -bottom-16 -left-16 w-64 h-64 rounded-full pointer-events-none'
                style={{
                  background: 'radial-gradient(circle, rgba(255,160,0,0.1) 0%, transparent 70%)',
                }}
                aria-hidden='true'
              />

              <div className='relative'>
                <p className='text-white/50 text-xs font-bold uppercase tracking-[0.3em] mb-4'>
                  Start your ESG journey
                </p>
                <h2 className='font-playfair text-3xl lg:text-5xl font-bold text-white leading-tight mb-5'>
                  Your ESG baseline starts{' '}
                  <span className='text-brand-coral italic'>with one decision.</span>
                </h2>
                <p className='text-white/65 text-base lg:text-lg leading-relaxed mb-10 max-w-xl mx-auto'>
                  Talk to us. We will show you exactly how a Too Fresh To Waste partnership
                  contributes to your environmental and social metrics — with data your auditors can
                  sign off on.
                </p>
                <div className='flex flex-col sm:flex-row gap-4 justify-center'>
                  <Link
                    href='/contact'
                    className='inline-flex items-center justify-center gap-2 bg-white text-primary-500 font-black text-sm px-8 py-4 rounded-full hover:bg-cream transition-colors shadow-xl'
                  >
                    Talk to our team
                    <ArrowRightIcon className='w-4 h-4' />
                  </Link>
                  <Link
                    href='/companies'
                    className='inline-flex items-center justify-center gap-2 border-2 border-white/30 text-white font-black text-sm px-8 py-4 rounded-full hover:border-white/60 hover:bg-white/8 transition-colors'
                  >
                    Enterprise solutions
                    <ArrowRightIcon className='w-4 h-4' />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
