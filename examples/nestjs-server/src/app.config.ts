import { Injectable } from '@nestjs/common';
// Import the EnvGetterService from the nestjs-env-getter library
import { EnvGetterService, WithConfigEvents, CronSchedule } from 'nestjs-env-getter';
import { AppConfigOptionsService } from './app-config-options.service';

@Injectable()
export class AppConfig {
  readonly port: number;
  readonly nodeEnv: string;
  readonly isNodeEnvSet: boolean;

  mongoConfigs: WithConfigEvents<MongoCredentials>;
  readonly staticMongoConfigsNoWatch: WithConfigEvents<MongoCredentials>;

  readonly testConfigString: string;
  readonly testConfigNumber: number;
  readonly testConfigBoolean: boolean;
  readonly optionalLogLevel: string | undefined;
  readonly optionalLogLevelWithDefault: string;
  readonly optionalStageAllowed: string | undefined;
  readonly optionalStageWithDefaultAllowed: string | undefined;
  readonly optionalNumericTimeout: number;
  readonly optionalBooleanFlag: boolean;
  readonly apiUrl: URL;
  readonly cdnUrl: URL;
  readonly sessionTtlMs: number;
  readonly workerIntervalSeconds: number;

  testConfig?: WithConfigEvents<TestConfig>;
  readonly optionalConfigFallback: WithConfigEvents<OptionalFeatureConfig>;

  readonly singleQuotedVal: string;
  readonly doubleQuotedVal: string;
  readonly privateKey: string;
  readonly appName: string;
  readonly appTitle: string;
  readonly baseUrl: string;
  readonly databaseUrl: string;
  readonly emptyVal: string;
  readonly allowedDomains: string[];
  readonly complexConfig: ComplexConfig;
  readonly simpleConfig: SimpleConfig;
  readonly inlineObjectConfig: InlineObjectConfig;

  readonly backupSchedule: CronSchedule;
  readonly cleanupSchedule?: CronSchedule;

  constructor(
    protected readonly envGetter: EnvGetterService,
    private readonly configOptions: AppConfigOptionsService,
  ) {
    const options = this.configOptions.getConfigOptions();

    this.port = this.envGetter.getRequiredNumericEnv('PORT');
    this.nodeEnv = this.envGetter.getRequiredEnv('NODE_ENV', ['development', 'staging', 'production', 'test']);
    this.isNodeEnvSet = this.envGetter.isEnvSet('NODE_ENV');

    this.mongoConfigs = this.envGetter.getRequiredConfigFromFile(
      options.mongoCredentialsFile,
      MongoCredentials,
      options.fileWatcherOptions,
    );

    this.staticMongoConfigsNoWatch = this.envGetter.getRequiredConfigFromFile(
      options.mongoCredentialsFile,
      MongoCredentials,
      { enabled: false },
    );

    this.testConfigString = this.envGetter.getRequiredEnv('TEST_CONFIG_STRING');
    this.testConfigNumber = this.envGetter.getRequiredNumericEnv('TEST_CONFIG_NUMBER');
    this.testConfigBoolean = this.envGetter.getRequiredBooleanEnv('TEST_CONFIG_BOOLEAN');
    this.optionalLogLevel = this.envGetter.getOptionalEnv('LOG_LEVEL');
    this.optionalLogLevelWithDefault = this.envGetter.getOptionalEnv('LOG_LEVEL_DEFAULTED', 'info');
    this.optionalStageAllowed = this.envGetter.getOptionalEnv('APP_STAGE', ['alpha', 'beta']);
    this.optionalStageWithDefaultAllowed = this.envGetter.getOptionalEnv('APP_STAGE_DEFAULTED', 'beta', [
      'alpha',
      'beta',
    ]);
    this.optionalNumericTimeout = this.envGetter.getOptionalNumericEnv('REQUEST_TIMEOUT_MS', 5_000);
    this.optionalBooleanFlag = this.envGetter.getOptionalBooleanEnv('MAINTENANCE_MODE', false);

    this.apiUrl = this.envGetter.getRequiredURL('API_URL');
    this.cdnUrl = this.envGetter.getOptionalURL('CDN_URL', new URL('https://cdn.fallback.example.com'));
    this.sessionTtlMs = this.envGetter.getRequiredTimePeriod('SESSION_TTL', 'ms');
    this.workerIntervalSeconds = this.envGetter.getOptionalTimePeriod('WORKER_INTERVAL', '30s', 's');

    this.testConfig = this.envGetter.getOptionalConfigFromFile(
      options.testConfigFile,
      { testConfigStringFromFile: 'default-value' },
      TestConfig,
      options.fileWatcherOptions,
    );

    this.optionalConfigFallback = this.envGetter.getOptionalConfigFromFile('configs/optional-feature.json', {
      enabled: false,
      mode: 'fallback',
    });

    if (this.testConfig) {
      this.testConfig.on('error', (event) => {
        console.error(`[AppConfig] Error updating config from ${event.filePath}:`, event.error.message);
      });
    }

    this.singleQuotedVal = this.envGetter.getRequiredEnv('SINGLE_QUOTED_VAL');
    this.doubleQuotedVal = this.envGetter.getRequiredEnv('DOUBLE_QUOTED_VAL');
    this.privateKey = this.envGetter.getRequiredEnv('PRIVATE_KEY');
    this.appName = this.envGetter.getRequiredEnv('APP_NAME');
    this.appTitle = this.envGetter.getRequiredEnv('APP_TITLE');
    this.baseUrl = this.envGetter.getRequiredEnv('BASE_URL');
    this.databaseUrl = this.envGetter.getRequiredEnv('DATABASE_URL');
    this.emptyVal = this.envGetter.getOptionalEnv('EMPTY_VAL', 'fallback');

    this.allowedDomains = this.envGetter.getRequiredArray<string>('ALLOWED_DOMAINS', (val) => {
      if (typeof val !== 'string') return 'Each domain must be a string';
      if (!val.includes('.')) return 'Invalid domain format';
      return true;
    });

    this.complexConfig = this.envGetter.getRequiredObject('COMPLEX_CONFIG', ComplexConfig);
    this.simpleConfig = this.envGetter.getRequiredObject('SIMPLE_CONFIG', SimpleConfig);
    this.inlineObjectConfig = this.envGetter.getRequiredObject('INLINE_OBJECT_CONFIG');

    this.backupSchedule = this.envGetter.getRequiredCron('BACKUP_SCHEDULE');
    this.cleanupSchedule = this.envGetter.getOptionalCron('CLEANUP_SCHEDULE');

    console.log('[AppConfig] --- All Configs JSON Snapshot ---');
    console.log(JSON.stringify(this.getGroupedConfigDiagnostics(), null, 2));
    console.log('[AppConfig] ---------------------------------');
  }

  getGroupedConfigDiagnostics(): unknown {
    return {
      envTypes: {
        required: {
          port: this.port,
          nodeEnv: this.nodeEnv,
          testConfigString: this.testConfigString,
          testConfigNumber: this.testConfigNumber,
          testConfigBoolean: this.testConfigBoolean,
          apiUrl: this.apiUrl.toString(),
          sessionTtlMs: this.sessionTtlMs,
        },
        optional: {
          isNodeEnvSet: this.isNodeEnvSet,
          optionalLogLevel: this.optionalLogLevel,
          optionalLogLevelWithDefault: this.optionalLogLevelWithDefault,
          optionalStageAllowed: this.optionalStageAllowed,
          optionalStageWithDefaultAllowed: this.optionalStageWithDefaultAllowed,
          optionalNumericTimeout: this.optionalNumericTimeout,
          optionalBooleanFlag: this.optionalBooleanFlag,
          cdnUrl: this.cdnUrl.toString(),
          workerIntervalSeconds: this.workerIntervalSeconds,
        },
      },
      parserFeatures: {
        singleQuotedVal: this.singleQuotedVal,
        doubleQuotedVal: this.doubleQuotedVal,
        appName: this.appName,
        appTitle: this.appTitle,
        baseUrl: this.baseUrl,
        databaseUrl: this.databaseUrl,
        emptyVal: this.emptyVal,
        allowedDomains: this.allowedDomains,
        complexConfig: this.complexConfig,
        simpleConfig: this.simpleConfig,
        inlineObjectConfig: this.inlineObjectConfig,
      },
      cron: {
        backupSchedule: this.backupSchedule.toString(),
        backupPrev: this.backupSchedule.getPrevTime()?.toISOString() ?? null,
        backupNext: this.backupSchedule.getNextTime()?.toISOString() ?? null,
        cleanupSchedule: this.cleanupSchedule?.toString(),
        cleanupPrev: this.cleanupSchedule?.getPrevTime()?.toISOString() ?? null,
        cleanupNext: this.cleanupSchedule?.getNextTime()?.toISOString() ?? null,
      },
      fileConfigs: {
        mongoConfigs: this.mongoConfigs,
        staticMongoConfigsNoWatch: this.staticMongoConfigsNoWatch,
        testConfig: this.testConfig,
        optionalConfigFallback: this.optionalConfigFallback,
      },
      watchersAndEvents: {
        perConfigEvents: {
          testConfigOnErrorSubscribed: Boolean(this.testConfig),
        },
        globalEvents: {
          updated: 'subscribed in AppService constructor',
          error: 'subscribed in AppService constructor',
        },
      },
    };
  }
}

// Classes for validating configs obtained from files using nestjs-env-getter

class MongoCredentials {
  connectionString: string;

  // Used by EnvGetterService to validate the loaded config
  constructor(data: Record<string, unknown>) {
    if (!data.connectionString || typeof data.connectionString !== 'string') {
      throw new Error('connectionString is required and must be a string');
    }
    this.connectionString = data.connectionString;
  }
}

class TestConfig {
  testConfigStringFromFile: string;

  // Used by EnvGetterService to validate the loaded config
  constructor(data: Record<string, unknown>) {
    if (!data.testConfigStringFromFile || typeof data.testConfigStringFromFile !== 'string') {
      throw new Error('testConfigStringFromFile is required and must be a string');
    }
    this.testConfigStringFromFile = data.testConfigStringFromFile;
  }
}

class ComplexConfig {
  featureEnabled: boolean;
  maxUsers: number;
  apiEndpoint: string;
  retryConfig: {
    count: number;
    interval: number;
  };

  constructor(data: Record<string, unknown>) {
    if (typeof data.featureEnabled !== 'boolean') throw new Error('featureEnabled is required (boolean)');
    if (typeof data.maxUsers !== 'number') throw new Error('maxUsers is required (number)');
    if (typeof data.apiEndpoint !== 'string') throw new Error('apiEndpoint is required (string)');
    const retryConfig = data.retryConfig as Record<string, unknown> | undefined;
    if (!retryConfig || typeof retryConfig.count !== 'number' || typeof retryConfig.interval !== 'number') {
      throw new Error('retryConfig is required with count and interval as numbers');
    }

    this.featureEnabled = data.featureEnabled;
    this.maxUsers = data.maxUsers;
    this.apiEndpoint = data.apiEndpoint;
    this.retryConfig = { count: retryConfig.count, interval: retryConfig.interval };
  }
}

class SimpleConfig {
  name: string;
  version: number;
  enabled: boolean;

  constructor(data: Record<string, unknown>) {
    if (typeof data.name !== 'string') throw new Error('name is required (string)');
    if (typeof data.version !== 'number') throw new Error('version is required (number)');
    if (typeof data.enabled !== 'boolean') throw new Error('enabled is required (boolean)');

    this.name = data.name;
    this.version = data.version;
    this.enabled = data.enabled;
  }
}

type OptionalFeatureConfig = {
  enabled: boolean;
  mode: string;
};

type InlineObjectConfig = {
  retries: number;
  strategy: string;
};
