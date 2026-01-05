# Security Improvements: Server-Side API Implementation

## Summary

Migrated newsletter subscription from **client-side** to **server-side** API
route to protect API keys and implement proper security measures.

---

## 🚨 Previous Security Issue

### Before (Insecure)

```typescript
// Client component - EXPOSED API KEY IN BROWSER!
const response = await fetch('https://api.brevo.com/v3/smtp/email', {
  headers: {
    'api-key': process.env.NEXT_PUBLIC_BREVO_API_KEY, // ❌ EXPOSED!
  },
});
```

**Problems:**

- ❌ API key visible in browser DevTools
- ❌ Anyone can steal and misuse the key
- ❌ No rate limiting
- ❌ No server-side validation
- ❌ Client can bypass validation
- ❌ Difficult to monitor and log requests

---

## ✅ Current Implementation (Secure)

### Architecture

```
User Browser → Next.js API Route → Brevo API
            (public)         (secure, server-side)
```

### Flow

1. **Client** (`Newsletter.tsx`):
   - Validates email format (basic check)
   - Sends request to `/api/newsletter`
   - No API key exposure

2. **Server** (`app/api/newsletter/route.ts`):
   - Rate limiting (5 requests per 15 min per IP)
   - Server-side validation
   - Email sanitization
   - Calls Brevo API with secure API key
   - Sends both notification and welcome emails
   - Returns success/error to client

3. **Brevo API**:
   - Receives authenticated request from server
   - Sends emails

---

## Files Changed

### 1. Created: `apps/web/src/app/api/newsletter/route.ts`

**Purpose:** Server-side API endpoint for newsletter subscriptions

**Features:**

- ✅ Rate limiting (in-memory, 5 requests per 15 min)
- ✅ Email validation (format, length)
- ✅ Email sanitization (XSS prevention)
- ✅ Error handling with appropriate status codes
- ✅ Logging for debugging
- ✅ CORS support
- ✅ Secure API key handling (server-side only)

**Endpoints:**

- `POST /api/newsletter` - Subscribe to newsletter
- `OPTIONS /api/newsletter` - CORS preflight

**Rate Limiting:**

```typescript
5 requests per 15 minutes per IP address
Tracked via x-forwarded-for, x-real-ip headers
Automatic cleanup of expired entries
```

**Validation:**

```typescript
- Email format: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
- Email length: max 254 characters
- HTML tag stripping for sanitization
```

**Error Codes:**

- `200` - Success
- `400` - Invalid email format
- `429` - Rate limit exceeded
- `500` - Server error
- `503` - Brevo API key not configured

### 2. Updated: `apps/web/src/components/sections/Newsletter.tsx`

**Before:**

```typescript
// Direct Brevo API call with exposed key
fetch('https://api.brevo.com/v3/smtp/email', {
  headers: { 'api-key': process.env.NEXT_PUBLIC_BREVO_API_KEY },
});
```

**After:**

```typescript
// Secure server-side API route
fetch('/api/newsletter', {
  method: 'POST',
  body: JSON.stringify({ email }),
});
```

**Changes:**

- ❌ Removed direct Brevo API calls (150+ lines)
- ❌ Removed API key exposure
- ✅ Added simple fetch to `/api/newsletter`
- ✅ Added error message handling from server
- ✅ Kept client-side email validation for UX

### 3. Updated: `apps/web/.env.example`

**Before:**

```bash
NEXT_PUBLIC_BREVO_API_KEY=your_key  # ❌ NEXT_PUBLIC_ exposes to browser
```

**After:**

```bash
BREVO_API_KEY=your_key  # ✅ Server-side only
```

**Note:** Removed `NEXT_PUBLIC_` prefix - keeps key secure on server.

### 4. Updated: `apps/web/.env.local`

Added comments for local development:

```bash
# Email Service (Optional - for newsletter feature)
# Get free API key from https://www.brevo.com (300 emails/day free tier)
# BREVO_API_KEY=your_brevo_api_key_here
```

---

## Security Features

### 1. API Key Protection

**Before:** API key in browser (anyone can see it) **After:** API key on server
only (secure)

```typescript
// Server-side only - not exposed to browser
const brevoApiKey = process.env.BREVO_API_KEY;
```

### 2. Rate Limiting

Prevents abuse and spam:

```typescript
Rate limit: 5 requests per 15 minutes per IP
Tracks via: x-forwarded-for, x-real-ip headers
Storage: In-memory Map (production: use Redis)
Cleanup: Automatic hourly cleanup
```

**Response when rate limited:**

```json
{
  "error": "Too many requests. Please try again later."
}
```

### 3. Input Validation

**Client-side (UX):**

```typescript
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (!emailRegex.test(email)) {
  // Show error immediately
}
```

**Server-side (Security):**

```typescript
// Format validation
if (!email || typeof email !== 'string') return 400;
if (!emailRegex.test(email)) return 400;

// Length validation
if (email.length > 254) return 400;

// Sanitization (XSS prevention)
const sanitizedEmail = email.replace(/<[^>]*>/g, '').trim();
```

### 4. Error Handling

**Secure error messages:**

```typescript
// Don't expose internal errors to client
try {
  // ... Brevo API call
} catch (error) {
  console.error('Newsletter API error:', error); // Server log
  return { error: 'Failed to process subscription' }; // Generic client message
}
```

### 5. CORS Configuration

```typescript
export async function OPTIONS() {
  return new NextResponse(null, {
    headers: {
      'Access-Control-Allow-Origin': '*', // Adjust for production
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
```

**Production recommendation:** Restrict origin to your domain only.

---

## Environment Variables

### Development (`.env.local`)

```bash
BREVO_API_KEY=your_brevo_api_key_here
```

### Production (Vercel)

**Add in Vercel Dashboard → Settings → Environment Variables:**

```
Name: BREVO_API_KEY
Value: your_brevo_api_key_here
Environment: Production, Preview, Development
```

**Important:** Do NOT use `NEXT_PUBLIC_` prefix!

---

## Testing

### Local Development

1. Get Brevo API key from https://www.brevo.com
2. Add to `.env.local`:
   ```bash
   BREVO_API_KEY=your_actual_api_key
   ```
3. Start dev server:
   ```bash
   pnpm --filter @foodwaste/web dev
   ```
4. Visit http://localhost:3001
5. Test newsletter subscription form

### Test Rate Limiting

```bash
# Send 6 requests quickly to test rate limit
for i in {1..6}; do
  curl -X POST http://localhost:3001/api/newsletter \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com"}'
  echo ""
done

# 6th request should return 429 error
```

### Test Without API Key

1. Remove `BREVO_API_KEY` from `.env.local`
2. Restart dev server
3. Try subscribing
4. Should get error: "Newsletter service not configured"

---

## Production Deployment

### Vercel Setup

1. **Add environment variable:**
   - Vercel Dashboard → Project → Settings → Environment Variables
   - Name: `BREVO_API_KEY`
   - Value: Your Brevo API key
   - Environments: Production ✅, Preview ✅, Development ✅

2. **Deploy:**

   ```bash
   git add .
   git commit -m "security: migrate newsletter to server-side API"
   git push origin master
   ```

3. **Verify:**
   - Visit https://toofreshtowaste.com
   - Test newsletter subscription
   - Check Vercel Function Logs for any errors

### Netlify Setup

1. **Add environment variable:**
   - Netlify Dashboard → Site Settings → Environment Variables
   - Key: `BREVO_API_KEY`
   - Value: Your Brevo API key

2. **Deploy and test**

---

## Monitoring

### Server Logs

Check API route logs in:

- **Vercel:** Dashboard → Deployments → Function Logs
- **Netlify:** Dashboard → Functions → Logs
- **Local:** Terminal console where dev server runs

### What to Monitor

```typescript
// Success
console.log('Newsletter subscription successful:', email);

// Errors
console.error('Brevo API error:', error);
console.error('Newsletter API error:', error);

// Rate limiting
console.log('Rate limit exceeded for:', ip);
```

### Brevo Dashboard

Monitor email sends:

- Dashboard → Statistics → Campaign reports
- Check delivery rates
- Monitor bounce rates
- Review API usage

---

## Rate Limiting: Production Considerations

### Current Implementation (In-Memory)

**Pros:**

- Simple, no external dependencies
- Works for single-instance deployments

**Cons:**

- Resets on server restart
- Doesn't work across multiple instances (Vercel Edge Functions)
- Limited to single server memory

### Recommended: Redis (Production)

For production at scale:

```typescript
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL!,
  token: process.env.UPSTASH_REDIS_TOKEN!,
});

async function checkRateLimit(key: string) {
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, 900); // 15 minutes
  }
  return count <= RATE_LIMIT_MAX_REQUESTS;
}
```

**Benefits:**

- Works across multiple instances
- Persists across restarts
- Better performance at scale

**Setup:**

1. Sign up at https://upstash.com (free tier available)
2. Create Redis database
3. Add environment variables to Vercel
4. Install package: `pnpm add @upstash/redis`
5. Update rate limiting code

---

## Future Enhancements

### 1. Database Storage

Store subscriptions in database:

```typescript
// MongoDB example
await db.collection('newsletter_subscriptions').insertOne({
  email: sanitizedEmail,
  subscribedAt: new Date(),
  source: 'landing_page',
  ipAddress: getIP(request),
});
```

### 2. Double Opt-In

Send confirmation email before adding to list:

```typescript
1. User submits email
2. Send confirmation email with unique token
3. User clicks link to confirm
4. Add to newsletter list
```

### 3. Unsubscribe Functionality

Add `/api/newsletter/unsubscribe` endpoint:

```typescript
POST / api / newsletter / unsubscribe;
Body: {
  (email, token);
}
Response: {
  success: true;
}
```

### 4. Analytics

Track subscription metrics:

```typescript
// Send to analytics
analytics.track('Newsletter Subscription', {
  email: sanitizedEmail,
  timestamp: new Date(),
  source: 'landing_page',
});
```

### 5. CAPTCHA Protection

Add reCAPTCHA for additional spam protection:

```typescript
// Verify CAPTCHA token before processing
const captchaValid = await verifyCaptcha(token);
if (!captchaValid) return 400;
```

---

## Troubleshooting

### Newsletter form shows "Newsletter service not configured"

**Cause:** `BREVO_API_KEY` environment variable not set

**Solution:**

1. Get API key from https://www.brevo.com
2. Add to Vercel environment variables
3. Redeploy

### "Too many requests" error

**Cause:** Rate limit exceeded (5 requests in 15 minutes)

**Solution:**

- Wait 15 minutes
- Or clear rate limit (restart server in dev)
- Or adjust `RATE_LIMIT_MAX_REQUESTS` constant

### Emails not being sent

**Possible causes:**

1. Invalid Brevo API key
2. Brevo account suspended
3. Domain not verified in Brevo
4. Daily quota exceeded (free tier: 300 emails/day)

**Debug steps:**

```bash
# Check Vercel logs
vercel logs [deployment-url]

# Check Brevo dashboard
# Login → Statistics → Check recent activity
```

### CORS errors

**Cause:** Cross-origin request blocked

**Solution:** Update CORS headers in `route.ts`:

```typescript
'Access-Control-Allow-Origin': 'https://toofreshtowaste.com',
```

---

## Security Checklist

- [x] API key not exposed to browser
- [x] Server-side validation
- [x] Rate limiting implemented
- [x] Input sanitization (XSS prevention)
- [x] Error handling (no sensitive info leaked)
- [x] HTTPS enforced (Vercel automatic)
- [x] Environment variables secured
- [ ] Consider adding CAPTCHA (future)
- [ ] Consider Redis for rate limiting (scale)
- [ ] Consider database for subscriptions (persistence)

---

## References

- Next.js API Routes:
  https://nextjs.org/docs/app/building-your-application/routing/route-handlers
- Brevo API Docs: https://developers.brevo.com/reference/sendtransacemail
- Next.js Environment Variables:
  https://nextjs.org/docs/app/building-your-application/configuring/environment-variables
- OWASP API Security: https://owasp.org/www-project-api-security/
- Rate Limiting Best Practices:
  https://cloud.google.com/architecture/rate-limiting-strategies-techniques
