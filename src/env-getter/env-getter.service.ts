import { EventEmitter } from "events";
import { existsSync, readFileSync, watch } from "fs";
import { join, isAbsolute, resolve, sep, dirname, basename } from "path";

import { Injectable, OnModuleDestroy, Optional, Inject, Logger } from "@nestjs/common";

import {
  type ClassConstructor,
  EnvValidationError,
  isTimePeriod,
  parseTimePeriod,
  TimeMarker,
  isValidCronExpression,
  CronSchedule,
} from "../shared";
import { loadEnvFromOptions } from "./load-env-from-options";
import {
  type ArrayValidatorType,
  type ConfigErrorEvent,
  type ConfigUpdatedEvent,
  type Disposable,
  type EnvGetterModuleOptions,
  type FileWatcherOptions,
  type ListOptions,
  type WithConfigEvents,
  ENV_GETTER_OPTIONS,
} from "./types";

type ArrayGetterName = "getRequiredArray" | "getOptionalArray";

/**
 * Checks whether a value is a Promise-like object (thenable).
 * @param value - The value to inspect.
 * @returns `true` if `value` has a callable `then` method.
 */
function isThenable(value: unknown): boolean {
  return (
    value !== null &&
    (typeof value === "object" || typeof value === "function") &&
    typeof (value as { then?: unknown }).then === "function"
  );
}

@Injectable()
export class EnvGetterService implements OnModuleDestroy {
  /**
   * Checks if a key is considered unsafe for object assignment
   * (prototype pollution risks).
   * @param key - The key to check.
   * @returns True if the key is unsafe, false otherwise.
   */
  private isUnsafeKey(key: string): boolean {
    return key === "__proto__" || key === "constructor" || key === "prototype";
  }

  /**
   * Creates a safe copy of an object, filtering out unsafe keys
   * to prevent prototype pollution.
   * @param source - The source object to copy.
   * @returns A safe copy of the object without unsafe keys.
   */
  private safeObjectCopy(source: Record<string, unknown>): Record<string, unknown> {
    const copy: Record<string, unknown> = Object.create(null);
    for (const key of Object.keys(source)) {
      if (!this.isUnsafeKey(key)) {
        copy[key] = source[key];
      }
    }
    return copy;
  }

  /**
   * Recursively removes unsafe keys (`__proto__`, `constructor`, `prototype`)
   * from an object and all nested objects/arrays to prevent prototype pollution.
   * @param value - The value to sanitize.
   * @returns The sanitized value.
   */
  private deepSanitize<T>(value: T): T {
    if (Array.isArray(value)) {
      return value.map((item) => this.deepSanitize(item)) as T;
    }
    if (value !== null && typeof value === "object") {
      const sanitized: Record<string, unknown> = Object.create(null);
      for (const key of Object.keys(value)) {
        if (!this.isUnsafeKey(key)) {
          sanitized[key] = this.deepSanitize((value as Record<string, unknown>)[key]);
        }
      }
      return sanitized as T;
    }
    return value;
  }

  private readonly configsStorage: Record<string, unknown> = Object.create(null);
  private readonly fileWatchers = new Map<string, ReturnType<typeof watch>>();
  private readonly pendingWatchers = new Map<string, ReturnType<typeof watch>>();
  private readonly logger = new Logger(EnvGetterService.name);
  private readonly source: Record<string, string | undefined>;
  private collector: string[] | null = null;
  private collectorCause: unknown = undefined;
  private guardDepth = 0;

  /**
   * Event emitter for config file change events.
   * Emits per-file `'updated:<filePath>'` (`ConfigUpdatedEvent`) and `'error:<filePath>'` (`ConfigErrorEvent`)
   * events, as well as global `'updated'` (`ConfigUpdatedEvent`) and `'error'` (`ConfigErrorEvent`) events
   * across all watched config files.
   */
  readonly events: EventEmitter = new EventEmitter();

  /**
   * Creates a new `EnvGetterService` instance.
   * @param options - Optional module configuration options.
   */
  constructor(@Optional() @Inject(ENV_GETTER_OPTIONS) private readonly options?: EnvGetterModuleOptions) {
    this.events.setMaxListeners(0);
    this.source = options?.env ?? process.env;
    loadEnvFromOptions(options);
  }

  /**
   * Lifecycle hook called when the module is being destroyed.
   * Cleans up all file watchers and event listeners.
   */
  onModuleDestroy() {
    this.fileWatchers.forEach((watcher) => watcher.close());
    this.fileWatchers.clear();
    this.pendingWatchers.forEach((watcher) => watcher.close());
    this.pendingWatchers.clear();
    this.events.removeAllListeners();
  }

  /**
   * Runs a synchronous callback while collecting all validation errors from public getters.
   * When one or more getters fail, throws a single `EnvValidationError` containing all recorded messages.
   * Note: values returned by failing getters inside `build` are `undefined` placeholders; the scope always throws at the end.
   * @template T - The return type of the callback.
   * @param build - Synchronous callback that invokes one or more getters.
   * @param scope - Optional scope name (e.g. Config class name) included in multi-error messages.
   * @returns The value returned by `build` when no validation errors occurred.
   * @throws {EnvValidationError} If one or more getters failed validation during `build`.
   * @throws {TypeError} If `build` returns a Promise/thenable.
   */
  collectErrors<T>(build: () => T, scope?: string): T {
    const isOutermost = this.collector === null;
    if (isOutermost) {
      this.collector = [];
      this.collectorCause = undefined;
    }

    try {
      let result: T;
      try {
        result = build();
      } catch (err: unknown) {
        if (!isOutermost) {
          if ((this.collector?.length ?? 0) > 0) {
            if (this.collectorCause === undefined) {
              this.collectorCause = err;
            }
            return undefined as unknown as T;
          }
          throw err;
        }

        const recorded = this.collector ?? [];
        if (recorded.length > 0) {
          const cause = this.collectorCause !== undefined ? this.collectorCause : err;
          throw new EnvValidationError(recorded, { scope, cause });
        }
        throw err;
      }

      if (isThenable(result)) {
        throw new TypeError("collectErrors() callback must be synchronous");
      }

      if (isOutermost) {
        const recorded = this.collector ?? [];
        if (recorded.length > 0) {
          throw new EnvValidationError(
            recorded,
            this.collectorCause !== undefined ? { scope, cause: this.collectorCause } : { scope },
          );
        }
      }

      return result;
    } finally {
      if (isOutermost) {
        this.collector = null;
        this.collectorCause = undefined;
        this.guardDepth = 0;
      }
    }
  }

  /**
   * Checks whether an environment variable is set.
   *
   * Note: this is a pure existence check — a variable set to an empty string (`KEY=`)
   * counts as set here, while the `getRequired*` getters treat it as missing.
   * @param envName - The name of the environment variable.
   * @returns `true` if the environment variable exists, otherwise `false`.
   */
  isEnvSet(envName: string): boolean {
    return Object.prototype.hasOwnProperty.call(this.source, envName);
  }

  /**
   * Retrieves the value of a required environment variable.
   * - Ensures that the variable exists; otherwise, throws an error.
   * - If `allowedValues` is provided, checks whether the variable contains an allowed value.
   * @param envName - The name of the required environment variable.
   * @param allowedValues - (Optional) A list of allowed values for validation.
   *   **Warning:** a disallowed received value is echoed in the error message —
   *   do not use `allowedValues` with secret variables.
   * @returns The environment variable value as a string (or narrowed literal union when `allowedValues` is provided).
   * @throws {EnvValidationError} If the variable is missing or contains an invalid value.
   */
  getRequiredEnv(envName: string): string;
  getRequiredEnv<T extends string>(envName: string, allowedValues: readonly T[]): T;
  getRequiredEnv(envName: string, allowedValues?: readonly string[]): string {
    return this.guard(() => {
      this.checkEnvExisting(envName);

      const envVal = this.source[envName] as string;
      if (allowedValues?.length) this.checkIfEnvHasAllowedValue(envName, envVal, allowedValues);

      return envVal;
    });
  }

  /**
   * Retrieves the value of an optional environment variable.
   * - If the variable is set to a non-empty value, returns its value.
   * - Unset or empty (`KEY=`) is treated as not set: returns `defaultValue` (or `undefined`).
   * - If `allowedValues` is provided, validates the effective value (env value or default);
   *   nothing is validated when the variable is unset/empty and no default is given.
   * @param envName - The name of the environment variable.
   * @param defaultValue - (Optional) The default value to return if the environment variable is not set.
   * @param allowedValues - (Optional) An array of allowed values for validation.
   *   **Warning:** a disallowed received value is echoed in the error message —
   *   do not use `allowedValues` with secret variables.
   * @returns The environment variable value, the default value, or `undefined` if not set.
   * @throws {EnvValidationError} If the effective value is not in `allowedValues` (if provided).
   */
  getOptionalEnv(envName: string): string | undefined;
  getOptionalEnv(envName: string, defaultValue: string): string;
  getOptionalEnv<T extends string>(envName: string, allowedValues: readonly T[]): T | undefined;
  getOptionalEnv<T extends string>(envName: string, defaultValue: T, allowedValues: readonly T[]): T;
  getOptionalEnv(
    envName: string,
    defaultValueOrAllowedValues?: string | readonly string[],
    allowedValues?: readonly string[],
  ): string | undefined {
    return this.guard(() => {
      if (Array.isArray(defaultValueOrAllowedValues)) {
        // (name, allowedValues) overload — only validate when a non-empty value is present
        const envValue = this.source[envName] || undefined;
        if (envValue !== undefined) {
          this.checkIfEnvHasAllowedValue(envName, envValue, defaultValueOrAllowedValues);
        }
        return envValue;
      } else {
        // (name, default?, allowedValues?) overload — M9: treat empty as unset
        const envValue = (this.source[envName] || undefined) ?? (defaultValueOrAllowedValues as string | undefined);

        if (allowedValues?.length && envValue !== undefined) {
          this.checkIfEnvHasAllowedValue(envName, envValue, allowedValues);
        }

        return envValue;
      }
    });
  }

  /**
   * Retrieves and validates a required numeric environment variable.
   * - Accepts integers only (no decimals, no scientific notation).
   * - Underscores may be used as digit separators (e.g. `1_000`), but only between digit groups.
   * - Throws an error if the value is not a valid integer or exceeds the safe integer range.
   * @param envName - The name of the environment variable.
   * @returns The integer value of the environment variable.
   * @throws {EnvValidationError} If the variable is missing, not a valid integer, or exceeds safe integer range.
   */
  getRequiredNumericEnv(envName: string): number {
    return this.guard(() => {
      const envVal = this.getRequiredEnv(envName);

      if (!/^\d+(?:_\d+)*$/.test(envVal)) this.fail(`Variable '${envName}' is not of number type.`);

      const n = Number(envVal.replace(/_/g, ""));
      if (!Number.isSafeInteger(n)) this.fail(`Variable '${envName}' exceeds the safe integer range.`);

      return n;
    });
  }

  /**
   * Retrieves an optional numeric environment variable.
   * - Accepts integers only (no decimals, no scientific notation).
   * - Absent or empty → returns default; present-but-invalid → throws.
   * - Underscores may be used as digit separators (e.g. `1_000`), but only between digit groups.
   * @param envName - The name of the environment variable.
   * @param defaultValue - (Optional) The default numeric value to return if the variable is not set.
   * @returns The integer value of the environment variable or the default value.
   * @throws {EnvValidationError} If the variable is set but not a valid integer or exceeds safe integer range.
   */
  getOptionalNumericEnv(envName: string): number | undefined;
  getOptionalNumericEnv(envName: string, defaultValue: number): number;
  getOptionalNumericEnv(envName: string, defaultValue?: number): number | undefined {
    return this.guard(() => {
      const rawVal = this.source[envName];

      if (rawVal === undefined || rawVal === "") return defaultValue;

      if (!/^\d+(?:_\d+)*$/.test(rawVal)) this.fail(`Variable '${envName}' is not of number type.`);

      const n = Number(rawVal.replace(/_/g, ""));
      if (!Number.isSafeInteger(n)) this.fail(`Variable '${envName}' exceeds the safe integer range.`);

      return n;
    });
  }

  /**
   * Retrieves and validates a required boolean environment variable.
   * - Ensures the variable is set and contains either `"true"` or `"false"`.
   * - Converts the value to a boolean.
   * - Throws an error if the value is not a valid boolean.
   * @param envName - The name of the environment variable.
   * @returns The boolean value of the environment variable.
   * @throws {EnvValidationError} If the variable is missing or not `"true"`/`"false"`.
   */
  getRequiredBooleanEnv(envName: string): boolean {
    return this.guard(() => {
      const envVal = this.getRequiredEnv(envName);

      if (!/^(true|false)$/.test(envVal)) this.fail(`Variable '${envName}' is not of boolean type.`);

      return envVal === "true";
    });
  }

  /**
   * Retrieves an optional boolean environment variable.
   * - If the variable is set, returns `true` for `"true"` and `false` for `"false"`.
   * - If `defaultValue` is provided and the variable is not set, returns the default value.
   * @param envName - The name of the environment variable.
   * @param defaultValue - (Optional) The default boolean value if the variable is not set.
   * @returns The boolean value of the environment variable or the default value.
   * @throws {EnvValidationError} If the variable is set to anything other than `"true"` or `"false"`.
   */
  getOptionalBooleanEnv(envName: string): boolean | undefined;
  getOptionalBooleanEnv(envName: string, defaultValue: boolean): boolean;
  getOptionalBooleanEnv(envName: string, defaultValue?: boolean): boolean | undefined {
    return this.guard(() => {
      const raw = this.source[envName];
      if (raw === undefined || raw === "") return defaultValue;
      if (raw !== "true" && raw !== "false")
        this.fail(`Variable '${envName}' is not of boolean type. Expected 'true' or 'false', received '${raw}'.`);
      return raw === "true";
    });
  }

  /**
   * Retrieves and validates a required environment variable as a URL.
   * - Ensures the variable is set and contains a valid URL.
   * - Throws an error if the value is not a valid URL.
   * @param envName - The name of the environment variable.
   * @returns A `URL` object representing the value of the environment variable.
   * @throws {EnvValidationError} If the variable is missing or not a valid URL.
   */
  getRequiredURL(envName: string): URL {
    return this.guard(() => {
      const envVal = this.getRequiredEnv(envName);

      try {
        return new URL(envVal);
      } catch (err: unknown) {
        this.fail(`Variable '${envName}' must be a valid URL. Error: ${this.getErrorMessage(err)}`);
      }
    });
  }

  /**
   * Retrieves an optional environment variable as a URL.
   * - If the variable is set and a valid URL, returns a `URL` object.
   * - If `defaultValue` is provided and the variable is not set, returns the default `URL`.
   * - Throws an error if the variable is set but not a valid URL.
   * @param envName - The name of the environment variable.
   * @param defaultValue - (Optional) The default URL value to return if the variable is not set.
   * @returns A `URL` object representing the value of the environment variable or the default value.
   * @throws {EnvValidationError} If the variable is set but not a valid URL.
   */
  getOptionalURL(envName: string): URL | undefined;
  getOptionalURL(envName: string, defaultValue: URL): URL;
  getOptionalURL(envName: string, defaultValue?: URL): URL | undefined {
    return this.guard(() => {
      const envVal = this.getOptionalEnv(envName);

      try {
        return envVal ? new URL(envVal) : defaultValue;
      } catch (err: unknown) {
        this.fail(`Variable '${envName}' must be a valid URL. Error: ${this.getErrorMessage(err)}`);
      }
    });
  }

  /**
   * Retrieves and parses a required time period from an environment variable.
   * - Ensures the environment variable is set and retrieves its value.
   * - Validates that the value follows the format: `<number><"ms"|"s"|"m"|"h"|"d">`.
   * - Converts the value to the specified time format.
   * - Note: results are rounded **up** to the nearest integer (`Math.ceil`): `1500ms` → `2` seconds.
   * - Throws an error if the value is missing or invalid.
   * @param envName - The name of the required environment variable.
   * @param resultIn - The desired time unit for the result (default is `"ms"`).
   * @returns The parsed time period converted to the specified unit.
   * @throws {EnvValidationError} If the environment variable is missing or has an invalid format.
   */
  getRequiredTimePeriod(envName: string, resultIn: TimeMarker = "ms") {
    return this.guard(() => {
      const envVal = this.getRequiredEnv(envName);

      // validating the ENV value
      if (!isTimePeriod(envVal))
        this.fail(
          `Variable '${envName}' is not in the acceptable format. It must be: <number><"ms"|"s"|"m"|"h"|"d">. Ex.: '12h', '2d', '2D', '2 d'`,
        );

      return parseTimePeriod(envVal, resultIn);
    });
  }

  /**
   * Retrieves and parses an optional time period from an environment variable.
   *
   * Overloads:
   * - `(name)` — returns `undefined` if unset/empty.
   * - `(name, resultIn)` — returns `undefined` if unset/empty, result in given unit.
   * - `(name, defaultValue, resultIn?)` — falls back to default if unset/empty.
   *
   * - Validates the format: `<number><"ms"|"s"|"m"|"h"|"d">`. Ex.: `'12h'`, `'2d'`, `'30s'`.
   * - Also accepts a raw number default (treated as milliseconds).
   * - Throws if the env value is set but invalid, or if the default is invalid.
   * - Note: `Math.ceil` is applied to the result (e.g. `1500ms` → `2s`).
   * @param envName - The name of the environment variable.
   * @param defaultValueOrResultIn - Either the result unit (`TimeMarker`) or a fallback default value.
   * @param resultIn - The desired time unit for the result (default is `"ms"`).
   * @returns The parsed time period converted to the specified unit, or `undefined` when unset without default.
   * @throws {EnvValidationError} If the environment variable or default value is invalid.
   */
  getOptionalTimePeriod(envName: string): number | undefined;
  getOptionalTimePeriod(envName: string, resultIn: TimeMarker): number | undefined;
  getOptionalTimePeriod(envName: string, defaultValue: string | number, resultIn?: TimeMarker): number;
  getOptionalTimePeriod(
    envName: string,
    defaultValueOrResultIn?: string | number | TimeMarker,
    resultIn?: TimeMarker,
  ): number | undefined {
    return this.guard(() => {
      const TIME_MARKERS: TimeMarker[] = ["ms", "s", "m", "h", "d"];
      const baseErrorMessage = `'${envName}' is not in the acceptable format. It must be: <number><"ms"|"s"|"m"|"h"|"d">. Ex.: '12h', '2d', '2D', '2 d'`;

      // Disambiguate arg 2: bare TimeMarker with no arg 3 → resultIn, otherwise → defaultValue
      let defaultValue: string | number | undefined;
      let resolvedResultIn: TimeMarker;

      if (
        typeof defaultValueOrResultIn === "string" &&
        TIME_MARKERS.includes(defaultValueOrResultIn as TimeMarker) &&
        resultIn === undefined
      ) {
        // (name, resultIn) overload
        defaultValue = undefined;
        resolvedResultIn = defaultValueOrResultIn as TimeMarker;
      } else {
        defaultValue = defaultValueOrResultIn as string | number | undefined;
        resolvedResultIn = resultIn ?? "ms";
      }

      if (defaultValue !== undefined && !isTimePeriod(defaultValue))
        this.fail(`The default value for the environment variable ${baseErrorMessage}`);

      const envVal = this.source[envName];

      // Absent or empty → return default or undefined (M9)
      if (envVal === undefined || envVal === "") {
        return defaultValue !== undefined ? parseTimePeriod(defaultValue, resolvedResultIn) : undefined;
      }

      // Present but invalid → throw
      if (!isTimePeriod(envVal)) this.fail(`Variable ${baseErrorMessage}`);

      return parseTimePeriod(envVal, resolvedResultIn);
    });
  }

  /**
   * Retrieves and parses a required environment variable as a cron schedule.
   * - Ensures the environment variable is set.
   * - Validates that the value is a valid cron expression (5 or 6 fields).
   * - Returns a CronSchedule instance with utility methods.
   * - Throws an error if the variable is missing or invalid.
   * @param envName - The name of the required environment variable.
   * @returns A CronSchedule instance wrapping the validated cron expression.
   * @throws {EnvValidationError} If the variable is missing or not a valid cron expression.
   * @example
   * // 5-field format: minute hour day-of-month month day-of-week
   * const schedule = this.envGetter.getRequiredCron('BACKUP_SCHEDULE');
   * // ENV: '0 2 * * *' (runs at 2:00 AM daily)
   * console.log(schedule.getNextTime()); // Next execution time
   * console.log(schedule.isMatching(new Date())); // Check if current time matches
   * console.log(schedule.toString()); // '0 2 * * *'
   *
   * // 6-field format: second minute hour day-of-month month day-of-week
   * // ENV: '0 30 9 * * MON-FRI' (runs at 9:30:00 AM on weekdays)
   */
  getRequiredCron(envName: string): CronSchedule {
    return this.guard(() => {
      const envVal = this.getRequiredEnv(envName);

      if (!isValidCronExpression(envVal)) {
        return this.fail(
          `Variable '${envName}' is not a valid cron expression. Expected 5 or 6 fields: [second] minute hour day-of-month month day-of-week`,
        );
      }

      return new CronSchedule(envVal);
    });
  }

  /**
   * Retrieves and parses an optional environment variable as a cron schedule.
   * - If `defaultValue` is provided, validates it on every call (even when the variable is set).
   * - If the variable is not set or empty, returns a `CronSchedule` for `defaultValue` (or `undefined` when omitted).
   * - If the variable is set, validates that it is a valid cron expression.
   * - Throws an error if the variable or `defaultValue` is not a valid cron expression.
   * @param envName - The name of the environment variable.
   * @param defaultValue - (Optional) Default cron expression string used when the variable is unset or empty.
   * @returns A CronSchedule instance if the variable or default is present and valid, `undefined` otherwise.
   * @throws {EnvValidationError} If the variable or `defaultValue` is not a valid cron expression.
   * @example
   * // Optional cron without default - returns undefined if not set
   * const schedule = this.envGetter.getOptionalCron('CLEANUP_SCHEDULE');
   * if (schedule) {
   *   console.log('Next cleanup at:', schedule.getNextTime());
   * }
   *
   * // Optional cron with default
   * const scheduleWithDefault = this.envGetter.getOptionalCron('CLEANUP_SCHEDULE', '0 3 * * *');
   */
  getOptionalCron(envName: string): CronSchedule | undefined;
  getOptionalCron(envName: string, defaultValue: string): CronSchedule;
  getOptionalCron(envName: string, defaultValue?: string): CronSchedule | undefined {
    return this.guard(() => {
      const expectedMsg =
        "is not a valid cron expression. Expected 5 or 6 fields: [second] minute hour day-of-month month day-of-week";

      if (defaultValue !== undefined && !isValidCronExpression(defaultValue)) {
        return this.fail(`The default value for the environment variable '${envName}' ${expectedMsg}`);
      }

      const envVal = this.source[envName];

      // Absent or empty → default or undefined (M9)
      if (envVal === undefined || envVal === "") {
        return defaultValue !== undefined ? new CronSchedule(defaultValue) : undefined;
      }

      // Set but invalid → throw
      if (!isValidCronExpression(envVal)) {
        return this.fail(`Variable '${envName}' ${expectedMsg}`);
      }

      return new CronSchedule(envVal);
    });
  }

  /**
   * Retrieves and parses a required environment variable as an object.
   * - Ensures the environment variable is set.
   * - Parses the value from a JSON string into an object.
   * - Optionally validates and instantiates the object using a provided class.
   * - Throws an error if parsing fails or if instantiation using the class fails.
   * @template R - The expected type of the parsed object.
   * @template C - The class constructor type (if provided).
   * @param envName - The name of the environment variable.
   * @param cls - (Optional) A class constructor to validate and instantiate the parsed object.
   * @returns The parsed object, optionally instantiated as an instance of `cls`.
   * @throws {EnvValidationError} If the environment variable is missing, cannot be parsed, or fails validation.
   * @example
   * // Define a class for validation
   * class Config {
   *   apiKey: string;
   *   timeout: number;
   *
   *   constructor(data: { apiKey: string; timeout: number }) {
   *     if (!data.apiKey) throw new Error("apiKey is required");
   *     if (typeof data.timeout !== "number") throw new Error("timeout must be a number");
   *     this.apiKey = data.apiKey;
   *     this.timeout = data.timeout;
   *   }
   * }
   *
   * // Set the environment variable (e.g., process.env.CONFIG = '{"apiKey": "123", "timeout": 5000"}')
   * const config = getRequiredObject<Config>("CONFIG", Config);
   * console.log(config.apiKey); // "123"
   * console.log(config.timeout); // 5000
   */
  getRequiredObject<R = unknown, C extends ClassConstructor<unknown> | undefined = undefined>(
    envName: string,
    cls?: C,
  ): C extends ClassConstructor<infer T> ? T : R {
    return this.guard(() => {
      const envVal = this.getRequiredEnv(envName);
      return this.parseObjectFromEnvValue<R, C>(envName, envVal, cls);
    });
  }

  /**
   * Retrieves and parses an optional environment variable as an object from a JSON string.
   * - If the variable is unset or empty (`""`), returns `defaultValue` (or `new cls(defaultValue)` when `cls` is given),
   *   or `undefined` when no default is given.
   * - If `defaultValue` is validated with `cls` and fails, throws an `EnvValidationError`.
   * - If the variable is set, parses and validates it identically to `getRequiredObject`.
   * - Note: `defaultValue` must be plain data; a function-typed second argument is treated as `cls`.
   * @template R - The expected type of the parsed object.
   * @template C - The class constructor type (if provided).
   * @param envName - The name of the environment variable.
   * @param defaultValueOrCls - (Optional) Either the plain-data default object or a class constructor.
   * @param cls - (Optional) A class constructor to validate and instantiate the object.
   * @returns The parsed object, default object, or `undefined` when unset without a default.
   * @throws {EnvValidationError} If the set value cannot be parsed or fails validation, or if `defaultValue` fails class validation.
   */
  getOptionalObject<R = unknown>(envName: string): R | undefined;
  getOptionalObject<C extends ClassConstructor<unknown>>(envName: string, cls: C): InstanceType<C> | undefined;
  getOptionalObject<R>(envName: string, defaultValue: R): R;
  getOptionalObject<R, C extends ClassConstructor<unknown>>(envName: string, defaultValue: R, cls: C): InstanceType<C>;
  getOptionalObject<R = unknown, C extends ClassConstructor<unknown> | undefined = undefined>(
    envName: string,
    defaultValueOrCls?: R | C,
    cls?: C,
  ): (C extends ClassConstructor<infer T> ? T : R) | undefined {
    return this.guard(() => {
      let resolvedDefault: R | undefined;
      let resolvedCls: C | undefined;

      if (typeof defaultValueOrCls === "function") {
        resolvedDefault = undefined;
        resolvedCls = defaultValueOrCls as C;
      } else {
        resolvedDefault = defaultValueOrCls as R | undefined;
        resolvedCls = cls;
      }

      const rawVal = this.source[envName];
      if (rawVal === undefined || rawVal === "") {
        if (resolvedDefault === undefined) {
          return undefined;
        }
        if (resolvedCls) {
          try {
            return new resolvedCls(resolvedDefault) as C extends ClassConstructor<infer T> ? T : R;
          } catch (error: unknown) {
            return this.fail(`The default value for '${envName}' failed validation: ${this.getErrorMessage(error)}`);
          }
        }
        return resolvedDefault as C extends ClassConstructor<infer T> ? T : R;
      }

      return this.parseObjectFromEnvValue<R, C>(envName, rawVal, resolvedCls);
    });
  }

  /**
   * Retrieves and parses a required environment variable as a JSON array.
   * @template R - The expected type of array elements (or tuple type).
   * @param envName - The name of the environment variable to retrieve.
   * @param validate - (Optional) A function to validate each array element.
   * @returns The parsed array.
   * @throws {EnvValidationError} If the environment variable is missing, cannot be parsed, is not an array, or fails validation.
   * @example
   * this.forwardHeaders = this.envService.getRequiredArray<string>('FORWARD_HEADERS');
   * @example
   * this.forwardHeaders = this.envService.getRequiredArray<string>(
   *    'FORWARD_HEADERS',
   *    (el) => typeof el === 'string'
   * );
   * @example
   * this.forwardHeaders = this.envService.getRequiredArray<[string, number]>(
   *    'FORWARD_HEADERS',
   *    (el, i, arr) => {
   *      if (arr?.length !== 2) return 'FORWARD_HEADERS must be an array of 2 valid items';
   *      if (i === 0 && typeof el === 'string') return true;
   *      if (i === 1 && typeof el === 'number') return true;
   *      return false;
   *    }
   * );
   */
  getRequiredArray<R = unknown>(envName: string, validate?: ArrayValidatorType<R>): R extends unknown[] ? R : R[] {
    return this.guard(() => {
      const envVal = this.getRequiredEnv(envName);
      return this.parseArrayFromEnvValue<R>(envName, envVal, validate, "getRequiredArray");
    });
  }

  /**
   * Retrieves and parses an optional environment variable as a JSON array.
   * - If the variable is unset or empty (`""`), returns `defaultValue` (validated with `validate` if provided)
   *   or `undefined` when no default is given.
   * - If the variable is set, parses and validates it identically to `getRequiredArray`.
   * @template R - The expected type of array elements (or tuple type).
   * @param envName - The name of the environment variable to retrieve.
   * @param defaultValueOrValidate - (Optional) Either the default array or a validator function.
   * @param validate - (Optional) A function to validate each array element.
   * @returns The parsed array, the default array, or `undefined` if not set.
   * @throws {EnvValidationError} If the variable or default is invalid, not an array, or fails element validation.
   */
  getOptionalArray<R = unknown>(
    envName: string,
    validate?: ArrayValidatorType<R>,
  ): (R extends unknown[] ? R : R[]) | undefined;
  getOptionalArray<R = unknown>(
    envName: string,
    defaultValue: R extends unknown[] ? R : R[],
    validate?: ArrayValidatorType<R>,
  ): R extends unknown[] ? R : R[];
  getOptionalArray<R = unknown>(
    envName: string,
    defaultValueOrValidate?: (R extends unknown[] ? R : R[]) | ArrayValidatorType<R>,
    validate?: ArrayValidatorType<R>,
  ): (R extends unknown[] ? R : R[]) | undefined {
    return this.guard(() => {
      let defaultValue: (R extends unknown[] ? R : R[]) | undefined;
      let validator: ArrayValidatorType<R> | undefined;

      if (typeof defaultValueOrValidate === "function") {
        validator = defaultValueOrValidate as ArrayValidatorType<R>;
      } else if (defaultValueOrValidate !== undefined) {
        if (!Array.isArray(defaultValueOrValidate)) {
          return this.fail(`The default value for '${envName}' must be an array`);
        }
        defaultValue = defaultValueOrValidate;
        validator = validate;
      } else {
        validator = validate;
      }

      const rawVal = this.source[envName];
      if (rawVal === undefined || rawVal === "") {
        if (defaultValue === undefined) {
          return undefined;
        }
        if (typeof validator === "function") {
          this.validateArrayElements(envName, defaultValue, validator, true, "getOptionalArray");
        }
        return defaultValue;
      }

      return this.parseArrayFromEnvValue<R>(envName, rawVal, validator, "getOptionalArray");
    });
  }

  /**
   * Retrieves and parses a required delimiter-separated list from an environment variable.
   * - Splits on `options.separator` (defaults to `","`) and trims each item.
   * - Rejects empty items (such as trailing separators or whitespace-only entries).
   * - If `options.allowedValues` is provided, validates each item against the allowed list.
   *   **Warning:** a disallowed value is echoed in the error message — do not use `allowedValues` with secrets.
   * - Values cannot contain the separator themselves; use `getRequiredArray` (JSON) if items may contain the delimiter.
   * @param envName - The name of the required environment variable.
   * @param options - (Optional) Separator and allowed-values options.
   * @returns An array of trimmed non-empty strings (or narrowed literal union `T[]`).
   * @throws {EnvValidationError} If the variable is missing, empty, contains an empty item, or fails `allowedValues` validation.
   */
  getRequiredList(envName: string, options?: ListOptions): string[];
  getRequiredList<T extends string>(envName: string, options: ListOptions & { allowedValues: readonly T[] }): T[];
  getRequiredList<T extends string = string>(
    envName: string,
    options?: ListOptions & { allowedValues?: readonly T[] },
  ): T[] {
    return this.guard(() => {
      const separator = this.resolveListSeparator(envName, options);
      const envVal = this.getRequiredEnv(envName);
      return this.parseListItems<T>(envName, envVal, separator, options?.allowedValues);
    });
  }

  /**
   * Retrieves and parses an optional delimiter-separated list from an environment variable.
   * - Unset or empty (`""`) returns a shallow copy of `defaultValue` (`[...defaultValue]`) or `undefined`.
   * - Splits on `options.separator` (defaults to `","`) and trims each item.
   * - Rejects empty items (such as trailing separators or whitespace-only entries).
   * - If `options.allowedValues` is provided, validates each item (including default items) against the allowed list.
   *   **Warning:** a disallowed value is echoed in the error message — do not use `allowedValues` with secrets.
   * @param envName - The name of the environment variable.
   * @param defaultValueOrOptions - (Optional) Either a default list of strings or `ListOptions`.
   * @param options - (Optional) Separator and allowed-values options when `defaultValue` is provided.
   * @returns An array of trimmed strings, a copy of `defaultValue`, or `undefined` when unset without default.
   * @throws {EnvValidationError} If `separator` is empty, an item is empty, or an item is not in `allowedValues`.
   */
  getOptionalList(envName: string, options?: ListOptions): string[] | undefined;
  getOptionalList<T extends string>(
    envName: string,
    options: ListOptions & { allowedValues: readonly T[] },
  ): T[] | undefined;
  getOptionalList(envName: string, defaultValue: readonly string[], options?: ListOptions): string[];
  getOptionalList<T extends string>(
    envName: string,
    defaultValue: readonly T[],
    options: ListOptions & { allowedValues: readonly T[] },
  ): T[];
  getOptionalList<T extends string = string>(
    envName: string,
    defaultValueOrOptions?: readonly T[] | (ListOptions & { allowedValues?: readonly T[] }),
    options?: ListOptions & { allowedValues?: readonly T[] },
  ): T[] | undefined {
    return this.guard(() => {
      let defaultValue: readonly T[] | undefined;
      let resolvedOptions: (ListOptions & { allowedValues?: readonly T[] }) | undefined;

      if (Array.isArray(defaultValueOrOptions)) {
        defaultValue = defaultValueOrOptions as readonly T[];
        resolvedOptions = options;
      } else {
        defaultValue = undefined;
        resolvedOptions = defaultValueOrOptions as (ListOptions & { allowedValues?: readonly T[] }) | undefined;
      }

      const separator = this.resolveListSeparator(envName, resolvedOptions);
      const allowedValues = resolvedOptions?.allowedValues;

      if (defaultValue !== undefined && allowedValues?.length) {
        for (const item of defaultValue) {
          this.checkIfEnvHasAllowedValue(envName, item, allowedValues);
        }
      }

      const rawVal = this.source[envName];
      if (rawVal === undefined || rawVal === "") {
        return defaultValue !== undefined ? [...defaultValue] : undefined;
      }

      return this.parseListItems<T>(envName, rawVal, separator, allowedValues);
    });
  }

  /**
   * Retrieves and parses a required configuration from a JSON file.
   * - Ensures the file exists.
   * - Reads and parses the JSON content.
   * - Optionally validates and instantiates using a provided class.
   * - Sets up a file watcher to automatically reload the config on file changes.
   * - Throws an error if the file is missing, cannot be parsed, or fails validation.
   * @template R - The expected type of the parsed config.
   * @template C - The class constructor type (if provided).
   * @param filePath - The path to the config file (absolute or relative to `process.cwd()`).
   *   **Must never be derived from untrusted input** (same contract as `fs.readFileSync`).
   *   When `configBaseDir` is configured, path traversal is caught at runtime.
   * @param cls - (Optional) A class constructor to validate and instantiate the parsed config.
   * @param watcherOptions - (Optional) Configuration for file watching behavior.
   * @returns The parsed config, optionally instantiated as an instance of `cls`. The returned value will always reflect the latest file content.
   * @throws {EnvValidationError} If the file is missing, cannot be parsed, or fails validation.
   * @example
   * // Without class validation
   * const config = this.envGetter.getRequiredConfigFromFile<{ apiKey: string }>('config.json');
   * console.log(config.apiKey);
   * @example
   * // With class validation
   * class MongoCredentials {
   *   connectionString: string;
   *   constructor(data: any) {
   *     if (!data.connectionString) throw new Error("connectionString is required");
   *     this.connectionString = data.connectionString;
   *   }
   * }
   * const creds = this.envGetter.getRequiredConfigFromFile('mongo-creds.json', MongoCredentials);
   * console.log(creds.connectionString);
   * @example
   * // Disable file watching
   * const config = this.envGetter.getRequiredConfigFromFile('config.json', undefined, { enabled: false });
   */
  getRequiredConfigFromFile<R = unknown, C extends ClassConstructor<unknown> | undefined = undefined>(
    filePath: string,
    cls?: C,
    watcherOptions?: FileWatcherOptions,
  ): C extends ClassConstructor<infer T> ? WithConfigEvents<T> : WithConfigEvents<R> {
    return this.guard(() => {
      const absolutePath = this.resolveFilePath(filePath);

      if (!existsSync(absolutePath)) this.fail(`Config file '${absolutePath}' does not exist.`);

      // Check if already cached, return cached value
      if (absolutePath in this.configsStorage) {
        return this.configsStorage[absolutePath] as C extends ClassConstructor<infer T>
          ? WithConfigEvents<T>
          : WithConfigEvents<R>;
      }

      // Read and parse the file for the first time
      const config = this.readAndParseConfigFile<R, C>(absolutePath, cls);

      // Setup file watcher
      this.setupFileWatcher(absolutePath, cls, watcherOptions, false);

      return config as C extends ClassConstructor<infer T> ? WithConfigEvents<T> : WithConfigEvents<R>;
    });
  }

  /**
   * Retrieves and parses an optional configuration from a JSON file.
   * - If the file exists, reads and parses the JSON content.
   * - If the file doesn't exist or cannot be parsed, returns the default value (if provided) or undefined.
   * - Default values are enhanced with event methods for consistency.
   * - Optionally validates and instantiates using a provided class.
   * - Sets up a file watcher to automatically reload the config on file changes. If the file is
   *   absent (at call time or after deletion), the parent directory is watched so the config
   *   loads as soon as the file appears (requires the parent directory to exist).
   * - Only throws an error if validation fails (when using a class constructor) or if `filePath` escapes `configBaseDir`.
   *
   * Note: when the file is absent and no `defaultValue` is given, the returned `undefined`
   * cannot retroactively become the config once the file appears — subscribe to
   * `service.events` (`updated:<absolute path>`) or re-call the getter. With a `defaultValue`,
   * the returned object is updated in place when the file appears.
   * @template R - The expected type of the parsed config.
   * @template C - The class constructor type (if provided).
   * @param filePath - The path to the config file (absolute or relative to `process.cwd()`).
   *   **Must never be derived from untrusted input** (same contract as `fs.readFileSync`).
   *   When `configBaseDir` is configured, path traversal is caught at runtime.
   * @param defaultValue - (Optional) The default value to return if the file doesn't exist or cannot be parsed.
   *   **Must be a plain data object** — a function-typed default is indistinguishable from a
   *   class constructor (`typeof === "function"`) and will be misread as `cls`.
   * @param cls - (Optional) A class constructor to validate and instantiate the parsed config.
   * @param watcherOptions - (Optional) Configuration for file watching behavior.
   * @returns The parsed config, the default value (with event methods), or undefined. The returned value will always reflect the latest file content if the file exists.
   * @throws {EnvValidationError} Only if validation fails (when using a class constructor) or path traversal is detected.
   * @example
   * // Without default value
   * const config = this.envGetter.getOptionalConfigFromFile<{ apiKey?: string }>('config.json');
   * if (config) console.log(config.apiKey);
   * @example
   * // With default value
   * const config = this.envGetter.getOptionalConfigFromFile('config.json', { apiKey: 'default' });
   * console.log(config.apiKey);
   * @example
   * // With class validation
   * class TestConfig {
   *   testConfigStringFromFile: string;
   *
   *   constructor(data: any) {
   *     if (!data.testConfigStringFromFile || typeof data.testConfigStringFromFile !== 'string') {
   *       throw new Error('testConfigStringFromFile is required and must be a string');
   *     }
   *     this.testConfigStringFromFile = data.testConfigStringFromFile;
   *   }
   * }
   * const config = this.envGetter.getOptionalConfigFromFile('test.json', undefined, TestConfig);
   */
  // Most specific overloads first
  getOptionalConfigFromFile<C extends ClassConstructor<unknown>>(
    filePath: string,
    cls: C,
    watcherOptions: FileWatcherOptions,
  ): WithConfigEvents<InstanceType<C>> | undefined;
  getOptionalConfigFromFile<R, C extends ClassConstructor<unknown>>(
    filePath: string,
    defaultValue: R,
    cls: C,
    watcherOptions: FileWatcherOptions,
  ): WithConfigEvents<InstanceType<C>>;
  getOptionalConfigFromFile<R, C extends ClassConstructor<unknown>>(
    filePath: string,
    defaultValue: R,
    cls: C,
  ): WithConfigEvents<InstanceType<C>>;
  getOptionalConfigFromFile<R = unknown>(
    filePath: string,
    defaultValue: undefined,
    watcherOptions: FileWatcherOptions,
  ): WithConfigEvents<R> | undefined;
  getOptionalConfigFromFile<R>(
    filePath: string,
    defaultValue: R,
    watcherOptions: FileWatcherOptions,
  ): WithConfigEvents<R>;
  getOptionalConfigFromFile<C extends ClassConstructor<unknown>>(
    filePath: string,
    cls: C,
  ): WithConfigEvents<InstanceType<C>> | undefined;
  getOptionalConfigFromFile<R>(filePath: string, defaultValue: R): WithConfigEvents<R>;
  getOptionalConfigFromFile<R = unknown>(filePath: string): WithConfigEvents<R> | undefined;
  getOptionalConfigFromFile<R = unknown, C extends ClassConstructor<unknown> | undefined = undefined>(
    filePath: string,
    defaultValueOrCls?: R | C,
    clsOrWatcherOptions?: C | FileWatcherOptions,
    watcherOptions?: FileWatcherOptions,
  ): C extends ClassConstructor<infer T>
    ? WithConfigEvents<T> | WithConfigEvents<R> | undefined
    : WithConfigEvents<R> | undefined {
    return this.guard(() => {
      const absolutePath = this.resolveFilePath(filePath);

      // Determine the parameters (shared by the missing-file and exists paths)
      let cls: C | undefined;
      let options: FileWatcherOptions | undefined;

      if (typeof defaultValueOrCls === "function") {
        // Pattern: (filePath, cls) or (filePath, cls, watcherOptions)
        cls = defaultValueOrCls as C;
        options = clsOrWatcherOptions as FileWatcherOptions | undefined;
      } else if (typeof clsOrWatcherOptions === "function") {
        // Pattern: (filePath, defaultValue, cls) or (filePath, defaultValue, cls, watcherOptions)
        cls = clsOrWatcherOptions as C;
        options = watcherOptions;
      } else {
        // Pattern: (filePath), (filePath, defaultValue), or (filePath, defaultValue, watcherOptions)
        cls = undefined;
        options = clsOrWatcherOptions as FileWatcherOptions | undefined;
      }

      // If file doesn't exist
      if (!existsSync(absolutePath)) {
        // Check if defaultValueOrCls is a class constructor
        if (typeof defaultValueOrCls === "function") {
          // No default — still set up a pending watcher so creation is caught (E2)
          this.setupPendingFileWatcher(absolutePath, cls, options, true);
          return undefined as C extends ClassConstructor<infer T>
            ? WithConfigEvents<T> | WithConfigEvents<R> | undefined
            : WithConfigEvents<R> | undefined;
        }

        // If we have a default value, store it in configsStorage so the in-place update path
        // can mutate the caller's reference when the file later appears (E2, reference stability)
        if (defaultValueOrCls !== undefined) {
          const defaultWithEvents =
            typeof defaultValueOrCls === "object" && defaultValueOrCls !== null
              ? this.safeObjectCopy(defaultValueOrCls as Record<string, unknown>)
              : defaultValueOrCls;

          if (typeof defaultWithEvents === "object" && defaultWithEvents !== null) {
            this.configsStorage[absolutePath] = defaultWithEvents;
            this.attachEventMethods(defaultWithEvents as Record<string, unknown>, absolutePath);
          }

          this.setupPendingFileWatcher(absolutePath, cls, options, true);

          return defaultWithEvents as C extends ClassConstructor<infer T>
            ? WithConfigEvents<T> | WithConfigEvents<R> | undefined
            : WithConfigEvents<R> | undefined;
        }

        // No default — set up pending watcher so `updated:<path>` fires on creation (E2)
        this.setupPendingFileWatcher(absolutePath, cls, options, true);
        return undefined as C extends ClassConstructor<infer T>
          ? WithConfigEvents<T> | WithConfigEvents<R> | undefined
          : WithConfigEvents<R> | undefined;
      }

      // Check if already cached, return cached value
      if (absolutePath in this.configsStorage) {
        return this.configsStorage[absolutePath] as C extends ClassConstructor<infer T>
          ? WithConfigEvents<T> | WithConfigEvents<R> | undefined
          : WithConfigEvents<R> | undefined;
      }

      // Read and parse the file
      let config: C extends ClassConstructor<infer T> ? T : R;
      try {
        config = this.readAndParseConfigFile<R, C>(absolutePath, cls, true, true);
      } catch (error: unknown) {
        // For optional config files, return default value if file reading or JSON parsing fails
        // Only re-throw if it's a validation error (when cls is provided and validation fails)
        const isValidationError = cls && error instanceof Error && error.message.includes("Validation failed");

        if (isValidationError) {
          // Always crash on validation errors, even for optional configs
          throw error;
        }

        if (typeof defaultValueOrCls === "function" || defaultValueOrCls === undefined) {
          // Pattern: (filePath), (filePath, cls[, opts]), or (filePath, undefined, opts) — install watcher & return undefined (BUG-4)
          this.setupFileWatcher(absolutePath, cls, options, true);
          return undefined as C extends ClassConstructor<infer T>
            ? WithConfigEvents<T> | WithConfigEvents<R> | undefined
            : WithConfigEvents<R> | undefined;
        }

        // Pattern: (filePath, defaultValue, ...) — cache object default, attach events, and install watcher (BUG-4)
        const defaultWithEvents =
          typeof defaultValueOrCls === "object" && defaultValueOrCls !== null
            ? this.safeObjectCopy(defaultValueOrCls as Record<string, unknown>)
            : defaultValueOrCls;

        if (typeof defaultWithEvents === "object" && defaultWithEvents !== null) {
          this.configsStorage[absolutePath] = defaultWithEvents;
          this.attachEventMethods(defaultWithEvents as Record<string, unknown>, absolutePath);
        }

        this.setupFileWatcher(absolutePath, cls, options, true);

        return defaultWithEvents as C extends ClassConstructor<infer T>
          ? WithConfigEvents<T> | WithConfigEvents<R> | undefined
          : WithConfigEvents<R> | undefined;
      }

      // Setup file watcher
      this.setupFileWatcher(absolutePath, cls, options, true);

      return config as C extends ClassConstructor<infer T>
        ? WithConfigEvents<T> | WithConfigEvents<R> | undefined
        : WithConfigEvents<R> | undefined;
    });
  }

  /*****************************************************************************************
   *                                   PRIVATE METHODS                                     *
   *****************************************************************************************/

  /**
   * Wraps a public getter invocation so validation failures participate in `collectErrors()` scopes.
   * Only the outermost getter frame records into `this.collector`.
   * @template T - Return type of the getter.
   * @param fn - The getter implementation body.
   * @returns The getter result, or `undefined` when an error was collected.
   */
  private guard<T>(fn: () => T): T {
    this.guardDepth++;
    try {
      return fn();
    } catch (error: unknown) {
      if (this.collector !== null && error instanceof EnvValidationError) {
        if (this.guardDepth === 1) {
          this.collector.push(...error.errors);
          return undefined as unknown as T;
        }
      }
      throw error;
    } finally {
      this.guardDepth--;
    }
  }

  private getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }

  /**
   * Extracts only positional info from a `JSON.parse` `SyntaxError`, never the raw input
   * fragment that V8 embeds in the message (it may contain secrets).
   * @param error - The error thrown by `JSON.parse`.
   * @returns A safe message containing at most positional info (`at position N` / `at line L column C`).
   * @private
   */
  private sanitizeJsonError(error: unknown): string {
    if (!(error instanceof SyntaxError)) return "Invalid JSON format";
    const msg = error.message;
    // V8: "Unexpected token X at position N" or "… at line L column C"
    const positional = /(?:at position \d+|at line \d+ column \d+)/i.exec(msg);
    return positional ? `Invalid JSON (${positional[0]})` : "Invalid JSON format";
  }

  /**
   * Throws an `EnvValidationError` for synchronous validation failures.
   * @param message - The validation error message.
   * @throws {EnvValidationError} Always throws; never returns.
   * @private
   */
  private fail(message: string): never {
    throw new EnvValidationError([message]);
  }

  /**
   * Terminates execution from inside an asynchronous watcher callback when `breakOnError` is `true`.
   * Kept as a dedicated method so tests can spy on it.
   * @param error - The error to throw as an uncaught exception.
   * @throws {Error} Always throws; never returns.
   * @private
   */
  private terminate(error: Error): never {
    throw error;
  }

  /**
   * Emits both the per-file `'updated:<filePath>'` event and the global `'updated'` event.
   * The reload has already succeeded at this point, so an exception thrown by a listener is
   * logged rather than reported as a failed re-read (and never triggers `breakOnError`).
   * @param event - The update event payload.
   * @private
   */
  private emitUpdated(event: ConfigUpdatedEvent): void {
    try {
      this.events.emit(`updated:${event.filePath}`, event);
      this.events.emit("updated", event);
    } catch (error: unknown) {
      this.logger.error(
        `An 'updated' listener for config file '${event.filePath}' threw: ${this.getErrorMessage(error)}`,
      );
    }
  }

  /**
   * Emits the per-file `'error:<filePath>'` event, the global `'error'` event (when listeners exist),
   * and logs to Nest's `Logger` when neither has a listener.
   * @param event - The error event payload.
   * @private
   */
  private emitError(event: ConfigErrorEvent): void {
    const perFileEvent = `error:${event.filePath}`;
    const hadPerFileListener = this.events.listenerCount(perFileEvent) > 0;
    this.events.emit(perFileEvent, event);

    const hadGlobalListener = this.events.listenerCount("error") > 0;
    if (hadGlobalListener) {
      this.events.emit("error", event);
    }

    if (!hadPerFileListener && !hadGlobalListener) {
      this.logger.error(event.error.message);
    }
  }

  /**
   * Parses and optionally class-validates a JSON object from an environment variable string.
   * @template R - Expected return type when no class constructor is provided.
   * @template C - Optional class constructor type.
   * @param envName - Environment variable name.
   * @param envVal - Raw environment variable string value.
   * @param cls - Optional class constructor for validation.
   * @returns The parsed (and optionally instantiated) object.
   * @private
   */
  private parseObjectFromEnvValue<R = unknown, C extends ClassConstructor<unknown> | undefined = undefined>(
    envName: string,
    envVal: string,
    cls?: C,
  ): C extends ClassConstructor<infer T> ? T : R {
    const baseErrorMessage = `Cannot parse object from variable '${envName}'. Error:`;
    let parsedObj: Record<string, unknown>;

    try {
      parsedObj = this.deepSanitize(JSON.parse(envVal));
    } catch (error: unknown) {
      this.fail(`${baseErrorMessage} ${this.sanitizeJsonError(error)}`);
    }

    if (!cls) return parsedObj as C extends ClassConstructor<infer T> ? T : R;

    try {
      return new cls(parsedObj) as C extends ClassConstructor<infer T> ? T : R;
    } catch (error: unknown) {
      this.fail(`${baseErrorMessage} ${this.getErrorMessage(error)}`);
    }
  }

  /**
   * Parses and optionally validates a JSON array from an environment variable string.
   * @template R - Expected element or tuple type.
   * @param envName - Environment variable name.
   * @param envVal - Raw environment variable string value.
   * @param validate - Optional element validator callback.
   * @param getterName - Public getter name used in validator-misuse messages.
   * @returns The parsed and validated array.
   * @private
   */
  private parseArrayFromEnvValue<R = unknown>(
    envName: string,
    envVal: string,
    validate: ArrayValidatorType<R> | undefined,
    getterName: ArrayGetterName,
  ): R extends unknown[] ? R : R[] {
    const baseErrorMessage = `Cannot parse an array from variable '${envName}'. Error:`;
    let parsedArray: unknown[];

    try {
      parsedArray = this.deepSanitize(JSON.parse(envVal));
    } catch (error: unknown) {
      this.fail(`${baseErrorMessage} ${this.sanitizeJsonError(error)}`);
    }

    if (!Array.isArray(parsedArray)) this.fail(`'${envName}' must be a stringified array`);

    if (typeof validate === "function") {
      this.validateArrayElements(envName, parsedArray, validate, false, getterName);
    }

    return parsedArray as R extends unknown[] ? R : R[];
  }

  /**
   * Runs an array validator function across each element of an array.
   * @template R - Expected element or tuple type.
   * @param envName - Environment variable name.
   * @param arr - Array to validate.
   * @param validate - Validator callback.
   * @param isDefault - Whether `arr` is the caller-supplied default value.
   * @param getterName - Public getter name used in validator-misuse messages.
   * @private
   */
  private validateArrayElements<R = unknown>(
    envName: string,
    arr: unknown[],
    validate: ArrayValidatorType<R>,
    isDefault: boolean,
    getterName: ArrayGetterName,
  ): void {
    arr.forEach((el, i) => {
      const result = validate(el, i, arr as R extends unknown[] ? R : R[]);

      if (!["boolean", "string"].includes(typeof result) || result === "") {
        this.fail(
          `The validation func of EnvGetterService.${getterName}('${envName}') must return a boolean or non-empty string.`,
        );
      }

      if (result === false || (typeof result === "string" && result)) {
        if (isDefault) {
          const detail = typeof result === "string" ? result : `'${envName}[${i}]' failed validation`;
          this.fail(`The default value for '${envName}' failed validation: ${detail}`);
        } else {
          this.fail(typeof result === "string" ? result : `'${envName}[${i}]' failed validation`);
        }
      }
    });
  }

  /**
   * Validates and resolves the list separator from `ListOptions`.
   * @param envName - Environment variable name.
   * @param options - Optional list options.
   * @returns The validated non-empty separator string.
   * @private
   */
  private resolveListSeparator(envName: string, options?: ListOptions): string {
    const separator = options?.separator ?? ",";
    if (typeof separator !== "string" || separator.length === 0) {
      return this.fail(`The separator for '${envName}' must be a non-empty string`);
    }
    return separator;
  }

  /**
   * Splits a raw string by `separator`, trims each item, rejects empty items, and checks `allowedValues`.
   * @template T - String or literal union type.
   * @param envName - Environment variable name.
   * @param rawVal - Raw environment variable string.
   * @param separator - Non-empty separator string.
   * @param allowedValues - Optional list of allowed item values.
   * @returns Array of validated list items.
   * @private
   */
  private parseListItems<T extends string>(
    envName: string,
    rawVal: string,
    separator: string,
    allowedValues?: readonly T[],
  ): T[] {
    const items = rawVal.split(separator).map((item) => item.trim());
    for (let i = 0; i < items.length; i++) {
      const item = items[i] as string;
      if (item === "") {
        return this.fail(`Variable '${envName}' contains an empty list item at index ${i}`);
      }
      if (allowedValues?.length) {
        this.checkIfEnvHasAllowedValue(envName, item, allowedValues);
      }
    }
    return items as T[];
  }

  /**
   * Checks if an environment variable exists and is non-empty.
   * - If the variable is missing, throws an error.
   * - If the variable is set but empty (`KEY=`), throws a distinct "set but empty" error.
   * - If the variable exists and is non-empty, returns `true`.
   * Note: `isEnvSet()` retains pure-existence semantics (hasOwnProperty) regardless of value.
   * @param envName - The name of the environment variable to check.
   * @returns `true` if the environment variable exists and is non-empty.
   * @throws {EnvValidationError} If the variable is missing or set-but-empty.
   * @private
   */
  private checkEnvExisting(envName: string): boolean | never {
    const value = this.source[envName];
    if (value === undefined) this.fail(`Missing '${envName}' environment variable`);
    if (value === "") this.fail(`Variable '${envName}' is set but empty`);
    return true;
  }

  /**
   * Validates whether an environment variable contains an allowed value.
   * - If the variable's value is not in the allowed list, throws an error.
   *
   * WARNING: the received value is echoed in the error message — callers must not pass
   * secret variables through `allowedValues` validation.
   * @param envName - The name of the environment variable.
   * @param envVal - The current value of the environment variable.
   * @param allowedValues - An array of allowed values for the variable.
   * @throws {EnvValidationError} If `envVal` is not in the allowed list.
   * @private
   */
  private checkIfEnvHasAllowedValue(envName: string, envVal: string, allowedValues: readonly string[]): void | never {
    if (!allowedValues.includes(envVal))
      this.fail(`Variable '${envName}' can be only one of: [${allowedValues}], but received '${envVal}'`);
  }

  /**
   * Resolves a file path to an absolute path.
   * - Without `configBaseDir`: absolute paths pass through; relative paths resolve from `cwd`.
   * - With `configBaseDir`: the resolved path MUST remain inside that directory tree or
   *   `fail` is called (prevents path traversal).
   *
   * **Security note:** `filePath` must never be derived from untrusted input (same contract
   * as `fs.readFileSync`). When `configBaseDir` is set, traversal attempts are caught and
   * thrown as validation errors.
   * @param filePath - The file path to resolve.
   * @returns The absolute file path.
   * @private
   */
  private resolveFilePath(filePath: string): string {
    if (this.options?.configBaseDir) {
      const base = resolve(this.options.configBaseDir);
      const p = resolve(base, filePath);
      if (p !== base && !p.startsWith(base + sep)) {
        this.fail(`Config file path '${filePath}' escapes configBaseDir '${base}'`);
      }
      return p;
    }
    return isAbsolute(filePath) ? filePath : join(process.cwd(), filePath);
  }

  /**
   * Reads and parses a JSON configuration file.
   * - Reads the file content.
   * - Parses the JSON content.
   * - Optionally validates and instantiates using a provided class.
   * - Updates the cache with the parsed config.
   * - If an instance already exists in cache, updates its properties instead of creating a new instance (preserves references).
   * @template R - The expected type of the parsed config.
   * @template C - The class constructor type (if provided).
   * @param filePath - The absolute path to the config file.
   * @param cls - (Optional) A class constructor to validate and instantiate the parsed config.
   * @param isInitialLoad - Whether this is the initial load (true) or a re-parse (false).
   * @param isOptional - Whether this is for an optional config file on initial load.
   * @returns The parsed config, optionally instantiated as an instance of `cls`.
   * @throws {Error} If the file cannot be read, parsed, or validated.
   * @private
   */
  private readAndParseConfigFile<R = unknown, C extends ClassConstructor<unknown> | undefined = undefined>(
    filePath: string,
    cls?: C,
    isInitialLoad: boolean = true,
    isOptional: boolean = false,
  ): C extends ClassConstructor<infer T> ? T : R {
    const baseErrorMessage = `Cannot read config from file '${filePath}'.`;

    let fileContent: string;
    try {
      fileContent = readFileSync(filePath, "utf-8");
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(this.getErrorMessage(error));
      const fullMessage = `${baseErrorMessage} Error reading file: ${err.message}`;
      if (isInitialLoad && !isOptional) {
        this.fail(fullMessage);
      }
      throw new Error(fullMessage);
    }

    let parsedConfig: Record<string, unknown>;
    try {
      parsedConfig = this.deepSanitize(JSON.parse(fileContent));
    } catch (error: unknown) {
      const safeMessage = this.sanitizeJsonError(error);
      const fullMessage = `${baseErrorMessage} ${safeMessage}`;
      if (isInitialLoad && !isOptional) {
        this.fail(fullMessage);
      }
      // Deliberately NOT preserving the cause: the original SyntaxError embeds a raw fragment
      // of the file content, and this error reaches consumers via the watcher `error:<path>` event.
      throw new Error(fullMessage);
    }

    if (!cls) {
      // For plain objects, check if we need to update existing object or create new one
      const existingConfig = this.configsStorage[filePath];
      if (existingConfig && typeof existingConfig === "object") {
        // Update existing object properties to preserve references
        const configObj = existingConfig as Record<string, unknown>;
        Object.keys(configObj)
          .filter((key) => !this.isUnsafeKey(key))
          .forEach((key) => delete configObj[key]);
        Object.keys(parsedConfig)
          .filter((key) => !this.isUnsafeKey(key))
          .forEach((key) => {
            if (!this.isUnsafeKey(key)) {
              configObj[key] = parsedConfig[key];
            }
          });

        // Attach event methods if not already attached
        if (!isInitialLoad) {
          this.attachEventMethods(configObj, filePath);
        }

        return configObj as C extends ClassConstructor<infer T> ? T : R;
      } else {
        // Ensure config objects are prototype-less
        const safeParsedConfig = Object.create(null);
        Object.keys(parsedConfig)
          .filter((key) => !this.isUnsafeKey(key))
          .forEach((key) => {
            safeParsedConfig[key] = parsedConfig[key];
          });
        this.configsStorage[filePath] = safeParsedConfig;
        // Attach event methods to the new config
        this.attachEventMethods(safeParsedConfig, filePath);
        return safeParsedConfig as C extends ClassConstructor<infer T> ? T : R;
      }
    }

    try {
      // Validate by creating a temporary instance
      const tempInstance = new cls(parsedConfig);

      // Check if an instance already exists in cache
      const existingInstance = this.configsStorage[filePath];
      if (existingInstance) {
        // Update existing instance properties to preserve references
        const instanceObj = existingInstance as Record<string, unknown>;
        // Safely delete existing properties
        Object.keys(instanceObj)
          .filter((key) => !this.isUnsafeKey(key))
          .forEach((key) => delete instanceObj[key]);
        // Safely copy properties from tempInstance
        Object.keys(tempInstance as Record<string, unknown>)
          .filter((key) => !this.isUnsafeKey(key))
          .forEach((key) => {
            instanceObj[key] = (tempInstance as Record<string, unknown>)[key];
          });

        // Attach event methods if not already attached
        if (!isInitialLoad) {
          this.attachEventMethods(instanceObj, filePath);
        }

        return instanceObj as C extends ClassConstructor<infer T> ? T : R;
      } else {
        // First time - store the new instance
        this.configsStorage[filePath] = tempInstance;
        // Attach event methods to the new instance
        this.attachEventMethods(tempInstance as Record<string, unknown>, filePath);
        return tempInstance as C extends ClassConstructor<infer T> ? T : R;
      }
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(this.getErrorMessage(error));
      const fullMessage = `${baseErrorMessage} Validation failed: ${err.message}`;
      const validationError = new Error(fullMessage);
      // Always fail on validation errors during initial load, even for optional configs
      if (isInitialLoad) {
        this.fail(fullMessage);
      }
      throw validationError;
    }
  }

  /**
   * Sets up a file watcher for a configuration file.
   * - Watches for file changes and automatically re-reads and updates the cached config.
   * - Applies debouncing to avoid excessive re-reads.
   * - Re-establishes the watcher after each successful update (handles Vault atomic-replace).
   * - On file deletion: emits `error:<path>` and global `error`, then sets up a pending parent-dir watcher so
   *   recreation resumes updates (E3 fix).
   * - Emits `updated:<path>` / `updated` or `error:<path>` / `error` events on re-parse.
   * @param filePath - The absolute path to the config file.
   * @param cls - (Optional) A class constructor to validate and instantiate the parsed config.
   * @param options - File watcher configuration options.
   * @param isOptional - Whether this is for an optional config file.
   * @private
   */
  private setupFileWatcher<C extends ClassConstructor<unknown> | undefined = undefined>(
    filePath: string,
    cls?: C,
    options?: FileWatcherOptions,
    isOptional: boolean = false,
  ): void {
    const watcherOptions: Required<FileWatcherOptions> = {
      enabled: options?.enabled ?? true,
      debounceMs: options?.debounceMs ?? 350,
      breakOnError: options?.breakOnError ?? false,
    };

    if (!watcherOptions.enabled) return;

    // Close existing watcher if present (for re-establishment)
    const existingWatcher = this.fileWatchers.get(filePath);
    if (existingWatcher) {
      existingWatcher.close();
      this.fileWatchers.delete(filePath);
    }

    let debounceTimer: NodeJS.Timeout | null = null;

    const watcher = watch(filePath, (eventType) => {
      // Handle both "change" and "rename" events to catch file replacements
      if (eventType === "change" || eventType === "rename") {
        if (debounceTimer) clearTimeout(debounceTimer);

        debounceTimer = setTimeout(() => {
          // Verify file still exists before attempting to read
          if (!existsSync(filePath)) {
            // File was deleted — swap to a pending parent-dir watcher for recreation (E3),
            // then emit the error so listeners observe the already-transitioned state.
            const errorEvent: ConfigErrorEvent = {
              filePath,
              error: new Error(`Config file '${filePath}' was deleted`),
              timestamp: Date.now(),
            };
            watcher.close();
            this.fileWatchers.delete(filePath);
            this.setupPendingFileWatcher(filePath, cls, options, isOptional);
            this.emitError(errorEvent);
            return;
          }

          try {
            // Re-parse the config (isInitialLoad = false)
            this.readAndParseConfigFile(filePath, cls, false, isOptional);

            // Close the old watcher
            watcher.close();
            this.fileWatchers.delete(filePath);

            // Re-establish the watcher to handle file replacement scenarios (e.g., Vault agent)
            this.setupFileWatcher(filePath, cls, options, isOptional);
          } catch (error: unknown) {
            const err = error instanceof Error ? error : new Error(String(error));
            const errorEvent: ConfigErrorEvent = {
              filePath,
              error: err,
              timestamp: Date.now(),
            };
            this.emitError(errorEvent);
            if (watcherOptions.breakOnError) {
              this.terminate(err);
            }
            return;
          }

          this.emitUpdated({ filePath, timestamp: Date.now() });
        }, watcherOptions.debounceMs);
      }
    });

    this.fileWatchers.set(filePath, watcher);
  }

  /**
   * Watches the parent directory for a not-yet-existing file.
   * Once the target file appears, loads it, emits `updated:<path>` and `updated`, closes this watcher,
   * and establishes a normal file watcher.
   * If the parent directory doesn't exist, this is a no-op (documented limitation).
   * @param filePath - The absolute path to the config file that does not exist yet.
   * @param cls - (Optional) A class constructor to validate and instantiate the parsed config.
   * @param options - File watcher configuration options.
   * @param isOptional - Whether this is for an optional config file.
   * @private
   */
  private setupPendingFileWatcher<C extends ClassConstructor<unknown> | undefined = undefined>(
    filePath: string,
    cls?: C,
    options?: FileWatcherOptions,
    isOptional: boolean = false,
  ): void {
    const watcherOptions: Required<FileWatcherOptions> = {
      enabled: options?.enabled ?? true,
      debounceMs: options?.debounceMs ?? 350,
      breakOnError: options?.breakOnError ?? false,
    };

    if (!watcherOptions.enabled) return;

    const dir = dirname(filePath);
    const name = basename(filePath);

    if (!existsSync(dir)) return; // Parent dir doesn't exist — skip (documented limitation)

    // Close any existing pending watcher for this path
    const existing = this.pendingWatchers.get(filePath);
    if (existing) {
      existing.close();
      this.pendingWatchers.delete(filePath);
    }

    let debounceTimer: NodeJS.Timeout | null = null;

    const pending = watch(dir, (eventType, filename) => {
      if (filename !== name) return;
      if (eventType !== "rename" && eventType !== "change") return;

      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (!existsSync(filePath)) return; // Not yet created

        try {
          this.readAndParseConfigFile(filePath, cls, false, isOptional);
          pending.close();
          this.pendingWatchers.delete(filePath);
          this.setupFileWatcher(filePath, cls, options, isOptional);
        } catch (error: unknown) {
          const err = error instanceof Error ? error : new Error(String(error));
          this.emitError({
            filePath,
            error: err,
            timestamp: Date.now(),
          } satisfies ConfigErrorEvent);
          if (watcherOptions.breakOnError) {
            this.terminate(err);
          }
          return;
        }

        this.emitUpdated({ filePath, timestamp: Date.now() });
      }, watcherOptions.debounceMs);
    });

    this.pendingWatchers.set(filePath, pending);
  }

  /**
   * Attaches event subscription methods to a config instance.
   * Methods are added as non-enumerable properties so they don't interfere with serialization.
   * @param instance - The config instance to attach methods to.
   * @param filePath - The absolute path to the config file.
   * @private
   */
  private attachEventMethods(instance: Record<string, unknown>, filePath: string): void {
    // Check if methods are already attached
    if (typeof instance.on === "function") return;

    const emitter = this.events;

    Object.defineProperty(instance, "on", {
      enumerable: false,
      writable: false,
      configurable: true,
      value: (event: string, handler: (event: ConfigUpdatedEvent | ConfigErrorEvent) => void): Disposable => {
        const eventName = `${event}:${filePath}`;
        emitter.on(eventName, handler);
        return {
          unsubscribe: () => emitter.off(eventName, handler),
        };
      },
    });

    Object.defineProperty(instance, "once", {
      enumerable: false,
      writable: false,
      configurable: true,
      value: (event: string, handler: (event: ConfigUpdatedEvent | ConfigErrorEvent) => void): Disposable => {
        const eventName = `${event}:${filePath}`;
        emitter.once(eventName, handler);
        return {
          unsubscribe: () => emitter.off(eventName, handler),
        };
      },
    });

    Object.defineProperty(instance, "off", {
      enumerable: false,
      writable: false,
      configurable: true,
      value: (event: string, handler: (event: ConfigUpdatedEvent | ConfigErrorEvent) => void): void => {
        const eventName = `${event}:${filePath}`;
        emitter.off(eventName, handler);
      },
    });
  }
}
