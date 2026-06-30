# Changelog

<!-- markdownlint-disable MD024 -->

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
