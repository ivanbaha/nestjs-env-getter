import { Injectable } from "@nestjs/common";
import { config } from "dotenv";
import { ClassConstructor, TimeFormat, type ArrayValidatorType } from "./types";

@Injectable()
export class EnvService {
  constructor() {
    config();
  }

  private stopProcess(message: string): never {
    // eslint-disable-next-line no-console
    console.log("\x1b[31m%s\x1b[0m", message);
    process.exit(1);
  }

  private checkEnvExisting(envName: string): boolean | never {
    if (!process.env.hasOwnProperty(envName)) this.stopProcess(`Missing '${envName}' environment variable`);
    return true;
  }

  private checkIfEnvHasAllowedValue(envName: string, envVal?: string, allowedValues?: string[]): void | never {
    if (!allowedValues?.length) this.stopProcess(`You didn't specify allowed values for variable ${envName}`);

    if (!envVal || !allowedValues.includes(envVal))
      this.stopProcess(
        `Environment variable '${envName}' can be only one of: ${JSON.stringify(
          allowedValues,
        )}, but received '${envVal}'`,
      );
  }

  /**
   * Checks if variable is set.
   * @param envName - The name of the environment variable.
   * @returns True if it's set or false if it's not.
   */
  isEnvSet(envName: string): boolean {
    return process.env.hasOwnProperty(envName);
  }

  /**
   * Retrieves a string value of required environment variable.
   * Stops the entire Nodejs process in case the ENV is missing.
   * @param envName - The name of the environment variable.
   * @param allowedValues - The list of allowed values for the environment variable.
   * @returns The value of the ENV.
   */
  getRequiredEnv(envName: string): string;
  getRequiredEnv(envName: string, allowedValues: string[]): string;
  getRequiredEnv(envName: string, allowedValues?: string[]): string {
    this.checkEnvExisting(envName);

    if (allowedValues?.length) this.checkIfEnvHasAllowedValue(envName, process.env[envName], allowedValues);

    return String(process.env[envName]);
  }

  /**
   * Retrieves a string value of an optional environment variable.
   * @param envName - The name of the environment variable.
   * @param defaultValue - The default value for the case when the environment variable is not set.
   * @param allowedValues - The list of allowed values for validation environment variable by.
   * @returns The value of the ENV, the default value, or undefined.
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

      this.checkIfEnvHasAllowedValue(envName, envValue, defaultValueOrAllowedValues);

      return envValue;
    } else {
      const envValue = process.env[envName] || defaultValueOrAllowedValues;

      if (allowedValues?.length) this.checkIfEnvHasAllowedValue(envName, envValue, allowedValues);

      return envValue;
    }
  }

  /**
   * Retrieves a decimal numeric value of the required environment variable.
   * Stops the entire Nodejs process in case the ENV is missing.
   * @param envName - The name of the environment variable.
   * @returns Decimal numeric value of the required environment variable.
   */
  getRequiredNumericEnv(envName: string): number {
    const envVal = this.getRequiredEnv(envName);

    if (!/^[0-9_]+$/.test(envVal)) this.stopProcess(`Variable '${envName}' is not of number type.`);

    return Number(envVal.replace(/_/g, ""));
  }

  /**
   * Retrieves a decimal numeric value of the optional environment variable.
   * @param envName - The name of the environment variable.
   * @param defaultValue - The default value for the case when the environment variable is not set.
   * @returns The value of the ENV, the default value, or undefined.
   */
  getOptionalNumericEnv(envName: string): number | undefined;
  getOptionalNumericEnv(envName: string, defaultValue: number): number;
  getOptionalNumericEnv(envName: string, defaultValue?: number): number | undefined {
    const envVal = String(process.env[envName]);

    return /^[0-9_]+$/.test(envVal) ? Number(envVal.replace(/_/g, "")) : defaultValue;
  }

  /**
   * Retrieves the value of required boolean environment variable.
   * Stops the entire Nodejs process in case the ENV is missing.
   * @param envName - The name of the environment variable.
   * @returns True if the ENV is set and its value equals to 'true', or False otherwise.
   */
  getRequiredBooleanEnv(envName: string): boolean {
    const envVal = this.getRequiredEnv(envName);

    if (!/true|false/.test(envVal)) this.stopProcess(`Variable '${envName}' is not of boolean type.`);

    return envVal === "true";
  }

  /**
   * Retrieves the value of optional boolean environment variable.
   * If the env isn't set default value will be returned.
   * @param envName - The name of the environment variable.
   * @param defaultValue - The default value for the case when the environment variable is not set.
   * @returns True if the ENV is set and its value equals to 'true', or False otherwise; default value or undefined if the ENV is not set.
   */
  getOptionalBooleanEnv(envName: string): boolean | undefined;
  getOptionalBooleanEnv(envName: string, defaultValue: boolean): boolean;
  getOptionalBooleanEnv(envName: string, defaultValue?: boolean): boolean | undefined {
    return process.env[envName] ? process.env[envName] === "true" : defaultValue;
  }

  /**
   * Retrieves the value of required environment variable and creates a URL.
   * ENV value must be a valid URL string.
   * @param envName - The name of the environment variable.
   * @returns The URL object, created from the ENV value.
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
   * Retrieves the value of optional environment variable and creates a URL.
   * ENV value must be a valid URL string.
   * @param envName - The name of the environment variable.
   * @returns The URL object, created from the ENV value, default value, or undefined.
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
   * Converts a Time Period value from an Env into number according to "outTimeIn" option.
   * Input value must be in format: <number><timeFormat>, where 'timeFormat' is one of: "ms" | "s" | "m" | "h" | "d".
   * "timeFormat" is optional and has default value "ms".
   * @param envName - The name of the environment variable.
   * @param defaultValue - The default time period in the acceptable format.
   * @param outTimeIn - The default time period in the acceptable format. [Default: "ms"].
   * @returns - The numbered time period.
   */
  getOptionalTimePeriod(envName: string, defaultValue: string, outTimeIn: TimeFormat = "ms"): number {
    const val = process.env[envName] || defaultValue;

    if (!/^\d+ *[(?=.*s)(?=.*m)(?=.*h)(?=.*d)]{0,1}$/i.test(val))
      this.stopProcess(
        `Variable '${envName}' is not in the acceptable format. It must be: <number><"ms"|"s"|"m"|"h"|"d">. Ex.: '12h', '2d', '2D', '2 d'`,
      );

    const [, numb, pointer] = /^(\d+) *([(?=.*s)(?=.*m)(?=.*h)(?=.*d)]{0,1})$/i.exec(val) ?? [];
    const timePointer = (pointer?.toLowerCase() || "ms") as TimeFormat;

    const mapper: Record<TimeFormat, number> = {
      ms: 1,
      s: 1_000,
      m: 60_000,
      h: 3_600_000,
      d: 86_400_000,
    };

    const multiplier = outTimeIn === timePointer ? 1 : mapper[timePointer] / mapper[outTimeIn];

    return Number(numb) * multiplier;
  }

  /**
   * Gets the value of the variable and parse it to an object.
   * @param envName - The name of the environment variable.
   * @param cls - The class for instantiating from the plain object parsed from the env.
   * @throws An error if variable is not set, it's impossible to parse, or the 'cls' throws validation error during instantiating.
   */
  parseObjectFromEnv<R = any>(envName: string, cls?: ClassConstructor<R>): R {
    const envVal = this.getRequiredEnv(envName);
    const baseErrorMessage = `Cannot parse object from variable '${envName}'. Error:`;
    let parsedObj: Record<string, any>;

    try {
      parsedObj = JSON.parse(envVal);
    } catch (error: any) {
      this.stopProcess(`${baseErrorMessage} ${error.message}`);
    }

    if (!cls) return parsedObj as R;

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
  parseArrayFromEnv<R = any>(envName: string): R extends any[] ? R : R[];
  parseArrayFromEnv<R = any>(
    envName: string,
    validationOptions: { optional: true; validate?: ArrayValidatorType<R> },
  ): (R extends any[] ? R : R[]) | undefined;
  parseArrayFromEnv<R = any>(
    envName: string,
    validationOptions: { optional?: false | undefined; validate?: ArrayValidatorType<R> },
  ): R extends any[] ? R : R[];
  parseArrayFromEnv<R = any>(
    envName: string,
    validationOptions?: { optional?: boolean; validate?: ArrayValidatorType<R> },
  ): (R extends any[] ? R : R[]) | undefined {
    if (validationOptions?.optional && !this.isEnvSet(envName)) return;

    const envVal = this.getRequiredEnv(envName);
    const baseErrorMessage = `Cannot parse object from variable '${envName}'. Error:`;
    let parsedArray: unknown[];

    try {
      parsedArray = JSON.parse(envVal);
    } catch (error: any) {
      this.stopProcess(`${baseErrorMessage} ${error.message}`);
    }

    if (!Array.isArray(parsedArray)) this.stopProcess(`'${envName}' must be a stringified array`);

    if (typeof validationOptions?.validate === "function") {
      // validate each element of parsed array
      parsedArray.forEach((el, i) => {
        const result = (validationOptions.validate as ArrayValidatorType<R>)(el, i, parsedArray as any);

        // check if validator works correct
        if (!["boolean", "string"].includes(typeof result) || result === "")
          this.stopProcess(
            `The validation func of EnvService.parseArrayFromEnv('${envName}') must return either boolean or string\nTrace ${
              new Error().stack
            }`,
          );

        // validate element
        if (result === false || (typeof result === "string" && result))
          this.stopProcess(typeof result === "string" ? result : `'${envName}[${i}]' failed validation`);
      });
    }

    return parsedArray as R extends any[] ? R : R[];
  }
}
