# Changelog

<!-- markdownlint-disable MD024 -->

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
