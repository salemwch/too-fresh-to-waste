/**
 * Auth query keys.
 *
 * Deliberately a leaf module with no imports. The cold-start sync thunk seeds
 * the ['auth','me'] cache, so it needs these keys — and importing them from
 * useCurrentUser would drag apiClient and @/hooks/redux into the thunk's module
 * graph, closing a cycle (store → authSlice → thunks → hooks/redux → store).
 */

export const authKeys = {
  all: ['auth'] as const,
  me: () => [...authKeys.all, 'me'] as const,
} as const;
