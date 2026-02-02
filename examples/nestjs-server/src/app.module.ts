import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppConfig } from './app.config';
import { UsersTestModule } from './users-test/users-test.module';
import { TasksModule } from './tasks/tasks.module';
// Import the configuration module from the local nestjs-env-getter source
import { AppConfigModule } from 'nestjs-env-getter';
import { MongoConnectionService } from './mongo-connection.service';

@Module({
  imports: [
    // Register the custom AppConfig class using nestjs-env-getter with additional providers
    AppConfigModule.forRoot({
      useClass: AppConfig,
      // Inject the options service if necessary
      // providers: [AppConfigOptionsService],
    }),

    // Use AppConfig to provide MongoDB connection string from config file
    MongooseModule.forRootAsync({
      imports: [AppConfigModule],
      useFactory: (config: AppConfig) => ({ uri: config.mongoConfigs.connectionString }),
      inject: [AppConfig],
    }),

    ScheduleModule.forRoot(),
    UsersTestModule,
    TasksModule,
  ],
  controllers: [AppController],
  providers: [AppService, MongoConnectionService],
})
export class AppModule {}
