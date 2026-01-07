import { NextRequest, NextResponse } from 'next/server';

// Rate limiting map (in-memory, for production use Redis or similar)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes in ms
const RATE_LIMIT_MAX_REQUESTS = 5;

function getRateLimitKey(request: NextRequest): string {
  // Get IP from various headers (supports proxies/CDN)
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const ip = forwarded?.split(',')[0] || realIp || 'unknown';
  return `newsletter:${ip}`;
}

function checkRateLimit(key: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const record = rateLimitMap.get(key);

  // Clean up expired entries
  if (record && now > record.resetTime) {
    rateLimitMap.delete(key);
  }

  const current = rateLimitMap.get(key);

  if (!current) {
    rateLimitMap.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1 };
  }

  if (current.count >= RATE_LIMIT_MAX_REQUESTS) {
    return { allowed: false, remaining: 0 };
  }

  current.count++;
  return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - current.count };
}

// Clean up rate limit map every hour
setInterval(
  () => {
    const now = Date.now();
    for (const [key, value] of rateLimitMap.entries()) {
      if (now > value.resetTime) {
        rateLimitMap.delete(key);
      }
    }
  },
  60 * 60 * 1000,
);

export async function POST(request: NextRequest) {
  try {
    // Check rate limit
    const rateLimitKey = getRateLimitKey(request);
    const rateLimit = checkRateLimit(rateLimitKey);

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 },
      );
    }

    // Parse request body
    const body = await request.json();
    const { email } = body;

    // Validate email
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    // Email length validation
    if (email.length > 254) {
      return NextResponse.json({ error: 'Email is too long' }, { status: 400 });
    }

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
    const sanitizedEmail = email.replace(/<[^>]*>/g, '').trim();

    // Send notification to support email
    const supportEmailResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'api-key': brevoApiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender: {
          name: 'Too Fresh To Waste',
          email: 'noreply@toofreshtowaste.com',
        },
        to: [
          {
            email: 'support@toofreshtowaste.com',
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
    const welcomeEmailResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'api-key': brevoApiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender: {
          name: 'Too Fresh To Waste',
          email: 'noreply@toofreshtowaste.com',
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
                          <a href="https://toofreshtowaste.com" style="background-color: #005250; color: #ffffff; padding: 15px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; display: inline-block;">
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
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
