/**
 * Formats one or more validation error messages into a single summary string.
 * @param errors - The list of individual validation error messages.
 * @param scope - Optional scope name (e.g. The config class name) to include in the header.
 * @returns The formatted error message string.
 */
function formatMessage(errors: readonly string[], scope?: string): string {
  if (errors.length === 0) return "Configuration validation failed";
  if (errors.length === 1) return errors[0] as string;
  const scopePart = scope ? ` for ${scope}` : "";
  const header = `Configuration validation failed${scopePart} (${errors.length} errors):`;
  const lines = errors.map((err, index) => `  ${index + 1}. ${err}`);
  return `${header}\n${lines.join("\n")}`;
}

/**
 * Error thrown when one or more environment variable or configuration validations fail.
 * For a single error, `message` is identical to the individual validation error message.
 * For multiple errors, `message` contains a numbered summary of all recorded errors.
 */
export class EnvValidationError extends Error {
  /** All recorded validation error messages in the order they occurred. */
  readonly errors: readonly string[];

  /** Optional scope label (such as the config class name) where validation failed. */
  readonly scope?: string;

  /**
   * Creates a new `EnvValidationError` instance.
   * @param errors - One or more validation error messages.
   * @param options - Optional metadata including the validation scope and underlying error cause.
   */
  constructor(errors: readonly string[], options?: { scope?: string; cause?: unknown }) {
    if (errors.length === 0) {
      throw new RangeError("EnvValidationError requires at least one error message");
    }
    super(formatMessage(errors, options?.scope), options?.cause === undefined ? undefined : { cause: options.cause });
    this.name = "EnvValidationError";
    this.errors = errors;
    this.scope = options?.scope;
  }
}
