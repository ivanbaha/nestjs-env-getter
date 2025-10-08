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
});
