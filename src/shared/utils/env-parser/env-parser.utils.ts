import { readFileSync, existsSync } from "fs";
import { type EnvParseError, type EnvParseOptions, type EnvParseResult } from "./types";

/**
 * Regular expression to validate environment variable keys.
 * Keys must start with a letter or underscore, followed by alphanumeric characters or underscores.
 */
const KEY_REGEX = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

// Variable interpolation pattern: ${VAR_NAME}
const INTERPOLATION_REGEX = /\$\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;

/**
 * Creates an {@link EnvParseError} object.
 * @param lineNumber - The line number where the error occurred.
 * @param rawContent - The raw line content.
 * @param message - Human‑readable error message.
 * @param type - The type of parsing error.
 * @returns An {@link EnvParseError} instance.
 */
function createError(
  lineNumber: number,
  rawContent: string,
  message: string,
  type: EnvParseError["type"],
): EnvParseError {
  return { lineNumber, rawContent, message, type };
}

/**
 * Processes escape sequences in double-quoted strings.
 * @param value - The raw string containing escape sequences.
 * @returns The string with escape sequences interpreted.
 */
function processEscapes(value: string): string {
  let result = "";
  let i = 0;

  while (i < value.length) {
    if (value[i] === "\\" && i + 1 < value.length) {
      const next = value[i + 1];
      switch (next) {
        case "n":
          result += "\n";
          i += 2;
          break;
        case "t":
          result += "\t";
          i += 2;
          break;
        case "r":
          result += "\r";
          i += 2;
          break;
        case "\\":
          result += "\\";
          i += 2;
          break;
        case '"':
          result += '"';
          i += 2;
          break;
        default:
          // Unknown escape, keep as-is
          result += value[i];
          i += 1;
      }
    } else {
      result += value[i];
      i += 1;
    }
  }

  return result;
}

/**
 * Detects circular references during variable interpolation.
 * @param varName - The variable name being resolved.
 * @param resolutionStack - Set of variable names already in the resolution chain.
 * @returns An error message if a circular reference is found, otherwise null.
 */
function detectCircularReference(varName: string, resolutionStack: Set<string>): string | null {
  if (resolutionStack.has(varName)) {
    return `Circular reference detected: ${[...resolutionStack, varName].join(" -> ")}`;
  }
  return null;
}

/**
 * Expands variable interpolation in a value.
 * Uses a two‑pass strategy: first checks local variables, then system environment variables.
 * @param value - The string value to expand.
 * @param variables - Map of local variables defined in the .env file.
 * @param systemEnv - System environment variables.
 * @param resolutionStack - Set tracking variables already visited to detect cycles.
 * @param quiet - If true, suppresses warnings for undefined variables.
 * @returns An object containing the expanded result and optionally a circular reference error.
 */
function expandVariables(
  value: string,
  variables: Record<string, string>,
  systemEnv: Record<string, string | undefined>,
  resolutionStack: Set<string> = new Set(),
  quiet: boolean = false,
): { result: string; circularError?: string } {
  let result = value;
  let match: RegExpExecArray | null;
  const regex = new RegExp(INTERPOLATION_REGEX.source, "g");

  while ((match = regex.exec(value)) !== null) {
    const fullMatch = match[0];
    const varName = match[1];

    if (!varName) continue;

    // Check for circular reference
    const circularError = detectCircularReference(varName, resolutionStack);
    if (circularError) {
      return { result: value, circularError };
    }

    // Lookup order: local variables first, then system env
    let replacement: string;
    if (varName in variables) {
      // Recursively expand the referenced variable
      const newStack = new Set(resolutionStack);
      newStack.add(varName);
      const expanded = expandVariables(variables[varName]!, variables, systemEnv, newStack, quiet);
      if (expanded.circularError) {
        return expanded;
      }
      replacement = expanded.result;
    } else if (varName in systemEnv && systemEnv[varName] !== undefined) {
      replacement = systemEnv[varName] as string;
    } else {
      // Variable not found - leave as empty string
      if (!quiet) {
        // eslint-disable-next-line no-console
        console.warn(`[env-parser] Warning: Variable '${varName}' is not defined`);
      }
      replacement = "";
    }

    result = result.replace(fullMatch, replacement);
  }

  return { result };
}

/**
 * Parses a single line from a .env file and extracts a key‑value pair.
 * Returns `null` for comments or empty lines.
 * @param line - The raw line text.
 * @param lineNumber - The line number in the file (1‑based).
 * @param buffer - Current multiline buffer state, if any.
 * @returns An object describing the parsed result, any errors, and buffer state.
 */
function parseLine(
  line: string,
  lineNumber: number,
  buffer: { key: string; value: string; quoteChar: string; startLine: number } | null,
): {
  key?: string;
  value?: string;
  isComplete: boolean;
  buffer: { key: string; value: string; quoteChar: string; startLine: number } | null;
  error?: EnvParseError;
} {
  // If we're in multiline mode, continue accumulating
  if (buffer) {
    const closingIndex = line.indexOf(buffer.quoteChar);
    if (closingIndex !== -1) {
      // Found closing quote
      buffer.value += "\n" + line.substring(0, closingIndex);
      return { key: buffer.key, value: buffer.value, isComplete: true, buffer: null };
    } else {
      // Continue accumulating
      buffer.value += "\n" + line;
      return { isComplete: false, buffer };
    }
  }

  // Trim leading whitespace (but preserve for error reporting)
  const trimmedLine = line.trimStart();

  // Skip empty lines and full-line comments
  if (!trimmedLine || trimmedLine.startsWith("#")) {
    return { isComplete: true, buffer: null };
  }

  // Strip 'export ' prefix if present
  let workingLine = trimmedLine;
  if (workingLine.startsWith("export ")) {
    workingLine = workingLine.substring(7).trimStart();
  }

  // Find the equals sign
  const equalsIndex = workingLine.indexOf("=");
  if (equalsIndex === -1) {
    return {
      isComplete: true,
      buffer: null,
      error: createError(lineNumber, line, `Line ${lineNumber}: Missing '=' in assignment`, "MALFORMED_LINE"),
    };
  }

  // Extract key and validate
  const key = workingLine.substring(0, equalsIndex).trim();
  if (!KEY_REGEX.test(key)) {
    return {
      isComplete: true,
      buffer: null,
      error: createError(
        lineNumber,
        line,
        `Line ${lineNumber}: Invalid key '${key}'. Keys must start with a letter or underscore and contain only alphanumeric characters and underscores.`,
        "INVALID_KEY",
      ),
    };
  }

  // Extract raw value (everything after =)
  let rawValue = workingLine.substring(equalsIndex + 1);

  // Determine value type based on first character
  const firstChar = rawValue.charAt(0);

  if (firstChar === "'") {
    // Single-quoted value - raw literal
    const closingIndex = rawValue.indexOf("'", 1);
    if (closingIndex === -1) {
      // Check if it's multiline or unterminated
      return {
        isComplete: false,
        buffer: { key, value: rawValue.substring(1), quoteChar: "'", startLine: lineNumber },
      };
    }
    const value = rawValue.substring(1, closingIndex);
    return { key, value, isComplete: true, buffer: null };
  } else if (firstChar === '"') {
    // Double-quoted value - supports escapes
    // Find the closing quote, accounting for escaped quotes
    let i = 1;
    let value = "";
    let foundClosing = false;

    while (i < rawValue.length) {
      if (rawValue[i] === "\\" && i + 1 < rawValue.length) {
        // Escape sequence - keep it for later processing
        value += (rawValue[i] ?? "") + (rawValue[i + 1] ?? "");
        i += 2;
      } else if (rawValue[i] === '"') {
        foundClosing = true;
        break;
      } else {
        value += rawValue[i];
        i += 1;
      }
    }

    if (!foundClosing) {
      // Multiline double-quoted string
      return {
        isComplete: false,
        buffer: { key, value, quoteChar: '"', startLine: lineNumber },
      };
    }

    // Process escape sequences
    const processedValue = processEscapes(value);
    return { key, value: processedValue, isComplete: true, buffer: null };
  } else {
    // Unquoted value - trim whitespace and stop at comment
    rawValue = rawValue.trim();

    // Find inline comment (# not inside quotes)
    const commentIndex = rawValue.indexOf("#");
    if (commentIndex !== -1) {
      rawValue = rawValue.substring(0, commentIndex).trimEnd();
    }

    return { key, value: rawValue, isComplete: true, buffer: null };
  }
}

/**
 * Parses environment variables from a string.
 * @param content - The .env file content as a string.
 * @param options - Parsing options.
 * @returns An {@link EnvParseResult} containing parsed variables, errors, and success flag.
 * @throws {Error} If parsing fails and options.accumulate is false.
 */
export function parseEnvString(content: string, options: EnvParseOptions = {}): EnvParseResult {
  const { accumulate = false, systemEnv = process.env, quiet = false } = options;

  // Normalize line endings
  const normalizedContent = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalizedContent.split("\n");

  const variables: Record<string, string> = {};
  const errors: EnvParseError[] = [];

  let buffer: { key: string; value: string; quoteChar: string; startLine: number } | null = null;

  for (let i = 0; i < lines.length; i++) {
    const lineNumber = i + 1;
    const line = lines[i];

    const result = parseLine(line ?? "", lineNumber, buffer);

    if (result.error) {
      if (accumulate) {
        errors.push(result.error);
      } else {
        throw new Error(result.error.message);
      }
    }

    if (result.isComplete && result.key !== undefined) {
      variables[result.key] = result.value ?? "";
    }

    buffer = result.buffer;
  }

  // Check for unterminated multiline string
  if (buffer) {
    const error = createError(
      buffer.startLine,
      `Started at line ${buffer.startLine}`,
      `Unterminated ${buffer.quoteChar === '"' ? "double" : "single"}-quoted string starting at line ${buffer.startLine}`,
      "UNTERMINATED_QUOTE",
    );

    if (accumulate) {
      errors.push(error);
    } else {
      throw new Error(error.message);
    }
  }

  // Second pass: variable interpolation
  const expandedVariables: Record<string, string> = {};
  for (const [key, value] of Object.entries(variables)) {
    const { result, circularError } = expandVariables(value, variables, systemEnv, new Set([key]), quiet);

    if (circularError) {
      const error = createError(0, key, circularError, "CIRCULAR_REFERENCE");
      if (accumulate) {
        errors.push(error);
        expandedVariables[key] = value; // Keep original value on error
      } else {
        throw new Error(error.message);
      }
    } else {
      expandedVariables[key] = result;
    }
  }

  return {
    variables: expandedVariables,
    errors,
    success: errors.length === 0,
  };
}

/**
 * Parses a single .env file.
 * @param filePath - Path to the .env file.
 * @param options - Parsing options.
 * @returns An {@link EnvParseResult} with variables, errors, and success status.
 * @throws {Error} If file is missing or reading fails and options.accumulate is false.
 */
export function parseEnvFile(filePath: string, options: EnvParseOptions = {}): EnvParseResult {
  if (!existsSync(filePath)) {
    const error = createError(0, filePath, `File not found: ${filePath}`, "FILE_READ_ERROR");

    if (options.accumulate) {
      return { variables: {}, errors: [error], success: false };
    }
    throw new Error(error.message);
  }

  try {
    const content = readFileSync(filePath, "utf-8");
    return parseEnvString(content, options);
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("Line ")) {
      throw err; // Re-throw parsing errors
    }

    const error = createError(
      0,
      filePath,
      `Error reading file ${filePath}: ${err instanceof Error ? err.message : String(err)}`,
      "FILE_READ_ERROR",
    );

    if (options.accumulate) {
      return { variables: {}, errors: [error], success: false };
    }
    throw new Error(error.message);
  }
}

/**
 * Parses multiple .env files with cascading priority (later files override earlier ones).
 * @param filePaths - Array of .env file paths in order of priority, last wins.
 * @param options - Parsing options.
 * @returns Combined {@link EnvParseResult} from all files.
 * @throws {Error} If any file parsing fails and options.accumulate is false.
 */
export function parseEnvFiles(filePaths: string[], options: EnvParseOptions = {}): EnvParseResult {
  const allVariables: Record<string, string> = {};
  const allErrors: EnvParseError[] = [];

  for (const filePath of filePaths) {
    if (!existsSync(filePath)) {
      continue; // Skip non-existent files in multi-file mode
    }

    const result = parseEnvFile(filePath, { ...options, accumulate: true });

    // Merge variables (later files override)
    Object.assign(allVariables, result.variables);

    // Collect errors
    allErrors.push(...result.errors);
  }

  if (!options.accumulate && allErrors.length > 0) {
    throw new Error(allErrors[0]!.message);
  }

  return {
    variables: allVariables,
    errors: allErrors,
    success: allErrors.length === 0,
  };
}

/**
 * Loads environment variables from a .env file into `process.env`.
 * By default, existing system environment variables take precedence (they are NOT overwritten).
 * Use `{ override: true }` to force overwrite.
 * @param filePath - Path to the .env file (defaults to `.env`).
 * @param options - Parsing and loading options.
 * @throws {Error} If parsing fails and options.accumulate is false.
 */
export function loadEnvFile(filePath: string = ".env", options: EnvParseOptions = {}): void {
  const { override = false } = options;

  if (!existsSync(filePath)) {
    // Silently skip if file doesn't exist (matches dotenv behavior)
    return;
  }

  const result = parseEnvFile(filePath, options);

  for (const [key, value] of Object.entries(result.variables)) {
    // Respect immutable system env rule: don't overwrite existing vars unless override=true
    if (override || !(key in process.env)) {
      process.env[key] = value;
    }
  }
}

/**
 * Loads multiple .env files into `process.env` with cascading priority.
 * @param filePaths - Array of .env file paths.
 * @param options - Parsing and loading options.
 * @throws {Error} If any file parsing fails and options.accumulate is false.
 */
export function loadEnvFiles(filePaths: string[], options: EnvParseOptions = {}): void {
  const { override = false } = options;

  const result = parseEnvFiles(filePaths, options);

  for (const [key, value] of Object.entries(result.variables)) {
    if (override || !(key in process.env)) {
      process.env[key] = value;
    }
  }
}
