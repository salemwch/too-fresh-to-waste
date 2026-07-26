/**
 * useRecentLocations.
 *
 * Persisted history for the location picker. Storage is the failure surface —
 * it can be empty, corrupt, half-written, or refuse to write — and none of
 * those may lose the user's current selection or crash the picker.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';

jest.mock('@/utils/logger', () => ({
  Logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { useRecentLocations } from '../useRecentLocations';

import type { LocationItem } from '@/navigation/components';

const KEY = '@food_waste_app:recent_locations';

const place = (name: string, latitude: number, longitude = 10): LocationItem =>
  ({ id: name, name, latitude, longitude }) as LocationItem;

const stored = async (): Promise<LocationItem[]> =>
  JSON.parse((await AsyncStorage.getItem(KEY)) ?? '[]') as LocationItem[];

const setup = () => renderHook(() => useRecentLocations());

describe('useRecentLocations', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  describe('loading on mount', () => {
    it('starts empty when nothing is stored', async () => {
      const { result } = setup();

      await waitFor(() => expect(result.current.recentLocations).toEqual([]));
    });

    it('restores what was saved', async () => {
      await AsyncStorage.setItem(KEY, JSON.stringify([place('Sousse', 35.8)]));
      const { result } = setup();

      await waitFor(() => expect(result.current.recentLocations).toHaveLength(1));
      expect(result.current.recentLocations[0]?.name).toBe('Sousse');
    });

    // A store written by an older build, or trimmed by hand.
    it('caps a longer stored list', async () => {
      await AsyncStorage.setItem(
        KEY,
        JSON.stringify(Array.from({ length: 9 }, (_, i) => place(`p${i}`, i))),
      );
      const { result } = setup();

      await waitFor(() => expect(result.current.recentLocations).toHaveLength(5));
    });
  });

  describe('unusable storage', () => {
    it.each(['', 'not json', '{"not":"an array"}', 'null'])(
      'starts empty for stored value %p',
      async value => {
        await AsyncStorage.setItem(KEY, value);
        const { result } = setup();

        await waitFor(() => expect(result.current.recentLocations).toEqual([]));
      },
    );

    // Entries with no coordinates cannot be selected, so they would be dead
    // rows in the picker.
    it('drops entries without coordinates', async () => {
      await AsyncStorage.setItem(
        KEY,
        JSON.stringify([place('Good', 35.8), { name: 'Broken' }, null, 'string']),
      );
      const { result } = setup();

      await waitFor(() => expect(result.current.recentLocations).toHaveLength(1));
      expect(result.current.recentLocations[0]?.name).toBe('Good');
    });

    it('starts empty when reading throws', async () => {
      jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('unavailable'));
      const { result } = setup();

      await waitFor(() => expect(result.current.recentLocations).toEqual([]));
    });
  });

  describe('saving', () => {
    it('adds a location and persists it', async () => {
      const { result } = setup();
      await waitFor(() => expect(result.current.recentLocations).toEqual([]));

      act(() => result.current.saveToRecentLocations(place('Sousse', 35.8)));

      expect(result.current.recentLocations).toHaveLength(1);
      await waitFor(async () => expect(await stored()).toHaveLength(1));
    });

    it('puts the newest first', async () => {
      const { result } = setup();
      await waitFor(() => expect(result.current.recentLocations).toEqual([]));

      act(() => result.current.saveToRecentLocations(place('A', 1)));
      act(() => result.current.saveToRecentLocations(place('B', 2)));

      expect(result.current.recentLocations.map(l => l.name)).toEqual(['B', 'A']);
    });

    // The same corner arrives with different labels from Google, a reverse
    // geocode, or a saved address — three rows for one place is not history.
    it('deduplicates by coordinates, not by name', async () => {
      const { result } = setup();
      await waitFor(() => expect(result.current.recentLocations).toEqual([]));

      act(() => result.current.saveToRecentLocations(place('Sousse Centre', 35.8)));
      act(() => result.current.saveToRecentLocations(place('Sousse', 35.8)));

      expect(result.current.recentLocations).toHaveLength(1);
      expect(result.current.recentLocations[0]?.name).toBe('Sousse');
    });

    it('treats a different longitude at the same latitude as a different place', async () => {
      const { result } = setup();
      await waitFor(() => expect(result.current.recentLocations).toEqual([]));

      act(() => result.current.saveToRecentLocations(place('A', 35.8, 10)));
      act(() => result.current.saveToRecentLocations(place('B', 35.8, 11)));

      expect(result.current.recentLocations).toHaveLength(2);
    });

    it('re-selecting an older entry moves it back to the front', async () => {
      const { result } = setup();
      await waitFor(() => expect(result.current.recentLocations).toEqual([]));

      act(() => result.current.saveToRecentLocations(place('A', 1)));
      act(() => result.current.saveToRecentLocations(place('B', 2)));
      act(() => result.current.saveToRecentLocations(place('A', 1)));

      expect(result.current.recentLocations.map(l => l.name)).toEqual(['A', 'B']);
      expect(result.current.recentLocations).toHaveLength(2);
    });

    it('drops the oldest past the cap', async () => {
      const { result } = setup();
      await waitFor(() => expect(result.current.recentLocations).toEqual([]));

      for (let i = 0; i < 7; i += 1) {
        act(() => result.current.saveToRecentLocations(place(`p${i}`, i)));
      }

      expect(result.current.recentLocations).toHaveLength(5);
      expect(result.current.recentLocations.map(l => l.name)).not.toContain('p0');
      expect(result.current.recentLocations[0]?.name).toBe('p6');
    });

    it('ignores a location with no coordinates', async () => {
      const { result } = setup();
      await waitFor(() => expect(result.current.recentLocations).toEqual([]));

      act(() => result.current.saveToRecentLocations({ name: 'Broken' } as LocationItem));

      expect(result.current.recentLocations).toEqual([]);
    });

    // The user picked a place; failing to remember it for next launch must not
    // undo the selection they just made.
    it('still updates the list when writing fails', async () => {
      jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('storage full'));
      const { result } = setup();
      await waitFor(() => expect(result.current.recentLocations).toEqual([]));

      act(() => result.current.saveToRecentLocations(place('Sousse', 35.8)));

      expect(result.current.recentLocations).toHaveLength(1);
    });
  });
});
