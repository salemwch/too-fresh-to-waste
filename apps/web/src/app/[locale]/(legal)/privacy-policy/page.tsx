import type { Metadata } from 'next';
import { buildPageMetadata } from '@/lib/seo-metadata';

import type { Locale } from '@/i18n/config';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return buildPageMetadata({
    path: '/privacy-policy',
    locale: locale as Locale,
    title: 'Privacy Policy | Too Fresh To Waste',
    description:
      'Learn how Too Fresh To Waste collects, uses, and protects your personal data in accordance with Tunisian and international data protection standards.',
  });
}

const LAST_UPDATED = 'April 15, 2026';
const EFFECTIVE_DATE = 'April 15, 2026';
const CONTACT_EMAIL = 'support@toofreshtowaste.com';
const COMPANY_NAME = 'Too Fresh To Waste';
const COMPANY_COUNTRY = 'Tunisia';

export default function PrivacyPolicyPage() {
  return (
    <div className='min-h-screen bg-background'>
      {/* Hero Banner */}
      <section className='bg-primary-500 py-16 px-4'>
        <div className='max-w-4xl mx-auto text-center'>
          <h1 className='text-3xl md:text-4xl font-bold text-white mb-3'>Privacy Policy</h1>
          <p className='text-white/70 text-sm'>
            Last updated: {LAST_UPDATED} &nbsp;·&nbsp; Effective: {EFFECTIVE_DATE}
          </p>
        </div>
      </section>

      {/* Content */}
      <article className='max-w-4xl mx-auto px-4 py-14 prose-legal'>
        <div className='space-y-6 text-foreground'>
          {/* Introduction */}
          <section>
            <p className='text-base leading-relaxed text-muted-foreground'>
              {COMPANY_NAME} ("<strong className='text-foreground'>we</strong>", "
              <strong className='text-foreground'>us</strong>", or "
              <strong className='text-foreground'>our</strong>") operates the Too Fresh To Waste
              food-rescue marketplace platform (the "
              <strong className='text-foreground'>Service</strong>
              "). This Privacy Policy explains what personal data we collect, how we use it, and the
              rights you have under applicable law — including the Tunisian{' '}
              <em>
                Loi organique n° 2004-63 relative à la protection des données à caractère personnel
              </em>{' '}
              enforced by the{' '}
              <strong className='text-foreground'>
                Instance Nationale de Protection des Données Personnelles (INPDP)
              </strong>
              , and standards aligned with the EU General Data Protection Regulation (GDPR) for
              users accessing our platform from the European Union.
            </p>
            <p className='text-base leading-relaxed text-muted-foreground mt-4'>
              By using our Service you agree to the collection and use of data as described in this
              policy. If you do not agree, please do not use the Service.
            </p>
          </section>

          <hr className='border-border' />

          {/* 1. Data We Collect */}
          <section>
            <h2 className='text-4xl font-bold text-primary-500 mb-4'>1. Data We Collect</h2>

            <h3 className='text-base font-semibold mb-2'>1.1 Account Information</h3>
            <ul className='list-disc list-outside ms-5 space-y-1 text-sm text-muted-foreground'>
              <li>Full name and display name</li>
              <li>Email address (used for authentication and transactional emails)</li>
              <li>Phone number (for SMS verification where applicable)</li>
              <li>Password (stored as a bcrypt hash — never in plain text)</li>
              <li>Profile photo (optional)</li>
              <li>Account role (consumer, merchant, or admin)</li>
            </ul>

            <h3 className='text-base font-semibold mb-2 mt-5'>1.2 Location Data</h3>
            <p className='text-sm text-muted-foreground'>
              With your explicit permission, we collect your device&apos;s approximate GPS
              coordinates to show you nearby food-rescue offers. You may revoke location permissions
              at any time in your device or browser settings. Precise location data is used only to
              compute proximity and is not stored beyond your active session.
            </p>

            <h3 className='text-base font-semibold mb-2 mt-5'>1.3 Transaction Data</h3>
            <ul className='list-disc list-outside ms-5 space-y-1 text-sm text-muted-foreground'>
              <li>Orders placed, including offer details, price paid, and pickup timestamps</li>
              <li>Payment references (we do not store full card numbers)</li>
              <li>Loyalty points balance and transaction history</li>
            </ul>

            <h3 className='text-base font-semibold mb-2 mt-5'>1.4 Device &amp; Technical Data</h3>
            <ul className='list-disc list-outside ms-5 space-y-1 text-sm text-muted-foreground'>
              <li>IP address and approximate geographic region</li>
              <li>Browser type and version, operating system</li>
              <li>Device identifiers (mobile app only)</li>
              <li>Pages visited, session duration, and clickstream data (analytics)</li>
            </ul>

            <h3 className='text-base font-semibold mb-2 mt-5'>
              1.5 Merchant / Business Information
            </h3>
            <ul className='list-disc list-outside ms-5 space-y-1 text-sm text-muted-foreground'>
              <li>Business name, address, and category</li>
              <li>Commercial registration number</li>
              <li>Bank account or payout details (for revenue disbursements)</li>
              <li>Food listing photos and descriptions</li>
            </ul>
          </section>

          <hr className='border-border' />

          {/* 2. How We Use Your Data */}
          <section>
            <h2 className='text-4xl font-bold text-primary-500 mb-4'>2. How We Use Your Data</h2>
            <div className='overflow-x-auto'>
              <table className='w-full text-sm border-collapse'>
                <thead>
                  <tr className='bg-muted'>
                    <th className='text-start p-3 font-semibold border border-border'>Purpose</th>
                    <th className='text-start p-3 font-semibold border border-border'>
                      Legal Basis
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Create and manage your account', 'Contract performance'],
                    ['Process food-rescue orders and pickups', 'Contract performance'],
                    [
                      'Send email verification and transactional notifications',
                      'Contract performance',
                    ],
                    ['Display nearby offers using your location', 'Consent (opt-in)'],
                    ['Fraud detection and platform security', 'Legitimate interest'],
                    ['Improve the Service with aggregated analytics', 'Legitimate interest'],
                    ['Send promotional communications (with opt-out)', 'Consent'],
                    ['Comply with legal obligations', 'Legal obligation'],
                  ].map(([purpose, basis], i) => (
                    <tr key={i} className={i % 2 === 0 ? '' : 'bg-muted/40'}>
                      <td className='p-3 border border-border text-muted-foreground'>{purpose}</td>
                      <td className='p-3 border border-border text-muted-foreground'>{basis}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <hr className='border-border' />

          {/* 3. Data Storage & Security */}
          <section>
            <h2 className='text-4xl font-bold text-primary-500 mb-4'>
              3. Data Storage &amp; Security
            </h2>
            <p className='text-sm text-muted-foreground mb-3'>
              Your data is stored in a <strong className='text-foreground'>MongoDB Atlas</strong>{' '}
              database with:
            </p>
            <ul className='list-disc list-outside ms-5 space-y-1 text-sm text-muted-foreground'>
              <li>Encryption at rest (AES-256) and in transit (TLS 1.2+)</li>
              <li>Write-concern majority with journaling enabled in production</li>
              <li>Role-based access control — only authorised backend processes can read/write</li>
              <li>
                All API traffic served exclusively over HTTPS — plain HTTP requests are
                automatically redirected
              </li>
              <li>
                Passwords hashed with <strong className='text-foreground'>bcrypt</strong> (cost
                factor 12) — we never store or transmit plain-text passwords
              </li>
              <li>
                Session tokens issued as short-lived JSON Web Tokens (~15 min access, ~7 day
                refresh) stored in HttpOnly cookies — inaccessible to JavaScript
              </li>
              <li>Regular security audits and dependency vulnerability scanning</li>
            </ul>
            <p className='text-sm text-muted-foreground mt-3'>
              While we implement industry-standard safeguards, no method of transmission over the
              internet is 100% secure. Please use a strong, unique password and enable two-factor
              authentication when available.
            </p>
          </section>

          <hr className='border-border' />

          {/* 4. Third Parties */}
          <section>
            <h2 className='text-4xl font-bold text-primary-500 mb-4'>4. Third-Party Services</h2>
            <p className='text-sm text-muted-foreground mb-3'>
              We share data only with trusted processors strictly necessary to operate the Service:
            </p>
            <ul className='list-disc list-outside ms-5 space-y-2 text-sm text-muted-foreground'>
              <li>
                <strong className='text-foreground'>Google Analytics 4</strong> — anonymous usage
                analytics. IP addresses are anonymised. You may opt out via browser extensions or
                cookie settings.
              </li>
              <li>
                <strong className='text-foreground'>Email delivery provider</strong> — sends
                transactional emails (verification, order confirmations). Email addresses are shared
                only for delivery purposes.
              </li>
              <li>
                <strong className='text-foreground'>Payment processor</strong> — handles payment
                authorisation. We do not store raw card data; the processor is PCI-DSS compliant.
              </li>
              <li>
                <strong className='text-foreground'>Cloud infrastructure providers</strong> — host
                our servers and databases under data-processing agreements.
              </li>
            </ul>
            <p className='text-sm text-muted-foreground mt-3'>
              We do not sell your personal data to any third party, ever.
            </p>
          </section>

          <hr className='border-border' />

          {/* 5. Data Retention */}
          <section>
            <h2 className='text-4xl font-bold text-primary-500 mb-4'>5. Data Retention</h2>
            <ul className='list-disc list-outside ms-5 space-y-1 text-sm text-muted-foreground'>
              <li>Active account data: retained for as long as your account is open</li>
              <li>
                Deleted accounts: data anonymised or purged within 30 days of deletion request,
                except where we are legally required to retain records
              </li>
              <li>
                Transaction records: retained for 5 years to comply with Tunisian commercial and tax
                law
              </li>
              <li>Analytics data: aggregated and anonymised after 14 months</li>
            </ul>
          </section>

          <hr className='border-border' />

          {/* 6. Your Rights */}
          <section>
            <h2 className='text-4xl font-bold text-primary-500 mb-4'>6. Your Rights</h2>
            <p className='text-sm text-muted-foreground mb-3'>
              Under Tunisian data protection law (INPDP) and, where applicable, the GDPR, you have
              the right to:
            </p>
            <ul className='list-disc list-outside ms-5 space-y-1 text-sm text-muted-foreground'>
              <li>
                <strong className='text-foreground'>Access</strong> — request a copy of the personal
                data we hold about you
              </li>
              <li>
                <strong className='text-foreground'>Rectification</strong> — correct inaccurate or
                incomplete data
              </li>
              <li>
                <strong className='text-foreground'>Erasure</strong> — request deletion of your data
                (&quot;right to be forgotten&quot;), subject to legal retention obligations
              </li>
              <li>
                <strong className='text-foreground'>Portability</strong> — receive your data in a
                structured, machine-readable format
              </li>
              <li>
                <strong className='text-foreground'>Objection</strong> — object to processing based
                on legitimate interest, including direct marketing
              </li>
              <li>
                <strong className='text-foreground'>Withdraw consent</strong> — at any time, for
                processing based on consent (e.g., location access, marketing emails)
              </li>
            </ul>
            <p className='text-sm text-muted-foreground mt-3'>
              To exercise any right, email{' '}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className='text-primary-500 underline underline-offset-2 hover:opacity-75'
              >
                {CONTACT_EMAIL}
              </a>{' '}
              with your request. We will respond within 30 days. If you believe your rights have
              been violated, you may lodge a complaint with the{' '}
              <strong className='text-foreground'>INPDP</strong> at{' '}
              <span className='text-foreground'>www.inpdp.nat.tn</span>.
            </p>
          </section>

          <hr className='border-border' />

          {/* 7. International Transfers */}
          <section>
            <h2 className='text-4xl font-bold text-primary-500 mb-4'>
              7. International Data Transfers
            </h2>
            <p className='text-sm text-muted-foreground'>
              Our primary infrastructure is operated in {COMPANY_COUNTRY}. Some third-party
              processors (e.g., analytics) may process data outside Tunisia. In such cases we rely
              on standard contractual clauses or the processor&apos;s adequacy certification to
              ensure an equivalent level of protection.
            </p>
          </section>

          <hr className='border-border' />

          {/* 8. Children */}
          <section>
            <h2 className='text-4xl font-bold text-primary-500 mb-4'>8. Children&apos;s Privacy</h2>
            <p className='text-sm text-muted-foreground'>
              Our Service is not directed at children under 16. We do not knowingly collect personal
              data from anyone under 16. If you become aware that a child has provided us with
              personal data, please contact us immediately and we will take steps to delete it.
            </p>
          </section>

          <hr className='border-border' />

          {/* 9. Changes */}
          <section>
            <h2 className='text-4xl font-bold text-primary-500 mb-4'>9. Changes to This Policy</h2>
            <p className='text-sm text-muted-foreground'>
              We may update this Privacy Policy periodically. Material changes will be communicated
              via email or a prominent notice on the platform at least 7 days before they take
              effect. Continued use of the Service after the effective date constitutes acceptance
              of the revised policy.
            </p>
          </section>

          <hr className='border-border' />

          {/* 10. Contact */}
          <section>
            <h2 className='text-4xl font-bold text-primary-500 mb-4'>10. Contact Us</h2>
            <p className='text-sm text-muted-foreground'>
              For privacy-related questions or to exercise your rights, contact our Data Protection
              Team:
            </p>
            <div className='mt-3 p-4 bg-muted rounded-lg text-sm space-y-1'>
              <p>
                <strong className='text-foreground'>Too Fresh To Waste</strong>
              </p>
              <p className='text-muted-foreground'>Tunisia</p>
              <p>
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className='text-primary-500 underline underline-offset-2 hover:opacity-75'
                >
                  {CONTACT_EMAIL}
                </a>
              </p>
            </div>
          </section>
        </div>
      </article>
    </div>
  );
}
