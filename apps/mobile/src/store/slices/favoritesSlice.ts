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

import {
  createSlice,
  createAsyncThunk,
  createSelector,
  type PayloadAction,
  type UnknownAction,
} from '@reduxjs/toolkit';

import { favoritesService } from '@/features/favorites/services';
import { Logger } from '@/utils/logger';
import { isAuthReadyForApiCalls } from '@/utils/tokenValidator';

import type { RootState } from '../index';
import type { FavoriteType } from '@/features/favorites/types';

// ============================================================================
// Types
// ============================================================================

interface FavoriteItem {
  itemId: string;
  type: FavoriteType;
  addedAt: number; // Unix timestamp
}

interface AuthSuccessMatcherAction {
  type: string;
  payload?: {
    user?: {
      userId?: string;
    };
  };
  [key: string]: unknown;
}

const isAuthLoginFulfilled = (action: UnknownAction): action is AuthSuccessMatcherAction =>
  action.type === 'auth/login/fulfilled';

const isAuthLogoutAction = (action: UnknownAction): boolean =>
  action.type === 'auth/logout/fulfilled' || action.type === 'auth/forceLocalLogout';

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
  /** 🔒 User ID who owns this favorites data (for multi-account support) */
  userId: string | null;
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
  userId: null,
};

// ============================================================================
// Async Thunks
// ============================================================================

/**
 * Check if an item is favorited
 */
const checkIsFavorite = createAsyncThunk<
  { itemId: string; isFavorite: boolean },
  { type: FavoriteType; itemId: string },
  { rejectValue: string }
>('favorites/checkIsFavorite', async ({ type, itemId }, { rejectWithValue }) => {
  try {
    const isFavorite = await favoritesService.checkIsFavorite(type, itemId);
    return { itemId, isFavorite };
  } catch (error) {
    return rejectWithValue(
      error instanceof Error ? error.message : 'Failed to check favorite status',
    );
  }
});

/**
 * Toggle favorite status (add or remove)
 */
const toggleFavorite = createAsyncThunk<
  { itemId: string; isFavorite: boolean; type: FavoriteType },
  { type: FavoriteType; itemId: string; itemName?: string; itemImage?: string },
  { rejectValue: string }
>(
  'favorites/toggleFavorite',
  async ({ type, itemId, itemName, itemImage }, { rejectWithValue }) => {
    try {
      const result = await favoritesService.toggleFavorite(type, itemId, itemName, itemImage);
      return { itemId, isFavorite: result.isFavorite, type };
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to toggle favorite');
    }
  },
);

/**
 * Batch check favorite status for multiple items
 */
const batchCheckFavorites = createAsyncThunk<
  Record<string, boolean>,
  Array<{ type: FavoriteType; itemId: string }>,
  { rejectValue: string }
>('favorites/batchCheckFavorites', async (items, { rejectWithValue }) => {
  try {
    const results = await Promise.all(
      items.map(async ({ type, itemId }) => {
        const isFavorite = await favoritesService.checkIsFavorite(type, itemId);
        return { itemId, isFavorite };
      }),
    );

    return results.reduce(
      (acc, { itemId, isFavorite }) => {
        acc[itemId] = isFavorite;
        return acc;
      },
      {} as Record<string, boolean>,
    );
  } catch (error) {
    return rejectWithValue(error instanceof Error ? error.message : 'Failed to check favorites');
  }
});

/**
 * Sync all favorites from server
 * Fetches user's favorite IDs from lightweight /favorites/ids endpoint
 * and updates favoriteMap
 *
 * ✅ Used on app startup and login to hydrate Redux state
 *
 * ✅ RACE CONDITION FIX (2026-02-04):
 * Added local token validation to prevent 401 errors during app startup.
 * When Redux rehydrates with flowState=AUTHENTICATED from persisted state,
 * the tokens might be expired/revoked. The auth middleware validates tokens
 * asynchronously, but this thunk can dispatch before validation completes.
 * Solution: Validate token locally BEFORE making API call using isAuthReadyForApiCalls().
 */
export const syncAllFavorites = createAsyncThunk<
  Record<string, boolean>,
  void,
  { rejectValue: string; state: RootState }
>('favorites/syncAll', async (_, { rejectWithValue, getState }) => {
  try {
    const state = getState();

    // ✅ BEST PRACTICE: Use centralized auth validation utility
    // Checks: isAuthenticated, hasAccessToken, session not expired locally
    const { isReady, reason } = isAuthReadyForApiCalls(state.auth);

    if (!isReady) {
      // Reject (not fulfill) so the reducer does NOT overwrite persisted favoriteMap with {}.
      // Auth middleware will handle refresh/logout; App.tsx retries when sessionExpiresAt changes.
      Logger.debug('[favorites/syncAll] Skipping - auth not ready for API calls', { reason });
      return rejectWithValue('AUTH_NOT_READY');
    }

    // ✅ Auth state is valid - proceed with API call
    const response = await favoritesService.getFavoriteIds();

    // Convert array to map for O(1) lookups
    const favoriteMap = response.ids.reduce(
      (map, itemId) => {
        map[itemId] = true;
        return map;
      },
      {} as Record<string, boolean>,
    );

    Logger.debug('[favorites/syncAll] Synced favorites', { count: response.ids.length });
    return favoriteMap;
  } catch (error) {
    // Don't log as error for 401 (expected during auth transitions)
    const isAuthError =
      error != null &&
      typeof error === 'object' &&
      'response' in error &&
      (error as { response?: { status?: number } }).response?.status === 401;

    if (isAuthError) {
      Logger.debug('[favorites/syncAll] 401 during sync - auth middleware will handle');
      return rejectWithValue('AUTH_401');
    }

    return rejectWithValue(error instanceof Error ? error.message : 'Failed to sync favorites');
  }
});

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
        ...state.recentFavorites.filter((f) => f.itemId !== action.payload.itemId),
      ].slice(0, 50);
    },

    /**
     * Optimistically remove favorite (instant UI update)
     */
    removeFavoriteOptimistic: (state, action: PayloadAction<{ itemId: string }>) => {
      state.favoriteMap[action.payload.itemId] = false;

      // Remove from recent favorites
      state.recentFavorites = state.recentFavorites.filter(
        (f) => f.itemId !== action.payload.itemId,
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
            ...state.recentFavorites.filter((f) => f.itemId !== action.payload.itemId),
          ].slice(0, 50);
        } else {
          // Remove from recent favorites
          state.recentFavorites = state.recentFavorites.filter(
            (f) => f.itemId !== action.payload.itemId,
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
      })

      // Sync all favorites
      .addCase(syncAllFavorites.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(syncAllFavorites.fulfilled, (state, action) => {
        state.isLoading = false;
        state.favoriteMap = action.payload; // Replace entire map
        state.lastSyncedAt = Date.now();
      })
      .addCase(syncAllFavorites.rejected, (state, action) => {
        state.isLoading = false;
        // AUTH_NOT_READY / AUTH_401 are expected during startup or token refresh.
        // Do NOT touch favoriteMap — keep whatever was rehydrated from MMKV.
        if (action.payload !== 'AUTH_NOT_READY' && action.payload !== 'AUTH_401') {
          state.error = action.payload ?? 'Failed to sync favorites';
        }
      });

    // ────────────────────────────────────────────────────────────────────────
    // 🔒 UX BEST PRACTICE: User switch detection (Facebook/Instagram pattern)
    // ────────────────────────────────────────────────────────────────────────
    // Only clear favorites when USER CHANGES, not on logout
    builder.addMatcher(isAuthLoginFulfilled, (state, action) => {
      const newUserId = action.payload?.user?.userId;

      if (typeof newUserId !== 'string' || newUserId === '') return;

      // User switch detected: Clear old user's favorites
      if (state.userId && state.userId !== newUserId) {
        Logger.info('[FAVORITES] User switch detected - clearing old favorites', {
          oldUserId: state.userId,
          newUserId,
        });
        state.favoriteMap = {};
        state.recentFavorites = [];
        state.lastSyncedAt = null;
        state.error = null;
      }

      // Set/update userId
      state.userId = newUserId;
    });

    // On logout: Keep favorites but clear userId (for potential re-login)
    builder.addMatcher(isAuthLogoutAction, (state) => {
      Logger.info('[FAVORITES] Logout - keeping favorites for potential re-login');
      state.userId = null;
    });
  },
});

// ============================================================================
// Actions
// ============================================================================

export const { addFavoriteOptimistic, removeFavoriteOptimistic, clearFavorites } =
  favoritesSlice.actions;

// ============================================================================
// Selectors
// ============================================================================

/** Select favorites state */
export const selectFavoritesState = (state: RootState) => state.favorites;

/** Check if item is favorited */
export const selectIsFavorite = createSelector(
  [selectFavoritesState, (_state: RootState, itemId: string) => itemId],
  (favoritesState, itemId) => favoritesState.favoriteMap[itemId] ?? false,
);

/** Select recent favorites */
export const selectRecentFavorites = createSelector(
  [selectFavoritesState],
  (favoritesState) => favoritesState.recentFavorites,
);

/** Select loading state */
export const selectFavoritesLoading = createSelector(
  [selectFavoritesState],
  (favoritesState) => favoritesState.isLoading,
);

/** Select error */
export const selectFavoritesError = createSelector(
  [selectFavoritesState],
  (favoritesState) => favoritesState.error,
);

/** Select total favorites count */
export const selectFavoritesCount = createSelector(
  [selectFavoritesState],
  (favoritesState) => Object.values(favoritesState.favoriteMap).filter(Boolean).length,
);

// ============================================================================
// Reducer Export
// ============================================================================

export default favoritesSlice.reducer;
