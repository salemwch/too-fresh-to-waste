'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
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
  Store,
  ChevronDown,
  Loader2,
  AlertCircle,
  MapPin,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { BusinessSearchAutocomplete } from '@/components/merchant-signup/business-search-autocomplete';
import { EstablishmentType } from '@foodwaste/shared';
import { organizationService } from '@/services/organization.service';
import { useAuthStore } from '@/lib/auth';
import { organizationKeys } from '@/hooks/use-organization';
import { dashboardKeys } from '@/hooks/use-merchant-dashboard';
import type { PlaceDetails } from '@/types/geolocation';

// ─── Helpers (mirrored from merchant-signup page) ────────────────────────────

/** Pre-select the most likely EstablishmentType from Google Place types. */
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
  label: string;
  Icon: React.FC<{ className?: string }>;
}[] = [
  { value: EstablishmentType.RESTAURANT, label: 'Restaurant', Icon: Utensils },
  { value: EstablishmentType.BAKERY, label: 'Bakery', Icon: Wheat },
  { value: EstablishmentType.PASTRY_SHOP, label: 'Pastry Shop', Icon: Cookie },
  { value: EstablishmentType.CAFE, label: 'Café', Icon: Coffee },
  { value: EstablishmentType.FAST_FOOD, label: 'Fast Food', Icon: Zap },
  { value: EstablishmentType.BUFFET_RESTAURANT, label: 'Buffet', Icon: UtensilsCrossed },
  { value: EstablishmentType.SUSHI_RESTAURANT, label: 'Sushi', Icon: Fish },
  { value: EstablishmentType.TAKEAWAY, label: 'Takeaway', Icon: ShoppingBag },
  { value: EstablishmentType.GROCERY_STORE, label: 'Grocery Store', Icon: ShoppingBasket },
  { value: EstablishmentType.SUPERMARKET, label: 'Supermarket', Icon: Store },
  { value: EstablishmentType.FRUIT_VEGETABLES, label: 'Fruit & Vegetables', Icon: Apple },
  { value: EstablishmentType.BUTCHER_SHOP, label: 'Butcher', Icon: Scissors },
  { value: EstablishmentType.BEVERAGE_SHOP, label: 'Beverage Shop', Icon: GlassWater },
  { value: EstablishmentType.PET_STORE, label: 'Pet Store', Icon: PawPrint },
  { value: EstablishmentType.FLOWER_PLANT, label: 'Flower & Plant', Icon: Flower2 },
  { value: EstablishmentType.HOTEL, label: 'Hotel', Icon: Building2 },
  { value: EstablishmentType.OTHER, label: 'Other', Icon: Package },
];

// ─── Types ────────────────────────────────────────────────────────────────────

type DialogStep = 'search' | 'confirm-type';

interface Props {
  orgId: string;
  trigger: React.ReactNode;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AddLocationDialog({ orgId, trigger }: Props) {
  const queryClient = useQueryClient();
  const user = useAuthStore(s => s.user);

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<DialogStep>('search');
  const [selectedBusiness, setSelectedBusiness] = useState<PlaceDetails | null>(null);
  const [selectedType, setSelectedType] = useState<EstablishmentType>(EstablishmentType.OTHER);
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const typeDropdownRef = useRef<HTMLDivElement>(null);

  // Close type dropdown on outside click
  useEffect(() => {
    if (!typeDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (typeDropdownRef.current && !typeDropdownRef.current.contains(e.target as Node)) {
        setTypeDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [typeDropdownOpen]);

  // Reset all state when dialog opens / closes
  const handleOpenChange = useCallback((value: boolean) => {
    setOpen(value);
    if (!value) {
      setStep('search');
      setSelectedBusiness(null);
      setSelectedType(EstablishmentType.OTHER);
      setTypeDropdownOpen(false);
      setIsSubmitting(false);
      setError('');
    }
  }, []);

  // Step 1 → Step 2: business selected
  const handleBusinessSelect = useCallback((details: PlaceDetails) => {
    setSelectedBusiness(details);
    setSelectedType(guessTypeFromGoogleTypes(details.types));
    setStep('confirm-type');
  }, []);

  const handleBusinessClear = useCallback(() => {
    setSelectedBusiness(null);
  }, []);

  const handleBack = useCallback(() => {
    setStep('search');
    setSelectedBusiness(null);
    setSelectedType(EstablishmentType.OTHER);
    setError('');
  }, []);

  // Step 2 → Submit
  const handleSubmit = useCallback(async () => {
    if (!selectedBusiness || isSubmitting) return;
    setIsSubmitting(true);
    setError('');

    try {
      const ac = selectedBusiness.addressComponents;

      // Build a minimal postal code — backend requires 4–5 digits
      const postalCode = ac?.postalCode?.replace(/\D/g, '').slice(0, 5) || '1000';
      const normalizedPostal = postalCode.length < 4 ? postalCode.padStart(4, '0') : postalCode;

      const payload = {
        name: selectedBusiness.name,
        description: 'Establishment pending profile completion',
        type: selectedType,
        address: {
          street: ac?.street ?? selectedBusiness.formattedAddress,
          city: ac?.city ?? 'Tunis',
          postalCode: normalizedPostal,
          country: ac?.country ?? 'Tunisia',
          coordinates: {
            type: 'Point' as const,
            coordinates: [selectedBusiness.coords.lng, selectedBusiness.coords.lat] as [
              number,
              number,
            ],
          },
        },
        phoneNumber: user?.phoneNumber ?? '+21620000000',
        email: user?.email ?? 'pending@example.com',
        ...(selectedBusiness.googlePlaceId
          ? { googlePlaceId: selectedBusiness.googlePlaceId }
          : {}),
      };

      // 1. Create the establishment
      const createRes = await organizationService.createEstablishment(payload);
      const newEstablishmentId = createRes.data.data.id;

      // 2. Link it to the organization
      await organizationService.addEstablishment(orgId, newEstablishmentId);

      // 3. Invalidate affected caches
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: organizationKeys.mine() }),
        queryClient.invalidateQueries({ queryKey: dashboardKeys.myEstablishment() }),
      ]);

      handleOpenChange(false);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Failed to create location. Please try again.';
      setError(typeof msg === 'string' ? msg : 'Failed to create location. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedBusiness, selectedType, orgId, user, isSubmitting, queryClient, handleOpenChange]);

  const selectedTypeOption = ESTABLISHMENT_TYPE_OPTIONS.find(o => o.value === selectedType);

  return (
    <>
      {/*
        Trigger — rendered outside the Dialog so it's always in the DOM.

        This span is a click-delegation wrapper with `display: contents`; it
        renders no box of its own and `trigger` is always a real <Button>.
        Enter and Space on that button fire a native click, which bubbles here,
        so the dialog already opens from the keyboard.

        Deliberately NOT given role='button' and tabIndex={0}: that would make
        the wrapper focusable around an already-focusable button, producing two
        tab stops for one action — worse for keyboard users than the warning it
        would silence.
      */}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <span onClick={() => handleOpenChange(true)} className='contents'>
        {trigger}
      </span>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>
              {step === 'search' ? 'Find Your Location' : 'Confirm Location Type'}
            </DialogTitle>
            <DialogDescription>
              {step === 'search'
                ? 'Search for the business you want to add as a new location.'
                : 'Review the details and confirm the establishment type before creating.'}
            </DialogDescription>
          </DialogHeader>

          {/* Step indicator */}
          <div className='flex gap-1.5 mb-1'>
            {(['search', 'confirm-type'] as const).map((s, i) => (
              <div
                key={s}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  i === 0 && step === 'search'
                    ? 'bg-primary'
                    : i === 1 && step === 'confirm-type'
                      ? 'bg-primary'
                      : i === 0 && step === 'confirm-type'
                        ? 'bg-primary'
                        : 'bg-muted'
                }`}
              />
            ))}
          </div>

          {step === 'search' && (
            <div className='space-y-4 pt-1'>
              <BusinessSearchAutocomplete
                onSelect={handleBusinessSelect}
                onClear={handleBusinessClear}
                selectedBusiness={selectedBusiness}
              />
              <p className='text-xs text-muted-foreground'>
                Selecting a business will auto-fill address and type details.
              </p>
            </div>
          )}

          {step === 'confirm-type' && selectedBusiness && (
            <div className='space-y-5 pt-1'>
              {/* Selected business summary */}
              <div className='rounded-lg border bg-muted/40 px-4 py-3 space-y-1'>
                <p className='text-sm font-semibold text-foreground'>{selectedBusiness.name}</p>
                <div className='flex items-start gap-1.5 text-xs text-muted-foreground'>
                  <MapPin className='size-3.5 mt-0.5 shrink-0' />
                  <span>{selectedBusiness.formattedAddress}</span>
                </div>
              </div>

              {/* Type picker */}
              <div className='space-y-2'>
                <p className='text-sm font-medium text-foreground'>Establishment Type</p>
                <div className='relative' ref={typeDropdownRef}>
                  <button
                    type='button'
                    onClick={() => setTypeDropdownOpen(v => !v)}
                    className={`flex h-11 w-full items-center justify-between rounded-lg border bg-background px-3 text-sm transition-colors hover:bg-muted/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${
                      typeDropdownOpen ? 'border-primary ring-2 ring-primary/20' : 'border-input'
                    }`}
                  >
                    {selectedTypeOption ? (
                      <span className='flex items-center gap-2.5 text-foreground'>
                        <selectedTypeOption.Icon className='size-4 shrink-0 text-muted-foreground' />
                        {selectedTypeOption.label}
                      </span>
                    ) : (
                      <span className='text-muted-foreground'>Select type...</span>
                    )}
                    <ChevronDown
                      className={`size-4 shrink-0 text-muted-foreground transition-transform duration-200 ${
                        typeDropdownOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {typeDropdownOpen && (
                    <div className='absolute z-50 mt-1.5 max-h-56 w-full overflow-y-auto rounded-lg border border-border bg-background shadow-lg'>
                      {ESTABLISHMENT_TYPE_OPTIONS.map(({ value, label, Icon }) => {
                        const isSelected = selectedType === value;
                        return (
                          <button
                            key={value}
                            type='button'
                            onClick={() => {
                              setSelectedType(value);
                              setTypeDropdownOpen(false);
                            }}
                            className={`flex w-full items-center gap-3 px-3 py-2.5 text-sm transition-colors hover:bg-muted/50 ${
                              isSelected
                                ? 'bg-primary/5 font-medium text-primary'
                                : 'text-foreground'
                            }`}
                          >
                            <Icon className='size-4 shrink-0 text-muted-foreground' />
                            <span>{label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className='flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive'>
                  <AlertCircle className='size-4 shrink-0' />
                  <span>{error}</span>
                </div>
              )}

              {/* Actions */}
              <div className='flex gap-3 pt-1'>
                <Button
                  variant='outline'
                  className='flex-1'
                  onClick={handleBack}
                  disabled={isSubmitting}
                >
                  Back
                </Button>
                <Button className='flex-[2]' onClick={handleSubmit} disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className='size-4 me-2 animate-spin' />}
                  {isSubmitting ? 'Creating...' : 'Create Location'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
