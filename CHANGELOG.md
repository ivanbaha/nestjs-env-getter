# Changelog

<!-- markdownlint-disable MD024 -->

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
