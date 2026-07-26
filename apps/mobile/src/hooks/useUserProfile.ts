/**
 * useUserProfile — display-oriented user data + resolved avatar URI.
 *
 * Hybrid ownership (see docs/plans/auth-state-ownership-audit.md):
 *
 *   display fields  ← useCurrentUser, so an edit made on another device shows
 *                     up without a relaunch
 *   isAuthenticated ← Redux, always. It is a session fact, not profile data,
 *                     and something will eventually gate on it. Deriving it
 *                     from a query would make an authorization-shaped value
 *                     depend on a fetch that can be loading, failed, or
 *                     disabled.
 *
 * useCurrentUser falls back to the Redux/Keychain user while its fetch is in
 * flight, so this hook is never empty for a signed-in user — no avatar flash,
 * no User placeholder appearing on a cold start.
 */

import { useMemo } from 'react';

import { useCurrentUser } from '@/features/auth/hooks/useCurrentUser';

import { useAppSelector } from './redux';

import type { User } from '@/features/auth/types';

interface UseUserProfileReturn {
  /** Full user object from Redux, or null if not authenticated */
  readonly user: User | null;
  /** Resolved avatar URI: profileImage > avatar > null */
  readonly avatarUri: string | null;
  /** Two-letter initials (e.g. "JD") or "U" fallback */
  readonly initials: string;
  /** "FirstName LastName" or "User" fallback */
  readonly displayName: string;
  /** Whether a user session exists. Redux-sourced — never query-derived. */
  readonly isAuthenticated: boolean;
}

/**
 * Resolves a non-empty, non-whitespace string or returns null.
 */
function resolveUri(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function useUserProfile(): UseUserProfileReturn {
  // Display data: freshest available, falling back to the restored identity.
  const { user } = useCurrentUser();
  // Session fact: Redux only.
  const isAuthenticated = useAppSelector(state => state.auth.isAuthenticated);

  return useMemo(() => {
    if (user == null) {
      return {
        user: null,
        avatarUri: null,
        initials: 'U',
        displayName: 'User',
        isAuthenticated,
      };
    }

    // Resolve avatar: profileImage takes precedence over avatar
    const avatarUri = resolveUri(user.profileImage) ?? resolveUri(user.avatar) ?? null;

    // Compute initials from first + last name
    const firstInitial = user.firstName?.[0] ?? '';
    const lastInitial = user.lastName?.[0] ?? '';
    const initials =
      firstInitial && lastInitial ? `${firstInitial}${lastInitial}`.toUpperCase() : 'U';

    // Display name
    const displayName =
      user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : 'User';

    return {
      user,
      avatarUri,
      initials,
      displayName,
      isAuthenticated,
    };
  }, [user, isAuthenticated]);
}
