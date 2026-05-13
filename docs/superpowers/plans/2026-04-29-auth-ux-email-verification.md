# Auth UX Fixes & Email Verification Rework — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three auth UX issues — remove the blocking "Authentication
Required" alert, remove confirm password fields from signup/reset password, and
rework email verification to use OS-level App Links / Universal Links routing.

**Architecture:** Email verification links change from
`{WEB_FRONTEND_URL}/verify-callback?token=xxx` to
`https://toofreshtowaste.com/verify-email?token=xxx`. On mobile devices with the
app installed, Android App Links / iOS Universal Links intercept the URL and
open the app directly. On desktop or without the app, the Next.js web page
handles the token server-side and shows a role-appropriate success message. The
backend GET redirect controller and email template are updated to use the new
path. The web page is rebuilt using the existing auth split-layout design (left
hero + right content).

**Tech Stack:** React Native 0.81, Next.js 15 (App Router), NestJS 11, Yup,
React Hook Form, next-intl, Tailwind CSS, shadcn/ui

---

## File Structure

| Action | File                                                            | Responsibility                                                                     |
| ------ | --------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Modify | `apps/mobile/.env`                                              | Change `ENVIRONMENT=production`                                                    |
| Modify | `apps/mobile/src/utils/errorHandler.ts`                         | Suppress auth error display for unauthenticated users                              |
| Modify | `apps/mobile/src/utils/validation/schemas.ts`                   | Remove `confirmPassword` from register + reset schemas                             |
| Modify | `apps/mobile/src/features/auth/screens/RegisterScreen.tsx`      | Remove confirm password field + related state                                      |
| Modify | `apps/mobile/src/features/auth/screens/ResetPasswordScreen.tsx` | Remove confirm password field + related state                                      |
| Modify | `apps/mobile/android/app/src/main/AndroidManifest.xml`          | Change intent filter path `/verify-callback` → `/verify-email`                     |
| Modify | `apps/mobile/src/navigation/linking.ts`                         | Change deep link path mapping `/verify-callback` → `/verify-email`                 |
| Modify | `apps/food-waste-backend/src/email/email.service.ts`            | Change verification URL path `/verify-callback` → `/verify-email`                  |
| Modify | `apps/food-waste-backend/src/auth/auth-redirect.controller.ts`  | Update redirect path from `/email-verified` to `/verify-email` (with status param) |
| Create | `apps/web/src/app/[locale]/(auth)/verify-email/page.tsx`        | Rewrite: split-layout page that verifies token + shows role-appropriate result     |
| Delete | `apps/web/src/app/[locale]/(auth)/verify-callback/page.tsx`     | Replaced by new `/verify-email` page                                               |
| Modify | `apps/web/src/messages/en.json`                                 | Add/update verify-email translation keys                                           |
| Modify | `apps/web/src/messages/fr.json`                                 | Add/update verify-email translation keys                                           |
| Modify | `apps/web/src/messages/ar.json`                                 | Add/update verify-email translation keys                                           |
| Create | `apps/web/public/.well-known/apple-app-site-association`        | AASA file for iOS Universal Links                                                  |

---

### Task 1: Remove "Authentication Required" Alert (Mobile)

**Files:**

- Modify: `apps/mobile/.env:14`
- Modify: `apps/mobile/src/utils/errorHandler.ts:248-270`

The blocking `Alert.alert()` appears because `ENVIRONMENT=development` →
`environment.isProduction` is `false` → the error handler shows a native Alert
dialog. Two fixes: (1) set `ENVIRONMENT=production`, and (2) suppress auth error
display entirely when the user is unauthenticated (these are expected 401s from
the API interceptor, not actionable errors).

- [ ] **Step 1: Change ENVIRONMENT to production in .env**

In `apps/mobile/.env`, change line 14:

```diff
-ENVIRONMENT=development
+ENVIRONMENT=production
```

- [ ] **Step 2: Suppress auth errors for unauthenticated users**

In `apps/mobile/src/utils/errorHandler.ts`, modify the `showErrorToUser` method
(lines 248-270) to skip display for `AUTHENTICATION` errors. These are 401
responses that trigger the auth flow (session expiry → redirect to login);
showing them to the user is noise, not information.

Replace the `showErrorToUser` method:

```typescript
  private static showErrorToUser(error: AppError): void {
    const message = error.userMessage ?? error.message;
    const title = this.getErrorTitle(error.type);

    // NETWORK errors → non-intrusive top banner (not Alert or Toast)
    if (error.type === ErrorType.NETWORK) {
      networkErrorBus.emit(message);
      return;
    }

    // AUTH errors are handled by the auth flow (redirect to login).
    // Showing an alert/toast is redundant and bad UX.
    if (error.type === ErrorType.AUTHENTICATION) {
      return;
    }

    // All other errors → non-intrusive Toast (production-safe)
    showErrorToast(title, message);
  }
```

- [ ] **Step 3: Verify the change compiles**

Run: `cd apps/mobile && pnpm type-check` Expected: No new errors.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/.env apps/mobile/src/utils/errorHandler.ts
git commit -m "fix(mobile): remove blocking auth alert, set ENVIRONMENT=production

Suppress Authentication errors from user display — they are handled
by the auth flow (redirect to login). Remove dev-only Alert.alert()
by switching ENVIRONMENT to production.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 2: Remove Confirm Password from Signup & Reset Password (Mobile)

**Files:**

- Modify: `apps/mobile/src/utils/validation/schemas.ts:122-131,137-143`
- Modify:
  `apps/mobile/src/features/auth/screens/RegisterScreen.tsx:62-71,80-81,448-475`
- Modify:
  `apps/mobile/src/features/auth/screens/ResetPasswordScreen.tsx:52-59,66,460-492`

Confirm password adds friction without meaningful security benefit on mobile
(password managers auto-fill, and the password strength indicator already
validates). Remove the field from both schemas and both screens.

- [ ] **Step 1: Remove confirmPassword from validation schemas**

In `apps/mobile/src/utils/validation/schemas.ts`, update `registerMobileSchema`
(lines 122-131):

```typescript
export const registerMobileSchema = yup.object({
  firstName: nameValidator('First name'),
  lastName: nameValidator('Last name'),
  email: emailValidator,
  password: passwordValidator,
});
```

Update `resetPasswordSchema` (lines 137-143):

```typescript
export const resetPasswordSchema = yup.object({
  password: passwordValidator,
});
```

- [ ] **Step 2: Verify schema types compile**

Run: `cd apps/mobile && pnpm type-check` Expected: Type errors in
`RegisterScreen.tsx` and `ResetPasswordScreen.tsx` (referencing removed
`confirmPassword` field). This is expected — we fix them next.

- [ ] **Step 3: Remove confirmPassword from RegisterScreen**

In `apps/mobile/src/features/auth/screens/RegisterScreen.tsx`:

**3a.** Remove `confirmPassword` from `defaultValues` (line 69):

```typescript
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
    },
```

**3b.** Remove `showConfirmPassword` state (line 81):

Delete this line:

```typescript
const [showConfirmPassword, setShowConfirmPassword] = useState(false);
```

**3c.** Remove the entire Confirm Password Controller block (lines 448-475):

Delete the entire block from `{/* Confirm Password Input */}` through the
closing `/>` of the `</Controller>`.

- [ ] **Step 4: Remove confirmPassword from ResetPasswordScreen**

In `apps/mobile/src/features/auth/screens/ResetPasswordScreen.tsx`:

**4a.** Remove `confirmPassword` from `defaultValues` (line 58):

```typescript
    defaultValues: {
      password: '',
    },
```

**4b.** Remove `showConfirmPassword` state (line 66):

Delete this line:

```typescript
const [showConfirmPassword, setShowConfirmPassword] = useState(false);
```

**4c.** Remove the entire Confirm Password Controller block (lines 460-492):

Delete the entire block from `{/* Confirm Password Input */}` through the
closing `/>` of the `</Controller>`.

- [ ] **Step 5: Verify the changes compile**

Run: `cd apps/mobile && pnpm type-check` Expected: No errors.
`RegisterMobileFormData` and `ResetPasswordFormData` types are inferred from
schemas automatically.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/utils/validation/schemas.ts apps/mobile/src/features/auth/screens/RegisterScreen.tsx apps/mobile/src/features/auth/screens/ResetPasswordScreen.tsx
git commit -m "fix(mobile): remove confirm password from signup and reset password

Confirm password adds friction without security benefit on mobile.
Password strength indicator already validates. Removes field from
both screens and their Yup validation schemas.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 3: Update Email Verification URL Path (Backend)

**Files:**

- Modify: `apps/food-waste-backend/src/email/email.service.ts:181`
- Modify: `apps/food-waste-backend/src/auth/auth-redirect.controller.ts:93,98`

Change the verification link from `/verify-callback` to `/verify-email`
everywhere. The backend generates two things:

1. The email link URL (in `email.service.ts`) — this is what users click in
   their email
2. The redirect URL after GET verification (in `auth-redirect.controller.ts`) —
   this is where the browser goes after the backend verifies

Both need to point to `/verify-email`.

- [ ] **Step 1: Update email service verification URL**

In `apps/food-waste-backend/src/email/email.service.ts`, line 181:

```diff
-    const verificationUrl = `${this.getFrontendUrl()}/verify-callback?token=${encodeURIComponent(verificationToken)}`;
+    const verificationUrl = `${this.getFrontendUrl()}/verify-email?token=${encodeURIComponent(verificationToken)}`;
```

- [ ] **Step 2: Update auth redirect controller**

In `apps/food-waste-backend/src/auth/auth-redirect.controller.ts`, update the
redirect destination (lines 93 and 98) from `/email-verified` to
`/verify-email`:

Line 93:

```diff
-      this.redirectToFrontend(res, '/email-verified', 'success');
+      this.redirectToFrontend(res, '/verify-email', 'success');
```

Line 98:

```diff
-      this.redirectToFrontend(res, '/email-verified', 'error');
+      this.redirectToFrontend(res, '/verify-email', 'error');
```

Also update the method at line 63 (token-missing case):

```diff
-      this.redirectToFrontend(res, '/email-verified', 'error');
+      this.redirectToFrontend(res, '/verify-email', 'error');
```

- [ ] **Step 3: Verify backend compiles**

Run: `cd apps/food-waste-backend && pnpm type-check` Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add apps/food-waste-backend/src/email/email.service.ts apps/food-waste-backend/src/auth/auth-redirect.controller.ts
git commit -m "feat(backend): change verification URL path to /verify-email

Update email link and GET redirect to use /verify-email instead of
/verify-callback. This aligns with Android App Links intent filter
and the new web verification page path.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 4: Update Mobile Deep Link Configuration

**Files:**

- Modify: `apps/mobile/android/app/src/main/AndroidManifest.xml:75`
- Modify: `apps/mobile/src/navigation/linking.ts:59`

Update the Android intent filter and React Navigation deep link mapping from
`/verify-callback` to `/verify-email`.

- [ ] **Step 1: Update AndroidManifest.xml intent filter**

In `apps/mobile/android/app/src/main/AndroidManifest.xml`, line 75:

```diff
-            <data android:scheme="https"
-                  android:host="toofreshtowaste.com"
-                  android:pathPrefix="/verify-callback" />
+            <data android:scheme="https"
+                  android:host="toofreshtowaste.com"
+                  android:pathPrefix="/verify-email" />
```

- [ ] **Step 2: Update React Navigation linking config**

In `apps/mobile/src/navigation/linking.ts`, update the VerifyEmail screen path
(line 59) and the comment (line 57):

```diff
          VerifyEmail: {
-            // Email magic links land on /verify-callback?token=...
+            // Email magic links land on /verify-email?token=...
            // Email is intentionally absent from the URL (prevents user enumeration).
-            path: 'verify-callback',
+            path: 'verify-email',
            parse: {
              token: (token: string) => token,
            },
          },
```

Also update the header comment (line 14):

```diff
- *   /verify-callback   → AuthStack › VerifyEmail   (email magic link)
+ *   /verify-email      → AuthStack › VerifyEmail   (email magic link)
```

- [ ] **Step 3: Verify mobile compiles**

Run: `cd apps/mobile && pnpm type-check` Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/android/app/src/main/AndroidManifest.xml apps/mobile/src/navigation/linking.ts
git commit -m "feat(mobile): update deep link path to /verify-email

Change Android App Links intent filter and React Navigation linking
config from /verify-callback to /verify-email. Matches the updated
backend email URL and web page path.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 5: Rework Web Email Verification Page

**Files:**

- Rewrite: `apps/web/src/app/[locale]/(auth)/verify-email/page.tsx`
- Delete: `apps/web/src/app/[locale]/(auth)/verify-callback/page.tsx`
- Modify: `apps/web/src/messages/en.json`
- Modify: `apps/web/src/messages/fr.json`
- Modify: `apps/web/src/messages/ar.json`

The new `/verify-email` page replaces both the old `/verify-callback` and
`/verify-email` pages. It handles two scenarios:

1. **Token present** (`?token=xxx`): Verifies email via POST to backend, shows
   role-appropriate success/error
2. **Status present** (`?status=success|error`): Arrived via backend GET
   redirect, shows result directly

Design: Uses the same split-layout as login/signup — left hero panel + right
content area. This is the `fixed inset-0 z-50` pattern used by `login/page.tsx`.

**Success states:**

- Consumer: "Email Verified! Return to the app on your phone" (no redirect, no
  store links)
- Merchant: "Email Verified!" + "Back to Login" button

- [ ] **Step 1: Add/update translation keys**

In `apps/web/src/messages/en.json`, inside the `"auth"` object, add/update these
keys:

```json
    "verifyEmailTitle": "Verifying...",
    "verifyEmailSuccessTitle": "Email Verified!",
    "verifyEmailConsumerMessage": "Your email has been verified successfully. Return to the app on your phone to continue.",
    "verifyEmailMerchantMessage": "Your email has been verified successfully. You can now sign in to your dashboard.",
    "verifyEmailBackToLogin": "Back to Login",
    "verifyEmailFailedTitle": "Verification Failed",
    "verifyEmailFailedMessage": "The verification link is invalid or has expired. Please request a new verification email.",
    "verifyEmailFailedBackToLogin": "Back to Login",
    "verifyEmailMissingToken": "Invalid verification link. Please check your email and try again."
```

In `apps/web/src/messages/fr.json`, inside `"auth"`:

```json
    "verifyEmailTitle": "Verification en cours...",
    "verifyEmailSuccessTitle": "Email verifie !",
    "verifyEmailConsumerMessage": "Votre email a ete verifie avec succes. Retournez a l'application sur votre telephone pour continuer.",
    "verifyEmailMerchantMessage": "Votre email a ete verifie avec succes. Vous pouvez maintenant vous connecter a votre tableau de bord.",
    "verifyEmailBackToLogin": "Retour a la connexion",
    "verifyEmailFailedTitle": "Echec de la verification",
    "verifyEmailFailedMessage": "Le lien de verification est invalide ou a expire. Veuillez demander un nouvel email de verification.",
    "verifyEmailFailedBackToLogin": "Retour a la connexion",
    "verifyEmailMissingToken": "Lien de verification invalide. Veuillez verifier votre email et reessayer."
```

In `apps/web/src/messages/ar.json`, inside `"auth"`:

```json
    "verifyEmailTitle": "...جاري التحقق",
    "verifyEmailSuccessTitle": "!تم التحقق من البريد الالكتروني",
    "verifyEmailConsumerMessage": ".تم التحقق من بريدك الالكتروني بنجاح. ارجع الى التطبيق على هاتفك للمتابعة",
    "verifyEmailMerchantMessage": ".تم التحقق من بريدك الالكتروني بنجاح. يمكنك الان تسجيل الدخول الى لوحة التحكم",
    "verifyEmailBackToLogin": "العودة لتسجيل الدخول",
    "verifyEmailFailedTitle": "فشل التحقق",
    "verifyEmailFailedMessage": ".رابط التحقق غير صالح او منتهي الصلاحية. يرجى طلب بريد تحقق جديد",
    "verifyEmailFailedBackToLogin": "العودة لتسجيل الدخول",
    "verifyEmailMissingToken": ".رابط التحقق غير صالح. يرجى التحقق من بريدك الالكتروني والمحاولة مرة اخرى"
```

- [ ] **Step 2: Delete the old verify-callback page**

Delete `apps/web/src/app/[locale]/(auth)/verify-callback/page.tsx`.

- [ ] **Step 3: Write the new verify-email page**

Rewrite `apps/web/src/app/[locale]/(auth)/verify-email/page.tsx`:

```tsx
'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import {
  Loader2,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Store,
  Rocket,
} from 'lucide-react';
import { Link } from '@/i18n/routing';
import { authService } from '@/services/auth.service';
import { UserRole } from '@foodwaste/shared';
import '../../(merchant-onboarding)/merchant-signup/merchant-signup.css';

type VerifyState =
  | 'loading'
  | 'success-merchant'
  | 'success-consumer'
  | 'error';

function VerifyEmailInner() {
  const t = useTranslations('auth');
  const tHero = useTranslations('merchantSignup');
  const searchParams = useSearchParams();

  const token = searchParams.get('token') ?? '';
  const statusParam = searchParams.get('status');

  const [state, setState] = useState<VerifyState>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const calledRef = useRef(false);

  useEffect(() => {
    if (calledRef.current) return;

    // Case 1: Arrived via backend GET redirect with status param (no token needed)
    if (statusParam === 'success') {
      // Backend already verified — we don't know the role, default to consumer message
      setState('success-consumer');
      calledRef.current = true;
      return;
    }
    if (statusParam === 'error') {
      setState('error');
      setErrorMessage(t('verifyEmailFailedMessage'));
      calledRef.current = true;
      return;
    }

    // Case 2: Direct link with token — verify via POST
    if (!token) {
      setState('error');
      setErrorMessage(t('verifyEmailMissingToken'));
      return;
    }

    calledRef.current = true;

    async function verify() {
      try {
        const response = await authService.verifyEmail({ token });
        const data = response.data.data;

        const userRole = data.user?.role;
        const isMerchant =
          userRole === UserRole.MERCHANT || userRole === UserRole.ADMIN;

        if (isMerchant) {
          setState('success-merchant');
        } else {
          setState('success-consumer');
        }
      } catch {
        setState('error');
        setErrorMessage(t('verifyEmailFailedMessage'));
      }
    }

    verify();
  }, [token, statusParam, t]);

  const stats = [
    { value: '34%', label: tHero('statRevenue'), Icon: TrendingUp },
    { value: '2+', label: tHero('statStores'), Icon: Store },
    { value: '∞', label: tHero('statGrowth'), Icon: Rocket },
  ];

  return (
    <div className='merchant-signup-theme fixed inset-0 z-50 flex flex-col overflow-hidden lg:flex-row'>
      {/* LEFT HERO SECTION */}
      <div className='relative flex flex-[1.1] flex-col justify-between px-5 py-3 sm:py-6 sm:px-8 lg:flex-1 lg:p-12 bg-[hsl(174,72%,17%)]'>
        <Image
          src='/images/hero-bg.jpg'
          alt=''
          fill
          sizes='(max-width: 1024px) 100vw, 55vw'
          className='object-cover'
          priority
          quality={85}
        />
        <div className='absolute inset-0 bg-[hsl(174,72%,17%)] opacity-85' />

        <div className='relative z-10 flex h-full flex-col justify-between gap-2 sm:gap-5 lg:gap-8'>
          <div className='flex items-center gap-2'>
            <Image
              src='/images/image.svg'
              alt='Too Fresh To Waste'
              width={32}
              height={32}
              className='brightness-0 invert sm:w-6'
            />
            <span className='text-sm font-semibold tracking-wide text-white sm:text-base lg:text-lg'>
              Too Fresh To Waste
            </span>
          </div>

          <div className='flex max-w-xl flex-1 flex-col justify-center'>
            <span className='mb-1 inline-block w-fit rounded-full bg-white/15 px-3 py-1 text-[8px] font-semibold uppercase tracking-[0.2em] text-white/80 sm:mb-4 sm:px-5 sm:py-1.5 sm:text-[10px] sm:tracking-[0.25em]'>
              {tHero('heroBadge')}
            </span>
            <h1
              className='mb-1 text-xl font-bold leading-[1.2] text-white sm:mb-2 sm:text-2xl lg:mb-3 lg:text-4xl'
              style={{ fontFamily: 'var(--font-serif)' }}
            >
              {tHero('heroTitle')}
            </h1>
            <p className='mb-1 text-xs leading-snug text-white/75 sm:mb-4 sm:text-sm sm:leading-relaxed lg:mb-6 lg:text-lg'>
              {tHero('heroTitleAccent')}
            </p>
            <p className='hidden text-white/60 sm:block sm:text-xs lg:text-base'>
              {tHero('heroDescription')}
            </p>
          </div>

          <div className='space-y-2 sm:space-y-4 lg:space-y-8'>
            <div className='flex gap-2 sm:gap-3'>
              {stats.map(stat => (
                <div
                  key={stat.label}
                  className='flex min-w-0 flex-1 items-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-2 py-2 backdrop-blur-md sm:gap-2 sm:rounded-xl sm:px-3 sm:py-3 lg:gap-3 lg:rounded-2xl lg:px-5 lg:py-4'
                >
                  <stat.Icon className='h-3.5 w-3.5 shrink-0 text-white/70 sm:h-4 sm:w-4 lg:h-5 lg:w-5' />
                  <div className='min-w-0'>
                    <div
                      className='text-sm font-bold leading-tight text-white sm:text-base lg:text-lg'
                      style={{ fontFamily: 'var(--font-serif)' }}
                    >
                      {stat.value}
                    </div>
                    <div className='truncate text-[9px] text-white/60 sm:text-[10px] lg:text-xs'>
                      {stat.label}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className='border-t border-white/15 pt-2 sm:pt-4'>
              <p className='text-[10px] italic leading-relaxed text-white/70 sm:text-xs lg:text-sm'>
                &ldquo;{tHero('testimonialQuote')}&rdquo;
              </p>
              <p className='mt-1 text-[9px] font-medium text-white/50 sm:text-[10px] lg:text-xs'>
                {tHero('testimonialAuthor')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT CONTENT */}
      <div className='flex flex-1 flex-col items-center justify-center bg-background px-5 py-6 sm:p-8 lg:p-16'>
        <div className='w-full max-w-md space-y-6'>
          {state === 'loading' && (
            <div className='flex flex-col items-center gap-4 text-center'>
              <Loader2 className='h-12 w-12 animate-spin text-primary' />
              <h2 className='text-2xl font-semibold'>
                {t('verifyEmailTitle')}
              </h2>
            </div>
          )}

          {state === 'success-consumer' && (
            <div className='flex flex-col items-center gap-4 text-center'>
              <div className='flex h-20 w-20 items-center justify-center rounded-full bg-green-100'>
                <CheckCircle2 className='h-10 w-10 text-green-600' />
              </div>
              <h2 className='text-2xl font-semibold'>
                {t('verifyEmailSuccessTitle')}
              </h2>
              <p className='text-base leading-relaxed text-muted-foreground'>
                {t('verifyEmailConsumerMessage')}
              </p>
            </div>
          )}

          {state === 'success-merchant' && (
            <div className='flex flex-col items-center gap-4 text-center'>
              <div className='flex h-20 w-20 items-center justify-center rounded-full bg-green-100'>
                <CheckCircle2 className='h-10 w-10 text-green-600' />
              </div>
              <h2 className='text-2xl font-semibold'>
                {t('verifyEmailSuccessTitle')}
              </h2>
              <p className='text-base leading-relaxed text-muted-foreground'>
                {t('verifyEmailMerchantMessage')}
              </p>
              <Link
                href='/login'
                className='mt-4 inline-flex h-11 items-center justify-center rounded-lg bg-primary px-8 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90'
              >
                {t('verifyEmailBackToLogin')}
              </Link>
            </div>
          )}

          {state === 'error' && (
            <div className='flex flex-col items-center gap-4 text-center'>
              <div className='flex h-20 w-20 items-center justify-center rounded-full bg-red-100'>
                <XCircle className='h-10 w-10 text-red-600' />
              </div>
              <h2 className='text-2xl font-semibold'>
                {t('verifyEmailFailedTitle')}
              </h2>
              <p className='text-base leading-relaxed text-muted-foreground'>
                {errorMessage || t('verifyEmailFailedMessage')}
              </p>
              <Link
                href='/login'
                className='mt-4 inline-flex h-11 items-center justify-center rounded-lg bg-primary px-8 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90'
              >
                {t('verifyEmailFailedBackToLogin')}
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-background'>
          <Loader2 className='h-10 w-10 animate-spin text-primary' />
        </div>
      }
    >
      <VerifyEmailInner />
    </Suspense>
  );
}
```

- [ ] **Step 4: Verify web compiles**

Run: `cd apps/web && pnpm type-check` Expected: No errors.

- [ ] **Step 5: Start dev server and test**

Run: `cd apps/web && pnpm dev`

Test these URLs:

- `http://localhost:3001/en/verify-email?token=invalid` → should show error
  state
- `http://localhost:3001/en/verify-email?status=success` → should show consumer
  success
- `http://localhost:3001/en/verify-email?status=error` → should show error state
- `http://localhost:3001/en/verify-email` (no params) → should show missing
  token error
- Verify layout matches login page (left hero + right content)
- Check RTL with Arabic locale:
  `http://localhost:3001/ar/verify-email?status=success`

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/\[locale\]/\(auth\)/verify-email/page.tsx apps/web/src/messages/en.json apps/web/src/messages/fr.json apps/web/src/messages/ar.json
git rm apps/web/src/app/\[locale\]/\(auth\)/verify-callback/page.tsx
git commit -m "feat(web): rework verify-email page with split-layout design

Replace verify-callback with verify-email page using the shared
auth layout (left hero + right content). Handles both token-based
POST verification and status-based GET redirect from backend.

Consumer: shows 'Return to the app on your phone' message.
Merchant: shows 'Back to Login' button.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 6: Create iOS Apple App Site Association File

**Files:**

- Create: `apps/web/public/.well-known/apple-app-site-association`

Prepare the AASA file for iOS Universal Links. This tells iOS to open the app
when users tap `https://toofreshtowaste.com/verify-email` or `/reset-password`
links. The actual Xcode configuration (Associated Domains entitlement) is
deferred to when a macOS runner is available.

Note: The `appID` format is `<TeamID>.<BundleID>`. Replace `XXXXXXXXXX` with the
actual Apple Developer Team ID when known.

- [ ] **Step 1: Create the AASA file**

Create `apps/web/public/.well-known/apple-app-site-association`:

```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "XXXXXXXXXX.com.toofreshtowaste.app",
        "paths": ["/verify-email*", "/reset-password*"]
      }
    ]
  }
}
```

- [ ] **Step 2: Verify the file is served correctly**

Run: `cd apps/web && pnpm dev`

Fetch: `http://localhost:3001/.well-known/apple-app-site-association` Expected:
JSON response with correct content. No HTML wrapper.

Note: In production, Next.js serves files from `public/` at the root path. The
`Content-Type` should be `application/json`. If Next.js doesn't set the correct
content type, a `next.config.js` header override may be needed — check during
production deployment.

- [ ] **Step 3: Commit**

```bash
git add apps/web/public/.well-known/apple-app-site-association
git commit -m "feat(web): add Apple App Site Association file for iOS Universal Links

Prepares AASA for iOS to intercept /verify-email and /reset-password
links. Team ID placeholder needs to be replaced with actual Apple
Developer Team ID. Xcode Associated Domains entitlement deferred
to macOS runner.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 7: End-to-End Verification

No files changed — this task verifies the full flow works.

- [ ] **Step 1: Run full type-check across monorepo**

Run (from root): `pnpm type-check` Expected: No new errors in mobile, web, or
backend.

- [ ] **Step 2: Run linter**

Run (from root): `pnpm lint` Expected: No new warnings or errors.

- [ ] **Step 3: Verify deep link paths are consistent**

Cross-check that all these match `/verify-email`:

- `apps/mobile/android/app/src/main/AndroidManifest.xml` —
  `android:pathPrefix="/verify-email"`
- `apps/mobile/src/navigation/linking.ts` — `path: 'verify-email'`
- `apps/food-waste-backend/src/email/email.service.ts` — URL contains
  `/verify-email?token=`
- `apps/food-waste-backend/src/auth/auth-redirect.controller.ts` — redirects to
  `/verify-email`
- `apps/web/src/app/[locale]/(auth)/verify-email/page.tsx` — page exists at this
  route

- [ ] **Step 4: Test on Android device (after rebuild)**

1. Build debug APK: `cd apps/mobile && pnpm build:android:debug`
2. Install on device
3. Send a test verification email
4. Tap the link — should open the app directly (not browser)
5. App should show VerifyEmailScreen with auto-verification

- [ ] **Step 5: Test web fallback (no app installed)**

1. Open verification link in desktop browser
2. Should show the verify-email page with left hero + right content
3. On success: consumer sees "Return to the app" message, merchant sees "Back to
   Login" button
