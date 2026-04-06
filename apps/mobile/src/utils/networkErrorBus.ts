/**
 * Network Error Event Bus
 *
 * Lightweight pub/sub for broadcasting network errors from ErrorHandler
 * to UI components (e.g., OfflineBanner in RootNavigator).
 *
 * Replaces Alert.alert() for network errors with a non-intrusive banner.
 *
 * @usage
 * // Publisher (ErrorHandler):
 * networkErrorBus.emit('Network request failed');
 *
 * // Subscriber (RootNavigator):
 * const unsub = networkErrorBus.subscribe((msg) => setMessage(msg));
 * return () => unsub();
 */

type NetworkErrorListener = (message: string) => void;

class NetworkErrorBus {
  private listeners = new Set<NetworkErrorListener>();

  /** Subscribe to network error events. Returns unsubscribe function. */
  subscribe(listener: NetworkErrorListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Emit a network error message to all subscribers */
  emit(message: string): void {
    this.listeners.forEach((listener) => {
      try {
        listener(message);
      } catch {
        // Swallow listener errors to prevent cascading failures
      }
    });
  }
}

export const networkErrorBus = new NetworkErrorBus();
