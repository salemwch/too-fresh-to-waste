# Quick Start: Deploy toofreshtowaste.com

## Your Setup

- **Domain:** toofreshtowaste.com (Namecheap)
- **Repository:** https://github.com/salemwch/too-fresh-to-waste.git
- **App:** Next.js 15.1.3 web application

---

## ✅ Recommended: Vercel + Namecheap Domain

**Why:** Best performance, zero maintenance, full Next.js support, free hosting.

**Total Cost:** ~$10/year (domain only - hosting is free)

---

## Step-by-Step Deployment (15 minutes)

### Step 1: Push Web App to GitHub (2 minutes)

```bash
# From C:\WFA directory
git add apps/web .github/workflows NAMECHEAP_DEPLOYMENT_GUIDE.md WEB_DEPLOYMENT_GUIDE.md DEPLOYMENT_QUICKSTART.md
git commit -m "feat(web): add Next.js landing page and deployment guides"
git push origin master
```

### Step 2: Deploy to Vercel (5 minutes)

1. **Visit:** https://vercel.com/signup
2. **Click:** "Continue with GitHub"
3. **Authorize:** Vercel to access your repositories
4. **Click:** "Add New..." → "Project"
5. **Select:** `salemwch/too-fresh-to-waste` repository
6. **Click:** "Import"

**Configure Build Settings:**

```
Framework Preset: Next.js
Root Directory: apps/web
Build Command: cd ../.. && pnpm install --frozen-lockfile && pnpm --filter @foodwaste/shared build && pnpm --filter @foodwaste/web build
Output Directory: .next (leave default)
Install Command: pnpm install --frozen-lockfile
Node.js Version: 24.x
```

**Add Environment Variables:** Click "Environment Variables" and add:

```
NEXT_PUBLIC_SITE_URL=https://toofreshtowaste.com
NEXT_PUBLIC_APP_NAME=Too Fresh To Waste
NEXT_PUBLIC_API_URL=https://api.toofreshtowaste.com/api/v1
NEXT_PUBLIC_WEBSOCKET_URL=wss://api.toofreshtowaste.com
NEXT_PUBLIC_ENABLE_ANALYTICS=false
NEXT_PUBLIC_ENABLE_PWA=false
BREVO_API_KEY=your_brevo_api_key_here
```

**Note:** If you don't have a backend yet, use a placeholder for
`NEXT_PUBLIC_API_URL`.

6. **Click:** "Deploy"
7. **Wait:** 2-3 minutes for build to complete
8. **Copy:** Your Vercel URL (e.g., `https://too-fresh-to-waste.vercel.app`)

### Step 3: Add Custom Domain on Vercel (2 minutes)

1. **Go to:** Vercel Dashboard → Your Project → Settings → Domains
2. **Add domain:** `toofreshtowaste.com`
3. **Add www:** `www.toofreshtowaste.com`
4. **Copy DNS records** provided by Vercel (you'll see them on screen)

**Typical records will look like:**

```
Type: A
Name: @
Value: 76.76.21.21

Type: CNAME
Name: www
Value: cname.vercel-dns.com
```

### Step 4: Configure DNS on Namecheap (5 minutes)

1. **Login:** https://www.namecheap.com
2. **Go to:** Dashboard → Domain List
3. **Find:** toofreshtowaste.com → Click "Manage"
4. **Click:** "Advanced DNS" tab
5. **Delete** existing A/CNAME records for `@` and `www` (if any)
6. **Click:** "Add New Record"

**Add these records (use exact values from Vercel):**

```
Type: A Record
Host: @
Value: 76.76.21.21
TTL: Automatic

Type: CNAME Record
Host: www
Value: cname.vercel-dns.com
TTL: Automatic
```

**Note:** The IP address `76.76.21.21` is typical for Vercel, but use the EXACT
values shown in your Vercel dashboard.

7. **Save changes**

### Step 5: Wait for DNS Propagation (5-60 minutes)

DNS changes take time to propagate globally.

**Check propagation:**

```bash
# Windows Command Prompt
nslookup toofreshtowaste.com
nslookup www.toofreshtowaste.com

# Or use online tool:
# https://www.whatsmydns.net/#A/toofreshtowaste.com
```

**Expected output:**

```
Name:    toofreshtowaste.com
Address: 76.76.21.21 (or similar Vercel IP)
```

### Step 6: Verify Deployment

1. **Visit:** https://toofreshtowaste.com
2. **Visit:** https://www.toofreshtowaste.com

**Expected:** Your Next.js landing page loads with HTTPS and custom domain

**Check:**

- [ ] Page loads without errors
- [ ] HTTPS padlock icon shows in browser
- [ ] Both `toofreshtowaste.com` and `www.toofreshtowaste.com` work
- [ ] Images load correctly
- [ ] Navigation works
- [ ] Mobile responsive design

---

## Alternative: VPS Deployment (If You Need Full Control)

If you have a Namecheap VPS and want to self-host:

### Quick Commands

```bash
# SSH into VPS
ssh root@your-vps-ip

# Run setup script (will be created next)
curl -fsSL https://raw.githubusercontent.com/salemwch/too-fresh-to-waste/master/scripts/vps-setup.sh | bash

# Configure domain
# Edit: /etc/nginx/sites-available/web-app
# Replace 'yourdomain.com' with 'toofreshtowaste.com'

# Get SSL certificate
certbot --nginx -d toofreshtowaste.com -d www.toofreshtowaste.com

# Configure DNS on Namecheap
# Add A records pointing to your VPS IP
```

**Full VPS guide:** See `NAMECHEAP_DEPLOYMENT_GUIDE.md` → Option 1

---

## Post-Deployment Checklist

- [ ] Domain resolves to correct IP
- [ ] HTTPS works (green padlock)
- [ ] www redirect works
- [ ] Mobile responsive verified
- [ ] Forms work (if applicable)
- [ ] Images optimized and loading
- [ ] SEO meta tags present (View Page Source)
- [ ] Google Analytics configured (optional)
- [ ] Error monitoring setup (Sentry - optional)

---

## Update Deployment (After Initial Setup)

### For Vercel:

```bash
# Just push to GitHub - auto-deploys!
git add .
git commit -m "feat: update landing page"
git push origin master

# Vercel automatically builds and deploys in 2-3 minutes
```

### For VPS:

```bash
# SSH and run deployment script
ssh root@your-vps-ip
/var/www/too-fresh-to-waste/deploy.sh
```

---

## Troubleshooting

### Domain Not Working After 1 Hour

**Check DNS:**

```bash
nslookup toofreshtowaste.com
```

**If shows old IP or no records:**

1. Go to Namecheap → Advanced DNS
2. Verify A and CNAME records are correct
3. TTL should be "Automatic" or "300"
4. Wait another 30 minutes

**If still not working:**

- Clear browser cache (Ctrl+Shift+Delete)
- Try incognito mode
- Try different browser
- Flush DNS: `ipconfig /flushdns` (Windows)

### SSL Certificate Error

**Cause:** DNS not propagated yet

**Solution:**

1. Wait for DNS to fully propagate
2. Go to Vercel Dashboard → Domains
3. Click "Refresh" next to your domain
4. Wait 5-10 minutes

### "This site can't be reached"

**Cause:** DNS records incorrect

**Solution:**

1. Verify DNS records on Namecheap match Vercel's instructions EXACTLY
2. Use `nslookup` to verify
3. Wait for propagation

### Build Failed on Vercel

**Check logs:**

1. Vercel Dashboard → Deployments
2. Click failed deployment → View Function Logs

**Common fixes:**

- Ensure build command includes shared package build
- Check environment variables are set
- Verify Node.js version is 24.x

---

## Cost Breakdown

### Recommended Setup (Vercel + Namecheap Domain)

| Item               | Cost                 |
| ------------------ | -------------------- |
| Domain (Namecheap) | ~$10/year            |
| Vercel Hosting     | $0 (free tier)       |
| SSL Certificate    | $0 (auto via Vercel) |
| CDN                | $0 (included)        |
| **Total**          | **~$10/year**        |

### Alternative: VPS

| Item               | Cost               |
| ------------------ | ------------------ |
| Domain (Namecheap) | ~$10/year          |
| VPS (Namecheap)    | $10-30/month       |
| SSL Certificate    | $0 (Let's Encrypt) |
| **Total**          | **$130-370/year**  |

---

## Next Steps After Deployment

1. **Setup Google Analytics** (optional)
   - Get tracking ID from https://analytics.google.com
   - Add to Vercel environment variables: `NEXT_PUBLIC_GA_MEASUREMENT_ID`

2. **Setup Error Monitoring** (optional)
   - Create Sentry account: https://sentry.io
   - Add DSN to Vercel environment variables: `NEXT_PUBLIC_SENTRY_DSN`

3. **Deploy Backend API** (if you have one)
   - Deploy to separate subdomain: `api.toofreshtowaste.com`
   - Update `NEXT_PUBLIC_API_URL` environment variable

4. **Add Email Contact Form** (optional)
   - Use Brevo (formerly SendinBlue): https://www.brevo.com
   - Add API key to environment variables

5. **Submit to Search Engines**
   - Google Search Console: https://search.google.com/search-console
   - Bing Webmaster Tools: https://www.bing.com/webmasters

---

## Support

- **Vercel Support:** https://vercel.com/support
- **Namecheap Support:** https://www.namecheap.com/support/
- **DNS Propagation Checker:** https://www.whatsmydns.net
- **SSL Checker:** https://www.ssllabs.com/ssltest/

---

## Summary

**Recommended flow:**

1. Push code to GitHub ✅
2. Deploy to Vercel (5 min) ✅
3. Configure DNS on Namecheap (5 min) ✅
4. Wait for propagation (5-60 min) ✅
5. Visit https://toofreshtowaste.com ✅

**Total time:** ~15-75 minutes (mostly waiting for DNS)

**Total cost:** ~$10/year

**Maintenance:** Zero (automatic deployments)

---

Ready to start? Begin with Step 1 above!
