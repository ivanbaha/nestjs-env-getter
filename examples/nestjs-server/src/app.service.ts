import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
// Import AppConfig to access configuration values loaded by nestjs-env-getter
import { AppConfig } from './app.config';

@Injectable()
export class AppService implements OnModuleInit {
  private readonly logger = new Logger(AppService.name);

  // Inject AppConfig to use environment/config values
  constructor(private readonly config: AppConfig) {
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
    this.logger.log(`TEST_CONFIG_NUMBER: ${this.config.testConfigNumber}`);
    this.logger.log(`TEST_CONFIG_STRING: ${this.config.testConfigString}`);
    this.logger.log(`TEST_CONFIG_BOOLEAN: ${this.config.testConfigBoolean}`);

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

    this.logger.log('--- Multiline Variable (RSA Key) ---');
    this.logger.log(this.config.privateKey);
    this.logger.log('------------------------------------');
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
      testConfigStringFromFile: this.config.testConfig?.testConfigStringFromFile,
    };
  }
}
