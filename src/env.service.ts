import { Injectable } from "@nestjs/common";
import * as dotenv from "dotenv";

type TimeFormat = "ms" | "s" | "m" | "h" | "d";

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

  /**
   * Check if variabe is set. Returns true if it's set or false if it's not.
   * @param envName The name of the environment variable.
   */
  isEnvSet(envName: string): boolean {
    return process.env.hasOwnProperty(envName);
  }

  /**
   * Returns a value of required environment variable.
   * Throws an error if it was not set.
   * @param envName The name of the environment variable.
   */
  getRequiredEnv(envName: string): string {
    if (process.env.hasOwnProperty("SKIP_REQUIRED_ENVS")) return "skip_variable";

    return String(this.checkEnvExisting(envName) && process.env[envName]);
  }

  /**
   * Returns a string value of the optional environment variable.
   * Returns the default value or undefined if the environment variable was not set.
   * @param envName The name of the environment variable.
   * @param defaultValue The value returned if the environment variable was not set.
   */
  getOptionalEnv(envName: string): string | undefined;
  getOptionalEnv(envName: string, defaultValue: string): string;
  getOptionalEnv(envName: string, defaultValue?: string): string | undefined {
    return process.env[envName] || defaultValue;
  }

  /**
   * Returns a decimal numeric value of the optional environment variable.
   * Returns the default value if the environment variable was not set.
   * @param envName The name of the environment variable.
   * @param defaultValue The value returned if the environment variable was not set.
   */
  getNumericEnv(envName: string, defaultValue: number): number {
    const envVal = String(process.env[envName]);
    return /^[0-9]+$/.test(envVal) ? parseInt(envVal, 10) : defaultValue;
  }

  /**
   * Returns a decimal numeric value of the required environment variable.
   * Throws an error if it is not set.
   * @param envName The name of the environment variable.
   */
  getRequiredNumericEnv(envName: string): number {
    const envVal = this.getRequiredEnv(envName);
    if (envVal === "skip_variable") return 1;
    if (!/^[0-9]+$/.test(envVal)) this.throwError(`Variable '${envName}' is not of number type.`);
    return parseInt(envVal, 10);
  }

  /**
   * Returns true if environment variable was set and its value equals 'true'. Otherwise returns false.
   * @param envName The name of the environment variable.
   */
  getBooleanEnv(envName: string): boolean {
    return process.env[envName] === "true";
  }

  /**
   * Returns true if environment variable was set and its value equals 'true'. Otherwise returns false.
   * Throws an error if varialbe is not of boolean type.
   * @param envName The name of the environment variable.
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
   * @throws an error if variable is not set or it's impossible to parse.
   */
  parseObjectFromEnv<R = any>(envName: string) {
    const envVal = this.getRequiredEnv(envName);

    try {
      return JSON.parse(envVal) as R;
    } catch (error: any) {
      this.throwError(`Cannot parse object from variable '${envName}'. Error: ${error.message}`);
    }
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

    const mapper: Record<TimeFormat, number> = { ms: 1, s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 };

    const multiplier = outTimeIn === timePointer ? 1 : mapper[timePointer] / mapper[outTimeIn];

    return Number(numb) * multiplier;
  }
}
