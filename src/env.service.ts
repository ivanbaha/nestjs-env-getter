import { Injectable } from "@nestjs/common";
import * as dotenv from "dotenv";
import { SKIP_ENV, SKIP_REQUIRED_ENVS_VAR } from "./env.const";
import { ClassConstructor, TimeFormat, type ArrayValidatorType } from "./types";

@Injectable()
export class EnvService {
  constructor() {
    dotenv.config();
  }

  private throwError(message: string): never {
    console.log("\x1b[31m%s\x1b[0m", message);
    process.exit(1);
  }

  private checkEnvExisting(envName: string): boolean {
    if (!process.env.hasOwnProperty(envName)) this.throwError(`Missing '${envName}' environment variable`);
    return true;
  }

  private checkIfEnvHasAllowedValue(envName: string, envVal?: string, allowedValues?: string[]): void | never {
    if (!allowedValues?.length) this.throwError(`You didn't specify allowed values for variable ${envName}`);

    if (!envVal || !allowedValues.includes(envVal))
      this.throwError(
        `Environment variable '${envName}' can be only one of: ${JSON.stringify(
          allowedValues
        )}, but received '${envVal}'`
      );
  }

  /**
   * Check if variable is set. Returns true if it's set or false if it's not.
   * @param envName - The name of the environment variable.
   */
  isEnvSet(envName: string): boolean {
    return process.env.hasOwnProperty(envName);
  }

  /**
   * Returns a value of required environment variable.
   * Throws an error if it was not set.
   * @param envName - The name of the environment variable.
   * @param allowedValues - The list of allowed values for current environment variable.
   */
  getRequiredEnv(envName: string): string;
  getRequiredEnv(envName: string, allowedValues: string[]): string;
  getRequiredEnv(envName: string, allowedValues?: string[]): string {
    if (process.env[SKIP_REQUIRED_ENVS_VAR] === "true") return SKIP_ENV;

    this.checkEnvExisting(envName);
    if (allowedValues?.length) this.checkIfEnvHasAllowedValue(envName, process.env[envName], allowedValues);

    return String(process.env[envName]);
  }

  /**
   * Returns a string value of the optional environment variable.
   * Returns the default value or undefined if the environment variable was not set.
   * @param envName - The name of the environment variable.
   * @param defaultValue - The value returned if the environment variable was not set.
   * @param allowedValues - The list of allowed values for current environment variable.
   */
  getOptionalEnv(envName: string): string | undefined;
  getOptionalEnv(envName: string, defaultValue: string): string;
  getOptionalEnv(envName: string, allowedValues: string[]): string | undefined;
  getOptionalEnv(envName: string, defaultValue: string, allowedValues: string[]): string | undefined;
  getOptionalEnv(
    envName: string,
    defaultValueOrAllowedValues?: string | string[],
    allowedValues?: string[]
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
   * Returns a decimal numeric value of the optional environment variable.
   * Returns the default value if the environment variable was not set.
   * @param envName - The name of the environment variable.
   * @param defaultValue - The value returned if the environment variable was not set.
   */
  getNumericEnv(envName: string): number | undefined;
  getNumericEnv(envName: string, defaultValue: number): number;
  getNumericEnv(envName: string, defaultValue?: number): number | undefined {
    const envVal = String(process.env[envName]);
    return /^[0-9_]+$/.test(envVal) ? Number(envVal.replace("_", "")) : defaultValue;
  }

  /**
   * Returns a decimal numeric value of the required environment variable.
   * Throws an error if it is not set.
   * @param envName - The name of the environment variable.
   */
  getRequiredNumericEnv(envName: string): number {
    const envVal = this.getRequiredEnv(envName);
    if (envVal === "skip_variable") return 1;
    if (!/^[0-9_]+$/.test(envVal)) this.throwError(`Variable '${envName}' is not of number type.`);
    return Number(envVal.replace("_", ""));
  }

  /**
   * Returns true if environment variable was set and its value equals 'true'. Otherwise returns false.
   * @param envName - The name of the environment variable.
   */
  getBooleanEnv(envName: string): boolean {
    return process.env[envName] === "true";
  }

  /**
   * Returns true if environment variable was set and its value equals 'true' or false if it has different value.
   * If the env isn't set default value will be returned.
   *
   * @param envName - The name of the environment variable.
   */
  getOptionalBooleanEnv(envName: string): boolean | undefined;
  getOptionalBooleanEnv(envName: string, defaultValue: boolean): boolean;
  getOptionalBooleanEnv(envName: string, defaultValue?: boolean): boolean | undefined {
    return process.env[envName] ? process.env[envName] === "true" : defaultValue;
  }

  /**
   * Returns true if environment variable was set and its value equals 'true'. Otherwise returns false.
   * Throws an error if variable is not of boolean type.
   * @param envName - The name of the environment variable.
   */
  getRequiredBooleanEnv(envName: string): boolean {
    const envVal = this.getRequiredEnv(envName);
    if (envVal === "skip_variable") return false;
    if (!/true|false/.test(envVal)) this.throwError(`Variable '${envName}' is not of boolean type.`);

    return envVal === "true";
  }

  /**
   * Gets the value of the variable and parse it to an object.
   *
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
      this.throwError(`${baseErrorMessage} ${error.message}`);
    }

    if (!cls) return parsedObj as R;

    try {
      return new cls(parsedObj);
    } catch (error: any) {
      this.throwError(`${baseErrorMessage} ${error.message}`);
    }
  }

  /**
   * Gets the value of the variable and parse it to an array.
   *
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
    validationOptions: { optional: true; validate?: ArrayValidatorType<R> }
  ): (R extends any[] ? R : R[]) | undefined;
  parseArrayFromEnv<R = any>(
    envName: string,
    validationOptions: { optional?: false | undefined; validate?: ArrayValidatorType<R> }
  ): R extends any[] ? R : R[];
  parseArrayFromEnv<R = any>(
    envName: string,
    validationOptions?: { optional?: boolean; validate?: ArrayValidatorType<R> }
  ): (R extends any[] ? R : R[]) | undefined {
    if (validationOptions?.optional && !this.isEnvSet(envName)) return;

    const envVal = this.getRequiredEnv(envName);
    const baseErrorMessage = `Cannot parse object from variable '${envName}'. Error:`;
    let parsedArray: unknown[];

    try {
      parsedArray = JSON.parse(envVal);
    } catch (error: any) {
      this.throwError(`${baseErrorMessage} ${error.message}`);
    }

    if (!Array.isArray(parsedArray)) this.throwError(`'${envName}' must be a stringified array`);

    if (typeof validationOptions?.validate === "function") {
      // validate each element of parsed array
      parsedArray.forEach((el, i) => {
        const result = (validationOptions.validate as ArrayValidatorType<R>)(el, i, parsedArray as any);

        // check if validator works correct
        if (!["boolean", "string"].includes(typeof result) || result === "")
          this.throwError(
            `The validation func of EnvService.parseArrayFromEnv('${envName}') must return either boolean or string\nTrace ${
              new Error().stack
            }`
          );

        // validate element
        if (result === false || (typeof result === "string" && result))
          this.throwError(typeof result === "string" ? result : `'${envName}[${i}]' failed validation`);
      });
    }

    return parsedArray as R extends any[] ? R : R[];
  }

  /**
   * Converts a Time Period value from an Env into number according to "outTimeIn" option.
   * Input value must be in format: <number><timeFormat>, where 'timeFormat' is one of: "ms" | "s" | "m" | "h" | "d".
   * "timeFormat" is optional and has default value "ms".
   *
   * @param envName - The name of the environment variable.
   * @param defaultValue - The default time period in the acceptable format.
   * @param outTimeIn - The default time period in the acceptable format. [Default: "ms"].
   * @returns - The numbered time period.
   */
  getTimePeriod(envName: string, defaultValue: string, outTimeIn: TimeFormat = "ms"): number {
    const val = process.env[envName] || defaultValue;

    if (!/^\d+ *[(?=.*s)(?=.*m)(?=.*h)(?=.*d)]{0,1}$/i.test(val))
      this.throwError(
        `Variable '${envName}' is not in the acceptable format. It must be: <number><"ms"|"s"|"m"|"h"|"d">. Ex.: '12h', '2d', '2D', '2 d'`
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
   * Gets the URL Env.
   * Env value must be a valid URL string.
   *
   * @param envName - The name of the environment variable.
   * @returns - The URL href string.
   */
  getRequiredURL(envName: string): string {
    const envVal = this.getRequiredEnv(envName);

    // skip envs flow
    if (envVal === SKIP_ENV) return `http://${SKIP_ENV}.com`;

    try {
      return new URL(envVal).href;
    } catch (_) {
      this.throwError(`'${envName}' must be a valid URL`);
    }
  }

  /**
   * Gets the URL from optional Env.
   * If the Env is unset undefined will be returned.
   *
   * @param envName - The name of the environment variable.
   * @returns - The URL href from the Env or default value or undefined.
   */
  getOptionalURL(envName: string): string | undefined;
  getOptionalURL(envName: string, defaultValue: string): string;
  getOptionalURL(envName: string, defaultValue?: string): string | undefined {
    const envVal = this.getOptionalEnv(envName) ?? defaultValue;

    try {
      return envVal ? new URL(envVal).href : undefined;
    } catch (_) {
      this.throwError(`'${envName}' must be a valid URL`);
    }
  }
}
