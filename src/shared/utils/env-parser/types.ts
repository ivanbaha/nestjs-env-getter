/**
 * Options for parsing environment files.
 */
export interface EnvParseOptions {
  /**
   * If true, .env file values will override existing system environment variables.
   * By default (false), system env takes precedence over .env file values.
   * @default false
   */
  override?: boolean;

  /**
   * If true, collect all errors instead of throwing on first error.
   * Useful for pre-flight validation of the entire file.
   * @default false
   */
  accumulate?: boolean;

  /**
   * System environment variables to use for variable interpolation lookup.
   * Defaults to process.env.
   */
  systemEnv?: Record<string, string | undefined>;

  /**
   * If true, suppress console warnings for undefined variable references.
   * @default false
   */
  quiet?: boolean;
}

/**
 * Represents a parsing error with context information.
 */
export interface EnvParseError {
  /** Line number where the error occurred (1-indexed). */
  lineNumber: number;

  /** Raw content of the problematic line. */
  rawContent: string;

  /** Human-readable error message. */
  message: string;

  /** Error type for programmatic handling. */
  type: "UNTERMINATED_QUOTE" | "INVALID_KEY" | "MALFORMED_LINE" | "CIRCULAR_REFERENCE" | "FILE_READ_ERROR";
}

/**
 * Result of parsing environment content.
 */
export interface EnvParseResult {
  /** Parsed environment variables as key-value pairs. */
  variables: Record<string, string>;

  /** List of errors encountered during parsing (populated when accumulate=true). */
  errors: EnvParseError[];

  /** Whether parsing completed successfully (no errors). */
  success: boolean;
}
