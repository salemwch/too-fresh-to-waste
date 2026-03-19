import { NextRequest, NextResponse } from 'next/server';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { z } from 'zod';

// ─── Brevo configuration (centralised, no hardcoded values in route body) ─────
const BREVO_API_BASE = process.env['BREVO_API_BASE_URL'] || 'https://api.brevo.com/v3';
const BREVO_LIST_ID = parseInt(process.env['BREVO_LIST_ID'] || '2', 10);
const SENDER_EMAIL = process.env['BREVO_SENDER_EMAIL'] || 'noreply@toofreshtowaste.com';
const SUPPORT_EMAIL = process.env['BREVO_SUPPORT_EMAIL'] || 'support@toofreshtowaste.com';
const SITE_URL = process.env['NEXT_PUBLIC_SITE_URL'] || 'http://localhost:3001';

// ─── Rate limiting ────────────────────────────────────────────────────────────
// Production: Upstash Redis (survives serverless cold starts, shared across instances)
// Development: in-memory fallback (no Redis required locally)
const RATE_LIMIT_MAX_REQUESTS = 5;
const RATE_LIMIT_WINDOW_SECONDS = 15 * 60; // 15 minutes

const upstashUrl = process.env['UPSTASH_REDIS_REST_URL'];
const upstashToken = process.env['UPSTASH_REDIS_REST_TOKEN'];

const ratelimit =
  upstashUrl && upstashToken
    ? new Ratelimit({
        redis: new Redis({ url: upstashUrl, token: upstashToken }),
        limiter: Ratelimit.slidingWindow(RATE_LIMIT_MAX_REQUESTS, `${RATE_LIMIT_WINDOW_SECONDS} s`),
        prefix: 'newsletter',
        analytics: true,
      })
    : null;

// In-memory fallback for local development (NOT production-safe)
const memoryRateLimitMap = new Map<string, { count: number; resetTime: number }>();

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  return forwarded?.split(',')[0]?.trim() || realIp || 'unknown';
}

async function checkRateLimit(
  request: NextRequest,
): Promise<{ allowed: boolean; remaining: number }> {
  const ip = getClientIp(request);

  // Production path — Redis-backed, survives cold starts
  if (ratelimit) {
    const result = await ratelimit.limit(ip);
    return { allowed: result.success, remaining: result.remaining };
  }

  // Development fallback — in-memory only
  const key = `newsletter:${ip}`;
  const now = Date.now();
  const record = memoryRateLimitMap.get(key);

  if (record && now > record.resetTime) {
    memoryRateLimitMap.delete(key);
  }

  const current = memoryRateLimitMap.get(key);

  if (!current) {
    memoryRateLimitMap.set(key, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW_SECONDS * 1000,
    });
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1 };
  }

  if (current.count >= RATE_LIMIT_MAX_REQUESTS) {
    return { allowed: false, remaining: 0 };
  }

  current.count++;
  return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - current.count };
}

// Subscription tracking (in-memory, persists for server lifetime)
const subscribedEmails = new Set<string>();

export async function POST(request: NextRequest) {
  try {
    // ─── CSRF protection: reject cross-origin requests ─────────────────────
    const origin = request.headers.get('origin');
    if (origin && origin !== SITE_URL) {
      return NextResponse.json(
        { error: 'Cross-origin requests are not allowed.' },
        { status: 403 },
      );
    }

    // Check rate limit (Redis in production, in-memory in dev)
    const rateLimit = await checkRateLimit(request);

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 },
      );
    }

    // Parse and validate request body with zod
    const bodySchema = z.object({
      email: z.string().email('Invalid email format').max(254, 'Email is too long'),
    });

    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      const message = parsed.error.errors[0]?.message ?? 'Invalid input';
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const { email } = parsed.data;

    // Check if Brevo API key is configured
    const brevoApiKey = process.env['BREVO_API_KEY'];
    if (!brevoApiKey) {
      console.error('BREVO_API_KEY not configured');
      return NextResponse.json(
        { error: 'Newsletter service not configured. Please contact support.' },
        { status: 503 },
      );
    }

    // Sanitize email (remove any HTML tags, just in case)
    const sanitizedEmail = email.replace(/<[^>]*>/g, '').trim().toLowerCase();

    // Check if email is already subscribed (in-memory check)
    if (subscribedEmails.has(sanitizedEmail)) {
      return NextResponse.json(
        {
          error: "You're already subscribed! We'll keep you updated.",
          code: 'ALREADY_SUBSCRIBED'
        },
        { status: 409 }
      );
    }

    // Check if contact already exists in Brevo
    try {
      const checkContactResponse = await fetch(
        `${BREVO_API_BASE}/contacts/${encodeURIComponent(sanitizedEmail)}`,
        {
          method: 'GET',
          headers: {
            accept: 'application/json',
            'api-key': brevoApiKey,
          },
        }
      );

      // If contact exists (status 200), they're already subscribed
      if (checkContactResponse.ok) {
        subscribedEmails.add(sanitizedEmail);
        return NextResponse.json(
          {
            error: "You're already subscribed! We'll keep you updated.",
            code: 'ALREADY_SUBSCRIBED'
          },
          { status: 409 }
        );
      }
      // If status is 404, contact doesn't exist - proceed with subscription
      // Any other status, we'll log it and proceed anyway
      if (checkContactResponse.status !== 404) {
        console.warn('Unexpected status when checking contact:', checkContactResponse.status);
      }
    } catch (checkError) {
      console.error('Error checking contact in Brevo:', checkError);
      // Continue with subscription even if check fails
    }

    // Add to Brevo contacts list
    try {
      const addContactResponse = await fetch(`${BREVO_API_BASE}/contacts`, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'api-key': brevoApiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          email: sanitizedEmail,
          listIds: [BREVO_LIST_ID],
          updateEnabled: false, // Don't update if already exists
          attributes: {
            SUBSCRIBED_AT: new Date().toISOString(),
            SOURCE: 'Website Newsletter',
          },
        }),
      });

      const addContactData = await addContactResponse.json();

      // If contact already exists in list (duplicate)
      if (addContactResponse.status === 400 && addContactData.code === 'duplicate_parameter') {
        subscribedEmails.add(sanitizedEmail);
        return NextResponse.json(
          {
            error: "You're already subscribed! We'll keep you updated.",
            code: 'ALREADY_SUBSCRIBED'
          },
          { status: 409 }
        );
      }

      if (!addContactResponse.ok && addContactResponse.status !== 400) {
        console.error('Error adding contact to Brevo:', addContactData);
        // Continue to send emails even if list addition fails
      }
    } catch (contactError) {
      console.error('Error managing contact in Brevo:', contactError);
      // Continue with sending emails
    }

    // Mark email as subscribed
    subscribedEmails.add(sanitizedEmail);

    // Send notification to support email
    const supportEmailResponse = await fetch(`${BREVO_API_BASE}/smtp/email`, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'api-key': brevoApiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender: {
          name: 'Too Fresh To Waste',
          email: SENDER_EMAIL,
        },
        to: [
          {
            email: SUPPORT_EMAIL,
            name: 'Too Fresh To Waste Support',
          },
        ],
        subject: 'New Newsletter Subscription - First 1000 Users',
        htmlContent: `
          <h2>New Newsletter Subscription</h2>
          <p><strong>Email:</strong> ${sanitizedEmail}</p>
          <p>This user has subscribed to be part of the first 1000 users and receive updates about the official app announcement.</p>
          <p><em>Subscribed on: ${new Date().toLocaleString()}</em></p>
        `,
      }),
    });

    if (!supportEmailResponse.ok) {
      const errorText = await supportEmailResponse.text();
      console.error('Brevo API error (support email):', errorText);
      throw new Error('Failed to send notification email');
    }

    // Send welcome email to subscriber
    const welcomeEmailResponse = await fetch(`${BREVO_API_BASE}/smtp/email`, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'api-key': brevoApiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender: {
          name: 'Too Fresh To Waste',
          email: SENDER_EMAIL,
        },
        to: [
          {
            email: sanitizedEmail,
            name: 'Valued Subscriber',
          },
        ],
        subject: "Welcome to Too Fresh To Waste - You're in the First 1000!",
        htmlContent: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f9f3f0;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9f3f0; padding: 20px;">
              <tr>
                <td align="center">
                  <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                    <!-- Header -->
                    <tr>
                      <td style="background-color: #005250; padding: 30px 20px; text-align: center;">
                        <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Welcome to Too Fresh To Waste!</h1>
                      </td>
                    </tr>

                    <!-- Content -->
                    <tr>
                      <td style="padding: 40px 30px;">
                        <h2 style="color: #005250; margin-top: 0;">Thank You for Joining Us! 🎉</h2>

                        <p style="color: #333333; line-height: 1.6; font-size: 16px;">
                          We're thrilled to have you as part of our mission to reduce food waste in Tunisia!
                        </p>

                        <p style="color: #333333; line-height: 1.6; font-size: 16px;">
                          <strong>You're now part of our exclusive first 1000 users!</strong> This means you'll be among the first to:
                        </p>

                        <ul style="color: #333333; line-height: 1.8; font-size: 16px;">
                          <li>Receive a <strong>special surprise</strong> when we launch 🎁</li>
                          <li>Get early access to the app before everyone else</li>
                          <li>Be notified about our official app announcement</li>
                          <li>Enjoy exclusive benefits and rewards</li>
                        </ul>

                        <p style="color: #333333; line-height: 1.6; font-size: 16px;">
                          Stay tuned for updates - we can't wait to share what we have in store for you!
                        </p>

                        <div style="text-align: center; margin: 30px 0;">
                          <a href="${SITE_URL}" style="background-color: #005250; color: #ffffff; padding: 15px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; display: inline-block;">
                            Visit Our Website
                          </a>
                        </div>

                        <p style="color: #666666; line-height: 1.6; font-size: 14px; margin-top: 30px;">
                          Together, let's save food, save money, and save the planet! 🌍
                        </p>
                      </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                      <td style="background-color: #f9f3f0; padding: 20px; text-align: center;">
                        <p style="color: #666666; font-size: 12px; margin: 0;">
                          © ${new Date().getFullYear()} Too Fresh To Waste Tunisia. All rights reserved.
                        </p>
                        <p style="color: #666666; font-size: 12px; margin: 10px 0 0 0;">
                          Tunis • Sousse • Sfax • Monastir • Hammamet
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
          </html>
        `,
      }),
    });

    if (!welcomeEmailResponse.ok) {
      const errorText = await welcomeEmailResponse.text();
      console.error('Brevo API error (welcome email):', errorText);
      // Don't fail the request if welcome email fails, user is still subscribed
    }

    return NextResponse.json(
      { success: true, message: 'Successfully subscribed to newsletter' },
      { status: 200 },
    );
  } catch (error) {
    console.error('Newsletter API error:', error);
    return NextResponse.json(
      { error: 'Failed to process subscription. Please try again later.' },
      { status: 500 },
    );
  }
}

// Handle OPTIONS for CORS preflight
export async function OPTIONS() {
  const allowedOrigin = SITE_URL;
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
