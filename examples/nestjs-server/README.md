# NestJS Server Example

This project demonstrates the **full practical surface** of `nestjs-env-getter` in a real NestJS app:

- `AppConfigModule.forRootAsync({ useClass })`
- provider injection into config class (`providers` option)
- all major `EnvGetterService` getters (string/number/boolean/url/time/object/array/cron)
- required + optional env/config flows
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

## How It Works

### 1. AppConfigOptionsService

`AppConfigOptionsService` provides environment-aware file and watcher settings:

- `NODE_ENV=development` → `configs/mongo-creds.json`
- `NODE_ENV=staging` → `configs/mongo-creds-staging.json`
- `NODE_ENV=production` → `configs/mongo-creds-prod.json`

It also centralizes watcher options (`enabled`, `debounceMs`, `breakOnError`).

### 2. AppConfigModule Registration

```typescript
AppConfigModule.forRootAsync({
  useClass: AppConfig,
  providers: [AppConfigOptionsService],
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
