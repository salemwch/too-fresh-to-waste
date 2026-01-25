/**
 * Favorites Redux Slice
 *
 * Manages user favorites state with optimistic updates
 *
 * Key features:
 * - Optimistic UI updates for instant feedback
 * - Server state sync with TanStack Query
 * - Favorite status tracking per offer ID
 * - Recent favorites cache
 */

import { createSlice, createAsyncThunk, createSelector, type PayloadAction } from '@reduxjs/toolkit';

import { favoritesService } from '@/features/favorites/services';
import { FavoriteType } from '@/features/favorites/types';
import type { RootState } from '../index';

// ============================================================================
// Types
// ============================================================================

export interface FavoriteItem {
  itemId: string;
  type: FavoriteType;
  addedAt: number; // Unix timestamp
}

export interface FavoritesState {
  /** Map of itemId -> favorite status (for quick lookups) */
  favoriteMap: Record<string, boolean>;
  /** Recent favorites list (max 50) */
  recentFavorites: FavoriteItem[];
  /** Loading state for async operations */
  isLoading: boolean;
  /** Error message from last failed operation */
  error: string | null;
  /** Last sync timestamp */
  lastSyncedAt: number | null;
}

// ============================================================================
// Initial State
// ============================================================================

const initialState: FavoritesState = {
  favoriteMap: {},
  recentFavorites: [],
  isLoading: false,
  error: null,
  lastSyncedAt: null,
};

// ============================================================================
// Async Thunks
// ============================================================================

/**
 * Check if an item is favorited
 */
export const checkIsFavorite = createAsyncThunk<
  { itemId: string; isFavorite: boolean },
  { type: FavoriteType; itemId: string },
  { rejectValue: string }
>(
  'favorites/checkIsFavorite',
  async ({ type, itemId }, { rejectWithValue }) => {
    try {
      const isFavorite = await favoritesService.checkIsFavorite(type, itemId);
      return { itemId, isFavorite };
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to check favorite status');
    }
  }
);

/**
 * Toggle favorite status (add or remove)
 */
export const toggleFavorite = createAsyncThunk<
  { itemId: string; isFavorite: boolean; type: FavoriteType },
  { type: FavoriteType; itemId: string; itemName?: string; itemImage?: string },
  { rejectValue: string }
>(
  'favorites/toggleFavorite',
  async ({ type, itemId, itemName, itemImage }, { rejectWithValue }) => {
    try {
      const isFavorite = await favoritesService.toggleFavorite(type, itemId, itemName, itemImage);
      return { itemId, isFavorite, type };
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to toggle favorite');
    }
  }
);

/**
 * Batch check favorite status for multiple items
 */
export const batchCheckFavorites = createAsyncThunk<
  Record<string, boolean>,
  Array<{ type: FavoriteType; itemId: string }>,
  { rejectValue: string }
>(
  'favorites/batchCheckFavorites',
  async (items, { rejectWithValue }) => {
    try {
      const results = await Promise.all(
        items.map(async ({ type, itemId }) => {
          const isFavorite = await favoritesService.checkIsFavorite(type, itemId);
          return { itemId, isFavorite };
        })
      );

      return results.reduce((acc, { itemId, isFavorite }) => {
        acc[itemId] = isFavorite;
        return acc;
      }, {} as Record<string, boolean>);
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to check favorites');
    }
  }
);

// ============================================================================
// Slice
// ============================================================================

const favoritesSlice = createSlice({
  name: 'favorites',
  initialState,
  reducers: {
    /**
     * Optimistically add favorite (instant UI update)
     */
    addFavoriteOptimistic: (state, action: PayloadAction<FavoriteItem>) => {
      state.favoriteMap[action.payload.itemId] = true;

      // Add to recent favorites (max 50)
      state.recentFavorites = [
        action.payload,
        ...state.recentFavorites.filter(f => f.itemId !== action.payload.itemId),
      ].slice(0, 50);
    },

    /**
     * Optimistically remove favorite (instant UI update)
     */
    removeFavoriteOptimistic: (state, action: PayloadAction<{ itemId: string }>) => {
      state.favoriteMap[action.payload.itemId] = false;

      // Remove from recent favorites
      state.recentFavorites = state.recentFavorites.filter(
        f => f.itemId !== action.payload.itemId
      );
    },

    /**
     * Clear all favorites (logout)
     */
    clearFavorites: (state) => {
      state.favoriteMap = {};
      state.recentFavorites = [];
      state.lastSyncedAt = null;
      state.error = null;
    },

    /**
     * Clear error
     */
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // Check if favorite
    builder
      .addCase(checkIsFavorite.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(checkIsFavorite.fulfilled, (state, action) => {
        state.isLoading = false;
        state.favoriteMap[action.payload.itemId] = action.payload.isFavorite;
        state.lastSyncedAt = Date.now();
      })
      .addCase(checkIsFavorite.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload ?? 'Failed to check favorite';
      });

    // Toggle favorite
    builder
      .addCase(toggleFavorite.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(toggleFavorite.fulfilled, (state, action) => {
        state.isLoading = false;
        state.favoriteMap[action.payload.itemId] = action.payload.isFavorite;

        if (action.payload.isFavorite) {
          // Add to recent favorites
          const favoriteItem: FavoriteItem = {
            itemId: action.payload.itemId,
            type: action.payload.type,
            addedAt: Date.now(),
          };
          state.recentFavorites = [
            favoriteItem,
            ...state.recentFavorites.filter(f => f.itemId !== action.payload.itemId),
          ].slice(0, 50);
        } else {
          // Remove from recent favorites
          state.recentFavorites = state.recentFavorites.filter(
            f => f.itemId !== action.payload.itemId
          );
        }

        state.lastSyncedAt = Date.now();
      })
      .addCase(toggleFavorite.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload ?? 'Failed to toggle favorite';
      });

    // Batch check favorites
    builder
      .addCase(batchCheckFavorites.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(batchCheckFavorites.fulfilled, (state, action) => {
        state.isLoading = false;
        state.favoriteMap = { ...state.favoriteMap, ...action.payload };
        state.lastSyncedAt = Date.now();
      })
      .addCase(batchCheckFavorites.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload ?? 'Failed to check favorites';
      });
  },
});

// ============================================================================
// Actions
// ============================================================================

export const {
  addFavoriteOptimistic,
  removeFavoriteOptimistic,
  clearFavorites,
  clearError,
} = favoritesSlice.actions;

// ============================================================================
// Selectors
// ============================================================================

/** Select favorites state */
export const selectFavoritesState = (state: RootState) => state.favorites;

/** Check if item is favorited */
export const selectIsFavorite = createSelector(
  [selectFavoritesState, (_state: RootState, itemId: string) => itemId],
  (favoritesState, itemId) => favoritesState.favoriteMap[itemId] ?? false
);

/** Select recent favorites */
export const selectRecentFavorites = createSelector(
  [selectFavoritesState],
  (favoritesState) => favoritesState.recentFavorites
);

/** Select loading state */
export const selectFavoritesLoading = createSelector(
  [selectFavoritesState],
  (favoritesState) => favoritesState.isLoading
);

/** Select error */
export const selectFavoritesError = createSelector(
  [selectFavoritesState],
  (favoritesState) => favoritesState.error
);

/** Select total favorites count */
export const selectFavoritesCount = createSelector(
  [selectFavoritesState],
  (favoritesState) => Object.values(favoritesState.favoriteMap).filter(Boolean).length
);

// ============================================================================
// Reducer Export
// ============================================================================

export default favoritesSlice.reducer;
