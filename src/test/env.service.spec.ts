import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import { EnvModule, EnvService } from "..";

describe("Env Service", () => {
  let envService: EnvService;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      imports: [EnvModule],
      providers: [EnvService],
    }).compile();

    envService = app.get<EnvService>(EnvService);
  });

  it("should check env", () => {
    expect(envService.isEnvSet("TEST_STRING_ENV")).toBe(true);
  });

  it("should get required string env", () => {
    expect(envService.getRequiredEnv("TEST_STRING_ENV")).toBe("test-string");
  });

  it("should get optional string env", () => {
    expect(envService.getOptionalEnv("TEST_STRING_ENV", "default-value")).toBe("test-string");
    expect(envService.getOptionalEnv("TEST_STRING_ENV_UNSET", "default-value")).toBe("default-value");
  });

  it("should get numeric env", () => {
    expect(envService.getRequiredNumericEnv("TEST_NUMBER_ENV")).toBe(555);
    expect(envService.getNumericEnv("TEST_NUMBER_ENV", 333)).toBe(555);
  });

  it("should return a default value because of wrong numeric env format", () => {
    expect(envService.getNumericEnv("TEST_NUMBER_ENV_UNSET", 333)).toBe(333);
    expect(envService.getNumericEnv("TEST_STRING_ENV", 333)).toBe(333);
  });

  it("should return boolean env", () => {
    expect(envService.getBooleanEnv("TEST_BOOLEAN_ENV")).toBe(true);
  });

  it("should return required boolean env", () => {
    expect(envService.getRequiredBooleanEnv("TEST_BOOLEAN_ENV")).toBe(true);
  });

  it("should skip checking of required envs.", () => {
    process.env.SKIP_REQUIRED_ENVS = "true";

    expect(envService.getRequiredEnv("TEST_STRING_ENV")).toBe("skip_variable");
    expect(envService.getRequiredNumericEnv("TEST_NUMBER_ENV")).toBe(1);
    expect(envService.getRequiredBooleanEnv("TEST_BOOLEAN_ENV")).toBe(false);
  });

  it("should get time period env", () => {
    expect(envService.getTimePeriod("TEST_TIME_PERIOD_ENV_UNSET", "1000")).toBe(1000);
    expect(envService.getTimePeriod("TEST_TIME_PERIOD_ENV_UNSET", "10s")).toBe(10_000);
    expect(envService.getTimePeriod("TEST_TIME_PERIOD_ENV_UNSET", "10m")).toBe(600_000);
    expect(envService.getTimePeriod("TEST_TIME_PERIOD_ENV_UNSET", "10h")).toBe(36_000_000);
    expect(envService.getTimePeriod("TEST_TIME_PERIOD_ENV_UNSET", "10d")).toBe(864_000_000);
    // 5
    expect(envService.getTimePeriod("TEST_TIME_PERIOD_ENV", "1000")).toBe(5);
    // 5s
    expect(envService.getTimePeriod("TEST_TIME_PERIOD_SEC_ENV", "1000")).toBe(5_000);
    expect(envService.getTimePeriod("TEST_TIME_PERIOD_SEC_ENV", "1000", "s")).toBe(5);
    // 5m
    expect(envService.getTimePeriod("TEST_TIME_PERIOD_MIN_ENV", "1000")).toBe(300_000);
    expect(envService.getTimePeriod("TEST_TIME_PERIOD_MIN_ENV", "1000", "s")).toBe(300);
    // 5h
    expect(envService.getTimePeriod("TEST_TIME_PERIOD_HOUR_ENV", "1000")).toBe(18_000_000);
    expect(envService.getTimePeriod("TEST_TIME_PERIOD_HOUR_ENV", "1000", "s")).toBe(18_000);
    expect(envService.getTimePeriod("TEST_TIME_PERIOD_HOUR_ENV", "1000", "m")).toBe(300);
    // 5d
    expect(envService.getTimePeriod("TEST_TIME_PERIOD_DAY_ENV", "1000", "ms")).toBe(432_000_000);
    expect(envService.getTimePeriod("TEST_TIME_PERIOD_DAY_ENV", "1000", "s")).toBe(432_000);
    expect(envService.getTimePeriod("TEST_TIME_PERIOD_DAY_ENV", "1000", "m")).toBe(7_200);
    expect(envService.getTimePeriod("TEST_TIME_PERIOD_DAY_ENV", "1000", "h")).toBe(120);
  });
});
