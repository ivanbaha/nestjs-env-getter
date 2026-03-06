/**
 * Standalone module that provides `EnvGetterService` globally.
 * Use this if you only need environment variable access without the AppConfig pattern.
 *
 * **Do not** use both `EnvGetterModule` and `AppConfigModule` — they are alternatives.
 * `AppConfigModule` already includes `EnvGetterService`.
 */
export { EnvGetterModule } from "./env-getter/env-getter.module";
export { EnvGetterService } from "./env-getter/env-getter.service";

/**
 * Full-featured module that provides both `EnvGetterService` and a user-defined
 * config class (via `forRoot`) or factory (via `forRootAsync`).
 *
 * **Do not** use both `AppConfigModule` and `EnvGetterModule` — they are alternatives.
 */
export { AppConfigModule, APP_CONFIG } from "./app-config/app-config.module";
export type { AppConfigModuleOptions } from "./app-config/app-config.module";

export { CronSchedule } from "./shared/utils/cron-schedule.utils";

export * from "./shared/types";
export * from "./env-getter/types";
