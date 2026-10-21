import { join } from 'path';
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AppConfigModule } from 'nestjs-env-getter';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppConfig } from './app.config';
import { AppConfigOptionsService } from './app-config-options.service';
import { DatabaseConnectionService } from './database/database-connection.service';
import { TasksModule } from './tasks/tasks.module';

@Module({
  imports: [
    AppConfigModule.forRoot({
      useClass: AppConfig,
      providers: [AppConfigOptionsService],
      envGetter: {
        envFilePath: ['example.env', '.env'], // example.env = defaults; an optional local .env overrides (later files win)
        configBaseDir: join(process.cwd(), 'configs'),
      },
    }),
    ScheduleModule.forRoot(),
    TasksModule,
  ],
  controllers: [AppController],
  providers: [AppService, DatabaseConnectionService],
})
export class AppModule {}
