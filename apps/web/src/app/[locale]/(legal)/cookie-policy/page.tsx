import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Cookie Policy | Too Fresh To Waste',
  description:
    'Understand how Too Fresh To Waste uses cookies and similar technologies, and how you can manage your preferences.',
  robots: { index: true, follow: true },
};

const LAST_UPDATED = 'April 15, 2026';
const EFFECTIVE_DATE = 'April 15, 2026';
const CONTACT_EMAIL = 'privacy@toofresh.tn';

const COOKIE_TABLE = [
  {
    name: 'access_token',
    type: 'Essential',
    purpose: 'Authenticates your session with our API',
    duration: '15 minutes',
    party: 'First-party',
  },
  {
    name: 'refresh_token',
    type: 'Essential',
    purpose: 'Silently refreshes your access token without requiring re-login',
    duration: '7 days',
    party: 'First-party',
  },
  {
    name: '__Host-locale',
    type: 'Functional',
    purpose: 'Remembers your preferred language (en / fr / ar)',
    duration: '1 year',
    party: 'First-party',
  },
  {
    name: '_ga, _ga_*',
    type: 'Analytics',
    purpose:
      'Google Analytics 4 — tracks page views and interactions to help us improve the platform',
    duration: '2 years',
    party: 'Google LLC',
  },
  {
    name: 'chunk_reload_*',
    type: 'Functional',
    purpose:
      'Prevents infinite reload loops when a browser caches an outdated JavaScript chunk after a deployment',
    duration: 'Session',
    party: 'First-party',
  },
];

export default function CookiePolicyPage() {
  return (
    <div className='min-h-screen bg-background'>
      {/* Hero Banner */}
      <section className='bg-primary-500 py-16 px-4'>
        <div className='max-w-4xl mx-auto text-center'>
          <h1 className='text-3xl md:text-4xl font-bold text-white mb-3'>Cookie Policy</h1>
          <p className='text-white/70 text-sm'>
            Last updated: {LAST_UPDATED} &nbsp;·&nbsp; Effective: {EFFECTIVE_DATE}
          </p>
        </div>
      </section>

      {/* Content */}
      <article className='max-w-4xl mx-auto px-4 py-14'>
        <div className='space-y-10 text-foreground'>
          {/* What are cookies */}
          <section>
            <h2 className='text-xl font-bold text-primary-500 mb-4'>What Are Cookies?</h2>
            <p className='text-sm text-muted-foreground'>
              Cookies are small text files placed on your device by a website or app. They allow the
              Service to remember information about your visit — such as your language preference or
              authentication state — making your next visit easier and the Service more useful.
              Cookies set by us are called first-party cookies; cookies set by our third-party
              partners are called third-party cookies.
            </p>
          </section>

          <hr className='border-border' />

          {/* Types */}
          <section>
            <h2 className='text-xl font-bold text-primary-500 mb-4'>Types of Cookies We Use</h2>

            <div className='space-y-5'>
              <div className='p-4 border border-border rounded-lg'>
                <h3 className='text-sm font-bold text-foreground mb-1'>
                  Essential Cookies
                  <span className='ms-2 text-xs font-normal px-2 py-0.5 rounded-full bg-primary-500/10 text-primary-500'>
                    Always active
                  </span>
                </h3>
                <p className='text-sm text-muted-foreground'>
                  These cookies are strictly necessary for the Service to function. They manage your
                  authenticated session using HttpOnly cookies (inaccessible to JavaScript). Without
                  them, core features such as login and placing orders would not work. They cannot
                  be disabled.
                </p>
              </div>

              <div className='p-4 border border-border rounded-lg'>
                <h3 className='text-sm font-bold text-foreground mb-1'>Functional Cookies</h3>
                <p className='text-sm text-muted-foreground'>
                  These cookies enable enhanced functionality such as language preference
                  persistence and error-recovery logic. Disabling them may affect your experience
                  but will not prevent basic access to the Service.
                </p>
              </div>

              <div className='p-4 border border-border rounded-lg'>
                <h3 className='text-sm font-bold text-foreground mb-1'>Analytics Cookies</h3>
                <p className='text-sm text-muted-foreground'>
                  We use Google Analytics 4 to understand how visitors use our platform — which
                  pages are most visited, where users drop off, and how features perform. All data
                  is aggregated and anonymised; your IP address is masked. You may opt out at any
                  time (see below).
                </p>
              </div>
            </div>
          </section>

          <hr className='border-border' />

          {/* Cookie Table */}
          <section>
            <h2 className='text-xl font-bold text-primary-500 mb-4'>Cookie Details</h2>
            <div className='overflow-x-auto'>
              <table className='w-full text-sm border-collapse'>
                <thead>
                  <tr className='bg-muted'>
                    <th className='text-start p-3 font-semibold border border-border whitespace-nowrap'>
                      Cookie Name
                    </th>
                    <th className='text-start p-3 font-semibold border border-border'>Type</th>
                    <th className='text-start p-3 font-semibold border border-border'>Purpose</th>
                    <th className='text-start p-3 font-semibold border border-border whitespace-nowrap'>
                      Duration
                    </th>
                    <th className='text-start p-3 font-semibold border border-border'>Set by</th>
                  </tr>
                </thead>
                <tbody>
                  {COOKIE_TABLE.map((row, i) => (
                    <tr key={row.name} className={i % 2 === 0 ? '' : 'bg-muted/40'}>
                      <td className='p-3 border border-border font-mono text-xs text-foreground whitespace-nowrap'>
                        {row.name}
                      </td>
                      <td className='p-3 border border-border text-muted-foreground'>{row.type}</td>
                      <td className='p-3 border border-border text-muted-foreground'>
                        {row.purpose}
                      </td>
                      <td className='p-3 border border-border text-muted-foreground whitespace-nowrap'>
                        {row.duration}
                      </td>
                      <td className='p-3 border border-border text-muted-foreground'>
                        {row.party}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className='text-xs text-muted-foreground mt-2'>
              We do not use advertising or tracking cookies, and we do not share cookie data with
              advertisers.
            </p>
          </section>

          <hr className='border-border' />

          {/* Managing Cookies */}
          <section>
            <h2 className='text-xl font-bold text-primary-500 mb-4'>Managing Your Cookies</h2>

            <h3 className='text-base font-semibold mb-2'>Browser Settings</h3>
            <p className='text-sm text-muted-foreground mb-4'>
              You can instruct your browser to refuse all cookies or to alert you when cookies are
              being sent. Instructions vary by browser:
            </p>
            <ul className='list-disc list-outside ms-5 space-y-1 text-sm text-muted-foreground mb-4'>
              <li>Chrome: Settings → Privacy and security → Cookies and other site data</li>
              <li>Firefox: Settings → Privacy &amp; Security → Cookies and Site Data</li>
              <li>Safari: Preferences → Privacy → Manage Website Data</li>
              <li>Edge: Settings → Cookies and site permissions</li>
            </ul>
            <p className='text-sm text-muted-foreground mb-4'>
              Note: blocking essential cookies will prevent you from logging in and using the
              Service.
            </p>

            <h3 className='text-base font-semibold mb-2'>Google Analytics Opt-Out</h3>
            <p className='text-sm text-muted-foreground'>
              Install the{' '}
              <strong className='text-foreground'>Google Analytics Opt-out Browser Add-on</strong>{' '}
              (available at tools.google.com/dlpage/gaoptout) to prevent your data from being used
              by Google Analytics on all websites you visit.
            </p>
          </section>

          <hr className='border-border' />

          {/* Updates */}
          <section>
            <h2 className='text-xl font-bold text-primary-500 mb-4'>Changes to This Policy</h2>
            <p className='text-sm text-muted-foreground'>
              We may update this Cookie Policy when we add new features or change our third-party
              integrations. The &quot;Last updated&quot; date at the top will reflect any changes.
              We encourage you to review this page periodically.
            </p>
          </section>

          <hr className='border-border' />

          {/* Contact */}
          <section>
            <h2 className='text-xl font-bold text-primary-500 mb-4'>Contact</h2>
            <p className='text-sm text-muted-foreground'>
              Questions about our use of cookies?{' '}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className='text-primary-500 underline underline-offset-2 hover:opacity-75'
              >
                {CONTACT_EMAIL}
              </a>
            </p>
          </section>
        </div>
      </article>
    </div>
  );
}
