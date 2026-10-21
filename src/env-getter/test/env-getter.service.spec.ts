import { Test, TestingModule } from "@nestjs/testing";
import { EnvGetterService } from "../env-getter.service";

describe("Env Getter Service", () => {
  let service: EnvGetterService;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      providers: [EnvGetterService],
    }).compile();

    service = app.get<EnvGetterService>(EnvGetterService);
    jest.spyOn(service as any, "fail").mockImplementation();
  });

  describe("isEnvSet", () => {
    it("should check env", () => {
      expect(service.isEnvSet("TEST_STRING_ENV")).toBe(true);
    });
  });

  describe("getRequiredEnv", () => {
    afterEach(() => {
      delete process.env.TEST_ENV_getRequiredEnv;
    });

    it("should return the value of the environment variable if it exists", () => {
      process.env.TEST_ENV_getRequiredEnv = "testValue";

      const result = service.getRequiredEnv("TEST_ENV_getRequiredEnv");

      expect(result).toBe("testValue");
    });

    it("should stop process with an error if the environment variable is missing", () => {
      service.getRequiredEnv("MISSING_ENV");

      expect(service["fail"]).toHaveBeenCalledWith("Missing 'MISSING_ENV' environment variable");
    });

    it("should stop process with an error if the environment variable does not match the allowed values", () => {
      process.env.TEST_ENV_getRequiredEnv = "invalidValue";
      const allowedValues = ["one", "two"];

      service.getRequiredEnv("TEST_ENV_getRequiredEnv", allowedValues);

      expect(service["fail"]).toHaveBeenCalledWith(
        "Variable 'TEST_ENV_getRequiredEnv' can be only one of: [one,two], but received 'invalidValue'",
      );
    });

    it("should return the value of the environment variable if it matches the allowed values", () => {
      process.env.TEST_ENV_getRequiredEnv = "one";
      const allowedValues = ["one", "two"];

      const result = service.getRequiredEnv("TEST_ENV_getRequiredEnv", allowedValues);

      expect(result).toBe("one");
    });
  });

  describe("getOptionalEnv", () => {
    afterEach(() => {
      delete process.env.TEST_ENV_getOptionalEnv;
    });

    it("should return the value of the environment variable if it exists and no default value is provided", () => {
      process.env.TEST_ENV_getOptionalEnv = "testValue";

      const result = service.getOptionalEnv("TEST_ENV_getOptionalEnv");

      expect(result).toBe("testValue");
    });

    it("should return the default value if the environment variable is missing", () => {
      delete process.env.TEST_ENV_getOptionalEnv;

      const result = service.getOptionalEnv("TEST_ENV_getOptionalEnv", "defaultValue");

      expect(result).toBe("defaultValue");
    });

    it("should return the value of the environment variable if it exists and it matches one of the allowed values", () => {
      process.env.TEST_ENV_getOptionalEnv = "validValue";
      const allowedValues = ["validValue", "anotherValue"];

      const result = service.getOptionalEnv("TEST_ENV_getOptionalEnv", allowedValues);

      expect(result).toBe("validValue");
    });

    it("should return undefined if the environment variable is missing and no default value is provided", () => {
      delete process.env.TEST_ENV_getOptionalEnv;

      const result = service.getOptionalEnv("TEST_ENV_getOptionalEnv");

      expect(result).toBeUndefined();
    });

    it("should stop process with an error if the environment variable does not match the allowed values", () => {
      process.env.TEST_ENV_getOptionalEnv = "invalidValue";
      const allowedValues = ["one", "two"];

      service.getOptionalEnv("TEST_ENV_getOptionalEnv", allowedValues);

      expect(service["fail"]).toHaveBeenCalledWith(
        "Variable 'TEST_ENV_getOptionalEnv' can be only one of: [one,two], but received 'invalidValue'",
      );
    });

    it("should stop process with an error if the environment variable is missing and the default value is not one of allowed values", () => {
      delete process.env.TEST_ENV_getOptionalEnv;
      const allowedValues = ["one", "two"];

      service.getOptionalEnv("TEST_ENV_getOptionalEnv", "defaultValue", allowedValues);

      expect(service["fail"]).toHaveBeenCalledWith(
        "Variable 'TEST_ENV_getOptionalEnv' can be only one of: [one,two], but received 'defaultValue'",
      );
    });
  });

  describe("getRequiredObject", () => {
    // Sample class for validation
    class User {
      name: string;
      age: number;

      constructor(data: { name: string; age: number }) {
        if (!data.name || typeof data.name !== "string") {
          throw new Error("Invalid name");
        }
        if (!data.age || typeof data.age !== "number") {
          throw new Error("Invalid age");
        }
        this.name = data.name;
        this.age = data.age;
      }
    }

    afterEach(() => {
      delete process.env.TEST_ENV_getRequiredObject;
      delete process.env.USER_ENV_getRequiredObject;
    });

    it("should parse a JSON object from an environment variable", () => {
      process.env.TEST_ENV_getRequiredObject = JSON.stringify({ key: "value" });

      const result = service.getRequiredObject<{ key: string }>("TEST_ENV_getRequiredObject");

      expect(result).toEqual({ key: "value" });
    });

    it("should return an instance of the provided class when parsing is successful", () => {
      process.env.USER_ENV_getRequiredObject = JSON.stringify({ name: "Alice", age: 30 });

      const result = service.getRequiredObject("USER_ENV_getRequiredObject", User);

      expect(result).toBeInstanceOf(User);
      expect(result.name).toBe("Alice");
      expect(result.age).toBe(30);
    });

    it("should stop process with an error if the environment variable is missing", () => {
      service.getRequiredObject("MISSING_ENV");

      expect(service["fail"]).toHaveBeenCalledWith("Missing 'MISSING_ENV' environment variable");
    });

    it("should stop process with an error if JSON parsing fails (without leaking input fragments)", () => {
      process.env.TEST_ENV_getRequiredObject = "invalid-json";

      service.getRequiredObject("TEST_ENV_getRequiredObject");

      expect(service["fail"]).toHaveBeenCalledWith(
        expect.stringContaining("Cannot parse object from variable 'TEST_ENV_getRequiredObject'. Error: Invalid JSON"),
      );
      // Must NOT include the raw input fragment
      const stopSpy = service["fail"] as unknown as jest.SpyInstance;
      const callArg = stopSpy.mock.calls.at(-1)?.[0] as string;
      expect(callArg).not.toContain("invalid-json");
    });

    it("should stop process with an error if the provided class validation fails", () => {
      process.env.USER_ENV_getRequiredObject = JSON.stringify({ name: "Alice" }); // Missing age field

      service.getRequiredObject("USER_ENV_getRequiredObject", User);

      expect(service["fail"]).toHaveBeenCalledWith(
        "Cannot parse object from variable 'USER_ENV_getRequiredObject'. Error: Invalid age",
      );
    });
  });

  describe("getRequiredArray", () => {
    afterEach(() => {
      delete process.env.TEST_ARRAY;
    });

    it("should return a parsed array from a valid JSON string", () => {
      process.env.TEST_ARRAY = '["apple", "banana", "cherry"]';

      const result = service.getRequiredArray<string>("TEST_ARRAY");

      expect(result).toEqual(["apple", "banana", "cherry"]);
    });

    it("should throw an error if the environment variable is not set", () => {
      delete process.env.TEST_ARRAY;

      service.getRequiredArray<string>("TEST_ARRAY");

      expect(service["fail"]).toHaveBeenCalledWith("Missing 'TEST_ARRAY' environment variable");
    });

    it("should throw an error if the environment variable is not a valid JSON array", () => {
      process.env.TEST_ARRAY = '"not an array"';

      service.getRequiredArray<string>("TEST_ARRAY");

      expect(service["fail"]).toHaveBeenCalledWith("'TEST_ARRAY' must be a stringified array");
    });

    it("should apply validation function to each element", () => {
      process.env.TEST_ARRAY = "[10, 20, 30]";

      const result = service.getRequiredArray<number>(
        "TEST_ARRAY",
        (value) => (typeof value === "number" && value > 5) || "Each element must be greater than 5",
      );

      expect(result).toEqual([10, 20, 30]);
    });

    it("should throw an error if validation function fails for an element", () => {
      process.env.TEST_ARRAY = "[10, 20, 3]";

      service.getRequiredArray<number>(
        "TEST_ARRAY",
        (value) => (typeof value === "number" && value > 5) || "Each element must be greater than 5",
      );

      expect(service["fail"]).toHaveBeenCalledWith("Each element must be greater than 5");
    });

    it("should throw an error if the validation function returns an invalid type", () => {
      process.env.TEST_ARRAY = "[1, 2, 3]";

      service.getRequiredArray<number>("TEST_ARRAY", () => ({}) as any);

      expect(service["fail"]).toHaveBeenCalledWith(
        `The validation func of EnvGetterService.getRequiredArray('TEST_ARRAY') must return a boolean or non-empty string.`,
      );
    });
  });

  describe("getRequiredCron", () => {
    afterEach(() => {
      delete process.env.TEST_CRON;
    });

    it("should return a CronSchedule instance for a valid 5-field cron expression", () => {
      process.env.TEST_CRON = "0 2 * * *";

      const result = service.getRequiredCron("TEST_CRON");

      expect(result).toBeDefined();
      expect(result.toString()).toBe("0 2 * * *");
    });

    it("should return a CronSchedule instance for a valid 6-field cron expression", () => {
      process.env.TEST_CRON = "30 0 2 * * MON-FRI";

      const result = service.getRequiredCron("TEST_CRON");

      expect(result).toBeDefined();
      expect(result.toString()).toBe("30 0 2 * * MON-FRI");
    });

    it("should stop process if the environment variable is missing", () => {
      service.getRequiredCron("MISSING_CRON");

      expect(service["fail"]).toHaveBeenCalledWith("Missing 'MISSING_CRON' environment variable");
    });

    it("should stop process if the cron expression is invalid", () => {
      process.env.TEST_CRON = "invalid-cron";

      service.getRequiredCron("TEST_CRON");

      expect(service["fail"]).toHaveBeenCalledWith(
        "Variable 'TEST_CRON' is not a valid cron expression. Expected 5 or 6 fields: [second] minute hour day-of-month month day-of-week",
      );
    });

    it("should stop process for out-of-range values like 60 24 * * *", () => {
      process.env.TEST_CRON = "60 24 * * *";

      service.getRequiredCron("TEST_CRON");

      expect(service["fail"]).toHaveBeenCalledWith(
        "Variable 'TEST_CRON' is not a valid cron expression. Expected 5 or 6 fields: [second] minute hour day-of-month month day-of-week",
      );
    });
  });

  describe("getOptionalCron", () => {
    afterEach(() => {
      delete process.env.TEST_CRON_OPT;
    });

    it("should return undefined if the environment variable is not set", () => {
      const result = service.getOptionalCron("TEST_CRON_OPT");

      expect(result).toBeUndefined();
    });

    it("should return a CronSchedule instance for a valid cron expression", () => {
      process.env.TEST_CRON_OPT = "*/15 * * * *";

      const result = service.getOptionalCron("TEST_CRON_OPT");

      expect(result).toBeDefined();
      expect(result?.toString()).toBe("*/15 * * * *");
    });

    it("should stop process if the cron expression is invalid", () => {
      process.env.TEST_CRON_OPT = "not a cron";

      service.getOptionalCron("TEST_CRON_OPT");

      expect(service["fail"]).toHaveBeenCalledWith(
        "Variable 'TEST_CRON_OPT' is not a valid cron expression. Expected 5 or 6 fields: [second] minute hour day-of-month month day-of-week",
      );
    });

    it("should stop process for invalid 6-field expression", () => {
      process.env.TEST_CRON_OPT = "60 60 25 32 13 8";

      service.getOptionalCron("TEST_CRON_OPT");

      expect(service["fail"]).toHaveBeenCalledWith(
        "Variable 'TEST_CRON_OPT' is not a valid cron expression. Expected 5 or 6 fields: [second] minute hour day-of-month month day-of-week",
      );
    });
  });

  describe("getOptionalConfigFromFile", () => {
    afterEach(() => {
      // Clean up any watchers to prevent interference between tests
      service.onModuleDestroy();
    });

    it("should return undefined when file doesn't exist and no default value provided", () => {
      const result = service.getOptionalConfigFromFile("non-existent-file.json");
      expect(result).toBeUndefined();
      expect(service["fail"]).not.toHaveBeenCalled();
    });

    it("should return default value when file doesn't exist", () => {
      const defaultValue = { key: "default" };
      const result = service.getOptionalConfigFromFile("non-existent-file.json", defaultValue);
      expect(result).toEqual(defaultValue);
      expect(result).toHaveProperty("on"); // Should have event methods
      expect(service["fail"]).not.toHaveBeenCalled();
    });

    it("should return undefined when file exists but has invalid JSON and no default value", () => {
      // Create a temporary file with invalid JSON
      const fs = require("fs");
      const path = require("path");
      const tempFile = path.join(process.cwd(), "temp-invalid.json");

      try {
        fs.writeFileSync(tempFile, "{ invalid json }");

        const result = service.getOptionalConfigFromFile("temp-invalid.json");
        expect(result).toBeUndefined();
        expect(service["fail"]).not.toHaveBeenCalled();
      } finally {
        // Clean up
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
        }
      }
    });

    it("should return default value when file exists but has invalid JSON", () => {
      // Create a temporary file with invalid JSON
      const fs = require("fs");
      const path = require("path");
      const tempFile = path.join(process.cwd(), "temp-invalid2.json");
      const defaultValue = { key: "default" };

      try {
        fs.writeFileSync(tempFile, "{ invalid json }");

        const result = service.getOptionalConfigFromFile("temp-invalid2.json", defaultValue);
        expect(result).toEqual(defaultValue);
        expect(result).toHaveProperty("on"); // Should have event methods
        expect(service["fail"]).not.toHaveBeenCalled();
      } finally {
        // Clean up
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
        }
      }
    });

    it("should crash the process when validation fails even for optional config", () => {
      // Create a temporary file with valid JSON
      const fs = require("fs");
      const path = require("path");
      const tempFile = path.join(process.cwd(), "temp-valid.json");

      try {
        fs.writeFileSync(tempFile, JSON.stringify({ key: "value" }));

        class TestConfig {
          requiredField: string;
          constructor(data: any) {
            if (!data.requiredField) {
              throw new Error("requiredField is required");
            }
            this.requiredField = data.requiredField;
          }
        }

        // stopProcess is mocked to return undefined; the code then re-throws, so we expect a throw
        expect(() => service.getOptionalConfigFromFile("temp-valid.json", TestConfig)).toThrow();
        expect(service["fail"]).toHaveBeenCalledWith(expect.stringContaining("Validation failed"));
      } finally {
        // Clean up
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
        }
      }
    });
  });

  describe("File Watcher - File Replacement", () => {
    const fs = require("fs");
    const path = require("path");
    let tempFile: string;

    beforeEach(() => {
      tempFile = path.join(process.cwd(), `temp-watcher-${Date.now()}.json`);
    });

    afterEach((done) => {
      // Clean up watchers and files
      service.onModuleDestroy();
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
      // Give some time for file system operations to complete
      setTimeout(done, 100);
    });

    it("should re-establish watcher after file change event", (done) => {
      // Create initial file
      const initialData = { value: "initial" };
      fs.writeFileSync(tempFile, JSON.stringify(initialData));

      // Load config with watcher enabled
      const config = service.getRequiredConfigFromFile<{ value: string }>(tempFile, undefined, {
        enabled: true,
        debounceMs: 100,
      });

      expect(config.value).toBe("initial");

      let updateCount = 0;
      config.on("updated", () => {
        updateCount++;

        // After first update, verify watcher still works by triggering another update
        if (updateCount === 1) {
          expect(config.value).toBe("updated");
          // Trigger second update
          setTimeout(() => {
            fs.writeFileSync(tempFile, JSON.stringify({ value: "second-update" }));
          }, 150);
        } else if (updateCount === 2) {
          expect(config.value).toBe("second-update");
          done();
        }
      });

      // Trigger first file change
      setTimeout(() => {
        fs.writeFileSync(tempFile, JSON.stringify({ value: "updated" }));
      }, 150);
    }, 10000);

    it("should handle file replacement (Vault agent scenario)", (done) => {
      // Create initial file
      const initialData = { connectionString: "mongodb://initial" };
      fs.writeFileSync(tempFile, JSON.stringify(initialData));

      // Load config with watcher enabled
      const config = service.getRequiredConfigFromFile<{ connectionString: string }>(tempFile, undefined, {
        enabled: true,
        debounceMs: 100,
      });

      expect(config.connectionString).toBe("mongodb://initial");

      let updateCount = 0;
      config.on("updated", () => {
        updateCount++;

        if (updateCount === 1) {
          expect(config.connectionString).toBe("mongodb://replaced");
          // Trigger another replacement to verify watcher was re-established
          setTimeout(() => {
            const tempNewFile = `${tempFile}.new`;
            fs.writeFileSync(tempNewFile, JSON.stringify({ connectionString: "mongodb://second-replacement" }));
            fs.renameSync(tempNewFile, tempFile);
          }, 150);
        } else if (updateCount === 2) {
          expect(config.connectionString).toBe("mongodb://second-replacement");
          done();
        }
      });

      // Simulate Vault agent file replacement: write to temp file, then rename
      setTimeout(() => {
        const tempNewFile = `${tempFile}.new`;
        fs.writeFileSync(tempNewFile, JSON.stringify({ connectionString: "mongodb://replaced" }));
        fs.renameSync(tempNewFile, tempFile);
      }, 150);
    }, 10000);

    it("should emit error event when file is deleted", (done) => {
      // Create initial file
      const initialData = { value: "test" };
      fs.writeFileSync(tempFile, JSON.stringify(initialData));

      // Load config with watcher enabled
      const config = service.getRequiredConfigFromFile<{ value: string }>(tempFile, undefined, {
        enabled: true,
        debounceMs: 100,
      });

      config.on("error", (event) => {
        expect(event.error.message).toContain("was deleted");
        expect(event.filePath).toBe(tempFile);
        done();
      });

      // Delete the file after a delay
      setTimeout(() => {
        fs.unlinkSync(tempFile);
        // Trigger a change event by trying to write (which will fail, but watcher will detect deletion)
        setTimeout(() => {
          if (fs.existsSync(tempFile)) {
            fs.writeFileSync(tempFile, "trigger");
          }
        }, 50);
      }, 150);
    }, 5000);

    it("should handle both change and rename events", (done) => {
      // Create initial file
      const initialData = { value: "initial" };
      fs.writeFileSync(tempFile, JSON.stringify(initialData));

      // Load config with watcher enabled
      const config = service.getRequiredConfigFromFile<{ value: string }>(tempFile, undefined, {
        enabled: true,
        debounceMs: 100,
      });

      let eventCount = 0;
      config.on("updated", () => {
        eventCount++;
        if (eventCount === 1) {
          expect(config.value).toBe("changed");
          // Now trigger a rename event
          setTimeout(() => {
            const tempNewFile = `${tempFile}.new`;
            fs.writeFileSync(tempNewFile, JSON.stringify({ value: "renamed" }));
            fs.renameSync(tempNewFile, tempFile);
          }, 150);
        } else if (eventCount === 2) {
          expect(config.value).toBe("renamed");
          done();
        }
      });

      // First trigger a regular change event
      setTimeout(() => {
        fs.writeFileSync(tempFile, JSON.stringify({ value: "changed" }));
      }, 150);
    }, 10000);

    it("should respect custom debounce time of 350ms", (done) => {
      // Create initial file
      const initialData = { value: "initial" };
      fs.writeFileSync(tempFile, JSON.stringify(initialData));

      const startTime = Date.now();

      // Load config with default watcher options (350ms debounce)
      const config = service.getRequiredConfigFromFile<{ value: string }>(tempFile);

      config.on("updated", () => {
        const elapsed = Date.now() - startTime;
        // Should be at least 350ms due to debounce
        expect(elapsed).toBeGreaterThanOrEqual(300); // Allow some margin
        expect(config.value).toBe("updated");
        done();
      });

      // Trigger file change immediately
      setTimeout(() => {
        fs.writeFileSync(tempFile, JSON.stringify({ value: "updated" }));
      }, 50);
    }, 5000);

    it("should allow disabling file watcher", (done) => {
      // Create initial file
      const initialData = { value: "initial" };
      fs.writeFileSync(tempFile, JSON.stringify(initialData));

      // Load config with watcher disabled
      const config = service.getRequiredConfigFromFile<{ value: string }>(tempFile, undefined, {
        enabled: false,
      });

      let updateCalled = false;
      config.on("updated", () => {
        updateCalled = true;
      });

      // Change file
      setTimeout(() => {
        fs.writeFileSync(tempFile, JSON.stringify({ value: "changed" }));
      }, 100);

      // Wait and verify no update event was emitted
      setTimeout(() => {
        expect(updateCalled).toBe(false);
        expect(config.value).toBe("initial"); // Should still have old value
        done();
      }, 500);
    }, 2000);
  });

  describe("set-but-empty environment variables (P2.4/M9)", () => {
    afterEach(() => {
      delete process.env.TEST_EMPTY_ENV;
    });

    it("getRequiredEnv should stop process with a distinct 'set but empty' message", () => {
      process.env.TEST_EMPTY_ENV = "";

      service.getRequiredEnv("TEST_EMPTY_ENV");

      expect(service["fail"]).toHaveBeenCalledWith("Variable 'TEST_EMPTY_ENV' is set but empty");
    });

    it("the empty check should flow through derived required getters", () => {
      process.env.TEST_EMPTY_ENV = "";

      service.getRequiredNumericEnv("TEST_EMPTY_ENV");

      expect(service["fail"]).toHaveBeenCalledWith("Variable 'TEST_EMPTY_ENV' is set but empty");
    });

    it("isEnvSet should keep pure-existence semantics for empty values", () => {
      process.env.TEST_EMPTY_ENV = "";

      expect(service.isEnvSet("TEST_EMPTY_ENV")).toBe(true);
    });
  });

  describe("getOptionalEnv — empty values and allowedValues (P2.1/M9)", () => {
    afterEach(() => {
      delete process.env.TEST_OPT_ALLOWED;
    });

    it("should return undefined when unset with allowedValues (no validation)", () => {
      delete process.env.TEST_OPT_ALLOWED;

      const result = service.getOptionalEnv("TEST_OPT_ALLOWED", ["a", "b"]);

      expect(result).toBeUndefined();
      expect(service["fail"]).not.toHaveBeenCalled();
    });

    it("should return undefined when empty with allowedValues (no validation)", () => {
      process.env.TEST_OPT_ALLOWED = "";

      const result = service.getOptionalEnv("TEST_OPT_ALLOWED", ["a", "b"]);

      expect(result).toBeUndefined();
      expect(service["fail"]).not.toHaveBeenCalled();
    });

    it("should treat an empty value as unset and return the default", () => {
      process.env.TEST_OPT_ALLOWED = "";

      expect(service.getOptionalEnv("TEST_OPT_ALLOWED", "fallback")).toBe("fallback");
    });
  });

  describe("getRequiredBooleanEnv", () => {
    afterEach(() => {
      delete process.env.TEST_BOOL_ENV;
    });

    it("should parse 'true' and 'false'", () => {
      process.env.TEST_BOOL_ENV = "true";
      expect(service.getRequiredBooleanEnv("TEST_BOOL_ENV")).toBe(true);

      process.env.TEST_BOOL_ENV = "false";
      expect(service.getRequiredBooleanEnv("TEST_BOOL_ENV")).toBe(false);
    });

    it("should stop process for case variants and non-boolean values", () => {
      for (const bad of ["TRUE", "False", "1", "yes"]) {
        (service["fail"] as unknown as jest.SpyInstance).mockClear();
        process.env.TEST_BOOL_ENV = bad;

        service.getRequiredBooleanEnv("TEST_BOOL_ENV");

        expect(service["fail"]).toHaveBeenCalledWith("Variable 'TEST_BOOL_ENV' is not of boolean type.");
      }
    });
  });

  describe("getOptionalBooleanEnv — strict validation (P2.2)", () => {
    afterEach(() => {
      delete process.env.TEST_OPT_BOOL;
    });

    it("should return the default when unset or empty", () => {
      delete process.env.TEST_OPT_BOOL;
      expect(service.getOptionalBooleanEnv("TEST_OPT_BOOL", true)).toBe(true);
      expect(service.getOptionalBooleanEnv("TEST_OPT_BOOL")).toBeUndefined();

      process.env.TEST_OPT_BOOL = "";
      expect(service.getOptionalBooleanEnv("TEST_OPT_BOOL", true)).toBe(true);
    });

    it("should parse exact 'true'/'false'", () => {
      process.env.TEST_OPT_BOOL = "true";
      expect(service.getOptionalBooleanEnv("TEST_OPT_BOOL", false)).toBe(true);

      process.env.TEST_OPT_BOOL = "false";
      expect(service.getOptionalBooleanEnv("TEST_OPT_BOOL", true)).toBe(false);
    });

    it("should stop process for anything else instead of silently returning false", () => {
      for (const bad of ["TRUE", "1", "yes", "on"]) {
        (service["fail"] as unknown as jest.SpyInstance).mockClear();
        process.env.TEST_OPT_BOOL = bad;

        service.getOptionalBooleanEnv("TEST_OPT_BOOL", true);

        expect(service["fail"]).toHaveBeenCalledWith(
          `Variable 'TEST_OPT_BOOL' is not of boolean type. Expected 'true' or 'false', received '${bad}'.`,
        );
      }
    });
  });

  describe("numeric getters — strict integer validation (P2.3)", () => {
    afterEach(() => {
      delete process.env.TEST_NUM_ENV;
    });

    it("should parse plain integers and underscore-grouped integers", () => {
      process.env.TEST_NUM_ENV = "42";
      expect(service.getRequiredNumericEnv("TEST_NUM_ENV")).toBe(42);

      process.env.TEST_NUM_ENV = "1_000_000";
      expect(service.getRequiredNumericEnv("TEST_NUM_ENV")).toBe(1_000_000);
    });

    it("should stop process for malformed numeric strings (required)", () => {
      for (const bad of ["___", "_1", "1__2", "12_", "1.5", "1e3", "abc"]) {
        (service["fail"] as unknown as jest.SpyInstance).mockClear();
        process.env.TEST_NUM_ENV = bad;

        service.getRequiredNumericEnv("TEST_NUM_ENV");

        expect(service["fail"]).toHaveBeenCalledWith("Variable 'TEST_NUM_ENV' is not of number type.");
      }
    });

    it("should stop process for values beyond the safe integer range", () => {
      process.env.TEST_NUM_ENV = "9007199254740993"; // Number.MAX_SAFE_INTEGER + 2

      service.getRequiredNumericEnv("TEST_NUM_ENV");

      expect(service["fail"]).toHaveBeenCalledWith("Variable 'TEST_NUM_ENV' exceeds the safe integer range.");
    });

    it("getOptionalNumericEnv should return default when unset or empty", () => {
      delete process.env.TEST_NUM_ENV;
      expect(service.getOptionalNumericEnv("TEST_NUM_ENV", 7)).toBe(7);
      expect(service.getOptionalNumericEnv("TEST_NUM_ENV")).toBeUndefined();

      process.env.TEST_NUM_ENV = "";
      expect(service.getOptionalNumericEnv("TEST_NUM_ENV", 7)).toBe(7);
    });

    it("getOptionalNumericEnv should stop process for present-but-invalid values (not return default)", () => {
      process.env.TEST_NUM_ENV = "not-a-number";

      service.getOptionalNumericEnv("TEST_NUM_ENV", 7);

      expect(service["fail"]).toHaveBeenCalledWith("Variable 'TEST_NUM_ENV' is not of number type.");
    });
  });

  describe("URL getters (P2.5 matrix)", () => {
    afterEach(() => {
      delete process.env.TEST_URL_ENV;
    });

    it("getRequiredURL should parse valid URLs and reject invalid ones", () => {
      process.env.TEST_URL_ENV = "https://example.com/path";
      expect(service.getRequiredURL("TEST_URL_ENV").hostname).toBe("example.com");

      process.env.TEST_URL_ENV = "not a url";
      service.getRequiredURL("TEST_URL_ENV");
      expect(service["fail"]).toHaveBeenCalledWith(expect.stringContaining("must be a valid URL"));
    });

    it("getOptionalURL: unset/empty → default; valid → URL; invalid → stop process", () => {
      const fallback = new URL("https://fallback.example.com");

      delete process.env.TEST_URL_ENV;
      expect(service.getOptionalURL("TEST_URL_ENV", fallback)).toBe(fallback);
      expect(service.getOptionalURL("TEST_URL_ENV")).toBeUndefined();

      process.env.TEST_URL_ENV = "";
      expect(service.getOptionalURL("TEST_URL_ENV", fallback)).toBe(fallback);

      process.env.TEST_URL_ENV = "https://set.example.com";
      expect(service.getOptionalURL("TEST_URL_ENV", fallback)?.hostname).toBe("set.example.com");

      process.env.TEST_URL_ENV = "::invalid::";
      service.getOptionalURL("TEST_URL_ENV", fallback);
      expect(service["fail"]).toHaveBeenCalledWith(expect.stringContaining("must be a valid URL"));
    });
  });

  describe("time period getters (P2.6)", () => {
    afterEach(() => {
      delete process.env.TEST_TIME_ENV;
    });

    it("getRequiredTimePeriod should parse and convert (with Math.ceil rounding)", () => {
      process.env.TEST_TIME_ENV = "30s";
      expect(service.getRequiredTimePeriod("TEST_TIME_ENV")).toBe(30_000);
      expect(service.getRequiredTimePeriod("TEST_TIME_ENV", "s")).toBe(30);

      process.env.TEST_TIME_ENV = "1500ms";
      expect(service.getRequiredTimePeriod("TEST_TIME_ENV", "s")).toBe(2); // rounded up
    });

    it("(name) overload: unset/empty → undefined", () => {
      delete process.env.TEST_TIME_ENV;
      expect(service.getOptionalTimePeriod("TEST_TIME_ENV")).toBeUndefined();

      process.env.TEST_TIME_ENV = "";
      expect(service.getOptionalTimePeriod("TEST_TIME_ENV")).toBeUndefined();
    });

    it("(name, resultIn) overload: unset → undefined; set → converted", () => {
      delete process.env.TEST_TIME_ENV;
      expect(service.getOptionalTimePeriod("TEST_TIME_ENV", "s")).toBeUndefined();

      process.env.TEST_TIME_ENV = "2m";
      expect(service.getOptionalTimePeriod("TEST_TIME_ENV", "s")).toBe(120);
    });

    it("(name, defaultValue, resultIn?) overload: unset → parsed default", () => {
      delete process.env.TEST_TIME_ENV;
      expect(service.getOptionalTimePeriod("TEST_TIME_ENV", "30s")).toBe(30_000);
      expect(service.getOptionalTimePeriod("TEST_TIME_ENV", "30s", "s")).toBe(30);
      // number default = milliseconds, converted to resultIn
      expect(service.getOptionalTimePeriod("TEST_TIME_ENV", 5000, "s")).toBe(5);
      expect(service.getOptionalTimePeriod("TEST_TIME_ENV", 5000)).toBe(5000);
    });

    it("env value wins over the default", () => {
      process.env.TEST_TIME_ENV = "1m";
      expect(service.getOptionalTimePeriod("TEST_TIME_ENV", "30s", "s")).toBe(60);
    });

    it("set-but-invalid values stop the process for all forms", () => {
      process.env.TEST_TIME_ENV = "soon";

      service.getOptionalTimePeriod("TEST_TIME_ENV");
      expect(service["fail"]).toHaveBeenCalledWith(expect.stringContaining("is not in the acceptable format"));

      (service["fail"] as unknown as jest.SpyInstance).mockClear();
      service.getOptionalTimePeriod("TEST_TIME_ENV", "30s");
      expect(service["fail"]).toHaveBeenCalledWith(expect.stringContaining("is not in the acceptable format"));
    });

    it("invalid default values stop the process", () => {
      delete process.env.TEST_TIME_ENV;

      service.getOptionalTimePeriod("TEST_TIME_ENV", "nope" as string);

      expect(service["fail"]).toHaveBeenCalledWith(
        expect.stringContaining("The default value for the environment variable"),
      );
    });
  });

  describe("getOptionalCron — empty value (P2.5/M9)", () => {
    afterEach(() => {
      delete process.env.TEST_CRON_EMPTY;
    });

    it("should return undefined for an empty value instead of throwing", () => {
      process.env.TEST_CRON_EMPTY = "";

      expect(service.getOptionalCron("TEST_CRON_EMPTY")).toBeUndefined();
      expect(service["fail"]).not.toHaveBeenCalled();
    });
  });

  describe("getRequiredArray — sanitization and error hygiene (P1.4/P1.2)", () => {
    afterEach(() => {
      delete process.env.TEST_ARRAY_SAN;
    });

    it("should strip __proto__ from array elements (prototype pollution defense)", () => {
      process.env.TEST_ARRAY_SAN = '[{"__proto__":{"isAdmin":true}},{"name":"ok"}]';

      const result = service.getRequiredArray<Record<string, unknown>>("TEST_ARRAY_SAN");

      expect(({} as Record<string, unknown>).isAdmin).toBeUndefined(); // Object.prototype untouched
      expect(Object.prototype.hasOwnProperty.call(result[0], "__proto__")).toBe(false);
      expect(result[1]).toEqual({ name: "ok" });
    });

    it("should not leak the raw input fragment on JSON parse errors", () => {
      process.env.TEST_ARRAY_SAN = '["SuperSecretValue123", oops]';

      service.getRequiredArray("TEST_ARRAY_SAN");

      // stopProcess is mocked (does not throw), so the first call is the JSON-parse one
      const stopSpy = service["fail"] as unknown as jest.SpyInstance;
      const callArg = stopSpy.mock.calls[0]?.[0] as string;
      expect(callArg).toContain("Invalid JSON");
      expect(callArg).not.toContain("SuperSecretValue123");
    });
  });

  describe("events emitter (P4.2)", () => {
    it("should have no listener limit (setMaxListeners(0))", () => {
      expect(service.events.getMaxListeners()).toBe(0);
    });

    it("should accept more than 10 subscriptions without warnings", () => {
      const warnings: Error[] = [];
      const onWarning = (warning: Error) => warnings.push(warning);
      process.on("warning", onWarning);

      for (let i = 0; i < 15; i++) {
        service.events.on("updated:/some/path.json", () => undefined);
      }

      process.removeListener("warning", onWarning);
      expect(service.events.listenerCount("updated:/some/path.json")).toBe(15);
      expect(warnings.filter((w) => w.name === "MaxListenersExceededWarning")).toHaveLength(0);
    });
  });

  describe("literal union types (GET-1 / BUG-2)", () => {
    enum StageEnum {
      Alpha = "a",
      Beta = "b",
    }

    it("infers literal union for getRequiredEnv and getOptionalEnv across all call shapes", () => {
      const env = new EnvGetterService({ env: { STAGE: "a", OPT_STAGE: "b" } });

      const r1: "a" | "b" = env.getRequiredEnv("STAGE", ["a", "b"]);
      const allowed = ["a", "b"] as const;
      const r2: "a" | "b" = env.getRequiredEnv("STAGE", allowed);
      const rEnum: StageEnum = env.getRequiredEnv("STAGE", Object.values(StageEnum));
      const wideArr: string[] = ["a", "b"];
      const rWide: string = env.getRequiredEnv("STAGE", wideArr);

      const o1: "a" | "b" | undefined = env.getOptionalEnv("OPT_STAGE", ["a", "b"]);
      const o2: "a" | "b" | undefined = env.getOptionalEnv("UNSET_STAGE", allowed);

      // 3-arg overload returns T (non-nullable), resolving BUG-2
      const o3: "a" | "b" = env.getOptionalEnv("UNSET_STAGE", "a", ["a", "b"]);

      // @ts-expect-error narrowed literal union cannot be assigned to an unrelated literal
      const _badAssignment: "c" = r1;
      void _badAssignment;

      expect(r1).toBe("a");
      expect(r2).toBe("a");
      expect(rEnum).toBe(StageEnum.Alpha);
      expect(rWide).toBe("a");
      expect(o1).toBe("b");
      expect(o2).toBeUndefined();
      expect(o3).toBe("a");
    });
  });

  describe("getOptionalObject (GET-2)", () => {
    class FeatureFlags {
      readonly beta: boolean;
      constructor(data: { beta: boolean }) {
        if (typeof data.beta !== "boolean") {
          throw new Error("beta must be boolean");
        }
        this.beta = data.beta;
      }
    }

    it("returns undefined when unset or empty and no default is given", () => {
      const env = new EnvGetterService({ env: { EMPTY_OBJ: "" } });
      expect(env.getOptionalObject("UNSET_OBJ")).toBeUndefined();
      expect(env.getOptionalObject("EMPTY_OBJ")).toBeUndefined();
      expect(env.getOptionalObject("UNSET_OBJ", FeatureFlags)).toBeUndefined();
      expect(env.getOptionalObject("EMPTY_OBJ", FeatureFlags)).toBeUndefined();
    });

    it("returns defaultValue when unset or empty, validating with cls when cls is given", () => {
      const env = new EnvGetterService({ env: { EMPTY_OBJ: "" } });
      const rawDefault = { beta: true };
      expect(env.getOptionalObject("UNSET_OBJ", rawDefault)).toBe(rawDefault);
      expect(env.getOptionalObject("EMPTY_OBJ", rawDefault)).toBe(rawDefault);

      const validatedDefault = env.getOptionalObject("UNSET_OBJ", { beta: false }, FeatureFlags);
      expect(validatedDefault).toBeInstanceOf(FeatureFlags);
      expect(validatedDefault.beta).toBe(false);

      expect(() => env.getOptionalObject("UNSET_OBJ", { beta: "bad" as unknown as boolean }, FeatureFlags)).toThrow(
        "The default value for 'UNSET_OBJ' failed validation: beta must be boolean",
      );
    });

    it("parses JSON object and optionally constructs class when set", () => {
      const env = new EnvGetterService({
        env: {
          PLAIN_OBJ: '{"key":"val"}',
          CLASS_OBJ: '{"beta":true}',
        },
      });

      expect(env.getOptionalObject<{ key: string }>("PLAIN_OBJ")).toEqual({ key: "val" });
      expect(env.getOptionalObject("PLAIN_OBJ", { key: "default" })).toEqual({ key: "val" });

      const inst1 = env.getOptionalObject("CLASS_OBJ", FeatureFlags);
      expect(inst1).toBeInstanceOf(FeatureFlags);
      expect(inst1?.beta).toBe(true);

      const inst2 = env.getOptionalObject("CLASS_OBJ", { beta: false }, FeatureFlags);
      expect(inst2).toBeInstanceOf(FeatureFlags);
      expect(inst2.beta).toBe(true);
    });

    it("throws on malformed JSON or failing class validation (never falls back to default)", () => {
      const env = new EnvGetterService({
        env: {
          BAD_JSON: "{bad",
          BAD_CLASS: '{"beta":"nope"}',
        },
      });

      expect(() => env.getOptionalObject("BAD_JSON", { ok: true })).toThrow(
        "Cannot parse object from variable 'BAD_JSON'. Error: Invalid JSON",
      );
      expect(() => env.getOptionalObject("BAD_CLASS", { beta: true }, FeatureFlags)).toThrow(
        "Cannot parse object from variable 'BAD_CLASS'. Error: beta must be boolean",
      );
    });
  });

  describe("getOptionalArray (GET-3)", () => {
    it("names getOptionalArray (not getRequiredArray) when its validator returns an invalid type", () => {
      const env = new EnvGetterService({ env: { ARR: "[1, 2]" } });
      const message = `The validation func of EnvGetterService.getOptionalArray('ARR') must return a boolean or non-empty string.`;

      expect(() => env.getOptionalArray("ARR", () => ({}) as unknown as boolean)).toThrow(message);
      expect(() => env.getOptionalArray("UNSET_ARR", [1], () => ({}) as unknown as boolean)).toThrow(
        `The validation func of EnvGetterService.getOptionalArray('UNSET_ARR') must return a boolean or non-empty string.`,
      );
    });

    it("returns undefined when unset or empty and no default is given", () => {
      const env = new EnvGetterService({ env: { EMPTY_ARR: "" } });
      expect(env.getOptionalArray<string>("UNSET_ARR")).toBeUndefined();
      expect(env.getOptionalArray<string>("EMPTY_ARR")).toBeUndefined();
      expect(env.getOptionalArray<string>("UNSET_ARR", (x) => typeof x === "string")).toBeUndefined();
    });

    it("returns defaultValue when unset or empty, validating default elements when validate is given", () => {
      const env = new EnvGetterService({ env: { EMPTY_ARR: "" } });
      const fallback = ["a", "b"];
      const res: string[] = env.getOptionalArray("UNSET_ARR", fallback);
      expect(res).toBe(fallback);

      const tupleRes: [string, number] = env.getOptionalArray<[string, number]>("UNSET_ARR", ["a", 1]);
      expect(tupleRes).toEqual(["a", 1]);

      expect(() => env.getOptionalArray("EMPTY_ARR", fallback, () => "bad default element")).toThrow(
        "The default value for 'EMPTY_ARR' failed validation: bad default element",
      );
    });

    it("parses and validates array when set", () => {
      const env = new EnvGetterService({ env: { ARR: '["x","y"]' } });
      expect(env.getOptionalArray<string>("ARR")).toEqual(["x", "y"]);
      expect(env.getOptionalArray("ARR", ["default"])).toEqual(["x", "y"]);

      const indices: number[] = [];
      const validated: string[] = env.getOptionalArray("ARR", ["default"], (el, idx, arr) => {
        if (idx !== undefined) indices.push(idx);
        return (typeof el === "string" && arr?.length === 2) || "invalid";
      });
      expect(validated).toEqual(["x", "y"]);
      expect(indices).toEqual([0, 1]);
    });

    it("throws on malformed JSON, non-array JSON, or failing validator", () => {
      const env = new EnvGetterService({
        env: {
          BAD_JSON: "[oops",
          NOT_ARR: '{"a":1}',
          BAD_EL: "[1, 2, -1]",
        },
      });

      expect(() => env.getOptionalArray("BAD_JSON", [1])).toThrow(
        "Cannot parse an array from variable 'BAD_JSON'. Error: Invalid JSON",
      );
      expect(() => env.getOptionalArray("NOT_ARR", [1])).toThrow("'NOT_ARR' must be a stringified array");
      expect(() =>
        env.getOptionalArray("BAD_EL", [1], (el) => (typeof el === "number" && el > 0) || "must be positive"),
      ).toThrow("must be positive");
    });
  });

  describe("getOptionalCron default value (GET-4)", () => {
    it("returns CronSchedule from default when unset or empty", () => {
      const env = new EnvGetterService({ env: { EMPTY_CRON: "" } });
      const schedule = env.getOptionalCron("UNSET_CRON", "0 3 * * *");
      expect(schedule.toString()).toBe("0 3 * * *");

      const scheduleFromEmpty = env.getOptionalCron("EMPTY_CRON", "0 4 * * *");
      expect(scheduleFromEmpty.toString()).toBe("0 4 * * *");
    });

    it("env value wins over default when set", () => {
      const env = new EnvGetterService({ env: { SET_CRON: "*/5 * * * *" } });
      const schedule = env.getOptionalCron("SET_CRON", "0 3 * * *");
      expect(schedule.toString()).toBe("*/5 * * * *");
    });

    it("validates defaultValue on every call even when env is set", () => {
      const env = new EnvGetterService({ env: { SET_CRON: "*/5 * * * *" } });
      expect(() => env.getOptionalCron("SET_CRON", "bad-default")).toThrow(
        "The default value for the environment variable 'SET_CRON' is not a valid cron expression. Expected 5 or 6 fields: [second] minute hour day-of-month month day-of-week",
      );
      expect(() => env.getOptionalCron("UNSET_CRON", "")).toThrow(
        "The default value for the environment variable 'UNSET_CRON' is not a valid cron expression. Expected 5 or 6 fields: [second] minute hour day-of-month month day-of-week",
      );
    });
  });

  describe("getRequiredList and getOptionalList (GET-5)", () => {
    it("splits by comma by default and trims whitespace", () => {
      const env = new EnvGetterService({ env: { HOSTS: " a.com , b.com , c.com " } });
      expect(env.getRequiredList("HOSTS")).toEqual(["a.com", "b.com", "c.com"]);
    });

    it("supports custom single- and multi-character separators", () => {
      const env = new EnvGetterService({ env: { PATHS: "foo::bar::baz" } });
      expect(env.getRequiredList("PATHS", { separator: "::" })).toEqual(["foo", "bar", "baz"]);
    });

    it("rejects empty items in the middle, trailing, or separator-only values, and empty separator", () => {
      const env = new EnvGetterService({
        env: {
          MIDDLE: "a,,b",
          TRAILING: "a,b,",
          SEPS_ONLY: " , , ",
        },
      });

      expect(() => env.getRequiredList("MIDDLE")).toThrow("Variable 'MIDDLE' contains an empty list item at index 1");
      expect(() => env.getRequiredList("TRAILING")).toThrow(
        "Variable 'TRAILING' contains an empty list item at index 2",
      );
      expect(() => env.getRequiredList("SEPS_ONLY")).toThrow(
        "Variable 'SEPS_ONLY' contains an empty list item at index 0",
      );
      expect(() => env.getRequiredList("MIDDLE", { separator: "" })).toThrow(
        "The separator for 'MIDDLE' must be a non-empty string",
      );
    });

    it("validates allowedValues and infers literal union types", () => {
      const env = new EnvGetterService({
        env: {
          ROLES: "admin, user",
          BAD_ROLES: "admin, guest",
        },
      });

      const roles: ("admin" | "user")[] = env.getRequiredList("ROLES", {
        allowedValues: ["admin", "user"],
      });
      expect(roles).toEqual(["admin", "user"]);

      expect(() =>
        env.getRequiredList("BAD_ROLES", {
          allowedValues: ["admin", "user"],
        }),
      ).toThrow("Variable 'BAD_ROLES' can be only one of: [admin,user], but received 'guest'");
    });

    it("handles getOptionalList overloads, shallow-copies default, and validates default against allowedValues", () => {
      const env = new EnvGetterService({ env: { EMPTY_LIST: "" } });

      expect(env.getOptionalList("UNSET_LIST")).toBeUndefined();
      expect(env.getOptionalList("EMPTY_LIST")).toBeUndefined();
      expect(env.getOptionalList("UNSET_LIST", { allowedValues: ["a", "b"] })).toBeUndefined();

      const defaultArr = ["a", "b"] as const;
      // Type test: 2nd arg array resolves to default overload returning string[] (non-nullable)
      const copy: string[] = env.getOptionalList("UNSET_LIST", defaultArr);
      const narrowedCopy: ("a" | "b")[] = env.getOptionalList("UNSET_LIST", defaultArr, {
        allowedValues: ["a", "b"],
      });
      expect(copy).toEqual(["a", "b"]);
      expect(narrowedCopy).toEqual(["a", "b"]);
      expect(copy).not.toBe(defaultArr);
      copy.push("c");
      expect(defaultArr).toEqual(["a", "b"]);

      expect(() => env.getOptionalList("UNSET_LIST", ["a", "bad"] as string[], { allowedValues: ["a", "b"] })).toThrow(
        "Variable 'UNSET_LIST' can be only one of: [a,b], but received 'bad'",
      );
    });

    it("participates in collectErrors", () => {
      const env = new EnvGetterService({ env: { BAD_LIST: "a,,b" } });
      expect(() =>
        env.collectErrors(() => ({
          missing: env.getRequiredList("MISSING_LIST"),
          malformed: env.getRequiredList("BAD_LIST"),
        })),
      ).toThrow(/2 errors/);
    });
  });

  describe("EnvGetterModuleOptions.env custom source (MOD-3)", () => {
    it("reads from custom env record, ignores process.env, and reflects live mutations", () => {
      process.env.ONLY_IN_PROCESS = "from-process";
      const record: Record<string, string | undefined> = { CUSTOM_KEY: "initial" };
      const env = new EnvGetterService({ env: record });

      expect(env.isEnvSet("ONLY_IN_PROCESS")).toBe(false);
      expect(env.isEnvSet("CUSTOM_KEY")).toBe(true);
      expect(env.getRequiredEnv("CUSTOM_KEY")).toBe("initial");

      record.CUSTOM_KEY = "mutated";
      expect(env.getRequiredEnv("CUSTOM_KEY")).toBe("mutated");

      delete process.env.ONLY_IN_PROCESS;
    });

    it("throws when env is combined with envFilePath other than false", () => {
      expect(() => new EnvGetterService({ env: {}, envFilePath: ".env" })).toThrow(
        "envFilePath cannot be combined with env",
      );
      expect(() => new EnvGetterService({ env: {}, envFilePath: false })).not.toThrow();
    });
  });
});
