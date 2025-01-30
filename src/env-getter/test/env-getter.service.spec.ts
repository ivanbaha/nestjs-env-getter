import { Test, type TestingModule } from "@nestjs/testing";
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

  // it("should get required string env", () => {
  //   expect(envService.getRequiredEnv("TEST_STRING_ENV")).toBe("test-string");
  //   expect(envService.getRequiredEnv("TEST_STRING_ENV", ["test-string", "test"])).toBe("test-string");
  // });

  // it("should get optional string env", () => {
  //   expect(envService.getOptionalEnv("TEST_STRING_ENV", "default-value")).toBe("test-string");
  //   expect(envService.getOptionalEnv("TEST_STRING_ENV_UNSET", "default-value")).toBe("default-value");
  //   expect(envService.getOptionalEnv("TEST_STRING_ENV", ["test-string", "test"])).toBe("test-string");
  //   expect(envService.getOptionalEnv("TEST_STRING_ENV_UNSET", "default-value", ["test", "default-value"])).toBe(
  //     "default-value",
  //   );
  // });

  // it("should get numeric env", () => {
  //   expect(envService.getRequiredNumericEnv("TEST_NUMBER_ENV")).toBe(1555);
  //   expect(envService.getNumericEnv("TEST_NUMBER_ENV", 333)).toBe(1555);
  // });

  // it("should return a default value because of wrong numeric env format", () => {
  //   expect(envService.getNumericEnv("TEST_NUMBER_ENV_UNSET")).toBeUndefined();
  //   expect(envService.getNumericEnv("TEST_NUMBER_ENV_UNSET", 333)).toBe(333);
  //   expect(envService.getNumericEnv("TEST_STRING_ENV", 333)).toBe(333);
  // });

  // it("should return boolean env", () => {
  //   expect(envService.getBooleanEnv("TEST_BOOLEAN_ENV")).toBe(true);
  // });

  // it("should return optional boolean env", () => {
  //   expect(envService.getOptionalBooleanEnv("TEST_BOOLEAN_ENV")).toBe(true);
  //   expect(envService.getOptionalBooleanEnv("TEST_BOOLEAN_ENV_UNSET", true)).toBe(true);
  //   expect(envService.getOptionalBooleanEnv("TEST_BOOLEAN_ENV_UNSET")).toBeUndefined();
  // });

  // it("should return required boolean env", () => {
  //   expect(envService.getRequiredBooleanEnv("TEST_BOOLEAN_ENV")).toBe(true);
  // });

  // it("should skip checking of required envs.", () => {
  //   process.env.SKIP_REQUIRED_ENVS = "true";

  //   expect(envService.getRequiredEnv("TEST_STRING_ENV")).toBe("skip_variable");
  //   expect(envService.getRequiredNumericEnv("TEST_NUMBER_ENV")).toBe(1);
  //   expect(envService.getRequiredBooleanEnv("TEST_BOOLEAN_ENV")).toBe(false);

  //   process.env.SKIP_REQUIRED_ENVS = undefined;
  // });

  // it("should get time period env", () => {
  //   expect(envService.getTimePeriod("TEST_TIME_PERIOD_ENV_UNSET", "1000")).toBe(1000);
  //   expect(envService.getTimePeriod("TEST_TIME_PERIOD_ENV_UNSET", "10s")).toBe(10_000);
  //   expect(envService.getTimePeriod("TEST_TIME_PERIOD_ENV_UNSET", "10m")).toBe(600_000);
  //   expect(envService.getTimePeriod("TEST_TIME_PERIOD_ENV_UNSET", "10h")).toBe(36_000_000);
  //   expect(envService.getTimePeriod("TEST_TIME_PERIOD_ENV_UNSET", "10d")).toBe(864_000_000);
  //   // 5
  //   expect(envService.getTimePeriod("TEST_TIME_PERIOD_ENV", "1000")).toBe(5);
  //   // 5s
  //   expect(envService.getTimePeriod("TEST_TIME_PERIOD_SEC_ENV", "1000")).toBe(5_000);
  //   expect(envService.getTimePeriod("TEST_TIME_PERIOD_SEC_ENV", "1000", "s")).toBe(5);
  //   // 5m
  //   expect(envService.getTimePeriod("TEST_TIME_PERIOD_MIN_ENV", "1000")).toBe(300_000);
  //   expect(envService.getTimePeriod("TEST_TIME_PERIOD_MIN_ENV", "1000", "s")).toBe(300);
  //   // 5h
  //   expect(envService.getTimePeriod("TEST_TIME_PERIOD_HOUR_ENV", "1000")).toBe(18_000_000);
  //   expect(envService.getTimePeriod("TEST_TIME_PERIOD_HOUR_ENV", "1000", "s")).toBe(18_000);
  //   expect(envService.getTimePeriod("TEST_TIME_PERIOD_HOUR_ENV", "1000", "m")).toBe(300);
  //   // 5d
  //   expect(envService.getTimePeriod("TEST_TIME_PERIOD_DAY_ENV", "1000", "ms")).toBe(432_000_000);
  //   expect(envService.getTimePeriod("TEST_TIME_PERIOD_DAY_ENV", "1000", "s")).toBe(432_000);
  //   expect(envService.getTimePeriod("TEST_TIME_PERIOD_DAY_ENV", "1000", "m")).toBe(7_200);
  //   expect(envService.getTimePeriod("TEST_TIME_PERIOD_DAY_ENV", "1000", "h")).toBe(120);
  // });

  // it("should get required URL env", () => {
  //   expect(envService.getRequiredURL("TEST_VALID_URL_ENV")).toBe("http://booboo.com/");

  //   // skip envs flow
  //   process.env[SKIP_REQUIRED_ENVS_VAR] = "true";
  //   const res = envService.getRequiredURL("UNSET_ENV");
  //   expect(res).toBe(`http://${SKIP_ENV}.com`);
  //   process.env[SKIP_REQUIRED_ENVS_VAR] = undefined;
  // });

  // it("should exit with error message during getting required URL env", () => {
  //   const exit = jest.spyOn(process, "exit").mockImplementation(() => {
  //     throw new Error();
  //   });

  //   // unset Env
  //   try {
  //     envService.getRequiredURL("UNSET_ENV");
  //   } catch (_) {}
  //   // invalid value
  //   try {
  //     envService.getRequiredURL("TEST_INVALID_URL_ENV");
  //   } catch (_) {}

  //   expect(exit).toHaveBeenCalledTimes(2);
  // });

  // it("should get optional URL env", () => {
  //   expect(envService.getOptionalURL("UNSET_ENV")).toBe(undefined);
  //   expect(envService.getOptionalURL("TEST_VALID_URL_ENV")).toBe("http://booboo.com/");
  //   expect(envService.getOptionalURL("UNSET_ENV", "http://default.url")).toBe("http://default.url/");
  // });

  // it("should exit with error message during getting optional URL env", () => {
  //   const exit = jest.spyOn(process, "exit").mockImplementation(() => {
  //     throw new Error();
  //   });

  //   try {
  //     envService.getOptionalURL("TEST_INVALID_URL_ENV");
  //   } catch (_) {}
  //   try {
  //     envService.getOptionalURL("UNSET_URL", "invalid def url");
  //   } catch (_) {}

  //   expect(exit).toHaveBeenCalledTimes(2);
  // });

  // it("should exit with error message during getting required env", () => {
  //   const exit = jest.spyOn(process, "exit").mockImplementation(() => {
  //     throw new Error();
  //   });

  //   // not allowed value
  //   try {
  //     envService.getRequiredEnv("TEST_STRING_ENV", ["test"]);
  //   } catch (_) {}
  //   // allowed values can't be an empty array
  //   try {
  //     envService.getOptionalEnv("TEST_STRING_ENV", []);
  //   } catch (_) {}

  //   expect(exit).toHaveBeenCalledTimes(2);
  // });

  // it("should exit with error message during getting optional env", () => {
  //   const exit = jest.spyOn(process, "exit").mockImplementation(() => {
  //     throw new Error();
  //   });

  //   // not allowed value
  //   try {
  //     envService.getOptionalEnv("TEST_STRING_ENV", ["test"]);
  //   } catch (_) {}
  //   // allowed values can't be an empty array
  //   try {
  //     envService.getOptionalEnv("TEST_STRING_ENV", []);
  //   } catch (_) {}
  //   // default value is not from allowed values list
  //   try {
  //     envService.getOptionalEnv("TEST_STRING_ENV_UNSET", "test_string", ["test"]);
  //   } catch (_) {}

  //   expect(exit).toHaveBeenCalledTimes(3);
  // });

  // TODO: write test cases for parseObjectFromEnv
  // TODO: write test cases for parseArrayFromEnv 😆
});
