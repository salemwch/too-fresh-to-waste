'use client';

import React, { useState, useEffect, useRef, KeyboardEvent } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { establishmentService, type LegalDocumentType } from '@/services/establishment.service';
import type { MyEstablishment, DocumentMetadata } from '@/types/dashboard';
import { Input, Button, Label } from '@foodwaste/ui';
import {
  Store,
  Phone,
  Mail,
  Globe,
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
  FileText,
  Upload,
  Trash2,
  ShieldCheck,
  Clock3,
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

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  pending: 'bg-amber-100 text-amber-700',
  suspended: 'bg-red-100 text-red-700',
  rejected: 'bg-red-100 text-red-700',
  inactive: 'bg-slate-100 text-slate-600',
};

const STATUS_LABEL_KEYS: Record<string, string> = {
  active: 'statusActive',
  pending: 'statusPending',
  suspended: 'statusSuspended',
  rejected: 'statusRejected',
  inactive: 'statusInactive',
};

// ─── DocRow sub-component ─────────────────────────────────────────────────────

interface DocRowProps {
  label: string;
  url: string | undefined;
  meta: DocumentMetadata | undefined;
  uploading: boolean;
  deleting: boolean;
  onUpload: (file: File) => void;
  onDelete: () => void;
  tPdfOnly: string;
  tSizeError: string;
  tUploadDoc: string;
  tUploadingDoc: string;
  tDeleteDoc: string;
  tDeletingDoc: string;
  tVerified: string;
  tPending: string;
  tUploaded: string;
  tExpiry: (date: string) => string;
}

function DocRow({
  label,
  url,
  meta,
  uploading,
  deleting,
  onUpload,
  onDelete,
  tPdfOnly,
  tSizeError,
  tUploadDoc,
  tUploadingDoc,
  tDeleteDoc,
  tDeletingDoc,
  tVerified,
  tPending,
  tUploaded,
  tExpiry,
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

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          <span className="text-xs font-medium text-slate-700 truncate">{label}</span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Status badge */}
          {url && meta && (
            <span
              className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                meta.verified ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
              }`}
            >
              {meta.verified ? (
                <>
                  <ShieldCheck className="h-3 w-3" />
                  {tVerified}
                </>
              ) : (
                <>
                  <Clock3 className="h-3 w-3" />
                  {tPending}
                </>
              )}
            </span>
          )}
          {url && !meta && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">
              {tUploaded}
            </span>
          )}

          {/* Actions */}
          {url ? (
            <button
              type="button"
              onClick={onDelete}
              disabled={deleting}
              className="flex items-center gap-1 rounded px-1.5 py-1 text-[10px] text-red-500 hover:bg-red-50 disabled:opacity-50 transition-colors"
            >
              {deleting ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Trash2 className="h-3 w-3" />
              )}
              {deleting ? tDeletingDoc : tDeleteDoc}
            </button>
          ) : (
            <>
              <input
                ref={inputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={handleFileChange}
              />
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-1 rounded px-1.5 py-1 text-[10px] text-primary-600 hover:bg-primary-50 disabled:opacity-50 transition-colors"
              >
                {uploading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Upload className="h-3 w-3" />
                )}
                {uploading ? tUploadingDoc : tUploadDoc}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Expiry + local validation error */}
      {url && meta?.expiryDate && (
        <p className="px-3 text-[10px] text-slate-400">
          {tExpiry(new Date(meta.expiryDate).toLocaleDateString())}
        </p>
      )}
      {localError && <p className="px-3 text-[10px] text-red-500">{localError}</p>}
    </div>
  );
}

// ─── Page component ───────────────────────────────────────────────────────────

export default function MerchantEstablishmentPage() {
  const t = useTranslations('dashboard.merchantEstablishment');

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
    () =>
      Object.fromEntries(DAYS.map((d) => [d, { ...DEFAULT_DAY_HOURS }])) as Record<Day, DayHours>,
  );

  // ── Save state ───────────────────────────────────────────────────────────────
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // ── Photo state ──────────────────────────────────────────────────────────────
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [photoSuccess, setPhotoSuccess] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // ── Legal documents state ─────────────────────────────────────────────────────
  const [docUploading, setDocUploading] = useState<Partial<Record<LegalDocumentType, boolean>>>({});
  const [docDeleting, setDocDeleting] = useState<Partial<Record<LegalDocumentType, boolean>>>({});
  const [docFeedback, setDocFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(
    null,
  );

  // ── Load establishment ────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoadingPage(true);
      setLoadError('');
      try {
        const res = await establishmentService.getMyEstablishment();
        if (cancelled) return;
        const list = res.data.data;
        const est = Array.isArray(list) ? (list[0] ?? null) : null;
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
  }, []);

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
        ...Object.fromEntries(DAYS.map((d) => [d, { ...DEFAULT_DAY_HOURS }])),
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
  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
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
      businessHours: Object.fromEntries(DAYS.map((d) => [d, businessHours[d]])),
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
    setDocUploading((p) => ({ ...p, [docType]: true }));
    setDocFeedback(null);
    try {
      const res = await establishmentService.uploadDocument(establishment._id, docType, file);
      setEstablishment(res.data.data);
      setDocFeedback({ type: 'success', msg: t('docUploadSuccess') });
      setTimeout(() => setDocFeedback(null), 4000);
    } catch {
      setDocFeedback({ type: 'error', msg: t('docUploadError') });
    } finally {
      setDocUploading((p) => ({ ...p, [docType]: false }));
    }
  }

  async function handleDocDelete(docType: LegalDocumentType) {
    if (!establishment) return;
    setDocDeleting((p) => ({ ...p, [docType]: true }));
    setDocFeedback(null);
    try {
      const res = await establishmentService.deleteDocument(establishment._id, docType);
      setEstablishment(res.data.data);
      setDocFeedback({ type: 'success', msg: t('docDeleteSuccess') });
      setTimeout(() => setDocFeedback(null), 4000);
    } catch {
      setDocFeedback({ type: 'error', msg: t('docDeleteError') });
    } finally {
      setDocDeleting((p) => ({ ...p, [docType]: false }));
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
    setCuisineTypes(cuisineTypes.filter((t) => t !== tag));
  }

  // ── Business hours helpers ─────────────────────────────────────────────────────
  function updateHour(day: Day, field: keyof DayHours, value: string | boolean) {
    setBusinessHours((prev) => ({
      ...prev,
      [day]: { ...prev[day], [field]: value },
    }));
  }

  // ── Loading / error states ────────────────────────────────────────────────────
  if (isLoadingPage) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-4 lg:px-0 space-y-4 animate-pulse">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1.5">
            <div className="h-4 w-48 rounded bg-slate-200" />
            <div className="h-3 w-64 rounded bg-slate-100" />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="h-5 w-16 rounded-full bg-slate-200" />
            <div className="h-5 w-20 rounded-full bg-slate-200" />
          </div>
        </div>

        {/* Stats row */}
        <div className="flex flex-wrap items-center gap-4 rounded-xl border bg-white px-4 py-3 shadow-sm">
          <div className="h-3 w-24 rounded bg-slate-200" />
          <div className="h-3 w-20 rounded bg-slate-200" />
          <div className="h-3 w-28 rounded bg-slate-200" />
        </div>

        {/* Tab nav */}
        <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex-1 h-8 rounded-lg bg-slate-200" />
          ))}
        </div>

        {/* Photos section */}
        <div className="rounded-xl border bg-white p-3 sm:p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="h-3 w-20 rounded bg-slate-200" />
              <div className="h-2.5 w-52 rounded bg-slate-100" />
            </div>
            <div className="h-7 w-24 rounded-lg bg-slate-200" />
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="aspect-square rounded-lg bg-slate-200" />
            ))}
          </div>
        </div>

        {/* 2-col grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Basic Info */}
          <div className="rounded-xl border bg-white p-3 sm:p-4 shadow-sm space-y-3">
            <div className="h-3 w-24 rounded bg-slate-200" />
            {[60, 72, 48, 96].map((w, i) => (
              <div key={i} className="space-y-1.5">
                <div className="h-2.5 rounded bg-slate-100" style={{ width: `${w}px` }} />
                <div className="h-8 rounded-md bg-slate-200" />
              </div>
            ))}
          </div>

          {/* Right column: Contact + Address + Options */}
          <div className="space-y-4">
            <div className="rounded-xl border bg-white p-3 sm:p-4 shadow-sm space-y-3">
              <div className="h-3 w-20 rounded bg-slate-200" />
              {[56, 48].map((w, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="h-2.5 rounded bg-slate-100" style={{ width: `${w}px` }} />
                  <div className="h-8 rounded-md bg-slate-200" />
                </div>
              ))}
            </div>
            <div className="rounded-xl border bg-white p-3 sm:p-4 shadow-sm space-y-2">
              <div className="h-3 w-20 rounded bg-slate-200" />
              <div className="rounded-lg bg-slate-50 px-3 py-2 space-y-1.5">
                <div className="h-2.5 w-40 rounded bg-slate-200" />
                <div className="h-2.5 w-32 rounded bg-slate-200" />
                <div className="h-2.5 w-24 rounded bg-slate-200" />
              </div>
            </div>
            <div className="rounded-xl border bg-white p-3 sm:p-4 shadow-sm space-y-3">
              <div className="h-3 w-20 rounded bg-slate-200" />
              <div className="space-y-1.5">
                <div className="h-2.5 w-24 rounded bg-slate-100" />
                <div className="h-8 rounded-md bg-slate-200" />
              </div>
            </div>
          </div>
        </div>

        {/* Save bar */}
        <div className="flex justify-end pt-2 border-t border-slate-100">
          <div className="h-7 w-24 rounded-lg bg-slate-200" />
        </div>
      </div>
    );
  }

  if (loadError || !establishment) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 text-center">
        <AlertCircle className="h-8 w-8 text-red-400" />
        <p className="font-medium text-slate-700">{t('notFound')}</p>
        <p className="text-sm text-slate-500">{t('notFoundDescription')}</p>
      </div>
    );
  }

  const statusKey = STATUS_LABEL_KEYS[establishment.status ?? ''] ?? 'statusInactive';
  const statusStyle = STATUS_STYLES[establishment.status ?? ''] ?? STATUS_STYLES['inactive'];
  const images = establishment.images ?? [];

  // ── Save button (shared between Profile and Hours tabs) ───────────────────
  const SaveBar = () => (
    <div className="flex items-center justify-between pt-2 border-t border-slate-100 mt-4">
      <div className="flex-1">
        {saveError && (
          <div className="flex items-center gap-1.5 text-xs text-red-600">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {saveError}
          </div>
        )}
        {saveSuccess && (
          <div className="flex items-center gap-1.5 text-xs text-green-600">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            {t('success')}
          </div>
        )}
      </div>
      <Button type="submit" size="sm" className="h-7 text-xs px-3" disabled={isSaving}>
        {isSaving ? (
          <>
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            {t('saving')}
          </>
        ) : (
          t('saveChanges')
        )}
      </Button>
    </div>
  );

  return (
    <div className="mx-auto max-w-2xl px-3 py-3 sm:px-4 sm:py-4 lg:px-0 space-y-4">
      {/* ── Header row: name + status badge ──────────────────────────────── */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-base font-semibold text-slate-800">{establishment.name}</h1>
          <p className="text-xs text-slate-400 mt-0.5">{t('description')}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusStyle}`}>
            {t(statusKey)}
          </span>
          {establishment.isVerified && (
            <span className="flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-600">
              <CheckCheck className="h-3 w-3" />
              {t('verified')}
            </span>
          )}
        </div>
      </div>

      {/* ── Quick stats row ───────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-4 rounded-xl border bg-white px-4 py-3 shadow-sm">
        {establishment.averageRating !== undefined && (
          <div className="flex items-center gap-1.5">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
            <span className="text-xs font-medium text-slate-700">
              {establishment.averageRating.toFixed(1)}
            </span>
            {establishment.totalReviews !== undefined && (
              <span className="text-xs text-slate-400">
                ({establishment.totalReviews} {t('reviews', { count: establishment.totalReviews })})
              </span>
            )}
          </div>
        )}
        {establishment.completedOrders !== undefined && (
          <div className="flex items-center gap-1.5">
            <ShoppingBag className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-xs text-slate-600">
              {t('completedOrders', { count: establishment.completedOrders })}
            </span>
          </div>
        )}
        {establishment.address?.city && (
          <div className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-xs text-slate-600">{establishment.address.city}</span>
          </div>
        )}
        {establishment.rejectionReason && (
          <div className="w-full flex items-start gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              <strong>{t('rejectionReason')}:</strong> {establishment.rejectionReason}
            </span>
          </div>
        )}
      </div>

      {/* ── Tab navigation ────────────────────────────────────────────────── */}
      <div className="flex gap-1 rounded-xl bg-slate-100 p-1 overflow-hidden">
        {(
          [
            { id: 'profile', icon: Store, label: 'Profile' },
            { id: 'hours', icon: Clock, label: 'Hours' },
            { id: 'documents', icon: FileText, label: 'Documents' },
          ] as const
        ).map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={`flex flex-1 min-w-0 items-center justify-center gap-1 sm:gap-1.5 rounded-lg px-2 sm:px-3 py-2 text-xs font-medium transition-all ${
              activeTab === id
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* TAB: PROFILE                                                      */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'profile' && (
        <form onSubmit={handleSave} className="space-y-4">
          {/* Photos */}
          <section className="rounded-xl border bg-white p-3 sm:p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
                  <Camera className="h-3.5 w-3.5 text-primary-500" />
                  {t('photos')}
                  <span className="text-slate-400">
                    ({images.length}/{MAX_TOTAL_IMAGES})
                  </span>
                </h2>
                <p className="mt-0.5 text-[10px] text-slate-400">{t('photosHint')}</p>
              </div>
              <input
                ref={photoInputRef}
                type="file"
                accept={ACCEPTED_IMAGE_TYPES}
                multiple
                className="hidden"
                onChange={handlePhotosSelect}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs px-2.5"
                disabled={isUploadingPhotos || images.length >= MAX_TOTAL_IMAGES}
                onClick={() => photoInputRef.current?.click()}
              >
                {isUploadingPhotos ? (
                  <>
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    {t('uploading')}
                  </>
                ) : (
                  <>
                    <Camera className="mr-1 h-3 w-3" />
                    {t('uploadPhotos')}
                  </>
                )}
              </Button>
            </div>
            {photoError && (
              <div className="mb-3 flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                {photoError}
              </div>
            )}
            {photoSuccess && (
              <div className="mb-3 flex items-center gap-1.5 rounded-lg bg-green-50 px-3 py-2 text-xs text-green-600">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                {t('photosSuccess')}
              </div>
            )}
            {images.length > 0 ? (
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                {images.map((url, idx) => (
                  <div
                    key={idx}
                    className="relative aspect-square rounded-lg overflow-hidden border bg-slate-50"
                  >
                    <Image src={url} alt="" fill sizes="20vw" className="object-cover" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex h-20 items-center justify-center rounded-lg border-2 border-dashed border-slate-200 text-slate-400 text-xs gap-2">
                <Camera className="h-4 w-4" />
                {t('uploadPhotos')}
              </div>
            )}
          </section>

          {/* Basic Info + Contact side by side on md+ */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Basic Info */}
            <section className="rounded-xl border bg-white p-3 sm:p-4 shadow-sm space-y-3">
              <h2 className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
                <Store className="h-3.5 w-3.5 text-primary-500" />
                {t('basicInfo')}
              </h2>
              <div className="space-y-1">
                <Label className="text-xs" htmlFor="est-name">
                  {t('name')}
                </Label>
                <Input
                  id="est-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  minLength={2}
                  maxLength={100}
                  required
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs" htmlFor="est-type">
                  {t('type')}
                </Label>
                <select
                  id="est-type"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full h-8 rounded-md border border-slate-200 px-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary-400 bg-white"
                >
                  <option value="" disabled />
                  {ESTABLISHMENT_TYPES.map(({ value, labelKey }) => (
                    <option key={value} value={value}>
                      {t(labelKey)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs" htmlFor="est-website">
                  {t('website')}
                </Label>
                <div className="relative">
                  <Globe className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
                  <Input
                    id="est-website"
                    type="url"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder={t('websitePlaceholder')}
                    className="h-8 text-xs pl-7"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs" htmlFor="est-description">
                  {t('description_field')}{' '}
                  <span className="text-slate-400">{t('descriptionHint')}</span>
                </Label>
                <textarea
                  id="est-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  minLength={10}
                  maxLength={500}
                  rows={3}
                  className="w-full rounded-md border border-slate-200 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none"
                />
              </div>
            </section>

            {/* Contact + Address + Options stacked */}
            <div className="space-y-4">
              {/* Contact */}
              <section className="rounded-xl border bg-white p-3 sm:p-4 shadow-sm space-y-3">
                <h2 className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-primary-500" />
                  {t('contact')}
                </h2>
                <div className="space-y-1">
                  <Label className="text-xs" htmlFor="est-phone">
                    {t('phoneNumber')}
                  </Label>
                  <div className="relative">
                    <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
                    <Input
                      id="est-phone"
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="+21620123456"
                      className="h-8 text-xs pl-7"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs" htmlFor="est-email">
                    {t('email')}
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
                    <Input
                      id="est-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-8 text-xs pl-7"
                    />
                  </div>
                </div>
              </section>

              {/* Address (read-only) */}
              {establishment.address && (
                <section className="rounded-xl border bg-white p-3 sm:p-4 shadow-sm space-y-2">
                  <h2 className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-primary-500" />
                    {t('address')}
                  </h2>
                  <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 space-y-0.5">
                    {establishment.address.street && <p>{establishment.address.street}</p>}
                    <p>
                      {[establishment.address.postalCode, establishment.address.city]
                        .filter(Boolean)
                        .join(' ')}
                    </p>
                    {establishment.address.country && <p>{establishment.address.country}</p>}
                  </div>
                </section>
              )}

              {/* Options */}
              <section className="rounded-xl border bg-white p-3 sm:p-4 shadow-sm space-y-3">
                <h2 className="text-xs font-medium text-slate-700">{t('options')}</h2>
                <div className="space-y-1.5">
                  <Label className="text-xs" htmlFor="est-cuisine">
                    {t('cuisineTypes')}{' '}
                    <span className="text-slate-400">{t('cuisineTypesHint')}</span>
                  </Label>
                  <div className="flex flex-wrap gap-1.5">
                    {cuisineTypes.map((tag) => (
                      <span
                        key={tag}
                        className="flex items-center gap-1 rounded-full bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-700"
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={() => removeCuisineTag(tag)}
                          className="text-primary-400 hover:text-primary-700"
                          aria-label={`Remove ${tag}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <Input
                    id="est-cuisine"
                    value={cuisineInput}
                    onChange={(e) => setCuisineInput(e.target.value)}
                    onKeyDown={handleCuisineKeyDown}
                    onBlur={addCuisineTag}
                    placeholder="e.g. Italian"
                    className="h-8 text-xs"
                  />
                </div>
              </section>
            </div>
          </div>

          <SaveBar />
        </form>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* TAB: HOURS                                                        */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'hours' && (
        <form onSubmit={handleSave}>
          <section className="rounded-xl border bg-white p-3 sm:p-4 shadow-sm space-y-3">
            <div>
              <h2 className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-primary-500" />
                {t('businessHours')}
              </h2>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Set the opening hours for each day of the week.
              </p>
            </div>
            <div className="space-y-1">
              {DAYS.map((day) => {
                const hours = businessHours[day];
                return (
                  <div
                    key={day}
                    className={`grid grid-cols-[70px_1fr] sm:grid-cols-[90px_1fr] items-center gap-2 rounded-lg px-2 sm:px-3 py-2 ${hours.closed ? 'bg-slate-50' : 'bg-white'}`}
                  >
                    <span
                      className={`text-xs font-medium ${hours.closed ? 'text-slate-400' : 'text-slate-700'}`}
                    >
                      {t(day)}
                    </span>
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="flex items-center gap-1.5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={hours.closed}
                          onChange={(e) => updateHour(day, 'closed', e.target.checked)}
                          className="h-3.5 w-3.5 rounded border-slate-300 text-primary-500"
                        />
                        <span className="text-xs text-slate-500">{t('closed')}</span>
                      </label>
                      {!hours.closed && (
                        <>
                          <div className="flex items-center gap-1.5">
                            <label
                              htmlFor={`${day}-open`}
                              className="text-[10px] text-slate-400 uppercase tracking-wide"
                            >
                              {t('open')}
                            </label>
                            <input
                              id={`${day}-open`}
                              type="time"
                              value={hours.open}
                              onChange={(e) => updateHour(day, 'open', e.target.value)}
                              className="rounded border border-slate-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary-400"
                            />
                          </div>
                          <div className="flex items-center gap-1.5">
                            <label
                              htmlFor={`${day}-close`}
                              className="text-[10px] text-slate-400 uppercase tracking-wide"
                            >
                              {t('close')}
                            </label>
                            <input
                              id={`${day}-close`}
                              type="time"
                              value={hours.close}
                              onChange={(e) => updateHour(day, 'close', e.target.value)}
                              className="rounded border border-slate-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary-400"
                            />
                          </div>
                        </>
                      )}
                    </div>
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
        <div className="space-y-4">
          <section className="rounded-xl border bg-white p-3 sm:p-4 shadow-sm space-y-3">
            <div>
              <h2 className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-primary-500" />
                {t('legalDocuments')}
              </h2>
              <p className="text-[10px] text-slate-400 mt-0.5">{t('legalDocumentsHint')}</p>
            </div>
            {docFeedback && (
              <div
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs ${docFeedback.type === 'success' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}
              >
                {docFeedback.type === 'success' ? (
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                ) : (
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                )}
                {docFeedback.msg}
              </div>
            )}
            <div className="space-y-2">
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
                  deleting={!!docDeleting[type]}
                  onUpload={(file) => handleDocUpload(type, file)}
                  onDelete={() => handleDocDelete(type)}
                  tPdfOnly={t('docPdfOnly')}
                  tSizeError={t('docSizeError')}
                  tUploadDoc={t('uploadDoc')}
                  tUploadingDoc={t('uploadingDoc')}
                  tDeleteDoc={t('deleteDoc')}
                  tDeletingDoc={t('deletingDoc')}
                  tVerified={t('docVerified')}
                  tPending={t('docPending')}
                  tUploaded={t('docUploaded')}
                  tExpiry={(date) => t('docExpiry', { date })}
                />
              ))}
            </div>
          </section>

          {/* Registration numbers */}
          <section className="rounded-xl border bg-white p-3 sm:p-4 shadow-sm space-y-3">
            <h2 className="text-xs font-medium text-slate-700">{t('registrationNumbers')}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs" htmlFor="est-siret">
                  {t('siret')}
                </Label>
                <Input
                  id="est-siret"
                  className="h-8 text-xs bg-slate-50"
                  defaultValue={establishment.legalDocuments?.siret ?? '—'}
                  readOnly
                  tabIndex={-1}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs" htmlFor="est-license">
                  {t('licenseNumber')}
                </Label>
                <Input
                  id="est-license"
                  className="h-8 text-xs bg-slate-50"
                  defaultValue={establishment.legalDocuments?.license ?? '—'}
                  readOnly
                  tabIndex={-1}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs" htmlFor="est-vat">
                  {t('vatNumber')}
                </Label>
                <Input
                  id="est-vat"
                  className="h-8 text-xs bg-slate-50"
                  defaultValue={establishment.legalDocuments?.vatNumber ?? '—'}
                  readOnly
                  tabIndex={-1}
                />
              </div>
            </div>
            <p className="text-[10px] text-slate-400">
              Registration numbers are assigned by admin during verification.
            </p>
          </section>
        </div>
      )}
    </div>
  );
}
