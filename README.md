# NestJS ENV Getter

`nestjs-env-getter` is a powerful and lightweight NestJS module designed to streamline the process of retrieving and validating environment variables and JSON configuration files. It ensures your application starts with a correct, type-safe configuration by providing a robust API for handling various data types, validation scenarios, error aggregation, and live file hot-reloading.

## Key Features

- **Type-Safe Retrieval**: Get environment variables as strings (with literal union narrowing), numbers, booleans, URLs, delimiter-separated lists, JSON objects, JSON arrays, cron schedules, or time periods.
- **Ergonomic Config Authoring**: Extend `EnvConfig` to write concise inline field initializers with full TypeScript type inference.
- **Error Aggregation**: Collects and reports all missing or invalid configuration values at once via `EnvValidationError` instead of failing one variable at a time.
- **Built-in Validation**: Validate variables against allowed values, class constructors, or custom element validators.
- **`.env` Support**: Built-in zero-dependency parser with variable interpolation, multiline strings, and system env priority, loaded eagerly at `forRoot()` time.
- **JSON File Hot-Reload**: Watch JSON configuration files with in-place reference updates, per-file and global events, and Vault/secret-rotation support.
- **First-Class Testing**: Pass an in-memory `env` map via `AppConfigModule.forTesting()` or `new EnvGetterService({ env })` without touching `process.env`.
- **Configuration Scaffolding**: Includes a CLI helper to quickly set up a centralized configuration file.

## Environment File Parsing

The module includes a zero-dependency `.env` file parser. Key behaviors:

- **Eager loading**: `.env` files are loaded synchronously as soon as `AppConfigModule.forRoot()` / `forRootAsync()` or `EnvGetterModule.forRoot()` is called (at module-definition time) as well as when `EnvGetterService` is constructed.
- **System environment priority**: Variables already set in `process.env` are NOT overwritten by `.env` file values. This ensures CI/CD and Docker environment injections take precedence over local files.
- **Variable interpolation**: Use `${VAR_NAME}` syntax to reference other variables. Interpolation inserts values verbatim — `$`-patterns like `pa$$w0rd` survive byte-for-byte.
- **Quoting rules**:
  - **Unquoted**: Value ends at `#` (comment) or end of line — `PASSWORD=ab#cd` yields `ab`, so **quote any value containing `#`**. Interpolation applies.
  - **Single quotes** (`'`): Raw literal — no escape processing and **no interpolation** (`A='${B}'` stays `${B}`, dotenv convention).
  - **Double quotes** (`"`): Supports `\n`, `\t`, `\\`, `\"` escapes and multiline values. Interpolation applies.
- **`export` prefix**: Automatically stripped for shell compatibility.
- **Empty values**: `KEY=` parses to an empty string in `process.env`, but all getters treat set-but-empty as **unset**: `getRequired*` throws a distinct `"set but empty"` error, `getOptional*` returns the default. Only `isEnvSet()` reports a pure existence check (`true` for `KEY=`).

## Installation

```bash
npm install nestjs-env-getter
```

## Quick Start

The recommended way to use `nestjs-env-getter` is by creating a centralized configuration class extending `EnvConfig`.

### 1. Create a Configuration Class

Create `src/app.config.ts` extending `EnvConfig` to define and validate your environment variables using inline field initializers:

```typescript
// src/app.config.ts
import { Injectable } from "@nestjs/common";
import { EnvConfig } from "nestjs-env-getter";

@Injectable()
export class AppConfig extends EnvConfig {
  readonly port = this.envGetter.getRequiredNumericEnv("PORT");
  readonly mongoConnectionString = this.envGetter.getRequiredEnv(
    "MONGO_CONNECTION_STRING",
  );
  // Inferred as "development" | "production"
  readonly nodeEnv = this.envGetter.getRequiredEnv("NODE_ENV", [
    "development",
    "production",
  ]);
}
```

#### Alternative: Classic Constructor Style (or Extra Injected Dependencies)

You can also write a standalone `@Injectable()` class with an explicit constructor. Note that under TypeScript `target >= ES2022` (the Nest CLI default), field initializers run before constructor parameter properties (`TS2729`), so any fields that depend on **additional injected providers** should be assigned in the constructor body after `super(envGetter)`:

```typescript
import { Injectable } from "@nestjs/common";
import { EnvConfig, EnvGetterService, WithConfigEvents } from "nestjs-env-getter";

@Injectable()
export class AppConfig extends EnvConfig {
  readonly port = this.envGetter.getRequiredNumericEnv("PORT");
  readonly mongo: WithConfigEvents<MongoCreds>;

  constructor(
    envGetter: EnvGetterService,
    private readonly paths: ConfigPathsService,
  ) {
    super(envGetter);
    this.mongo = this.envGetter.getRequiredConfigFromFile(
      this.paths.mongoFile(),
      MongoCreds,
    );
  }
}
```

### 2. Register the Configuration

In your `AppModule`, call `AppConfigModule.forRoot(AppConfig)`. This registers `AppConfig` globally (both under its class token and under the `APP_CONFIG` token):

```typescript
// src/app.module.ts
import { Module } from "@nestjs/common";
import { AppConfigModule } from "nestjs-env-getter";
import { AppConfig } from "./app.config";

@Module({
  imports: [
    AppConfigModule.forRoot(AppConfig),
    // Or with options:
    // AppConfigModule.forRoot(AppConfig, { envFilePath: [".env", ".env.local"] }),
    // Or object form when passing extra providers/imports:
    // AppConfigModule.forRoot({ useClass: AppConfig, providers: [ConfigPathsService] }),
  ],
})
export class AppModule {}
```

### 3. Use the Configuration

Inject `AppConfig` by class (or via `@Inject(APP_CONFIG)`) anywhere in your application:

```typescript
import { Injectable } from "@nestjs/common";
import { AppConfig } from "./app.config";

@Injectable()
export class DatabaseService {
  private readonly connectionString: string;

  constructor(private readonly config: AppConfig) {
    this.connectionString = config.mongoConnectionString;
  }
}
```

### Feature Configs (`AppConfigModule.forFeature`)

For modular applications, slice your configuration per feature module using `AppConfigModule.forFeature()`:

```typescript
@Injectable()
export class TasksConfig extends EnvConfig {
  readonly backupSchedule = this.envGetter.getRequiredCron("BACKUP_SCHEDULE");
  readonly cleanupSchedule = this.envGetter.getOptionalCron(
    "CLEANUP_SCHEDULE",
    "0 3 * * *",
  );
}

@Module({
  imports: [AppConfigModule.forFeature(TasksConfig)],
  providers: [TasksService],
})
export class TasksModule {}
```

- `forFeature(ConfigClass | ConfigClass[], { aggregateErrors?: boolean })` returns a **non-global** module that provides and exports each config class with error aggregation enabled by default.
- It relies on the global `EnvGetterService` registered at the root (`AppConfigModule.forRoot` / `forRootAsync` or `EnvGetterModule`). Feature configs can only depend on global providers.
- `forFeature` is memoized per `(class, aggregateErrors)` so multiple modules importing `AppConfigModule.forFeature(SharedConfig)` share the same instance.
- **Comparison with plain `providers: [TasksConfig]`:** Since `EnvGetterService` is global, listing `TasksConfig` directly in a module's `providers` also works, but `AppConfigModule.forFeature(TasksConfig)` adds automatic multi-error aggregation and shared-instance deduplication across modules.

### Using `forRootAsync` with a Factory

For async initialization or custom factory logic, use `forRootAsync` with `useFactory`:

- **`inject` defaults to `[EnvGetterService]`** when `inject` is `undefined`, so your factory receives `EnvGetterService` as its first argument automatically (pass `inject: []` explicitly if you want no arguments).
- **`useFactory` accepts typed parameters** without TypeScript `strict` errors, and supports `async` (Promise-returning) factories.
- **`provide`** (optional, defaults to `APP_CONFIG`): custom class or token to register the factory result under. When `provide` is set, `APP_CONFIG` is also aliased to it via `useExisting`.
- Factory configs do not wrap automatically in error aggregation; call `envGetter.collectErrors(() => ...)` inside the factory if desired.

```typescript
import { Module, Inject, Injectable } from "@nestjs/common";
import { AppConfigModule, APP_CONFIG, EnvGetterService } from "nestjs-env-getter";

class CustomConfig {
  constructor(readonly port: number) {}
}

@Module({
  imports: [
    AppConfigModule.forRootAsync({
      provide: CustomConfig,
      useFactory: async (envGetter: EnvGetterService) =>
        envGetter.collectErrors(() => new CustomConfig(envGetter.getRequiredNumericEnv("PORT")), "CustomConfig"),
    }),
  ],
})
export class AppModule {}

// Inject either by `provide` token/class or by `@Inject(APP_CONFIG)`:
@Injectable()
export class SomeService {
  constructor(
    private readonly config: CustomConfig,
    @Inject(APP_CONFIG) private readonly aliased: CustomConfig,
  ) {}
}
```

### `EnvGetterModule` vs `AppConfigModule`

| Module            | When to use                                                                                                 |
| ----------------- | ----------------------------------------------------------------------------------------------------------- |
| `AppConfigModule` | Recommended. Provides `EnvGetterService` **and** registers your config classes/factories.                   |
| `EnvGetterModule` | Lightweight. Only provides `EnvGetterService` globally, without the config-class pattern.                   |

> When `AppConfigModule` and `EnvGetterModule` are imported with matching options (or both without options), they now share a **single** `EnvGetterService` instance via `EnvGetterModule` memoization. However, you should still pick one in your root module, and never import both with different options (which creates two instances).

### Module Options

By default the service loads `./.env` at `forRoot()` time. `EnvGetterModule.forRoot(options)` (or the `envGetter` pass-through on `AppConfigModule.forRoot`) customizes startup behavior:

```typescript
import { AppConfigModule } from "nestjs-env-getter";

AppConfigModule.forRoot(AppConfig, {
  // Path(s) to load at startup; `false` disables the implicit .env load entirely.
  envFilePath: [".env", ".env.local"], // string | string[] | false (default: ".env")
  // Confine config-file resolution (getRequired/getOptionalConfigFromFile) to a
  // directory tree. Any path escaping it throws EnvValidationError (path-traversal guard).
  configBaseDir: "./configs",
  // Optional in-memory variable map (reads live from this record instead of process.env
  // and disables .env file loading; cannot be combined with envFilePath !== false).
  // env: { PORT: "3000" },
});
```

`EnvGetterModuleOptions` and the `ENV_GETTER_OPTIONS` injection token are exported from the package root.

## Error Reporting & Aggregation

- **No console output:** The library never writes directly to `console.error` or `console.log`. Synchronous validation failures throw `EnvValidationError` (which extends `Error`), letting NestJS or your application handle logging.
- **Single vs. multiple errors:**
  - When **1** validation error occurs, `error.message` is the exact single-error message (e.g. `"Missing 'PORT' environment variable"`).
  - When **2 or more** errors occur in an aggregated scope, `error.message` lists them all:
    ```text
    Configuration validation failed for AppConfig (3 errors):
      1. Missing 'PORT' environment variable
      2. Variable 'NODE_ENV' can be only one of: [development, production], but received 'local'
      3. Variable 'API_URL' must be a valid URL. Error: Invalid URL
    ```
  - `error.errors` (`readonly string[]`) always contains the individual error strings, and `error.scope` holds the optional scope name.
- **Automatic class aggregation:** Config classes registered via `AppConfigModule.forRoot`, `forRootAsync({ useClass })`, `forFeature`, and `forTesting` aggregate all getter errors thrown in their constructor by default. Pass `aggregateErrors: false` to fail on the first error instead.
- **Automatic fallback Conditions:** Classes that use property injection (`@Inject()` on properties), non-default or durable scope (`Scope.REQUEST`, `Scope.TRANSIENT`), `forwardRef()` constructor dependencies, or lack `@Injectable()` decorator metadata when taking constructor arguments automatically fall back to standard Nest `useClass` instantiation (first-error semantics).
- **Manual aggregation (`envGetter.collectErrors`):**
  ```typescript
  const cfg = envGetter.collectErrors(() => ({
    host: envGetter.getRequiredEnv("HOST"),
    port: envGetter.getRequiredNumericEnv("PORT"),
  }), "CustomScope");
  ```
  Note: `collectErrors` callbacks must be synchronous. While collecting, failed getters return `undefined` so subsequent getters can still run; if a derived expression throws (e.g., `TypeError`), that error is attached as `error.cause` on the resulting `EnvValidationError`.

## Testing Configs

You can test config classes and modules in complete isolation without mutating `process.env` or loading `.env` files:

### 1. Plain Unit Test (No NestJS Required)

```typescript
import { EnvGetterService } from "nestjs-env-getter";
import { AppConfig } from "./app.config";

it("parses AppConfig from an in-memory record", () => {
  const config = new AppConfig(
    new EnvGetterService({
      env: {
        PORT: "4000",
        MONGO_CONNECTION_STRING: "mongodb://localhost:27017/test",
        NODE_ENV: "development",
      },
    }),
  );

  expect(config.port).toBe(4000);
  expect(config.nodeEnv).toBe("development");
});
```

### 2. NestJS Testing Module (`AppConfigModule.forTesting`)

`AppConfigModule.forTesting(ConfigClass, envRecord, options?)` replaces `AppConfigModule.forRoot` in a test module, reading variables live from `envRecord` with `envFilePath: false`:

```typescript
const moduleRef = await Test.createTestingModule({
  imports: [
    AppConfigModule.forTesting(
      AppConfig,
      { PORT: "4000", NODE_ENV: "development", MONGO_CONNECTION_STRING: "mongodb://localhost:27017/test" },
      { configBaseDir: tmpDir },
    ),
  ],
}).compile();
```

> Do not combine `forTesting` with a module tree that already imports `AppConfigModule.forRoot`, as that would register two global `EnvGetterService` providers.

## CLI Helper

You can scaffold the configuration file and module setup automatically with the built-in CLI command. Run this in the root of your NestJS project:

```bash
npx nestjs-env-getter init
```

This command (shorthand `npx nestjs-env-getter i`) will:

1. Create `src/app.config.ts` from a template (`AppConfig extends EnvConfig`).
2. Import `AppConfigModule.forRoot(AppConfig)` into your `src/app.module.ts`.

## Example Project

A full working NestJS application demonstrating all available functionality is available in the [examples](https://github.com/ivanbaha/nestjs-env-getter/tree/main/examples) directory on GitHub.

## API Reference (`EnvGetterService`)

### String & Literal Union Types

When `allowedValues` is passed to `getRequiredEnv` or `getOptionalEnv`, TypeScript automatically narrows the return type to the literal union `T` (from inline arrays, `as const` tuples, or `Object.values(StringEnum)`):

- **`getRequiredEnv(name: string): string`**
- **`getRequiredEnv<T extends string>(name: string, allowedValues: readonly T[]): T`**

  ```typescript
  const dbHost = this.envGetter.getRequiredEnv("DB_HOST"); // string

  // Inferred as "development" | "production"
  const nodeEnv = this.envGetter.getRequiredEnv("NODE_ENV", [
    "development",
    "production",
  ]);
  ```

- **`getOptionalEnv(name: string): string | undefined`**
- **`getOptionalEnv(name: string, defaultValue: string): string`**
- **`getOptionalEnv<T extends string>(name: string, allowedValues: readonly T[]): T | undefined`**
- **`getOptionalEnv<T extends string>(name: string, defaultValue: T, allowedValues: readonly T[]): T`**

  ```typescript
  const logLevel = this.envGetter.getOptionalEnv("LOG_LEVEL", "info"); // string
  const mode = this.envGetter.getOptionalEnv("MODE", ["fast", "safe"]); // "fast" | "safe" | undefined
  const stage = this.envGetter.getOptionalEnv("STAGE", "alpha", ["alpha", "beta"]); // "alpha" | "beta"
  ```

  > !!! A disallowed value is **echoed in the error message** — never use `allowedValues` with secret variables.

### Lists (Delimiter-Separated Strings)

Splits delimiter-separated environment variables (default `,`), trims whitespace around each item, rejects empty items (including trailing separators), and optionally narrows items via `allowedValues`:

- **`getRequiredList(name: string, options?: ListOptions): string[]`**
- **`getRequiredList<T extends string>(name: string, options: ListOptions & { allowedValues: readonly T[] }): T[]`**
- **`getOptionalList(name: string, options?: ListOptions): string[] | undefined`**
- **`getOptionalList<T extends string>(name: string, options: ListOptions & { allowedValues: readonly T[] }): T[] | undefined`**
- **`getOptionalList(name: string, defaultValue: readonly string[], options?: ListOptions): string[]`**
- **`getOptionalList<T extends string>(name: string, defaultValue: readonly T[], options: ListOptions & { allowedValues: readonly T[] }): T[]`**

```typescript
// ENV: CORS_ORIGINS="https://a.example.com, https://b.example.com"
const origins = this.envGetter.getRequiredList("CORS_ORIGINS"); // string[]

// Custom separator + literal union narrowing: ("us-east" | "eu-west")[]
const regions = this.envGetter.getOptionalList(
  "REGIONS",
  ["us-east"],
  { separator: ";", allowedValues: ["us-east", "eu-west"] },
);
```

> List items cannot contain the separator character (no escaping). Use `getRequiredArray` / `getOptionalArray` (JSON) if values may contain the delimiter.

### Number

Numeric getters accept **integers only** — no decimals (`1.5`) and no scientific notation (`1e3`). Underscores may be used between digit groups (`1_000_000`). Values beyond `Number.MAX_SAFE_INTEGER` are rejected.

- **`getRequiredNumericEnv(name: string): number`**
- **`getOptionalNumericEnv(name: string, default?: number): number | undefined`**

### Boolean

Boolean getters are strict and **case-sensitive**: only the exact strings `true` and `false` are accepted.

- **`getRequiredBooleanEnv(name: string): boolean`**
- **`getOptionalBooleanEnv(name: string, default?: boolean): boolean | undefined`**

### URL

- **`getRequiredURL(name: string): URL`**
- **`getOptionalURL(name: string, default?: URL): URL | undefined`**

### Time Period

Parses a string like `'10s'`, `'5m'`, `'2h'`, `'1d'` into a numeric value (rounded up via `Math.ceil`). Helper functions `isTimePeriod` and `parseTimePeriod` are also exported from the package root.

- **`getRequiredTimePeriod(name: string, resultIn: 'ms' | 's' | 'm' | 'h' | 'd' = 'ms'): number`**
- **`getOptionalTimePeriod(name: string): number | undefined`**
- **`getOptionalTimePeriod(name: string, resultIn: TimeMarker): number | undefined`**
- **`getOptionalTimePeriod(name: string, defaultValue: string | number, resultIn?: TimeMarker): number`**

### Cron Expression

Parses 5-field and 6-field cron expressions into a `CronSchedule` instance. The validation helper `isValidCronExpression` is also exported from the package root.

- **`getRequiredCron(name: string): CronSchedule`**
- **`getOptionalCron(name: string): CronSchedule | undefined`**
- **`getOptionalCron(name: string, defaultValue: string): CronSchedule`**

  ```typescript
  const backupSchedule = this.envGetter.getRequiredCron("BACKUP_SCHEDULE");
  const cleanupSchedule = this.envGetter.getOptionalCron("CLEANUP_SCHEDULE", "0 3 * * *");
  ```

**`CronSchedule` Methods:**

- `toString(): string` - Returns the original cron expression.
- `isMatching(date: Date): boolean` - Checks if the given date matches the schedule.
- `getNextTime(from?: Date): Date | null` - Calculates the next execution time after the given date (defaults to current time).
- `getPrevTime(from?: Date): Date | null` - Calculates the previous execution time before the given date (defaults to current time).

### Object (from JSON string)

- **`getRequiredObject<R>(name: string, cls?: ClassConstructor): R`**
- **`getOptionalObject<R>(name: string): R | undefined`**
- **`getOptionalObject<C extends ClassConstructor>(name: string, cls: C): InstanceType<C> | undefined`**
- **`getOptionalObject<R>(name: string, defaultValue: R): R`**
- **`getOptionalObject<R, C extends ClassConstructor>(name: string, defaultValue: R, cls: C): InstanceType<C>`**

  > Defaults must be plain data; if `cls` is provided, `defaultValue` is validated and instantiated via `new cls(defaultValue)`.

### Array (from JSON string)

- **`getRequiredArray<R>(name: string, validate?: ArrayValidatorType<R>): (R extends unknown[] ? R : R[])`**
- **`getOptionalArray<R>(name: string, validate?: ArrayValidatorType<R>): (R extends unknown[] ? R : R[]) | undefined`**
- **`getOptionalArray<R>(name: string, defaultValue: R extends unknown[] ? R : R[], validate?: ArrayValidatorType<R>): (R extends unknown[] ? R : R[])`**

### Configuration from JSON Files & Hot-Reload Events

- **`getRequiredConfigFromFile<R>(filePath: string, cls?: ClassConstructor, watcherOptions?: FileWatcherOptions): WithConfigEvents<R>`**
- **`getOptionalConfigFromFile` overloads:**
  - `(filePath)` → `WithConfigEvents<R> | undefined`
  - `(filePath, cls, watcherOptions?)` → `WithConfigEvents<InstanceType<C>> | undefined`
  - `(filePath, defaultValue, cls, watcherOptions?)` → `WithConfigEvents<InstanceType<C>>`
  - `(filePath, undefined, watcherOptions)` → `WithConfigEvents<R> | undefined`
  - `(filePath, defaultValue, watcherOptions)` → `WithConfigEvents<R>`
  - `(filePath, defaultValue)` → `WithConfigEvents<R>`

**File Watcher Options (`FileWatcherOptions`):**

- `enabled` (`boolean`, default: `true`): Enable or disable automatic file watching.
- `debounceMs` (`number`, default: `350`): Delay in milliseconds before re-reading the file after a change.
- `breakOnError` (`boolean`, default: `false`): When `true`, a failed re-read of a watched file (read error, JSON parse error, or class validation error) terminates the process after emitting error events. **File deletion never terminates the process**, because delete-then-recreate is a supported rotation pattern.

**Events (`config.on` / `config.once` / `config.off` & `envGetter.events`):**

- Per-file config object methods:
  - `config.on('updated' | 'error', handler)` — returns `{ unsubscribe(): void }`.
  - `config.once('updated' | 'error', handler)` — fires once, returns `{ unsubscribe(): void }`.
  - `config.off('updated' | 'error', handler)` — removes the listener.
- Global `envGetter.events` (`EventEmitter`):
  - `'updated:<absPath>'` and `'updated'` (`ConfigUpdatedEvent: { filePath, timestamp, config }`)
  - `'error:<absPath>'` and `'error'` (`ConfigErrorEvent: { filePath, timestamp, error }`)
- **Logger fallback:** If an asynchronous file watcher error occurs and **neither** `'error:<absPath>'` nor `'error'` has any listener attached, the error message is logged via NestJS `Logger.error` (`[EnvGetterService]`) instead of crashing with `ERR_UNHANDLED_ERROR`.
- **Throwing `updated` listeners:** By the time `'updated'` fires, the new config is already applied. If one of your `'updated'` listeners throws, the exception is logged via `Logger.error`; it is not reported as an `'error'` event and never triggers `breakOnError`.

## Migration to v1.3.0

1. **The library no longer writes to the console.** The red `console.error` line before each throw is gone. Synchronous failures throw `EnvValidationError`, with the same message, and it is still `instanceof Error`. Asynchronous watcher errors that nobody listens to go to Nest's `Logger.error` (ERR-1, ERR-3).
   - *Action:* Remove `console.error` spies in tests that expected the library to log before throwing.
2. **`breakOnError` defaults to `false`, and `true` now terminates the process** after a failed re-read, but never on deletion. Previously no setting ever terminated (BUG-5).
   - *Action:* No change needed unless you explicitly passed `breakOnError: true` and relied on the broken behavior where the process kept running.
3. **Watcher `error` event messages always start with `Cannot read config from file '<path>'.`** Previously the prefix depended on `breakOnError` (BUG-5).
   - *Action:* Update any test or listener matching on the raw message prefix when `breakOnError: false`.
4. **The global `updated` and `error` events now fire.** They were documented on `envGetter.events` but never emitted (BUG-1).
   - *Action:* Existing `envGetter.events.on('updated' | 'error', ...)` listeners will now receive events.
5. **Config classes created by `AppConfigModule` report two or more errors as one aggregated `EnvValidationError`.** A single error is unchanged; opt out with `aggregateErrors: false`. Config classes are now created through a factory provider; lifecycle hooks are unaffected, and classes that need property injection, `forwardRef` or a non-default scope automatically keep the old path (MOD-5).
   - *Action:* Pass `aggregateErrors: false` if a test expects only the first error when multiple variables are invalid.
6. **`.env` files load when `forRoot()` is called** (at module-definition time), not only when the service is constructed (MOD-4).
   - *Action:* None for normal apps; tests spying on `loadEnvFile` call counts will see the eager call at `forRoot()` time.
7. **`forRootAsync({ useFactory })` without `inject` now receives `EnvGetterService` as its first argument** (MOD-1).
   - *Action:* Pass `inject: []` explicitly if your factory relies on `arguments.length === 0`.
8. **`AppConfigModule` and `EnvGetterModule` now share one `EnvGetterService`** when their options match or neither has options. Previously there were always two (MOD-1).
9. **The `AppConfigModule` class is no longer decorated with `@Global()`.** The `forRoot` and `forRootAsync` modules are still global, and a bare `imports: [AppConfigModule]` was and remains a no-op (MOD-1).
10. **`APP_CONFIG` now also resolves for `useClass` configs.** This is additive (MOD-1).
11. **An optional config file that is malformed at startup now gets a watcher** and hot-reloads once it is fixed (BUG-4).

## Migration to v1.2.0

| Getter / area | Before (v1.1.x) | After (v1.2.0) |
|---|---|---|
| `getOptionalBooleanEnv` with `TRUE` / `1` / `yes` | silently returned `false` | **throws** (only `"true"` / `"false"` accepted) |
| `getRequiredNumericEnv` / `getOptionalNumericEnv` with `"___"` or `"1__2"` | `"___"` → `0`, `"_1"` → 1 | **throws** (underscores only between digit groups) |
| `getOptionalNumericEnv` with a present-but-invalid value | returned the default | **throws** |
| Any `getRequired*` with `KEY=` (empty value) | accepted as a valid empty string | **throws** `"Variable 'KEY' is set but empty"` |
| `getOptionalEnv(name, allowedValues[])` when `name` is unset | **threw** (treated unset as invalid) | returns `undefined` |
| `getOptionalEnv` empty-string value | returned `""` (ignored default) | returns default (treated as unset) |
| `getOptionalCron` with empty string | threw (invalid cron expression) | returns `undefined` |
| `isTimePeriod(NaN)` / `isTimePeriod(-1)` | `true` | `false` |
| Single-quoted `.env` values (e.g. `A='${B}'`) | `${B}` was expanded | stored literally, not expanded |
| `$`-patterns in interpolated values (`pa$$w0rd`) | could corrupt to `pa$w0rd` | inserted verbatim |

## License

This project is licensed under the MIT License. See the [LICENSE](./LICENSE) file for details.

## Citation

If you use this library in your research or professional projects, please cite it as follows:

**Ivan Baha**. (2026). _nestjs-env-getter_.

[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.18457368.svg)](https://doi.org/10.5281/zenodo.18457368)
[![ORCID iD](https://img.shields.io/badge/ORCID-0009--0005--7024--7724-A6CE39?logo=orcid&logoColor=white)](https://orcid.org/0009-0005-7024-7724)
