import { Logger } from '@/utils/logger';

const activeAbortControllers = new Set<AbortController>();

export const createTrackedAbortController = (): AbortController => {
  const controller = new AbortController();
  activeAbortControllers.add(controller);
  return controller;
};

export const releaseTrackedAbortController = (signal?: unknown): void => {
  if (!(signal instanceof AbortSignal)) return;

  activeAbortControllers.forEach(controller => {
    if (controller.signal === signal) {
      activeAbortControllers.delete(controller);
    }
  });
};

/**
 * Aborts every tracked in-flight request.
 *
 * Called on logout and account deletion (see features/auth/store/authSlice.ts)
 * via dynamic import, so that orphaned responses cannot land after the session
 * is torn down and re-trigger auth flows.
 */
export const cancelInflightRequests = (): void => {
  if (activeAbortControllers.size === 0) return;

  Logger.info('[API-CLIENT] Cancelling all inflight requests', {
    activeRequests: activeAbortControllers.size,
  });

  activeAbortControllers.forEach(controller => {
    try {
      controller.abort();
    } catch {
      // Ignore abort errors when requests already completed.
    }
  });

  activeAbortControllers.clear();
};

/**
 * Number of requests currently tracked. Exposed for diagnostics/tests so a
 * controller leak is observable rather than silent.
 */
export const getInflightRequestCount = (): number => activeAbortControllers.size;
