import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';

// Seed process.env before importing AppModule so a developer's local .env cannot override test assertions
process.env.NODE_ENV = 'test';
process.env.PORT = '3000';
process.env.TEST_CONFIG_STRING = 'e2e-hello';
process.env.TEST_CONFIG_NUMBER = '777';
process.env.TEST_CONFIG_BOOLEAN = 'true';
process.env.CORS_ORIGINS = 'https://a.example.com, https://b.example.com';

import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET / returns 200 with Hello World!', () => {
    return request(app.getHttpServer()).get('/').expect(200).expect('Hello World!');
  });

  it('GET /config returns 200 with known values', async () => {
    const res = await request(app.getHttpServer()).get('/config').expect(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        nodeEnv: 'test',
        testConfigString: 'e2e-hello',
        testConfigNumber: 777,
        testConfigBoolean: true,
        corsOrigins: ['https://a.example.com', 'https://b.example.com'],
      }),
    );
  });

  it('GET /config/grouped returns 200 with grouped diagnostics', async () => {
    const res = await request(app.getHttpServer()).get('/config/grouped').expect(200);
    expect(res.body).toHaveProperty('envTypes');
    expect(res.body).toHaveProperty('parserFeatures');
    expect(res.body).toHaveProperty('cron');
    expect(res.body).toHaveProperty('fileConfigs');
  });

  it('GET /db/status returns 200 with reconnectCount: 0', async () => {
    const res = await request(app.getHttpServer()).get('/db/status').expect(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        status: 'connected',
        reconnectCount: 0,
      }),
    );
  });
});
