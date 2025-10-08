import { Injectable } from '@nestjs/common';
import { EnvGetterService } from 'nestjs-env-getter';

@Injectable()
export class AppConfig {
  readonly port: number;
  readonly mongoConnectionString: string;

  readonly testConfigString: string;
  readonly testConfigNumber: number;
  readonly testConfigBoolean: boolean;

  constructor(protected readonly envGetter: EnvGetterService) {
    this.port = this.envGetter.getRequiredNumericEnv('PORT');
    this.mongoConnectionString = this.envGetter.getRequiredEnv('MONGO_CONNECTION_STRING');

    this.testConfigString = this.envGetter.getRequiredEnv('TEST_CONFIG_STRING');
    this.testConfigNumber = this.envGetter.getRequiredNumericEnv('TEST_CONFIG_NUMBER');
    this.testConfigBoolean = this.envGetter.getRequiredBooleanEnv('TEST_CONFIG_BOOLEAN');
  }
}
