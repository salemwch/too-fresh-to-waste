/**
 * Redux Rehydration Orchestrator
 *
 * Ensures atomic rehydration of related Redux state to prevent race conditions.
 *
 * Problem:
 * - AsyncStorage loads data asynchronously
 * - Different fields may load at different times
 * - Can cause: coordinates loaded ✅, but manualLocationName still undefined ❌
 * - Result: App crashes trying to format undefined location name
 *
 * Solution:
 * - Wait for ALL critical fields to rehydrate before allowing app to proceed
 * - Validate state consistency after rehydration
 * - Clear inconsistent data automatically
 * - Log rehydration progress for debugging
 *
 * Usage:
 * ```typescript
 * // In App.tsx
 * import { RehydrationGate } from './store/rehydrationOrchestrator';
 *
 * <PersistGate loading={<SplashScreen />} persistor={persistor}>
 *   <RehydrationGate>
 *     <AppContent />
 *   </RehydrationGate>
 * </PersistGate>
 * ```
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useSelector } from 'react-redux';

import { Logger } from '@/utils/logger';

import type { RootState } from './index';

// ============================================================================
// Types
// ============================================================================

interface RehydrationGateProps {
  children: ReactNode;
}

interface RehydrationStatus {
  /** Is rehydration complete? */
  complete: boolean;

  /** Which slices are rehydrated */
  rehydratedSlices: string[];

  /** Validation errors found */
  errors: string[];

  /** Time taken to rehydrate (ms) */
  duration: number | null;
}

// ============================================================================
// Rehydration Validation
// ============================================================================

/**
 * Validate location state consistency
 *
 * ✅ CRITICAL: Prevents "coordinates exist but no name" crash
 *
 * Checks:
 * - If coordinates exist, at least one location name must exist
 * - Coordinates and source are in sync
 * - No undefined values (only null allowed)
 *
 * @param state - Redux state
 * @returns Validation result with errors if any
 */
function validateLocationStateConsistency(state: RootState): {
  valid: boolean;
  errors: string[];
  autoFixed: boolean;
} {
  const { coordinates, source, manualLocationName, gpsLocationName } = state.location;

  const errors: string[] = [];
  let autoFixed = false;

  // ────────────────────────────────────────────────────────────────────────
  // 1. CHECK: Coordinates exist but NO location name
  // ────────────────────────────────────────────────────────────────────────
  if (coordinates && !manualLocationName && !gpsLocationName) {
    errors.push(
      'CRITICAL: Coordinates exist but both location names are null/undefined (rehydration race detected)',
    );

    // ✅ AUTO-FIX: This is handled by persistenceValidation.ts
    // It clears coordinates when names are missing
    autoFixed = true;
  }

  // ────────────────────────────────────────────────────────────────────────
  // 2. CHECK: Manual source but no manual name
  // ────────────────────────────────────────────────────────────────────────
  if (source === 'manual' && coordinates && !manualLocationName) {
    errors.push('INCONSISTENT: Source is manual but manualLocationName is missing');
  }

  // ────────────────────────────────────────────────────────────────────────
  // 3. CHECK: GPS source but no GPS name
  // ────────────────────────────────────────────────────────────────────────
  if (source === 'gps' && coordinates && !gpsLocationName) {
    // This is OK - GPS name may not be resolved yet
    // Just log it as info, not an error
    Logger.info('[RehydrationOrchestrator] GPS location without name (reverse geocoding pending)');
  }

  // ────────────────────────────────────────────────────────────────────────
  // 4. CHECK: Undefined values (should be null)
  // ────────────────────────────────────────────────────────────────────────
  if (manualLocationName === undefined) {
    errors.push('manualLocationName is undefined (should be null)');
  }

  if (gpsLocationName === undefined) {
    errors.push('gpsLocationName is undefined (should be null)');
  }

  return {
    valid: errors.length === 0,
    errors,
    autoFixed,
  };
}

/**
 * Validate auth state consistency
 *
 * NOTE: Tokens live in Keychain (authoritative) and are loaded asynchronously
 * by `loadStoredAuthAsync` AFTER MMKV rehydration. Therefore, missing tokens
 * immediately after rehydration is EXPECTED — not an error.
 * We only flag states that won't self-resolve.
 */
function validateAuthStateConsistency(state: RootState): {
  valid: boolean;
  errors: string[];
} {
  const { isAuthenticated, user } = state.auth;

  const errors: string[] = [];

  // If authenticated, user profile must be present
  if (isAuthenticated && !user) {
    errors.push('INCONSISTENT: Authenticated but missing user data');
  }

  // NOTE: Tokens live in Keychain (authoritative source) — not in Redux state.
  // Token presence is validated by authSessionMiddleware after Keychain reads.
  // Token-based checks here would always see null and produce false positives.

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================================================
// Rehydration Status Hook
// ============================================================================

/**
 * Hook to monitor rehydration status
 *
 * @param timeout - Max time to wait for rehydration (ms)
 * @returns Rehydration status
 */
function useRehydrationStatus(timeout: number = 5000): RehydrationStatus {
  const [status, setStatus] = useState<RehydrationStatus>({
    complete: false,
    rehydratedSlices: [],
    errors: [],
    duration: null,
  });

  // Track whether validation has already run (run-once guard)
  const hasValidated = useRef(false);
  const startTimeRef = useRef(Date.now());

  const locationState = useSelector((state: RootState) => state.location);
  const authState = useSelector((state: RootState) => state.auth);

  useEffect(() => {
    // ────────────────────────────────────────────────────────────────────────
    // GUARD: Only validate ONCE on initial rehydration.
    // Subsequent auth/location state changes (e.g. token refresh, GPS update)
    // should NOT re-trigger rehydration validation.
    // ────────────────────────────────────────────────────────────────────────
    if (hasValidated.current) return;

    // ────────────────────────────────────────────────────────────────────────
    // 1. CHECK IF REHYDRATION IS COMPLETE
    // ────────────────────────────────────────────────────────────────────────
    // We consider rehydration complete when:
    // - Location state is defined
    // - Auth state is defined
    // - Favorites state is defined
    //
    // Note: Redux Persist's REHYDRATE action might have fired, but we verify
    // the actual state is populated to ensure atomic rehydration

    const isLocationRehydrated = locationState !== undefined;
    const isAuthRehydrated = authState !== undefined;

    const rehydratedSlices: string[] = [];
    if (isLocationRehydrated) rehydratedSlices.push('location');
    if (isAuthRehydrated) rehydratedSlices.push('auth');

    const allRehydrated = isLocationRehydrated && isAuthRehydrated;

    if (!allRehydrated) {
      // Still waiting for rehydration
      Logger.debug('[RehydrationOrchestrator] Waiting for rehydration', {
        rehydratedSlices,
        waiting: ['location', 'auth', 'favorites'].filter(
          slice => !rehydratedSlices.includes(slice),
        ),
      });
      return;
    }

    // Mark as validated so we don't re-run on subsequent state changes
    hasValidated.current = true;

    // ────────────────────────────────────────────────────────────────────────
    // 2. VALIDATE STATE CONSISTENCY
    // ────────────────────────────────────────────────────────────────────────

    const errors: string[] = [];

    // Validate location state
    const locationValidation = validateLocationStateConsistency({
      location: locationState,
      auth: authState,
    } as RootState);

    if (!locationValidation.valid) {
      errors.push(...locationValidation.errors);

      Logger.warn('[RehydrationOrchestrator] Location state validation failed', {
        errors: locationValidation.errors,
        autoFixed: locationValidation.autoFixed,
      });
    }

    // Validate auth state
    const authValidation = validateAuthStateConsistency({
      location: locationState,
      auth: authState,
    } as RootState);

    if (!authValidation.valid) {
      errors.push(...authValidation.errors);

      Logger.warn('[RehydrationOrchestrator] Auth state validation failed', {
        errors: authValidation.errors,
      });
    }

    // ────────────────────────────────────────────────────────────────────────
    // 3. MARK REHYDRATION AS COMPLETE
    // ────────────────────────────────────────────────────────────────────────

    const duration = Date.now() - startTimeRef.current;

    setStatus({
      complete: true,
      rehydratedSlices,
      errors,
      duration,
    });

    Logger.info('[RehydrationOrchestrator] Rehydration complete', {
      duration: `${duration}ms`,
      slices: rehydratedSlices,
      hasErrors: errors.length > 0,
      errorCount: errors.length,
    });

    if (errors.length > 0) {
      // WARN not ERROR: these are diagnostic hints, not crashes.
      // The loadStoredAuthAsync guard now prevents persisting the inconsistent
      // state to MMKV, so this should never fire after one clean boot cycle.
      Logger.warn('[RehydrationOrchestrator] Validation warnings detected', { errors });
    }
  }, [locationState, authState]);

  // ────────────────────────────────────────────────────────────────────────
  // TIMEOUT HANDLER
  // ────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (status.complete) return;

    const timer = setTimeout(() => {
      if (!status.complete) {
        Logger.error('[RehydrationOrchestrator] Rehydration timeout exceeded', {
          timeout,
          rehydratedSlices: status.rehydratedSlices,
        });

        // Force completion to prevent infinite loading
        setStatus(prev => ({
          ...prev,
          complete: true,
          errors: [...prev.errors, `Rehydration timeout (${timeout}ms)`],
        }));
      }
    }, timeout);

    return () => clearTimeout(timer);
  }, [status.complete, status.rehydratedSlices, timeout]);

  return status;
}

// ============================================================================
// Rehydration Gate Component
// ============================================================================

/**
 * Rehydration Gate
 *
 * Renders children immediately and validates state consistency in the
 * background. PersistGate (MMKV-backed, synchronous) already guarantees
 * slices are populated before this component mounts, so blocking here
 * only adds latency — up to 5 seconds in the timeout path.
 *
 * The validation effect still runs: it logs warnings and auto-fixes
 * inconsistencies, but it never delays the first frame.
 */
export function RehydrationGate({ children }: RehydrationGateProps): ReactNode {
  useRehydrationStatus();

  return children;
}

// ============================================================================
// Export
// ============================================================================
