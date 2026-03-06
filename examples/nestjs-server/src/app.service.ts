import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
// Import AppConfig to access configuration values loaded by nestjs-env-getter
import { AppConfig } from './app.config';
import { EnvGetterService } from 'nestjs-env-getter';

type UpdatedEvent = {
  filePath: string;
  timestamp: number;
};

type ErrorEvent = {
  filePath: string;
  timestamp: number;
  error: Error;
};

@Injectable()
export class AppService implements OnModuleInit {
  private readonly logger = new Logger(AppService.name);

  // Inject AppConfig to use environment/config values
  constructor(
    private readonly config: AppConfig,
    private readonly envGetter: EnvGetterService,
  ) {
    this.envGetter.events.on('updated', (event: UpdatedEvent) => {
      this.logger.log(
        `[AppService] Global updated event: ${event.filePath} at ${new Date(event.timestamp).toISOString()}`,
      );
    });

    this.envGetter.events.on('error', (event: ErrorEvent) => {
      this.logger.error(
        `[AppService] Global error event: ${event.filePath} at ${new Date(event.timestamp).toISOString()}`,
      );
      this.logger.error(`[AppService] Error: ${event.error.message}`);
    });

    // Subscribe to the same test-configs.json file from a different place (AppService)
    // This demonstrates that multiple parts of the app can listen to the same config file
    if (this.config.testConfig) {
      this.config.testConfig.on('updated', (event) => {
        this.logger.log(`[AppService] Config updated: ${event.filePath} at ${new Date(event.timestamp).toISOString()}`);
        this.logger.log(`[AppService] New value: ${this.config.testConfig?.testConfigStringFromFile}`);
      });

      this.config.testConfig.on('error', (event) => {
        this.logger.error(`[AppService] Config error: ${event.filePath} at ${new Date(event.timestamp).toISOString()}`);
        this.logger.error(`[AppService] Error: ${event.error.message}`);
      });
    }
  }

  onModuleInit() {
    this.logger.log('--- Environment Variables (Parsed) ---');
    this.logger.log(`PORT: ${this.config.port}`);
    this.logger.log(`NODE_ENV: ${this.config.nodeEnv}`);
    this.logger.log(`isEnvSet(NODE_ENV): ${this.config.isNodeEnvSet}`);
    this.logger.log(`TEST_CONFIG_NUMBER: ${this.config.testConfigNumber}`);
    this.logger.log(`TEST_CONFIG_STRING: ${this.config.testConfigString}`);
    this.logger.log(`TEST_CONFIG_BOOLEAN: ${this.config.testConfigBoolean}`);
    this.logger.log(`LOG_LEVEL (optional): ${this.config.optionalLogLevel}`);
    this.logger.log(`LOG_LEVEL_DEFAULTED (optional with default): ${this.config.optionalLogLevelWithDefault}`);
    this.logger.log(`APP_STAGE (optional with allowed values): ${this.config.optionalStageAllowed}`);
    this.logger.log(`APP_STAGE_DEFAULTED (optional default + allowed): ${this.config.optionalStageWithDefaultAllowed}`);
    this.logger.log(`REQUEST_TIMEOUT_MS (optional numeric): ${this.config.optionalNumericTimeout}`);
    this.logger.log(`MAINTENANCE_MODE (optional boolean): ${this.config.optionalBooleanFlag}`);
    this.logger.log(`API_URL (required URL): ${this.config.apiUrl.toString()}`);
    this.logger.log(`CDN_URL (optional URL): ${this.config.cdnUrl.toString()}`);
    this.logger.log(`SESSION_TTL (required time period in ms): ${this.config.sessionTtlMs}`);
    this.logger.log(`WORKER_INTERVAL (optional time period in s): ${this.config.workerIntervalSeconds}`);

    this.logger.log('--- Custom Parser Examples ---');
    this.logger.log(`SINGLE_QUOTED_VAL: ${this.config.singleQuotedVal}`);
    this.logger.log(`DOUBLE_QUOTED_VAL: ${this.config.doubleQuotedVal}`);
    this.logger.log(`APP_NAME: ${this.config.appName}`);
    this.logger.log(`APP_TITLE: ${this.config.appTitle}`);
    this.logger.log(`BASE_URL: ${this.config.baseUrl}`);
    this.logger.log(`DATABASE_URL: ${this.config.databaseUrl}`);
    this.logger.log(`EMPTY_VAL: "${this.config.emptyVal}"`);
    this.logger.log(`ALLOWED_DOMAINS: ${JSON.stringify(this.config.allowedDomains)}`);
    this.logger.log(`COMPLEX_CONFIG: ${JSON.stringify(this.config.complexConfig, null, 2)}`);
    this.logger.log(`SIMPLE_CONFIG: ${JSON.stringify(this.config.simpleConfig, null, 2)}`);
    this.logger.log(`INLINE_OBJECT_CONFIG: ${JSON.stringify(this.config.inlineObjectConfig, null, 2)}`);

    this.logger.log('--- Multiline Variable (RSA Key) ---');
    this.logger.log(this.config.privateKey);
    this.logger.log('------------------------------------');

    this.logger.log('--- Cron Schedules ---');
    this.logger.log(`Previous backup at: ${this.config.backupSchedule.getPrevTime()?.toISOString() || 'N/A'}`);
    this.logger.log(`Next backup at: ${this.config.backupSchedule.getNextTime()?.toISOString() || 'N/A'}`);
    if (this.config.cleanupSchedule) {
      this.logger.log(`Previous cleanup at: ${this.config.cleanupSchedule.getPrevTime()?.toISOString() || 'N/A'}`);
      this.logger.log(`Next cleanup at: ${this.config.cleanupSchedule.getNextTime()?.toISOString() || 'N/A'}`);
    }
    this.logger.log('------------------------------------');

    this.logger.log('--- All Configs JSON Snapshot ---');
    this.logger.log(JSON.stringify(this.getGroupedConfigDiagnostics(), null, 2));
    this.logger.log('---------------------------------');
  }

  // Example endpoint value
  getHello(): string {
    return 'Hello World!';
  }

  // Expose config values loaded via nestjs-env-getter
  getTestConfigValue(): unknown {
    return {
      testConfigString: this.config.testConfigString,
      testConfigNumber: this.config.testConfigNumber,
      testConfigBoolean: this.config.testConfigBoolean,
      nodeEnv: this.config.nodeEnv,
      isNodeEnvSet: this.config.isNodeEnvSet,
      optionalLogLevel: this.config.optionalLogLevel,
      optionalLogLevelWithDefault: this.config.optionalLogLevelWithDefault,
      optionalStageAllowed: this.config.optionalStageAllowed,
      optionalStageWithDefaultAllowed: this.config.optionalStageWithDefaultAllowed,
      optionalNumericTimeout: this.config.optionalNumericTimeout,
      optionalBooleanFlag: this.config.optionalBooleanFlag,
      apiUrl: this.config.apiUrl.toString(),
      cdnUrl: this.config.cdnUrl.toString(),
      sessionTtlMs: this.config.sessionTtlMs,
      workerIntervalSeconds: this.config.workerIntervalSeconds,
      backupSchedule: this.config.backupSchedule.toString(),
      cleanupSchedule: this.config.cleanupSchedule?.toString(),
      allowedDomains: this.config.allowedDomains,
      complexConfig: this.config.complexConfig,
      simpleConfig: this.config.simpleConfig,
      inlineObjectConfig: this.config.inlineObjectConfig,
      optionalConfigFallback: this.config.optionalConfigFallback,
      staticMongoConfigsNoWatch: this.config.staticMongoConfigsNoWatch,
      testConfigStringFromFile: this.config.testConfig?.testConfigStringFromFile,
    };
  }

  getGroupedConfigDiagnostics(): unknown {
    return this.config.getGroupedConfigDiagnostics();
  }
}
