/**
 * Event Bus Interface
 *
 * Abstraction layer for publish/subscribe pattern that supports:
 * - EventEmitter2 (in-memory, legacy)
 * - RabbitMQ (persistent, distributed)
 *
 * This interface enables:
 * - Zero-downtime migration from EventEmitter2 to RabbitMQ
 * - Feature flag-based rollout (per-event control)
 * - Instant rollback without code changes
 *
 * @see EventBusService for routing logic
 */
export interface IEventBus {
  /**
   * Publish an event to the event bus
   *
   * @param eventName - Event name (e.g., 'admin.user.suspended')
   * @param payload - Event payload (must be serializable to JSON)
   * @returns Promise that resolves when event is published
   */
  emit(eventName: string, payload: object): Promise<void>;
}
