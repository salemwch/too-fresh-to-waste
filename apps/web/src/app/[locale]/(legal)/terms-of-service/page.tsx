import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service | Too Fresh To Waste',
  description:
    'Read the Terms of Service for Too Fresh To Waste — the rules governing your use of our food-rescue marketplace platform.',
  robots: { index: true, follow: true },
};

const LAST_UPDATED = 'April 15, 2026';
const EFFECTIVE_DATE = 'April 15, 2026';
const CONTACT_EMAIL = 'legal@toofresh.tn';

export default function TermsOfServicePage() {
  return (
    <div className='min-h-screen bg-background'>
      {/* Hero Banner */}
      <section className='bg-primary-500 py-16 px-4'>
        <div className='max-w-4xl mx-auto text-center'>
          <h1 className='text-3xl md:text-4xl font-bold text-white mb-3'>Terms of Service</h1>
          <p className='text-white/70 text-sm'>
            Last updated: {LAST_UPDATED} &nbsp;·&nbsp; Effective: {EFFECTIVE_DATE}
          </p>
        </div>
      </section>

      {/* Content */}
      <article className='max-w-4xl mx-auto px-4 py-14'>
        <div className='space-y-10 text-foreground'>
          {/* Introduction */}
          <section>
            <p className='text-base leading-relaxed text-muted-foreground'>
              These Terms of Service ("<strong className='text-foreground'>Terms</strong>") govern
              your access to and use of the Too Fresh To Waste platform — including our mobile
              application, website, and associated services (collectively, the "
              <strong className='text-foreground'>Service</strong>") — operated by{' '}
              <strong className='text-foreground'>Too Fresh To Waste</strong> ("
              <strong className='text-foreground'>Company</strong>", "
              <strong className='text-foreground'>we</strong>", "
              <strong className='text-foreground'>us</strong>"). By creating an account or using the
              Service, you agree to be bound by these Terms. If you do not agree, do not use the
              Service.
            </p>
            <p className='text-sm text-muted-foreground mt-3'>
              These Terms are governed by the laws of Tunisia. Any dispute arising from these Terms
              shall be subject to the exclusive jurisdiction of the competent courts of Tunisia.
            </p>
          </section>

          <hr className='border-border' />

          {/* 1. Eligibility */}
          <section>
            <h2 className='text-xl font-bold text-primary-500 mb-4'>1. Eligibility</h2>
            <ul className='list-disc list-outside ms-5 space-y-1 text-sm text-muted-foreground'>
              <li>You must be at least 16 years old to create a consumer account.</li>
              <li>
                Merchants must be legally registered businesses in Tunisia with the authority to
                enter into binding agreements.
              </li>
              <li>
                By using the Service, you represent that you meet these requirements and that all
                information you provide is accurate and current.
              </li>
            </ul>
          </section>

          <hr className='border-border' />

          {/* 2. Account Responsibilities */}
          <section>
            <h2 className='text-xl font-bold text-primary-500 mb-4'>2. Account Responsibilities</h2>
            <p className='text-sm text-muted-foreground mb-3'>You are responsible for:</p>
            <ul className='list-disc list-outside ms-5 space-y-1 text-sm text-muted-foreground'>
              <li>
                Maintaining the confidentiality of your login credentials. You must not share your
                password or allow others to access your account.
              </li>
              <li>
                All activity that occurs under your account, whether or not you authorised it.
              </li>
              <li>
                Promptly notifying us at{' '}
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className='text-primary-500 underline underline-offset-2 hover:opacity-75'
                >
                  {CONTACT_EMAIL}
                </a>{' '}
                if you suspect unauthorised access.
              </li>
              <li>
                Providing accurate, truthful, and up-to-date information in your profile and
                listings.
              </li>
            </ul>
          </section>

          <hr className='border-border' />

          {/* 3. Food Listings & Merchant Obligations */}
          <section>
            <h2 className='text-xl font-bold text-primary-500 mb-4'>
              3. Food Listings &amp; Merchant Obligations
            </h2>
            <p className='text-sm text-muted-foreground mb-3'>
              Merchants who list food items on the platform agree to the following:
            </p>
            <ul className='list-disc list-outside ms-5 space-y-2 text-sm text-muted-foreground'>
              <li>
                <strong className='text-foreground'>Accuracy:</strong> All listings must accurately
                describe the food items, including allergen information, contents, and the
                collection window.
              </li>
              <li>
                <strong className='text-foreground'>Food safety:</strong> Items must comply with all
                applicable Tunisian food safety regulations at the time of listing and collection.
                Merchants are solely responsible for the quality, safety, and condition of food
                items they offer.
              </li>
              <li>
                <strong className='text-foreground'>Liability:</strong> The Company acts solely as a
                marketplace intermediary. We do not prepare, handle, store, or inspect food.
                Merchants bear full legal responsibility for the food they list and sell, including
                any claims arising from foodborne illness, allergic reactions, or mis-described
                products.
              </li>
              <li>
                <strong className='text-foreground'>Availability:</strong> Merchants must honour
                orders placed within the active listing window. Repeated cancellations or failure to
                fulfil orders may result in account suspension.
              </li>
              <li>
                <strong className='text-foreground'>Pricing:</strong> Listed prices must be
                genuinely discounted from the original retail price of the items.
              </li>
            </ul>
          </section>

          <hr className='border-border' />

          {/* 4. Consumer Obligations */}
          <section>
            <h2 className='text-xl font-bold text-primary-500 mb-4'>4. Consumer Obligations</h2>
            <ul className='list-disc list-outside ms-5 space-y-1 text-sm text-muted-foreground'>
              <li>
                Collect your order within the designated pickup window. Orders not collected may be
                forfeited without a refund.
              </li>
              <li>
                Use your unique pickup code honestly — generating or sharing fraudulent codes is
                prohibited.
              </li>
              <li>Do not resell items purchased through the platform for commercial gain.</li>
              <li>Treat merchants and their staff with respect during pickup interactions.</li>
            </ul>
          </section>

          <hr className='border-border' />

          {/* 5. Prohibited Conduct */}
          <section>
            <h2 className='text-xl font-bold text-primary-500 mb-4'>5. Prohibited Conduct</h2>
            <p className='text-sm text-muted-foreground mb-3'>
              The following are strictly prohibited:
            </p>
            <ul className='list-disc list-outside ms-5 space-y-1 text-sm text-muted-foreground'>
              <li>Creating fake accounts, listings, or reviews</li>
              <li>Using the Service for fraudulent transactions or money laundering</li>
              <li>Attempting to gain unauthorised access to any part of the platform</li>
              <li>
                Scraping, crawling, or using automated tools to extract data from the Service
                without prior written consent
              </li>
              <li>Posting content that is defamatory, discriminatory, or illegal</li>
              <li>Harassing or threatening other users or merchants</li>
              <li>
                Circumventing the platform to conduct off-platform transactions with contacts made
                through the Service
              </li>
              <li>
                Interfering with the integrity or performance of the Service or its infrastructure
              </li>
            </ul>
          </section>

          <hr className='border-border' />

          {/* 6. Payments & Refunds */}
          <section>
            <h2 className='text-xl font-bold text-primary-500 mb-4'>6. Payments &amp; Refunds</h2>
            <ul className='list-disc list-outside ms-5 space-y-1 text-sm text-muted-foreground'>
              <li>
                All prices are displayed in Tunisian Dinar (TND) and are inclusive of applicable
                taxes unless stated otherwise.
              </li>
              <li>
                Payments are processed through our third-party payment provider. By completing a
                purchase you agree to that provider&apos;s terms.
              </li>
              <li>
                Due to the perishable and discounted nature of food-rescue items, refunds are only
                issued in cases where: (a) the merchant cancels the order, (b) the food is
                materially different from the listing description, or (c) a verifiable food safety
                incident occurs. Disputes must be submitted within 24 hours of the scheduled pickup
                time.
              </li>
            </ul>
          </section>

          <hr className='border-border' />

          {/* 7. Intellectual Property */}
          <section>
            <h2 className='text-xl font-bold text-primary-500 mb-4'>7. Intellectual Property</h2>
            <p className='text-sm text-muted-foreground'>
              All content created by Too Fresh To Waste — including logos, design, code, and text —
              is owned by the Company or its licensors and protected by copyright and trademark law.
              You may not reproduce, distribute, or create derivative works without prior written
              permission.
            </p>
            <p className='text-sm text-muted-foreground mt-2'>
              By uploading content (photos, descriptions) to the platform, you grant us a
              non-exclusive, worldwide, royalty-free licence to display and use that content solely
              for operating and promoting the Service.
            </p>
          </section>

          <hr className='border-border' />

          {/* 8. Limitation of Liability */}
          <section>
            <h2 className='text-xl font-bold text-primary-500 mb-4'>8. Limitation of Liability</h2>
            <p className='text-sm text-muted-foreground mb-3'>
              To the maximum extent permitted by Tunisian law:
            </p>
            <ul className='list-disc list-outside ms-5 space-y-2 text-sm text-muted-foreground'>
              <li>
                The Service is provided on an "<strong className='text-foreground'>as is</strong>"
                and "<strong className='text-foreground'>as available</strong>" basis. We make no
                warranty that the Service will be uninterrupted, error-free, or free of harmful
                components.
              </li>
              <li>
                The Company is not liable for any indirect, incidental, special, or consequential
                damages arising from your use of the Service, including loss of data, loss of
                profit, or personal injury resulting from consumed food.
              </li>
              <li>
                Our total liability for any claim arising from these Terms shall not exceed the
                amount you paid to us in the 3 months preceding the claim.
              </li>
              <li>
                We are not responsible for the conduct, listings, or food quality of any merchant on
                the platform.
              </li>
            </ul>
          </section>

          <hr className='border-border' />

          {/* 9. Service Availability */}
          <section>
            <h2 className='text-xl font-bold text-primary-500 mb-4'>9. Service Availability</h2>
            <p className='text-sm text-muted-foreground'>
              We do not guarantee continuous, uninterrupted access to the Service. Scheduled
              maintenance, technical issues, or events beyond our control (force majeure) may cause
              downtime. We will make reasonable efforts to provide advance notice of planned
              maintenance.
            </p>
          </section>

          <hr className='border-border' />

          {/* 10. Account Termination */}
          <section>
            <h2 className='text-xl font-bold text-primary-500 mb-4'>10. Account Termination</h2>
            <p className='text-sm text-muted-foreground mb-2'>
              <strong className='text-foreground'>By you:</strong> You may delete your account at
              any time from the account settings. Pending orders must be resolved before deletion.
            </p>
            <p className='text-sm text-muted-foreground mb-2'>
              <strong className='text-foreground'>By us:</strong> We reserve the right to suspend or
              permanently terminate your account without prior notice if we determine, at our sole
              discretion, that you have:
            </p>
            <ul className='list-disc list-outside ms-5 space-y-1 text-sm text-muted-foreground'>
              <li>Violated any provision of these Terms</li>
              <li>Engaged in fraudulent, abusive, or illegal activity</li>
              <li>Caused harm to other users, merchants, or the Company</li>
            </ul>
            <p className='text-sm text-muted-foreground mt-2'>
              Sections 7, 8, 9, 10, and 11 survive termination.
            </p>
          </section>

          <hr className='border-border' />

          {/* 11. Indemnification */}
          <section>
            <h2 className='text-xl font-bold text-primary-500 mb-4'>11. Indemnification</h2>
            <p className='text-sm text-muted-foreground'>
              You agree to indemnify, defend, and hold harmless Too Fresh To Waste and its officers,
              directors, employees, and agents from any claims, damages, losses, liabilities, and
              expenses (including legal fees) arising from your use of the Service, your violation
              of these Terms, or your violation of any rights of a third party.
            </p>
          </section>

          <hr className='border-border' />

          {/* 12. Changes */}
          <section>
            <h2 className='text-xl font-bold text-primary-500 mb-4'>12. Changes to These Terms</h2>
            <p className='text-sm text-muted-foreground'>
              We may revise these Terms from time to time. Material changes will be communicated via
              email or an in-app notification at least 7 days in advance. Your continued use of the
              Service after the effective date of the revised Terms constitutes your acceptance of
              the changes.
            </p>
          </section>

          <hr className='border-border' />

          {/* 13. Contact */}
          <section>
            <h2 className='text-xl font-bold text-primary-500 mb-4'>13. Contact</h2>
            <p className='text-sm text-muted-foreground'>
              For questions about these Terms, contact:
            </p>
            <div className='mt-3 p-4 bg-muted rounded-lg text-sm space-y-1'>
              <p>
                <strong className='text-foreground'>Too Fresh To Waste — Legal</strong>
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
