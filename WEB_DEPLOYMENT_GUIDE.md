# Web App Deployment Guide

## Summary

- **GitHub Repo:** https://github.com/salemwch/too-fresh-to-waste.git ✅
- **Web App:** Next.js 15.1.3 + TypeScript + Tailwind + i18n
- **Status:** Web app exists but not yet pushed to GitHub

---

## Recommended: Vercel Deployment (Best for Next.js)

### Why Vercel?
- Made by Next.js creators
- Zero-config deployment
- Free tier: 100GB bandwidth/month
- Automatic HTTPS, CDN, edge functions
- Built-in CI/CD with preview deployments
- Full SSR/ISR support

### Steps

#### 1. Push Web App to GitHub

```bash
# Add web app to git
git add apps/web .github/workflows/deploy-web.yml WEB_DEPLOYMENT_GUIDE.md

# Commit
git commit -m "feat(web): add Next.js landing page and deployment config"

# Push to GitHub
git push origin master
```

#### 2. Deploy to Vercel

1. **Sign up:** Visit https://vercel.com/signup
   - Click "Continue with GitHub"
   - Authorize Vercel to access your repositories

2. **Import Project:**
   - Click **"Add New..."** → **"Project"**
   - Select `salemwch/too-fresh-to-waste` repository
   - Click **"Import"**

3. **Configure Build Settings:**
   ```
   Framework Preset: Next.js
   Root Directory: apps/web
   Build Command: cd ../.. && pnpm install --frozen-lockfile && pnpm --filter @foodwaste/shared build && pnpm --filter @foodwaste/web build
   Output Directory: .next (leave default)
   Install Command: pnpm install --frozen-lockfile
   Development Command: pnpm dev
   Node.js Version: 24.x
   ```

4. **Environment Variables:**
   Click "Environment Variables" and add:
   ```
   NEXT_PUBLIC_SITE_URL=https://your-app.vercel.app
   NEXT_PUBLIC_APP_NAME=Too Fresh To Waste
   NEXT_PUBLIC_API_URL=https://your-backend-domain.com/api/v1
   NEXT_PUBLIC_WEBSOCKET_URL=wss://your-backend-domain.com
   NEXT_PUBLIC_ENABLE_ANALYTICS=false
   NEXT_PUBLIC_ENABLE_PWA=false
   ```

   ⚠️ Replace `https://your-backend-domain.com` with your actual backend URL

5. **Deploy:**
   - Click **"Deploy"**
   - Wait 2-3 minutes for build to complete

#### 3. Verification

After deployment:
- Visit your Vercel URL (e.g., `https://too-fresh-to-waste.vercel.app`)
- Test i18n routes: `/en`, `/fr`, etc.
- Check Vercel Dashboard → Deployments → Function Logs for errors

#### 4. Custom Domain (Optional)

1. Go to Project Settings → Domains
2. Add your custom domain (e.g., `toofreshtoowaste.com`)
3. Update DNS records as instructed by Vercel
4. Update `NEXT_PUBLIC_SITE_URL` environment variable

---

## Alternative: Netlify Deployment

### Why Netlify?
- Free tier: 100GB bandwidth/month
- Good DX with preview deployments
- Built-in forms and edge functions
- Full Next.js support

### Steps

#### 1. Push to GitHub (same as Vercel step 1)

#### 2. Deploy to Netlify

1. **Sign up:** Visit https://app.netlify.com/signup
   - Continue with GitHub

2. **Import Project:**
   - Click **"Add new site"** → **"Import an existing project"**
   - Select GitHub → `salemwch/too-fresh-to-waste`

3. **Configure Build:**
   ```
   Base directory: apps/web
   Build command: cd ../.. && pnpm install --frozen-lockfile && pnpm --filter @foodwaste/shared build && pnpm --filter @foodwaste/web build
   Publish directory: apps/web/.next
   Functions directory: (leave empty)
   ```

4. **Add Environment Variables:**
   Site settings → Environment variables → Add variables
   ```
   NODE_VERSION=24.11.1
   PNPM_VERSION=10.17.0
   NEXT_PUBLIC_SITE_URL=https://your-app.netlify.app
   NEXT_PUBLIC_APP_NAME=Too Fresh To Waste
   NEXT_PUBLIC_API_URL=https://your-backend-domain.com/api/v1
   ```

5. **Deploy**

---

## Alternative: GitHub Pages (Static Export Only)

⚠️ **Limitations:**
- No server-side rendering (SSR)
- No API routes
- No ISR (Incremental Static Regeneration)
- Static pages only

### Steps

#### 1. Enable Static Export

Edit `apps/web/next.config.js`:

```javascript
const createNextIntlPlugin = require('next-intl/plugin');
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Enable static export
  output: 'export',

  // Required for GitHub Pages
  basePath: process.env.NODE_ENV === 'production' ? '/too-fresh-to-waste' : '',
  assetPrefix: process.env.NODE_ENV === 'production' ? '/too-fresh-to-waste/' : '',

  // Disable features not supported in static export
  images: {
    unoptimized: true, // GitHub Pages doesn't support Image Optimization API
  },

  eslint: {
    ignoreDuringBuilds: true,
  },

  poweredByHeader: false,
  trailingSlash: false,
};

module.exports = withNextIntl(nextConfig);
```

#### 2. Push to GitHub

```bash
git add apps/web .github/workflows/deploy-web.yml
git commit -m "feat(web): configure static export for GitHub Pages"
git push origin master
```

#### 3. Enable GitHub Pages

1. Go to https://github.com/salemwch/too-fresh-to-waste/settings/pages
2. Under "Source", select:
   - Source: **GitHub Actions**
3. The workflow will run automatically on next push

#### 4. Access Your Site

After workflow completes (~3-5 minutes):
- URL: https://salemwch.github.io/too-fresh-to-waste
- Check Actions tab for build logs

---

## Comparison Table

| Feature | Vercel | Netlify | GitHub Pages |
|---------|--------|---------|--------------|
| SSR/ISR | ✅ | ✅ | ❌ |
| Edge Functions | ✅ | ✅ | ❌ |
| API Routes | ✅ | ✅ | ❌ |
| Free Bandwidth | 100GB | 100GB | Unlimited |
| Build Minutes | 6000/month | 300/month | Unlimited |
| Custom Domain | ✅ Free | ✅ Free | ✅ Free |
| Preview Deploys | ✅ | ✅ | ❌ |
| Image Optimization | ✅ | ✅ | ❌ |
| **Recommendation** | **Best** | Good | Limited |

---

## Post-Deployment Checklist

- [ ] Web app loads without errors
- [ ] i18n routes work (`/en`, `/fr`)
- [ ] Images load correctly
- [ ] Forms submit successfully
- [ ] API integration works (check Network tab)
- [ ] Mobile responsive design verified
- [ ] SEO meta tags present (View Page Source)
- [ ] HTTPS enabled
- [ ] Custom domain configured (if applicable)
- [ ] Analytics/monitoring enabled (if configured)

---

## Troubleshooting

### Build Fails: "Cannot find module @foodwaste/shared"

**Solution:** Ensure build command includes shared package build:
```bash
pnpm --filter @foodwaste/shared build && pnpm --filter @foodwaste/web build
```

### API Calls Fail (CORS Errors)

**Solution:** Update backend CORS whitelist to include your Vercel/Netlify domain:
```typescript
// apps/food-waste-backend/src/main.ts
app.enableCors({
  origin: [
    'https://your-app.vercel.app',
    'https://toofreshtowaste.com',
  ],
  credentials: true,
});
```

### Images Not Optimized on GitHub Pages

**Expected:** GitHub Pages doesn't support Next.js Image Optimization API. Use `unoptimized: true` in next.config.js.

### 404 on Direct URL Access (GitHub Pages)

**Solution:** Add `.nojekyll` file to `apps/web/public/` to disable Jekyll processing.

---

## Rollback Plan

### Vercel/Netlify
1. Go to Deployments tab
2. Select previous working deployment
3. Click "Promote to Production"

### GitHub Pages
1. Go to Actions tab
2. Select working workflow run
3. Re-run workflow

---

## CI/CD Pipeline

The GitHub Actions workflow (`.github/workflows/deploy-web.yml`) automatically:
1. Triggers on push to `master` or changes in `apps/web/**`
2. Installs dependencies with pnpm
3. Builds `@foodwaste/shared` package
4. Builds web app
5. Deploys to GitHub Pages

For Vercel/Netlify, CI/CD is automatic on git push.

---

## Sources

- Next.js Deployment: https://nextjs.org/docs/deployment
- Vercel Documentation: https://vercel.com/docs
- Netlify Documentation: https://docs.netlify.com
- GitHub Pages: https://docs.github.com/en/pages
- Next.js Static Export: https://nextjs.org/docs/app/building-your-application/deploying/static-exports
