import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AppConfig } from './app.config';

// Bootstrap the NestJS app using port from config loaded by nestjs-env-getter

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Get AppConfig instance to access loaded config values
  const config = app.get(AppConfig);

  await app.listen(config.port);
}

void bootstrap();
