import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Cookie Policy | Too Fresh To Waste',
  description: 'Learn how Too Fresh To Waste uses cookies and how you can manage your preferences.',
  robots: { index: true, follow: true },
};

const LAST_UPDATED = 'April 15, 2026';
const CONTACT_EMAIL = 'privacy@toofresh.tn';

export default function CookiePolicyPage() {
  return (
    <div className='min-h-screen bg-background'>
      {/* Hero Banner */}
      <section className='bg-primary-500 py-16 px-4'>
        <div className='max-w-4xl mx-auto text-center'>
          <h1 className='text-3xl md:text-4xl font-bold text-white mb-3'>Cookie Policy</h1>
          <p className='text-white/70 text-sm'>Last updated: {LAST_UPDATED}</p>
        </div>
      </section>

      {/* Content */}
      <article className='max-w-3xl mx-auto px-4 py-14'>
        <div className='space-y-10 text-foreground'>
          {/* Intro */}
          <section>
            <p className='text-sm leading-relaxed text-muted-foreground'>
              When you use the Too Fresh To Waste platform — our website or app — we use cookies and
              similar technologies to make things work properly and to help us improve your
              experience. This page explains what they are, why we use them, and how you can control
              them.
            </p>
          </section>

          <hr className='border-border' />

          {/* What are cookies */}
          <section>
            <h2 className='text-xl font-bold text-primary-500 mb-3'>What Are Cookies?</h2>
            <p className='text-sm leading-relaxed text-muted-foreground'>
              Cookies are small files stored on your device when you visit a website or use an app.
              They let the service remember things about your visit — like whether you are logged in
              or what language you prefer — so you do not have to repeat yourself every time.
            </p>
          </section>

          <hr className='border-border' />

          {/* What we use */}
          <section>
            <h2 className='text-xl font-bold text-primary-500 mb-5'>Cookies We Use</h2>

            <div className='space-y-4'>
              {/* Essential */}
              <div className='p-5 border border-border rounded-lg'>
                <div className='flex items-center justify-between mb-2'>
                  <h3 className='text-sm font-bold text-foreground'>Essential</h3>
                  <span className='text-xs px-2.5 py-0.5 rounded-full bg-primary-500/10 text-primary-500 font-medium'>
                    Always on
                  </span>
                </div>
                <p className='text-sm text-muted-foreground leading-relaxed'>
                  These keep you signed in securely and make the platform function. Without them you
                  cannot log in, place orders, or use any feature that requires an account. They
                  cannot be turned off.
                </p>
              </div>

              {/* Functional */}
              <div className='p-5 border border-border rounded-lg'>
                <h3 className='text-sm font-bold text-foreground mb-2'>Functional</h3>
                <p className='text-sm text-muted-foreground leading-relaxed'>
                  These remember your preferences — such as your chosen language (Arabic, French, or
                  English) — so the platform feels familiar each time you return. Disabling them
                  will not break the platform but some preferences may reset.
                </p>
              </div>

              {/* Analytics */}
              <div className='p-5 border border-border rounded-lg'>
                <h3 className='text-sm font-bold text-foreground mb-2'>Analytics</h3>
                <p className='text-sm text-muted-foreground leading-relaxed'>
                  We use Google Analytics to understand how people use our platform — which pages
                  are popular, where things can be improved, and how our app is performing. All data
                  is anonymised; we never see who you are, only patterns in aggregate. You can opt
                  out at any time (see below).
                </p>
              </div>
            </div>

            <p className='text-xs text-muted-foreground mt-4'>
              We do not use advertising cookies or share cookie data with ad networks.
            </p>
          </section>

          <hr className='border-border' />

          {/* How to manage */}
          <section>
            <h2 className='text-xl font-bold text-primary-500 mb-3'>How to Manage Cookies</h2>

            <p className='text-sm text-muted-foreground mb-4'>
              You are in control. Here are your options:
            </p>

            <div className='space-y-4'>
              <div>
                <h3 className='text-sm font-semibold text-foreground mb-1'>Browser settings</h3>
                <p className='text-sm text-muted-foreground'>
                  Every modern browser lets you view, block, or delete cookies. Look under Privacy
                  or Security in your browser settings. Blocking all cookies will prevent you from
                  logging in.
                </p>
              </div>

              <div>
                <h3 className='text-sm font-semibold text-foreground mb-1'>
                  Google Analytics opt-out
                </h3>
                <p className='text-sm text-muted-foreground'>
                  Install the{' '}
                  <strong className='text-foreground'>
                    Google Analytics Opt-out Browser Add-on
                  </strong>{' '}
                  (tools.google.com/dlpage/gaoptout) to stop Google Analytics from collecting data
                  about your visits across all websites you use.
                </p>
              </div>
            </div>
          </section>

          <hr className='border-border' />

          {/* Changes */}
          <section>
            <h2 className='text-xl font-bold text-primary-500 mb-3'>Updates to This Policy</h2>
            <p className='text-sm text-muted-foreground'>
              If we start using new cookies or change how we use existing ones, we will update this
              page and revise the date at the top. We encourage you to check back from time to time.
            </p>
          </section>

          <hr className='border-border' />

          {/* Contact */}
          <section>
            <h2 className='text-xl font-bold text-primary-500 mb-3'>Questions?</h2>
            <p className='text-sm text-muted-foreground'>
              Reach us at{' '}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className='text-primary-500 underline underline-offset-2 hover:opacity-75'
              >
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          </section>
        </div>
      </article>
    </div>
  );
}
