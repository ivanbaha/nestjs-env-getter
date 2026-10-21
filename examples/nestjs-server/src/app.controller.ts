import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { DatabaseConnectionService, type DatabaseStatus } from './database/database-connection.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly databaseConnectionService: DatabaseConnectionService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('config')
  getTestConfigValue(): unknown {
    return this.appService.getTestConfigValue();
  }

  @Get('config/grouped')
  getGroupedConfigDiagnostics(): unknown {
    return this.appService.getGroupedConfigDiagnostics();
  }

  @Get('db/status')
  getDatabaseStatus(): DatabaseStatus {
    return this.databaseConnectionService.getStatus();
  }
}
