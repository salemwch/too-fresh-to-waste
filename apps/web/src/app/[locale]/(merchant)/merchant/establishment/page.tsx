'use client';

import React, { useState, useEffect, useRef, KeyboardEvent } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { establishmentService, type LegalDocumentType } from '@/services/establishment.service';
import type { MyEstablishment, DocumentMetadata } from '@/types/dashboard';
import { useAuthStore } from '@/lib/auth';
import { Input, Button } from '@foodwaste/ui';
import {
  Store,
  Phone,
  Mail,
  Globe,
  Hash,
  MapPin,
  Clock,
  Camera,
  Loader2,
  AlertCircle,
  CheckCircle2,
  X,
  Star,
  ShoppingBag,
  CheckCheck,
  Eye,
  FileText,
  Upload,
  Clock3,
  Copy,
} from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCEPTED_IMAGE_TYPES = 'image/jpeg,image/png,image/webp';
const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_TOTAL_IMAGES = 8;
const MAX_DOC_BYTES = 10 * 1024 * 1024; // 10 MB

const LEGAL_DOCS: {
  type: LegalDocumentType;
  urlKey: keyof import('@/types/dashboard').LegalDocuments;
  metaKey: keyof import('@/types/dashboard').LegalDocuments;
  labelKey: string;
}[] = [
  {
    type: 'business_license',
    urlKey: 'businessLicenseUrl',
    metaKey: 'businessLicenseMetadata',
    labelKey: 'docBusinessLicense',
  },
  {
    type: 'food_safety_license',
    urlKey: 'foodSafetyLicenseUrl',
    metaKey: 'foodSafetyLicenseMetadata',
    labelKey: 'docFoodSafetyLicense',
  },
  {
    type: 'insurance_document',
    urlKey: 'insuranceDocumentUrl',
    metaKey: 'insuranceDocumentMetadata',
    labelKey: 'docInsurance',
  },
  {
    type: 'tax_certificate',
    urlKey: 'taxCertificateUrl',
    metaKey: 'taxCertificateMetadata',
    labelKey: 'docTaxCertificate',
  },
  {
    type: 'owner_id_document',
    urlKey: 'ownerIdDocumentUrl',
    metaKey: 'ownerIdDocumentMetadata',
    labelKey: 'docOwnerId',
  },
];

const ESTABLISHMENT_TYPES = [
  { value: 'restaurant', labelKey: 'typeRestaurant' },
  { value: 'bakery', labelKey: 'typeBakery' },
  { value: 'grocery_store', labelKey: 'typeGroceryStore' },
  { value: 'cafe', labelKey: 'typeCafe' },
  { value: 'fast_food', labelKey: 'typeFastFood' },
  { value: 'supermarket', labelKey: 'typeSupermarket' },
  { value: 'hotel', labelKey: 'typeHotel' },
  { value: 'other', labelKey: 'typeOther' },
] as const;

const DAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

type Day = (typeof DAYS)[number];

interface DayHours {
  open: string;
  close: string;
  closed: boolean;
}

const DEFAULT_DAY_HOURS: DayHours = { open: '09:00', close: '18:00', closed: false };

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_LABEL_KEYS: Record<string, string> = {
  active: 'statusActive',
  pending: 'statusPending',
  suspended: 'statusSuspended',
  rejected: 'statusRejected',
  inactive: 'statusInactive',
};

const HEADER_STATUS_STYLES: Record<string, string> = {
  active: 'bg-green-500/20 border border-green-400/30 text-green-300',
  pending: 'bg-amber-500/20 border border-amber-400/30 text-amber-300',
  suspended: 'bg-red-500/20 border border-red-400/30 text-red-300',
  rejected: 'bg-red-500/20 border border-red-400/30 text-red-300',
  inactive: 'bg-white/10 border border-white/20 text-white/60',
};

function computeProfileCompletion(est: MyEstablishment): number {
  let score = 0;
  if (est.name) score += 15;
  if (est.description) score += 10;
  if (est.type) score += 10;
  if (est.phoneNumber) score += 10;
  if (est.email) score += 10;
  if (est.website) score += 5;
  if ((est.images?.length ?? 0) > 0) score += 10;
  const docCount = LEGAL_DOCS.filter(d => !!est.legalDocuments?.[d.urlKey]).length;
  score += docCount * 6;
  return Math.min(score, 100);
}

// ─── DocRow sub-component ─────────────────────────────────────────────────────

interface DocRowProps {
  label: string;
  url: string | undefined;
  meta: DocumentMetadata | undefined;
  uploading: boolean;
  onUpload: (file: File) => void;
  tPdfOnly: string;
  tSizeError: string;
  tUploadDoc: string;
  tUploadingDoc: string;
  tReplaceDoc: string;
  tAwaitingUpload: string;
}

function DocRow({
  label,
  url,
  meta,
  uploading,
  onUpload,
  tPdfOnly,
  tSizeError,
  tUploadDoc,
  tUploadingDoc,
  tReplaceDoc,
  tAwaitingUpload,
}: DocRowProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [localError, setLocalError] = useState('');

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setLocalError('');
    if (file.type !== 'application/pdf') {
      setLocalError(tPdfOnly);
      return;
    }
    if (file.size > MAX_DOC_BYTES) {
      setLocalError(tSizeError);
      return;
    }
    onUpload(file);
  }

  const isUploaded = !!url;
  const isVerified = isUploaded && !!meta?.verified;
  const uploadDate = meta?.uploadedAt
    ? new Date(meta.uploadedAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  return (
    <div className='flex flex-col'>
      <div className='flex items-center gap-3 px-5 py-2.5'>
        {/* Status icon */}
        <div
          className={`h-7 w-7 shrink-0 rounded-full flex items-center justify-center ${
            isUploaded ? (isVerified ? 'bg-green-100' : 'bg-amber-50') : 'bg-amber-50'
          }`}
        >
          {isUploaded ? (
            isVerified ? (
              <CheckCircle2 className='h-3.5 w-3.5 text-green-600' />
            ) : (
              <Clock3 className='h-3.5 w-3.5 text-amber-500' />
            )
          ) : (
            <Clock3 className='h-3.5 w-3.5 text-amber-400' />
          )}
        </div>

        {/* Label + date */}
        <div className='flex-1 min-w-0'>
          <p className='text-sm font-semibold text-slate-800'>{label}</p>
          <p className='text-xs text-slate-400 mt-0.5'>
            {isUploaded && uploadDate ? uploadDate : tAwaitingUpload}
          </p>
        </div>

        {/* Action button */}
        <div className='shrink-0'>
          <input
            ref={inputRef}
            type='file'
            accept='application/pdf'
            className='hidden'
            onChange={handleFileChange}
            aria-label={isUploaded ? tReplaceDoc : tUploadDoc}
          />
          {isUploaded ? (
            <button
              type='button'
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className='rounded-full border border-slate-200 px-4 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors'
            >
              {uploading ? tUploadingDoc : tReplaceDoc}
            </button>
          ) : (
            <button
              type='button'
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className='flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-white hover:bg-primary/90 disabled:opacity-50 transition-colors'
            >
              {uploading ? (
                <Loader2 className='h-3.5 w-3.5 animate-spin' />
              ) : (
                <Upload className='h-3.5 w-3.5' />
              )}
              {uploading ? tUploadingDoc : tUploadDoc}
            </button>
          )}
        </div>
      </div>

      {localError && <p className='px-5 pb-2 text-[10px] text-red-500'>{localError}</p>}
    </div>
  );
}

// ─── Page component ───────────────────────────────────────────────────────────

export default function MerchantEstablishmentPage() {
  const t = useTranslations('dashboard.merchantEstablishment');
  const activeEstablishmentId = useAuthStore(s => s.activeEstablishmentId);

  // ── Tab state ────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'profile' | 'hours' | 'documents'>('profile');

  // ── Remote state ────────────────────────────────────────────────────────────
  const [establishment, setEstablishment] = useState<MyEstablishment | null>(null);
  const [isLoadingPage, setIsLoadingPage] = useState(true);
  const [loadError, setLoadError] = useState('');

  // ── Form state ──────────────────────────────────────────────────────────────
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('');
  const [website, setWebsite] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [acceptsReservations, setAcceptsReservations] = useState(false);
  const [cuisineTypes, setCuisineTypes] = useState<string[]>([]);
  const [cuisineInput, setCuisineInput] = useState('');
  const [businessHours, setBusinessHours] = useState<Record<Day, DayHours>>(
    () => Object.fromEntries(DAYS.map(d => [d, { ...DEFAULT_DAY_HOURS }])) as Record<Day, DayHours>,
  );

  // ── Save state ───────────────────────────────────────────────────────────────
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // ── Photo state ──────────────────────────────────────────────────────────────
  const [failedImages, setFailedImages] = useState<Set<number>>(new Set());
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [photoSuccess, setPhotoSuccess] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // ── Legal documents state ─────────────────────────────────────────────────────
  const [docUploading, setDocUploading] = useState<Partial<Record<LegalDocumentType, boolean>>>({});
  const [docFeedback, setDocFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(
    null,
  );

  // ── Load establishment (re-fetches when dropdown selection changes) ──────────
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoadingPage(true);
      setLoadError('');
      try {
        const res = await establishmentService.getMyEstablishment();
        if (cancelled) return;
        const list = res.data.data;
        if (!Array.isArray(list) || list.length === 0) {
          setLoadError('notFound');
          return;
        }
        const est = activeEstablishmentId
          ? (list.find(e => e._id === activeEstablishmentId) ?? list[0] ?? null)
          : (list[0] ?? null);
        if (!est) {
          setLoadError('notFound');
          return;
        }
        setEstablishment(est);
        populateForm(est);
      } catch {
        if (!cancelled) setLoadError('error');
      } finally {
        if (!cancelled) setIsLoadingPage(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [activeEstablishmentId]);

  function populateForm(est: MyEstablishment) {
    setName(est.name ?? '');
    setDescription(est.description ?? '');
    setType(est.type ?? '');
    setWebsite(est.website ?? '');
    setPhoneNumber(est.phoneNumber ?? '');
    setEmail(est.email ?? '');
    setAcceptsReservations(est.acceptsReservations ?? false);
    setCuisineTypes(est.cuisineTypes ?? []);

    if (est.businessHours) {
      const merged = {
        ...Object.fromEntries(DAYS.map(d => [d, { ...DEFAULT_DAY_HOURS }])),
      } as Record<Day, DayHours>;
      for (const day of DAYS) {
        const raw = est.businessHours[day];
        if (raw)
          merged[day] = {
            open: raw.open ?? '09:00',
            close: raw.close ?? '18:00',
            closed: raw.closed ?? false,
          };
      }
      setBusinessHours(merged);
    }
  }

  // ── Save handler ──────────────────────────────────────────────────────────────
  async function doSave() {
    if (!establishment) return;

    setIsSaving(true);
    setSaveError('');
    setSaveSuccess(false);

    // NOTE: address is intentionally omitted — it was set from Google Maps at signup
    // and requires coordinates; updating it needs a dedicated geocoding flow.
    const payload = {
      name: name.trim() || undefined,
      description: description.trim() || undefined,
      type: type || undefined,
      phoneNumber: phoneNumber.trim() || undefined,
      email: email.trim() || undefined,
      website: website.trim() || undefined,
      cuisineTypes: cuisineTypes.length > 0 ? cuisineTypes : undefined,
      acceptsReservations,
      businessHours: Object.fromEntries(DAYS.map(d => [d, businessHours[d]])),
    };

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await establishmentService.updateEstablishment(establishment._id, payload as any);
      setEstablishment(res.data.data);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch {
      setSaveError(t('error'));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    await doSave();
  }

  // ── Photo upload handler ──────────────────────────────────────────────────────
  async function handlePhotosSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (!files.length || !establishment) return;

    setPhotoError('');
    setPhotoSuccess(false);

    const currentCount = establishment.images?.length ?? 0;
    if (currentCount + files.length > MAX_TOTAL_IMAGES) {
      setPhotoError(t('photosLimitError'));
      return;
    }

    for (const file of files) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        setPhotoError(t('photosTypeError'));
        return;
      }
      if (file.size > MAX_FILE_BYTES) {
        setPhotoError(t('photosSizeError'));
        return;
      }
    }

    setIsUploadingPhotos(true);
    try {
      const res = await establishmentService.uploadImages(establishment._id, files);
      setEstablishment(res.data.data);
      setPhotoSuccess(true);
      setTimeout(() => setPhotoSuccess(false), 4000);
    } catch {
      setPhotoError(t('photosError'));
    } finally {
      setIsUploadingPhotos(false);
    }
  }

  // ── Legal document handlers ───────────────────────────────────────────────────
  async function handleDocUpload(docType: LegalDocumentType, file: File) {
    if (!establishment) return;
    setDocUploading(p => ({ ...p, [docType]: true }));
    setDocFeedback(null);
    try {
      const res = await establishmentService.uploadDocument(establishment._id, docType, file);
      setEstablishment(res.data.data);
      setDocFeedback({ type: 'success', msg: t('docUploadSuccess') });
      setTimeout(() => setDocFeedback(null), 4000);
    } catch {
      setDocFeedback({ type: 'error', msg: t('docUploadError') });
    } finally {
      setDocUploading(p => ({ ...p, [docType]: false }));
    }
  }

  // ── Cuisine tag helpers ────────────────────────────────────────────────────────
  function addCuisineTag() {
    const tag = cuisineInput.trim();
    if (tag && !cuisineTypes.includes(tag)) {
      setCuisineTypes([...cuisineTypes, tag]);
    }
    setCuisineInput('');
  }

  function handleCuisineKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addCuisineTag();
    }
  }

  function removeCuisineTag(tag: string) {
    setCuisineTypes(cuisineTypes.filter(t => t !== tag));
  }

  // ── Business hours helpers ─────────────────────────────────────────────────────
  function updateHour(day: Day, field: keyof DayHours, value: string | boolean) {
    setBusinessHours(prev => ({
      ...prev,
      [day]: { ...prev[day], [field]: value },
    }));
  }

  function applyToAll(fromDay: Day) {
    const source = businessHours[fromDay];
    setBusinessHours(
      Object.fromEntries(DAYS.map(d => [d, { ...source }])) as Record<Day, DayHours>,
    );
  }

  // ── Loading / error states ────────────────────────────────────────────────────
  if (isLoadingPage) {
    return (
      <div className='space-y-4 animate-pulse'>
        {/* Header row */}
        <div className='flex items-start justify-between gap-3'>
          <div className='space-y-1.5'>
            <div className='h-4 w-48 rounded bg-slate-200' />
            <div className='h-3 w-64 rounded bg-slate-100' />
          </div>
          <div className='flex items-center gap-2 shrink-0'>
            <div className='h-5 w-16 rounded-full bg-slate-200' />
            <div className='h-5 w-20 rounded-full bg-slate-200' />
          </div>
        </div>

        {/* Stats row */}
        <div className='flex flex-wrap items-center gap-4 rounded-xl border bg-white px-4 py-3 shadow-sm'>
          <div className='h-3 w-24 rounded bg-slate-200' />
          <div className='h-3 w-20 rounded bg-slate-200' />
          <div className='h-3 w-28 rounded bg-slate-200' />
        </div>

        {/* Tab nav */}
        <div className='flex gap-1 rounded-xl bg-slate-100 p-1'>
          {[0, 1, 2].map(i => (
            <div key={i} className='flex-1 h-8 rounded-lg bg-slate-200' />
          ))}
        </div>

        {/* Photos section */}
        <div className='rounded-xl border bg-white p-3 sm:p-4 shadow-sm space-y-3'>
          <div className='flex items-center justify-between'>
            <div className='space-y-1'>
              <div className='h-3 w-20 rounded bg-slate-200' />
              <div className='h-2.5 w-52 rounded bg-slate-100' />
            </div>
            <div className='h-7 w-24 rounded-lg bg-slate-200' />
          </div>
          <div className='grid grid-cols-4 sm:grid-cols-5 gap-2'>
            {[0, 1, 2, 3, 4].map(i => (
              <div key={i} className='aspect-square rounded-lg bg-slate-200' />
            ))}
          </div>
        </div>

        {/* 2-col grid */}
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
          {/* Basic Info */}
          <div className='rounded-xl border bg-white p-3 sm:p-4 shadow-sm space-y-3'>
            <div className='h-3 w-24 rounded bg-slate-200' />
            {[60, 72, 48, 96].map((w, i) => (
              <div key={i} className='space-y-1.5'>
                <div className='h-2.5 rounded bg-slate-100' style={{ width: `${w}px` }} />
                <div className='h-8 rounded-md bg-slate-200' />
              </div>
            ))}
          </div>

          {/* Right column: Contact + Address + Options */}
          <div className='space-y-4'>
            <div className='rounded-xl border bg-white p-3 sm:p-4 shadow-sm space-y-3'>
              <div className='h-3 w-20 rounded bg-slate-200' />
              {[56, 48].map((w, i) => (
                <div key={i} className='space-y-1.5'>
                  <div className='h-2.5 rounded bg-slate-100' style={{ width: `${w}px` }} />
                  <div className='h-8 rounded-md bg-slate-200' />
                </div>
              ))}
            </div>
            <div className='rounded-xl border bg-white p-3 sm:p-4 shadow-sm space-y-2'>
              <div className='h-3 w-20 rounded bg-slate-200' />
              <div className='rounded-lg bg-slate-50 px-3 py-2 space-y-1.5'>
                <div className='h-2.5 w-40 rounded bg-slate-200' />
                <div className='h-2.5 w-32 rounded bg-slate-200' />
                <div className='h-2.5 w-24 rounded bg-slate-200' />
              </div>
            </div>
            <div className='rounded-xl border bg-white p-3 sm:p-4 shadow-sm space-y-3'>
              <div className='h-3 w-20 rounded bg-slate-200' />
              <div className='space-y-1.5'>
                <div className='h-2.5 w-24 rounded bg-slate-100' />
                <div className='h-8 rounded-md bg-slate-200' />
              </div>
            </div>
          </div>
        </div>

        {/* Save bar */}
        <div className='flex justify-end pt-2 border-t border-slate-100'>
          <div className='h-7 w-24 rounded-lg bg-slate-200' />
        </div>
      </div>
    );
  }

  if (loadError || !establishment) {
    return (
      <div className='flex h-64 flex-col items-center justify-center gap-2 text-center'>
        <AlertCircle className='h-8 w-8 text-red-400' />
        <p className='font-medium text-slate-700'>{t('notFound')}</p>
        <p className='text-sm text-slate-500'>{t('notFoundDescription')}</p>
      </div>
    );
  }

  const statusKey = STATUS_LABEL_KEYS[establishment.status ?? ''] ?? 'statusInactive';
  const headerStatusStyle =
    HEADER_STATUS_STYLES[establishment.status ?? ''] ?? HEADER_STATUS_STYLES['inactive'];
  const images = establishment.images ?? [];
  const profileCompletion = computeProfileCompletion(establishment);
  const pendingDocs = LEGAL_DOCS.filter(d => !establishment.legalDocuments?.[d.urlKey]).length;

  // ── Save button (shared between Profile and Hours tabs) ───────────────────
  const SaveBar = () => (
    <div className='flex items-center justify-between pt-2 border-t border-slate-100 mt-4'>
      <div className='flex-1'>
        {saveError && (
          <div className='flex items-center gap-1.5 text-xs text-red-600'>
            <AlertCircle className='h-3.5 w-3.5 shrink-0' />
            {saveError}
          </div>
        )}
        {saveSuccess && (
          <div className='flex items-center gap-1.5 text-xs text-green-600'>
            <CheckCircle2 className='h-3.5 w-3.5 shrink-0' />
            {t('success')}
          </div>
        )}
      </div>
      <Button type='submit' size='sm' className='h-7 text-xs px-3' disabled={isSaving}>
        {isSaving ? (
          <>
            <Loader2 className='mr-1 h-3 w-3 animate-spin' />
            {t('saving')}
          </>
        ) : (
          t('saveChanges')
        )}
      </Button>
    </div>
  );

  return (
    <div className='space-y-4'>
      {/* ── Header Card ──────────────────────────────────────────────────── */}
      <div className='relative rounded-2xl bg-primary overflow-hidden'>
        <div className='absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none' />
        <div className='relative p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4'>
          {/* Left: avatar + info */}
          <div className='flex items-center gap-4'>
            <div className='h-14 w-14 rounded-2xl bg-accent flex items-center justify-center shrink-0'>
              <span className='text-xl font-bold text-white'>
                {establishment.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className='space-y-1.5 min-w-0'>
              <div className='flex flex-wrap items-center gap-1.5'>
                <span
                  className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${headerStatusStyle}`}
                >
                  {establishment.status === 'active' && (
                    <span className='h-1.5 w-1.5 rounded-full bg-green-400' />
                  )}
                  {t(statusKey)}
                </span>
                {establishment.isVerified && (
                  <span className='flex items-center gap-1 rounded-full bg-accent/20 border border-accent/30 px-2.5 py-0.5 text-xs font-medium text-white/90'>
                    <CheckCheck className='h-3 w-3' />
                    {t('verified')}
                  </span>
                )}
              </div>
              <h1 className='text-xl sm:text-2xl font-display font-bold text-white leading-tight truncate'>
                {establishment.name}
              </h1>
              <p className='text-xs text-white/60'>{t('description')}</p>
            </div>
          </div>
          {/* Right: action buttons */}
          <div className='flex items-center gap-2 shrink-0'>
            <button
              type='button'
              className='flex items-center gap-1.5 rounded-full bg-white/10 hover:bg-white/20 px-3 py-1.5 text-xs font-medium text-white transition-colors'
            >
              <Eye className='h-3.5 w-3.5' />
              Preview
            </button>
            <button
              type='button'
              onClick={doSave}
              disabled={isSaving || activeTab === 'documents'}
              className='flex items-center gap-1.5 rounded-full bg-accent hover:bg-accent/90 disabled:opacity-50 px-3 py-1.5 text-xs font-medium text-white transition-colors'
            >
              {isSaving ? (
                <Loader2 className='h-3.5 w-3.5 animate-spin' />
              ) : (
                <CheckCircle2 className='h-3.5 w-3.5' />
              )}
              {isSaving ? t('saving') : t('saveChanges')}
            </button>
          </div>
        </div>
      </div>

      {/* ── Stat Cards ───────────────────────────────────────────────────── */}
      <div className='grid grid-cols-2 lg:grid-cols-4 gap-3'>
        {/* Rating */}
        <div className='rounded-xl border bg-white p-4 shadow-sm'>
          <div className='flex items-start justify-between mb-2'>
            <p className='text-[10px] font-semibold uppercase tracking-wider text-slate-400'>
              Rating
            </p>
            <div className='flex h-7 w-7 items-center justify-center rounded-lg bg-accent/10 shrink-0'>
              <Star className='h-3.5 w-3.5 text-accent' />
            </div>
          </div>
          <p className='text-2xl font-bold text-slate-800 leading-tight'>
            {(establishment.averageRating ?? 0).toFixed(1)}
          </p>
          <p className='text-xs text-primary mt-1'>
            {(establishment.totalReviews ?? 0) > 0
              ? `${establishment.totalReviews} ${t('reviews', { count: establishment.totalReviews ?? 0 })}`
              : 'No reviews yet'}
          </p>
        </div>

        {/* Orders */}
        <div className='rounded-xl border bg-white p-4 shadow-sm'>
          <div className='flex items-start justify-between mb-2'>
            <p className='text-[10px] font-semibold uppercase tracking-wider text-slate-400'>
              Orders
            </p>
            <div className='flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 shrink-0'>
              <ShoppingBag className='h-3.5 w-3.5 text-slate-500' />
            </div>
          </div>
          <p className='text-2xl font-bold text-slate-800 leading-tight'>
            {establishment.completedOrders ?? 0}
          </p>
          <p className='text-xs text-primary mt-1'>Last 30 days</p>
        </div>

        {/* Location */}
        <div className='rounded-xl border bg-white p-4 shadow-sm'>
          <div className='flex items-start justify-between mb-2'>
            <p className='text-[10px] font-semibold uppercase tracking-wider text-slate-400'>
              Location
            </p>
            <div className='flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 shrink-0'>
              <MapPin className='h-3.5 w-3.5 text-blue-500' />
            </div>
          </div>
          <p className='text-xl font-bold text-slate-800 leading-tight truncate'>
            {establishment.address?.city ?? '—'}
          </p>
          <p className='text-xs text-primary mt-1 truncate'>
            {establishment.address?.street ?? ''}
          </p>
        </div>

        {/* Profile Completion */}
        <div className='rounded-xl border bg-white p-4 shadow-sm'>
          <div className='flex items-start justify-between mb-2'>
            <p className='text-[10px] font-semibold uppercase tracking-wider text-slate-400 leading-tight'>
              Profile
              <br />
              Completion
            </p>
            <div className='flex h-7 w-7 items-center justify-center rounded-lg bg-green-50 shrink-0'>
              <CheckCircle2 className='h-3.5 w-3.5 text-green-600' />
            </div>
          </div>
          <p className='text-2xl font-bold text-slate-800 leading-tight'>{profileCompletion}%</p>
          <p className='text-xs text-primary mt-1'>
            {pendingDocs > 0 ? t('documentsPending', { count: pendingDocs }) : t('profileComplete')}
          </p>
        </div>
      </div>

      {/* ── Rejection reason (full-width alert) ──────────────────────────── */}
      {establishment.rejectionReason && (
        <div className='flex items-start gap-1.5 rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-xs text-red-700'>
          <AlertCircle className='mt-0.5 h-3.5 w-3.5 shrink-0' />
          <span>
            <strong>{t('rejectionReason')}:</strong> {establishment.rejectionReason}
          </span>
        </div>
      )}

      {/* ── Tab navigation ────────────────────────────────────────────────── */}
      <div className='inline-flex gap-1 rounded-full border border-slate-200 bg-white p-1'>
        {(
          [
            { id: 'profile', label: 'Profile' },
            { id: 'hours', label: 'Hours' },
            { id: 'documents', label: 'Documents' },
          ] as const
        ).map(({ id, label }) => (
          <button
            key={id}
            type='button'
            onClick={() => setActiveTab(id)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
              activeTab === id
                ? 'bg-primary text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* TAB: PROFILE                                                      */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'profile' && (
        <form onSubmit={handleSave} className='space-y-4'>
          {/* Photos */}
          <section className='rounded-xl border bg-white p-3 sm:p-4 shadow-sm'>
            <div className='flex items-center justify-between mb-3'>
              <div>
                <h2 className='text-xs font-medium text-slate-700 flex items-center gap-1.5'>
                  <Camera className='h-3.5 w-3.5 text-primary-500' />
                  {t('photos')}
                  <span className='text-slate-400'>
                    ({images.length}/{MAX_TOTAL_IMAGES})
                  </span>
                </h2>
                <p className='mt-0.5 text-[10px] text-slate-400'>{t('photosHint')}</p>
              </div>
              <input
                ref={photoInputRef}
                type='file'
                accept={ACCEPTED_IMAGE_TYPES}
                multiple
                className='hidden'
                onChange={handlePhotosSelect}
              />
              <Button
                type='button'
                variant='outline'
                size='sm'
                className='h-7 text-xs px-2.5'
                disabled={isUploadingPhotos || images.length >= MAX_TOTAL_IMAGES}
                onClick={() => photoInputRef.current?.click()}
              >
                {isUploadingPhotos ? (
                  <>
                    <Loader2 className='mr-1 h-3 w-3 animate-spin' />
                    {t('uploading')}
                  </>
                ) : (
                  <>
                    <Camera className='mr-1 h-3 w-3' />
                    {t('uploadPhotos')}
                  </>
                )}
              </Button>
            </div>
            {photoError && (
              <div className='mb-3 flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600'>
                <AlertCircle className='h-3.5 w-3.5 shrink-0' />
                {photoError}
              </div>
            )}
            {photoSuccess && (
              <div className='mb-3 flex items-center gap-1.5 rounded-lg bg-green-50 px-3 py-2 text-xs text-green-600'>
                <CheckCircle2 className='h-3.5 w-3.5 shrink-0' />
                {t('photosSuccess')}
              </div>
            )}
            {images.length > 0 ? (
              <div className='grid grid-cols-4 sm:grid-cols-5 gap-2'>
                {images.map((url, idx) => (
                  <div
                    key={idx}
                    className='relative aspect-square rounded-lg overflow-hidden border bg-slate-50'
                  >
                    {failedImages.has(idx) ? (
                      <div className='w-full h-full flex items-center justify-center bg-primary/10'>
                        <span className='text-lg font-bold text-primary'>
                          {establishment.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    ) : (
                      <Image
                        src={url}
                        alt=''
                        fill
                        sizes='20vw'
                        className='object-cover'
                        onError={() => setFailedImages(prev => new Set(prev).add(idx))}
                      />
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className='flex h-20 items-center justify-center rounded-lg border-2 border-dashed border-slate-200 text-slate-400 text-xs gap-2'>
                <Camera className='h-4 w-4' />
                {t('uploadPhotos')}
              </div>
            )}
          </section>

          {/* Basic Info + Contact & Location side by side */}
          <div className='grid grid-cols-1 lg:grid-cols-2 gap-4'>
            {/* ── Basic Information ─────────────────────────────────────── */}
            <section className='rounded-2xl border bg-white p-4 sm:p-5 shadow-sm space-y-4'>
              <div className='flex items-center gap-3'>
                <div className='h-11 w-11 rounded-2xl bg-slate-100 flex items-center justify-center shrink-0'>
                  <Store className='h-5 w-5 text-primary' />
                </div>
                <div>
                  <h2 className='text-sm font-semibold text-slate-800'>Basic information</h2>
                  <p className='text-xs text-slate-400'>How your venue appears to customers</p>
                </div>
              </div>

              <div className='space-y-1.5'>
                <label
                  htmlFor='est-name'
                  className='block text-[10px] font-semibold uppercase tracking-wider text-slate-500'
                >
                  Establishment Name
                </label>
                <Input
                  id='est-name'
                  value={name}
                  onChange={e => setName(e.target.value)}
                  minLength={2}
                  maxLength={100}
                  required
                  className='h-7 rounded-lg text-xs'
                />
              </div>

              <div className='grid grid-cols-2 gap-3'>
                <div className='space-y-1.5'>
                  <label
                    htmlFor='est-type'
                    className='block text-[10px] font-semibold uppercase tracking-wider text-slate-500'
                  >
                    Type
                  </label>
                  <select
                    id='est-type'
                    value={type}
                    onChange={e => setType(e.target.value)}
                    className='w-full h-7 rounded-lg border border-slate-200 px-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white'
                  >
                    <option value='' disabled />
                    {ESTABLISHMENT_TYPES.map(({ value, labelKey }) => (
                      <option key={value} value={value}>
                        {t(labelKey)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className='space-y-1.5'>
                  <label
                    htmlFor='est-cuisine'
                    className='block text-[10px] font-semibold uppercase tracking-wider text-slate-500'
                  >
                    Cuisine / Category
                  </label>
                  <div className='flex flex-wrap items-center gap-1 min-h-[28px] rounded-lg border border-slate-200 px-2.5 py-1 focus-within:ring-2 focus-within:ring-primary/30 bg-white cursor-text'>
                    {cuisineTypes.map(tag => (
                      <span
                        key={tag}
                        className='flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary'
                      >
                        {tag}
                        <button
                          type='button'
                          onClick={() => removeCuisineTag(tag)}
                          className='text-primary/50 hover:text-primary'
                          aria-label={`Remove ${tag}`}
                        >
                          <X className='h-3 w-3' />
                        </button>
                      </span>
                    ))}
                    <input
                      id='est-cuisine'
                      value={cuisineInput}
                      onChange={e => setCuisineInput(e.target.value)}
                      onKeyDown={handleCuisineKeyDown}
                      onBlur={addCuisineTag}
                      placeholder={cuisineTypes.length === 0 ? 'e.g. Italian' : ''}
                      className='flex-1 min-w-[60px] text-sm bg-transparent outline-none placeholder:text-slate-400'
                    />
                  </div>
                </div>
              </div>

              <div className='space-y-1.5'>
                <label
                  htmlFor='est-description'
                  className='block text-[10px] font-semibold uppercase tracking-wider text-slate-500'
                >
                  Description
                </label>
                <textarea
                  id='est-description'
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  minLength={10}
                  maxLength={280}
                  rows={4}
                  className='w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none'
                />
                <p className='text-[10px] text-slate-400'>Up to 280 characters</p>
              </div>
            </section>

            {/* ── Contact & Location ────────────────────────────────────── */}
            <section className='rounded-2xl border bg-white p-4 sm:p-5 shadow-sm space-y-4'>
              <div className='flex items-center gap-3'>
                <div className='h-11 w-11 rounded-2xl bg-accent/10 flex items-center justify-center shrink-0'>
                  <Phone className='h-5 w-5 text-accent' />
                </div>
                <div>
                  <h2 className='text-sm font-semibold text-slate-800'>Contact &amp; location</h2>
                  <p className='text-xs text-slate-400'>How customers reach you</p>
                </div>
              </div>

              <div className='grid grid-cols-2 gap-3'>
                <div className='space-y-1.5'>
                  <label
                    htmlFor='est-phone'
                    className='block text-[10px] font-semibold uppercase tracking-wider text-slate-500'
                  >
                    Phone
                  </label>
                  <div className='relative'>
                    <Phone className='absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400' />
                    <Input
                      id='est-phone'
                      type='tel'
                      value={phoneNumber}
                      onChange={e => setPhoneNumber(e.target.value)}
                      placeholder='+216 XX XXX XXX'
                      className='h-7 rounded-lg pl-8 text-xs'
                    />
                  </div>
                </div>
                <div className='space-y-1.5'>
                  <label
                    htmlFor='est-website'
                    className='block text-[10px] font-semibold uppercase tracking-wider text-slate-500'
                  >
                    Website
                  </label>
                  <div className='relative'>
                    <Globe className='absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400' />
                    <Input
                      id='est-website'
                      type='url'
                      value={website}
                      onChange={e => setWebsite(e.target.value)}
                      placeholder={t('websitePlaceholder')}
                      className='h-7 rounded-lg pl-8 text-xs'
                    />
                  </div>
                </div>
              </div>

              <div className='space-y-1.5'>
                <label
                  htmlFor='est-email'
                  className='block text-[10px] font-semibold uppercase tracking-wider text-slate-500'
                >
                  Email
                </label>
                <div className='relative'>
                  <Mail className='absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400' />
                  <Input
                    id='est-email'
                    type='email'
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className='h-7 rounded-lg pl-8 text-xs'
                  />
                </div>
              </div>

              {establishment.address && (
                <>
                  <div className='space-y-1.5'>
                    {/* Caption, not a label — the value below is read-only text,
                        not a form control, so <label> would announce a control
                        that does not exist. */}
                    <span className='block text-[10px] font-semibold uppercase tracking-wider text-slate-500'>
                      Address
                    </span>
                    <div className='relative'>
                      <MapPin className='absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400' />
                      <div className='h-7 rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-3 flex items-center text-xs text-slate-600 truncate'>
                        {establishment.address.street ?? '—'}
                      </div>
                    </div>
                  </div>
                  <div className='grid grid-cols-2 gap-3'>
                    <div className='space-y-1.5'>
                      <span className='block text-[10px] font-semibold uppercase tracking-wider text-slate-500'>
                        City
                      </span>
                      <div className='relative'>
                        <MapPin className='absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400' />
                        <div className='h-7 rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-3 flex items-center text-xs text-slate-600'>
                          {establishment.address.city ?? '—'}
                        </div>
                      </div>
                    </div>
                    <div className='space-y-1.5'>
                      <span className='block text-[10px] font-semibold uppercase tracking-wider text-slate-500'>
                        Postal Code
                      </span>
                      <div className='relative'>
                        <Hash className='absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400' />
                        <div className='h-7 rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-3 flex items-center text-xs text-slate-600'>
                          {establishment.address.postalCode ?? '—'}
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </section>
          </div>

          <SaveBar />
        </form>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* TAB: HOURS                                                        */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'hours' && (
        <form onSubmit={handleSave}>
          <section className='rounded-2xl border bg-white shadow-sm overflow-hidden'>
            {/* Header */}
            <div className='flex items-center gap-3 p-4 sm:p-5 border-b border-slate-100'>
              <div className='h-11 w-11 rounded-2xl bg-slate-100 flex items-center justify-center shrink-0'>
                <Clock className='h-5 w-5 text-primary' />
              </div>
              <div>
                <h2 className='text-sm font-semibold text-slate-800'>{t('openingHours')}</h2>
                <p className='text-xs text-slate-400 mt-0.5'>{t('openingHoursHint')}</p>
              </div>
            </div>

            {/* Day rows */}
            <div className='divide-y divide-slate-100'>
              {DAYS.map(day => {
                const hours = businessHours[day];
                const isOpen = !hours.closed;
                return (
                  <div key={day} className='flex items-center gap-4 px-4 sm:px-6 py-3.5'>
                    {/* Toggle switch */}
                    <button
                      type='button'
                      role='switch'
                      aria-checked={isOpen}
                      aria-label={t(day)}
                      onClick={() => updateHour(day, 'closed', isOpen)}
                      style={{
                        width: '44px',
                        height: '24px',
                        minWidth: '44px',
                        minHeight: '24px',
                        padding: '2px',
                        flexShrink: 0,
                      }}
                      className={`inline-flex cursor-pointer items-center rounded-full overflow-hidden transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${isOpen ? 'bg-primary' : 'bg-slate-200'}`}
                    >
                      <span
                        style={{ width: '20px', height: '20px', minWidth: '20px', flexShrink: 0 }}
                        className={`pointer-events-none rounded-full bg-white shadow-md transition-transform duration-200 ${isOpen ? 'translate-x-[20px]' : 'translate-x-0'}`}
                      />
                    </button>

                    {/* Day name */}
                    <span className='w-24 shrink-0 text-sm font-semibold text-slate-800'>
                      {t(day)}
                    </span>

                    {/* Time controls — always visible, disabled when closed */}
                    <span className='text-[10px] font-semibold uppercase tracking-wider text-slate-400 shrink-0'>
                      {t('open')}
                    </span>
                    <div
                      className={`flex items-center gap-3 transition-opacity ${isOpen ? 'opacity-100' : 'opacity-40'}`}
                    >
                      <label
                        htmlFor={`${day}-open`}
                        className={`flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 ${isOpen ? 'cursor-text' : 'cursor-not-allowed'}`}
                      >
                        <input
                          id={`${day}-open`}
                          type='time'
                          value={hours.open}
                          disabled={!isOpen}
                          onChange={e => updateHour(day, 'open', e.target.value)}
                          className='w-[68px] bg-transparent text-sm font-medium text-slate-700 outline-none disabled:cursor-not-allowed'
                        />
                        <Clock className='h-3.5 w-3.5 shrink-0 text-slate-400' />
                      </label>
                      <span className='text-slate-400 font-medium select-none'>—</span>
                      <label
                        htmlFor={`${day}-close`}
                        className={`flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 ${isOpen ? 'cursor-text' : 'cursor-not-allowed'}`}
                      >
                        <input
                          id={`${day}-close`}
                          type='time'
                          value={hours.close}
                          disabled={!isOpen}
                          onChange={e => updateHour(day, 'close', e.target.value)}
                          className='w-[68px] bg-transparent text-sm font-medium text-slate-700 outline-none disabled:cursor-not-allowed'
                        />
                        <Clock className='h-3.5 w-3.5 shrink-0 text-slate-400' />
                      </label>
                    </div>

                    {/* Apply to all */}
                    <button
                      type='button'
                      onClick={() => applyToAll(day)}
                      className='ms-auto shrink-0 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-slate-500 transition-colors hover:bg-primary/5 hover:text-primary'
                    >
                      <Copy className='h-3.5 w-3.5' />
                      {t('applyToAll')}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
          <SaveBar />
        </form>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* TAB: DOCUMENTS                                                    */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'documents' && (
        <section className='rounded-2xl border bg-white shadow-sm overflow-hidden'>
          {/* Header */}
          <div className='flex items-center gap-3 p-4 sm:p-5 border-b border-slate-100'>
            <div className='h-11 w-11 rounded-full bg-slate-100 flex items-center justify-center shrink-0'>
              <FileText className='h-5 w-5 text-primary' />
            </div>
            <div>
              <h2 className='text-sm font-semibold text-slate-800'>Documents</h2>
              <p className='text-xs text-slate-400 mt-0.5'>
                Upload required documents to keep your account verified
              </p>
            </div>
          </div>

          {/* Feedback banner */}
          {docFeedback && (
            <div
              className={`flex items-center gap-1.5 mx-5 mt-4 rounded-xl px-3 py-2 text-xs ${
                docFeedback.type === 'success'
                  ? 'bg-green-50 text-green-600'
                  : 'bg-red-50 text-red-600'
              }`}
            >
              {docFeedback.type === 'success' ? (
                <CheckCircle2 className='h-3.5 w-3.5 shrink-0' />
              ) : (
                <AlertCircle className='h-3.5 w-3.5 shrink-0' />
              )}
              {docFeedback.msg}
            </div>
          )}

          {/* Document rows */}
          <div className='divide-y divide-slate-100'>
            {LEGAL_DOCS.map(({ type, urlKey, metaKey, labelKey }) => (
              <DocRow
                key={type}
                label={t(labelKey)}
                url={establishment.legalDocuments?.[urlKey] as string | undefined}
                meta={
                  establishment.legalDocuments?.[metaKey] as
                    | import('@/types/dashboard').DocumentMetadata
                    | undefined
                }
                uploading={!!docUploading[type]}
                onUpload={file => handleDocUpload(type, file)}
                tPdfOnly={t('docPdfOnly')}
                tSizeError={t('docSizeError')}
                tUploadDoc={t('uploadDoc')}
                tUploadingDoc={t('uploadingDoc')}
                tReplaceDoc={t('replaceDoc')}
                tAwaitingUpload={t('awaitingUpload')}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
