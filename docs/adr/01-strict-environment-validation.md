# ADR-01: Strict Environment Configuration Validation (Fail-Fast)

- **Status:** Accepted
- **Date:** 2025-02-20
- **Author:** Ivan Baha
- **Technical Context:** NestJS, TypeScript, Application Configuration

## Context

The system consists of various applications with complex configurations. These range from simple services to large-scale distributed systems, where reliability and correctness are vital. Responsibility for release and configuration is often distributed across different roles (teams) and environments.

We face three critical configuration-related issues:

1. **Silent Failures:** Services start with a "Healthy" status even if non-critical variables are missing, leading to runtime failures later in the application lifecycle.
2. **Data Integrity:** Lack of strict typing leads to logical errors (e.g., handling a `'false'` string as a truthy boolean, incorrect URL formats, etc.), causing hard-to-debug incidents.
3. **Deployment Friction:** Due to the context gap between different responsible roles (e.g., developers, ops engineers), configuration errors are detected too late. Ops engineers and support teams lack tools to instantly validate config "health" without involving developers.

## Decision

We have decided to implement strict typing and validation of environment variables during the application bootstrap phase.

To achieve this, we are integrating the **[nestjs-env-getter](https://github.com/ivanbaha/nestjs-env-getter)** library, which enforces the **Fail-Fast** pattern. It uses a programmatic "getter" pattern to validate and retrieve variables instantly.

### Key Decisions

- **Dedicated Configuration Service:** We will define a single `AppConfig` class for each app (microservice) that acts as the **Single Source of Truth** for that app's configuration.
- **Fail-Fast Validation:** Validation logic is executed in the `constructor` of the `AppConfig` service. If a required variable is missing or invalid, the application will throw an error and refuse to start immediately.
- **Prohibit `process.env`:** Direct usage of `process.env` in business logic is prohibited. All configuration must be accessed via the injected `AppConfig` service that guarantees the variables are validated and typed properly enabling IDE autocompletion and type safety.

## Consequences

### Positive

- **Zero Config Ambiguity:** The service either works correctly or does not start at all. There are no "partial health" states due to bad config.
- **Self-Documentation:** The `AppConfig` class clearly defines every environment variable the application relies on, including types and allowed values.
- **Type Safety:** Developers access configuration via a typed service (e.g., `config.port` returns a `number`), eliminating type casting and `process.env` strings.
- **Flexible Instantiation:** The configuration class structure works seamlessly with both NestJS Dependency Injection (DI) and manual instantiation, providing flexibility for different contexts (e.g., scripts, tests without full app bootstrap).
- **Simplified Configuration:** Optional environment variables can be assigned sensible default values directly in the code. This reduces the number of variables that must be explicitly defined in every environment, making local development and testing easier.
- **Test-Friendly & Mockable:** Because `AppConfig` is an injected class, it can be easily mocked in unit tests (e.g., passing a mock object with `{ port: 3000 }`). This isolates tests from the global `process.env` state and simplifies CI/CD pipelines.
- **Ops Empowerment:** Ops teams receive clear, descriptive error messages (e.g., `Environment variable "PORT" is required and must be a number`) instead of obscure runtime crashes.

### Negative

- **Boilerplate:** Requires defining and maintaining a configuration class for each service.
- **Strictness:** Prevents starting the service "partially" for quick tests if the config is incomplete (though this is ultimately a safety feature).

## Realization

The implementation relies on `nestjs-env-getter`'s `EnvGetterService`.

### 1. Schema Declaration AND Validation (Single Source of Truth)

We define a specialized `AppConfig` service. Validation constraints are enforced imperatively in the constructor using `getRequired*` methods.

```typescript
// src/app.config.ts
import { Injectable } from "@nestjs/common";
import { EnvGetterService } from "nestjs-env-getter";

@Injectable()
export class AppConfig {
  readonly nodeEnv: string;
  readonly port: number;
  readonly databaseUrl: string;
  readonly featureFlagX: boolean;

  constructor(private readonly envGetter: EnvGetterService) {
    // Validates that NODE_ENV exists and is one of the allowed values
    this.nodeEnv = this.envGetter.getRequiredEnv("NODE_ENV", [
      "development",
      "production",
    ]);

    // Validates that PORT exists and is a valid number
    this.port = this.envGetter.getRequiredNumericEnv("PORT");

    // Validates that DATABASE_URL exists and is a non-empty string
    this.databaseUrl = this.envGetter.getRequiredEnv("DATABASE_URL");

    // Optional boolean with a default value.
    // If FEATURE_FLAG_X is missing, it defaults to false.
    this.featureFlagX = this.envGetter.getOptionalBooleanEnv(
      "FEATURE_FLAG_X",
      false,
    );
  }
}
```

### 2. Module Registration

We register the configuration module, which makes our `AppConfig` available for dependency injection.

```typescript
// src/app.module.ts
import { Module } from "@nestjs/common";
import { AppConfigModule } from "nestjs-env-getter";
import { AppConfig } from "./app.config";

@Module({
  imports: [
    // Registers the module and creates the singleton AppConfig
    AppConfigModule.forRoot({ useClass: AppConfig }),
  ],
})
export class AppModule {}
```

### 3. Usage in Services

We inject the `AppConfig` service to access validated variables.

```typescript
// src/app.service.ts
import { Injectable } from "@nestjs/common";
import { AppConfig } from "./app.config";

@Injectable()
export class AppService {
  constructor(private readonly config: AppConfig) {}

  getHello(): string {
    // IDE provides autocomplete and strict typing
    if (this.config.nodeEnv === "development") {
      return `Dev Mode running on port ${this.config.port}`;
    }
    return "Production Mode";
  }
}
```
