'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Search, MapPin, Loader2, X, AlertCircle } from 'lucide-react';
import { Input } from '@foodwaste/ui';
import { useTranslations } from 'next-intl';
import axios from 'axios';
import { geolocationService } from '@/services/geolocation.service';
import type { PlaceSuggestion, PlaceDetails } from '@/types/geolocation';

/** Check if an error was caused by an intentional request cancellation */
function isAbortError(error: unknown): boolean {
  // Axios wraps AbortError as AxiosError with code 'ERR_CANCELED'
  if (axios.isCancel(error)) return true;
  // Native fetch / non-Axios fallback
  if (error instanceof DOMException && error.name === 'AbortError') return true;
  return false;
}

interface BusinessSearchAutocompleteProps {
  onSelect: (details: PlaceDetails) => void;
  onClear: () => void;
  selectedBusiness: PlaceDetails | null;
}

/** Generate a UUID v4 for session token */
function generateSessionToken(): string {
  return crypto.randomUUID();
}

const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;
const CACHE_MAX_ENTRIES = 50;

function decodeHtmlEntities(text: string): string {
  if (typeof document === 'undefined') return text.replace(/&amp;/g, '&');
  const el = document.createElement('textarea');
  el.innerHTML = text;
  return el.value;
}

export function BusinessSearchAutocomplete({
  onSelect,
  onClear,
  selectedBusiness,
}: BusinessSearchAutocompleteProps) {
  const t = useTranslations('merchantSignup');

  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isSelectingDetails, setIsSelectingDetails] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [placeConflict, setPlaceConflict] = useState<string | null>(null);

  const sessionTokenRef = useRef(generateSessionToken());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const cacheRef = useRef<Map<string, PlaceSuggestion[]>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);

  // Cleanup: abort in-flight request + clear debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      abortControllerRef.current?.abort();
    };
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchSuggestions = useCallback(async (input: string) => {
    const trimmed = input.trim().toLowerCase();

    if (trimmed.length < MIN_QUERY_LENGTH) {
      setSuggestions([]);
      setShowDropdown(false);
      setHasError(false);
      return;
    }

    // 1. Serve from cache if available (instant, zero API cost)
    const cached = cacheRef.current.get(trimmed);
    if (cached) {
      setSuggestions(cached);
      setShowDropdown(true);
      setHasError(false);
      return;
    }

    // 2. Abort any in-flight request before starting a new one
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);
    setHasError(false);
    try {
      const res = await geolocationService.autocomplete(
        input,
        sessionTokenRef.current,
        5,
        controller.signal,
      );
      const body = res.data as { data?: PlaceSuggestion[] };
      const data = body.data ?? [];
      const results = Array.isArray(data) ? data : [];

      // 3. Store in cache (evict oldest if limit reached)
      if (cacheRef.current.size >= CACHE_MAX_ENTRIES) {
        const oldestKey = cacheRef.current.keys().next().value;
        if (oldestKey !== undefined) cacheRef.current.delete(oldestKey);
      }
      cacheRef.current.set(trimmed, results);

      setSuggestions(results);
      setShowDropdown(true);
    } catch (error) {
      // Ignore aborted requests — user kept typing, a new request replaced this one
      if (isAbortError(error)) return;
      setSuggestions([]);
      setHasError(true);
      setShowDropdown(true);
    } finally {
      // Only clear loading if this controller wasn't replaced
      if (abortControllerRef.current === controller) {
        setIsLoading(false);
      }
    }
  }, []);

  const handleInputChange = useCallback(
    (value: string) => {
      setQuery(value);

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(() => {
        fetchSuggestions(value);
      }, DEBOUNCE_MS);
    },
    [fetchSuggestions],
  );

  const handleSelect = useCallback(
    async (suggestion: PlaceSuggestion) => {
      setShowDropdown(false);
      setPlaceConflict(null);
      setIsSelectingDetails(true);

      try {
        // 1. Fetch full place details (coords, address, etc.)
        const res = await geolocationService.getPlaceDetails(
          suggestion.googlePlaceId,
          sessionTokenRef.current,
        );
        const rawDetails = res.data?.data ?? res.data;

        // 2. Validate this is a real business, not a city or geographic entity.
        //    When autocomplete returns types, the backend already filtered geographic-only results.
        //    When types are undefined, we verify here using place-details data:
        //    cities/regions never have a street in their addressComponents; businesses do.
        const hasValidCoords = !!(rawDetails?.coords?.lat && rawDetails?.coords?.lng);
        const hasAddress = !!rawDetails?.formattedAddress?.trim();
        if (!hasValidCoords || !hasAddress) {
          setPlaceConflict(t('notABusiness'));
          return;
        }
        const typesUnknown = !suggestion.types || suggestion.types.length === 0;
        if (typesUnknown && !rawDetails?.addressComponents?.street) {
          setPlaceConflict(t('notABusiness'));
          return;
        }

        // 3. Check if this place is already owned by an active establishment.
        // The global interceptor wraps every response: { status, data: { available, message? }, timestamp }
        // so we must read .data.data — same pattern as getPlaceDetails above.
        const availabilityRes = await geolocationService.checkPlaceAvailability(
          suggestion.googlePlaceId,
        );
        const availability = availabilityRes.data.data;

        if (!availability?.available) {
          setPlaceConflict(availability?.message ?? t('placeAlreadyRegistered'));
          return;
        }
        // 3. Merge: name + types from autocomplete (free), coords + address from details (Essentials SKU)
        const merged: PlaceDetails = {
          ...rawDetails,
          name: decodeHtmlEntities(suggestion.name),
          nameAr: decodeHtmlEntities(suggestion.nameAr),
          ...(suggestion.types ? { types: suggestion.types } : {}),
        };

        onSelect(merged);

        // Generate new session token for next search session
        cacheRef.current.clear();
        sessionTokenRef.current = generateSessionToken();
      } catch {
        // If any fetch fails, allow user to retry
        setShowDropdown(true);
      } finally {
        setIsSelectingDetails(false);
      }
    },
    [onSelect, t],
  );

  const handleClear = useCallback(() => {
    setQuery('');
    setSuggestions([]);
    setShowDropdown(false);
    setHasError(false);
    setPlaceConflict(null);
    abortControllerRef.current?.abort();
    cacheRef.current.clear();
    sessionTokenRef.current = generateSessionToken();
    onClear();
  }, [onClear]);

  // Selected business card
  if (selectedBusiness) {
    return (
      <div className='rounded-xl border border-primary/20 bg-primary/5 p-4'>
        <div className='flex items-start justify-between gap-3'>
          <div className='flex items-start gap-3'>
            <div className='mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10'>
              <MapPin className='h-4 w-4 text-primary' />
            </div>
            <div className='min-w-0'>
              <p className='text-sm font-semibold text-foreground'>{selectedBusiness.name}</p>
              <p className='mt-0.5 text-xs text-muted-foreground'>
                {selectedBusiness.formattedAddress}
              </p>
            </div>
          </div>
          <button
            type='button'
            onClick={handleClear}
            className='shrink-0 text-xs font-medium text-primary hover:text-primary/80'
          >
            {t('changeSelection')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className='relative'>
      {/* Search input */}
      <div className='relative'>
        <Search className='absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
        <Input
          type='search'
          placeholder={t('searchPlaceholder')}
          className='h-11 rounded-xl border-input bg-secondary/50 pl-7 pr-10 text-sm sm:h-12 [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden [&:-webkit-autofill]:bg-secondary/50 [&:-webkit-autofill]:shadow-[inset_0_0_0_1000px_hsl(var(--secondary)/0.5)]'
          value={query}
          onChange={e => handleInputChange(e.target.value)}
          onFocus={() => {
            if (suggestions.length > 0) setShowDropdown(true);
          }}
          autoComplete='off'
        />
        {/* Right icon: spinner when loading, X to clear when idle with text */}
        <div className='absolute right-3.5 top-1/2 flex h-4 w-4 -translate-y-1/2 items-center justify-center'>
          {isLoading || isSelectingDetails ? (
            <Loader2 className='h-4 w-4 animate-spin text-muted-foreground' />
          ) : query.length > 0 ? (
            <button
              type='button'
              onClick={() => {
                setQuery('');
                setSuggestions([]);
                setShowDropdown(false);
                setHasError(false);
              }}
              className='flex h-4 w-4 items-center justify-center'
              aria-label={t('clearSearch')}
            >
              <X className='h-4 w-4 text-muted-foreground hover:text-foreground' />
            </button>
          ) : null}
        </div>
      </div>

      {/* Inline conflict error — shown when the selected place is already registered */}
      {placeConflict && (
        <div className='mt-2 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive'>
          <AlertCircle className='mt-0.5 h-4 w-4 shrink-0' />
          <span>{placeConflict}</span>
        </div>
      )}

      {/* Dropdown */}
      {showDropdown && (
        <div className='absolute z-50 mt-1.5 w-full overflow-hidden rounded-xl border border-border bg-background shadow-lg'>
          {isLoading ? (
            <div className='flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground'>
              <Loader2 className='h-4 w-4 animate-spin' />
              {t('searchLoading')}
            </div>
          ) : hasError ? (
            <div className='flex items-center gap-2 px-4 py-3 text-sm text-destructive'>
              <AlertCircle className='h-4 w-4 shrink-0' />
              {t('searchError')}
            </div>
          ) : suggestions.length === 0 ? (
            <div className='px-4 py-3 text-sm text-muted-foreground'>{t('searchNoResults')}</div>
          ) : (
            <ul className='max-h-64 overflow-y-auto'>
              {suggestions.map(suggestion => (
                <li key={suggestion.id}>
                  <button
                    type='button'
                    onClick={() => handleSelect(suggestion)}
                    className='flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/50'
                  >
                    <MapPin className='mt-0.5 h-4 w-4 shrink-0 text-muted-foreground' />
                    <div className='min-w-0'>
                      <p className='truncate text-sm font-medium text-foreground'>
                        {suggestion.name}
                      </p>
                      <p className='truncate text-xs text-muted-foreground'>{suggestion.subtext}</p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
