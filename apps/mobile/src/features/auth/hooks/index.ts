/**
 * Auth hooks.
 *
 * `useCurrentUser` is the Phase 1 parallel read path for user data — additive,
 * with Redux still the source every existing consumer reads. See
 * docs/plans/auth-state-ownership-audit.md.
 */
export { useAuth } from './useAuth';
export { useCurrentUser } from './useCurrentUser';
export { authKeys } from '../queryKeys';
export type { CurrentUserResult } from './useCurrentUser';
