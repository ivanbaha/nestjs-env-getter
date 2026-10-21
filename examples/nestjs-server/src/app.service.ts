import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EnvGetterService } from 'nestjs-env-getter';
import { AppConfig } from './app.config';
import { TasksService } from './tasks/tasks.service';

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

  constructor(
    private readonly config: AppConfig,
    private readonly envGetter: EnvGetterService,
    private readonly tasksService: TasksService,
  ) {
    // Global 'updated' and 'error' events on envGetter.events (BUG-1 / EX-5)
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
    this.logger.log(`CACHE_TTL (optional time period with numeric ms default in s): ${this.config.cacheTtlSeconds}`);
    this.logger.log(`CORS_ORIGINS (required list): ${JSON.stringify(this.config.corsOrigins)}`);
    this.logger.log(
      `ENABLED_REGIONS (required list with allowedValues): ${JSON.stringify(this.config.enabledRegions)}`,
    );
    this.logger.log(`OPTIONAL_FEATURE_FLAGS (optional list): ${JSON.stringify(this.config.optionalFeatureFlags)}`);

    this.logger.log('--- All Configs JSON Snapshot ---');
    this.logger.log(JSON.stringify(this.getGroupedConfigDiagnostics(), null, 2));
    this.logger.log('---------------------------------');
  }

  getHello(): string {
    return 'Hello World!';
  }

  getTestConfigValue(): unknown {
    const schedules = this.tasksService.getSchedulesDiagnostics();
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
      cacheTtlSeconds: this.config.cacheTtlSeconds,
      corsOrigins: this.config.corsOrigins,
      enabledRegions: this.config.enabledRegions,
      optionalFeatureFlags: this.config.optionalFeatureFlags,
      backupSchedule: schedules.backupSchedule,
      cleanupSchedule: schedules.cleanupSchedule,
      allowedDomains: this.config.allowedDomains,
      optionalWebhookUrls: this.config.optionalWebhookUrls,
      complexConfig: this.config.complexConfig,
      simpleConfig: this.config.simpleConfig,
      inlineObjectConfig: this.config.inlineObjectConfig,
      optionalObjectNoDefault: this.config.optionalObjectNoDefault,
      optionalObjectWithClass: this.config.optionalObjectWithClass,
      optionalObjectWithDefault: this.config.optionalObjectWithDefault,
      optionalObjectWithDefaultAndClass: this.config.optionalObjectWithDefaultAndClass,
      optionalConfigFallback: this.config.optionalConfigFallback,
      staticMongoConfigsNoWatch: this.config.staticMongoConfigsNoWatch,
      testConfigStringFromFile: this.config.testConfig?.testConfigStringFromFile,
    };
  }

  getGroupedConfigDiagnostics(): unknown {
    return {
      ...(this.config.getGroupedConfigDiagnostics() as Record<string, unknown>),
      cron: this.tasksService.getSchedulesDiagnostics(),
    };
  }
}
