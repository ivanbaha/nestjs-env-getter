import { Injectable } from '@nestjs/common';
// Import the EnvGetterService from the nestjs-env-getter library
import { EnvGetterService } from 'nestjs-env-getter';

@Injectable()
export class AppConfig {
  // Example of using nestjs-env-getter to load environment and config values
  readonly port: number;
  mongoConfigs: MongoCredentials;

  readonly testConfigString: string;
  readonly testConfigNumber: number;
  readonly testConfigBoolean: boolean;
  testConfig?: TestConfig;

  constructor(protected readonly envGetter: EnvGetterService) {
    // Load required numeric environment variable
    this.port = this.envGetter.getRequiredNumericEnv('PORT');

    // Load required config from a JSON file and validate with MongoCredentials class
    this.mongoConfigs = this.envGetter.getRequiredConfigFromFile('configs/mongo-creds.json', MongoCredentials);

    // Load required string, number, and boolean environment variables
    this.testConfigString = this.envGetter.getRequiredEnv('TEST_CONFIG_STRING');
    this.testConfigNumber = this.envGetter.getRequiredNumericEnv('TEST_CONFIG_NUMBER');
    this.testConfigBoolean = this.envGetter.getRequiredBooleanEnv('TEST_CONFIG_BOOLEAN');

    // Load optional config from a JSON file, provide defaults, and validate with TestConfig class
    this.testConfig = this.envGetter.getOptionalConfigFromFile(
      'configs/test-configs.json',
      { testConfigStringFromFile: 'default-value' },
      TestConfig,
    );
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
