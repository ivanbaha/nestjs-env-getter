import { Injectable } from '@nestjs/common';
import { EnvGetterService, FileWatcherOptions } from 'nestjs-env-getter';

@Injectable()
export class AppConfigOptionsService {
  // Inferred type: 'development' | 'staging' | 'production' | 'test' (GET-1 / EX-3)
  private readonly environment: 'development' | 'staging' | 'production' | 'test';

  constructor(private readonly envGetter: EnvGetterService) {
    this.environment = this.envGetter.getOptionalEnv('NODE_ENV', 'development', [
      'development',
      'staging',
      'production',
      'test',
    ]);
  }

  /**
   * Get the filename for mongo credentials config file (relative to `configBaseDir`, i.e. `configs/`).
   */
  getMongoCredentialsFilename(): string {
    switch (this.environment) {
      case 'production':
        return 'mongo-creds-prod.json';
      case 'staging':
        return 'mongo-creds-staging.json';
      case 'development':
      case 'test':
      default:
        return 'mongo-creds.json';
    }
  }

  /**
   * Get the filename for test configurations (relative to `configBaseDir`, i.e. `configs/`).
   */
  getTestConfigFilename(): string {
    if (this.environment === 'test') {
      return 'test-configs-test.json';
    }

    return 'test-configs.json';
  }

  /**
   * Get configuration options that can be used by AppConfig.
   */
  getConfigOptions() {
    return {
      environment: this.environment,
      mongoCredentialsFile: this.getMongoCredentialsFilename(),
      testConfigFile: this.getTestConfigFilename(),
      fileWatcherOptions: {
        enabled: this.environment !== 'production',
        debounceMs: 200,
        breakOnError: false,
      } satisfies FileWatcherOptions,
    };
  }
}
