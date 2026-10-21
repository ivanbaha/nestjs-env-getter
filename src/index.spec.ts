import * as rootBarrel from "./index";

describe("Root barrel exports (BUG-6)", () => {
  it("exports all documented runtime symbols", () => {
    expect(typeof rootBarrel.EnvGetterModule).toBe("function");
    expect(typeof rootBarrel.EnvGetterService).toBe("function");
    expect(typeof rootBarrel.AppConfigModule).toBe("function");
    expect(typeof rootBarrel.APP_CONFIG).toBe("string");
    expect(typeof rootBarrel.EnvConfig).toBe("function");
    expect(typeof rootBarrel.EnvValidationError).toBe("function");
    expect(typeof rootBarrel.CronSchedule).toBe("function");
    expect(typeof rootBarrel.isValidCronExpression).toBe("function");
    expect(typeof rootBarrel.isTimePeriod).toBe("function");
    expect(typeof rootBarrel.parseTimePeriod).toBe("function");
    expect(typeof rootBarrel.ENV_GETTER_OPTIONS).toBe("symbol");
  });

  it("works end-to-end via exported utility functions", () => {
    expect(rootBarrel.isValidCronExpression("0 3 * * *")).toBe(true);
    expect(rootBarrel.isValidCronExpression("not-a-cron")).toBe(false);
    expect(rootBarrel.isTimePeriod("30s")).toBe(true);
    expect(rootBarrel.isTimePeriod("invalid")).toBe(false);
    expect(rootBarrel.parseTimePeriod("30s")).toBe(30_000);
  });
});
