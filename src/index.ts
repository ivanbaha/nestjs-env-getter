/**
 * Standalone module that provides `EnvGetterService` globally.
 * Use this if you only need environment variable access without the AppConfig pattern.
 *
 * When combined with `AppConfigModule` using matching options (or default options),
 * both modules share a single `EnvGetterService` instance, though choosing one is still recommended.
 */
export { EnvGetterModule } from "./env-getter/env-getter.module";
export { EnvGetterService } from "./env-getter/env-getter.service";

/**
 * Full-featured module that provides both `EnvGetterService` and a user-defined
 * config class (via `forRoot` / `forFeature` / `forTesting`) or factory (via `forRootAsync`).
 */
export { AppConfigModule, APP_CONFIG } from "./app-config/app-config.module";
export type { AppConfigModuleOptions, AppConfigModuleRootOptions } from "./app-config/app-config.module";
export { EnvConfig } from "./app-config/env-config";
export { EnvValidationError } from "./shared/errors/env-validation.error";

export { CronSchedule, isValidCronExpression } from "./shared/utils/cron-schedule.utils";
export { isTimePeriod, parseTimePeriod } from "./shared/utils/time-period.utils";

export * from "./shared/types";
export * from "./env-getter/types";
