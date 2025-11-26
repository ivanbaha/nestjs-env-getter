/**
 * Configuration options for file watching behavior.
 */
export type FileWatcherOptions = {
  /**
   * Whether file watching is enabled.
   * @default true
   */
  enabled?: boolean;

  /**
   * Debounce delay in milliseconds before re-reading the file after a change is detected.
   * @default 350
   */
  debounceMs?: number;

  /**
   * Whether to stop the process on re-read errors.
   * If true, any error during config file re-read will terminate the process.
   * If false, errors will only emit 'error' events without stopping the process.
   * @default true
   */
  breakOnError?: boolean;
};
