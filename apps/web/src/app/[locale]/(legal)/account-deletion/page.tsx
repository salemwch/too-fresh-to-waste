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
    path: '/account-deletion',
    locale: locale as Locale,
    title: 'Delete Your Account | Too Fresh To Waste',
    description:
      'Learn how to request deletion of your Too Fresh To Waste account and associated data.',
  });
}

const CONTACT_EMAIL = 'support@toofreshtowaste.com';
const COMPANY_NAME = 'Too Fresh To Waste';
const RETENTION_DAYS = 30;

export default function AccountDeletionPage() {
  return (
    <div className='min-h-screen bg-background'>
      {/* Hero Banner */}
      <section className='bg-primary-500 py-16 px-4'>
        <div className='max-w-4xl mx-auto text-center'>
          <h1 className='text-3xl md:text-4xl font-bold text-white mb-3'>Delete Your Account</h1>
          <p className='text-white/70 text-sm'>{COMPANY_NAME} — Account &amp; Data Deletion</p>
        </div>
      </section>

      {/* Content */}
      <article className='max-w-3xl mx-auto px-4 py-14 space-y-10 text-foreground'>
        {/* Overview */}
        <section>
          <h2 className='text-xl font-semibold mb-3'>Overview</h2>
          <p className='text-muted-foreground leading-relaxed'>
            You can permanently delete your <strong>{COMPANY_NAME}</strong> account at any time —
            either directly inside the mobile app or by contacting our support team. This page
            explains both methods, what data is removed, and what (if anything) we are required to
            retain.
          </p>
        </section>

        {/* Method 1 — In-app */}
        <section>
          <h2 className='text-xl font-semibold mb-4'>
            Method 1 — Delete from the Mobile App (Instant)
          </h2>
          <ol className='list-decimal list-inside space-y-2 text-muted-foreground'>
            <li>
              Open the <strong>Too Fresh To Waste</strong> app on your phone.
            </li>
            <li>
              Tap the <strong>Profile</strong> tab (bottom-right of the screen).
            </li>
            <li>
              Go to <strong>Privacy &amp; Data</strong>.
            </li>
            <li>
              Scroll to <strong>Danger Zone</strong> and tap <strong>Delete Account</strong>.
            </li>
            <li>Confirm in the dialog that appears.</li>
          </ol>
          <p className='text-muted-foreground mt-3 text-sm'>
            Your account is deactivated immediately. Personal data is anonymised or purged within{' '}
            <strong>{RETENTION_DAYS} days</strong>.
          </p>
        </section>

        {/* Method 2 — Email */}
        <section>
          <h2 className='text-xl font-semibold mb-4'>Method 2 — Request Deletion by Email</h2>
          <p className='text-muted-foreground leading-relaxed'>
            If you no longer have access to the app, send an email to{' '}
            <a
              href={`mailto:${CONTACT_EMAIL}?subject=Account%20Deletion%20Request`}
              className='text-primary underline underline-offset-4'
            >
              {CONTACT_EMAIL}
            </a>{' '}
            with the subject line <em>Account Deletion Request</em>. Include the email address or
            phone number registered to your account. We will process the request within{' '}
            <strong>7 business days</strong> and confirm by email.
          </p>
        </section>

        {/* What gets deleted */}
        <section>
          <h2 className='text-xl font-semibold mb-4'>What Is Deleted</h2>
          <ul className='list-disc list-inside space-y-1.5 text-muted-foreground'>
            <li>Your name, email address, and phone number</li>
            <li>Profile photo</li>
            <li>Saved addresses and location history</li>
            <li>Loyalty points balance</li>
            <li>Notification preferences and FCM tokens</li>
            <li>Favourites list</li>
          </ul>
        </section>

        {/* What is retained */}
        <section>
          <h2 className='text-xl font-semibold mb-4'>What We Retain (and Why)</h2>
          <p className='text-muted-foreground leading-relaxed mb-3'>
            Some records are anonymised and kept to satisfy legal or operational requirements. No
            retained record can identify you.
          </p>
          <ul className='list-disc list-inside space-y-1.5 text-muted-foreground'>
            <li>
              <strong>Order records</strong> — anonymised order history retained for accounting,
              fraud prevention, and merchant dispute resolution (required under Tunisian commercial
              law for 5 years).
            </li>
            <li>
              <strong>Review content</strong> — reviews you posted are anonymised (your name is
              replaced with &quot;Deleted User&quot;).
            </li>
            <li>
              <strong>Aggregate analytics</strong> — statistical summaries (e.g. total orders saved)
              that cannot be linked back to you.
            </li>
          </ul>
        </section>

        {/* Timeline */}
        <section>
          <h2 className='text-xl font-semibold mb-4'>Deletion Timeline</h2>
          <div className='overflow-x-auto'>
            <table className='w-full text-sm border border-border rounded-lg overflow-hidden'>
              <thead className='bg-muted text-muted-foreground'>
                <tr>
                  <th className='text-left px-4 py-3 font-medium'>Action</th>
                  <th className='text-left px-4 py-3 font-medium'>Timing</th>
                </tr>
              </thead>
              <tbody className='divide-y divide-border'>
                <tr>
                  <td className='px-4 py-3'>Account deactivated, sessions revoked</td>
                  <td className='px-4 py-3'>Immediately</td>
                </tr>
                <tr className='bg-muted/30'>
                  <td className='px-4 py-3'>Personal data anonymised or purged</td>
                  <td className='px-4 py-3'>Within {RETENTION_DAYS} days</td>
                </tr>
                <tr>
                  <td className='px-4 py-3'>Anonymised order records</td>
                  <td className='px-4 py-3'>Retained 5 years (legal requirement)</td>
                </tr>
                <tr className='bg-muted/30'>
                  <td className='px-4 py-3'>Deletion confirmation email sent</td>
                  <td className='px-4 py-3'>Within 7 business days (email requests)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Contact */}
        <section className='border border-border rounded-xl p-6'>
          <h2 className='text-xl font-semibold mb-2'>Questions?</h2>
          <p className='text-muted-foreground'>
            Contact our privacy team at{' '}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className='text-primary underline underline-offset-4'
            >
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </section>
      </article>
    </div>
  );
}
