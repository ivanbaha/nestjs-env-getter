import { Inject, Injectable } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  APP_CONFIG,
  AppConfigModule,
  EnvConfig,
  EnvGetterModule,
  EnvGetterService,
  EnvValidationError,
} from 'nestjs-env-getter';

describe('Configuration patterns (e2e — EX-6)', () => {
  it('supports forRootAsync({ useFactory, provide }) injected via @Inject(APP_CONFIG) and by class', async () => {
    class FactoryConfig {
      constructor(
        readonly endpoint: string,
        readonly timeoutMs: number,
      ) {}
    }

    @Injectable()
    class FactoryConsumer {
      constructor(
        @Inject(APP_CONFIG) readonly byToken: FactoryConfig,
        readonly byClass: FactoryConfig,
      ) {}
    }

    const mod = await Test.createTestingModule({
      imports: [
        AppConfigModule.forRootAsync({
          provide: FactoryConfig,
          envGetter: {
            env: {
              ENDPOINT: 'https://service.internal',
              TIMEOUT: '5s',
            },
          },
          useFactory: (env: EnvGetterService) =>
            new FactoryConfig(env.getRequiredEnv('ENDPOINT'), env.getRequiredTimePeriod('TIMEOUT', 'ms')),
        }),
      ],
      providers: [FactoryConsumer],
    }).compile();

    const consumer = mod.get(FactoryConsumer);
    expect(consumer.byToken).toBe(consumer.byClass);
    expect(consumer.byToken.endpoint).toBe('https://service.internal');
    expect(consumer.byToken.timeoutMs).toBe(5000);
  });

  it('supports standalone EnvGetterModule.forRoot({ envFilePath: false })', async () => {
    const mod = await Test.createTestingModule({
      imports: [EnvGetterModule.forRoot({ envFilePath: false, env: { DIRECT_KEY: '42' } })],
    }).compile();

    const envGetter = mod.get(EnvGetterService);
    expect(envGetter.getRequiredNumericEnv('DIRECT_KEY')).toBe(42);
  });

  it('rejects compile() with EnvValidationError listing all 3 missing variables when using AppConfigModule.forTesting', async () => {
    @Injectable()
    class BrokenConfig extends EnvConfig {
      readonly host = this.envGetter.getRequiredEnv('BROKEN_HOST');
      readonly port = this.envGetter.getRequiredNumericEnv('BROKEN_PORT');
      readonly apiUrl = this.envGetter.getRequiredURL('BROKEN_API_URL');
    }

    let caught: unknown;
    try {
      await Test.createTestingModule({
        imports: [AppConfigModule.forTesting(BrokenConfig, {})],
      }).compile();
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(EnvValidationError);
    const valErr = caught as EnvValidationError;
    expect(valErr.errors).toEqual([
      "Missing 'BROKEN_HOST' environment variable",
      "Missing 'BROKEN_PORT' environment variable",
      "Missing 'BROKEN_API_URL' environment variable",
    ]);
  });
});
