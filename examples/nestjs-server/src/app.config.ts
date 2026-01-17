/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable } from '@nestjs/common';
// Import the EnvGetterService from the nestjs-env-getter library
import { EnvGetterService, WithConfigEvents } from 'nestjs-env-getter';

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

  // Additional examples for new parser features
  readonly singleQuotedVal: string;
  readonly doubleQuotedVal: string;
  readonly privateKey: string;
  readonly appName: string;
  readonly appTitle: string;
  readonly baseUrl: string;
  readonly databaseUrl: string;
  readonly emptyVal: string;

  constructor(protected readonly envGetter: EnvGetterService) {
    // Load required numeric environment variable
    this.port = this.envGetter.getRequiredNumericEnv('PORT');

    // Load required config from a JSON file using hardcoded path
    this.mongoConfigs = this.envGetter.getRequiredConfigFromFile('configs/mongo-creds.json', MongoCredentials);

    // Load required string, number, and boolean environment variables
    this.testConfigString = this.envGetter.getRequiredEnv('TEST_CONFIG_STRING');
    this.testConfigNumber = this.envGetter.getRequiredNumericEnv('TEST_CONFIG_NUMBER');
    this.testConfigBoolean = this.envGetter.getRequiredBooleanEnv('TEST_CONFIG_BOOLEAN');

    // Load optional config from a JSON file using hardcoded path
    this.testConfig = this.envGetter.getOptionalConfigFromFile(
      'configs/test-configs.json',
      { testConfigStringFromFile: 'default-value' },
      TestConfig,
      {
        breakOnError: false, // Do not break the process on re-read errors, just emit 'error' events
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

    // Load new variables for demonstration
    this.singleQuotedVal = this.envGetter.getRequiredEnv('SINGLE_QUOTED_VAL');
    this.doubleQuotedVal = this.envGetter.getRequiredEnv('DOUBLE_QUOTED_VAL');
    this.privateKey = this.envGetter.getRequiredEnv('PRIVATE_KEY');
    this.appName = this.envGetter.getRequiredEnv('APP_NAME');
    this.appTitle = this.envGetter.getRequiredEnv('APP_TITLE');
    this.baseUrl = this.envGetter.getRequiredEnv('BASE_URL');
    this.databaseUrl = this.envGetter.getRequiredEnv('DATABASE_URL');
    this.emptyVal = this.envGetter.getOptionalEnv('EMPTY_VAL', 'fallback');
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
