import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms and Conditions | Too Fresh To Waste',
  description:
    'Read the Terms and Conditions governing your use of the Too Fresh To Waste food-rescue platform in Tunisia.',
  robots: { index: true, follow: true },
};

const LAST_UPDATED = 'April 15, 2026';
const EFFECTIVE_DATE = 'April 15, 2026';
const CONTACT_EMAIL = 'legal@toofresh.tn';

export default function TermsAndConditionsPage() {
  return (
    <div className='min-h-screen bg-background'>
      {/* Hero Banner */}
      <section className='bg-primary-500 py-16 px-4'>
        <div className='max-w-4xl mx-auto text-center'>
          <h1 className='text-3xl md:text-4xl font-bold text-white mb-3'>Terms and Conditions</h1>
          <p className='text-white/70 text-sm'>
            Last updated: {LAST_UPDATED} &nbsp;·&nbsp; Effective: {EFFECTIVE_DATE}
          </p>
        </div>
      </section>

      {/* Content */}
      <article className='max-w-4xl mx-auto px-4 py-14'>
        <div className='space-y-10 text-foreground'>
          {/* 1. Joining the Movement */}
          <section>
            <h2 className='text-xl font-bold text-primary-500 mb-3'>
              1. Joining the Too Fresh To Waste Movement
            </h2>
            <p className='text-sm leading-relaxed text-muted-foreground mb-3'>
              We dream of a Tunisia with no food waste. Too Fresh To Waste ("
              <strong className='text-foreground'>TFTW</strong>", "
              <strong className='text-foreground'>we</strong>", "
              <strong className='text-foreground'>us</strong>") is on a mission to rescue delicious
              surplus food that would otherwise be thrown away. Our platform connects consumers like
              you with local food businesses — restaurants, bakeries, cafés, supermarkets, and more
              — that have unsold food at the end of the day.
            </p>
            <p className='text-sm leading-relaxed text-muted-foreground mb-3'>
              Businesses list their surplus food as{' '}
              <strong className='text-foreground'>Surprise Bags</strong> — bags filled with whatever
              great food they have left. You reserve a Surprise Bag through the app, pay a
              discounted price, and collect it in person or have it delivered to you. Every bag
              saved is a meal rescued.
            </p>
            <p className='text-sm leading-relaxed text-muted-foreground'>
              Important: TFTW does not own, prepare, store, or handle any Surprise Bags. We are a
              marketplace intermediary only. The sale of food takes place exclusively between you
              and the Store.
            </p>
          </section>

          <hr className='border-border' />

          {/* 2. What's Covered */}
          <section>
            <h2 className='text-xl font-bold text-primary-500 mb-3'>2. What These Terms Cover</h2>
            <p className='text-sm leading-relaxed text-muted-foreground mb-3'>
              These Terms and Conditions ("<strong className='text-foreground'>Terms</strong>") are
              a binding legal agreement between you and Too Fresh To Waste governing your use of our
              website, mobile app, and all related services (collectively, the "
              <strong className='text-foreground'>Platform</strong>"). By accessing or using any
              part of the Platform, you accept these Terms in full. If you do not agree, do not use
              the Platform.
            </p>
            <p className='text-sm leading-relaxed text-muted-foreground mb-2'>These Terms cover:</p>
            <ul className='list-disc list-outside ms-5 space-y-1 text-sm text-muted-foreground'>
              <li>What you can expect from us and our Platform</li>
              <li>What we expect from you when using the Platform</li>
              <li>How reservations, pickup, and delivery work</li>
              <li>Payments, refunds, and cancellations</li>
            </ul>
            <p className='text-sm leading-relaxed text-muted-foreground mt-3'>
              These Terms are governed by the laws of Tunisia. By accepting them, you confirm that
              you have also read and accepted our{' '}
              <a
                href='/privacy-policy'
                className='text-primary-500 underline underline-offset-2 hover:opacity-75'
              >
                Privacy Policy
              </a>
              .
            </p>
          </section>

          <hr className='border-border' />

          {/* 3. Using TFTW */}
          <section>
            <h2 className='text-xl font-bold text-primary-500 mb-5'>3. Using Too Fresh To Waste</h2>

            <div className='space-y-6'>
              <div>
                <h3 className='text-base font-bold text-primary-500 mb-2'>3.1 How It Works</h3>
                <p className='text-sm text-muted-foreground mb-2'>
                  Saving a meal from waste is simple:
                </p>
                <ol className='list-decimal list-outside ms-5 space-y-1 text-sm text-muted-foreground'>
                  <li>A Store lists a Surprise Bag with available surplus food.</li>
                  <li>
                    You browse available Bags on the Platform — near you or across Tunisia.
                    Location-based results require your permission to share your location.
                  </li>
                  <li>You reserve the Bag and pay securely through the Platform.</li>
                  <li>
                    You collect your Bag during the Store's pickup window, or choose delivery if the
                    Store offers it.
                  </li>
                </ol>
              </div>

              <div>
                <h3 className='text-base font-bold text-primary-500 mb-2'>3.2 Your Account</h3>
                <p className='text-sm text-muted-foreground mb-2'>
                  You must create an account to use the Platform. Keep your information accurate and
                  up to date. You are responsible for all activity that happens under your account.
                  You must not:
                </p>
                <ul className='list-disc list-outside ms-5 space-y-1 text-sm text-muted-foreground'>
                  <li>Share your account or login credentials with anyone else</li>
                  <li>Create an account on behalf of another person without their consent</li>
                  <li>
                    Use a username that is offensive, misleading, or impersonates someone else
                  </li>
                  <li>
                    Create a new account after a previous one has been suspended or terminated
                  </li>
                </ul>
                <p className='text-sm text-muted-foreground mt-2'>
                  If you suspect unauthorised access to your account, contact us immediately at{' '}
                  <a
                    href={`mailto:${CONTACT_EMAIL}`}
                    className='text-primary-500 underline underline-offset-2 hover:opacity-75'
                  >
                    {CONTACT_EMAIL}
                  </a>
                  .
                </p>
              </div>

              <div>
                <h3 className='text-base font-bold text-primary-500 mb-2'>3.3 Reservations</h3>
                <p className='text-sm text-muted-foreground'>
                  When you reserve a Surprise Bag, you are making an offer to the Store to purchase
                  that Bag. The reservation is not a guaranteed purchase — on rare occasions a Store
                  may not have the food they anticipated. The actual sale is completed only at the
                  moment of pickup or confirmed delivery.
                </p>
              </div>

              <div>
                <h3 className='text-base font-bold text-primary-500 mb-2'>3.4 Pickup</h3>
                <p className='text-sm text-muted-foreground'>
                  If you choose pickup, you must collect your Surprise Bag at the Store during the
                  time window shown in the app. Show your order confirmation to the Store and swipe
                  it in the app to complete the handover. If you do not collect within the stated
                  window, the Bag may no longer be available and you may still be charged for the
                  reservation.
                </p>
              </div>

              <div>
                <h3 className='text-base font-bold text-primary-500 mb-2'>3.5 Delivery</h3>
                <p className='text-sm text-muted-foreground'>
                  Some Stores offer delivery within a defined area. When delivery is available, you
                  will see it as an option at checkout. Delivery times and fees (if any) are shown
                  before you confirm the order. TFTW is not responsible for delays caused by
                  traffic, weather, or circumstances outside our control. By choosing delivery, you
                  confirm that your address is correct and that someone will be available to receive
                  the order.
                </p>
              </div>

              <div>
                <h3 className='text-base font-bold text-primary-500 mb-2'>3.6 Cancellations</h3>
                <div className='space-y-2 text-sm text-muted-foreground'>
                  <p>
                    <strong className='text-foreground'>By you:</strong> You may cancel a
                    reservation in the app at any time before the end of the pickup window or before
                    delivery has been dispatched. Cancellations after that point may still be
                    charged.
                  </p>
                  <p>
                    <strong className='text-foreground'>By the Store:</strong> Stores may cancel up
                    to one hour before the pickup window if they do not have sufficient surplus
                    food. In exceptional circumstances, later cancellations are possible. You will
                    be notified and fully refunded.
                  </p>
                  <p>
                    <strong className='text-foreground'>By TFTW:</strong> We may cancel reservations
                    when necessary — for example due to a food safety concern, dispute, or technical
                    issue — and will refund you accordingly.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <hr className='border-border' />

          {/* 4. Contents of Surprise Bags */}
          <section>
            <h2 className='text-xl font-bold text-primary-500 mb-3'>
              4. Contents of Surprise Bags
            </h2>
            <p className='text-sm text-muted-foreground mb-3'>
              TFTW has no visibility into the contents of any Surprise Bag. We do not manufacture,
              prepare, store, inspect, or handle the food. The Store is solely responsible for the
              quality, safety, ingredients, allergen information, and labelling of the food they
              provide.
            </p>
            <p className='text-sm text-muted-foreground mb-3'>
              Before or upon collection, the Store must give you information about ingredients and
              allergens. If you have any doubts or allergies, confirm with the Store directly before
              completing the handover. TFTW accepts no liability for adverse reactions arising from
              the contents of a Surprise Bag.
            </p>
            <p className='text-sm text-muted-foreground'>
              All food items must comply with applicable Tunisian food safety regulations. If you
              have a complaint about the food you received, contact the Store first. You may also
              report the issue to us through the Help section of the app.
            </p>
          </section>

          <hr className='border-border' />

          {/* 5. Price, Payment, Refunds */}
          <section>
            <h2 className='text-xl font-bold text-primary-500 mb-5'>
              5. Price, Payment &amp; Refunds
            </h2>

            <div className='space-y-5'>
              <div>
                <h3 className='text-base font-bold text-primary-500 mb-2'>5.1 Pricing</h3>
                <p className='text-sm text-muted-foreground'>
                  All prices are displayed in Tunisian Dinar (TND) and include applicable taxes
                  unless stated otherwise. The listed price represents a genuine discount from the
                  original retail value of the food.
                </p>
              </div>

              <div>
                <h3 className='text-base font-bold text-primary-500 mb-2'>5.2 Payment</h3>
                <p className='text-sm text-muted-foreground'>
                  Payment is collected by TFTW on behalf of the Store at the time of reservation. We
                  accept the payment methods listed in the app. Your card or payment details are
                  handled by our PCI-DSS compliant payment processor — TFTW does not store your raw
                  card data.
                </p>
              </div>

              <div>
                <h3 className='text-base font-bold text-primary-500 mb-2'>5.3 Refunds</h3>
                <p className='text-sm text-muted-foreground'>
                  Refunds are issued in the following circumstances: the Store cancels your order;
                  the food received is materially different from the listing; or a food safety issue
                  is verified. Refund requests must be submitted through the app within 24 hours of
                  the scheduled pickup time or delivery. We do not offer refunds for change of mind
                  or failure to collect within the pickup window.
                </p>
              </div>
            </div>
          </section>

          <hr className='border-border' />

          {/* 6. Complaints */}
          <section>
            <h2 className='text-xl font-bold text-primary-500 mb-3'>6. Complaints</h2>
            <p className='text-sm text-muted-foreground'>
              If something goes wrong, contact us first through the Help section in the app or at{' '}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className='text-primary-500 underline underline-offset-2 hover:opacity-75'
              >
                {CONTACT_EMAIL}
              </a>
              . Please include your order number and a description of the issue. We will investigate
              and respond promptly. These Terms do not limit any rights you may have under Tunisian
              consumer protection law.
            </p>
          </section>

          <hr className='border-border' />

          {/* 7. Your Responsibilities */}
          <section>
            <h2 className='text-xl font-bold text-primary-500 mb-3'>7. Your Responsibilities</h2>
            <p className='text-sm text-muted-foreground mb-3'>
              By using the Platform you agree to:
            </p>
            <ul className='list-disc list-outside ms-5 space-y-1.5 text-sm text-muted-foreground'>
              <li>
                Comply with all applicable Tunisian laws and regulations when using the Platform
              </li>
              <li>Only place reservations you genuinely intend to collect or receive</li>
              <li>Treat Store staff and TFTW personnel with respect</li>
              <li>
                Not use the Platform for any commercial resale, benchmarking, or competitive
                intelligence purposes
              </li>
              <li>
                Not upload viruses, scrape data, reverse-engineer, or interfere with the Platform in
                any way
              </li>
              <li>Not create fake accounts, fake reviews, or fraudulent orders</li>
              <li>
                Not distribute misleading, defamatory, or illegal content through the Platform
              </li>
              <li>
                Immediately notify us of any security breach or unauthorised use of your account
              </li>
            </ul>
            <p className='text-sm text-muted-foreground mt-3'>
              We may suspend or terminate your account without notice if we believe you have
              violated any of the above.
            </p>
          </section>

          <hr className='border-border' />

          {/* 8. Privacy */}
          <section>
            <h2 className='text-xl font-bold text-primary-500 mb-3'>8. Privacy</h2>
            <p className='text-sm text-muted-foreground'>
              We take your privacy seriously. When you use the Platform, we collect and process
              personal data about you in accordance with our{' '}
              <a
                href='/privacy-policy'
                className='text-primary-500 underline underline-offset-2 hover:opacity-75'
              >
                Privacy Policy
              </a>
              , which complies with Tunisian data protection law (INPDP) and applicable
              international standards.
            </p>
          </section>

          <hr className='border-border' />

          {/* 9. Limitation of Liability */}
          <section>
            <h2 className='text-xl font-bold text-primary-500 mb-3'>9. Limitation of Liability</h2>
            <p className='text-sm text-muted-foreground mb-3'>
              To the maximum extent permitted by Tunisian law:
            </p>
            <ul className='list-disc list-outside ms-5 space-y-1.5 text-sm text-muted-foreground'>
              <li>
                The Platform is provided on an "as is" and "as available" basis. We make no warranty
                that it will be uninterrupted or error-free.
              </li>
              <li>
                TFTW is not liable for the acts or omissions of any Store, including the quality,
                safety, or contents of any Surprise Bag.
              </li>
              <li>
                We are not liable for indirect, incidental, or consequential damages arising from
                your use of the Platform.
              </li>
              <li>
                Our total liability for any claim shall not exceed the total amount you paid to us
                in the three months preceding the event giving rise to the claim.
              </li>
            </ul>
            <p className='text-sm text-muted-foreground mt-3'>
              You agree to indemnify and hold harmless TFTW, its officers, employees, and partners
              from any claim or expense arising from your violation of these Terms or misuse of the
              Platform.
            </p>
          </section>

          <hr className='border-border' />

          {/* 10. Intellectual Property */}
          <section>
            <h2 className='text-xl font-bold text-primary-500 mb-3'>10. Intellectual Property</h2>
            <p className='text-sm text-muted-foreground mb-2'>
              All content, design, code, trademarks, and logos on the Platform are owned by TFTW or
              its licensors. You may not copy, reproduce, modify, or distribute any part of the
              Platform without our prior written consent.
            </p>
            <p className='text-sm text-muted-foreground'>
              By uploading content (photos, descriptions, reviews) you grant us a non-exclusive,
              royalty-free licence to use that content solely for operating and promoting the
              Platform.
            </p>
          </section>

          <hr className='border-border' />

          {/* 11. Suspension & Termination */}
          <section>
            <h2 className='text-xl font-bold text-primary-500 mb-3'>
              11. Suspension &amp; Termination
            </h2>
            <p className='text-sm text-muted-foreground mb-2'>
              We may suspend or permanently terminate your access to the Platform at our discretion,
              without prior notice, if:
            </p>
            <ul className='list-disc list-outside ms-5 space-y-1 text-sm text-muted-foreground'>
              <li>You breach these Terms materially or repeatedly</li>
              <li>We are required to do so by law or court order</li>
              <li>Your conduct causes harm or liability to TFTW, a Store, or another user</li>
              <li>You are inactive on the Platform for an extended period</li>
            </ul>
            <p className='text-sm text-muted-foreground mt-2'>
              You may delete your account at any time from the account settings. If you believe your
              account was suspended in error, contact us at{' '}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className='text-primary-500 underline underline-offset-2 hover:opacity-75'
              >
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          </section>

          <hr className='border-border' />

          {/* 12. General */}
          <section>
            <h2 className='text-xl font-bold text-primary-500 mb-5'>12. General</h2>

            <div className='space-y-4'>
              <div>
                <h3 className='text-base font-bold text-primary-500 mb-1'>
                  12.1 Changes to These Terms
                </h3>
                <p className='text-sm text-muted-foreground'>
                  We may update these Terms from time to time. Material changes will be notified via
                  email or in-app notification at least 7 days before they take effect. Your
                  continued use of the Platform after the effective date constitutes acceptance of
                  the updated Terms. If you do not agree, you may delete your account.
                </p>
              </div>

              <div>
                <h3 className='text-base font-bold text-primary-500 mb-1'>
                  12.2 Third-Party Links
                </h3>
                <p className='text-sm text-muted-foreground'>
                  The Platform may contain links to third-party websites. We are not responsible for
                  the content or practices of those sites and encourage you to read their own terms
                  and privacy policies.
                </p>
              </div>

              <div>
                <h3 className='text-base font-bold text-primary-500 mb-1'>12.3 Severability</h3>
                <p className='text-sm text-muted-foreground'>
                  If any provision of these Terms is found to be unenforceable, that provision will
                  be modified to reflect the original intent to the fullest extent permitted by law.
                  All other provisions remain in full force.
                </p>
              </div>

              <div>
                <h3 className='text-base font-bold text-primary-500 mb-1'>
                  12.4 Governing Law &amp; Disputes
                </h3>
                <p className='text-sm text-muted-foreground'>
                  These Terms are governed by the laws of Tunisia. Any dispute arising from or
                  related to these Terms shall be submitted to the exclusive jurisdiction of the
                  competent courts of Tunisia. We encourage you to contact us first — most issues
                  can be resolved quickly and amicably.
                </p>
              </div>

              <div>
                <h3 className='text-base font-bold text-primary-500 mb-1'>12.5 Contact Us</h3>
                <p className='text-sm text-muted-foreground'>
                  Questions about these Terms? Reach us at{' '}
                  <a
                    href={`mailto:${CONTACT_EMAIL}`}
                    className='text-primary-500 underline underline-offset-2 hover:opacity-75'
                  >
                    {CONTACT_EMAIL}
                  </a>
                  .
                </p>
              </div>
            </div>
          </section>
        </div>
      </article>
    </div>
  );
}
