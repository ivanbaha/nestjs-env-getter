import { Controller, Get } from '@nestjs/common';
// Import AppService to expose endpoints using config
import { AppService } from './app.service';

@Controller()
export class AppController {
  // Inject AppService to access config-driven logic
  constructor(private readonly appService: AppService) {}

  // Basic endpoint
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  // Endpoint to show config values from nestjs-env-getter
  @Get('config')
  getTestConfigValue(): unknown {
    return this.appService.getTestConfigValue();
  }
}
