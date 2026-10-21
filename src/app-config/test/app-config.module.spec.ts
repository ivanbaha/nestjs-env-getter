import { existsSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import {
  forwardRef,
  Inject,
  Injectable,
  Module,
  OnApplicationBootstrap,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
  Scope,
} from "@nestjs/common";
import { ModulesContainer } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { AppConfigModule, APP_CONFIG } from "../app-config.module";
import { EnvConfig } from "../env-config";
import { EnvGetterModule } from "../../env-getter/env-getter.module";
import { EnvGetterService } from "../../env-getter/env-getter.service";
import { EnvValidationError } from "../../shared/errors/env-validation.error";

describe("AppConfigModule & EnvConfig (MOD-1, MOD-2, MOD-3, MOD-4, MOD-5, AUTH-1)", () => {
  const tempDir = join(tmpdir(), `temp-app-config-spec-${Date.now()}`);

  beforeAll(() => {
    mkdirSync(tempDir, { recursive: true });
  });

  afterAll(() => {
    if (existsSync(tempDir)) rmSync(tempDir, { recursive: true, force: true });
  });

  describe("MOD-1 & AUTH-1: forRoot and forRootAsync ergonomics", () => {
    @Injectable()
    class SimpleConfig extends EnvConfig {
      readonly port = this.envGetter.getOptionalNumericEnv("PORT", 3000);
      readonly stage = this.envGetter.getOptionalEnv("STAGE", "dev", ["dev", "prod"]);

      getService(): EnvGetterService {
        return this.envGetter;
      }
    }

    it("supports forRoot(Class), forRoot(Class, opts), forRoot({ useClass }), and forRootAsync({ useClass }) and aliases APP_CONFIG", async () => {
      const m1 = await Test.createTestingModule({
        imports: [AppConfigModule.forRoot(SimpleConfig, { env: { PORT: "4000", STAGE: "prod" } })],
      }).compile();
      expect(m1.get(SimpleConfig)).toBe(m1.get(APP_CONFIG));
      expect(m1.get(SimpleConfig).port).toBe(4000);
      expect(m1.get(SimpleConfig).stage).toBe("prod");

      const m2 = await Test.createTestingModule({
        imports: [
          AppConfigModule.forRoot({
            useClass: SimpleConfig,
            envGetter: { env: { PORT: "5000" } },
          }),
        ],
      }).compile();
      expect(m2.get(SimpleConfig)).toBe(m2.get(APP_CONFIG));
      expect(m2.get(SimpleConfig).port).toBe(5000);

      const m3 = await Test.createTestingModule({
        imports: [
          AppConfigModule.forRootAsync({
            useClass: SimpleConfig,
            envGetter: { env: { PORT: "6000" } },
          }),
        ],
      }).compile();
      expect(m3.get(SimpleConfig)).toBe(m3.get(APP_CONFIG));
      expect(m3.get(SimpleConfig).port).toBe(6000);
    });

    it("supports direct construction without Nest DI: new SimpleConfig(new EnvGetterService({ env }))", () => {
      const cfg = new SimpleConfig(new EnvGetterService({ env: { PORT: "8080", STAGE: "prod" } }));
      expect(cfg.port).toBe(8080);
      expect(cfg.stage).toBe("prod");
    });

    it("forRootAsync({ useFactory }) defaults inject to [EnvGetterService] and honors explicit inject: []", async () => {
      const mDefault = await Test.createTestingModule({
        imports: [
          AppConfigModule.forRootAsync({
            envGetter: { env: { HOST: "example.org" } },
            // Typed parameter compiles without error (MOD-1)
            useFactory: (env: EnvGetterService) => ({
              host: env.getRequiredEnv("HOST"),
            }),
          }),
        ],
      }).compile();

      expect(mDefault.get(APP_CONFIG)).toEqual({ host: "example.org" });

      let argCount = -1;
      const mEmptyInject = await Test.createTestingModule({
        imports: [
          AppConfigModule.forRootAsync({
            envGetter: { env: {} },
            inject: [],
            useFactory: (...args: unknown[]) => {
              argCount = args.length;
              return { static: true };
            },
          }),
        ],
      }).compile();

      expect(argCount).toBe(0);
      expect(mEmptyInject.get(APP_CONFIG)).toEqual({ static: true });
    });

    it("forRootAsync({ useFactory, provide }) registers both custom token and APP_CONFIG alias, including async factories", async () => {
      class CustomFactoryConfig {
        constructor(readonly apiUrl: string) {}
      }

      const mod = await Test.createTestingModule({
        imports: [
          AppConfigModule.forRootAsync({
            provide: CustomFactoryConfig,
            envGetter: { env: { API_URL: "https://api.example.com" } },
            useFactory: async (env: EnvGetterService) => {
              await Promise.resolve();
              return new CustomFactoryConfig(env.getRequiredEnv("API_URL"));
            },
          }),
        ],
      }).compile();

      const byClass = mod.get(CustomFactoryConfig);
      const byToken = mod.get<CustomFactoryConfig>(APP_CONFIG);
      expect(byClass).toBeInstanceOf(CustomFactoryConfig);
      expect(byClass).toBe(byToken);
      expect(byClass.apiUrl).toBe("https://api.example.com");
    });

    it("shares a single EnvGetterService between AppConfigModule and EnvGetterModule when options match", async () => {
      const mPlain = await Test.createTestingModule({
        imports: [AppConfigModule.forRoot(SimpleConfig), EnvGetterModule],
      }).compile();

      expect(mPlain.get(EnvGetterService)).toBe(mPlain.get(SimpleConfig).getService());

      const mDeepEqual = await Test.createTestingModule({
        imports: [
          AppConfigModule.forRoot(SimpleConfig, { envFilePath: false, configBaseDir: tempDir }),
          EnvGetterModule.forRoot({ configBaseDir: tempDir, envFilePath: false }),
        ],
      }).compile();

      expect(mDeepEqual.get(EnvGetterService)).toBe(mDeepEqual.get(SimpleConfig).getService());
    });

    it("creates two EnvGetterService instances when AppConfigModule and EnvGetterModule get different options (documented limitation)", async () => {
      const otherDir = join(tempDir, "other-base");
      const mod = await Test.createTestingModule({
        imports: [
          AppConfigModule.forRoot(SimpleConfig, { envFilePath: false, configBaseDir: tempDir }),
          EnvGetterModule.forRoot({ envFilePath: false, configBaseDir: otherDir }),
        ],
      }).compile();

      const instances = new Set(
        [...mod.get(ModulesContainer).values()]
          .map((m) => m.providers.get(EnvGetterService)?.instance)
          .filter((instance) => instance !== undefined),
      );
      expect(instances.size).toBe(2);
      expect(instances.has(mod.get(SimpleConfig).getService())).toBe(true);
    });

    it("re-exports extra providers registered via options.providers", async () => {
      @Injectable()
      class HelperService {
        getPrefix() {
          return "v1";
        }
      }

      const mod = await Test.createTestingModule({
        imports: [
          AppConfigModule.forRoot({
            useClass: SimpleConfig,
            providers: [HelperService],
            envGetter: { env: {} },
          }),
        ],
      }).compile();

      expect(mod.get(HelperService).getPrefix()).toBe("v1");
    });
  });

  describe("MOD-2: AppConfigModule.forFeature", () => {
    @Injectable()
    class RootConfig extends EnvConfig {
      readonly appName = this.envGetter.getOptionalEnv("APP_NAME", "demo");
    }

    @Injectable()
    class FeatureAConfig extends EnvConfig {
      readonly timeout = this.envGetter.getRequiredNumericEnv("FEATURE_TIMEOUT");
    }

    @Injectable()
    class FeatureBConfig extends EnvConfig {
      readonly retries = this.envGetter.getOptionalNumericEnv("FEATURE_RETRIES", 3);
    }

    it("scopes feature config to modules that import it and shares one instance across multiple importers", async () => {
      @Injectable()
      class ConsumerOne {
        constructor(
          readonly a: FeatureAConfig,
          readonly b: FeatureBConfig,
        ) {}
      }

      @Injectable()
      class ConsumerTwo {
        constructor(readonly a: FeatureAConfig) {}
      }

      @Module({
        imports: [AppConfigModule.forFeature([FeatureAConfig, FeatureBConfig])],
        providers: [ConsumerOne],
        exports: [ConsumerOne],
      })
      class ModuleOne {}

      @Module({
        imports: [AppConfigModule.forFeature(FeatureAConfig)],
        providers: [ConsumerTwo],
        exports: [ConsumerTwo],
      })
      class ModuleTwo {}

      const mod = await Test.createTestingModule({
        imports: [AppConfigModule.forTesting(RootConfig, { FEATURE_TIMEOUT: "500" }), ModuleOne, ModuleTwo],
      }).compile();

      const c1 = mod.get(ConsumerOne);
      const c2 = mod.get(ConsumerTwo);
      expect(c1.a.timeout).toBe(500);
      expect(c1.b.retries).toBe(3);
      expect(c1.a).toBe(c2.a);
    });

    it("cannot be injected in a sibling module that does not import forFeature", async () => {
      @Injectable()
      class UnauthorizedConsumer {
        constructor(readonly a: FeatureAConfig) {}
      }

      @Module({
        imports: [AppConfigModule.forFeature(FeatureAConfig)],
      })
      class ImportingModule {}

      @Module({
        providers: [UnauthorizedConsumer],
      })
      class SiblingModule {}

      await expect(
        Test.createTestingModule({
          imports: [AppConfigModule.forTesting(RootConfig, { FEATURE_TIMEOUT: "500" }), ImportingModule, SiblingModule],
        }).compile(),
      ).rejects.toThrow(/FeatureAConfig/);
    });

    it("fails fast with aggregated EnvValidationError when a feature config has invalid variables", async () => {
      @Injectable()
      class BrokenFeatureConfig extends EnvConfig {
        readonly a = this.envGetter.getRequiredEnv("FEAT_A");
        readonly b = this.envGetter.getRequiredNumericEnv("FEAT_B");
      }

      let caught: unknown;
      try {
        await Test.createTestingModule({
          imports: [AppConfigModule.forTesting(RootConfig, {}), AppConfigModule.forFeature(BrokenFeatureConfig)],
        }).compile();
      } catch (err) {
        caught = err;
      }

      expect(caught).toBeInstanceOf(EnvValidationError);
      expect((caught as EnvValidationError).errors).toHaveLength(2);
      expect((caught as EnvValidationError).message).toContain(
        "Configuration validation failed for BrokenFeatureConfig (2 errors):",
      );
    });
  });

  describe("MOD-3 & MOD-4: forTesting and eager .env loading", () => {
    @Injectable()
    class EagerConfig extends EnvConfig {
      readonly val = this.envGetter.getOptionalEnv("EAGER_SPEC_VAR", "fallback");
    }

    afterEach(() => {
      delete process.env.EAGER_SPEC_VAR;
    });

    it("loads .env into process.env synchronously when forRoot() is called (before compile)", () => {
      const envFile = join(tempDir, "eager.env");
      writeFileSync(envFile, "EAGER_SPEC_VAR=loaded-eagerly\n");

      delete process.env.EAGER_SPEC_VAR;
      AppConfigModule.forRoot(EagerConfig, { envFilePath: envFile });

      expect(process.env.EAGER_SPEC_VAR).toBe("loaded-eagerly");
    });

    it("forTesting reads from the in-memory record without touching process.env", async () => {
      delete process.env.EAGER_SPEC_VAR;
      const mod = await Test.createTestingModule({
        imports: [AppConfigModule.forTesting(EagerConfig, { EAGER_SPEC_VAR: "from-record" })],
      }).compile();

      expect(mod.get(EagerConfig).val).toBe("from-record");
      expect(process.env.EAGER_SPEC_VAR).toBeUndefined();
    });
  });

  describe("MOD-5: error aggregation and fallback conditions", () => {
    @Injectable()
    class ThreeErrorsConfig extends EnvConfig {
      readonly a = this.envGetter.getRequiredEnv("ERR_A");
      readonly b = this.envGetter.getRequiredNumericEnv("ERR_B");
      readonly c = this.envGetter.getRequiredBooleanEnv("ERR_C");
    }

    it("aggregates 3 errors with class name in header by default", async () => {
      let caught: unknown;
      try {
        await Test.createTestingModule({
          imports: [AppConfigModule.forTesting(ThreeErrorsConfig, { ERR_B: "nan" })],
        }).compile();
      } catch (err) {
        caught = err;
      }

      expect(caught).toBeInstanceOf(EnvValidationError);
      const valErr = caught as EnvValidationError;
      expect(valErr.errors).toEqual([
        "Missing 'ERR_A' environment variable",
        "Variable 'ERR_B' is not of number type.",
        "Missing 'ERR_C' environment variable",
      ]);
      expect(valErr.message).toContain("Configuration validation failed for ThreeErrorsConfig (3 errors):");
    });

    it("produces the exact single getter message when only 1 error occurs", async () => {
      let caught: unknown;
      try {
        await Test.createTestingModule({
          imports: [
            AppConfigModule.forTesting(ThreeErrorsConfig, {
              ERR_A: "ok",
              ERR_B: "42",
            }),
          ],
        }).compile();
      } catch (err) {
        caught = err;
      }

      expect(caught).toBeInstanceOf(EnvValidationError);
      expect((caught as EnvValidationError).message).toBe("Missing 'ERR_C' environment variable");
    });

    it("reports only the first error when aggregateErrors: false", async () => {
      let caught: unknown;
      try {
        await Test.createTestingModule({
          imports: [AppConfigModule.forTesting(ThreeErrorsConfig, {}, { aggregateErrors: false })],
        }).compile();
      } catch (err) {
        caught = err;
      }

      expect(caught).toBeInstanceOf(EnvValidationError);
      expect((caught as EnvValidationError).errors).toEqual(["Missing 'ERR_A' environment variable"]);
    });

    it("resolves @Inject(token), @Optional() dependencies, and subclasses with own constructor", async () => {
      const PREFIX_TOKEN = "PREFIX_TOKEN";
      const MISSING_OPTIONAL_TOKEN = "MISSING_OPTIONAL_TOKEN";

      @Injectable()
      class CustomDepsConfig extends EnvConfig {
        readonly fullHost: string;
        constructor(
          envGetter: EnvGetterService,
          @Inject(PREFIX_TOKEN) readonly prefix: string,
          @Optional() @Inject(MISSING_OPTIONAL_TOKEN) readonly opt?: string,
        ) {
          super(envGetter);
          this.fullHost = `${this.prefix}:${this.envGetter.getRequiredEnv("HOST")}`;
        }
      }

      const mod = await Test.createTestingModule({
        imports: [
          AppConfigModule.forTesting(
            CustomDepsConfig,
            { HOST: "localhost" },
            {
              providers: [{ provide: PREFIX_TOKEN, useValue: "https" }],
            },
          ),
        ],
      }).compile();

      const cfg = mod.get(CustomDepsConfig);
      expect(cfg.fullHost).toBe("https:localhost");
      expect(cfg.opt).toBeUndefined();
    });

    it("fires Nest lifecycle hooks (onModuleInit, onApplicationBootstrap, onModuleDestroy) on factory-constructed configs", async () => {
      const hooks: string[] = [];

      @Injectable()
      class LifecycleConfig extends EnvConfig implements OnModuleInit, OnApplicationBootstrap, OnModuleDestroy {
        readonly port = this.envGetter.getOptionalNumericEnv("PORT", 3000);
        onModuleInit() {
          hooks.push("init");
        }
        onApplicationBootstrap() {
          hooks.push("bootstrap");
        }
        onModuleDestroy() {
          hooks.push("destroy");
        }
      }

      const mod = await Test.createTestingModule({
        imports: [AppConfigModule.forTesting(LifecycleConfig, {})],
      }).compile();

      await mod.init();
      expect(hooks).toEqual(["init", "bootstrap"]);
      await mod.close();
      expect(hooks).toEqual(["init", "bootstrap", "destroy"]);
    });

    it("attaches a derived-value TypeError during class construction as cause", async () => {
      @Injectable()
      class DerivedCrashConfig extends EnvConfig {
        readonly host = this.envGetter.getRequiredEnv("MISSING_HOST");
        readonly port = this.envGetter.getRequiredNumericEnv("MISSING_PORT");
        readonly upper = this.host.toUpperCase();
      }

      let caught: unknown;
      try {
        await Test.createTestingModule({
          imports: [AppConfigModule.forTesting(DerivedCrashConfig, {})],
        }).compile();
      } catch (err) {
        caught = err;
      }

      expect(caught).toBeInstanceOf(EnvValidationError);
      expect((caught as EnvValidationError).cause).toBeInstanceOf(TypeError);
    });

    it("falls back to useClass (first-error semantics) for property injection, non-default scope, forwardRef, and missing metadata", async () => {
      const PROP_TOKEN = "PROP_TOKEN";

      @Injectable()
      class PropertyInjectedConfig extends EnvConfig {
        @Inject(PROP_TOKEN)
        readonly injectedProp!: string;
        readonly a = this.envGetter.getRequiredEnv("A");
        readonly b = this.envGetter.getRequiredEnv("B");
      }

      const propMod = await Test.createTestingModule({
        imports: [
          AppConfigModule.forTesting(
            PropertyInjectedConfig,
            { A: "1", B: "2" },
            { providers: [{ provide: PROP_TOKEN, useValue: "prop-val" }] },
          ),
        ],
      }).compile();
      expect(propMod.get(PropertyInjectedConfig).injectedProp).toBe("prop-val");

      await expect(
        Test.createTestingModule({
          imports: [
            AppConfigModule.forTesting(
              PropertyInjectedConfig,
              {},
              { providers: [{ provide: PROP_TOKEN, useValue: "prop-val" }] },
            ),
          ],
        }).compile(),
      ).rejects.toThrow("Missing 'A' environment variable");

      @Injectable({ scope: Scope.TRANSIENT })
      class TransientConfig extends EnvConfig {
        readonly a = this.envGetter.getRequiredEnv("A");
        readonly b = this.envGetter.getRequiredEnv("B");
      }

      await expect(
        Test.createTestingModule({
          imports: [AppConfigModule.forTesting(TransientConfig, {})],
        }).compile(),
      ).rejects.toThrow("Missing 'A' environment variable");

      @Injectable()
      class ForwardDep {
        readonly ok = true;
      }

      @Injectable()
      class ForwardRefConfig {
        readonly a: string;
        readonly b: string;
        constructor(
          private readonly envGetter: EnvGetterService,
          @Inject(forwardRef(() => ForwardDep)) readonly dep: ForwardDep,
        ) {
          this.a = this.envGetter.getRequiredEnv("A");
          this.b = this.envGetter.getRequiredEnv("B");
        }
      }

      await expect(
        Test.createTestingModule({
          imports: [AppConfigModule.forTesting(ForwardRefConfig, {}, { providers: [ForwardDep] })],
        }).compile(),
      ).rejects.toThrow("Missing 'A' environment variable");

      // Class with constructor param but no @Injectable() decorator (missing PARAMTYPES_METADATA)
      class UndecoratedConfig {
        readonly val = "undecorated";
        constructor(@Optional() readonly maybe?: string) {}
      }

      const undecoratedMod = await Test.createTestingModule({
        imports: [AppConfigModule.forTesting(UndecoratedConfig, {})],
      }).compile();
      expect(undecoratedMod.get(UndecoratedConfig).val).toBe("undecorated");
    });
  });
});
