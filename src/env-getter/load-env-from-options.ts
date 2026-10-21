import { loadEnvFile, loadEnvFiles } from "../shared/utils";
import { type EnvGetterModuleOptions } from "./types";

/**
 * Validates `EnvGetterModuleOptions` and loads `.env` file(s) into `process.env` when enabled.
 * @param options - Module startup options for `EnvGetterService`.
 * @throws {Error} If both `env` and a non-`false` `envFilePath` are provided.
 */
export function loadEnvFromOptions(options?: EnvGetterModuleOptions): void {
  if (options?.env !== undefined) {
    if (options.envFilePath !== undefined && options.envFilePath !== false) {
      throw new Error("envFilePath cannot be combined with env");
    }
    return;
  }

  const envFilePath = options?.envFilePath;
  if (envFilePath === false) {
    return;
  }

  if (Array.isArray(envFilePath)) {
    loadEnvFiles(envFilePath, { quiet: true });
  } else {
    loadEnvFile(envFilePath ?? ".env", { quiet: true });
  }
}
