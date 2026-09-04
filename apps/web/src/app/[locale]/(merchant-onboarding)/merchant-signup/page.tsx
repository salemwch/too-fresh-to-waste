'use client';

import { useState, useCallback, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  TrendingUp,
  Store,
  Rocket,
  ArrowLeft,
  ChevronLeft,
  ChevronDown,
  Mail,
  Lock,
  Eye,
  EyeOff,
  MailCheck,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Utensils,
  UtensilsCrossed,
  Coffee,
  ShoppingBasket,
  ShoppingBag,
  Building2,
  Package,
  Zap,
  Cookie,
  Wheat,
  GlassWater,
  Scissors,
  Apple,
  PawPrint,
  Flower2,
  Fish,
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
import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  UserRole,
  EstablishmentType,
} from '@foodwaste/shared';
import { authService } from '@/services/auth.service';
import './merchant-signup.css';

const RESEND_COOLDOWN_SECONDS = 60;

const TOTAL_STEPS = 4;

/** Strip HTML tag delimiters from user text input (defense-in-depth; backend also sanitizes) */
function sanitizeInput(value: string): string {
  return value.replace(/[<>]/g, '');
}

/** Pre-select the most likely EstablishmentType from Google Place types */
function guessTypeFromGoogleTypes(googleTypes?: string[]): EstablishmentType {
  if (!googleTypes?.length) return EstablishmentType.OTHER;
  const map: Record<string, EstablishmentType> = {
    restaurant: EstablishmentType.RESTAURANT,
    bakery: EstablishmentType.BAKERY,
    pastry_shop: EstablishmentType.PASTRY_SHOP,
    cafe: EstablishmentType.CAFE,
    coffee_shop: EstablishmentType.CAFE,
    meal_takeaway: EstablishmentType.TAKEAWAY,
    takeout_restaurant: EstablishmentType.TAKEAWAY,
    meal_delivery: EstablishmentType.FAST_FOOD,
    fast_food_restaurant: EstablishmentType.FAST_FOOD,
    sushi_restaurant: EstablishmentType.SUSHI_RESTAURANT,
    grocery_or_supermarket: EstablishmentType.GROCERY_STORE,
    grocery_store: EstablishmentType.GROCERY_STORE,
    supermarket: EstablishmentType.SUPERMARKET,
    butcher_shop: EstablishmentType.BUTCHER_SHOP,
    liquor_store: EstablishmentType.BEVERAGE_SHOP,
    pet_store: EstablishmentType.PET_STORE,
    florist: EstablishmentType.FLOWER_PLANT,
    flower_shop: EstablishmentType.FLOWER_PLANT,
    lodging: EstablishmentType.HOTEL,
    hotel: EstablishmentType.HOTEL,
  };
  for (const t of googleTypes) {
    const mapped = map[t];
    if (mapped) return mapped;
  }
  return EstablishmentType.OTHER;
}

const ESTABLISHMENT_TYPE_OPTIONS: {
  value: EstablishmentType;
  labelKey: string;
  Icon: React.FC<{ className?: string }>;
}[] = [
  { value: EstablishmentType.RESTAURANT, labelKey: 'typeRestaurant', Icon: Utensils },
  { value: EstablishmentType.BAKERY, labelKey: 'typeBakery', Icon: Wheat },
  { value: EstablishmentType.PASTRY_SHOP, labelKey: 'typePastryShop', Icon: Cookie },
  { value: EstablishmentType.CAFE, labelKey: 'typeCafe', Icon: Coffee },
  { value: EstablishmentType.FAST_FOOD, labelKey: 'typeFastFood', Icon: Zap },
  { value: EstablishmentType.BUFFET_RESTAURANT, labelKey: 'typeBuffet', Icon: UtensilsCrossed },
  { value: EstablishmentType.SUSHI_RESTAURANT, labelKey: 'typeSushi', Icon: Fish },
  { value: EstablishmentType.TAKEAWAY, labelKey: 'typeTakeaway', Icon: ShoppingBag },
  { value: EstablishmentType.GROCERY_STORE, labelKey: 'typeGrocery', Icon: ShoppingBasket },
  { value: EstablishmentType.SUPERMARKET, labelKey: 'typeSupermarket', Icon: Store },
  { value: EstablishmentType.FRUIT_VEGETABLES, labelKey: 'typeFruitVeg', Icon: Apple },
  { value: EstablishmentType.BUTCHER_SHOP, labelKey: 'typeButcher', Icon: Scissors },
  { value: EstablishmentType.BEVERAGE_SHOP, labelKey: 'typeBeverage', Icon: GlassWater },
  { value: EstablishmentType.PET_STORE, labelKey: 'typePetStore', Icon: PawPrint },
  { value: EstablishmentType.FLOWER_PLANT, labelKey: 'typeFlowerPlant', Icon: Flower2 },
  { value: EstablishmentType.HOTEL, labelKey: 'typeHotel', Icon: Building2 },
  { value: EstablishmentType.OTHER, labelKey: 'typeOther', Icon: Package },
];

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
  // Step 2 - Type
  establishmentType: EstablishmentType | null;
  // Step 3 - Email
  email: string;
  // Step 4 - Credentials
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
  establishmentType: null,
  email: '',
  password: '',
  phone: '',
};

function MerchantSignupInner() {
  const t = useTranslations('merchantSignup');
  const { register } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const referralCode = searchParams.get('ref');

  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<FormData>(INITIAL_FORM_DATA);
  const [selectedBusiness, setSelectedBusiness] = useState<PlaceDetails | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [isResending, setIsResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [submitError, setSubmitError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [resendFeedback, setResendFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);
  const typeDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!typeDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (typeDropdownRef.current && !typeDropdownRef.current.contains(e.target as Node)) {
        setTypeDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [typeDropdownOpen]);

  // ── Field updater ──
  const updateField = useCallback(<K extends keyof FormData>(key: K, value: FormData[K]) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  }, []);

  // ── Step 1: Business selection ──
  const handleBusinessSelect = useCallback((details: PlaceDetails) => {
    setSelectedBusiness(details);
    const googleTypes = details.types ?? [];
    setFormData(prev => ({
      ...prev,
      businessName: details.name,
      googlePlaceId: details.googlePlaceId,
      latitude: details.coords.lat,
      longitude: details.coords.lng,
      formattedAddress: details.formattedAddress,
      addressComponents: details.addressComponents ?? null,
      types: googleTypes,
      // Pre-select likely type from Google's data so user just confirms or adjusts
      establishmentType: guessTypeFromGoogleTypes(googleTypes),
    }));
  }, []);

  const handleBusinessClear = useCallback(() => {
    setSelectedBusiness(null);
    setFormData(prev => ({
      ...prev,
      businessName: '',
      googlePlaceId: '',
      latitude: 0,
      longitude: 0,
      formattedAddress: '',
      addressComponents: null,
      types: [],
      establishmentType: null,
    }));
  }, []);

  // ── Validation ──
  const isEmailValid =
    formData.email.length >= FIELD_LIMITS.EMAIL_MIN &&
    formData.email.length <= FIELD_LIMITS.EMAIL_MAX &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email);
  const isStep1Valid = !!formData.googlePlaceId;
  const isStep2Valid = !!formData.establishmentType;
  const isStep3Valid = isEmailValid;
  const isStep4Valid =
    formData.password.length >= PASSWORD_MIN_LENGTH &&
    formData.password.length <= PASSWORD_MAX_LENGTH;

  // ── Navigation ──
  const handleNext = useCallback(() => {
    setEmailError('');
    setPhoneError('');
    setStep(s => Math.min(s + 1, TOTAL_STEPS));
  }, []);

  const handleBack = useCallback(() => {
    setStep(s => Math.max(s - 1, 1));
  }, []);

  // ── Submit ──
  const handleSubmit = useCallback(async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setSubmitError('');

    try {
      const payload: RegisterRequest = {
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        ...(formData.phone.trim() ? { phoneNumber: `+216${formData.phone.trim()}` } : {}),
        ...(referralCode ? { referralCode } : {}),
        role: UserRole.MERCHANT,
        businessInfo: {
          name: formData.businessName,
          googlePlaceId: formData.googlePlaceId,
          latitude: formData.latitude,
          longitude: formData.longitude,
          formattedAddress: formData.formattedAddress,
          ...(formData.addressComponents ? { addressComponents: formData.addressComponents } : {}),
          ...(formData.types.length > 0 ? { types: formData.types } : {}),
          ...(formData.establishmentType ? { establishmentType: formData.establishmentType } : {}),
        },
      };

      await register(payload);
      setRegisteredEmail(payload.email);
    } catch (error: unknown) {
      const httpStatus = (error as { response?: { status?: number } })?.response?.status;
      const responseData = (error as { response?: { data?: { message?: unknown } } })?.response
        ?.data?.message;
      let errorMessage = t('errorGeneric');
      if (typeof responseData === 'string') {
        errorMessage = responseData;
      } else if (responseData && typeof responseData === 'object' && 'message' in responseData) {
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
            errorMessage = constraints
              ? (Object.values(constraints)[0] ?? errorMessage)
              : errorMessage;
          }
        }
      }
      // 409 = conflict — distinguish email vs phone so the right field gets the error
      if (httpStatus === 409) {
        if (errorMessage.toLowerCase().includes('phone')) {
          setPhoneError('This phone number is already registered. Please use a different number.');
        } else {
          setEmailError(t('emailAlreadyInUse'));
          setStep(3);
        }
      } else {
        setSubmitError(errorMessage);
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, isSubmitting, register, t]);

  // ── Resend cooldown timer ──
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown(prev => prev - 1);
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
    <div className='flex flex-col items-center text-center space-y-xl'>
      <div className='flex h-20 w-20 items-center justify-center rounded-full bg-green-100'>
        <MailCheck className='h-10 w-10 text-green-600' />
      </div>
      <div className='space-y-sm'>
        <h2
          className='text-xl font-bold text-black sm:text-2xl lg:text-3xl'
          style={{ fontFamily: 'var(--font-serif)' }}
        >
          {t('checkInboxTitle')}
        </h2>
        <p className='text-sm leading-relaxed text-muted-foreground sm:text-base'>
          {t('checkInboxDescription', { email: registeredEmail })}
        </p>
      </div>
      <p className='text-xs text-muted-foreground sm:text-sm'>{t('checkSpamHint')}</p>
      <Button
        variant='outline'
        className='w-full h-11 rounded-xl text-sm font-semibold sm:h-12'
        onClick={handleResend}
        disabled={isResending || cooldown > 0}
      >
        {isResending && <Loader2 className='me-sm h-4 w-4 animate-spin' />}
        {cooldown > 0 ? t('resendCooldown', { seconds: cooldown }) : t('resendEmail')}
      </Button>
      {resendFeedback && (
        <div
          className={`flex w-full items-center gap-sm rounded-lg border px-md py-2.5 text-sm ${
            resendFeedback.type === 'success'
              ? 'border-green-200 bg-green-50 text-green-700'
              : 'border-destructive/30 bg-destructive/5 text-destructive'
          }`}
        >
          {resendFeedback.type === 'success' ? (
            <CheckCircle2 className='h-4 w-4 shrink-0' />
          ) : (
            <AlertCircle className='h-4 w-4 shrink-0' />
          )}
          <span>{resendFeedback.text}</span>
        </div>
      )}
      <Link href='/login' className='text-sm font-medium text-primary hover:text-primary/80'>
        {t('loginLink')}
      </Link>
    </div>
  );

  // ── Step indicator ──
  const renderStepIndicator = () => (
    <div className='flex items-center gap-sm'>
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
          <div className='space-y-lg sm:space-y-xl'>
            <div>
              <h2
                className='flex items-center gap-sm text-xl font-bold text-black sm:text-2xl lg:text-3xl'
                style={{ fontFamily: 'var(--font-serif)' }}
              >
                {t('step1Title')}
                <Image
                  src='/icons/Blue Bold Modern How to Get Verified Instagram Post.svg'
                  alt='Verified'
                  width={22}
                  height={22}
                  className='h-3 w-3 shrink-0 sm:h-4 sm:w-4'
                />
              </h2>
              <p className='mt-xs text-sm text-muted-foreground sm:text-base'>
                {t('step1Description')}
              </p>
            </div>

            <BusinessSearchAutocomplete
              onSelect={handleBusinessSelect}
              onClear={handleBusinessClear}
              selectedBusiness={selectedBusiness}
            />

            {/* Terms */}
            <p className='text-xs leading-relaxed text-muted-foreground sm:text-sm'>
              {t('termsPrefix')}{' '}
              <Link
                href='/privacy'
                className='text-primary underline underline-offset-2 hover:text-primary/80'
              >
                {t('privacyPolicy')}
              </Link>{' '}
              {t('termsAnd')}{' '}
              <Link
                href='/terms'
                className='text-primary underline underline-offset-2 hover:text-primary/80'
              >
                {t('termsConditions')}
              </Link>
              .
            </p>

            <Button
              className='h-11 w-full rounded-xl text-sm font-semibold sm:h-12'
              disabled={!isStep1Valid}
              onClick={handleNext}
            >
              {t('next')}
            </Button>
          </div>
        );

      case 2: {
        const selectedTypeOption = ESTABLISHMENT_TYPE_OPTIONS.find(
          o => o.value === formData.establishmentType,
        );
        return (
          <div className='space-y-xl sm:space-y-2xl'>
            <div>
              <h2
                className='text-xl font-bold text-black sm:text-2xl lg:text-3xl'
                style={{ fontFamily: 'var(--font-serif)' }}
              >
                {t('step2TypeTitle')}
              </h2>
              <p className='mt-xs text-sm text-muted-foreground sm:text-base'>
                {t('step2TypeDescription')}
              </p>
            </div>

            <div className='space-y-lg'>
              <p className='text-sm font-semibold text-foreground'>{t('businessDetailsLabel')}</p>

              <div className='space-y-1.5'>
                <Label htmlFor='businessType'>{t('storeTypeLabel')}</Label>

                <div className='relative' ref={typeDropdownRef}>
                  {/* Select trigger */}
                  <button
                    id='businessType'
                    type='button'
                    onClick={() => setTypeDropdownOpen(v => !v)}
                    className={`flex h-12 w-full items-center justify-between rounded-xl border bg-background px-lg text-sm transition-colors hover:bg-muted/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${
                      typeDropdownOpen ? 'border-primary ring-2 ring-primary/20' : 'border-input'
                    }`}
                  >
                    {selectedTypeOption ? (
                      <span className='flex items-center gap-2.5 text-foreground'>
                        <selectedTypeOption.Icon className='h-4 w-4 shrink-0 text-muted-foreground' />
                        {t(selectedTypeOption.labelKey)}
                      </span>
                    ) : (
                      <span className='text-muted-foreground'>{t('selectTypePlaceholder')}</span>
                    )}
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${
                        typeDropdownOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {/* Dropdown list */}
                  {typeDropdownOpen && (
                    <div className='absolute z-50 mt-1.5 max-h-60 w-full overflow-y-auto rounded-xl border border-border bg-background shadow-lg'>
                      {ESTABLISHMENT_TYPE_OPTIONS.map(({ value, labelKey, Icon }) => {
                        const isSelected = formData.establishmentType === value;
                        return (
                          <button
                            key={value}
                            type='button'
                            onClick={() => {
                              updateField('establishmentType', value);
                              setTypeDropdownOpen(false);
                            }}
                            className={`flex w-full items-center gap-md px-lg py-md text-sm transition-colors hover:bg-muted/50 ${
                              isSelected
                                ? 'bg-primary/5 font-medium text-primary'
                                : 'text-foreground'
                            }`}
                          >
                            <Icon className='h-4 w-4 shrink-0 text-muted-foreground' />
                            <span>{t(labelKey)}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className='flex gap-md pt-xs'>
              <Button
                variant='outline'
                className='h-12 rounded-xl px-lg text-sm font-semibold'
                onClick={handleBack}
              >
                <ArrowLeft className='h-4 w-4' />
              </Button>
              <Button
                className='h-12 flex-1 rounded-xl text-sm font-semibold'
                disabled={!isStep2Valid}
                onClick={handleNext}
              >
                {t('next')}
              </Button>
            </div>
          </div>
        );
      }

      case 3:
        return (
          <div className='space-y-lg sm:space-y-xl'>
            <div>
              <h2
                className='text-xl font-bold text-black sm:text-2xl lg:text-3xl'
                style={{ fontFamily: 'var(--font-serif)' }}
              >
                {t('step2Title')}
              </h2>
              <p className='mt-xs text-sm text-muted-foreground sm:text-base'>
                {t('step2Description')}
              </p>
            </div>

            <div className='space-y-sm'>
              <Label htmlFor='email'>{t('emailLabel')}</Label>
              <div className='relative'>
                <Mail className='absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
                <Input
                  id='email'
                  type='email'
                  placeholder={t('emailPlaceholder')}
                  className={`h-11 rounded-xl border-input bg-secondary/50 pl-6xl text-sm sm:h-12 ${emailError ? 'border-destructive' : ''}`}
                  value={formData.email}
                  onChange={e => {
                    setEmailError('');
                    updateField('email', sanitizeInput(e.target.value));
                  }}
                  maxLength={FIELD_LIMITS.EMAIL_MAX}
                  autoComplete='email'
                />
              </div>
              {emailError && (
                <div className='flex items-center gap-sm rounded-lg border border-destructive/30 bg-destructive/5 px-md py-2.5 text-sm text-destructive'>
                  <AlertCircle className='h-4 w-4 shrink-0' />
                  <span>{emailError}</span>
                </div>
              )}
            </div>

            <div className='flex gap-md'>
              <Button
                variant='outline'
                className='h-11 flex-1 rounded-xl text-sm font-semibold sm:h-12'
                onClick={handleBack}
              >
                <ArrowLeft className='me-sm h-4 w-4' />
                {t('back')}
              </Button>
              <Button
                className='h-11 flex-[2] rounded-xl text-sm font-semibold sm:h-12'
                disabled={!isStep3Valid}
                onClick={handleNext}
              >
                {t('next')}
              </Button>
            </div>
          </div>
        );

      case 4:
        return (
          <div className='space-y-lg sm:space-y-xl'>
            <div>
              <h2
                className='text-xl font-bold text-black sm:text-2xl lg:text-3xl'
                style={{ fontFamily: 'var(--font-serif)' }}
              >
                {t('step3Title')}
              </h2>
              <p className='mt-xs text-sm text-muted-foreground sm:text-base'>
                {t('step3Description')}
              </p>
            </div>

            <div className='space-y-sm'>
              <Label htmlFor='phone'>{t('phoneLabel')}</Label>
              <div
                className={`flex h-11 overflow-hidden rounded-xl border bg-secondary/50 sm:h-12 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 ${phoneError ? 'border-destructive' : 'border-input'}`}
              >
                <span className='flex items-center border-e border-input bg-muted px-md text-sm font-medium text-muted-foreground select-none'>
                  +216
                </span>
                <input
                  id='phone'
                  type='tel'
                  inputMode='numeric'
                  placeholder='XX XXX XXX'
                  className='flex-1 bg-transparent px-md text-sm outline-none'
                  value={formData.phone}
                  onChange={e => {
                    const digits = e.target.value.replace(/\D/g, '');
                    setPhoneError('');
                    updateField('phone', digits);
                  }}
                  maxLength={8}
                  autoComplete='tel-national'
                />
              </div>
              {phoneError && (
                <div className='flex items-center gap-sm rounded-lg border border-destructive/30 bg-destructive/5 px-md py-2.5 text-sm text-destructive'>
                  <AlertCircle className='h-4 w-4 shrink-0' />
                  <span>{phoneError}</span>
                </div>
              )}
            </div>

            <div className='space-y-sm'>
              <Label htmlFor='password'>{t('passwordLabel')}</Label>
              <div className='relative'>
                <Lock className='absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none' />
                <Input
                  id='password'
                  type={showPassword ? 'text' : 'password'}
                  placeholder={t('passwordPlaceholder')}
                  className='h-11 rounded-xl border-input bg-secondary/50 ps-3xl pe-6xl text-sm sm:h-12'
                  value={formData.password}
                  onChange={e => updateField('password', e.target.value)}
                  maxLength={PASSWORD_MAX_LENGTH}
                  autoComplete='new-password'
                />
                <button
                  type='button'
                  onClick={() => setShowPassword(v => !v)}
                  className='absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground'
                >
                  {showPassword ? <EyeOff className='h-4 w-4' /> : <Eye className='h-4 w-4' />}
                </button>
              </div>
              <PasswordStrengthIndicator password={formData.password} />
            </div>

            {submitError && (
              <div className='flex items-center gap-sm rounded-lg border border-destructive/30 bg-destructive/5 px-md py-2.5 text-sm text-destructive'>
                <AlertCircle className='h-4 w-4 shrink-0' />
                <span>{submitError}</span>
              </div>
            )}

            <div className='flex gap-md'>
              <Button
                variant='outline'
                className='h-11 flex-1 rounded-xl text-sm font-semibold sm:h-12'
                onClick={handleBack}
              >
                <ArrowLeft className='me-sm h-4 w-4' />
                {t('back')}
              </Button>
              <Button
                className='h-11 flex-[2] rounded-xl text-sm font-semibold sm:h-12'
                disabled={!isStep4Valid || isSubmitting}
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
    <div className='merchant-signup-theme flex h-[100dvh] flex-col overflow-hidden lg:flex-row'>
      {/* ================================================================
          LEFT HERO SECTION (unchanged)
          ================================================================ */}
      <div className='relative flex flex-[1.1] flex-col justify-between px-xl py-md sm:py-2xl sm:px-4xl lg:flex-1 lg:p-3xl'>
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

        <div className='relative z-10 flex h-full flex-col justify-between gap-sm sm:gap-xl lg:gap-4xl'>
          {/* Logo */}
          <Link href='/' className='flex items-center gap-sm transition-opacity hover:opacity-80'>
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
          </Link>

          {/* Main hero content */}
          <div className='flex max-w-xl flex-1 flex-col justify-center'>
            <span className='mb-xs inline-block w-fit rounded-full bg-white/15 px-md py-xs text-[8px] font-semibold uppercase tracking-[0.2em] text-white/80 sm:mb-lg sm:px-xl sm:py-1.5 sm:text-[10px] sm:tracking-[0.25em]'>
              {t('heroBadge')}
            </span>
            <h1
              className='mb-xs text-xl font-bold leading-[1.2] text-white sm:mb-sm sm:text-2xl lg:mb-md lg:text-4xl'
              style={{ fontFamily: 'var(--font-serif)' }}
            >
              {t('heroTitle')}
            </h1>
            <p className='mb-xs text-xs leading-snug text-white/75 sm:mb-lg sm:text-sm sm:leading-relaxed lg:mb-2xl lg:text-lg'>
              {t('heroTitleAccent')}
            </p>
            <p className='hidden text-white/60 sm:block sm:text-xs lg:text-base'>
              {t('heroDescription')}
            </p>
          </div>

          {/* Stats */}
          <div className='space-y-sm sm:space-y-lg lg:space-y-4xl'>
            <div className='flex gap-sm sm:gap-md'>
              {[
                { value: '34%', label: t('statRevenue'), Icon: TrendingUp },
                { value: '2+', label: t('statStores'), Icon: Store },
                { value: '\u221E', label: t('statGrowth'), Icon: Rocket },
              ].map(stat => (
                <div
                  key={stat.label}
                  className='flex min-w-0 flex-1 items-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-sm py-sm backdrop-blur-md sm:gap-sm sm:rounded-xl sm:px-md sm:py-md lg:gap-md lg:rounded-2xl lg:px-xl lg:py-lg'
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

            {/* Testimonial */}
            <div className='border-t border-white/15 pt-sm sm:pt-lg'>
              <p className='text-[10px] italic leading-relaxed text-white/70 sm:text-xs lg:text-sm'>
                &ldquo;{t('testimonialQuote')}&rdquo;
              </p>
              <p className='mt-xs text-[9px] font-medium text-white/50 sm:text-[10px] lg:text-xs'>
                {t('testimonialAuthor')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ================================================================
          RIGHT FORM SECTION — Multi-step
          ================================================================ */}
      <div className='flex flex-1 flex-col items-center justify-center bg-background px-xl py-2xl sm:p-4xl lg:p-4xl'>
        <div className='w-full max-w-md space-y-lg sm:space-y-2xl lg:space-y-4xl'>
          {registeredEmail ? (
            /* ── "Check Your Inbox" replaces the form ── */
            renderCheckInbox()
          ) : (
            <>
              {/* Back chevron — router.back() on step 1, previous step on steps 2/3 */}
              <button
                type='button'
                onClick={() => (step === 1 ? router.back() : handleBack())}
                className='flex items-center gap-xs text-muted-foreground transition-colors hover:text-foreground'
                aria-label='Go back'
              >
                <ChevronLeft className='h-5 w-5' />
              </button>

              {/* Step indicator */}
              {renderStepIndicator()}

              {/* Step content */}
              {renderStep()}

              <p className='text-center text-sm text-muted-foreground sm:text-base'>
                {t('hasAccount')}{' '}
                <Link href='/login' className='font-medium text-primary hover:text-primary/80'>
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

export default function MerchantSignupPage() {
  return (
    <Suspense
      fallback={
        <div className='flex h-[100dvh] items-center justify-center bg-background'>
          <Loader2 className='h-10 w-10 animate-spin text-primary' />
        </div>
      }
    >
      <MerchantSignupInner />
    </Suspense>
  );
}
