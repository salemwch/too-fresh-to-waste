/**
 * Single-flight lock for logout.
 *
 * Promise-based rather than a boolean: a second logout arriving mid-flight must
 * await the first one's completion, not merely be told "already logging out"
 * and return while the session is still half torn down.
 *
 * Its own module because two things mutate it and they now live apart —
 * `logoutAsync` (thunks/session.thunks.ts) sets and clears it, and
 * `forceLocalLogout` (authSlice.ts) resets it so a failed refresh cannot leave
 * the app permanently unable to log out. A plain `let` in either file would
 * have given the other a copy, silently breaking the mutual exclusion.
 */
export const logoutLock: { current: Promise<void> | null } = { current: null };
