/**
 * useUserProfile — Centralized hook for user profile data + resolved avatar URI.
 *
 * Single source of truth for any screen needing user info.
 * Pure derivation from Redux `auth.user` — no API calls, zero latency.
 *
 * Rationale: User data is populated on login/register/verify and kept
 * in sync via `updateProfileAsync` / `updateUser`. Adding React Query
 * would create two sources of truth (Redux auth + RQ cache).
 */

import { useMemo } from 'react';

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
  /** Whether a user session exists */
  readonly isAuthenticated: boolean;
}

/**
 * Resolves a non-empty, non-whitespace string or returns null.
 */
function resolveUri(value: string | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function useUserProfile(): UseUserProfileReturn {
  const user = useAppSelector(state => state.auth.user);

  return useMemo(() => {
    if (user == null) {
      return {
        user: null,
        avatarUri: null,
        initials: 'U',
        displayName: 'User',
        isAuthenticated: false,
      };
    }

    // Resolve avatar: profileImage takes precedence over avatar
    const avatarUri = resolveUri(user.profileImage) ?? resolveUri(user.avatar) ?? null;

    // Compute initials from first + last name
    const firstInitial = user.firstName?.[0] ?? '';
    const lastInitial = user.lastName?.[0] ?? '';
    const initials = firstInitial && lastInitial
      ? `${firstInitial}${lastInitial}`.toUpperCase()
      : 'U';

    // Display name
    const displayName =
      user.firstName && user.lastName
        ? `${user.firstName} ${user.lastName}`
        : 'User';

    return {
      user,
      avatarUri,
      initials,
      displayName,
      isAuthenticated: true,
    };
  }, [user]);
}
