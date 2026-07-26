/**
 * Recently chosen locations, persisted across launches.
 *
 * Deduplicated by coordinates rather than by name: the same place can arrive
 * with different labels depending on whether it came from Google Places, a
 * reverse geocode, or a saved address, and three entries for one street corner
 * is not a useful history.
 *
 * Writes are fire-and-forget. State updates first so the picker reflects the
 * choice immediately; a storage failure costs the user the entry on next launch
 * and nothing more.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

import { Logger } from '@/utils/logger';

import type { LocationItem } from '@/navigation/components';

const STORAGE_KEY = '@food_waste_app:recent_locations';

/** Enough to be useful in a bottom sheet without becoming a second list. */
const MAX_RECENT_LOCATIONS = 5;

/** Same place if both coordinates match; labels vary by source. */
const isSamePlace = (a: LocationItem, b: LocationItem): boolean =>
  a.latitude === b.latitude && a.longitude === b.longitude;

/**
 * Entries missing coordinates cannot be selected — dropping them keeps a
 * partially-written or hand-edited store from filling the list with dead rows.
 */
const isUsable = (item: unknown): item is LocationItem =>
  item != null &&
  typeof item === 'object' &&
  typeof (item as LocationItem).latitude === 'number' &&
  typeof (item as LocationItem).longitude === 'number';

export interface RecentLocations {
  recentLocations: LocationItem[];
  /** Records a location, moving it to the front if already present. */
  saveToRecentLocations: (location: LocationItem) => void;
}

export function useRecentLocations(): RecentLocations {
  const [recentLocations, setRecentLocations] = useState<LocationItem[]>([]);

  // Load once on mount; nothing else writes to storage behind our back.
  useEffect(() => {
    let cancelled = false;

    const load = async (): Promise<void> => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored == null || stored === '') return;

        const parsed: unknown = JSON.parse(stored);
        if (!Array.isArray(parsed)) return;

        // Unmounted before the read resolved — setting state here would warn.
        if (cancelled) return;

        setRecentLocations(parsed.filter(isUsable).slice(0, MAX_RECENT_LOCATIONS));
      } catch (error) {
        Logger.warn('[useRecentLocations] Failed to load recent locations', {
          error: String(error),
        });
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const saveToRecentLocations = useCallback((location: LocationItem) => {
    if (!isUsable(location)) return;

    setRecentLocations(prev => {
      const updated = [location, ...prev.filter(item => !isSamePlace(item, location))].slice(
        0,
        MAX_RECENT_LOCATIONS,
      );

      void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated)).catch(error => {
        Logger.warn('[useRecentLocations] Failed to save recent location', {
          error: String(error),
        });
      });

      return updated;
    });
  }, []);

  return { recentLocations, saveToRecentLocations };
}
