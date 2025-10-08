import { Injectable, Logger } from '@nestjs/common';
// Import AppConfig to access configuration values loaded by nestjs-env-getter
import { AppConfig } from './app.config';

@Injectable()
export class AppService {
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
