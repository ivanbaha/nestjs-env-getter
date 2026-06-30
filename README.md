# NestJS ENV Getter

`nestjs-env-getter` is a powerful and lightweight NestJS module designed to streamline the process of retrieving and validating environment variables. It ensures your application starts with a correct and type-safe configuration by providing a robust API for handling various data types and validation scenarios.

## Key Features

- **Type-Safe Retrieval**: Get environment variables as strings, numbers, booleans, URLs, objects, arrays, or time periods.
- **Built-in Validation**: Validate variables against allowed values or use custom validation functions.
- **Required vs. Optional**: Clearly distinguish between required variables that throw an error if missing and optional ones with default values.
- **Error Handling**: Throws a descriptive error if a required variable is missing or invalid.
- **`.env` Support**: Built-in parser with variable interpolation, multiline strings, and system env priority.
- **Configuration Scaffolding**: Includes a CLI helper to quickly set up a centralized configuration file.

## Environment File Parsing

The module includes a zero-dependency `.env` file parser. Key behaviors:

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

The recommended way to use `nestjs-env-getter` is by creating a centralized configuration service.

### 1. Create a Configuration Service

Create a file `src/app.config.ts` to define and validate all your environment variables.

```typescript
// src/app.config.ts
import { Injectable } from "@nestjs/common";
import { EnvGetterService } from "nestjs-env-getter";

@Injectable()
export class AppConfig {
  readonly port: number;
  readonly mongoConnectionString: string;
  readonly nodeEnv: string;

  constructor(private readonly envGetter: EnvGetterService) {
    this.port = this.envGetter.getRequiredNumericEnv("PORT");
    this.mongoConnectionString = this.envGetter.getRequiredEnv(
      "MONGO_CONNECTION_STRING",
    );
    this.nodeEnv = this.envGetter.getRequiredEnv("NODE_ENV", [
      "development",
      "production",
    ]);
  }
}
```

### 2. Register the Configuration

In your `AppModule`, import `AppConfigModule` and provide your custom `AppConfig` class. This makes `AppConfig` a singleton provider available for dependency injection across your application.

```typescript
// src/app.module.ts
import { Module } from "@nestjs/common";
import { AppConfigModule } from "nestjs-env-getter";
import { AppConfig } from "./app.config";

@Module({
  imports: [
    // Register the custom AppConfig class
    AppConfigModule.forRoot({ useClass: AppConfig }),
  ],
})
export class AppModule {}
```

### 3. Use the Configuration

Now you can inject `AppConfig` anywhere in your application.

```typescript
import { Injectable } from "@nestjs/common";
import { AppConfig } from "./app.config";

@Injectable()
export class DatabaseService {
  private readonly connectionString: string;

  constructor(private readonly config: AppConfig) {
    this.connectionString = config.mongoConnectionString;
    // Use the connection string...
  }
}
```

This approach centralizes your environment variable management, making your application cleaner and easier to maintain.

### Using `forRootAsync` with a Factory

For more complex scenarios (e.g., async initialization), use `forRootAsync` with a factory function. Inject the resulting config using the exported `APP_CONFIG` token:

```typescript
import { Module, Inject } from "@nestjs/common";
import { AppConfigModule, APP_CONFIG } from "nestjs-env-getter";

@Module({
  imports: [
    AppConfigModule.forRootAsync({
      useFactory: (/* injected deps */) => ({ port: 3000 }),
    }),
  ],
})
export class AppModule {}

// In a service:
@Injectable()
export class SomeService {
  constructor(@Inject(APP_CONFIG) private readonly config: { port: number }) {}
}
```

### `EnvGetterModule` vs `AppConfigModule`

> **These two modules are alternatives — do not import both.**

| Module            | When to use                                                                               |
| ----------------- | ----------------------------------------------------------------------------------------- |
| `AppConfigModule` | Recommended. Provides `EnvGetterService` **and** registers a custom config class/factory. |
| `EnvGetterModule` | Lightweight. Only provides `EnvGetterService` globally, without the config-class pattern. |

### Module Options

By default the service loads `./.env` once at startup. `EnvGetterModule.forRoot(options)` customizes that (the plain `imports: [EnvGetterModule]` form keeps working unchanged):

```typescript
import { EnvGetterModule } from "nestjs-env-getter";

@Module({
  imports: [
    EnvGetterModule.forRoot({
      // Path(s) to load at startup; `false` disables the implicit .env load entirely.
      envFilePath: [".env", ".env.local"], // string | string[] | false (default: ".env")
      // Confine config-file resolution (getRequired/getOptionalConfigFromFile) to a
      // directory tree. Any path escaping it terminates the app (path-traversal guard).
      configBaseDir: "./configs",
    }),
  ],
})
export class AppModule {}
```

When using `AppConfigModule`, pass the same options through the `envGetter` field:

```typescript
AppConfigModule.forRoot({ useClass: AppConfig, envGetter: { envFilePath: false } });
```

`EnvGetterModuleOptions` and the `ENV_GETTER_OPTIONS` injection token are exported from the package root.

## CLI Helper

You can scaffold the configuration file and module setup automatically with the built-in CLI command. Run this in the root of your NestJS project:

```bash
npx nestjs-env-getter init
```

This command (shorthand `npx nestjs-env-getter i`) will:

1. Create `src/app.config.ts` from a template.
2. Import `AppConfigModule.forRoot({ useClass: AppConfig })` into your `src/app.module.ts`.

## Example Project

A full working NestJS application demonstrating all available functionality is available in the [examples](https://github.com/ivanbaha/nestjs-env-getter/tree/main/examples) directory on GitHub. The example project is not included in the npm package.

## API Reference (`EnvGetterService`)

Here are detailed examples of the methods available in `EnvGetterService`.

### String

- **`getRequiredEnv(name: string, allowed?: string[]): string`**

  ```typescript
  // Throws an error if DB_HOST is not set (or set but empty)
  const dbHost = this.envGetter.getRequiredEnv("DB_HOST");

  // Throws an error if NODE_ENV is not 'development' or 'production'
  const nodeEnv = this.envGetter.getRequiredEnv("NODE_ENV", [
    "development",
    "production",
  ]);
  ```

- **`getOptionalEnv(name: string, default?: string, allowed?: string[]): string | undefined`**

  Unset or empty (`KEY=`) → returns the default (or `undefined`). With an `allowed` list, the effective value (env value or provided default) is validated; an unset/empty variable with no default skips validation entirely — the variable stays truly optional.

  ```typescript
  // Returns 'info' if LOG_LEVEL is not set or empty
  const logLevel = this.envGetter.getOptionalEnv("LOG_LEVEL", "info");

  // Returns undefined if MODE is unset; throws only if MODE is set to something else
  const mode = this.envGetter.getOptionalEnv("MODE", ["fast", "safe"]);
  ```

  > !!! A disallowed value is **echoed in the error message** — never use the `allowed` list with secret variables.

### Number

Numeric getters accept **integers only** — no decimals (`1.5`) and no scientific notation (`1e3`). Underscores may be used as digit-group separators, but only **between** digit groups (`1_000_000` is valid; `_1`, `1__2`, `12_` are not). Values beyond `Number.MAX_SAFE_INTEGER` are rejected rather than silently losing precision.

- **`getRequiredNumericEnv(name: string): number`**

  ```typescript
  // Throws an error if PORT is missing, empty, not a valid integer, or unsafe
  const port = this.envGetter.getRequiredNumericEnv("PORT");
  ```

- **`getOptionalNumericEnv(name: string, default?: number): number | undefined`**

  ```typescript
  // Returns 3000 if TIMEOUT is not set or empty.
  // A present-but-invalid value (e.g. TIMEOUT=abc) throws — it does NOT fall back.
  const timeout = this.envGetter.getOptionalNumericEnv("TIMEOUT", 3000);
  ```

### Boolean

Boolean getters are strict and **case-sensitive**: only the exact strings `true` and `false` are accepted. Anything else (`TRUE`, `1`, `yes`, typos) throws instead of silently becoming `false` — a misspelled security toggle must fail loudly, not fail open.

- **`getRequiredBooleanEnv(name: string): boolean`**

  ```typescript
  // Throws an error if DEBUG_MODE is not exactly 'true' or 'false'
  const isDebug = this.envGetter.getRequiredBooleanEnv("DEBUG_MODE");
  ```

- **`getOptionalBooleanEnv(name: string, default?: boolean): boolean | undefined`**

  ```typescript
  // Returns false if ENABLE_SSL is not set or empty; throws if set to anything
  // other than exactly 'true'/'false'
  const useSsl = this.envGetter.getOptionalBooleanEnv("ENABLE_SSL", false);
  ```

### URL

- **`getRequiredURL(name: string): URL`**

  ```typescript
  // Throws an error if API_URL is not a valid URL
  const apiUrl = this.envGetter.getRequiredURL("API_URL");
  ```

- **`getOptionalURL(name: string, default?: URL): URL | undefined`**

  ```typescript
  const defaultUrl = new URL("https://fallback.example.com");
  // Returns defaultUrl if CDN_URL is not set or empty.
  // A present-but-invalid URL throws — it does NOT fall back.
  const cdnUrl = this.envGetter.getOptionalURL("CDN_URL", defaultUrl);
  ```

### Time Period

Parses a string like `'10s'`, `'5m'`, `'2h'`, `'1d'` into a numeric value.

> Results are rounded **up** to the nearest integer (`Math.ceil`): `1500ms` requested in seconds yields `2`. Plain numbers are interpreted as milliseconds; non-finite or negative numbers are rejected.

- **`getRequiredTimePeriod(name: string, resultIn: 'ms' | 's' | 'm' | 'h' | 'd' = 'ms'): number`**

  ```typescript
  // Parses '30s' into 30000
  const cacheTtl = this.envGetter.getRequiredTimePeriod("CACHE_TTL");

  // Parses '2h' into 2
  const sessionHours = this.envGetter.getRequiredTimePeriod(
    "SESSION_DURATION",
    "h",
  );
  ```

- **`getOptionalTimePeriod(...)`** — three overloads:
  - `(name)` → `number | undefined` — `undefined` when unset/empty.
  - `(name, resultIn)` → `number | undefined` — same, converted to the given unit.
  - `(name, defaultValue, resultIn?)` → `number` — falls back to the default (a time string like `"30s"`, or a number of milliseconds).

  ```typescript
  // undefined if SHUTDOWN_GRACE is not set; milliseconds if set
  const grace = this.envGetter.getOptionalTimePeriod("SHUTDOWN_GRACE");

  // undefined if not set; seconds if set
  const graceSec = this.envGetter.getOptionalTimePeriod("SHUTDOWN_GRACE", "s");

  // Returns 60 (seconds) if JWT_EXPIRES_IN is not set
  const expiresIn = this.envGetter.getOptionalTimePeriod(
    "JWT_EXPIRES_IN",
    "1m",
    "s",
  );

  // Number defaults are milliseconds: returns 5 (seconds) when unset
  const timeout = this.envGetter.getOptionalTimePeriod("TIMEOUT", 5000, "s");
  ```

  A set-but-invalid value throws for every form; an invalid `defaultValue` throws as well.

### Cron Expression

Parses cron expressions and returns a `CronSchedule` object with utility methods. Supports both 5-field (minute, hour, day-of-month, month, day-of-week) and 6-field (second, minute, hour, day-of-month, month, day-of-week) formats.

- **`getRequiredCron(name: string): CronSchedule`**

  ```typescript
  // Throws an error if BACKUP_SCHEDULE is not set or invalid
  const backupSchedule = this.envGetter.getRequiredCron("BACKUP_SCHEDULE");
  // ENV: '0 2 * * *' (runs at 2:00 AM daily)

  // Get the next scheduled execution time
  console.log(backupSchedule.getNextTime()); // Date object

  // Check if current time matches the schedule
  console.log(backupSchedule.isMatching(new Date())); // boolean

  // Get the original cron expression
  console.log(backupSchedule.toString()); // '0 2 * * *'
  ```

- **`getOptionalCron(name: string): CronSchedule | undefined`**

  ```typescript
  // Returns undefined if CLEANUP_SCHEDULE is not set
  const cleanupSchedule = this.envGetter.getOptionalCron("CLEANUP_SCHEDULE");

  if (cleanupSchedule) {
    console.log("Next cleanup at:", cleanupSchedule.getNextTime());
  }
  ```

**`CronSchedule` Methods:**

- `toString(): string` - Returns the original cron expression.
- `isMatching(date: Date): boolean` - Checks if the given date matches the schedule.
- `getNextTime(from?: Date): Date | null` - Calculates the next execution time after the given date (defaults to current time).

**Supported Cron Formats:**

| Field        | 5-field index | 6-field index | Allowed Values                    |
| ------------ | ------------- | ------------- | --------------------------------- |
| Second       | -             | 0             | 0-59                              |
| Minute       | 0             | 1             | 0-59                              |
| Hour         | 1             | 2             | 0-23                              |
| Day of Month | 2             | 3             | 1-31                              |
| Month        | 3             | 4             | 1-12 or JAN-DEC                   |
| Day of Week  | 4             | 5             | 0-7 (0 and 7 = Sunday) or SUN-SAT |

**Special Characters:** `*` (any), `,` (list), `-` (range), `/` (step)

### Object (from JSON string)

- **`getRequiredObject<T>(name: string, cls?: ClassConstructor<T>): T`**

  ```typescript
  // ENV: '{"user": "admin", "port": 5432}'
  const dbConfig = this.envGetter.getRequiredObject<{
    user: string;
    port: number;
  }>("DB_CONFIG");
  console.log(dbConfig.port); // 5432
  ```

### Array (from JSON string)

- **`getRequiredArray<T>(name: string, validate?: (el: T) => boolean | string): T[]`**

  ```typescript
  // ENV: '["192.168.1.1", "10.0.0.1"]'
  const allowedIPs = this.envGetter.getRequiredArray<string>("ALLOWED_IPS");

  // With validation
  const servicePorts = this.envGetter.getRequiredArray<number>(
    "SERVICE_PORTS",
    (port) => {
      if (typeof port !== "number" || port < 1024) {
        return `Port ${port} is invalid. Must be a number >= 1024.`;
      }
      return true;
    },
  );
  ```

### Configuration from JSON Files

Load and validate configuration from JSON files with automatic file watching and hot-reload support.

> !!! **`filePath` must never be derived from untrusted input** — it is handed to the filesystem (same trust contract as `fs.readFileSync`). To enforce confinement at runtime, set the `configBaseDir` module option (see [Module Options](#module-options)): any path resolving outside that directory terminates the app.
>
> **Defaults must be plain data.** A function-typed `defaultValue` is indistinguishable from a class constructor (`typeof === "function"`) and will be misread as `cls`.

- **`getRequiredConfigFromFile<T>(filePath: string, cls?: ClassConstructor<T>, watcherOptions?: FileWatcherOptions): T`**

  Reads a required JSON configuration file. Automatically watches for file changes and updates the cached config.

  ```typescript
  // With class validation
  class MongoCredentials {
    connectionString: string;

    constructor(data: any) {
      if (!data.connectionString) {
        throw new Error("connectionString is required");
      }
      this.connectionString = data.connectionString;
    }
  }

  const mongoCreds = this.envGetter.getRequiredConfigFromFile(
    "configs/mongo-creds.json",
    MongoCredentials,
  );
  console.log(mongoCreds.connectionString);

  // Disable file watching
  const staticConfig = this.envGetter.getRequiredConfigFromFile(
    "config.json",
    undefined,
    { enabled: false },
  );

  // Custom debounce timing (default is 350ms)
  const config = this.envGetter.getRequiredConfigFromFile(
    "config.json",
    undefined,
    { debounceMs: 1000 },
  );
  ```

- **`getOptionalConfigFromFile<T>(filePath: string, defaultValue?: T, cls?: ClassConstructor<T>, watcherOptions?: FileWatcherOptions): T | undefined`**

  Reads an optional JSON configuration file. Returns the default value if the file doesn't exist or cannot be parsed as JSON. Only throws an error if validation fails (when using a class constructor).

  ```typescript
  // With class validation
  class TestConfig {
    testConfigStringFromFile: string;

    constructor(data: any) {
      if (!data.testConfigStringFromFile) {
        throw new Error("testConfigStringFromFile is required");
      }
      this.testConfigStringFromFile = data.testConfigStringFromFile;
    }
  }

  const testConfig = this.envGetter.getOptionalConfigFromFile(
    "configs/test-configs.json",
    TestConfig,
  );

  // With default value - gracefully handles missing files and JSON parsing errors
  const config = this.envGetter.getOptionalConfigFromFile(
    "optional-config.json",
    { fallbackValue: "default" },
  );

  // Note: Optional config files are graceful - missing files or JSON parsing errors
  // return the default value (or undefined). Only validation errors throw.
  ```

#### ⚠️ Important: Error Handling Behavior

**Required vs Optional Config Files:**

- **`getRequiredConfigFromFile`**: Throws an error if the file is missing, has invalid JSON, or fails validation.
- **`getOptionalConfigFromFile`**: Only throws on validation errors (when using class constructors). Missing files or JSON parsing errors gracefully return the default value or `undefined`.

This design ensures that optional configurations truly are optional - your application won't crash due to missing or malformed optional config files, but validation constraints are still enforced when files are present and parsable.

#### Supported file-rotation patterns

The watcher keeps configs live through all common secret-rotation flows:

- **Atomic replace** (Vault agent: write temp file + `rename`) — the watcher re-establishes itself after each update.
- **Delete → recreate** — on deletion an `error:<path>` event fires and a parent-directory watcher takes over; when the file reappears, updates resume and an `updated:<path>` event fires.
- **File appears after boot** (e.g. a secret mounted post-start) — `getOptionalConfigFromFile` on a missing file installs a parent-directory watcher. When the file shows up, the originally returned default object is updated **in place** and `updated:<path>` fires. With no default, subscribe via `service.events` (`updated:<absolute path>`) or re-call the getter — a returned `undefined` cannot retroactively become the config.

One limitation: the **parent directory must exist** at call time. If it doesn't, no watcher is installed (ancestor directories are not walked).

#### !!! Important: Using Config Values by Reference

To ensure your application automatically receives updated config values when files change, you **must store config objects by reference**, not by extracting primitive values:

```typescript
// ✅ CORRECT - Store the object reference
@Injectable()
export class AppConfig {
  mongoConfigs: MongoCredentials; // Store the entire object
  testConfig?: TestConfig; // Store the entire object

  constructor(protected readonly envGetter: EnvGetterService) {
    // Store references to config objects
    this.mongoConfigs = this.envGetter.getRequiredConfigFromFile(
      "configs/mongo-creds.json",
      MongoCredentials,
    );
    this.testConfig = this.envGetter.getOptionalConfigFromFile(
      "configs/test-configs.json",
      TestConfig,
    );
  }
}

// Access via the reference - values will update automatically
@Module({
  imports: [
    MongooseModule.forRootAsync({
      useFactory: (config: AppConfig) => ({
        uri: config.mongoConfigs.connectionString, // Access via reference
      }),
      inject: [AppConfig],
    }),
  ],
})
export class AppModule {}
```

```typescript
// ❌ WRONG - Extracting primitive values breaks hot-reload
@Injectable()
export class AppConfig {
  mongoConnectionString: string; // Primitive value - won't update!

  constructor(protected readonly envGetter: EnvGetterService) {
    const mongoCreds = this.envGetter.getRequiredConfigFromFile(
      "configs/mongo-creds.json",
      MongoCredentials,
    );
    // This extracts the VALUE at startup time - it won't update!
    this.mongoConnectionString = mongoCreds.connectionString;
  }
}
```

When the file watcher detects changes, it updates the **same object instance** in memory. If you store the object reference, your application automatically sees the updated values. If you extract primitive values (strings, numbers, booleans), they become snapshots that never update.

**File Watcher Options:**

- `enabled` (boolean, default: `true`): Enable or disable automatic file watching
- `debounceMs` (number, default: `350`): Delay in milliseconds before re-reading the file after a change

**Features:**

- ✅ Supports both absolute and relative paths (relative to `process.cwd()`)
- ✅ Automatic JSON parsing and validation
- ✅ **Hot-reload with reference preservation** - updates existing object instances in-place
- ✅ File watching with automatic change detection and file replacement support (e.g., Vault agent flow)
- ✅ Debouncing to prevent excessive re-reads
- ✅ Class-based validation with constructor pattern
- ✅ **Graceful error handling for optional configs** - missing files or JSON parsing errors return default values
- ✅ Process termination only on validation errors (required configs throw on any error)
- ✅ **Event methods attached to default values** - consistent API even when files don't exist
- ✅ No application restart needed - changes apply immediately when using object references

## Migration to v1.2.0

v1.2.0 ships several intentional behavior changes. Each item below shows the **before** (v1.1.x) behavior and **after** (v1.2.0) behavior.

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

**New additions:** `EnvGetterModule.forRoot({ envFilePath, configBaseDir })`, new no-default `getOptionalTimePeriod` overloads, watcher support for absent-at-boot files and delete→recreate rotation.

## License

This project is licensed under the MIT License. See the [LICENSE](./LICENSE) file for details.

## Citation

If you use this library in your research or professional projects, please cite it as follows:

**Ivan Baha**. (2026). _nestjs-env-getter_.

[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.18457368.svg)](https://doi.org/10.5281/zenodo.18457368)
[![ORCID iD](https://img.shields.io/badge/ORCID-0009--0005--7024--7724-A6CE39?logo=orcid&logoColor=white)](https://orcid.org/0009-0005-7024-7724)
