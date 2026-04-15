import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Security | Too Fresh To Waste',
  description:
    'Learn how Too Fresh To Waste protects your account and data with industry-standard security practices — and how to report a vulnerability.',
  robots: { index: true, follow: true },
};

const LAST_UPDATED = 'April 15, 2026';
const SECURITY_EMAIL = 'support@toofreshtowaste.com';

const SECURITY_FEATURES = [
  {
    icon: '🔒',
    title: 'HTTPS Everywhere',
    body: 'All traffic between your device and our servers is encrypted using TLS 1.2 or higher. Plain HTTP requests are automatically redirected to HTTPS. HTTP Strict Transport Security (HSTS) is enforced so your browser never falls back to an insecure connection.',
  },
  {
    icon: '🔑',
    title: 'Password Security',
    body: 'Passwords are never stored in plain text. We use bcrypt with a high work factor (cost 12) to hash every password before it reaches our database. This means even if our database were compromised, passwords would remain computationally infeasible to crack.',
  },
  {
    icon: '🎫',
    title: 'Short-Lived Session Tokens',
    body: 'Authentication is handled with JSON Web Tokens (JWT). Access tokens expire in 15 minutes; refresh tokens expire in 7 days. Both are stored exclusively in HttpOnly, Secure, SameSite=Strict cookies — inaccessible to JavaScript, protecting you from cross-site scripting (XSS) attacks.',
  },
  {
    icon: '🛡️',
    title: 'Multi-Factor Authentication',
    body: 'We support email-based one-time codes (OTP) as a second factor during login. Enabling MFA significantly reduces the risk of account compromise even if your password is leaked.',
  },
  {
    icon: '🚦',
    title: 'Rate Limiting',
    body: 'All API endpoints are rate-limited via Redis-backed throttling. Login and password-reset endpoints have stricter limits to prevent brute-force and credential-stuffing attacks.',
  },
  {
    icon: '🧹',
    title: 'Input Sanitisation',
    body: 'Every piece of user-supplied input is validated with class-validator DTOs on the backend and sanitised by a global middleware before processing. This protects against injection attacks and cross-site scripting (XSS).',
  },
  {
    icon: '🗄️',
    title: 'Database Security',
    body: 'Our MongoDB database uses encryption at rest (AES-256) and in transit (TLS). Role-based access control ensures that only the application service account can read or write data. Admin access requires multi-factor authentication and IP allowlisting.',
  },
  {
    icon: '🔐',
    title: 'Secret Management',
    body: 'All secrets — API keys, database credentials, JWT signing keys — are managed via environment variables and CI/CD secret stores. They are never hard-coded in source code or committed to version control.',
  },
  {
    icon: '🪖',
    title: 'Security Headers',
    body: 'Our API server uses Helmet.js to set a strict Content-Security-Policy, X-Content-Type-Options, X-Frame-Options, and Referrer-Policy. Our Next.js frontend applies matching security headers via next.config.js.',
  },
  {
    icon: '📦',
    title: 'Dependency Auditing',
    body: 'We pin all package versions explicitly and run automated vulnerability audits (pnpm audit) on every build. Critical security updates are applied within 48 hours of disclosure.',
  },
];

export default function SecurityPage() {
  return (
    <div className='min-h-screen bg-background'>
      {/* Hero Banner */}
      <section className='bg-primary-500 py-16 px-4'>
        <div className='max-w-4xl mx-auto text-center'>
          <h1 className='text-3xl md:text-4xl font-bold text-white mb-3'>Security</h1>
          <p className='text-white/80 text-base max-w-xl mx-auto'>
            Keeping your data safe is our top priority. Here is how we protect you.
          </p>
          <p className='text-white/50 text-sm mt-3'>Last updated: {LAST_UPDATED}</p>
        </div>
      </section>

      {/* Content */}
      <article className='max-w-4xl mx-auto px-4 py-14'>
        <div className='space-y-6 text-foreground'>
          {/* Security Features Grid */}
          <section>
            <h2 className='text-4xl font-bold text-primary-500 mb-6'>
              How We Protect Your Account
            </h2>
            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
              {SECURITY_FEATURES.map(feature => (
                <div
                  key={feature.title}
                  className='p-5 border border-border rounded-lg hover:border-primary-500/40 transition-colors'
                >
                  <div className='flex items-start gap-3'>
                    <span className='text-2xl shrink-0' aria-hidden='true'>
                      {feature.icon}
                    </span>
                    <div>
                      <h3 className='text-sm font-bold text-foreground mb-1'>{feature.title}</h3>
                      <p className='text-sm text-muted-foreground leading-relaxed'>
                        {feature.body}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <hr className='border-border' />

          {/* What You Can Do */}
          <section>
            <h2 className='text-4xl font-bold text-primary-500 mb-4'>How You Can Stay Safe</h2>
            <p className='text-sm text-muted-foreground mb-4'>
              Security is a shared responsibility. Here are steps you can take to protect your
              account:
            </p>
            <ul className='list-disc list-outside ms-5 space-y-2 text-sm text-muted-foreground'>
              <li>
                Use a <strong className='text-foreground'>strong, unique password</strong> for your
                Too Fresh To Waste account — do not reuse passwords from other services.
              </li>
              <li>
                Enable{' '}
                <strong className='text-foreground'>Multi-Factor Authentication (MFA)</strong> in
                your account settings.
              </li>
              <li>
                Be cautious of <strong className='text-foreground'>phishing emails</strong> that
                appear to be from Too Fresh To Waste. We will never ask for your password via email.
              </li>
              <li>
                Keep your device&apos;s operating system and browser{' '}
                <strong className='text-foreground'>up to date</strong> to benefit from the latest
                security patches.
              </li>
              <li>
                Log out of your account when using a{' '}
                <strong className='text-foreground'>shared or public device</strong>.
              </li>
              <li>
                If you suspect your account has been compromised, change your password immediately
                and contact us.
              </li>
            </ul>
          </section>

          <hr className='border-border' />

          {/* Responsible Disclosure */}
          <section>
            <h2 className='text-4xl font-bold text-primary-500 mb-4'>Responsible Disclosure</h2>
            <p className='text-sm text-muted-foreground mb-3'>
              We take security reports seriously. If you discover a vulnerability in our platform,
              we encourage you to disclose it responsibly so we can fix it before it is exploited.
            </p>

            <div className='p-5 bg-primary-500/5 border border-primary-500/20 rounded-lg mb-4'>
              <h3 className='text-sm font-bold text-foreground mb-2'>
                How to Report a Vulnerability
              </h3>
              <ol className='list-decimal list-outside ms-5 space-y-1 text-sm text-muted-foreground'>
                <li>
                  Email{' '}
                  <a
                    href={`mailto:${SECURITY_EMAIL}`}
                    className='text-primary-500 underline underline-offset-2 hover:opacity-75'
                  >
                    {SECURITY_EMAIL}
                  </a>{' '}
                  with the subject line: <em>&quot;Security Vulnerability Report&quot;</em>.
                </li>
                <li>
                  Describe the vulnerability in detail — include steps to reproduce, potential
                  impact, and any supporting screenshots or proof-of-concept code.
                </li>
                <li>
                  Do not publicly disclose the vulnerability until we have had a reasonable
                  opportunity to investigate and remediate it (typically 90 days).
                </li>
              </ol>
            </div>

            <h3 className='text-base font-semibold mb-2'>Our Commitment</h3>
            <ul className='list-disc list-outside ms-5 space-y-1 text-sm text-muted-foreground'>
              <li>We will acknowledge your report within 3 business days.</li>
              <li>We will keep you informed as we investigate and fix the issue.</li>
              <li>
                We will not take legal action against researchers who report vulnerabilities in good
                faith and follow this policy.
              </li>
              <li>
                We recognise reporters publicly (with their consent) once a fix has been deployed.
              </li>
            </ul>

            <h3 className='text-base font-semibold mb-2 mt-5'>Out of Scope</h3>
            <p className='text-sm text-muted-foreground mb-2'>
              The following are outside the scope of our disclosure programme:
            </p>
            <ul className='list-disc list-outside ms-5 space-y-1 text-sm text-muted-foreground'>
              <li>Denial-of-service (DoS/DDoS) attacks</li>
              <li>Social engineering or phishing of our employees</li>
              <li>Attacks requiring physical access to a user&apos;s device</li>
              <li>
                Vulnerabilities in third-party services we rely on (report those directly to the
                vendor)
              </li>
            </ul>
          </section>

          <hr className='border-border' />

          {/* Contact */}
          <section>
            <h2 className='text-4xl font-bold text-primary-500 mb-4'>Security Contact</h2>
            <div className='p-4 bg-muted rounded-lg text-sm space-y-1'>
              <p>
                <strong className='text-foreground'>Too Fresh To Waste — Security Team</strong>
              </p>
              <p className='text-muted-foreground'>Tunisia</p>
              <p>
                <a
                  href={`mailto:${SECURITY_EMAIL}`}
                  className='text-primary-500 underline underline-offset-2 hover:opacity-75'
                >
                  {SECURITY_EMAIL}
                </a>
              </p>
              <p className='text-muted-foreground text-xs mt-2'>
                For general support requests, please use{' '}
                <a
                  href='mailto:support@toofreshtowaste.com'
                  className='text-primary-500 underline underline-offset-2 hover:opacity-75'
                >
                  support@toofreshtowaste.com
                </a>{' '}
                instead.
              </p>
            </div>
          </section>
        </div>
      </article>
    </div>
  );
}
