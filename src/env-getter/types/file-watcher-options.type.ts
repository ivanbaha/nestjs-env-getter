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
   * When `true`, a failed re-read of a watched file terminates the process after the
   * error events have been emitted. A failed re-read means a read error, a JSON parse
   * error, or a class-validation error. File deletion never triggers termination
   * because delete-then-recreate is a supported rotation pattern.
   * @default false
   */
  breakOnError?: boolean;
};
