/**
 * Options for configuring EnvGetterModule behaviour at startup.
 * Pass via `EnvGetterModule.forRoot(options)`.
 */
export type EnvGetterModuleOptions = {
  /**
   * `.env` file path(s) to load at startup.
   * Set to `false` to disable implicit `.env` loading entirely.
   * @default ".env"
   */
  envFilePath?: string | string[] | false;
  /**
   * Confine `getRequiredConfigFromFile` / `getOptionalConfigFromFile` resolution to this
   * directory. Any path that would escape the base dir causes a `stopProcess` error.
   * @default undefined — resolves relative to `process.cwd()`
   */
  configBaseDir?: string;
};

/** Injection token for `EnvGetterModuleOptions`. */
export const ENV_GETTER_OPTIONS = Symbol("ENV_GETTER_OPTIONS");
