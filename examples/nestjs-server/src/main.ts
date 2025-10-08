import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AppConfig } from './app.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const config = app.get(AppConfig);

  await app.listen(config.port);
}

void bootstrap();
