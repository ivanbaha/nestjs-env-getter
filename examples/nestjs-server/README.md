# NestJS Server Example

This project demonstrates the **full practical surface** of `nestjs-env-getter` v1.3.0 in a real NestJS app — with **zero external service prerequisites** (no MongoDB or Docker required).

## Key Features Demonstrated

- **`EnvConfig` base class (v1.3.0)**: inline field initializers with full TypeScript literal-union inference (`NODE_ENV`, `APP_STAGE`, `ENABLED_REGIONS`, `OPTIONAL_FEATURE_FLAGS`)
- **`AppConfigModule.forRoot` & `forFeature` (v1.3.0)**: root `AppConfig` registration plus feature-scoped `TasksConfig` in `TasksModule`
- **Automatic error aggregation (v1.3.0)**: reports all missing/invalid variables at once via `EnvValidationError`
- **`@Inject(APP_CONFIG)` alias**: `DatabaseConnectionService` injects `AppConfig` via the `APP_CONFIG` token
- **All `EnvGetterService` getter families**:
  - required/optional string (with literal union narrowing), numeric, boolean, URL, time period
  - `getRequiredList` & `getOptionalList` (comma and custom `;` separator, `allowedValues`)
  - `getRequiredObject` & `getOptionalObject` (plain JSON and validated class instances, with/without defaults)
  - `getRequiredArray` & `getOptionalArray` (with `(el, index, array)` element validator)
  - `getRequiredCron` & `getOptionalCron` (including default cron expression, `isMatching()`, `getPrevTime()`, `getNextTime()`)
  - `getRequiredConfigFromFile` & `getOptionalConfigFromFile` (relative to `configBaseDir`, with/without defaults and validation classes)
- **Hot reload & events**: per-file `.on()`, `.once()`, `.off()`, `Disposable.unsubscribe()`, and global `envGetter.events` (`'updated'` and `'error'`)

## How It Works

### 1. Module Wiring (`src/app.module.ts` & `src/tasks/tasks.module.ts`)

```typescript
// src/app.module.ts
AppConfigModule.forRoot({
  useClass: AppConfig,
  providers: [AppConfigOptionsService],
  envGetter: {
    envFilePath: ['example.env', '.env'], // example.env provides defaults; optional local .env overrides
    configBaseDir: join(process.cwd(), 'configs'),
  },
}),

// src/tasks/tasks.module.ts
@Module({
  imports: [AppConfigModule.forFeature(TasksConfig)],
  providers: [TasksService],
})
export class TasksModule {}
```

### 2. `AppConfigOptionsService` (`src/app-config-options.service.ts`)

Injects `EnvGetterService` to read `NODE_ENV` as a narrowed union (`'development' | 'staging' | 'production' | 'test'`) and returns config filenames relative to `configs/` (`mongo-creds.json`, `test-configs.json`, etc.).

### 3. `AppConfig` & `TasksConfig` (`src/app.config.ts`, `src/tasks/tasks.config.ts`)

Both extend `EnvConfig`, declaring environment-backed fields with concise inline initializers. File-backed fields in `AppConfig` that depend on `AppConfigOptionsService` are initialized in the constructor body after `super(envGetter)`.

## Endpoints

- `GET /` → health check (`Hello World!`)
- `GET /config` → flat snapshot of parsed and validated configuration values
- `GET /config/grouped` → diagnostics grouped by feature area (`envTypes`, `parserFeatures`, `cron`, `fileConfigs`, `watchersAndEvents`)
- `GET /db/status` → simulated database connection status (`maskedUri`, `reconnectCount`, `lastReconnectAt`, `lastError`, `firstUpdateReceived`)

## Try It

No `.env` copy or database container is required — `example.env` is loaded automatically as the base layer:

```bash
yarn start
```

In another terminal, query the endpoints:

```bash
curl http://localhost:3000/config
curl http://localhost:3000/config/grouped
curl http://localhost:3000/db/status
```

### Live Hot-Reload Demo

While the server is running, edit `configs/mongo-creds.json` (for example, change the database name or host) and save the file. Then run:

```bash
curl http://localhost:3000/db/status
```

You will see `reconnectCount` increment, `lastReconnectAt` update, and `firstUpdateReceived: true`.

## Testing

The example includes unit and e2e tests covering the real `AppModule`, live file hot-reload in a temporary directory, `forRootAsync` factory patterns, `forTesting` error aggregation, and plain unit testing of `TasksConfig` without Nest DI:

```bash
yarn test
yarn test:e2e
```
