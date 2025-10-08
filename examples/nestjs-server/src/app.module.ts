import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppConfig } from './app.config';
import { UsersTestModule } from './users-test/users-test.module';
// Import the configuration module from nestjs-env-getter
import { AppConfigModule } from 'nestjs-env-getter';
import { MongoConnectionService } from './mongo-connection.service';

@Module({
  imports: [
    // Register the custom AppConfig class using nestjs-env-getter
    AppConfigModule.forRoot({ useClass: AppConfig }),

    // Use AppConfig to provide MongoDB connection string from config file
    MongooseModule.forRootAsync({
      imports: [AppConfigModule],
      useFactory: (config: AppConfig) => ({ uri: config.mongoConfigs.connectionString }),
      inject: [AppConfig],
    }),

    UsersTestModule,
  ],
  controllers: [AppController],
  providers: [AppService, MongoConnectionService],
})
// Main application module, wires up configuration and MongoDB connection
export class AppModule {}
