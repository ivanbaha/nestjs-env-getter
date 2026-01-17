# NestJS ENV Getter

`nestjs-env-getter` is a powerful and lightweight NestJS module designed to streamline the process of retrieving and validating environment variables. It ensures your application starts with a correct and type-safe configuration by providing a robust API for handling various data types and validation scenarios.

## Key Features

- **Type-Safe Retrieval**: Get environment variables as strings, numbers, booleans, URLs, objects, arrays, or time periods.
- **Built-in Validation**: Validate variables against allowed values or use custom validation functions.
- **Required vs. Optional**: Clearly distinguish between required variables that terminate the process if missing and optional ones with default values.
- **Error Handling**: Automatically terminates the process with a descriptive error message if a required variable is missing or invalid.
- **`.env` Support**: Built-in parser with variable interpolation, multiline strings, and system env priority.
- **Configuration Scaffolding**: Includes a CLI helper to quickly set up a centralized configuration file.

## Environment File Parsing

The module includes a zero-dependency `.env` file parser. Key behaviors:

- **System environment priority**: Variables already set in `process.env` are NOT overwritten by `.env` file values. This ensures CI/CD and Docker environment injections take precedence over local files.
- **Variable interpolation**: Use `${VAR_NAME}` syntax to reference other variables.
- **Quoting rules**:
  - **Unquoted**: Value ends at `#` (comment) or end of line.
  - **Single quotes** (`'`): Raw literal, no escape processing.
  - **Double quotes** (`"`): Supports `\n`, `\t`, `\\`, `\"` escapes and multiline values.
- **`export` prefix**: Automatically stripped for shell compatibility.
- **Empty values**: `KEY=` results in an empty string (not undefined).

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

## CLI Helper

You can scaffold the configuration file and module setup automatically with the built-in CLI command. Run this in the root of your NestJS project:

```bash
npx nestjs-env-getter init
```

This command (shorthand `npx nestjs-env-getter i`) will:

1. Create `src/app.config.ts` from a template.
2. Import `AppConfigModule.forRoot({ useClass: AppConfig })` into your `src/app.module.ts`.

## API Reference (`EnvGetterService`)

Here are detailed examples of the methods available in `EnvGetterService`.

### String

- **`getRequiredEnv(name: string, allowed?: string[]): string`**

  ```typescript
  // Throws an error if DB_HOST is not set
  const dbHost = this.envGetter.getRequiredEnv("DB_HOST");

  // Throws an error if NODE_ENV is not 'development' or 'production'
  const nodeEnv = this.envGetter.getRequiredEnv("NODE_ENV", [
    "development",
    "production",
  ]);
  ```

- **`getOptionalEnv(name: string, default?: string, allowed?: string[]): string | undefined`**

  ```typescript
  // Returns 'info' if LOG_LEVEL is not set
  const logLevel = this.envGetter.getOptionalEnv("LOG_LEVEL", "info");
  ```

### Number

- **`getRequiredNumericEnv(name: string): number`**

  ```typescript
  // Throws an error if PORT is not a valid number
  const port = this.envGetter.getRequiredNumericEnv("PORT");
  ```

- **`getOptionalNumericEnv(name: string, default?: number): number | undefined`**

  ```typescript
  // Returns 3000 if TIMEOUT is not set or not a valid number
  const timeout = this.envGetter.getOptionalNumericEnv("TIMEOUT", 3000);
  ```

### Boolean

- **`getRequiredBooleanEnv(name: string): boolean`**

  ```typescript
  // Throws an error if DEBUG_MODE is not 'true' or 'false'
  const isDebug = this.envGetter.getRequiredBooleanEnv("DEBUG_MODE");
  ```

- **`getOptionalBooleanEnv(name: string, default?: boolean): boolean | undefined`**

  ```typescript
  // Returns false if ENABLE_SSL is not set
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
  // Returns defaultUrl if CDN_URL is not set or not a valid URL
  const cdnUrl = this.envGetter.getOptionalURL("CDN_URL", defaultUrl);
  ```

### Time Period

Parses a string like `'10s'`, `'5m'`, `'2h'`, `'1d'` into a numeric value.

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

- **`getOptionalTimePeriod(name: string, default: string, resultIn: ...): number`**

  ```typescript
  // Returns 60 (seconds) if JWT_EXPIRES_IN is not set
  const expiresIn = this.envGetter.getOptionalTimePeriod(
    "JWT_EXPIRES_IN",
    "1m",
    "s",
  );
  ```

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

  Reads an optional JSON configuration file. Returns the default value if the file doesn't exist or cannot be parsed as JSON. Only terminates the process if validation fails (when using a class constructor).

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
  // return the default value (or undefined). Only validation errors crash the process.
  ```

#### ⚠️ Important: Error Handling Behavior

**Required vs Optional Config Files:**

- **`getRequiredConfigFromFile`**: Crashes the process if the file is missing, has invalid JSON, or fails validation.
- **`getOptionalConfigFromFile`**: Only crashes the process on validation errors (when using class constructors). Missing files or JSON parsing errors gracefully return the default value or `undefined`.

This design ensures that optional configurations truly are optional - your application won't crash due to missing or malformed optional config files, but validation constraints are still enforced when files are present and parsable.

#### ⚠️ Important: Using Config Values by Reference

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
- ✅ Process termination only on validation errors (required configs crash on any error)
- ✅ **Event methods attached to default values** - consistent API even when files don't exist
- ✅ No application restart needed - changes apply immediately when using object references

## License

This project is licensed under the MIT License. See the [LICENSE](./LICENSE) file for details.
