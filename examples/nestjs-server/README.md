# NestJS Server Example

This project demonstrates how to use environment-based configuration management in a NestJS server, including dynamic MongoDB connection handling and modular configuration loading.

## Key Features Demonstrated

- **Provider Injection in AppConfig**: Shows how to inject additional providers into `AppConfigModule` using the new `providers` option
- **Dynamic Configuration File Loading**: Uses an injected `AppConfigOptionsService` to determine configuration file names based on environment
- **Environment-based Configuration**: Different MongoDB connection strings for development, staging, and production environments

## How It Works

### 1. AppConfigOptionsService

This service provides dynamic configuration options based on the environment:

- `NODE_ENV=development` → `configs/mongo-creds.json`
- `NODE_ENV=staging` → `configs/mongo-creds-staging.json`
- `NODE_ENV=production` → `configs/mongo-creds-prod.json`

### 2. Enhanced AppConfigModule Usage

```typescript
AppConfigModule.forRoot({
  useClass: AppConfig,
  providers: [AppConfigOptionsService], // Inject additional providers
});
```

### 3. AppConfig with Injected Dependencies

```typescript
constructor(
  protected readonly envGetter: EnvGetterService,
  private readonly configOptions: AppConfigOptionsService, // Injected provider
) {
  const options = this.configOptions.getConfigOptions();
  this.mongoConfigs = this.envGetter.getRequiredConfigFromFile(
    options.mongoCredentialsFile, // Dynamic filename
    MongoCredentials
  );
}
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
