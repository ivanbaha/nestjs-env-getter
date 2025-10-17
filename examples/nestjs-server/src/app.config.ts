/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable } from '@nestjs/common';
// Import the EnvGetterService from the nestjs-env-getter library
import { EnvGetterService, WithConfigEvents } from 'nestjs-env-getter';
import { AppConfigOptionsService } from './app-config-options.service';

@Injectable()
export class AppConfig {
  // Example of using nestjs-env-getter to load environment and config values
  // This class now demonstrates how to inject additional providers via AppConfigModule
  readonly port: number;
  mongoConfigs: WithConfigEvents<MongoCredentials>;

  readonly testConfigString: string;
  readonly testConfigNumber: number;
  readonly testConfigBoolean: boolean;
  testConfig?: WithConfigEvents<TestConfig>;

  constructor(
    protected readonly envGetter: EnvGetterService,
    private readonly configOptions: AppConfigOptionsService,
  ) {
    // Get configuration options from the injected service
    const options = this.configOptions.getConfigOptions();

    // Load required numeric environment variable
    this.port = this.envGetter.getRequiredNumericEnv('PORT');

    // Load required config from a JSON file using dynamic filename from options
    // This demonstrates how injected providers can control configuration behavior
    this.mongoConfigs = this.envGetter.getRequiredConfigFromFile(options.mongoCredentialsFile, MongoCredentials);

    // Load required string, number, and boolean environment variables
    this.testConfigString = this.envGetter.getRequiredEnv('TEST_CONFIG_STRING');
    this.testConfigNumber = this.envGetter.getRequiredNumericEnv('TEST_CONFIG_NUMBER');
    this.testConfigBoolean = this.envGetter.getRequiredBooleanEnv('TEST_CONFIG_BOOLEAN');

    // Load optional config from a JSON file using dynamic filename and options
    // The return type automatically includes event methods (on, once, off)
    this.testConfig = this.envGetter.getOptionalConfigFromFile(
      options.testConfigFile,
      { testConfigStringFromFile: 'default-value' },
      TestConfig,
      {
        breakOnError: false, // Do not break the process on re-read errors, just emit 'error' events
        // File watching is controlled by the options service based on environment
      },
    );
    // IMPORTANT: When breakOnError is false, you MUST subscribe to the 'error' event
    // to prevent Node.js from throwing ERR_UNHANDLED_ERROR
    if (this.testConfig) {
      this.testConfig.on('error', (event) => {
        console.error(`[AppConfig] Error updating config from ${event.filePath}:`, event.error.message);
        // The app continues running with the last valid config
      });
    }
  }
}

// Classes for validating configs obtained from files using nestjs-env-getter

class MongoCredentials {
  connectionString: string;

  // Used by EnvGetterService to validate the loaded config
  constructor(data: any) {
    if (!data.connectionString || typeof data.connectionString !== 'string') {
      throw new Error('connectionString is required and must be a string');
    }
    this.connectionString = data.connectionString;
  }
}

class TestConfig {
  testConfigStringFromFile: string;

  // Used by EnvGetterService to validate the loaded config
  constructor(data: any) {
    if (!data.testConfigStringFromFile || typeof data.testConfigStringFromFile !== 'string') {
      throw new Error('testConfigStringFromFile is required and must be a string');
    }
    this.testConfigStringFromFile = data.testConfigStringFromFile;
  }
}
