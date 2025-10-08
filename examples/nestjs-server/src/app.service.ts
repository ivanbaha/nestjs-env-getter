import { Injectable } from '@nestjs/common';
import { AppConfig } from './configs/app.config';

@Injectable()
export class AppService {
  constructor(private readonly config: AppConfig) {}

  getHello(): string {
    return 'Hello World!';
  }

  getTestConfigValue(): unknown {
    return {
      testConfigString: this.config.testConfigString,
      testConfigNumber: this.config.testConfigNumber,
      testConfigBoolean: this.config.testConfigBoolean,
    };
  }
}
