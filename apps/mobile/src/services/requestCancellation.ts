import { Logger } from '@/utils/logger';

const activeAbortControllers = new Set<AbortController>();

export const createTrackedAbortController = (): AbortController => {
  const controller = new AbortController();
  activeAbortControllers.add(controller);
  return controller;
};

export const releaseTrackedAbortController = (signal?: unknown): void => {
  if (!(signal instanceof AbortSignal)) return;

  activeAbortControllers.forEach((controller) => {
    if (controller.signal === signal) {
      activeAbortControllers.delete(controller);
    }
  });
};

export const cancelInflightRequests = (): void => {
  if (activeAbortControllers.size === 0) return;

  Logger.info('[API-CLIENT] Cancelling all inflight requests', {
    activeRequests: activeAbortControllers.size,
  });

  activeAbortControllers.forEach((controller) => {
    try {
      controller.abort();
    } catch {
      // Ignore abort errors when requests already completed.
    }
  });

  activeAbortControllers.clear();
};
