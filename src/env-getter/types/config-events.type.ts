/**
 * Interface for a disposable subscription that can be unsubscribed.
 */
export interface Disposable {
  unsubscribe(): void;
}

/**
 * Event emitted when a configuration file is successfully updated and re-parsed.
 */
export interface ConfigUpdatedEvent {
  /** Absolute path to the config file */
  filePath: string;
  /** Timestamp when the update occurred */
  timestamp: number;
}

/**
 * Event emitted when an error occurs during config file re-parsing.
 */
export interface ConfigErrorEvent {
  /** Absolute path to the config file */
  filePath: string;
  /** The error that occurred */
  error: Error;
  /** Timestamp when the error occurred */
  timestamp: number;
}

/**
 * Event types that can be subscribed to on config instances.
 */
export type ConfigEventType = "updated" | "error";

/**
 * Utility type that adds event subscription methods to a config type.
 * These methods allow subscribing to config file update and error events.
 */
export type WithConfigEvents<T> = T & {
  /**
   * Subscribe to config file events.
   * @param event - The event type to subscribe to.
   * @param handler - The event handler function.
   * @returns A disposable object with an unsubscribe method.
   */
  on(event: "updated", handler: (event: ConfigUpdatedEvent) => void): Disposable;
  on(event: "error", handler: (event: ConfigErrorEvent) => void): Disposable;
  on(event: ConfigEventType, handler: (event: ConfigUpdatedEvent | ConfigErrorEvent) => void): Disposable;

  /**
   * Subscribe to a config file event that will only fire once.
   * @param event - The event type to subscribe to.
   * @param handler - The event handler function.
   * @returns A disposable object with an unsubscribe method.
   */
  once(event: "updated", handler: (event: ConfigUpdatedEvent) => void): Disposable;
  once(event: "error", handler: (event: ConfigErrorEvent) => void): Disposable;
  once(event: ConfigEventType, handler: (event: ConfigUpdatedEvent | ConfigErrorEvent) => void): Disposable;

  /**
   * Unsubscribe from config file events.
   * @param event - The event type to unsubscribe from.
   * @param handler - The event handler function to remove.
   */
  off(event: "updated", handler: (event: ConfigUpdatedEvent) => void): void;
  off(event: "error", handler: (event: ConfigErrorEvent) => void): void;
  off(event: ConfigEventType, handler: (event: ConfigUpdatedEvent | ConfigErrorEvent) => void): void;
};
