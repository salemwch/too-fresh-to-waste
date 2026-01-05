# Namecheap Deployment Guide

## Overview

Namecheap provides different hosting options. Choose based on your needs:

| Option              | Best For                      | Next.js SSR | Cost                  | Complexity |
| ------------------- | ----------------------------- | ----------- | --------------------- | ---------- |
| **VPS**             | Full control, production apps | ✅          | ~$10-30/mo            | High       |
| **Shared Hosting**  | Simple static sites           | ❌          | ~$2-10/mo             | Low        |
| **Domain + Vercel** | Best performance, zero config | ✅          | Domain only (~$10/yr) | Low        |

---

## Option 1: VPS Deployment (Recommended for Full Next.js)

### Prerequisites

- Namecheap VPS or Dedicated Server
- SSH access credentials
- Node.js 24.x support

### Architecture

```
Internet → Namecheap DNS → VPS IP → Nginx (reverse proxy) → PM2 → Next.js (port 3001)
```

### Steps

#### 1. Access Your VPS

```bash
# SSH into your Namecheap VPS
ssh root@your-vps-ip-address

# Or if you have a non-root user
ssh username@your-vps-ip-address
```

#### 2. Initial Server Setup

```bash
# Update system packages
apt update && apt upgrade -y

# Install required packages
apt install -y curl git build-essential nginx

# Install Node.js 24.x (using NodeSource)
curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
apt install -y nodejs

# Verify Node.js version
node -v  # Should show v24.x.x

# Install pnpm
npm install -g pnpm@10.17.0

# Install PM2 (process manager)
npm install -g pm2

# Setup firewall
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable
```

#### 3. Clone Repository

```bash
# Create app directory
mkdir -p /var/www
cd /var/www

# Clone your repository
git clone https://github.com/salemwch/too-fresh-to-waste.git
cd too-fresh-to-waste

# Install dependencies
pnpm install --frozen-lockfile

# Build shared package
pnpm --filter @foodwaste/shared build

# Build web app
pnpm --filter @foodwaste/web build
```

#### 4. Configure Environment Variables

```bash
# Create production environment file
nano /var/www/too-fresh-to-waste/apps/web/.env.production.local
```

Add:

```bash
NODE_ENV=production
NEXT_PUBLIC_SITE_URL=https://yourdomain.com
NEXT_PUBLIC_APP_NAME=Too Fresh To Waste
NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api/v1
NEXT_PUBLIC_WEBSOCKET_URL=wss://api.yourdomain.com
NEXT_PUBLIC_ENABLE_ANALYTICS=false
NEXT_PUBLIC_ENABLE_PWA=false
```

Save with `Ctrl+X`, then `Y`, then `Enter`.

#### 5. Configure PM2

```bash
# Create PM2 ecosystem file
nano /var/www/too-fresh-to-waste/ecosystem.config.js
```

Add:

```javascript
module.exports = {
  apps: [
    {
      name: 'web-app',
      cwd: '/var/www/too-fresh-to-waste/apps/web',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3001',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      max_memory_restart: '1G',
      error_file: '/var/log/pm2/web-error.log',
      out_file: '/var/log/pm2/web-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
    },
  ],
};
```

```bash
# Create log directory
mkdir -p /var/log/pm2

# Start application with PM2
pm2 start ecosystem.config.js

# Enable PM2 startup on system reboot
pm2 startup
pm2 save

# Check status
pm2 status
pm2 logs web-app --lines 50
```

#### 6. Configure Nginx Reverse Proxy

```bash
# Create Nginx configuration
nano /etc/nginx/sites-available/web-app
```

Add:

```nginx
# Rate limiting
limit_req_zone $binary_remote_addr zone=web_limit:10m rate=10r/s;

upstream nextjs_web {
    least_conn;
    server 127.0.0.1:3001;
    keepalive 64;
}

server {
    listen 80;
    listen [::]:80;
    server_name yourdomain.com www.yourdomain.com;

    # Redirect HTTP to HTTPS (after SSL setup)
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL certificates (will be configured with Certbot)
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Logs
    access_log /var/log/nginx/web-access.log;
    error_log /var/log/nginx/web-error.log;

    # Max upload size
    client_max_body_size 10M;

    # Rate limiting
    limit_req zone=web_limit burst=20 nodelay;

    # Proxy settings
    location / {
        proxy_pass http://nextjs_web;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Cache static files
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2|ttf|eot)$ {
        proxy_pass http://nextjs_web;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Next.js specific paths
    location /_next/static/ {
        proxy_pass http://nextjs_web;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

```bash
# Enable site
ln -s /etc/nginx/sites-available/web-app /etc/nginx/sites-enabled/

# Test Nginx configuration
nginx -t

# If test passes, reload Nginx
systemctl reload nginx
```

#### 7. Setup SSL Certificate (Free with Let's Encrypt)

```bash
# Install Certbot
apt install -y certbot python3-certbot-nginx

# Obtain SSL certificate (replace with your domain)
certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Follow prompts:
# - Enter email address
# - Agree to terms
# - Choose whether to redirect HTTP to HTTPS (select Yes)

# Verify auto-renewal
certbot renew --dry-run

# Certificate will auto-renew via cron
systemctl status certbot.timer
```

#### 8. Configure DNS on Namecheap

1. Go to Namecheap Dashboard → Domain List → Manage
2. Go to "Advanced DNS" tab
3. Add/Update DNS records:

```
Type    Host    Value                TTL
A       @       YOUR_VPS_IP_ADDRESS  Automatic
A       www     YOUR_VPS_IP_ADDRESS  Automatic
```

**Wait 5-60 minutes for DNS propagation.**

#### 9. Verification

```bash
# Check PM2 status
pm2 status
pm2 logs web-app --lines 50

# Check Nginx status
systemctl status nginx
nginx -t

# Check app locally
curl http://localhost:3001

# Check from internet
curl https://yourdomain.com

# Monitor logs
tail -f /var/log/nginx/web-access.log
tail -f /var/log/pm2/web-out.log
```

Visit: `https://yourdomain.com`

**Expected:** Landing page loads with HTTPS

#### 10. Deployment Script for Updates

Create deployment script:

```bash
nano /var/www/too-fresh-to-waste/deploy.sh
```

Add:

```bash
#!/bin/bash
set -e

echo "🚀 Deploying web app..."

# Navigate to project
cd /var/www/too-fresh-to-waste

# Pull latest code
git pull origin master

# Install dependencies
pnpm install --frozen-lockfile

# Build shared package
pnpm --filter @foodwaste/shared build

# Build web app
pnpm --filter @foodwaste/web build

# Restart PM2
pm2 restart web-app

# Wait for app to start
sleep 5

# Check status
pm2 status

echo "✅ Deployment complete!"
```

```bash
# Make executable
chmod +x /var/www/too-fresh-to-waste/deploy.sh

# Run deployment
/var/www/too-fresh-to-waste/deploy.sh
```

---

## Option 2: Shared Hosting (Static Export Only)

### ⚠️ Limitations

- No Server-Side Rendering (SSR)
- No API routes
- No Incremental Static Regeneration (ISR)
- Static HTML/CSS/JS only

### Steps

#### 1. Enable Static Export Locally

Edit `apps/web/next.config.js`:

```javascript
const createNextIntlPlugin = require('next-intl/plugin');
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Enable static export
  output: 'export',

  // Disable features not supported in static export
  images: {
    unoptimized: true,
  },

  eslint: {
    ignoreDuringBuilds: true,
  },

  poweredByHeader: false,
  trailingSlash: true, // Important for shared hosting
};

module.exports = withNextIntl(nextConfig);
```

#### 2. Build Static Site Locally

```bash
# From project root
pnpm install

# Build shared package
pnpm --filter @foodwaste/shared build

# Build web app (creates 'out' folder)
pnpm --filter @foodwaste/web build
```

This creates `apps/web/out/` folder with static files.

#### 3. Upload to Namecheap Shared Hosting

**Via cPanel File Manager:**

1. Login to Namecheap cPanel
2. Navigate to File Manager
3. Go to `public_html/` directory
4. Delete existing files (if any)
5. Upload entire contents of `apps/web/out/` folder
6. Ensure `.htaccess` file is uploaded

**Via FTP:**

1. Use FileZilla or similar FTP client
2. Connect using Namecheap FTP credentials
3. Upload `apps/web/out/*` to `public_html/`

#### 4. Add `.htaccess` for Routing

Create `apps/web/public/.htaccess`:

```apache
# Enable rewrite engine
RewriteEngine On

# Force HTTPS
RewriteCond %{HTTPS} off
RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]

# Remove .html extension
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^([^\.]+)$ $1.html [NC,L]

# Security headers
<IfModule mod_headers.c>
    Header set X-Frame-Options "SAMEORIGIN"
    Header set X-Content-Type-Options "nosniff"
    Header set X-XSS-Protection "1; mode=block"
    Header set Referrer-Policy "strict-origin-when-cross-origin"
</IfModule>

# Compression
<IfModule mod_deflate.c>
    AddOutputFilterByType DEFLATE text/html text/plain text/xml text/css text/javascript application/javascript application/json
</IfModule>

# Browser caching
<IfModule mod_expires.c>
    ExpiresActive On
    ExpiresByType image/jpg "access plus 1 year"
    ExpiresByType image/jpeg "access plus 1 year"
    ExpiresByType image/png "access plus 1 year"
    ExpiresByType image/gif "access plus 1 year"
    ExpiresByType image/svg+xml "access plus 1 year"
    ExpiresByType text/css "access plus 1 month"
    ExpiresByType application/javascript "access plus 1 month"
    ExpiresByType application/font-woff2 "access plus 1 year"
</IfModule>
```

Rebuild and re-upload.

#### 5. Verification

Visit: `https://yourdomain.com`

**Expected:** Static landing page loads

---

## Option 3: Domain + Vercel/Netlify (Best Approach)

### Why This Is Recommended

- **Best of both worlds:** Domain from Namecheap, hosting from Vercel
- Full Next.js support (SSR, ISR, API routes)
- Zero server management
- Free hosting tier
- Global CDN
- Automatic HTTPS

### Steps

#### 1. Deploy to Vercel

Follow instructions from `WEB_DEPLOYMENT_GUIDE.md`:

```bash
# Push to GitHub
git add apps/web
git commit -m "feat(web): add Next.js landing page"
git push origin master

# Deploy to Vercel
# 1. Visit https://vercel.com/signup
# 2. Import salemwch/too-fresh-to-waste
# 3. Configure root directory: apps/web
# 4. Deploy
```

After deployment, note your Vercel URL: `https://too-fresh-to-waste.vercel.app`

#### 2. Add Custom Domain on Vercel

1. Go to Vercel Dashboard → Your Project → Settings → Domains
2. Add domain: `yourdomain.com`
3. Add www subdomain: `www.yourdomain.com`
4. Vercel will provide DNS records

#### 3. Configure DNS on Namecheap

1. Go to Namecheap Dashboard → Domain List → Manage
2. Go to "Advanced DNS" tab
3. Add DNS records provided by Vercel:

**Typical records:**

```
Type     Host    Value                    TTL
A        @       76.76.21.21             Automatic
CNAME    www     cname.vercel-dns.com    Automatic
```

**Or for CNAME setup:**

```
Type     Host    Value                    TTL
CNAME    @       cname.vercel-dns.com    Automatic
CNAME    www     cname.vercel-dns.com    Automatic
```

**Note:** Exact values will be shown in Vercel dashboard.

4. Wait 5-60 minutes for DNS propagation

#### 4. Verification

```bash
# Check DNS propagation
nslookup yourdomain.com
nslookup www.yourdomain.com

# Or use online tool
# https://www.whatsmydns.net/#A/yourdomain.com
```

Visit: `https://yourdomain.com`

**Expected:** Your Next.js app loads with custom domain and HTTPS

---

## Comparison: Which Option to Choose?

### Choose VPS if:

- You need full server control
- You have DevOps experience
- You want to self-host everything
- You need custom server configurations

### Choose Shared Hosting if:

- You only need a simple static site
- You don't need SSR or dynamic features
- Budget is very limited
- You're okay with manual deployments

### Choose Domain + Vercel if: ✅ **RECOMMENDED**

- You want best performance with zero maintenance
- You need full Next.js features (SSR, ISR)
- You want automatic deployments on git push
- You prefer focusing on development, not DevOps

---

## Cost Comparison

| Option          | Namecheap Cost        | Total Cost | Maintenance |
| --------------- | --------------------- | ---------- | ----------- |
| VPS             | $10-30/mo             | $10-30/mo  | High        |
| Shared Hosting  | $2-10/mo              | $2-10/mo   | Low         |
| Domain + Vercel | Domain only (~$10/yr) | ~$1/mo     | Zero        |

---

## Security Checklist

- [ ] SSL/HTTPS enabled
- [ ] Firewall configured (VPS only)
- [ ] SSH key authentication (VPS only)
- [ ] Regular security updates
- [ ] Strong passwords for cPanel/SSH
- [ ] Two-factor authentication enabled on Namecheap
- [ ] Environment variables secured (not in git)
- [ ] Rate limiting configured (VPS only)
- [ ] Regular backups configured

---

## Monitoring & Maintenance

### VPS Monitoring

```bash
# Check application status
pm2 status
pm2 logs web-app --lines 100

# Check system resources
htop
df -h
free -h

# Check Nginx logs
tail -f /var/log/nginx/web-access.log
tail -f /var/log/nginx/web-error.log

# Restart services if needed
pm2 restart web-app
systemctl restart nginx
```

### Automated Backups (VPS)

```bash
# Create backup script
nano /root/backup.sh
```

Add:

```bash
#!/bin/bash
BACKUP_DIR="/backups"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup application code
tar -czf $BACKUP_DIR/too-fresh-to-waste_$DATE.tar.gz /var/www/too-fresh-to-waste

# Keep only last 7 days of backups
find $BACKUP_DIR -name "too-fresh-to-waste_*.tar.gz" -mtime +7 -delete

echo "Backup completed: too-fresh-to-waste_$DATE.tar.gz"
```

```bash
# Make executable
chmod +x /root/backup.sh

# Add to crontab (daily at 2 AM)
crontab -e
```

Add line:

```
0 2 * * * /root/backup.sh >> /var/log/backup.log 2>&1
```

---

## Troubleshooting

### VPS: Application Won't Start

```bash
# Check PM2 logs
pm2 logs web-app --err --lines 100

# Check port availability
netstat -tulpn | grep :3001

# Check Node.js version
node -v  # Must be 24.x

# Rebuild application
cd /var/www/too-fresh-to-waste
pnpm install --frozen-lockfile
pnpm --filter @foodwaste/shared build
pnpm --filter @foodwaste/web build
pm2 restart web-app
```

### VPS: 502 Bad Gateway

**Cause:** Nginx can't connect to Next.js app

**Solution:**

```bash
# Check if Next.js is running
pm2 status
curl http://localhost:3001

# If not running, restart
pm2 restart web-app

# Check Nginx configuration
nginx -t

# Check Nginx logs
tail -f /var/log/nginx/web-error.log
```

### Shared Hosting: Pages Not Loading

**Cause:** Missing `.htaccess` or incorrect routing

**Solution:**

1. Ensure `.htaccess` is uploaded to `public_html/`
2. Verify `trailingSlash: true` in `next.config.js`
3. Rebuild: `pnpm --filter @foodwaste/web build`
4. Re-upload `out/` folder contents

### DNS Not Propagating

```bash
# Check current DNS
nslookup yourdomain.com

# Use Google DNS to check
nslookup yourdomain.com 8.8.8.8

# Wait up to 48 hours for full global propagation
# Use https://www.whatsmydns.net to check worldwide
```

---

## Rollback Plan

### VPS Rollback

```bash
# Option 1: PM2 rollback (if you versioned deployments)
cd /var/www/too-fresh-to-waste
git log --oneline -5
git checkout <previous-commit-hash>
pnpm install --frozen-lockfile
pnpm --filter @foodwaste/shared build
pnpm --filter @foodwaste/web build
pm2 restart web-app

# Option 2: Restore from backup
cd /backups
tar -xzf too-fresh-to-waste_YYYYMMDD_HHMMSS.tar.gz -C /
pm2 restart web-app
```

### Vercel Rollback

1. Go to Vercel Dashboard → Deployments
2. Find previous working deployment
3. Click "⋯" menu → "Promote to Production"

---

## Next Steps

1. **Choose deployment option** based on your needs
2. **Follow step-by-step guide** for your chosen option
3. **Configure DNS** on Namecheap
4. **Test deployment** thoroughly
5. **Setup monitoring** (VPS only)
6. **Configure automated backups** (VPS only)

---

## Sources

- Namecheap VPS: https://www.namecheap.com/hosting/vps/
- Namecheap Shared Hosting: https://www.namecheap.com/hosting/shared/
- PM2 Documentation: https://pm2.keymetrics.io/docs/usage/quick-start/
- Nginx Documentation: https://nginx.org/en/docs/
- Let's Encrypt: https://letsencrypt.org/getting-started/
- Next.js Deployment: https://nextjs.org/docs/deployment
- Vercel Custom Domains: https://vercel.com/docs/concepts/projects/domains
