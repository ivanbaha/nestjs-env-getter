import { isValidCronExpression, CronSchedule } from "../cron-schedule.utils";

describe("isValidCronExpression", () => {
  describe("5-field format (minute hour day-of-month month day-of-week)", () => {
    test("returns true for valid basic expressions", () => {
      expect(isValidCronExpression("* * * * *")).toBe(true);
      expect(isValidCronExpression("0 0 * * *")).toBe(true);
      expect(isValidCronExpression("0 2 * * *")).toBe(true);
      expect(isValidCronExpression("30 4 1 1 *")).toBe(true);
    });

    test("returns true for expressions with ranges", () => {
      expect(isValidCronExpression("0-30 * * * *")).toBe(true);
      expect(isValidCronExpression("0 9-17 * * *")).toBe(true);
      expect(isValidCronExpression("* * 1-15 * *")).toBe(true);
      expect(isValidCronExpression("* * * 1-6 *")).toBe(true);
      expect(isValidCronExpression("* * * * 0-5")).toBe(true);
    });

    test("returns true for expressions with step values", () => {
      expect(isValidCronExpression("*/5 * * * *")).toBe(true);
      expect(isValidCronExpression("0 */2 * * *")).toBe(true);
      expect(isValidCronExpression("0 0 */3 * *")).toBe(true);
      expect(isValidCronExpression("0-30/5 * * * *")).toBe(true);
    });

    test("returns true for expressions with lists", () => {
      expect(isValidCronExpression("0,15,30,45 * * * *")).toBe(true);
      expect(isValidCronExpression("0 9,12,18 * * *")).toBe(true);
      expect(isValidCronExpression("* * * 1,4,7,10 *")).toBe(true);
      expect(isValidCronExpression("* * * * 1,3,5")).toBe(true);
    });

    test("returns true for month names", () => {
      expect(isValidCronExpression("0 0 1 JAN *")).toBe(true);
      expect(isValidCronExpression("0 0 1 jan *")).toBe(true);
      expect(isValidCronExpression("0 0 1 JAN-DEC *")).toBe(true);
    });

    test("returns true for day of week names", () => {
      expect(isValidCronExpression("0 0 * * MON")).toBe(true);
      expect(isValidCronExpression("0 0 * * mon")).toBe(true);
      expect(isValidCronExpression("0 0 * * MON-FRI")).toBe(true);
      expect(isValidCronExpression("0 0 * * SUN,SAT")).toBe(true);
    });

    test("returns true for day of week 7 (Sunday)", () => {
      expect(isValidCronExpression("0 0 * * 7")).toBe(true);
    });
  });

  describe("6-field format (second minute hour day-of-month month day-of-week)", () => {
    test("returns true for valid basic expressions", () => {
      expect(isValidCronExpression("0 * * * * *")).toBe(true);
      expect(isValidCronExpression("0 0 0 * * *")).toBe(true);
      expect(isValidCronExpression("30 0 2 * * *")).toBe(true);
      expect(isValidCronExpression("0 30 4 1 1 *")).toBe(true);
    });

    test("returns true for expressions with second field ranges and steps", () => {
      expect(isValidCronExpression("*/10 * * * * *")).toBe(true);
      expect(isValidCronExpression("0-30 * * * * *")).toBe(true);
      expect(isValidCronExpression("0,15,30,45 * * * * *")).toBe(true);
    });
  });

  describe("invalid expressions", () => {
    test("returns false for non-string inputs", () => {
      expect(isValidCronExpression(123 as unknown as string)).toBe(false);
      expect(isValidCronExpression(null as unknown as string)).toBe(false);
      expect(isValidCronExpression(undefined as unknown as string)).toBe(false);
    });

    test("returns false for wrong number of fields", () => {
      expect(isValidCronExpression("* * * *")).toBe(false);
      expect(isValidCronExpression("* * * * * * *")).toBe(false);
      expect(isValidCronExpression("*")).toBe(false);
      expect(isValidCronExpression("")).toBe(false);
    });

    test("returns false for out-of-range minute values", () => {
      expect(isValidCronExpression("60 * * * *")).toBe(false);
      expect(isValidCronExpression("-1 * * * *")).toBe(false);
    });

    test("returns false for out-of-range hour values", () => {
      expect(isValidCronExpression("* 24 * * *")).toBe(false);
      expect(isValidCronExpression("* -1 * * *")).toBe(false);
    });

    test("returns false for out-of-range day-of-month values", () => {
      expect(isValidCronExpression("* * 0 * *")).toBe(false);
      expect(isValidCronExpression("* * 32 * *")).toBe(false);
    });

    test("returns false for out-of-range month values", () => {
      expect(isValidCronExpression("* * * 0 *")).toBe(false);
      expect(isValidCronExpression("* * * 13 *")).toBe(false);
    });

    test("returns false for out-of-range day-of-week values", () => {
      expect(isValidCronExpression("* * * * 8")).toBe(false);
      expect(isValidCronExpression("* * * * -1")).toBe(false);
    });

    test("returns false for invalid formats", () => {
      expect(isValidCronExpression("invalid-cron")).toBe(false);
      expect(isValidCronExpression("60 24 * * *")).toBe(false);
      expect(isValidCronExpression("abc def ghi jkl mno")).toBe(false);
    });

    test("returns false for invalid range order", () => {
      expect(isValidCronExpression("30-10 * * * *")).toBe(false);
    });
  });
});

describe("CronSchedule", () => {
  describe("toString", () => {
    test("returns the original expression", () => {
      const schedule = new CronSchedule("0 2 * * *");
      expect(schedule.toString()).toBe("0 2 * * *");
    });

    test("trims whitespace from expression", () => {
      const schedule = new CronSchedule("  0 2 * * *  ");
      expect(schedule.toString()).toBe("0 2 * * *");
    });
  });

  describe("isMatching", () => {
    test("matches a specific time for 5-field cron", () => {
      const schedule = new CronSchedule("30 14 * * *");
      // Creates a date at 14:30:00
      const matchingDate = new Date("2024-06-15T14:30:00");
      const nonMatchingDate = new Date("2024-06-15T14:31:00");

      expect(schedule.isMatching(matchingDate)).toBe(true);
      expect(schedule.isMatching(nonMatchingDate)).toBe(false);
    });

    test("matches every minute with wildcard", () => {
      const schedule = new CronSchedule("* * * * *");
      expect(schedule.isMatching(new Date("2024-01-01T00:00:00"))).toBe(true);
      expect(schedule.isMatching(new Date("2024-12-31T23:59:00"))).toBe(true);
    });

    test("matches specific day of month", () => {
      const schedule = new CronSchedule("0 0 15 * *");
      const matching = new Date("2024-06-15T00:00:00");
      const nonMatching = new Date("2024-06-14T00:00:00");

      expect(schedule.isMatching(matching)).toBe(true);
      expect(schedule.isMatching(nonMatching)).toBe(false);
    });

    test("matches specific month", () => {
      const schedule = new CronSchedule("0 0 1 6 *");
      const matching = new Date("2024-06-01T00:00:00");
      const nonMatching = new Date("2024-07-01T00:00:00");

      expect(schedule.isMatching(matching)).toBe(true);
      expect(schedule.isMatching(nonMatching)).toBe(false);
    });

    test("matches specific day of week (Monday=1)", () => {
      const schedule = new CronSchedule("0 0 * * 1");
      // June 17, 2024 is a Monday
      const monday = new Date("2024-06-17T00:00:00");
      // June 18, 2024 is a Tuesday
      const tuesday = new Date("2024-06-18T00:00:00");

      expect(schedule.isMatching(monday)).toBe(true);
      expect(schedule.isMatching(tuesday)).toBe(false);
    });

    test("matches with 6-field format (with seconds)", () => {
      const schedule = new CronSchedule("30 15 10 * * *");
      const matching = new Date("2024-06-15T10:15:30");
      const nonMatching = new Date("2024-06-15T10:15:31");

      expect(schedule.isMatching(matching)).toBe(true);
      expect(schedule.isMatching(nonMatching)).toBe(false);
    });

    test("matches with range in minutes", () => {
      const schedule = new CronSchedule("0-15 * * * *");
      expect(schedule.isMatching(new Date("2024-06-15T10:00:00"))).toBe(true);
      expect(schedule.isMatching(new Date("2024-06-15T10:15:00"))).toBe(true);
      expect(schedule.isMatching(new Date("2024-06-15T10:16:00"))).toBe(false);
    });

    test("matches with step values", () => {
      const schedule = new CronSchedule("*/15 * * * *");
      expect(schedule.isMatching(new Date("2024-06-15T10:00:00"))).toBe(true);
      expect(schedule.isMatching(new Date("2024-06-15T10:15:00"))).toBe(true);
      expect(schedule.isMatching(new Date("2024-06-15T10:30:00"))).toBe(true);
      expect(schedule.isMatching(new Date("2024-06-15T10:45:00"))).toBe(true);
      expect(schedule.isMatching(new Date("2024-06-15T10:10:00"))).toBe(false);
    });

    test("matches with list values", () => {
      const schedule = new CronSchedule("0,30 * * * *");
      expect(schedule.isMatching(new Date("2024-06-15T10:00:00"))).toBe(true);
      expect(schedule.isMatching(new Date("2024-06-15T10:30:00"))).toBe(true);
      expect(schedule.isMatching(new Date("2024-06-15T10:15:00"))).toBe(false);
    });
  });

  describe("getNextTime", () => {
    test("finds next time for hourly cron at minute 0", () => {
      const schedule = new CronSchedule("0 * * * *");
      const from = new Date("2024-06-15T10:30:00");
      const next = schedule.getNextTime(from);

      expect(next).not.toBeNull();
      expect(next?.getMinutes()).toBe(0);
      expect(next?.getHours()).toBe(11);
    });

    test("finds next time for daily cron at 2:00 AM", () => {
      const schedule = new CronSchedule("0 2 * * *");
      const from = new Date("2024-06-15T03:00:00");
      const next = schedule.getNextTime(from);

      expect(next).not.toBeNull();
      expect(next?.getMinutes()).toBe(0);
      expect(next?.getHours()).toBe(2);
      expect(next?.getDate()).toBe(16);
    });

    test("finds next time for monthly cron on the 1st", () => {
      const schedule = new CronSchedule("0 0 1 * *");
      const from = new Date("2024-06-15T00:00:00");
      const next = schedule.getNextTime(from);

      expect(next).not.toBeNull();
      expect(next?.getDate()).toBe(1);
      expect(next?.getMonth()).toBe(6); // July (0-indexed)
    });

    test("finds next time for yearly cron on Jan 1st", () => {
      const schedule = new CronSchedule("0 0 1 1 *");
      const from = new Date("2024-06-15T00:00:00");
      const next = schedule.getNextTime(from);

      expect(next).not.toBeNull();
      expect(next?.getDate()).toBe(1);
      expect(next?.getMonth()).toBe(0); // January
      expect(next?.getFullYear()).toBe(2025);
    });

    test("finds next time for weekday cron (Mon-Fri)", () => {
      const schedule = new CronSchedule("0 9 * * 1-5");
      // Saturday June 15, 2024
      const from = new Date("2024-06-15T10:00:00");
      const next = schedule.getNextTime(from);

      expect(next).not.toBeNull();
      // Should be Monday June 17, 2024
      expect(next?.getDay()).toBeGreaterThanOrEqual(1);
      expect(next?.getDay()).toBeLessThanOrEqual(5);
    });

    test("finds next time with 6-field format (with seconds)", () => {
      const schedule = new CronSchedule("30 0 * * * *");
      const from = new Date("2024-06-15T10:00:00");
      const next = schedule.getNextTime(from);

      expect(next).not.toBeNull();
      expect(next?.getSeconds()).toBe(30);
    });

    test("returns null when no match within iteration limit", () => {
      // Create a schedule that will never match (Feb 31st)
      const schedule = new CronSchedule("0 0 31 2 *");
      const from = new Date("2024-01-01T00:00:00");
      const next = schedule.getNextTime(from, 100); // Very small limit

      expect(next).toBeNull();
    });

    test("starts from next minute for 5-field cron", () => {
      const schedule = new CronSchedule("* * * * *");
      const from = new Date("2024-06-15T10:30:45");
      const next = schedule.getNextTime(from);

      expect(next).not.toBeNull();
      expect(next?.getSeconds()).toBe(0);
      expect(next?.getMinutes()).toBe(31);
    });

    test("starts from next second for 6-field cron", () => {
      const schedule = new CronSchedule("* * * * * *");
      const from = new Date("2024-06-15T10:30:45");
      const next = schedule.getNextTime(from);

      expect(next).not.toBeNull();
      expect(next?.getSeconds()).toBe(46);
    });
  });
});
