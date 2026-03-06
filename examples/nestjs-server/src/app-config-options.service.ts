import { Injectable } from '@nestjs/common';
import { FileWatcherOptions } from 'nestjs-env-getter';

@Injectable()
export class AppConfigOptionsService {
  /**
   * Get the filename for mongo credentials config file.
   * This could be determined by environment, deployment context, etc.
   */
  getMongoCredentialsFilename(): string {
    // This could be based on NODE_ENV, deployment stage, etc.
    const environment = process.env.NODE_ENV || 'development';

    switch (environment) {
      case 'production':
        return 'configs/mongo-creds-prod.json';
      case 'staging':
        return 'configs/mongo-creds-staging.json';
      case 'development':
      default:
        return 'configs/mongo-creds.json';
    }
  }

  /**
   * Get the filename for test configurations.
   */
  getTestConfigFilename(): string {
    const environment = process.env.NODE_ENV || 'development';

    if (environment === 'test') {
      return 'configs/test-configs-test.json';
    }

    return 'configs/test-configs.json';
  }

  /**
   * Get configuration options that can be used by AppConfig.
   */
  getConfigOptions() {
    const environment = process.env.NODE_ENV || 'development';

    return {
      environment,
      mongoCredentialsFile: this.getMongoCredentialsFilename(),
      testConfigFile: this.getTestConfigFilename(),
      fileWatcherOptions: {
        enabled: environment !== 'production',
        debounceMs: 200,
        breakOnError: false,
      } as FileWatcherOptions,
    };
  }
}
