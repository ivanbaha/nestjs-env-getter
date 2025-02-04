import { isTimePeriod, parseTimePeriod } from "../time-period.utils";

describe("isTimePeriod", () => {
  test("returns true for numbers", () => {
    expect(isTimePeriod(1000)).toBe(true);
    expect(isTimePeriod(0)).toBe(true);
  });

  test("returns true for valid time strings", () => {
    expect(isTimePeriod("10s")).toBe(true);
    expect(isTimePeriod("10 s")).toBe(true);
    expect(isTimePeriod("10 S")).toBe(true);
    expect(isTimePeriod("10_000_000 MS")).toBe(true);
    expect(isTimePeriod("5m")).toBe(true);
    expect(isTimePeriod("2h")).toBe(true);
    expect(isTimePeriod("3d")).toBe(true);
    expect(isTimePeriod("100 ms")).toBe(true);
    expect(isTimePeriod("100_000")).toBe(true);
  });

  test("returns false for invalid strings", () => {
    expect(isTimePeriod("abc")).toBe(false);
    expect(isTimePeriod("10x")).toBe(false);
    expect(isTimePeriod(" ")).toBe(false);
  });

  test("returns false for invalid data types", () => {
    expect(isTimePeriod(true as any)).toBe(false);
    expect(isTimePeriod(null as any)).toBe(false);
    expect(isTimePeriod({} as any)).toBe(false);
  });
});

describe("parseTimePeriod", () => {
  test("returns number as is", () => {
    expect(parseTimePeriod(5000)).toBe(5000);
  });

  test("parses valid time strings", () => {
    expect(parseTimePeriod("10s", "ms")).toBe(10_000);
    expect(parseTimePeriod("5m", "s")).toBe(300);
    expect(parseTimePeriod("2h", "m")).toBe(120);
    expect(parseTimePeriod("3d", "h")).toBe(72);
    expect(parseTimePeriod("14_400_000 ms", "h")).toBe(4);
  });

  test("handles missing units as milliseconds", () => {
    expect(parseTimePeriod("100")).toBe(100);
  });

  test("returns NaN for invalid inputs", () => {
    expect(parseTimePeriod("abc")).toBeNaN();
    expect(parseTimePeriod(" ")).toBeNaN();
    expect(parseTimePeriod(true as any)).toBeNaN();
  });
});
