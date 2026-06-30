# NestJS Server Example

This project demonstrates the **full practical surface** of `nestjs-env-getter` in a real NestJS app:

- `AppConfigModule.forRootAsync({ useClass })`
- provider injection into config class (`providers` option)
- v1.2.0 module options via the `envGetter` pass-through (`envFilePath`, `configBaseDir`)
- all major `EnvGetterService` getters (string/number/boolean/url/time/object/array/cron)
- required + optional env/config flows (including the no-default `getOptionalTimePeriod` overloads)
- config-file hot reload + event subscriptions (`updated` and `error`)
- global config events via `envGetter.events`

## Key Features Demonstrated

- **Typed env getters**: required/optional string, numeric, boolean, URL, time period
- **Validation patterns**: allowed values and custom array validator callback
- **Object parsing**: class-based object validation and plain JSON object parsing from env
- **Cron support**: required and optional cron expressions with runtime schedule helpers
- **JSON file configs**: required and optional file loading with class validation, defaults, and watcher options
- **Hot reload events**: both per-config subscriptions (`config.on(...)`) and global `EnvGetterService.events`
- **Dynamic file selection**: `AppConfigOptionsService` switches config filenames by `NODE_ENV`
- **Module options (v1.2.0)**: `envFilePath` and `configBaseDir` forwarded through `AppConfigModule`'s `envGetter` option
- **Parser quoting (v1.2.0)**: `LITERAL_TEMPLATE` shows single-quoted values keep `${...}` literal (no interpolation), while double-quoted/unquoted values still expand

## How It Works

### 1. AppConfigOptionsService

`AppConfigOptionsService` provides environment-aware file and watcher settings:

- `NODE_ENV=development` → `configs/mongo-creds.json`
- `NODE_ENV=staging` → `configs/mongo-creds-staging.json`
- `NODE_ENV=production` → `configs/mongo-creds-prod.json`

It also centralizes watcher options (`enabled`, `debounceMs`, `breakOnError`).

> All values in `example.env` and `configs/mongo-creds-*.json` are **placeholders for teaching purposes** — never commit real credentials; in production, mount such files from a secret manager (Vault, K8s secrets, etc.).

### 2. AppConfigModule Registration

```typescript
AppConfigModule.forRootAsync({
  useClass: AppConfig,
  providers: [AppConfigOptionsService],
  // v1.2.0: forwarded to EnvGetterService
  envGetter: {
    envFilePath: '.env', // string | string[] | false (opt out of the implicit .env load)
    configBaseDir: process.cwd(), // confine config-file resolution; path traversal is fatal
  },
});
```

### 3. AppConfig with All Getter Families

```typescript
constructor(
  private readonly envGetter: EnvGetterService,
  private readonly optionsService: AppConfigOptionsService,
) {
  this.port = this.envGetter.getRequiredNumericEnv('PORT');
  this.apiUrl = this.envGetter.getRequiredURL('API_URL');
  this.sessionTtlMs = this.envGetter.getRequiredTimePeriod('SESSION_TTL', 'ms');
  this.allowedDomains = this.envGetter.getRequiredArray<string>('ALLOWED_DOMAINS');
  this.backupSchedule = this.envGetter.getRequiredCron('BACKUP_SCHEDULE');

  this.mongoConfigs = this.envGetter.getRequiredConfigFromFile(...);
  this.testConfig = this.envGetter.getOptionalConfigFromFile(...);
}
```

## Endpoints

- `GET /` → basic health response
- `GET /config` → snapshot of all parsed/validated example values
- `GET /config/grouped` → same data grouped by feature area (env types, parser, cron, file configs, events)

## Try It

```bash
npm install
cp example.env .env
npm run start:dev
```

> **Prerequisite:** this example wires up `@nestjs/mongoose`, so a MongoDB instance must be reachable at the connection string in `configs/mongo-creds.json` (default `mongodb://localhost:27017`) for the app to finish booting and start listening. The full `nestjs-env-getter` surface (every getter, file config, cron, and the startup diagnostics snapshot) runs during `AppConfig` construction **before** the Mongo connection, so you'll see it exercised in the logs even without a database. To run one quickly:
>
> ```bash
> docker run -d -p 27017:27017 --name mongo mongo:7
> ```

Then call:

```bash
curl http://localhost:3000/config
```

## Testing Different Environments

```bash
# Development (default)
npm run start:dev

# Staging
NODE_ENV=staging npm run start:dev

# Production
NODE_ENV=production npm run start:dev
```

## Notes on Other Public APIs

This example runtime focuses on the `AppConfigModule` path. The library also exposes:

- `EnvGetterModule` (standalone `EnvGetterService` without config-class pattern)
- `AppConfigModule.forRootAsync({ useFactory, inject })` with `APP_CONFIG` token

Minimal snippet for factory mode:

```typescript
AppConfigModule.forRootAsync({
  useFactory: (envGetter: EnvGetterService) => ({
    port: envGetter.getRequiredNumericEnv('PORT'),
  }),
  inject: [EnvGetterService],
});
```
