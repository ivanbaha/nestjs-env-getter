# nestjs-env-getter

The `nestjs-env-getter` is a NestJS module designed to simplify the process of retrieving and validating environment variables in your application. It provides a robust and type-safe way to handle environment variables, ensuring that your application starts with the correct configuration.

## Features

- **Type-safe environment variable retrieval**: Retrieve environment variables as strings, numbers, booleans, URLs, objects, arrays, or time periods.
- **Validation**: Validate environment variables against allowed values or custom validation functions.
- **Default values**: Provide default values for optional environment variables.
- **Error handling**: Automatically terminates the process with a descriptive error message if required environment variables are missing or invalid.

## Installation

Install the package using npm:

```bash
npm install nestjs-env-getter
```

Or using yarn:

```bash
yarn add nestjs-env-getter
```

## Usage

### Importing the Module

To use the `EnvGetterService`, import the `EnvGetterModule` into your application's module:

```typescript
import { Module } from "@nestjs/common";
import { EnvGetterModule } from "nestjs-env-getter";

@Module({ imports: [EnvGetterModule] })
export class AppModule {}
```

### Using the Service

Inject the `EnvGetterService` into your service or controller to retrieve environment variables:

```typescript
import { Injectable } from "@nestjs/common";
import { EnvGetterService } from "nestjs-env-getter";

@Injectable()
export class AppService {
  constructor(private readonly envGetter: EnvGetterService) {
    const port = this.envGetter.getRequiredNumericEnv("PORT");
    console.log(`Application will run on port: ${port}`);
  }
}
```

### Examples

#### Retrieving Required Environment Variables

```typescript
const dbHost = this.envGetter.getRequiredEnv("DB_HOST");
```

#### Retrieving Optional Environment Variables with Default Values

```typescript
const logLevel = this.envGetter.getOptionalEnv("LOG_LEVEL", "info");
```

#### Validating Environment Variables Against Allowed Values

```typescript
const environment = this.envGetter.getRequiredEnv("NODE_ENV", [
  "development",
  "production",
  "test",
]);
```

#### Parsing Numeric Environment Variables

```typescript
const timeout = this.envGetter.getRequiredNumericEnv("TIMEOUT");
```

#### Parsing Boolean Environment Variables

```typescript
const isDebugMode = this.envGetter.getRequiredBooleanEnv("DEBUG_MODE");
```

#### Parsing URLs

```typescript
const apiUrl = this.envGetter.getRequiredURL("API_URL");
```

#### Parsing Time Periods

```typescript
const cacheDuration = this.envGetter.getRequiredTimePeriod(
  "CACHE_DURATION",
  "s",
);
```

#### Parsing JSON Objects

```typescript
const config = this.envGetter.getRequiredObject<{ key: string }>("CONFIG");
```

#### Parsing Arrays with Validation

```typescript
const allowedIPs = this.envGetter.getRequiredArray<string>(
  "ALLOWED_IPS",
  (ip) => ip.startsWith("192.") || "IP must start with 192.",
);
```

## License

This project is licensed under the MIT License. See the [LICENSE](./LICENSE) file for details.
