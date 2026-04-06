# UI/UX Best Practices Guide

**For:** `@foodwaste/mobile` React Native App **Last Updated:** 2025-12-20
**Based on:** Modern authentication UX standards (WCAG 2.2, FIDO Alliance
guidelines)

---

## Core Principles

### 1. Security with Usability

- **Balance security and convenience** - implement phishing-resistant but
  frictionless flows
- **Support password managers** - use `autocomplete` attributes, allow paste
- **Offer multiple auth methods** - passkeys, biometrics, magic links, social
  login
- **Implement MFA smartly** - "remember this device" to reduce friction

### 2. Clarity & Minimal Cognitive Load

- **Clear labeling** - "Create Account" vs "Log In" (no ambiguity)
- **No memory tests** - support autofill, biometrics, magic links
- **Inline validation** - show requirements upfront, validate in real-time
- **Progressive disclosure** - don't overwhelm with options, tuck secondary
  methods

### 3. Inclusivity & Accessibility

- **Plain language** - Grade 8 reading level, avoid jargon
- **Screen reader support** - proper labels, ARIA attributes, focus states
- **Color-blind friendly** - high contrast, don't rely on color alone for errors
- **Keyboard navigation** - logical tab order, visible focus indicators
- **Alternative auth methods** - don't force memorization (WCAG 2.2 requirement)

### 4. Mobile-First Design

- **Big tap targets** - minimum 44x44pt for buttons
- **Leverage platform features** - SMS OTP autofill, biometrics (Face ID/Touch
  ID)
- **Responsive layouts** - avoid tiny text, minimize scrolling on small screens
- **QR code flows** - for cross-device login

### 5. Trust & Security Signals

- **Visual security cues** - SSL indicators, privacy statement links
- **Transparent permissions** - "We only get your name and email" near social
  login
- **Security notifications** - alert on new device logins
- **Consistent branding** - on-brand login screens build trust

### 6. Data-Informed Iteration

- **Track metrics** - signup conversion, login success rate, password reset
  frequency
- **Monitor drop-off points** - identify friction in forms
- **A/B test** - button copy, field order, validation messages

---

## Authentication Methods (Recommended for Food Waste App)

| Method                          | Pros                            | Cons                           | Use Case             |
| ------------------------------- | ------------------------------- | ------------------------------ | -------------------- |
| **Email + Password**            | Familiar, universal             | High friction, frequent resets | Fallback option      |
| **Social Login (Google/Apple)** | One-tap, no new password        | Privacy concerns, dependency   | Primary quick signup |
| **Magic Link (Email)**          | Passwordless, cross-device      | Email delivery delays          | Alternative login    |
| **Phone + OTP**                 | Fast with autofill, no password | SMS security limits            | Phone-first markets  |
| **Biometric (Face/Touch ID)**   | One-tap, phishing-resistant     | Device-dependent               | Returning users      |
| **MFA (2FA add-on)**            | Major security uplift           | Extra friction                 | High-risk accounts   |

**Current Implementation:** Email+Password, Email verification, Phone
verification, MFA support

**Recommendation:** Add social login (Google/Apple) + biometric auth for
returning users

---

## Sign-Up Flow Best Practices

### Keep It Simple

✅ **DO:**

- Ask minimum info upfront (email + password only)
- Derive display name from email or ask optionally
- Offer social sign-up buttons (Google, Apple, Facebook)
- Use "Show Password" toggle instead of "Confirm Password" field
- Allow immediate access with background email verification

❌ **DON'T:**

- Ask for username, address, birthday upfront
- Use redundant "Confirm Password" fields
- Wait for email verification before granting access (unless required by
  security)
- Make forms longer than 3-4 fields

### Progressive Onboarding

- **Multi-step forms** - break long forms into 2-3 steps with progress
  indicators
- **Save as you go** - persist partial data
- **First step quick** - email/password only to create account
- **Profile completion later** - collect additional info post-signup

### Form UI Details

```tsx
// Password field with visibility toggle
<Input
  type="password"
  autocomplete="new-password"
  showToggle={true}
  placeholder="Create a password"
/>

// Inline validation
<PasswordStrengthIndicator
  password={password}
  requirements={passwordPolicy.requirements}
  showRealTime={true}
/>

// Strong CTA
<Button variant="primary" size="lg">Create Account</Button>
```

### Error Prevention

- Use correct input types (`type="email"` triggers email keyboard)
- Validate email format on blur: "That doesn't look like a valid email"
- Show password requirements inline with real-time feedback (green checkmarks)
- Pre-fill country code for phone inputs

### GDPR & Consents

- Brief checkbox: "I agree to the [Terms] and [Privacy Policy]"
- Newsletter opt-in unchecked by default
- Links to legal docs, not inline text

### Post-Signup

- **Auto-login** - don't force re-login after signup
- **Welcome message** - friendly onboarding or tour
- **Verification prompt** - "Please verify your email" with resend option
- **Immediate value** - grant access to core features

---

## Login Experience Best Practices

### Quick Access

✅ **DO:**

- Keep users logged in (long-lived secure sessions)
- Skip login screen if already authenticated
- Offer "Keep me signed in" checkbox (web)
- Auto-login on mobile after first successful login

❌ **DON'T:**

- Log users out arbitrarily
- Clear session on every app close
- Force login for browsing public content

### Password Input UX

```tsx
<Input
  type="password"
  autocomplete="current-password"
  allowPaste={true}
  showToggle={true}
  label="Password"
/>
```

- **Allow paste** - don't block password managers
- **Visibility toggle** - eye icon to show/hide
- **Autocomplete attributes** - `username`, `current-password`

### Error Handling

```tsx
// Good error message
'Incorrect password. [Forgot password?]';

// Better error with context
"We couldn't find an account with that email. [Sign up]";

// After multiple failures
'Too many failed attempts. Try again in 5 minutes or [reset your password].';
```

**Rules:**

1. Show errors instantly after submission
2. Keep email/username pre-filled (don't clear on error)
3. Generic first failure: "Email or password is incorrect"
4. Offer escape routes: "Forgot password?" or "Sign up" links
5. Never lock users without clear explanation + recovery path

### Account Recovery

- **"Forgot password?" link** - below password field
- **Streamlined reset** - email → click link → new password → auto-login
- **No security questions** - too much friction
- **Help link** - "Need help logging in?" → FAQ or support

### Loading & Feedback

```tsx
<Button loading={isLoading} disabled={isLoading} onPress={handleLogin}>
  {isLoading ? 'Logging in...' : 'Log In'}
</Button>
```

- Spinner on button during API call
- Success message: "Success! Redirecting..." (brief)
- Smooth transition to app dashboard

### MFA UX

- **Choice of methods** - SMS, TOTP app, push notification
- **Clear instructions** - "Enter the 6-digit code from Authenticator app"
- **Auto-read SMS codes** - use SMS autofill APIs
- **Remember device** - "Don't ask again on this device for 30 days"
- **Backup codes** - provide downloadable recovery codes

---

## Error Handling & Recovery

### Error Message Guidelines

| Principle        | Implementation                                                            |
| ---------------- | ------------------------------------------------------------------------- |
| **Clarity**      | "Invalid password" not "Login failed"                                     |
| **Politeness**   | "Incorrect password. Please try again." not "You entered wrong password!" |
| **Precision**    | "No account found for that email" (if enumeration risk is low)            |
| **Constructive** | Always provide next step: "Reset it here" or "Try again"                  |

### Common Scenarios

| Error                        | UX Response                                                                          |
| ---------------------------- | ------------------------------------------------------------------------------------ |
| **Forgot Password**          | Prefill email → Send reset link → "Check inbox" + resend option                      |
| **Incorrect Password (1st)** | Inline error near field, keep email filled                                           |
| **Incorrect Password (3x)**  | Surface "Forgot password?" prominently                                               |
| **Email Not Found**          | "No account for this email — [Sign up]"                                              |
| **Account Exists (signup)**  | "You already have an account. [Log in]" with email prefilled                         |
| **Email Not Verified**       | "Please verify your email. [Resend]" + limited mode access                           |
| **Account Locked**           | "Locked for 5 minutes due to failed attempts. [Reset password] or [Contact support]" |
| **Invalid/Expired OTP**      | "Code expired. [Resend code]" + timer                                                |
| **Expired Magic Link**       | "Link expired. [Send new link]" with email prefilled                                 |
| **Network Error**            | "Connection issue. [Retry]" (don't clear form)                                       |
| **MFA Failed**               | "Code incorrect. Try again or [use backup codes]"                                    |

### Error UI Patterns

```tsx
// Inline error with icon and helpful action
<Input
  error={errors.password}
  errorAction={
    <Link onPress={handleForgotPassword}>
      Forgot password?
    </Link>
  }
/>

// Live region for screen readers
<Text role="alert" aria-live="polite">
  {errorMessage}
</Text>

// Shake animation on error
<Animated.View style={shakeAnimation}>
  <Input error={error} />
</Animated.View>
```

---

## Microcopy & Delight

### Password Strength

```
"Strength: Weak" → "Add 2 more characters"
"Strength: Good" → "Great! Add a symbol to make it stronger"
"Strength: Strong" → "Perfect! Your account is secure"
```

### 2FA Prompts

```
"Enter the 6-digit code we sent to ***-***-1234"
"Open your Authenticator app and enter your verification code"
```

### Success Messages

```
"🎉 Welcome to FoodWaste!"
"Account created! Let's get started."
"You've been logged out. See you soon!"
```

### Loading States

```
"Setting up your account..."
"Verifying your email..."
"Almost there! Preparing your dashboard..."
```

### Error Humor (Use Sparingly)

```
"Passwords are tricky! Try again or reset it below."
"Hmm, that code didn't work. Check your inbox for the latest one."
```

---

## Accessibility Checklist (WCAG 2.2)

### Form Inputs

- [ ] Every field has a `<label>` or `aria-label`
- [ ] Don't rely on placeholders alone (they disappear)
- [ ] Use `autocomplete` attributes (`username`, `current-password`,
      `new-password`)
- [ ] Allow paste on all fields (critical for password managers)

### Keyboard Navigation

- [ ] Logical tab order (email → password → submit)
- [ ] Visible focus indicators (outline, underline, border)
- [ ] No focus traps (all elements reachable and escapable)
- [ ] Enter key submits form

### Error Accessibility

- [ ] Errors announced via `role="alert"` or `aria-live="polite"`
- [ ] Link errors to fields via `aria-describedby`
- [ ] 4.5:1 contrast ratio for error text
- [ ] Use icon + text (not color alone) for errors

### Visual

- [ ] Minimum 44x44pt tap targets on mobile
- [ ] Support text resize up to 200% without breaking layout
- [ ] High contrast mode compatible
- [ ] Color-blind friendly (don't use red/green alone)

### Alternative Auth Methods

- [ ] Offer passwordless options (magic link, biometric, social)
- [ ] If using CAPTCHA, provide audio alternative
- [ ] Biometric auth must have PIN/password fallback
- [ ] No memorization-only authentication (WCAG 2.2)

### Testing

- [ ] Test with VoiceOver (iOS) or TalkBack (Android)
- [ ] Test with keyboard only (no mouse/touch)
- [ ] Test at 200% text scale
- [ ] Test in high contrast mode

---

## Implementation Roadmap for FoodWaste App

### Phase 1: Current State Audit ✅

- [x] Email + password auth
- [x] Email verification flow
- [x] Phone verification flow
- [x] Password strength indicator
- [x] MFA support
- [x] Inline validation

### Phase 2: Quick Wins (1-2 sprints)

- [ ] Add "Show password" toggle to all password fields
- [ ] Remove "Confirm password" field from signup (use toggle instead)
- [ ] Implement SMS OTP autofill (iOS/Android)
- [ ] Add "Remember this device" for MFA
- [ ] Improve error messages (use table above)
- [ ] Add "Resend" buttons for OTP/verification emails

### Phase 3: Enhanced Auth (2-3 sprints)

- [ ] Add Google Sign-In (OAuth)
- [ ] Add Apple Sign-In (required for App Store)
- [ ] Implement biometric auth for returning users (Face ID/Touch ID)
- [ ] Add magic link login option
- [ ] Progressive signup (minimal → full profile)

### Phase 4: Polish & Accessibility (1-2 sprints)

- [ ] Full WCAG 2.2 audit
- [ ] Add shake animations on errors
- [ ] Improve microcopy (password hints, success messages)
- [ ] Implement "Remember me" checkbox
- [ ] Add security notifications (new device login emails)

### Phase 5: Analytics & Optimization (Ongoing)

- [ ] Track signup conversion funnel
- [ ] Monitor password reset frequency
- [ ] A/B test social login vs email signup
- [ ] Measure MFA adoption rate
- [ ] Monitor login success rate

---

## Code Examples

### Password Input with Toggle

```tsx
// apps/mobile/src/design-system/components/molecules/PasswordInput/PasswordInput.tsx
import React, { useState } from 'react';
import { Input } from '@/design-system/atoms/Input';
import { IconButton } from '@/design-system/atoms/IconButton';

export const PasswordInput: React.FC<PasswordInputProps> = ({
  value,
  onChangeText,
  placeholder = 'Password',
  autocomplete = 'current-password',
  error,
  ...props
}) => {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <Input
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      secureTextEntry={!isVisible}
      autoComplete={autocomplete}
      textContentType={autocomplete === 'new-password' ? 'newPassword' : 'password'}
      error={error}
      rightElement={
        <IconButton
          icon={isVisible ? 'eye-off' : 'eye'}
          onPress={() => setIsVisible(!isVisible)}
          accessibilityLabel={isVisible ? 'Hide password' : 'Show password'}
        />
      }
      {...props}
    />
  );
};
```

### SMS OTP Autofill (iOS/Android)

```tsx
// apps/mobile/src/features/auth/screens/VerifyPhoneScreen.tsx
import { useEffect } from 'react';
import { Platform } from 'react-native';
import SmsRetriever from 'react-native-sms-retriever';

export const VerifyPhoneScreen = () => {
  useEffect(() => {
    if (Platform.OS === 'android') {
      // Android SMS User Consent API
      SmsRetriever.requestPhoneNumber().then(async (phoneNumber) => {
        // Auto-fill phone number
      });

      SmsRetriever.startSmsRetriever().then(async (registered) => {
        if (registered) {
          SmsRetriever.addSmsListener((event) => {
            const otp = /(\d{6})/.exec(event.message)?.[1];
            if (otp) {
              setCode(otp);
              // Auto-submit
            }
          });
        }
      });
    }

    // iOS automatically handles OTP autofill via textContentType="oneTimeCode"
  }, []);

  return (
    <OTPInput
      value={code}
      onChange={setCode}
      length={6}
      autoFocus
      textContentType="oneTimeCode" // iOS autofill
    />
  );
};
```

### Biometric Auth

```tsx
// apps/mobile/src/services/BiometricAuth.ts
import ReactNativeBiometrics from 'react-native-biometrics';

export const BiometricAuth = {
  async isAvailable(): Promise<boolean> {
    const { available } = await ReactNativeBiometrics.isSensorAvailable();
    return available;
  },

  async authenticate(reason: string): Promise<boolean> {
    try {
      const { success } = await ReactNativeBiometrics.simplePrompt({
        promptMessage: reason,
        cancelButtonText: 'Use password',
      });
      return success;
    } catch (error) {
      return false;
    }
  },

  async createKeys(): Promise<string> {
    const { publicKey } = await ReactNativeBiometrics.createKeys();
    return publicKey;
  },
};

// Usage in LoginScreen
const handleBiometricLogin = async () => {
  const isAvailable = await BiometricAuth.isAvailable();
  if (!isAvailable) {
    // Fallback to password
    return;
  }

  const success = await BiometricAuth.authenticate('Log in to FoodWaste');
  if (success) {
    // Retrieve stored token and login
    const token = await SecureStorage.getAccessToken();
    dispatch(loginSuccess({ token }));
  }
};
```

### Accessible Error Display

```tsx
// apps/mobile/src/design-system/components/atoms/Input/Input.tsx
export const Input: React.FC<InputProps> = ({ label, error, errorAction, ...props }) => {
  const errorId = `${props.id}-error`;

  return (
    <View>
      <Text variant="label.medium">{label}</Text>
      <TextInput
        {...props}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
        accessibilityLabel={label}
      />
      {error && (
        <View style={styles.errorContainer}>
          <Icon name="alert-circle" color="error" size={16} />
          <Text id={errorId} variant="body.small" color="error" role="alert" aria-live="polite">
            {error}
          </Text>
          {errorAction && errorAction}
        </View>
      )}
    </View>
  );
};
```

---

## Resources & References

### Standards & Guidelines

- [WCAG 2.2 Accessible Authentication](https://www.w3.org/WAI/WCAG22/Understanding/accessible-authentication-minimum)
- [FIDO Alliance Passkey UX Guidelines](https://fidoalliance.org/ux-guidelines/)
- [Nielsen Norman Group: Error Messages](https://www.nngroup.com/articles/error-message-guidelines/)

### Platform Documentation

- [iOS Human Interface Guidelines - Authentication](https://developer.apple.com/design/human-interface-guidelines/sign-in-with-apple)
- [Android Material Design - Authentication](https://material.io/design/communication/authentication.html)
- [Google Identity Services](https://developers.google.com/identity)

### Security

- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [NIST Digital Identity Guidelines](https://pages.nist.gov/800-63-3/)

### React Native Libraries

- [react-native-biometrics](https://github.com/SelfLender/react-native-biometrics)
- [react-native-sms-retriever](https://github.com/Bruno-Furtado/react-native-sms-retriever)
- [@react-native-google-signin/google-signin](https://github.com/react-native-google-signin/google-signin)
- [react-native-apple-authentication](https://github.com/invertase/react-native-apple-authentication)

---

**Maintained by:** Mobile Team **Review Cycle:** Quarterly **Next Review:**
2025-03-20
