'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  TrendingUp,
  Store,
  Rocket,
  ArrowLeft,
  ChevronLeft,
  Mail,
  Lock,
  Eye,
  EyeOff,
  MailCheck,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { Button, Input, Label } from '@foodwaste/ui';
import { Link } from '@/i18n/routing';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { useAuth } from '@/hooks/use-auth';
import { BusinessSearchAutocomplete } from '@/components/merchant-signup/business-search-autocomplete';
import { PasswordStrengthIndicator } from '@/components/auth/password-strength-indicator';
import type { PlaceDetails } from '@/types/geolocation';
import type { RegisterRequest } from '@foodwaste/shared';
import { PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH, UserRole } from '@foodwaste/shared';
import { authService } from '@/services/auth.service';
import './merchant-signup.css';

const RESEND_COOLDOWN_SECONDS = 60;

const TOTAL_STEPS = 3;

/** Field constraints — mirrored from backend RegisterDto */
const FIELD_LIMITS = {
  NAME_MIN: 2,
  NAME_MAX: 50,
  EMAIL_MIN: 5,
  EMAIL_MAX: 255,
  PHONE_MAX: 15,
} as const;

interface FormData {
  // Step 1 - Business
  businessName: string;
  googlePlaceId: string;
  latitude: number;
  longitude: number;
  formattedAddress: string;
  addressComponents: PlaceDetails['addressComponents'] | null;
  types: string[];
  // Step 2 - Email
  email: string;
  // Step 3 - Credentials
  firstName: string;
  lastName: string;
  password: string;
  phone: string;
}

const INITIAL_FORM_DATA: FormData = {
  businessName: '',
  googlePlaceId: '',
  latitude: 0,
  longitude: 0,
  formattedAddress: '',
  addressComponents: null,
  types: [],
  email: '',
  firstName: '',
  lastName: '',
  password: '',
  phone: '',
};

export default function MerchantSignupPage() {
  const t = useTranslations('merchantSignup');
  const { register } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<FormData>(INITIAL_FORM_DATA);
  const [selectedBusiness, setSelectedBusiness] = useState<PlaceDetails | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [isResending, setIsResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [submitError, setSubmitError] = useState('');
  const [resendFeedback, setResendFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // ── Field updater ──
  const updateField = useCallback(
    <K extends keyof FormData>(key: K, value: FormData[K]) => {
      setFormData((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  // ── Step 1: Business selection ──
  const handleBusinessSelect = useCallback(
    (details: PlaceDetails) => {
      setSelectedBusiness(details);
      setFormData((prev) => ({
        ...prev,
        businessName: details.name,
        googlePlaceId: details.googlePlaceId,
        latitude: details.coords.lat,
        longitude: details.coords.lng,
        formattedAddress: details.formattedAddress,
        addressComponents: details.addressComponents ?? null,
        types: details.types ?? [],
      }));
    },
    [],
  );

  const handleBusinessClear = useCallback(() => {
    setSelectedBusiness(null);
    setFormData((prev) => ({
      ...prev,
      businessName: '',
      googlePlaceId: '',
      latitude: 0,
      longitude: 0,
      formattedAddress: '',
      addressComponents: null,
      types: [],
    }));
  }, []);

  // ── Validation ──
  const isEmailValid =
    formData.email.length >= FIELD_LIMITS.EMAIL_MIN &&
    formData.email.length <= FIELD_LIMITS.EMAIL_MAX &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email);
  const isStep1Valid = !!formData.googlePlaceId;
  const isStep2Valid = isEmailValid;
  const isStep3Valid =
    formData.firstName.trim().length >= FIELD_LIMITS.NAME_MIN &&
    formData.firstName.trim().length <= FIELD_LIMITS.NAME_MAX &&
    formData.lastName.trim().length >= FIELD_LIMITS.NAME_MIN &&
    formData.lastName.trim().length <= FIELD_LIMITS.NAME_MAX &&
    formData.password.length >= PASSWORD_MIN_LENGTH &&
    formData.password.length <= PASSWORD_MAX_LENGTH;

  // ── Navigation ──
  const handleNext = useCallback(() => {
    setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  }, []);

  const handleBack = useCallback(() => {
    setStep((s) => Math.max(s - 1, 1));
  }, []);

  // ── Submit ──
  const handleSubmit = useCallback(async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setSubmitError('');

    try {
      const payload: RegisterRequest = {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        ...(formData.phone.trim() ? { phoneNumber: formData.phone.trim() } : {}),
        role: UserRole.MERCHANT,
        businessInfo: {
          name: formData.businessName,
          googlePlaceId: formData.googlePlaceId,
          latitude: formData.latitude,
          longitude: formData.longitude,
          formattedAddress: formData.formattedAddress,
          ...(formData.addressComponents ? { addressComponents: formData.addressComponents } : {}),
          ...(formData.types.length > 0 ? { types: formData.types } : {}),
        },
      };

      await register(payload);
      setRegisteredEmail(payload.email);
    } catch (error: unknown) {
      const responseData = (error as { response?: { data?: { message?: unknown } } })
        ?.response?.data?.message;
      let errorMessage = t('errorGeneric');
      if (typeof responseData === 'string') {
        errorMessage = responseData;
      } else if (
        responseData &&
        typeof responseData === 'object' &&
        'message' in responseData
      ) {
        // Backend validation errors: { message: [...], error: "Bad Request", statusCode: 400 }
        const nested = (responseData as { message?: unknown }).message;
        if (typeof nested === 'string') {
          errorMessage = nested;
        } else if (Array.isArray(nested)) {
          // Extract first constraint message from validation errors
          const first = nested[0];
          if (typeof first === 'string') {
            errorMessage = first;
          } else if (first && typeof first === 'object' && 'constraints' in first) {
            const constraints = (first as { constraints?: Record<string, string> }).constraints;
            errorMessage = constraints ? Object.values(constraints)[0] ?? errorMessage : errorMessage;
          }
        }
      }
      setSubmitError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, isSubmitting, register, t]);

  // ── Resend cooldown timer ──
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleResend = useCallback(async () => {
    if (cooldown > 0 || isResending || !registeredEmail) return;
    setIsResending(true);
    setResendFeedback(null);
    try {
      await authService.resendVerification(registeredEmail);
      setResendFeedback({ type: 'success', text: t('resendSuccess') });
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch {
      setResendFeedback({ type: 'error', text: t('errorGeneric') });
    } finally {
      setIsResending(false);
    }
  }, [cooldown, isResending, registeredEmail, t]);

  // ── "Check Your Inbox" UI (replaces form after successful registration) ──
  const renderCheckInbox = () => (
    <div className="flex flex-col items-center text-center space-y-5">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
        <MailCheck className="h-10 w-10 text-green-600" />
      </div>
      <div className="space-y-2">
        <h2
          className="text-xl font-bold text-black sm:text-2xl lg:text-3xl"
          style={{ fontFamily: 'var(--font-serif)' }}
        >
          {t('checkInboxTitle')}
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
          {t('checkInboxDescription', { email: registeredEmail })}
        </p>
      </div>
      <p className="text-xs text-muted-foreground sm:text-sm">
        {t('checkSpamHint')}
      </p>
      <Button
        variant="outline"
        className="w-full h-11 rounded-xl text-sm font-semibold sm:h-12"
        onClick={handleResend}
        disabled={isResending || cooldown > 0}
      >
        {isResending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {cooldown > 0
          ? t('resendCooldown', { seconds: cooldown })
          : t('resendEmail')}
      </Button>
      {resendFeedback && (
        <div
          className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2.5 text-sm ${
            resendFeedback.type === 'success'
              ? 'border-green-200 bg-green-50 text-green-700'
              : 'border-destructive/30 bg-destructive/5 text-destructive'
          }`}
        >
          {resendFeedback.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          <span>{resendFeedback.text}</span>
        </div>
      )}
      <Link
        href="/login"
        className="text-sm font-medium text-primary hover:text-primary/80"
      >
        {t('loginLink')}
      </Link>
    </div>
  );

  // ── Step indicator ──
  const renderStepIndicator = () => (
    <div className="flex items-center gap-2">
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
        <div
          key={i}
          className={`h-1.5 flex-1 rounded-full transition-colors ${
            i < step ? 'bg-primary' : 'bg-muted'
          }`}
        />
      ))}
    </div>
  );

  // ── Step content ──
  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-4 sm:space-y-5">
            <div>
              <h2
                className="flex items-center gap-2 text-xl font-bold text-black sm:text-2xl lg:text-3xl"
                style={{ fontFamily: 'var(--font-serif)' }}
              >
                {t('step1Title')}
                <Image
                  src="/icons/Blue Bold Modern How to Get Verified Instagram Post.svg"
                  alt="Verified"
                  width={22}
                  height={22}
                  className="h-3 w-3 shrink-0 sm:h-4 sm:w-4"
                />
              </h2>
              <p className="mt-1 text-sm text-muted-foreground sm:text-base">
                {t('step1Description')}
              </p>
            </div>

            <BusinessSearchAutocomplete
              onSelect={handleBusinessSelect}
              onClear={handleBusinessClear}
              selectedBusiness={selectedBusiness}
            />

            {/* Terms */}
            <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">
              {t('termsPrefix')}{' '}
              <Link
                href="/privacy"
                className="text-primary underline underline-offset-2 hover:text-primary/80"
              >
                {t('privacyPolicy')}
              </Link>{' '}
              {t('termsAnd')}{' '}
              <Link
                href="/terms"
                className="text-primary underline underline-offset-2 hover:text-primary/80"
              >
                {t('termsConditions')}
              </Link>
              .
            </p>

            <Button
              className="h-11 w-full rounded-xl text-sm font-semibold sm:h-12"
              disabled={!isStep1Valid}
              onClick={handleNext}
            >
              {t('next')}
            </Button>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4 sm:space-y-5">
            <div>
              <h2
                className="text-xl font-bold text-black sm:text-2xl lg:text-3xl"
                style={{ fontFamily: 'var(--font-serif)' }}
              >
                {t('step2Title')}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground sm:text-base">
                {t('step2Description')}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">{t('emailLabel')}</Label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder={t('emailPlaceholder')}
                  className="h-11 rounded-xl border-input bg-secondary/50 pl-10 text-sm sm:h-12"
                  value={formData.email}
                  onChange={(e) => updateField('email', e.target.value)}
                  maxLength={FIELD_LIMITS.EMAIL_MAX}
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="h-11 flex-1 rounded-xl text-sm font-semibold sm:h-12"
                onClick={handleBack}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t('back')}
              </Button>
              <Button
                className="h-11 flex-[2] rounded-xl text-sm font-semibold sm:h-12"
                disabled={!isStep2Valid}
                onClick={handleNext}
              >
                {t('next')}
              </Button>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4 sm:space-y-5">
            <div>
              <h2
                className="text-xl font-bold text-black sm:text-2xl lg:text-3xl"
                style={{ fontFamily: 'var(--font-serif)' }}
              >
                {t('step3Title')}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground sm:text-base">
                {t('step3Description')}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="firstName">{t('firstNameLabel')}</Label>
                <Input
                  id="firstName"
                  placeholder={t('firstNamePlaceholder')}
                  className="h-11 rounded-xl border-input bg-secondary/50 text-sm sm:h-12"
                  value={formData.firstName}
                  onChange={(e) => updateField('firstName', e.target.value)}
                  maxLength={FIELD_LIMITS.NAME_MAX}
                  autoComplete="given-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">{t('lastNameLabel')}</Label>
                <Input
                  id="lastName"
                  placeholder={t('lastNamePlaceholder')}
                  className="h-11 rounded-xl border-input bg-secondary/50 text-sm sm:h-12"
                  value={formData.lastName}
                  onChange={(e) => updateField('lastName', e.target.value)}
                  maxLength={FIELD_LIMITS.NAME_MAX}
                  autoComplete="family-name"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">{t('phoneLabel')}</Label>
              <Input
                id="phone"
                type="tel"
                inputMode="numeric"
                placeholder={t('phonePlaceholder')}
                className="h-11 rounded-xl border-input bg-secondary/50 text-sm sm:h-12"
                value={formData.phone}
                onChange={(e) => {
                  // Allow only digits and leading +
                  const cleaned = e.target.value.replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '');
                  updateField('phone', cleaned);
                }}
                maxLength={FIELD_LIMITS.PHONE_MAX}
                autoComplete="tel"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">{t('passwordLabel')}</Label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder={t('passwordPlaceholder')}
                  className="h-11 rounded-xl border-input bg-secondary/50 pl-7 pr-10 text-sm sm:h-12"
                  value={formData.password}
                  onChange={(e) => updateField('password', e.target.value)}
                  maxLength={PASSWORD_MAX_LENGTH}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <PasswordStrengthIndicator password={formData.password} />
            </div>

            {submitError && (
              <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{submitError}</span>
              </div>
            )}

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="h-11 flex-1 rounded-xl text-sm font-semibold sm:h-12"
                onClick={handleBack}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t('back')}
              </Button>
              <Button
                className="h-11 flex-[2] rounded-xl text-sm font-semibold sm:h-12"
                disabled={!isStep3Valid || isSubmitting}
                onClick={handleSubmit}
              >
                {isSubmitting ? t('submitting') : t('createAccount')}
              </Button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="merchant-signup-theme flex h-[100dvh] flex-col overflow-hidden lg:flex-row">
      {/* ================================================================
          LEFT HERO SECTION (unchanged)
          ================================================================ */}
      <div className="relative flex flex-[1.1] flex-col justify-between px-5 py-3 sm:py-6 sm:px-8 lg:flex-1 lg:p-12">
        <Image
          src="/images/hero-bg.jpg"
          alt=""
          fill
          sizes="(max-width: 1024px) 100vw, 55vw"
          className="object-cover"
          priority
          quality={85}
        />
        <div className="absolute inset-0 bg-[hsl(174,72%,17%)] opacity-85" />

        <div className="relative z-10 flex h-full flex-col justify-between gap-2 sm:gap-5 lg:gap-8">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <Image
              src="/images/image.svg"
              alt="Too Fresh To Waste"
              width={32}
              height={32}
              className="brightness-0 invert sm:w-6"
            />
            <span className="text-sm font-semibold tracking-wide text-white sm:text-base lg:text-lg">
              Too Fresh To Waste
            </span>
          </div>

          {/* Main hero content */}
          <div className="flex max-w-xl flex-1 flex-col justify-center">
            <span className="mb-1 inline-block w-fit rounded-full bg-white/15 px-3 py-1 text-[8px] font-semibold uppercase tracking-[0.2em] text-white/80 sm:mb-4 sm:px-5 sm:py-1.5 sm:text-[10px] sm:tracking-[0.25em]">
              {t('heroBadge')}
            </span>
            <h1
              className="mb-1 text-xl font-bold leading-[1.2] text-white sm:mb-2 sm:text-2xl lg:mb-3 lg:text-4xl"
              style={{ fontFamily: 'var(--font-serif)' }}
            >
              {t('heroTitle')}
            </h1>
            <p className="mb-1 text-xs leading-snug text-white/75 sm:mb-4 sm:text-sm sm:leading-relaxed lg:mb-6 lg:text-lg">
              {t('heroTitleAccent')}
            </p>
            <p className="hidden text-white/60 sm:block sm:text-xs lg:text-base">
              {t('heroDescription')}
            </p>
          </div>

          {/* Stats */}
          <div className="space-y-2 sm:space-y-4 lg:space-y-8">
            <div className="flex gap-2 sm:gap-3">
              {[
                { value: '34%', label: t('statRevenue'), Icon: TrendingUp },
                { value: '2+', label: t('statStores'), Icon: Store },
                { value: '\u221E', label: t('statGrowth'), Icon: Rocket },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="flex min-w-0 flex-1 items-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-2 py-2 backdrop-blur-md sm:gap-2 sm:rounded-xl sm:px-3 sm:py-3 lg:gap-3 lg:rounded-2xl lg:px-5 lg:py-4"
                >
                  <stat.Icon className="h-3.5 w-3.5 shrink-0 text-white/70 sm:h-4 sm:w-4 lg:h-5 lg:w-5" />
                  <div className="min-w-0">
                    <div
                      className="text-sm font-bold leading-tight text-white sm:text-base lg:text-lg"
                      style={{ fontFamily: 'var(--font-serif)' }}
                    >
                      {stat.value}
                    </div>
                    <div className="truncate text-[9px] text-white/60 sm:text-[10px] lg:text-xs">
                      {stat.label}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Testimonial */}
            <div className="border-t border-white/15 pt-2 sm:pt-4">
              <p className="text-[10px] italic leading-relaxed text-white/70 sm:text-xs lg:text-sm">
                &ldquo;{t('testimonialQuote')}&rdquo;
              </p>
              <p className="mt-1 text-[9px] font-medium text-white/50 sm:text-[10px] lg:text-xs">
                {t('testimonialAuthor')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ================================================================
          RIGHT FORM SECTION — Multi-step
          ================================================================ */}
      <div className="flex flex-1 flex-col items-center justify-center bg-background px-5 py-6 sm:p-8 lg:p-16">
        <div className="w-full max-w-md space-y-4 sm:space-y-6 lg:space-y-8">
          {registeredEmail ? (
            /* ── "Check Your Inbox" replaces the form ── */
            renderCheckInbox()
          ) : (
            <>
              {/* Back chevron — router.back() on step 1, previous step on steps 2/3 */}
              <button
                type="button"
                onClick={() => (step === 1 ? router.back() : handleBack())}
                className="flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
                aria-label="Go back"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>

              {/* Step indicator */}
              {renderStepIndicator()}

              {/* Step content */}
              {renderStep()}

              <p className="text-center text-sm text-muted-foreground sm:text-base">
                {t('hasAccount')}{' '}
                <Link
                  href="/login"
                  className="font-medium text-primary hover:text-primary/80"
                >
                  {t('loginLink')}
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
