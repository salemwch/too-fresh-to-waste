/**
 * Background Storage Utility
 *
 * Production-grade storage with two modes:
 * 1. Fire-and-forget (execute): Non-critical operations that shouldn't block user flow
 * 2. Awaitable (executeAwaitable): Critical operations (login/MFA tokens) that MUST complete
 *
 * Pattern used by: Instagram, Twitter, Gmail (optimistic UI + background sync)
 *
 * Features:
 * - Fire-and-forget OR awaitable execution
 * - Automatic retry with exponential backoff
 * - Error logging without user interruption
 * - Queue management for reliability
 */

import { Logger } from './logger';

interface StorageOperation {
  id: string;
  operation: () => Promise<void>;
  retries: number;
  maxRetries: number;
  resolve?: () => void;
  reject?: (error: Error) => void;
}

class BackgroundStorageManager {
  private queue: StorageOperation[] = [];
  private processing = false;
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY_MS = 1000;

  /**
   * Execute storage operation in background with automatic retry
   * Does NOT throw errors - all failures are logged only
   *
   * PRODUCTION: Use this for non-critical operations (analytics, telemetry)
   * For critical operations (auth tokens), use executeAwaitable()
   *
   * @param id - Unique identifier for this operation (for logging)
   * @param operation - Async storage operation to execute
   *
   * @example
   * // Fire-and-forget: function returns immediately
   * backgroundStorage.execute('save-analytics', async () => {
   *   await Analytics.track('user_action');
   * });
   */
  public execute(id: string, operation: () => Promise<void>): void {
    const storageOp: StorageOperation = {
      id,
      operation,
      retries: 0,
      maxRetries: this.MAX_RETRIES,
    };

    this.queue.push(storageOp);

    // Start processing queue if not already running
    if (!this.processing) {
      void this.processQueue();
    }

    Logger.debug(`[BackgroundStorage] Queued fire-and-forget: ${id}`);
  }

  /**
   * Execute storage operation and return a Promise
   * THROWS errors - caller must handle failures
   *
   * PRODUCTION: Use this for CRITICAL operations (auth tokens on login/MFA)
   * Ensures operation completes before proceeding
   *
   * @param id - Unique identifier for this operation (for logging)
   * @param operation - Async storage operation to execute
   * @returns Promise that resolves when operation succeeds or rejects after max retries
   *
   * @example
   * // Awaitable: wait for completion
   * await backgroundStorage.executeAwaitable('save-auth-tokens', async () => {
   *   await SecureStorage.setTokens(accessToken, refreshToken);
   * });
   * // Tokens are guaranteed to be persisted before continuing
   */
  public executeAwaitable(id: string, operation: () => Promise<void>): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const storageOp: StorageOperation = {
        id,
        operation,
        retries: 0,
        maxRetries: this.MAX_RETRIES,
        resolve,
        reject,
      };

      this.queue.push(storageOp);

      // Start processing queue if not already running
      if (!this.processing) {
        void this.processQueue();
      }

      Logger.debug(`[BackgroundStorage] Queued awaitable: ${id}`);
    });
  }

  /**
   * Process queued storage operations with retry logic
   * Runs asynchronously - doesn't block caller (unless using executeAwaitable)
   */
  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      const operation = this.queue[0];

      if (!operation) {
        this.queue.shift();
        continue;
      }

      try {
        Logger.debug(
          `[BackgroundStorage] Executing: ${operation.id} (attempt ${operation.retries + 1}/${operation.maxRetries + 1})`,
        );

        await operation.operation();

        Logger.info(`[BackgroundStorage] Success: ${operation.id}`);

        // Resolve promise if awaitable
        if (operation.resolve) {
          operation.resolve();
        }

        // Remove from queue on success
        this.queue.shift();
      } catch (error) {
        operation.retries++;

        if (operation.retries > operation.maxRetries) {
          // Max retries exceeded - log error and remove from queue
          Logger.error(
            `[BackgroundStorage] Failed after ${operation.retries} attempts: ${operation.id}`,
            {},
            error as Error,
          );

          // Reject promise if awaitable
          if (operation.reject) {
            operation.reject(error as Error);
          }

          this.queue.shift();
        } else {
          // Retry with exponential backoff
          const delayMs = this.RETRY_DELAY_MS * Math.pow(2, operation.retries - 1);

          Logger.warn(
            `[BackgroundStorage] Retry scheduled in ${delayMs}ms: ${operation.id}`,
            { attempt: operation.retries, maxRetries: operation.maxRetries },
            error as Error,
          );

          // Move to end of queue and wait before retry
          this.queue.shift();
          await this.delay(delayMs);
          this.queue.push(operation);
        }
      }
    }

    this.processing = false;
  }

  /**
   * Delay helper for retry backoff
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current queue size (for debugging/monitoring)
   */
  public getQueueSize(): number {
    return this.queue.length;
  }

  /**
   * Clear all pending operations (use with caution - typically only for logout)
   */
  public clearQueue(): void {
    Logger.warn('[BackgroundStorage] Queue cleared', { itemsCleared: this.queue.length });

    // Reject all awaitable operations
    for (const operation of this.queue) {
      if (operation.reject) {
        operation.reject(new Error('Queue cleared'));
      }
    }

    this.queue = [];
  }
}

// Export singleton instance
export const backgroundStorage = new BackgroundStorageManager();
