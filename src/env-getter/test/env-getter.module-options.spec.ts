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
 * Wiring tests for `EnvGetterModuleOptions` (P4.3): `envFilePath` opt-out / redirect /
 * multi-file cascade, the `EnvGetterModule.forRoot` DI path, the plain module import,
 * and the `AppConfigModule` `envGetter` pass-through.
 */
describe("EnvGetterModule options (P4.3)", () => {
  const loadEnvFileMock = loadEnvFile as jest.Mock;
  const loadEnvFilesMock = loadEnvFiles as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("direct construction", () => {
    it("should load './.env' by default (v1.1.x behavior preserved)", () => {
      new EnvGetterService();

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

      expect(loadEnvFileMock).toHaveBeenCalledWith("config/custom.env", { quiet: true });
    });

    it("should load multiple paths via loadEnvFiles", () => {
      new EnvGetterService({ envFilePath: [".env", ".env.local"] });

      expect(loadEnvFilesMock).toHaveBeenCalledWith([".env", ".env.local"], { quiet: true });
      expect(loadEnvFileMock).not.toHaveBeenCalled();
    });
  });

  describe("EnvGetterModule.forRoot", () => {
    it("should provide the options to the service through DI", async () => {
      const app: TestingModule = await Test.createTestingModule({
        imports: [EnvGetterModule.forRoot({ envFilePath: "from-forroot.env" })],
      }).compile();

      const service = app.get<EnvGetterService>(EnvGetterService);

      expect(service).toBeInstanceOf(EnvGetterService);
      expect(loadEnvFileMock).toHaveBeenCalledWith("from-forroot.env", { quiet: true });
    });

    it("plain `imports: [EnvGetterModule]` keeps working with defaults", async () => {
      const app: TestingModule = await Test.createTestingModule({
        imports: [EnvGetterModule],
      }).compile();

      const service = app.get<EnvGetterService>(EnvGetterService);

      expect(service).toBeInstanceOf(EnvGetterService);
      expect(loadEnvFileMock).toHaveBeenCalledWith(".env", { quiet: true });
    });
  });

  describe("AppConfigModule envGetter pass-through", () => {
    class TestAppConfig {}

    it("forRoot should forward envGetter options to EnvGetterService", async () => {
      const app: TestingModule = await Test.createTestingModule({
        imports: [
          AppConfigModule.forRoot({
            useClass: TestAppConfig,
            envGetter: { envFilePath: "from-app-config.env" },
          }),
        ],
      }).compile();

      expect(app.get<EnvGetterService>(EnvGetterService)).toBeInstanceOf(EnvGetterService);
      expect(loadEnvFileMock).toHaveBeenCalledWith("from-app-config.env", { quiet: true });
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
