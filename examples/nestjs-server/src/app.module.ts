import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppConfig } from './app.config';
import { UsersTestModule } from './users-test/users-test.module';
import { AppConfigModule } from 'nestjs-env-getter';

@Module({
  imports: [
    // register the custom AppConfig class
    AppConfigModule.forRoot({ useClass: AppConfig }),

    MongooseModule.forRootAsync({
      imports: [AppConfigModule], // import the module to be able to inject the config class
      useFactory: (config: AppConfig) => ({ uri: config.mongoConnectionString }),
      inject: [AppConfig], // inject AppConfig class
    }),

    UsersTestModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
