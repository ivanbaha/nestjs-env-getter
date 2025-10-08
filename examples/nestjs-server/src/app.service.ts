import { Injectable } from '@nestjs/common';
// Import AppConfig to access configuration values loaded by nestjs-env-getter
import { AppConfig } from './app.config';

@Injectable()
export class AppService {
  // Inject AppConfig to use environment/config values
  constructor(private readonly config: AppConfig) {}

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
