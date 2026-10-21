import { Test, TestingModule } from "@nestjs/testing";

jest.mock("../../shared/utils", () => ({
  ...jest.requireActual("../../shared/utils"),
  loadEnvFile: jest.fn(),
  loadEnvFiles: jest.fn(),
}));

import { loadEnvFile, loadEnvFiles } from "../../shared/utils";
import { AppConfigModule } from "../../app-config/app-config.module";
import { EnvGetterModule } from "../env-getter.module";
import { EnvGetterService } from "../env-getter.service";

/**
 * Wiring tests for `EnvGetterModuleOptions` (P4.3, MOD-3, MOD-4): `envFilePath` opt-out / redirect /
 * multi-file cascade, eager `.env` loading at `forRoot()` time, the `EnvGetterModule.forRoot` DI path,
 * the plain module import, and the `AppConfigModule` `envGetter` pass-through.
 */
describe("EnvGetterModule options (P4.3 / MOD-3 / MOD-4)", () => {
  const loadEnvFileMock = loadEnvFile as jest.Mock;
  const loadEnvFilesMock = loadEnvFiles as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("direct construction", () => {
    it("should load './.env' by default (v1.1.x behavior preserved)", () => {
      new EnvGetterService();

      expect(loadEnvFileMock).toHaveBeenCalledTimes(1);
      expect(loadEnvFileMock).toHaveBeenCalledWith(".env", { quiet: true });
      expect(loadEnvFilesMock).not.toHaveBeenCalled();
    });

    it("should not load any .env file when envFilePath is false", () => {
      new EnvGetterService({ envFilePath: false });

      expect(loadEnvFileMock).not.toHaveBeenCalled();
      expect(loadEnvFilesMock).not.toHaveBeenCalled();
    });

    it("should load a custom path", () => {
      new EnvGetterService({ envFilePath: "config/custom.env" });

      expect(loadEnvFileMock).toHaveBeenCalledTimes(1);
      expect(loadEnvFileMock).toHaveBeenCalledWith("config/custom.env", { quiet: true });
    });

    it("should load multiple paths via loadEnvFiles", () => {
      new EnvGetterService({ envFilePath: [".env", ".env.local"] });

      expect(loadEnvFilesMock).toHaveBeenCalledTimes(1);
      expect(loadEnvFilesMock).toHaveBeenCalledWith([".env", ".env.local"], { quiet: true });
      expect(loadEnvFileMock).not.toHaveBeenCalled();
    });
  });

  describe("EnvGetterModule.forRoot (eager load + DI)", () => {
    it("should load .env eagerly when forRoot() is called (before compile) and again in constructor", async () => {
      const dynamicMod = EnvGetterModule.forRoot({ envFilePath: "from-forroot.env" });

      // Eagerly called at forRoot() time before compile()
      expect(loadEnvFileMock).toHaveBeenCalledTimes(1);
      expect(loadEnvFileMock).toHaveBeenCalledWith("from-forroot.env", { quiet: true });

      const app: TestingModule = await Test.createTestingModule({
        imports: [dynamicMod],
      }).compile();

      const service = app.get<EnvGetterService>(EnvGetterService);

      expect(service).toBeInstanceOf(EnvGetterService);
      expect(loadEnvFileMock).toHaveBeenCalledTimes(2);
    });

    it("plain `imports: [EnvGetterModule]` keeps working with defaults via constructor fallback", async () => {
      const app: TestingModule = await Test.createTestingModule({
        imports: [EnvGetterModule],
      }).compile();

      const service = app.get<EnvGetterService>(EnvGetterService);

      expect(service).toBeInstanceOf(EnvGetterService);
      expect(loadEnvFileMock).toHaveBeenCalledTimes(1);
      expect(loadEnvFileMock).toHaveBeenCalledWith(".env", { quiet: true });
    });

    it("throws at forRoot() time when env and envFilePath conflict", () => {
      expect(() => EnvGetterModule.forRoot({ env: {}, envFilePath: "bad.env" })).toThrow(
        "envFilePath cannot be combined with env",
      );
    });
  });

  describe("AppConfigModule envGetter pass-through & eager load", () => {
    class TestAppConfig {}

    it("forRoot should load .env eagerly at call time and forward envGetter options to EnvGetterService", async () => {
      const dynamicMod = AppConfigModule.forRoot({
        useClass: TestAppConfig,
        envGetter: { envFilePath: "from-app-config.env" },
      });

      // Called in AppConfigModule.forRoot and EnvGetterModule.forRoot before compile()
      expect(loadEnvFileMock).toHaveBeenCalledTimes(2);
      expect(loadEnvFileMock).toHaveBeenCalledWith("from-app-config.env", { quiet: true });

      const app: TestingModule = await Test.createTestingModule({
        imports: [dynamicMod],
      }).compile();

      expect(app.get<EnvGetterService>(EnvGetterService)).toBeInstanceOf(EnvGetterService);
      expect(loadEnvFileMock).toHaveBeenCalledTimes(3);
    });

    it("forRootAsync (useFactory) should forward envGetter options too", async () => {
      const app: TestingModule = await Test.createTestingModule({
        imports: [
          AppConfigModule.forRootAsync({
            useFactory: () => new TestAppConfig(),
            envGetter: { envFilePath: false },
          }),
        ],
      }).compile();

      expect(app.get<EnvGetterService>(EnvGetterService)).toBeInstanceOf(EnvGetterService);
      expect(loadEnvFileMock).not.toHaveBeenCalled();
      expect(loadEnvFilesMock).not.toHaveBeenCalled();
    });
  });
});
