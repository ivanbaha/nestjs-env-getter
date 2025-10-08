/**
 * Configuration options for file watching behavior
 */
export type FileWatcherOptions = {
  /**
   * Whether file watching is enabled
   * @default true
   */
  enabled?: boolean;

  /**
   * Debounce delay in milliseconds before re-reading the file after a change is detected
   * @default 500
   */
  debounceMs?: number;
};
