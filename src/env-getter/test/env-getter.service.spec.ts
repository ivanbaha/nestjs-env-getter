import { Test, TestingModule } from "@nestjs/testing";
import { EnvGetterService } from "../env-getter.service";

describe("Env Getter Service", () => {
  let service: EnvGetterService;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      providers: [EnvGetterService],
    }).compile();

    service = app.get<EnvGetterService>(EnvGetterService);
    jest.spyOn(service as any, "stopProcess").mockImplementation();
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

      expect(service["stopProcess"]).toHaveBeenCalledWith("Missing 'MISSING_ENV' environment variable");
    });

    it("should stop process with an error if the environment variable does not match the allowed values", () => {
      process.env.TEST_ENV_getRequiredEnv = "invalidValue";
      const allowedValues = ["one", "two"];

      service.getRequiredEnv("TEST_ENV_getRequiredEnv", allowedValues);

      expect(service["stopProcess"]).toHaveBeenCalledWith(
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

      expect(service["stopProcess"]).toHaveBeenCalledWith(
        "Variable 'TEST_ENV_getOptionalEnv' can be only one of: [one,two], but received 'invalidValue'",
      );
    });

    it("should stop process with an error if the environment variable is missing and the default value is not one of allowed values", () => {
      delete process.env.TEST_ENV_getOptionalEnv;
      const allowedValues = ["one", "two"];

      service.getOptionalEnv("TEST_ENV_getOptionalEnv", "defaultValue", allowedValues);

      expect(service["stopProcess"]).toHaveBeenCalledWith(
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

      expect(service["stopProcess"]).toHaveBeenCalledWith("Missing 'MISSING_ENV' environment variable");
    });

    it("should stop process with an error if JSON parsing fails", () => {
      process.env.TEST_ENV_getRequiredObject = "invalid-json";

      service.getRequiredObject("TEST_ENV_getRequiredObject");

      expect(service["stopProcess"]).toHaveBeenCalledWith(
        "Cannot parse object from variable 'TEST_ENV_getRequiredObject'. Error: Unexpected token 'i', \"invalid-json\" is not valid JSON",
      );
    });

    it("should stop process with an error if the provided class validation fails", () => {
      process.env.USER_ENV_getRequiredObject = JSON.stringify({ name: "Alice" }); // Missing age field

      service.getRequiredObject("USER_ENV_getRequiredObject", User);

      expect(service["stopProcess"]).toHaveBeenCalledWith(
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

      expect(service["stopProcess"]).toHaveBeenCalledWith(
        "Cannot parse an array from variable 'TEST_ARRAY'. Error: \"undefined\" is not valid JSON",
      );
    });

    it("should throw an error if the environment variable is not a valid JSON array", () => {
      process.env.TEST_ARRAY = '"not an array"';

      service.getRequiredArray<string>("TEST_ARRAY");

      expect(service["stopProcess"]).toHaveBeenCalledWith("'TEST_ARRAY' must be a stringified array");
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

      expect(service["stopProcess"]).toHaveBeenCalledWith("Each element must be greater than 5");
    });

    it("should throw an error if the validation function returns an invalid type", () => {
      process.env.TEST_ARRAY = "[1, 2, 3]";
      jest.spyOn(global, "Error").mockImplementationOnce((message) => {
        return { message, stack: "mocked stack trace" } as any;
      });

      service.getRequiredArray<number>("TEST_ARRAY", () => ({}) as any);

      expect(service["stopProcess"]).toHaveBeenCalledWith(
        `The validation func of EnvGetterService.getRequiredArray('TEST_ARRAY') must return either boolean or string\nTrace mocked stack trace`,
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

      expect(service["stopProcess"]).toHaveBeenCalledWith("Missing 'MISSING_CRON' environment variable");
    });

    it("should stop process if the cron expression is invalid", () => {
      process.env.TEST_CRON = "invalid-cron";

      service.getRequiredCron("TEST_CRON");

      expect(service["stopProcess"]).toHaveBeenCalledWith(
        "Variable 'TEST_CRON' is not a valid cron expression. Expected 5 or 6 fields: [second] minute hour day-of-month month day-of-week",
      );
    });

    it("should stop process for out-of-range values like 60 24 * * *", () => {
      process.env.TEST_CRON = "60 24 * * *";

      service.getRequiredCron("TEST_CRON");

      expect(service["stopProcess"]).toHaveBeenCalledWith(
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

      expect(service["stopProcess"]).toHaveBeenCalledWith(
        "Variable 'TEST_CRON_OPT' is not a valid cron expression. Expected 5 or 6 fields: [second] minute hour day-of-month month day-of-week",
      );
    });

    it("should stop process for invalid 6-field expression", () => {
      process.env.TEST_CRON_OPT = "60 60 25 32 13 8";

      service.getOptionalCron("TEST_CRON_OPT");

      expect(service["stopProcess"]).toHaveBeenCalledWith(
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
      expect(service["stopProcess"]).not.toHaveBeenCalled();
    });

    it("should return default value when file doesn't exist", () => {
      const defaultValue = { key: "default" };
      const result = service.getOptionalConfigFromFile("non-existent-file.json", defaultValue);
      expect(result).toEqual(defaultValue);
      expect(result).toHaveProperty("on"); // Should have event methods
      expect(service["stopProcess"]).not.toHaveBeenCalled();
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
        expect(service["stopProcess"]).not.toHaveBeenCalled();
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
        expect(service["stopProcess"]).not.toHaveBeenCalled();
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

        service.getOptionalConfigFromFile("temp-valid.json", TestConfig);
        expect(service["stopProcess"]).toHaveBeenCalledWith(expect.stringContaining("Validation failed"));
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
});
