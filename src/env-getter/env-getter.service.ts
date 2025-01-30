import { Injectable } from "@nestjs/common";
import { config } from "dotenv";
import { isTimePeriod, parseTimePeriod, type ClassConstructor, type TimeMarker } from "../shared";

@Injectable()
export class EnvGetterService {
  constructor() {
    config();
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
      this.stopProcess(
        `Variable '${envName}' can be only one of: ${JSON.stringify(allowedValues)}, but received '${envVal}'`,
      );
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
    } catch (_) {
      this.stopProcess(`Variable '${envName}' must be a valid URL`);
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
    } catch (_) {
      this.stopProcess(`Variable '${envName}' must be a valid URL`);
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
  getRequiredObject<R = any, C extends ClassConstructor<any> | undefined = undefined>(
    envName: string,
    cls?: C,
  ): C extends ClassConstructor<infer T> ? T : R {
    const envVal = this.getRequiredEnv(envName);

    const baseErrorMessage = `Cannot parse object from variable '${envName}'. Error:`;
    let parsedObj: Record<string, any>;

    try {
      parsedObj = JSON.parse(envVal);
    } catch (error: any) {
      this.stopProcess(`${baseErrorMessage} ${error.message}`);
    }

    if (!cls) return parsedObj as any;

    try {
      return new cls(parsedObj);
    } catch (error: any) {
      this.stopProcess(`${baseErrorMessage} ${error.message}`);
    }
  }

  /**
   * Gets the value of the variable and parse it to an array.
   * @param envName - The name of the environment variable.
   * @param cls - The class for instantiating from the plain object parsed from the env.
   * @param validationOptions - Validation options.
   * @param validationOptions.optional - Shows if the ENV is optional. By default it's required.
   * @param validationOptions.validate - A callback for validation each element of an array.
   * @throws An error if variable is not set, it's impossible to parse, or the 'cls' throws validation error during instantiating.
   * @example
   * this.forwardHeaders = this.envService.parseArrayFromEnv<string>('FORWARD_HEADERS');
   * @example
   * this.forwardHeaders = this.envService.parseArrayFromEnv<string>('FORWARD_HEADERS', {
   *   optional: true,
   *   validate: (el) => typeof el === 'string'
   * });
   * @example
   * this.forwardHeaders = this.envService.parseArrayFromEnv<[string, number]>('FORWARD_HEADERS', {
   *   optional: true,
   *   validate: (el, i, arr) => {
   *     if (arr?.length !== 2) return 'FORWARD_HEADERS must be an array of 2 valid items';
   *     if (i === 0 && typeof el === 'string') return true;
   *     if (i === 1 && typeof el === 'number') return true;
   *     return false;
   *   }
   * });
   * @example
   * this.forwardHeaders = this.envService.parseArrayFromEnv<[string, number]>('FORWARD_HEADERS', {
   *   optional: true,
   *   validate: (el, i) => {
   *     if (i === 0 && typeof el !== 'string') return 'FORWARD_HEADERS[0] must be a string';
   *     if (i === 1 && typeof el !== 'number') return 'FORWARD_HEADERS[1] must be a number';
   *     return true;
   *   }
   * });
   */
  // parseArrayFromEnv<R = any>(envName: string): R extends any[] ? R : R[];
  // parseArrayFromEnv<R = any>(
  //   envName: string,
  //   validationOptions: { optional: true; validate?: ArrayValidatorType<R> },
  // ): (R extends any[] ? R : R[]) | undefined;
  // parseArrayFromEnv<R = any>(
  //   envName: string,
  //   validationOptions: { optional?: false | undefined; validate?: ArrayValidatorType<R> },
  // ): R extends any[] ? R : R[];
  // parseArrayFromEnv<R = any>(
  //   envName: string,
  //   validationOptions?: { optional?: boolean; validate?: ArrayValidatorType<R> },
  // ): (R extends any[] ? R : R[]) | undefined {
  //   if (validationOptions?.optional && !this.isEnvSet(envName)) return;

  //   const envVal = this.getRequiredEnv(envName);
  //   const baseErrorMessage = `Cannot parse object from variable '${envName}'. Error:`;
  //   let parsedArray: unknown[];

  //   try {
  //     parsedArray = JSON.parse(envVal);
  //   } catch (error: any) {
  //     this.stopProcess(`${baseErrorMessage} ${error.message}`);
  //   }

  //   if (!Array.isArray(parsedArray)) this.stopProcess(`'${envName}' must be a stringified array`);

  //   if (typeof validationOptions?.validate === "function") {
  //     // validate each element of parsed array
  //     parsedArray.forEach((el, i) => {
  //       const result = (validationOptions.validate as ArrayValidatorType<R>)(el, i, parsedArray as any);

  //       // check if validator works correct
  //       if (!["boolean", "string"].includes(typeof result) || result === "")
  //         this.stopProcess(
  //           `The validation func of EnvService.parseArrayFromEnv('${envName}') must return either boolean or string\nTrace ${
  //             new Error().stack
  //           }`,
  //         );

  //       // validate element
  //       if (result === false || (typeof result === "string" && result))
  //         this.stopProcess(typeof result === "string" ? result : `'${envName}[${i}]' failed validation`);
  //     });
  //   }

  //   return parsedArray as R extends any[] ? R : R[];
  // }
}
