# SECRETS ROTATION GUIDE - IMMEDIATE ACTION REQUIRED

**Status:** 🚨 **CRITICAL SECURITY INCIDENT** **Risk Level:** HIGH - Production
credentials exposed in repository **Required Actions:** Rotate ALL secrets
within 24 hours **Last Updated:** November 21, 2025

---

## EXECUTIVE SUMMARY

Multiple production secrets have been exposed in the git repository:

- Redis credentials (Cloud service)
- JWT signing keys
- SMTP passwords
- MongoDB Atlas credentials
- Twilio API tokens
- Admin passwords

**IMMEDIATE ACTION:** All exposed credentials must be rotated and the .env file
must be removed from git history.

---

## 1. IMMEDIATE TRIAGE (DO THIS FIRST)

### Step 1.1: Assess Current Exposure

```bash
# Check if .env is currently committed
git ls-files | grep -E "\.env$|\.env\.production|\.env\.staging"

# Check git history for .env files
git log --all --full-history -- "**/.env"

# Search for exposed secrets in commits
git log -p --all -S "REDIS_PASSWORD" | head -50
git log -p --all -S "JWT_SECRET" | head -50
```

### Step 1.2: Identify Affected Services

**Exposed Services:**

- ✗ Redis Cloud (redis-16469.c339.eu-west-3-1.ec2.redns.redis-cloud.com)
- ✗ MongoDB Atlas (cluster0.61uimdv.mongodb.net)
- ✗ Gmail SMTP (salemwachwacha1997@gmail.com)
- ✗ Twilio (Account SID: ACe67f45294ffea8022327a47813c61049)
- ✗ Firebase (waste-food-d479c)

### Step 1.3: Immediate Mitigation

**PRIORITY 1 - Complete within 1 hour:**

```bash
# 1. Add .env to .gitignore (if not already)
echo ".env" >> .gitignore
echo ".env.*" >> .gitignore
echo "!.env.example" >> .gitignore

# 2. Remove .env from staging
git rm --cached apps/food-waste-backend/.env
git rm --cached apps/mobile/.env

# 3. Commit the removal
git add .gitignore
git commit -m "security: Remove .env files from repository"

# 4. Push immediately
git push origin master
```

---

## 2. SECRET ROTATION PROCEDURES

### 2.1 Redis Cloud Credentials

**Service:** Redis Cloud **Exposed:** Password, Host, Port **Impact:** High -
Cache and session data accessible

**Rotation Steps:**

```bash
# 1. Log in to Redis Cloud
# URL: https://app.redislabs.com/

# 2. Navigate to your database
# Database ID: 16469

# 3. Reset password
# Security > Reset Password > Generate new password

# 4. Update .env.production (DO NOT COMMIT)
REDIS_PASSWORD=<new-password-from-redis-cloud>

# 5. Restart application with new credentials
# Kubernetes: kubectl rollout restart deployment/foodwaste-backend
# Docker: docker-compose restart backend

# 6. Verify connection
redis-cli -h redis-16469.c339.eu-west-3-1.ec2.redns.redis-cloud.com \
  -p 16469 \
  -a <new-password> \
  --tls \
  ping
```

### 2.2 JWT Secret Keys

**Service:** JSON Web Tokens **Exposed:** JWT_SECRET, JWT_REFRESH_SECRET
**Impact:** CRITICAL - All user sessions compromised

**Rotation Steps:**

```bash
# 1. Generate new secrets (64 bytes = 128 hex chars)
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(64).toString('hex'))"
node -e "console.log('JWT_REFRESH_SECRET=' + require('crypto').randomBytes(64).toString('hex'))"

# 2. Update .env.production
JWT_SECRET=<new-secret-from-step-1>
JWT_REFRESH_SECRET=<new-refresh-secret-from-step-1>

# 3. Deploy new secrets to production
# GitHub Secrets:
gh secret set JWT_SECRET --body "<new-secret>"
gh secret set JWT_REFRESH_SECRET --body "<new-refresh-secret>"

# AWS Secrets Manager:
aws secretsmanager update-secret \
  --secret-id foodwaste/jwt-secret \
  --secret-string "<new-secret>"

# 4. IMPORTANT: This will invalidate ALL user sessions
# Send notification to users about re-login requirement

# 5. Restart application
kubectl rollout restart deployment/foodwaste-backend

# 6. Clear Redis session cache
redis-cli -h <redis-host> -p <redis-port> -a <password> FLUSHALL
```

**Post-Rotation Actions:**

```typescript
// Implement JWT rotation mechanism for future
// apps/food-waste-backend/src/auth/services/token-rotation.service.ts

import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class TokenRotationService {
  async rotateRefreshToken(userId: string, oldTokenId: string) {
    // Invalidate old token family
    await this.revokeTokenFamily(oldTokenId);

    // Generate new token with new family ID
    const newTokenId = uuidv4();
    return this.jwtService.sign({
      sub: userId,
      jti: newTokenId,
      family: uuidv4(),
      type: 'refresh',
    });
  }
}
```

### 2.3 MongoDB Atlas Credentials

**Service:** MongoDB Atlas **Exposed:** Connection string with embedded
credentials **Impact:** High - Database access compromised

**Rotation Steps:**

```bash
# 1. Log in to MongoDB Atlas
# URL: https://cloud.mongodb.com/

# 2. Navigate to Database Access
# Select your cluster > Database Access

# 3. Delete old user
# foodwaste_user > Delete User

# 4. Create new user
# Add New Database User
# Username: foodwaste_user_v2
# Password: Generate secure password (auto-generate recommended)
# Role: readWrite on foodwaste database

# 5. Update connection string
DATABASE_URL=mongodb+srv://foodwaste_user_v2:<new-password>@cluster0.61uimdv.mongodb.net/foodwaste?retryWrites=true&w=majority

# 6. Deploy to production
gh secret set DATABASE_URL --body "<new-connection-string>"

# 7. Restart application
kubectl rollout restart deployment/foodwaste-backend

# 8. Verify connection
mongosh "<new-connection-string>" --eval "db.adminCommand('ping')"
```

### 2.4 SMTP Gmail App Password

**Service:** Gmail SMTP **Exposed:** Email address and app password **Impact:**
Medium - Email sending capability compromised

**Rotation Steps:**

```bash
# 1. Log in to Google Account
# URL: https://myaccount.google.com/

# 2. Navigate to Security > 2-Step Verification > App passwords
# URL: https://myaccount.google.com/apppasswords

# 3. Revoke old app password
# Find "foodwaste backend" and click Revoke

# 4. Generate new app password
# Select app: Mail
# Select device: Custom > "FoodWaste Backend Production"
# Copy the 16-character password

# 5. Update .env.production
SMTP_PASS=<new-16-char-password>

# 6. Deploy
gh secret set SMTP_PASS --body "<new-password>"

# 7. Test email sending
curl -X POST http://localhost:3000/api/test/email \
  -H "Content-Type: application/json" \
  -d '{"to":"test@example.com","subject":"Test"}'
```

### 2.5 Twilio Credentials

**Service:** Twilio SMS **Exposed:** Account SID and Auth Token **Impact:**
High - SMS sending and potential billing fraud

**Rotation Steps:**

```bash
# 1. Log in to Twilio Console
# URL: https://console.twilio.com/

# 2. Navigate to Settings > API Credentials
# URL: https://console.twilio.com/console/account/settings

# 3. Create new API Key (recommended over primary token)
# Tools > API Keys > Create new API Key
# Friendly Name: FoodWaste Backend Production v2
# Key Type: Standard
# Copy SID and Secret

# 4. Update credentials
TWILIO_ACCOUNT_SID=<your-account-sid-remains-same>
TWILIO_AUTH_TOKEN=<new-api-key-secret>

# Alternative: Rotate primary auth token
# Settings > General > Auth Token > View Auth Token > Reset

# 5. Deploy
gh secret set TWILIO_AUTH_TOKEN --body "<new-token>"

# 6. Test SMS
curl -X POST https://api.twilio.com/2010-04-01/Accounts/<SID>/Messages.json \
  --data-urlencode "From=+19033267412" \
  --data-urlencode "To=+1234567890" \
  --data-urlencode "Body=Test" \
  -u <SID>:<new-token>
```

### 2.6 Firebase Service Account

**Service:** Firebase **Exposed:** Project ID (public), Service account path
**Impact:** Medium - If service account JSON also exposed

**Rotation Steps:**

```bash
# 1. Log in to Firebase Console
# URL: https://console.firebase.google.com/

# 2. Navigate to Project Settings > Service Accounts
# Project: waste-food-d479c

# 3. Generate new private key
# Click "Generate new private key"
# Save file as firebase-service-account-v2.json

# 4. Update service account
# DO NOT commit the JSON file
# Store in secrets manager or mount as Kubernetes secret

# 5. Update .env.production
FIREBASE_SERVICE_ACCOUNT_PATH=/etc/secrets/firebase-service-account-v2.json

# 6. Deploy secret to Kubernetes
kubectl create secret generic firebase-service-account \
  --from-file=service-account.json=firebase-service-account-v2.json \
  -n production

# 7. Update deployment to mount secret
# kubernetes/deployment.yaml
spec:
  volumes:
    - name: firebase-secret
      secret:
        secretName: firebase-service-account

# 8. Delete old service account
# Firebase Console > Service Accounts > Manage service account permissions
# Find old key and delete
```

### 2.7 Payment Gateway Credentials (SMT)

**Service:** SMT Tunisia Payment Gateway **Exposed:** API secrets and encryption
keys **Impact:** CRITICAL - Financial fraud risk

**Rotation Steps:**

```bash
# 1. Contact SMT support immediately
# Email: support@smt.tn
# Phone: +216 XX XXX XXX

# 2. Request credential rotation
# Merchant ID: <your-merchant-id>
# Reason: Security breach - credentials exposed

# 3. Receive new credentials
# New API Key
# New API Secret
# New Webhook Secret

# 4. Generate new encryption salt
node -e "console.log('SMT_ENCRYPTION_SALT=' + require('crypto').randomBytes(128).toString('hex'))"

# 5. Update all payment-related secrets
SMT_API_KEY=<new-key-from-smt>
SMT_API_SECRET=<new-secret-from-smt>
SMT_WEBHOOK_SECRET=<new-webhook-secret>
SMT_ENCRYPTION_SALT=<new-salt-from-step-4>

# 6. Deploy immediately
gh secret set SMT_API_SECRET --body "<new-secret>"
gh secret set SMT_WEBHOOK_SECRET --body "<new-webhook-secret>"
gh secret set SMT_ENCRYPTION_SALT --body "<new-salt>"

# 7. Monitor transactions for suspicious activity
# Review last 48 hours of payment logs
```

### 2.8 Admin Credentials

**Exposed:** Admin email and password **Impact:** CRITICAL - Full system access

**Rotation Steps:**

```bash
# 1. Generate strong password
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# 2. Update admin password via API or direct database
mongosh "<connection-string>" <<EOF
use foodwaste;
db.users.updateOne(
  { email: 'salemwachwacha@outlook.fr' },
  { \$set: {
      password: '<bcrypt-hash-of-new-password>',
      passwordChangedAt: new Date(),
      forcePasswordChange: true
    }
  }
);
EOF

# 3. Enable MFA for admin account
# Log in to admin panel
# Settings > Security > Enable Two-Factor Authentication

# 4. Review admin access logs
# Check for suspicious login attempts since exposure
```

---

## 3. REMOVE SECRETS FROM GIT HISTORY

**WARNING:** This rewrites git history. Coordinate with team before proceeding.

### Method 1: BFG Repo Cleaner (Recommended)

```bash
# 1. Install BFG Repo Cleaner
# Download from: https://rtyley.github.io/bfg-repo-cleaner/
wget https://repo1.maven.org/maven2/com/madgag/bfg/1.14.0/bfg-1.14.0.jar

# 2. Clone a fresh copy of the repo
git clone --mirror git@github.com:yourusername/yourrepo.git
cd yourrepo.git

# 3. Create file with patterns to remove
cat > secrets-to-remove.txt <<EOF
REDIS_PASSWORD
JWT_SECRET
JWT_REFRESH_SECRET
SMTP_PASS
TWILIO_AUTH_TOKEN
ADMIN_PASSWORD
EOF

# 4. Run BFG to remove secrets
java -jar bfg-1.14.0.jar --replace-text secrets-to-remove.txt

# 5. Run git gc
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# 6. Force push (WARNING: Destructive)
git push --force

# 7. Notify team to re-clone repository
echo "All team members must delete local clones and re-clone"
```

### Method 2: git filter-repo (Alternative)

```bash
# 1. Install git-filter-repo
pip install git-filter-repo

# 2. Remove .env files from history
git filter-repo --path apps/food-waste-backend/.env --invert-paths
git filter-repo --path apps/mobile/.env --invert-paths

# 3. Force push
git push origin --force --all
git push origin --force --tags
```

---

## 4. IMPLEMENT SECRET MANAGEMENT SOLUTION

### Option A: GitHub Secrets (For GitHub Actions)

```bash
# Set all production secrets
gh secret set DATABASE_URL --body "mongodb+srv://..."
gh secret set REDIS_PASSWORD --body "..."
gh secret set JWT_SECRET --body "..."
gh secret set JWT_REFRESH_SECRET --body "..."
gh secret set SMTP_PASS --body "..."
gh secret set TWILIO_AUTH_TOKEN --body "..."

# List all secrets
gh secret list

# Verify in workflow
# .github/workflows/deploy.yml
env:
  DATABASE_URL: ${{ secrets.DATABASE_URL }}
  JWT_SECRET: ${{ secrets.JWT_SECRET }}
```

### Option B: AWS Secrets Manager

```bash
# Create secret in AWS
aws secretsmanager create-secret \
  --name foodwaste/production/database-url \
  --secret-string "mongodb+srv://..."

aws secretsmanager create-secret \
  --name foodwaste/production/jwt-secret \
  --secret-string "$(node -e 'console.log(require("crypto").randomBytes(64).toString("hex"))')"

# Retrieve in application
# Install AWS SDK
pnpm add @aws-sdk/client-secrets-manager

# Update app.module.ts
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const client = new SecretsManagerClient({ region: 'us-east-1' });
const command = new GetSecretValueCommand({ SecretId: 'foodwaste/production/jwt-secret' });
const response = await client.send(command);
const secret = response.SecretString;
```

### Option C: HashiCorp Vault

```bash
# Install Vault CLI
wget https://releases.hashicorp.com/vault/1.15.0/vault_1.15.0_linux_amd64.zip
unzip vault_1.15.0_linux_amd64.zip
sudo mv vault /usr/local/bin/

# Initialize Vault
vault server -dev

# Store secrets
vault kv put secret/foodwaste/production \
  database_url="mongodb+srv://..." \
  jwt_secret="..." \
  redis_password="..."

# Retrieve in application
vault kv get -field=jwt_secret secret/foodwaste/production
```

---

## 5. VERIFICATION CHECKLIST

After rotation, verify each service:

```bash
# ✓ Redis connectivity
redis-cli -h <host> -p <port> -a <new-password> ping

# ✓ MongoDB connectivity
mongosh "<new-connection-string>" --eval "db.adminCommand('ping')"

# ✓ JWT token generation
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test123"}'

# ✓ Email sending
curl -X POST http://localhost:3000/api/test/email

# ✓ SMS sending
curl -X POST http://localhost:3000/api/test/sms

# ✓ Firebase storage
curl -X GET http://localhost:3000/api/test/firebase

# ✓ Payment gateway
curl -X POST http://localhost:3000/api/test/payment
```

---

## 6. ONGOING SECRET ROTATION POLICY

### Automated Rotation Schedule

```typescript
// apps/food-waste-backend/src/auth/services/secret-rotation.service.ts
import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class SecretRotationService {
  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT)
  async checkSecretAge() {
    const secrets = ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'REDIS_PASSWORD', 'DATABASE_URL'];

    for (const secret of secrets) {
      const age = await this.getSecretAge(secret);

      // Alert if secret is older than 90 days
      if (age > 90) {
        await this.notifySecurityTeam({
          secret,
          age,
          message: `Secret ${secret} is ${age} days old and should be rotated`,
        });
      }
    }
  }
}
```

### Manual Rotation Schedule

| Secret            | Rotation Frequency | Next Rotation |
| ----------------- | ------------------ | ------------- |
| JWT Keys          | Every 90 days      | 2026-02-20    |
| Database Password | Every 180 days     | 2026-05-20    |
| Redis Password    | Every 90 days      | 2026-02-20    |
| SMTP Password     | Every 180 days     | 2026-05-20    |
| API Keys          | Every 90 days      | 2026-02-20    |

---

## 7. INCIDENT RESPONSE TIMELINE

| Time  | Action                     | Status         |
| ----- | -------------------------- | -------------- |
| T+0h  | Discover exposure          | ✓ Complete     |
| T+1h  | Remove .env from repo      | ⏳ In Progress |
| T+2h  | Rotate Redis credentials   | ⏳ Pending     |
| T+3h  | Rotate JWT secrets         | ⏳ Pending     |
| T+4h  | Rotate MongoDB credentials | ⏳ Pending     |
| T+6h  | Rotate all other secrets   | ⏳ Pending     |
| T+12h | Clean git history          | ⏳ Pending     |
| T+24h | Verify all services        | ⏳ Pending     |
| T+48h | Post-incident review       | ⏳ Pending     |

---

## 8. POST-INCIDENT ACTIONS

1. **Conduct Security Audit**
   - Review all access logs for suspicious activity
   - Check for unauthorized database queries
   - Monitor payment transactions

2. **Implement Preventive Measures**
   - Add pre-commit hooks to prevent .env commits
   - Enable secret scanning in CI/CD
   - Implement mandatory code review

3. **Update Documentation**
   - Document incident in security log
   - Update runbooks
   - Train team on secret management

4. **Notify Stakeholders**
   - Inform management of incident
   - Prepare customer notification if data accessed
   - File incident report

---

## SUPPORT & ESCALATION

**Security Team:** security@foodwaste.com **On-Call Engineer:** +1-XXX-XXX-XXXX
**Incident Commander:** [Name]

**External Support:**

- Redis Cloud Support: https://redis.com/company/support/
- MongoDB Atlas Support: https://www.mongodb.com/cloud/support
- Twilio Support: https://support.twilio.com/

---

**Last Updated:** November 21, 2025 **Next Review:** December 21, 2025
**Version:** 1.0
