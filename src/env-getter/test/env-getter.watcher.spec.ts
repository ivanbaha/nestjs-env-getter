import { existsSync, mkdirSync, rmSync, unlinkSync, writeFileSync } from "fs";
import { join } from "path";

import { EnvGetterService } from "../env-getter.service";
import type { FileWatcherOptions } from "../types";

/**
 * Real-filesystem tests for the pending-watcher machinery (P4.1: E2 absent→created,
 * E3 delete→recreate), `configBaseDir` confinement (P1.5), watcher error-event
 * sanitization (P1.2), and `.env` loading via module options (P4.3).
 *
 * Uses generous debounce-aware timeouts to stay stable on slow CI runners.
 */
describe("EnvGetterService — pending watchers & module options", () => {
  const tempDir = join(process.cwd(), `temp-pending-watcher-${Date.now()}`);
  const services: EnvGetterService[] = [];
  let consoleErrorSpy: jest.SpyInstance;

  /**
   * Creates a service that skips the implicit .env load and tracks it for cleanup.
   * @param options - Module options; defaults to `{ envFilePath: false }`.
   * @returns The created service instance.
   */
  const createService = (options?: ConstructorParameters<typeof EnvGetterService>[0]): EnvGetterService => {
    const service = new EnvGetterService(options ?? { envFilePath: false });
    services.push(service);
    return service;
  };

  /**
   * The runtime accepts (filePath, defaultValue, watcherOptions); the public overloads don't.
   * @param service - The service whose `getOptionalConfigFromFile` to call untyped.
   * @returns The bound method with the implementation signature.
   */
  const getOptionalConfigRaw = (service: EnvGetterService) =>
    service.getOptionalConfigFromFile.bind(service) as (
      filePath: string,
      defaultValue?: unknown,
      clsOrWatcherOptions?: unknown,
      watcherOptions?: FileWatcherOptions,
    ) => Record<string, unknown> | undefined;

  const pendingCount = (service: EnvGetterService): number =>
    (service as unknown as { pendingWatchers: Map<string, unknown> }).pendingWatchers.size;

  const fileWatcherCount = (service: EnvGetterService): number =>
    (service as unknown as { fileWatchers: Map<string, unknown> }).fileWatchers.size;

  beforeAll(() => {
    mkdirSync(tempDir, { recursive: true });
    // stopProcess logs in red before throwing; keep test output clean
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();
  });

  afterEach(() => {
    services.splice(0).forEach((service) => service.onModuleDestroy());
  });

  afterAll(() => {
    consoleErrorSpy.mockRestore();
    if (existsSync(tempDir)) rmSync(tempDir, { recursive: true, force: true });
  });

  describe("absent file at call time (E2)", () => {
    it("should update the returned default object in place and emit 'updated' when the file appears", (done) => {
      const filePath = join(tempDir, "e2-default.json");
      const service = createService();

      const config = getOptionalConfigRaw(service)(filePath, { val: "default" }, { debounceMs: 100 });

      expect(config?.val).toBe("default");
      expect(pendingCount(service)).toBe(1);

      service.events.once(`updated:${filePath}`, () => {
        expect(config?.val).toBe("fromFile");
        // Pending watcher must hand off to a normal file watcher
        expect(pendingCount(service)).toBe(0);
        expect(fileWatcherCount(service)).toBe(1);

        // The normal watcher must now react to subsequent changes
        service.events.once(`updated:${filePath}`, () => {
          expect(config?.val).toBe("changed");
          done();
        });
        setTimeout(() => writeFileSync(filePath, JSON.stringify({ val: "changed" })), 150);
      });

      setTimeout(() => writeFileSync(filePath, JSON.stringify({ val: "fromFile" })), 150);
    }, 10000);

    it("should emit 'updated' even without a default; a subsequent call returns the config", (done) => {
      const filePath = join(tempDir, "e2-no-default.json");
      const service = createService();

      const config = service.getOptionalConfigFromFile<{ val: string }>(filePath);
      expect(config).toBeUndefined();

      service.events.once(`updated:${filePath}`, () => {
        const reloaded = service.getOptionalConfigFromFile<{ val: string }>(filePath);
        expect(reloaded?.val).toBe("created-later");
        done();
      });

      setTimeout(() => writeFileSync(filePath, JSON.stringify({ val: "created-later" })), 150);
    }, 10000);

    it("should run class validation when the file appears (cls is not dropped)", (done) => {
      const filePath = join(tempDir, "e2-cls.json");
      const service = createService();

      class StrictConfig {
        value: string;
        constructor(data: { value?: unknown }) {
          if (typeof data.value !== "string") throw new Error("value must be a string");
          this.value = data.value;
        }
      }

      const typedConfig = getOptionalConfigRaw(service)(filePath, { value: "default" }, StrictConfig, {
        debounceMs: 100,
      });

      // Invalid content first: validation must fail -> error event, object untouched
      service.events.once(`error:${filePath}`, (event: { error: Error }) => {
        expect(event.error.message).toContain("Validation failed");
        expect(typedConfig?.value).toBe("default");

        // Valid content afterwards: pending watcher is still active -> updated fires
        service.events.once(`updated:${filePath}`, () => {
          expect(typedConfig?.value).toBe("valid-now");
          done();
        });
        setTimeout(() => writeFileSync(filePath, JSON.stringify({ value: "valid-now" })), 150);
      });

      setTimeout(() => writeFileSync(filePath, JSON.stringify({ value: 42 })), 150);
    }, 10000);

    it("should NOT create a pending watcher when watching is disabled (default form)", () => {
      const filePath = join(tempDir, "e2-disabled-default.json");
      const service = createService();

      getOptionalConfigRaw(service)(filePath, { a: 1 }, { enabled: false });

      expect(pendingCount(service)).toBe(0);
    });

    it("should NOT create a pending watcher when watching is disabled (cls form)", () => {
      const filePath = join(tempDir, "e2-disabled-cls.json");
      const service = createService();

      class AnyConfig {
        constructor(_data: unknown) {}
      }
      service.getOptionalConfigFromFile(filePath, AnyConfig, { enabled: false });

      expect(pendingCount(service)).toBe(0);
    });

    it("should skip watching when the parent directory does not exist (documented limitation)", () => {
      const filePath = join(tempDir, "missing-dir", "config.json");
      const service = createService();

      const config = service.getOptionalConfigFromFile(filePath, { a: 1 });

      expect(config).toEqual(expect.objectContaining({ a: 1 }));
      expect(pendingCount(service)).toBe(0);
    });
  });

  describe("delete → recreate (E3)", () => {
    it("should emit 'error' on delete, then resume updates after recreation", (done) => {
      const filePath = join(tempDir, "e3-recreate.json");
      writeFileSync(filePath, JSON.stringify({ val: "initial" }));
      const service = createService();

      const config = getOptionalConfigRaw(service)(filePath, undefined, { debounceMs: 100 });
      expect(config?.val).toBe("initial");

      service.events.once(`error:${filePath}`, (event: { error: Error }) => {
        expect(event.error.message).toContain("was deleted");
        // Dead file watcher must be replaced by a pending parent-dir watcher
        expect(fileWatcherCount(service)).toBe(0);
        expect(pendingCount(service)).toBe(1);

        service.events.once(`updated:${filePath}`, () => {
          expect(config?.val).toBe("recreated");
          done();
        });
        setTimeout(() => writeFileSync(filePath, JSON.stringify({ val: "recreated" })), 150);
      });

      setTimeout(() => unlinkSync(filePath), 150);
    }, 10000);
  });

  describe("watcher error events are sanitized (P1.2)", () => {
    it("should not leak the file fragment when a required config file is corrupt at load", () => {
      const filePath = join(tempDir, "corrupt-initial.json");
      writeFileSync(filePath, '{"pass": SuperSecret123}');
      const service = createService();

      let thrown: Error | undefined;
      try {
        service.getRequiredConfigFromFile(filePath);
      } catch (error) {
        thrown = error as Error;
      }

      expect(thrown?.message).toContain("Invalid JSON");
      expect(thrown?.message).not.toContain("SuperSecret");
    });

    it("should not leak the file fragment (or a cause chain) when a watched file turns corrupt", (done) => {
      const filePath = join(tempDir, "corrupt-reload.json");
      writeFileSync(filePath, JSON.stringify({ ok: true }));
      const service = createService();

      getOptionalConfigRaw(service)(filePath, { ok: false }, { debounceMs: 100, breakOnError: false });

      service.events.once(`error:${filePath}`, (event: { error: Error }) => {
        expect(event.error.message).toContain("Invalid JSON");
        expect(event.error.message).not.toContain("SuperSecret");
        expect((event.error as Error & { cause?: unknown }).cause).toBeUndefined();
        done();
      });

      setTimeout(() => writeFileSync(filePath, '{"pass": SuperSecret123}'), 150);
    }, 10000);
  });

  describe("onModuleDestroy", () => {
    it("should close pending watchers", () => {
      const filePath = join(tempDir, "destroy-pending.json");
      const service = createService();

      service.getOptionalConfigFromFile(filePath, { a: 1 });
      expect(pendingCount(service)).toBe(1);

      service.onModuleDestroy();

      expect(pendingCount(service)).toBe(0);
    });
  });

  describe("configBaseDir confinement (P1.5)", () => {
    const baseDir = join(tempDir, "config-base");

    beforeAll(() => {
      mkdirSync(join(baseDir, "nested"), { recursive: true });
      writeFileSync(join(baseDir, "inside.json"), JSON.stringify({ where: "inside" }));
      writeFileSync(join(baseDir, "nested", "deep.json"), JSON.stringify({ where: "deep" }));
      writeFileSync(join(tempDir, "outside.json"), JSON.stringify({ where: "outside" }));
    });

    it("should resolve relative paths inside the base directory", () => {
      const service = createService({ envFilePath: false, configBaseDir: baseDir });

      expect(service.getRequiredConfigFromFile<{ where: string }>("inside.json").where).toBe("inside");
      expect(service.getRequiredConfigFromFile<{ where: string }>("nested/deep.json").where).toBe("deep");
    });

    it("should throw when a relative path escapes the base directory", () => {
      const service = createService({ envFilePath: false, configBaseDir: baseDir });

      expect(() => service.getOptionalConfigFromFile("../outside.json")).toThrow(/escapes configBaseDir/);
    });

    it("should throw for absolute paths outside the base directory", () => {
      const service = createService({ envFilePath: false, configBaseDir: baseDir });

      expect(() => service.getOptionalConfigFromFile(join(tempDir, "outside.json"))).toThrow(/escapes configBaseDir/);
    });

    it("should keep plain cwd resolution when the option is not set", () => {
      const service = createService();

      expect(service.getOptionalConfigFromFile(`temp-no-base-${Date.now()}.json`)).toBeUndefined();
    });
  });

  describe(".env loading via module options (P4.3, integration)", () => {
    afterEach(() => {
      delete process.env.PENDING_WATCHER_SPEC_VAR_A;
      delete process.env.PENDING_WATCHER_SPEC_VAR_B;
    });

    it("should load a custom .env file path", () => {
      const envPath = join(tempDir, "custom-a.env");
      writeFileSync(envPath, "PENDING_WATCHER_SPEC_VAR_A=loaded-a\n");

      createService({ envFilePath: envPath });

      expect(process.env.PENDING_WATCHER_SPEC_VAR_A).toBe("loaded-a");
    });

    it("should load multiple .env files", () => {
      const envPathA = join(tempDir, "multi-a.env");
      const envPathB = join(tempDir, "multi-b.env");
      writeFileSync(envPathA, "PENDING_WATCHER_SPEC_VAR_A=multi-a\n");
      writeFileSync(envPathB, "PENDING_WATCHER_SPEC_VAR_B=multi-b\n");

      createService({ envFilePath: [envPathA, envPathB] });

      expect(process.env.PENDING_WATCHER_SPEC_VAR_A).toBe("multi-a");
      expect(process.env.PENDING_WATCHER_SPEC_VAR_B).toBe("multi-b");
    });
  });
});
