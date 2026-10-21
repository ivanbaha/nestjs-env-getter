# Changelog

<!-- markdownlint-disable MD024 -->

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] - 2026-10-21

### Security

- **Dependency audit (dev and example dependencies only — the published package still has zero runtime dependencies):** Upgraded NestJS to `11.2.7` (root devDependencies and the example app), which brings `multer` `2.4.0`. Re-pinned vulnerable transitive packages to patched versions via `resolutions`: `brace-expansion` `5.0.12`, `js-yaml` `4.3.2`, `browserslist` `4.29.3`, `baseline-browser-mapping` `2.11.29`, `handlebars` `4.7.10`, plus `qs` `6.16.1` and `proxy-addr` `2.0.8` in the example. One advisory remains in both audits: `braces` (GHSA-vfj7-8cjw-p6xm, via `jest` → `micromatch`) has no patched release; it only processes the project's own test globs.

### Behavior changes

1. **The library no longer writes to the console.** The red line before each throw is gone. Synchronous failures throw `EnvValidationError`, with the same message, and it is still `instanceof Error`. Asynchronous watcher errors that nobody listens to go to Nest's `Logger.error` (ERR-1, ERR-3).
2. **`breakOnError` defaults to `false`, and `true` now terminates the process** after a failed re-read, but never on deletion. Previously no setting ever terminated (BUG-5).
3. **Watcher `error` event messages always start with `Cannot read config from file '<path>'.`** Previously the prefix depended on `breakOnError` (BUG-5).
4. **The global `updated` and `error` events now fire.** They were documented but never emitted (BUG-1).
5. **Config classes created by `AppConfigModule` report two or more errors as one aggregated `EnvValidationError`.** A single error is unchanged; opt out with `aggregateErrors: false`. Config classes are now created through a factory provider; lifecycle hooks are unaffected, and classes that need property injection, `forwardRef` or a non-default scope automatically keep the old path (MOD-5).
6. **`.env` files load when `forRoot()` is called** (at module-definition time), not only when the service is constructed (MOD-4).
7. **`forRootAsync({ useFactory })` without `inject` now receives `EnvGetterService` as its first argument** (MOD-1).
8. **`AppConfigModule` and `EnvGetterModule` now share one `EnvGetterService`** when their options match or neither has options. Previously there were always two (MOD-1).
9. **The `AppConfigModule` class is no longer decorated with `@Global()`.** The `forRoot` and `forRootAsync` modules are still global, and a bare `imports: [AppConfigModule]` was and remains a no-op (MOD-1).
10. **`APP_CONFIG` now also resolves for `useClass` configs.** This is additive (MOD-1).
11. **An optional config file that is malformed at startup now gets a watcher** and hot-reloads once it is fixed (BUG-4).

### Added

- **`EnvConfig` base class (AUTH-1):** `@Injectable()` abstract base class exposing `protected readonly envGetter: EnvGetterService` so config classes can declare inline field initializers with full TypeScript type inference (including under `target >= ES2022`).
- **`EnvValidationError` & `EnvGetterService.collectErrors()` (ERR-1, ERR-2, MOD-5):** Structured validation error class with `errors: readonly string[]` and `scope?: string`, plus `collectErrors(build, scope?)` for synchronous multi-error collection and automatic aggregation in `AppConfigModule`.
- **`AppConfigModule.forRoot(ConfigClass, envGetter?)` shorthand (MOD-1):** Pass the config class directly without `{ useClass }`.
- **`AppConfigModule.forFeature(configs, options?)` (MOD-2):** Non-global, memoized feature-config registration for modular NestJS apps.
- **`EnvGetterModuleOptions.env` & `AppConfigModule.forTesting()` (MOD-3):** Read environment variables from a live in-memory record and skip `.env` loading for isolated unit and integration testing.
- **Literal union return types on `getRequiredEnv` & `getOptionalEnv` (GET-1):** Narrowed `<T extends string>` return types when `allowedValues: readonly T[]` is passed.
- **`getOptionalObject` (GET-2):** Optional JSON object getter with optional default value and optional validation class.
- **`getOptionalArray` (GET-3):** Optional JSON array getter with optional default array and element validator.
- **`getOptionalCron(envName, defaultValue)` (GET-4):** Overload accepting a default cron expression string (validated on every call).
- **`getRequiredList` & `getOptionalList` (GET-5):** Delimiter-separated list getters with configurable `separator`, whitespace trimming, strict empty-item rejection, and `allowedValues` literal union narrowing.
- **Root barrel exports (BUG-6):** Exported `EnvConfig`, `EnvValidationError`, `isValidCronExpression`, `isTimePeriod`, `parseTimePeriod`, `AppConfigModuleRootOptions`, and `ListOptions` from the root entry point.

### Changed

- **Template & CLI (`nestjs-env-getter init`) (AUTH-2):** Updated `app.config.ts.example` to extend `EnvConfig` and updated the CLI module insertion to `AppConfigModule.forRoot(AppConfig)`.
- **Example application overhaul (EX-1 – EX-7):** Removed MongoDB/Docker dependency in favor of `DatabaseConnectionService` (`/db/status`), migrated `AppConfig` and `TasksConfig` to `EnvConfig` and `forFeature`, eliminated raw `process.env` reads, and added unit and e2e test suites.
- **Toolchain:** Bumped TypeScript to v7 (`7.0.2`) and removed ESLint.
- **Exceptions thrown by `updated` listeners** are logged through Nest's `Logger` instead of being reported as a failed re-read; they no longer emit an `error` event or trigger `breakOnError` (the new config has already been applied at that point).

### Fixed

- **Global `updated` and `error` events on `envGetter.events` (BUG-1, ERR-3):** Both global and per-file events now fire, with `Logger.error` fallback when no error listener is attached.
- **`getOptionalEnv(name, defaultValue, allowedValues)` return type (BUG-2):** Now typed as `T` (non-nullable) instead of `string | undefined`.
- **Missing `getOptionalConfigFromFile(filePath, defaultValue, watcherOptions)` overloads (BUG-3):** Added public TypeScript overloads matching runtime support.
- **Watcher setup for optional config files malformed at startup (BUG-4):** Now caches object defaults, attaches event methods, and installs the file watcher so fixing the file later hot-reloads in place.
- **`breakOnError` watcher termination and consistent error prefix (BUG-5):** Default flipped to `false`; when `true`, a failed re-read terminates after emitting error events (never on file deletion), and error event messages consistently start with `Cannot read config from file '<path>'.`.
- **Documented `CronSchedule.getPrevTime()` in README (BUG-7).**
- **`nestjs-env-getter init` CLI:** now finds the bracket that actually closes the `imports` array, so it handles the default Nest scaffold (`imports: [],` on one line), one-line arrays, and nested arrays or brackets inside strings and comments (previously it either failed on one-line arrays or inserted a line break inside nested ones such as `forFeature([User])`).
- **`getOptionalArray` validator-misuse message** now names `getOptionalArray` instead of `getRequiredArray`.

## [1.2.0] - 2026-06-30

### Security

- **P1.1 — CronSchedule DoS prevention (CWE-835/CWE-1284, High):** `parseCronField` now rejects step values `< 1` (was: infinite loop for `*/0`), clamps range bounds (was: unbounded array for `1-2000000000`), and applies a bounds check on single values. The public `CronSchedule` constructor now validates the expression via `isValidCronExpression` and throws on invalid input rather than silently producing a broken schedule.
- **P1.2 — JSON error sanitization (CWE-532/CWE-209, Medium):** A new `sanitizeJsonError` helper strips raw input fragments from `JSON.parse` `SyntaxError` messages (which V8 embeds in the error). Only positional info (`at position N` / `at line L column C`) is forwarded. Applies to `getRequiredObject`, `getRequiredArray`, and config-file reload errors (including the watcher's `error:<path>` event payload).
- **P1.3 — Remove stack traces from error messages (CWE-209, Low):** The `getRequiredArray` validator-misuse message no longer embeds `new Error().stack`. `getErrorMessage` now uses `String(error)` instead of `JSON.stringify` for non-Error thrown values.
- **P1.4 — `deepSanitize` on array path (CWE-1321, defense-in-depth):** `getRequiredArray` now applies `deepSanitize` to its `JSON.parse` result, preventing prototype-pollution via arrays containing `{"__proto__":…}` elements.
- **P3.1 — Fix `$`-pattern corruption in interpolation (CWE-116, Low–Medium):** Variable interpolation in `.env` files used `String.replace(pattern, replacement)` which interprets `$$`, `$&`, `` $` ``, `$'` in the replacement string. Changed to a function replacer so values are inserted verbatim. Before: `DB_PASS='pa$$w0rd'` could silently become `pa$w0rd`.

### Behavior changes

The following changes alter observable behavior. See the **Migration to 1.2.0** section in README for one-line before/after descriptions.

- **`getOptionalBooleanEnv` — strict validation (B2):** Values that are not exactly `"true"` or `"false"` now call `stopProcess` instead of silently returning `false`. Before: `ENFORCE_TLS=TRUE` → `false`; now → throws.
- **`getRequiredNumericEnv` / `getOptionalNumericEnv` — tighter regex (B3):** New rule: digits are required, underscores only between digit groups (`/^\d+(?:_\d+)*$/`). Before: `"___"` → `0`; now → throws. Added safe-integer bound check. `getOptionalNumericEnv` with a present-but-invalid value now throws instead of returning the default.
- **`getRequiredEnv` / all `getRequired*` — set-but-empty rejects (M9):** A variable set to empty (`KEY=`) is now treated as missing: `checkEnvExisting` throws `"Variable 'KEY' is set but empty"`. Before: empty string was accepted as a valid value.
- **`getOptionalEnv(name, allowedValues)` — unset no longer throws (B1):** The `(name, string[])` overload previously called `checkIfEnvHasAllowedValue` even when the variable was unset, causing an "optional" variable to be effectively required. Now: unset or empty → `undefined`, no validation.
- **`getOptionalEnv` empty-string (M9):** Empty string is now treated as unset across all `getOptional*` getters; the default value is returned.
- **`getOptionalCron` empty-string (P2.5):** Previously, an empty string would fail `isValidCronExpression` and throw. Now: empty → `undefined`.
- **`isTimePeriod(number)` — rejects non-finite/negative (P3.3):** Before: `isTimePeriod(NaN)` / `isTimePeriod(Infinity)` / `isTimePeriod(-1)` all returned `true`. Now they return `false`.
- **Single-quoted `.env` values suppress interpolation (P3.2):** Values in single quotes (`A='literal ${B}'`) are now stored verbatim; `${B}` is not expanded. Double-quoted and unquoted values continue to interpolate. This matches the dotenv convention.

### Added

- **`getOptionalTimePeriod` — no-default overloads (P2.6):** Two new overloads: `(name)` returns `number | undefined`; `(name, resultIn: TimeMarker)` returns `number | undefined` with a unit. The existing `(name, defaultValue, resultIn?)` form is unchanged. Number defaults are now accepted too (interpreted as milliseconds and converted to `resultIn`, rounded up).
- **Watcher: absent file + pending watcher (P4.1/E2):** `getOptionalConfigFromFile` now sets up a parent-directory watcher when the config file is absent at call time. When the file later appears (e.g. secret mounted post-boot), the service loads it, emits `updated:<path>`, and transitions to a normal file watcher. The originally returned default object is mutated in place to preserve reference stability.
- **Watcher: delete → recreate flow (P4.1/E3):** After a file is deleted, a pending parent-directory watcher is established so that plain `rm` + recreate resumes updates. Previously, only atomic rename (Vault agent) was handled; plain deletes left the watcher permanently silent.
- **`EnvGetterModule.forRoot(options)` (P4.3):** New static factory method. Options: `envFilePath` (path(s) or `false` to opt out of the implicit `.env` load); `configBaseDir` (confines config-file resolution to a directory tree — path traversal attempts are fatal). Plain `imports: [EnvGetterModule]` continues to work with defaults.
- **`EnvGetterModuleOptions` type + `ENV_GETTER_OPTIONS` token exported (P4.3):** Available from the main package entry point.
- **`configBaseDir` path confinement (P1.5/F4):** When `configBaseDir` is set via module options, `resolveFilePath` verifies the resolved path remains inside the base directory and calls `stopProcess` on traversal.
- **`AppConfigModule` `envGetter` pass-through (P4.3):** `forRoot` and `forRootAsync` accept an optional `envGetter: EnvGetterModuleOptions` field that is forwarded to `EnvGetterService`.

### Changed

- **`package.json`: added `"engines": { "node": ">=20" }` (P5.3).**
- **`prebuild` script cross-platform (P5.5):** Changed from `rm -rf dist` to `node -e "require('fs').rmSync(...)"` for Windows compatibility.
- **Emitter `MaxListenersExceededWarning` suppressed (P4.2):** `this.events.setMaxListeners(0)` called at construction.
- **devDependency audit clean (P5.4):** Transitive ReDoS-class advisories in `ajv`, `minimatch`, `picomatch`, and `brace-expansion` fixed by re-resolving the lockfile to patched in-range versions, plus scoped `resolutions` for `@angular-devkit/core`'s exact pins. `yarn audit`: 118 findings → 0. Consumers are unaffected — the package ships zero runtime dependencies.

## [1.1.3] - 2026-05-05

### Changed

- **Dev Dependencies**: Updated all dev dependencies to their latest versions. Includes TypeScript 6.0 migration (removed deprecated `baseUrl`, added explicit `types` and `rootDir` in tsconfig). Patched a transitive `path-to-regexp < 8.4.0` vulnerability in the example project via a yarn resolution override.

## [1.1.2] - 2026-03-06

### Fixed

- **TypeScript TS2742 Compatibility**: Replaced `Type<unknown>` from `@nestjs/common` with the local `ClassConstructor` type in `AppConfigModule`'s public API to prevent `TS2742` errors in consumer projects.
- **Boolean Validation Regex**: Anchored the regex in `getRequiredBooleanEnv` so values like `"falsehood"` no longer pass validation.
- **`getOptionalEnv` Empty String Handling**: Changed fallback operator from `||` to `??` so that an explicitly set empty string is preserved.
- **`getOptionalNumericEnv` Undefined Handling**: Now correctly returns the default value when the variable is not set instead of parsing `"undefined"`.
- **Prototype Pollution Hardening**: Added deep sanitization of parsed JSON to strip unsafe keys (`__proto__`, `constructor`, `prototype`) from nested objects. Initialized `configsStorage` with `Object.create(null)`.
- **Safe `hasOwnProperty` Calls**: Replaced direct `process.env.hasOwnProperty()` with `Object.prototype.hasOwnProperty.call()`.

### Changed

- **Exported `APP_CONFIG` Token**: The injection token used by `forRootAsync` with `useFactory` is now exported as the constant `APP_CONFIG`.
- **`forRoot` `imports` Type**: Changed `imports?: any[]` to `imports?: ModuleMetadata["imports"]` for consistency with `forRootAsync`.
- **Event Method Descriptors**: Changed `configurable` from `false` to `true` on config instance event properties, allowing cleanup when needed.
- **Deduplicated Cron Field Parser**: Removed the duplicate `parseFieldForValidation` function; validation now reuses `parseCronField`.
- **JSDoc Accuracy**: Updated all JSDoc comments that said "Terminates the process" to `@throws {Error}`.
- **README & Example Updates**: Documented `APP_CONFIG` token, added `EnvGetterModule` vs `AppConfigModule` comparison, updated error-handling language, and updated the example project to cover all available functionality.

## [1.1.1] - 2026-03-02

### Fixed

- **TypeScript Compatibility**: Added explicit `EventEmitter` type annotation to the `events` property in `EnvGetterService` to prevent incompatible type inference in emitted declaration files. Fixes build errors (`TS2344`) in consumer projects using newer `@types/node` versions.

## [1.1.0] - 2026-02-02

### Added

- **Cron Expression Support**: Added `getRequiredCron` and `getOptionalCron` to parse cron environment variables into a `CronSchedule`.
  - Supports both 5-field and 6-field cron formats.
  - Provides helpers like `isMatching`, `getNextTime`, and `getPrevTime`.
- **Cron Validation Utilities**: Added and exported `isValidCronExpression` for validating cron strings (including basic semantic checks like rejecting impossible day/month combinations).
- **Cron Semantics**: Day-of-month and day-of-week follow standard cron behavior when both are specified (OR logic rather than requiring both to match).

### Changed

- **Documentation & Examples**: Expanded README cron documentation and updated the `nestjs-server` example to demonstrate cron schedules.

## [1.0.0] - 2026-01-17

### Added

- **Custom .env Parser**: Replaced `dotenv` dependency with a robust, custom-built parser.
  - Full support for multiline strings (e.g., private keys).
  - Variable interpolation/expansion (e.g., `APP_URL=${HOST}:${PORT}`).
  - Detection of circular variable references.
  - Detailed error reporting for malformed lines and unterminated quotes.
  - Support for `export` prefix and miscellaneous quoting styles (single/double).

### Changed

- **Dependency Removal**: Removed `dotenv` to reduce external dependencies and control parsing logic directly.
- **Example Project**: Updated `nestjs-server` example to demonstrate new parser features and diverse variable types.

## [1.0.0-beta.3] - 2025-11-26

### Added

- Improved file watcher resilience: re-establishes the file watcher after each successful update to handle atomic file replacements (e.g., Vault Agent credential rotations).

### Changed

- Increased default `debounceMs` from `200` to `350` ms to reduce noisy re-parses on rapid file updates.
- Documentation and unit tests updated to cover file replacement and re-establishment behavior.

## [1.0.0-beta.2] - 2025-10-17

### Added

- **Inject Custom Providers**: Added the ability to inject custom providers into `AppConfigModule` via `forRoot` and `forRootAsync`. This allows `AppConfig` classes to depend on other services for dynamic configuration.

### Changed

- **Updated Example**: The `nestjs-server` example was updated to demonstrate how to inject a custom `AppConfigOptionsService` to dynamically select configuration files based on the environment.

## [1.0.0-beta.1] - 2025-10-08

### Added

- **Configuration from Files**:
  - Added `getRequiredConfigFromFile` and `getOptionalConfigFromFile` to read, parse, and validate JSON configuration files.
  - Implemented automatic file watching with hot-reload, which updates configuration in-place without requiring an application restart.
  - Configuration objects are enhanced with `on`, `once`, and `off` methods for subscribing to file change events.
- **Graceful Error Handling**:
  - `getOptionalConfigFromFile` now gracefully handles missing files or JSON parsing errors by returning a default value or `undefined`, preventing process termination.
  - Process now only terminates on critical errors, such as validation failures in class-based configs.
- **Project Scaffolding and Examples**:
  - Added an example NestJS application demonstrating usage with a MongoDB connection.
  - Included executable scripts for bootstrapping the library.
  - Integrated `AppConfigModule` to streamline configuration setup.

### Changed

- Updated all dependencies to their latest versions.

## [0.1.0] - 2025-05-08

### Changed

- Bumped version.
- Bumped development dependencies and changed the registry.

### Fixed

- Updated the GitHub Action for publishing.
- Fixed issues in the CI/CD workflows.

## [0.0.0-beta1] - 2025-02-04

### Added

- Initial release with total refactoring.
