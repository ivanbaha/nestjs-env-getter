# Changelog

<!-- markdownlint-disable MD024 -->

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0-beta.1] - Unreleased

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
