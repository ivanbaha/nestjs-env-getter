import { config } from "dotenv";
import { existsSync, readFileSync, watch } from "fs";
import { join, isAbsolute } from "path";

import { Injectable } from "@nestjs/common";

import { type ClassConstructor, isTimePeriod, parseTimePeriod, TimeMarker } from "../shared";
import { type ArrayValidatorType, type FileWatcherOptions } from "./types";

@Injectable()
export class EnvGetterService {
  private readonly configsStorage: Record<string, any> = {};
  private readonly fileWatchers = new Map<string, ReturnType<typeof watch>>();

  constructor() {
    config({ quiet: true });
  }

  /**
   * Checks whether an environment variable is set.
   * @param envName - The name of the environment variable.
   * @returns `true` if the environment variable exists, otherwise `false`.
   */
  isEnvSet(envName: string): boolean {
    return process.env.hasOwnProperty(envName);
  }

  /**
   * Retrieves the value of a required environment variable.
   * - Ensures that the variable exists; otherwise, the process is terminated.
   * - If `allowedValues` is provided, checks whether the variable contains an allowed value.
   * @param envName - The name of the required environment variable.
   * @param allowedValues - (Optional) A list of allowed values for validation.
   * @returns The environment variable value as a string.
   * @throws Terminates the process if the variable is missing or contains an invalid value.
   */
  getRequiredEnv(envName: string): string;
  getRequiredEnv(envName: string, allowedValues: string[]): string;
  getRequiredEnv(envName: string, allowedValues?: string[]): string {
    this.checkEnvExisting(envName);

    if (allowedValues?.length) this.checkIfEnvHasAllowedValue(envName, process.env[envName] ?? null, allowedValues);

    return String(process.env[envName]);
  }

  /**
   * Retrieves the value of an optional environment variable.
   * - If the variable is set, returns its value.
   * - If `defaultValue` is provided and the variable is not set, returns the default value.
   * - If `allowedValues` is provided, validates that the variable (or default value) is within the allowed list.
   * @param envName - The name of the environment variable.
   * @param defaultValue - (Optional) The default value to return if the environment variable is not set.
   * @param allowedValues - (Optional) An array of allowed values for validation.
   * @returns The environment variable value, the default value, or `undefined` if not set.
   * @throws Terminates the process if the value is not in `allowedValues` (if provided).
   */
  getOptionalEnv(envName: string): string | undefined;
  getOptionalEnv(envName: string, defaultValue: string): string;
  getOptionalEnv(envName: string, allowedValues: string[]): string | undefined;
  getOptionalEnv(envName: string, defaultValue: string, allowedValues: string[]): string | undefined;
  getOptionalEnv(
    envName: string,
    defaultValueOrAllowedValues?: string | string[],
    allowedValues?: string[],
  ): string | undefined {
    if (Array.isArray(defaultValueOrAllowedValues)) {
      const envValue = process.env[envName];

      this.checkIfEnvHasAllowedValue(envName, envValue ?? null, defaultValueOrAllowedValues);

      return envValue;
    } else {
      const envValue = process.env[envName] || defaultValueOrAllowedValues;

      if (allowedValues?.length) this.checkIfEnvHasAllowedValue(envName, envValue ?? null, allowedValues);

      return envValue;
    }
  }

  /**
   * Retrieves and validates a required numeric environment variable.
   * - Ensures the variable is set and contains only numeric characters (or underscores).
   * - Converts the value to a number.
   * - Terminates the process if the value is not numeric.
   * @param envName - The name of the environment variable.
   * @returns The numeric value of the environment variable.
   * @throws Terminates the process if the variable is missing or not numeric.
   */
  getRequiredNumericEnv(envName: string): number {
    const envVal = this.getRequiredEnv(envName);

    if (!/^[0-9_]+$/.test(envVal)) this.stopProcess(`Variable '${envName}' is not of number type.`);

    return Number(envVal.replace(/_/g, ""));
  }

  /**
   * Retrieves an optional numeric environment variable.
   * - If the variable is set and numeric, returns its numeric value.
   * - If `defaultValue` is provided and the variable is not set or invalid, returns the default value.
   * @param envName - The name of the environment variable.
   * @param defaultValue - (Optional) The default numeric value to return if the variable is not set.
   * @returns The numeric value of the environment variable or the default value.
   */
  getOptionalNumericEnv(envName: string): number | undefined;
  getOptionalNumericEnv(envName: string, defaultValue: number): number;
  getOptionalNumericEnv(envName: string, defaultValue?: number): number | undefined {
    const envVal = String(process.env[envName]);

    return /^[0-9_]+$/.test(envVal) ? Number(envVal.replace(/_/g, "")) : defaultValue;
  }

  /**
   * Retrieves and validates a required boolean environment variable.
   * - Ensures the variable is set and contains either `"true"` or `"false"`.
   * - Converts the value to a boolean.
   * - Terminates the process if the value is not a valid boolean.
   * @param envName - The name of the environment variable.
   * @returns The boolean value of the environment variable.
   * @throws Terminates the process if the variable is missing or not `"true"`/`"false"`.
   */
  getRequiredBooleanEnv(envName: string): boolean {
    const envVal = this.getRequiredEnv(envName);

    if (!/true|false/.test(envVal)) this.stopProcess(`Variable '${envName}' is not of boolean type.`);

    return envVal === "true";
  }

  /**
   * Retrieves an optional boolean environment variable.
   * - If the variable is set, returns `true` for `"true"` and `false` for `"false"`.
   * - If `defaultValue` is provided and the variable is not set, returns the default value.
   * @param envName - The name of the environment variable.
   * @param defaultValue - (Optional) The default boolean value if the variable is not set.
   * @returns The boolean value of the environment variable or the default value.
   */
  getOptionalBooleanEnv(envName: string): boolean | undefined;
  getOptionalBooleanEnv(envName: string, defaultValue: boolean): boolean;
  getOptionalBooleanEnv(envName: string, defaultValue?: boolean): boolean | undefined {
    return process.env[envName] ? process.env[envName] === "true" : defaultValue;
  }

  /**
   * Retrieves and validates a required environment variable as a URL.
   * - Ensures the variable is set and contains a valid URL.
   * - Terminates the process if the value is not a valid URL.
   * @param envName - The name of the environment variable.
   * @returns A `URL` object representing the value of the environment variable.
   * @throws Terminates the process if the variable is missing or not a valid URL.
   */
  getRequiredURL(envName: string): URL {
    const envVal = this.getRequiredEnv(envName);

    try {
      return new URL(envVal);
    } catch (err: unknown) {
      this.stopProcess(`Variable '${envName}' must be a valid URL. Error: ${this.getErrorMessage(err)}`);
    }
  }

  /**
   * Retrieves an optional environment variable as a URL.
   * - If the variable is set and a valid URL, returns a `URL` object.
   * - If `defaultValue` is provided and the variable is not set, returns the default `URL`.
   * - Terminates the process if the variable is set but not a valid URL.
   * @param envName - The name of the environment variable.
   * @param defaultValue - (Optional) The default URL value to return if the variable is not set.
   * @returns A `URL` object representing the value of the environment variable or the default value.
   * @throws Terminates the process if the variable is set but not a valid URL.
   */
  getOptionalURL(envName: string): URL | undefined;
  getOptionalURL(envName: string, defaultValue: URL): URL;
  getOptionalURL(envName: string, defaultValue?: URL): URL | undefined {
    const envVal = this.getOptionalEnv(envName);

    try {
      return envVal ? new URL(envVal) : defaultValue;
    } catch (err: unknown) {
      this.stopProcess(`Variable '${envName}' must be a valid URL. Error: ${this.getErrorMessage(err)}`);
    }
  }

  /**
   * Retrieves and parses a required time period from an environment variable.
   * - Ensures the environment variable is set and retrieves its value.
   * - Validates that the value follows the format: `<number><"ms"|"s"|"m"|"h"|"d">`.
   * - Converts the value to the specified time format.
   * - Terminates the process if the value is missing or invalid.
   * @param envName - The name of the required environment variable.
   * @param resultIn - The desired time unit for the result (default is `"ms"`).
   * @returns The parsed time period converted to the specified unit.
   * @throws Will stop the process if the environment variable is missing or has an invalid format.
   */
  getRequiredTimePeriod(envName: string, resultIn: TimeMarker = "ms") {
    const envVal = this.getRequiredEnv(envName);

    // validating the ENV value
    if (!isTimePeriod(envVal))
      this.stopProcess(
        `Variable '${envName}' is not in the acceptable format. It must be: <number><"ms"|"s"|"m"|"h"|"d">. Ex.: '12h', '2d', '2D', '2 d'`,
      );

    return parseTimePeriod(envVal, resultIn);
  }

  /**
   * Retrieves and parses an optional time period from an environment variable.
   * - If the environment variable is not set, it falls back to the provided default value.
   * - Validates that the value is in the acceptable format: `<number><"ms"|"s"|"m"|"h"|"d">`.
   * - Converts the value to the specified time format.
   * - Terminates the process if the value is invalid.
   * @param envName - The name of the environment variable to retrieve.
   * @param defaultValue - The default time period to use if the environment variable is not set.
   * @param resultIn - The desired time unit for the result (default is `"ms"`).
   * @returns The parsed time period converted to the specified unit.
   * @throws Will stop the process if the environment variable or default value is invalid.
   */
  getOptionalTimePeriod(envName: string, defaultValue: string, resultIn: TimeMarker = "ms"): number {
    const baseErrorMessage = `'${envName}' is not in the acceptable format. It must be: <number><"ms"|"s"|"m"|"h"|"d">. Ex.: '12h', '2d', '2D', '2 d'`;

    // validating the default value
    if (!isTimePeriod(defaultValue))
      this.stopProcess(`The default value for the environment variable ${baseErrorMessage}`);

    const envVal = process.env[envName];

    // validating the ENV value
    if (envVal && !isTimePeriod(envVal)) this.stopProcess(`Variable ${baseErrorMessage}`);

    return parseTimePeriod(envVal ?? defaultValue, resultIn);
  }

  /**
   * Retrieves and parses a required environment variable as an object.
   * - Ensures the environment variable is set.
   * - Parses the value from a JSON string into an object.
   * - Optionally validates and instantiates the object using a provided class.
   * - Terminates the process if parsing fails or if instantiation using the class fails.
   * @template R - The expected type of the parsed object.
   * @param envName - The name of the environment variable.
   * @param cls - (Optional) A class constructor to validate and instantiate the parsed object.
   * @returns The parsed object, optionally instantiated as an instance of `cls`.
   * @throws Terminates the process if the environment variable is missing, cannot be parsed, or fails validation.
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
    const envVal = this.getRequiredEnv(envName);

    const baseErrorMessage = `Cannot parse object from variable '${envName}'. Error:`;
    let parsedObj: Record<string, unknown>;

    try {
      parsedObj = JSON.parse(envVal);
    } catch (error: unknown) {
      this.stopProcess(`${baseErrorMessage} ${this.getErrorMessage(error)}`);
    }

    if (!cls) return parsedObj as C extends ClassConstructor<infer T> ? T : R;

    try {
      return new cls(parsedObj) as C extends ClassConstructor<infer T> ? T : R;
    } catch (error: unknown) {
      this.stopProcess(`${baseErrorMessage} ${this.getErrorMessage(error)}`);
    }
  }

  /**
   * Retrieves and parses an environment variable as an array.
   * @template R - The expected type of array elements.
   * @param envName - The name of the environment variable to retrieve.
   * @param validate - A function to validate each array element.
   * @returns The parsed array or `undefined` if optional.
   * @throws If the environment variable is missing, cannot be parsed, is not an array, or fails validation.
   * @example
   * this.forwardHeaders = this.envService.parseArrayFromEnv<string>('FORWARD_HEADERS');
   * @example
   * this.forwardHeaders = this.envService.parseArrayFromEnv<string>(
   *    'FORWARD_HEADERS',
   *    (el) => typeof el === 'string'
   * );
   * @example
   * this.forwardHeaders = this.envService.parseArrayFromEnv<[string, number]>(
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
    const envVal = this.getRequiredEnv(envName);
    const baseErrorMessage = `Cannot parse an array from variable '${envName}'. Error:`;
    let parsedArray: unknown[];

    try {
      parsedArray = JSON.parse(envVal);
    } catch (error: unknown) {
      this.stopProcess(`${baseErrorMessage} ${this.getErrorMessage(error)}`);
    }

    if (!Array.isArray(parsedArray)) this.stopProcess(`'${envName}' must be a stringified array`);

    if (typeof validate === "function") {
      // validate each element of parsed array
      parsedArray.forEach((el, i) => {
        const result = (validate as ArrayValidatorType<R>)(el, i, parsedArray as R extends unknown[] ? R : R[]);

        // check if validator works correct
        if (!["boolean", "string"].includes(typeof result) || result === "")
          this.stopProcess(
            `The validation func of EnvGetterService.getRequiredArray('${envName}') must return either boolean or string\nTrace ${
              new Error().stack
            }`,
          );

        // validate element
        if (result === false || (typeof result === "string" && result))
          this.stopProcess(typeof result === "string" ? result : `'${envName}[${i}]' failed validation`);
      });
    }

    return parsedArray as R extends unknown[] ? R : R[];
  }

  /**
   * Retrieves and parses a required configuration from a JSON file.
   * - Ensures the file exists.
   * - Reads and parses the JSON content.
   * - Optionally validates and instantiates using a provided class.
   * - Sets up a file watcher to automatically reload the config on file changes.
   * - Terminates the process if the file is missing, cannot be parsed, or fails validation.
   * @template R - The expected type of the parsed config.
   * @template C - The class constructor type (if provided).
   * @param filePath - The path to the config file (absolute or relative to process.cwd()).
   * @param cls - (Optional) A class constructor to validate and instantiate the parsed config.
   * @param watcherOptions - (Optional) Configuration for file watching behavior.
   * @returns The parsed config, optionally instantiated as an instance of `cls`. The returned value will always reflect the latest file content.
   * @throws Terminates the process if the file is missing, cannot be parsed, or fails validation.
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
  ): C extends ClassConstructor<infer T> ? T : R {
    const absolutePath = this.resolveFilePath(filePath);

    if (!existsSync(absolutePath)) this.stopProcess(`Config file '${absolutePath}' does not exist.`);

    // Check if already cached, return cached value
    if (absolutePath in this.configsStorage) {
      return this.configsStorage[absolutePath] as C extends ClassConstructor<infer T> ? T : R;
    }

    // Read and parse the file for the first time
    const config = this.readAndParseConfigFile<R, C>(absolutePath, cls);

    // Setup file watcher
    this.setupFileWatcher(absolutePath, cls, watcherOptions);

    return config;
  }

  /**
   * Retrieves and parses an optional configuration from a JSON file.
   * - If the file exists, reads and parses the JSON content.
   * - If the file doesn't exist and a default value is provided, returns the default value.
   * - If the file doesn't exist and no default value is provided, returns undefined.
   * - Optionally validates and instantiates using a provided class.
   * - Sets up a file watcher to automatically reload the config on file changes (if file exists).
   * - Terminates the process if the file exists but cannot be parsed or fails validation.
   * @template R - The expected type of the parsed config.
   * @template C - The class constructor type (if provided).
   * @param filePath - The path to the config file (absolute or relative to process.cwd()).
   * @param defaultValue - (Optional) The default value to return if the file doesn't exist.
   * @param cls - (Optional) A class constructor to validate and instantiate the parsed config.
   * @param watcherOptions - (Optional) Configuration for file watching behavior.
   * @returns The parsed config, the default value, or undefined. The returned value will always reflect the latest file content if the file exists.
   * @throws Terminates the process if the file exists but cannot be parsed or fails validation.
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
  ): InstanceType<C> | undefined;
  getOptionalConfigFromFile<R, C extends ClassConstructor<unknown>>(
    filePath: string,
    defaultValue: R,
    cls: C,
    watcherOptions: FileWatcherOptions,
  ): InstanceType<C>;
  getOptionalConfigFromFile<R, C extends ClassConstructor<unknown>>(
    filePath: string,
    defaultValue: R,
    cls: C,
  ): InstanceType<C>;
  getOptionalConfigFromFile<C extends ClassConstructor<unknown>>(filePath: string, cls: C): InstanceType<C> | undefined;
  getOptionalConfigFromFile<R>(filePath: string, defaultValue: R): R;
  getOptionalConfigFromFile<R = unknown>(filePath: string): R | undefined;
  getOptionalConfigFromFile<R = unknown, C extends ClassConstructor<unknown> | undefined = undefined>(
    filePath: string,
    defaultValueOrCls?: R | C,
    clsOrWatcherOptions?: C | FileWatcherOptions,
    watcherOptions?: FileWatcherOptions,
  ): any {
    const absolutePath = this.resolveFilePath(filePath);

    // If file doesn't exist
    if (!existsSync(absolutePath)) {
      // Check if defaultValueOrCls is a class constructor
      if (typeof defaultValueOrCls === "function") {
        return undefined;
      }
      return defaultValueOrCls;
    }

    // Check if already cached, return cached value
    if (absolutePath in this.configsStorage) {
      return this.configsStorage[absolutePath];
    }

    // Determine the parameters
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
      // Pattern: (filePath) or (filePath, defaultValue)
      cls = undefined;
      options = clsOrWatcherOptions as FileWatcherOptions | undefined;
    }

    // Read and parse the file
    const config = this.readAndParseConfigFile<R, C>(absolutePath, cls);

    // Setup file watcher
    this.setupFileWatcher(absolutePath, cls, options);

    return config;
  }

  /*****************************************************************************************
   *                                   PRIVATE METHODS                                     *
   *****************************************************************************************/

  private getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : JSON.stringify(error);
  }

  /**
   * Logs an error message in red and terminates the process.
   * @param message - The error message to display before exiting.
   * @throws Never returns; always exits the process.
   * @private
   */
  private stopProcess(message: string): never {
    // eslint-disable-next-line no-console
    console.log("\x1b[31m%s\x1b[0m", message);
    process.exit(1);
  }

  /**
   * Checks if an environment variable exists.
   * - If the variable is missing, the process is terminated.
   * - If the variable exists, returns `true`.
   * @param envName - The name of the environment variable to check.
   * @returns `true` if the environment variable exists.
   * @throws Terminates the process if the variable is missing.
   * @private
   */
  private checkEnvExisting(envName: string): boolean | never {
    if (!process.env.hasOwnProperty(envName)) this.stopProcess(`Missing '${envName}' environment variable`);
    return true;
  }

  /**
   * Validates whether an environment variable contains an allowed value.
   * - If the variable's value is not in the allowed list, the process is terminated.
   * @param envName - The name of the environment variable.
   * @param envVal - The current value of the environment variable.
   * @param allowedValues - An array of allowed values for the variable.
   * @throws Terminates the process if `envVal` is not in the allowed list.
   * @private
   */
  private checkIfEnvHasAllowedValue(envName: string, envVal: string | null, allowedValues: string[]): void | never {
    if (!envVal || !allowedValues.includes(envVal))
      this.stopProcess(`Variable '${envName}' can be only one of: [${allowedValues}], but received '${envVal}'`);
  }

  /**
   * Resolves a file path to an absolute path.
   * - If the path is already absolute, returns it as-is.
   * - If the path is relative, resolves it from the current working directory.
   * @param filePath - The file path to resolve.
   * @returns The absolute file path.
   * @private
   */
  private resolveFilePath(filePath: string): string {
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
   * @param filePath - The absolute path to the config file.
   * @param cls - (Optional) A class constructor to validate and instantiate the parsed config.
   * @returns The parsed config, optionally instantiated as an instance of `cls`.
   * @throws Terminates the process if the file cannot be read, parsed, or validated.
   * @private
   */
  private readAndParseConfigFile<R = unknown, C extends ClassConstructor<unknown> | undefined = undefined>(
    filePath: string,
    cls?: C,
  ): C extends ClassConstructor<infer T> ? T : R {
    const baseErrorMessage = `Cannot read config from file '${filePath}'.`;

    let fileContent: string;
    try {
      fileContent = readFileSync(filePath, "utf-8");
    } catch (error: unknown) {
      this.stopProcess(`${baseErrorMessage} Error reading file: ${this.getErrorMessage(error)}`);
    }

    let parsedConfig: Record<string, unknown>;
    try {
      parsedConfig = JSON.parse(fileContent);
    } catch (error: unknown) {
      this.stopProcess(`${baseErrorMessage} Invalid JSON format: ${this.getErrorMessage(error)}`);
    }

    if (!cls) {
      // For plain objects, check if we need to update existing object or create new one
      const existingConfig = this.configsStorage[filePath];
      if (existingConfig && typeof existingConfig === "object") {
        // Update existing object properties to preserve references
        Object.keys(existingConfig).forEach((key) => delete existingConfig[key]);
        Object.assign(existingConfig, parsedConfig);
        return existingConfig as C extends ClassConstructor<infer T> ? T : R;
      } else {
        this.configsStorage[filePath] = parsedConfig;
        return parsedConfig as C extends ClassConstructor<infer T> ? T : R;
      }
    }

    try {
      // Validate by creating a temporary instance
      const tempInstance = new cls(parsedConfig);

      // Check if an instance already exists in cache
      const existingInstance = this.configsStorage[filePath];
      if (existingInstance) {
        // Update existing instance properties to preserve references
        Object.keys(existingInstance).forEach((key) => delete existingInstance[key]);
        Object.assign(existingInstance, tempInstance);
        return existingInstance as C extends ClassConstructor<infer T> ? T : R;
      } else {
        // First time - store the new instance
        this.configsStorage[filePath] = tempInstance;
        return tempInstance as C extends ClassConstructor<infer T> ? T : R;
      }
    } catch (error: unknown) {
      this.stopProcess(`${baseErrorMessage} Validation failed: ${this.getErrorMessage(error)}`);
    }
  }

  /**
   * Sets up a file watcher for a configuration file.
   * - Watches for file changes and automatically re-reads and updates the cached config.
   * - Applies debouncing to avoid excessive re-reads.
   * @param filePath - The absolute path to the config file.
   * @param cls - (Optional) A class constructor to validate and instantiate the parsed config.
   * @param options - File watcher configuration options.
   * @private
   */
  private setupFileWatcher<C extends ClassConstructor<unknown> | undefined = undefined>(
    filePath: string,
    cls?: C,
    options?: FileWatcherOptions,
  ): void {
    const watcherOptions: Required<FileWatcherOptions> = {
      enabled: options?.enabled ?? true,
      debounceMs: options?.debounceMs ?? 200,
    };

    if (!watcherOptions.enabled || this.fileWatchers.has(filePath)) return;

    let debounceTimer: NodeJS.Timeout | null = null;

    const watcher = watch(filePath, (eventType) => {
      if (eventType === "change") {
        if (debounceTimer) clearTimeout(debounceTimer);

        debounceTimer = setTimeout(() => {
          this.readAndParseConfigFile(filePath, cls);
        }, watcherOptions.debounceMs);
      }
    });

    this.fileWatchers.set(filePath, watcher);
  }
}
