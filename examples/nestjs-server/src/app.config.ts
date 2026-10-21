import { Injectable, Logger } from '@nestjs/common';
import { EnvConfig, EnvGetterService, WithConfigEvents } from 'nestjs-env-getter';
import { AppConfigOptionsService } from './app-config-options.service';

@Injectable()
export class AppConfig extends EnvConfig {
  private readonly logger = new Logger(AppConfig.name);

  readonly port = this.envGetter.getRequiredNumericEnv('PORT');
  // Inferred type: 'development' | 'staging' | 'production' | 'test' (GET-1 / EX-4 / EX-5)
  readonly nodeEnv = this.envGetter.getRequiredEnv('NODE_ENV', ['development', 'staging', 'production', 'test']);
  readonly isNodeEnvSet = this.envGetter.isEnvSet('NODE_ENV');

  readonly testConfigString = this.envGetter.getRequiredEnv('TEST_CONFIG_STRING');
  readonly testConfigNumber = this.envGetter.getRequiredNumericEnv('TEST_CONFIG_NUMBER');
  readonly testConfigBoolean = this.envGetter.getRequiredBooleanEnv('TEST_CONFIG_BOOLEAN');
  readonly optionalLogLevel = this.envGetter.getOptionalEnv('LOG_LEVEL');
  readonly optionalLogLevelWithDefault = this.envGetter.getOptionalEnv('LOG_LEVEL_DEFAULTED', 'info');
  // Inferred type: 'alpha' | 'beta' | undefined (GET-1 / EX-4)
  readonly optionalStageAllowed = this.envGetter.getOptionalEnv('APP_STAGE', ['alpha', 'beta']);
  // Inferred type: 'alpha' | 'beta' (non-nullable when default is provided — GET-1 / BUG-2)
  readonly optionalStageWithDefaultAllowed = this.envGetter.getOptionalEnv('APP_STAGE_DEFAULTED', 'beta', [
    'alpha',
    'beta',
  ]);
  readonly optionalNumericTimeout = this.envGetter.getOptionalNumericEnv('REQUEST_TIMEOUT_MS', 5_000);
  readonly optionalBooleanFlag = this.envGetter.getOptionalBooleanEnv('MAINTENANCE_MODE', false);

  readonly apiUrl = this.envGetter.getRequiredURL('API_URL');
  readonly cdnUrl = this.envGetter.getOptionalURL('CDN_URL', new URL('https://cdn.fallback.example.com'));
  readonly sessionTtlMs = this.envGetter.getRequiredTimePeriod('SESSION_TTL', 'ms');
  readonly workerIntervalSeconds = this.envGetter.getOptionalTimePeriod('WORKER_INTERVAL', '30s', 's');
  // Demonstrates getOptionalTimePeriod(name, numberDefaultMs, resultIn) (EX-5)
  readonly cacheTtlSeconds = this.envGetter.getOptionalTimePeriod('CACHE_TTL', 60_000, 's');
  // No-default getOptionalTimePeriod overloads — `number | undefined`
  readonly gracePeriodMs = this.envGetter.getOptionalTimePeriod('GRACE_PERIOD');
  readonly gracePeriodSeconds = this.envGetter.getOptionalTimePeriod('GRACE_PERIOD', 's');

  // List getters (GET-5 / EX-5)
  readonly corsOrigins = this.envGetter.getRequiredList('CORS_ORIGINS');
  // Inferred type: ('us-east' | 'eu-west' | 'ap-south')[]
  readonly enabledRegions = this.envGetter.getRequiredList('ENABLED_REGIONS', {
    allowedValues: ['us-east', 'eu-west', 'ap-south'],
  });
  // Inferred type: ('dark-mode' | 'beta-ui' | 'audit-log')[]
  readonly optionalFeatureFlags = this.envGetter.getOptionalList('OPTIONAL_FEATURE_FLAGS', ['dark-mode', 'beta-ui'], {
    separator: ';',
    allowedValues: ['dark-mode', 'beta-ui', 'audit-log'],
  });

  readonly singleQuotedVal = this.envGetter.getRequiredEnv('SINGLE_QUOTED_VAL');
  readonly doubleQuotedVal = this.envGetter.getRequiredEnv('DOUBLE_QUOTED_VAL');
  readonly literalTemplate = this.envGetter.getRequiredEnv('LITERAL_TEMPLATE');
  readonly privateKey = this.envGetter.getRequiredEnv('PRIVATE_KEY');
  readonly appName = this.envGetter.getRequiredEnv('APP_NAME');
  readonly appTitle = this.envGetter.getRequiredEnv('APP_TITLE');
  readonly baseUrl = this.envGetter.getRequiredEnv('BASE_URL');
  readonly databaseUrl = this.envGetter.getRequiredEnv('DATABASE_URL');
  readonly emptyVal = this.envGetter.getOptionalEnv('EMPTY_VAL', 'fallback');

  readonly allowedDomains = this.envGetter.getRequiredArray<string>('ALLOWED_DOMAINS', (val) => {
    if (typeof val !== 'string') return 'Each domain must be a string';
    if (!val.includes('.')) return 'Invalid domain format';
    return true;
  });

  // Demonstrates getOptionalArray with a validator that uses (el, index, array) (GET-3 / EX-5)
  readonly optionalWebhookUrls = this.envGetter.getOptionalArray<string>(
    'OPTIONAL_WEBHOOK_URLS',
    ['https://hooks.example.com/default'],
    (el, index, array) => {
      if (typeof el !== 'string' || !el.startsWith('https://')) {
        return `Webhook at index ${index} (of ${array?.length}) must be an https:// URL`;
      }
      return true;
    },
  );

  readonly complexConfig = this.envGetter.getRequiredObject('COMPLEX_CONFIG', ComplexConfig);
  readonly simpleConfig = this.envGetter.getRequiredObject('SIMPLE_CONFIG', SimpleConfig);
  readonly inlineObjectConfig = this.envGetter.getRequiredObject<InlineObjectConfig>('INLINE_OBJECT_CONFIG');

  // Demonstrates getOptionalObject with and without default, and with and without class (GET-2 / EX-5)
  readonly optionalObjectNoDefault = this.envGetter.getOptionalObject<InlineObjectConfig>('OPTIONAL_OBJECT_JSON');
  readonly optionalObjectWithClass = this.envGetter.getOptionalObject('OPTIONAL_TYPED_OBJECT_JSON', SimpleConfig);
  readonly optionalObjectWithDefault = this.envGetter.getOptionalObject<InlineObjectConfig>(
    'OPTIONAL_OBJECT_WITH_DEFAULT',
    { retries: 2, strategy: 'linear' },
  );
  readonly optionalObjectWithDefaultAndClass = this.envGetter.getOptionalObject(
    'OPTIONAL_TYPED_OBJECT_WITH_DEFAULT',
    { name: 'DefaultSvc', version: 1, enabled: false },
    SimpleConfig,
  );

  // Demonstrates getOptionalConfigFromFile(path) and (path, cls) on a missing file returning undefined (EX-5)
  readonly missingOptionalFileRaw =
    this.envGetter.getOptionalConfigFromFile<OptionalFeatureConfig>('missing-optional.json');
  readonly missingOptionalFileTyped = this.envGetter.getOptionalConfigFromFile(
    'missing-optional-typed.json',
    TestConfig,
  );
  readonly optionalConfigFallback = this.envGetter.getOptionalConfigFromFile('optional-feature.json', {
    enabled: false,
    mode: 'fallback',
  });

  readonly mongoConfigs: WithConfigEvents<MongoCredentials>;
  readonly staticMongoConfigsNoWatch: WithConfigEvents<MongoCredentials>;
  readonly testConfig?: WithConfigEvents<TestConfig>;

  constructor(
    envGetter: EnvGetterService,
    private readonly configOptions: AppConfigOptionsService,
  ) {
    super(envGetter);

    // Assigned in the constructor body because field initializers run before parameter properties under target >= ES2022 (TS2729).
    const options = this.configOptions.getConfigOptions();

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

    this.testConfig = this.envGetter.getOptionalConfigFromFile(
      options.testConfigFile,
      { testConfigStringFromFile: 'default-value' },
      TestConfig,
      options.fileWatcherOptions,
    );

    if (this.testConfig) {
      this.testConfig.on('error', (event) => {
        this.logger.error(`[AppConfig] Error updating config from ${event.filePath}: ${event.error.message}`);
      });
    }
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
          cacheTtlSeconds: this.cacheTtlSeconds,
          gracePeriodMs: this.gracePeriodMs,
          gracePeriodSeconds: this.gracePeriodSeconds,
        },
        lists: {
          corsOrigins: this.corsOrigins,
          enabledRegions: this.enabledRegions,
          optionalFeatureFlags: this.optionalFeatureFlags,
        },
      },
      parserFeatures: {
        singleQuotedVal: this.singleQuotedVal,
        doubleQuotedVal: this.doubleQuotedVal,
        literalTemplate: this.literalTemplate,
        appName: this.appName,
        appTitle: this.appTitle,
        baseUrl: this.baseUrl,
        databaseUrl: this.databaseUrl,
        emptyVal: this.emptyVal,
        allowedDomains: this.allowedDomains,
        optionalWebhookUrls: this.optionalWebhookUrls,
        complexConfig: this.complexConfig,
        simpleConfig: this.simpleConfig,
        inlineObjectConfig: this.inlineObjectConfig,
        optionalObjectNoDefault: this.optionalObjectNoDefault,
        optionalObjectWithClass: this.optionalObjectWithClass,
        optionalObjectWithDefault: this.optionalObjectWithDefault,
        optionalObjectWithDefaultAndClass: this.optionalObjectWithDefaultAndClass,
      },
      fileConfigs: {
        mongoConfigs: this.mongoConfigs,
        staticMongoConfigsNoWatch: this.staticMongoConfigsNoWatch,
        testConfig: this.testConfig,
        optionalConfigFallback: this.optionalConfigFallback,
        missingOptionalFileRaw: this.missingOptionalFileRaw ?? null,
        missingOptionalFileTyped: this.missingOptionalFileTyped ?? null,
      },
      watchersAndEvents: {
        perConfigEvents: {
          testConfigOnErrorSubscribed: Boolean(this.testConfig),
          mongoConfigsOnceOffAndDisposableDemonstratedIn: 'DatabaseConnectionService',
        },
        globalEvents: {
          updated: 'subscribed in AppService constructor',
          error: 'subscribed in AppService constructor',
        },
      },
    };
  }
}

export class MongoCredentials {
  connectionString: string;

  constructor(data: Record<string, unknown>) {
    if (!data.connectionString || typeof data.connectionString !== 'string') {
      throw new Error('connectionString is required and must be a string');
    }
    this.connectionString = data.connectionString;
  }
}

export class TestConfig {
  testConfigStringFromFile: string;

  constructor(data: Record<string, unknown>) {
    if (!data.testConfigStringFromFile || typeof data.testConfigStringFromFile !== 'string') {
      throw new Error('testConfigStringFromFile is required and must be a string');
    }
    this.testConfigStringFromFile = data.testConfigStringFromFile;
  }
}

export class ComplexConfig {
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

export class SimpleConfig {
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

export type OptionalFeatureConfig = {
  enabled: boolean;
  mode: string;
};

export type InlineObjectConfig = {
  retries: number;
  strategy: string;
};
