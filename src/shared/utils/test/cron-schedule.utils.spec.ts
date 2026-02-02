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

    test("returns false for impossible day/month combinations", () => {
      // February 31st - impossible
      expect(isValidCronExpression("0 0 31 2 *")).toBe(false);
      // February 30th - impossible
      expect(isValidCronExpression("0 0 30 2 *")).toBe(false);
      // February 30th and 31st - both impossible
      expect(isValidCronExpression("0 0 30,31 2 *")).toBe(false);
      // April 31st - impossible (April has 30 days)
      expect(isValidCronExpression("0 0 31 4 *")).toBe(false);
      // June 31st - impossible
      expect(isValidCronExpression("0 0 31 6 *")).toBe(false);
      // September 31st - impossible
      expect(isValidCronExpression("0 0 31 9 *")).toBe(false);
      // November 31st - impossible
      expect(isValidCronExpression("0 0 31 11 *")).toBe(false);
      // Day 31 on all 30-day months - impossible
      expect(isValidCronExpression("0 0 31 4,6,9,11 *")).toBe(false);
      // 6-field format: February 31st - impossible
      expect(isValidCronExpression("0 0 0 31 2 *")).toBe(false);
    });

    test("returns true for possible day/month combinations", () => {
      // February 29th - possible (leap year)
      expect(isValidCronExpression("0 0 29 2 *")).toBe(true);
      // Day 31 on January - possible
      expect(isValidCronExpression("0 0 31 1 *")).toBe(true);
      // Day 31 on mixed months (Jan and Feb) - possible because Jan 31st exists
      expect(isValidCronExpression("0 0 31 1,2 *")).toBe(true);
      // Day 30 on April - possible
      expect(isValidCronExpression("0 0 30 4 *")).toBe(true);
      // Day 31 with wildcard month - possible
      expect(isValidCronExpression("0 0 31 * *")).toBe(true);
    });

    test("returns true when day-of-week is specified (OR logic applies)", () => {
      // February 31st with Monday - valid because Mondays in February will match
      expect(isValidCronExpression("0 0 31 2 1")).toBe(true);
      // April 31st with Friday - valid because Fridays in April will match
      expect(isValidCronExpression("0 0 31 4 5")).toBe(true);
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

    test("uses OR logic when both day-of-month and day-of-week are specified", () => {
      // "0 0 15 * 1" means: run at midnight on the 15th OR any Monday
      const schedule = new CronSchedule("0 0 15 * 1");

      // June 15, 2024 is a Saturday (day 15, not Monday) - should match (day-of-month matches)
      const day15Saturday = new Date("2024-06-15T00:00:00");
      expect(schedule.isMatching(day15Saturday)).toBe(true);

      // June 17, 2024 is a Monday (day 17, not 15) - should match (day-of-week matches)
      const day17Monday = new Date("2024-06-17T00:00:00");
      expect(schedule.isMatching(day17Monday)).toBe(true);

      // June 16, 2024 is a Sunday (day 16, not 15, not Monday) - should not match
      const day16Sunday = new Date("2024-06-16T00:00:00");
      expect(schedule.isMatching(day16Sunday)).toBe(false);
    });

    test("uses only day-of-month when day-of-week is wildcard", () => {
      // "0 0 15 * *" means: run at midnight on the 15th of every month
      const schedule = new CronSchedule("0 0 15 * *");

      // June 15, 2024 (Saturday) - should match
      expect(schedule.isMatching(new Date("2024-06-15T00:00:00"))).toBe(true);

      // June 17, 2024 (Monday) - should not match (not the 15th)
      expect(schedule.isMatching(new Date("2024-06-17T00:00:00"))).toBe(false);
    });

    test("uses only day-of-week when day-of-month is wildcard", () => {
      // "0 0 * * 1" means: run at midnight every Monday
      const schedule = new CronSchedule("0 0 * * 1");

      // June 17, 2024 (Monday) - should match
      expect(schedule.isMatching(new Date("2024-06-17T00:00:00"))).toBe(true);

      // June 15, 2024 (Saturday) - should not match
      expect(schedule.isMatching(new Date("2024-06-15T00:00:00"))).toBe(false);
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

  describe("getPrevTime", () => {
    test("finds previous time for hourly cron at minute 0", () => {
      const schedule = new CronSchedule("0 * * * *");
      const from = new Date("2024-06-15T10:30:00");
      const prev = schedule.getPrevTime(from);

      expect(prev).not.toBeNull();
      expect(prev?.getMinutes()).toBe(0);
      expect(prev?.getHours()).toBe(10);
    });

    test("finds previous time for daily cron at 2:00 AM", () => {
      const schedule = new CronSchedule("0 2 * * *");
      const from = new Date("2024-06-15T01:00:00");
      const prev = schedule.getPrevTime(from);

      expect(prev).not.toBeNull();
      expect(prev?.getMinutes()).toBe(0);
      expect(prev?.getHours()).toBe(2);
      expect(prev?.getDate()).toBe(14);
    });

    test("finds previous time for monthly cron on the 1st", () => {
      const schedule = new CronSchedule("0 0 1 * *");
      const from = new Date("2024-06-15T00:00:00");
      const prev = schedule.getPrevTime(from);

      expect(prev).not.toBeNull();
      expect(prev?.getDate()).toBe(1);
      expect(prev?.getMonth()).toBe(5); // June (0-indexed)
    });

    test("finds previous time for yearly cron on Jan 1st", () => {
      const schedule = new CronSchedule("0 0 1 1 *");
      const from = new Date("2024-06-15T00:00:00");
      const prev = schedule.getPrevTime(from);

      expect(prev).not.toBeNull();
      expect(prev?.getDate()).toBe(1);
      expect(prev?.getMonth()).toBe(0); // January
      expect(prev?.getFullYear()).toBe(2024);
    });

    test("finds previous time for weekday cron (Mon-Fri)", () => {
      const schedule = new CronSchedule("0 9 * * 1-5");
      // Sunday June 16, 2024
      const from = new Date("2024-06-16T08:00:00");
      const prev = schedule.getPrevTime(from);

      expect(prev).not.toBeNull();
      // Should be Friday June 14, 2024
      expect(prev?.getDay()).toBeGreaterThanOrEqual(1);
      expect(prev?.getDay()).toBeLessThanOrEqual(5);
    });

    test("finds previous time with 6-field format (with seconds)", () => {
      const schedule = new CronSchedule("30 0 * * * *");
      const from = new Date("2024-06-15T10:00:45");
      const prev = schedule.getPrevTime(from);

      expect(prev).not.toBeNull();
      expect(prev?.getSeconds()).toBe(30);
    });

    test("returns null when no match within iteration limit", () => {
      // Create a schedule that will never match (Feb 31st)
      const schedule = new CronSchedule("0 0 31 2 *");
      const from = new Date("2024-12-31T23:59:59");
      const prev = schedule.getPrevTime(from, 100); // Very small limit

      expect(prev).toBeNull();
    });

    test("starts from previous minute for 5-field cron", () => {
      const schedule = new CronSchedule("* * * * *");
      const from = new Date("2024-06-15T10:30:45");
      const prev = schedule.getPrevTime(from);

      expect(prev).not.toBeNull();
      expect(prev?.getSeconds()).toBe(0);
      expect(prev?.getMinutes()).toBe(29);
    });

    test("starts from previous second for 6-field cron", () => {
      const schedule = new CronSchedule("* * * * * *");
      const from = new Date("2024-06-15T10:30:45");
      const prev = schedule.getPrevTime(from);

      expect(prev).not.toBeNull();
      expect(prev?.getSeconds()).toBe(44);
    });

    test("finds previous time crossing month boundary", () => {
      const schedule = new CronSchedule("0 0 15 * *");
      const from = new Date("2024-07-01T00:00:00");
      const prev = schedule.getPrevTime(from);

      expect(prev).not.toBeNull();
      expect(prev?.getDate()).toBe(15);
      expect(prev?.getMonth()).toBe(5); // June (0-indexed)
    });

    test("finds previous time crossing year boundary", () => {
      const schedule = new CronSchedule("0 0 25 12 *");
      const from = new Date("2024-01-15T00:00:00");
      const prev = schedule.getPrevTime(from);

      expect(prev).not.toBeNull();
      expect(prev?.getDate()).toBe(25);
      expect(prev?.getMonth()).toBe(11); // December
      expect(prev?.getFullYear()).toBe(2023);
    });

    test("uses OR logic when both day-of-month and day-of-week are specified", () => {
      // "0 0 15 * 1" means: run at midnight on the 15th OR any Monday
      const schedule = new CronSchedule("0 0 15 * 1");

      // From June 18, 2024 (Tuesday), looking back
      const from = new Date("2024-06-18T12:00:00");
      const prev = schedule.getPrevTime(from);

      expect(prev).not.toBeNull();
      // Should find June 17 (Monday) at midnight
      expect(prev?.getDate()).toBe(17);
      expect(prev?.getDay()).toBe(1); // Monday
    });

    test("finds previous time with step values", () => {
      const schedule = new CronSchedule("*/15 * * * *");
      const from = new Date("2024-06-15T10:50:00");
      const prev = schedule.getPrevTime(from);

      expect(prev).not.toBeNull();
      expect(prev?.getMinutes()).toBe(45);
    });

    test("finds previous time with list values", () => {
      const schedule = new CronSchedule("0,30 * * * *");
      const from = new Date("2024-06-15T10:15:00");
      const prev = schedule.getPrevTime(from);

      expect(prev).not.toBeNull();
      expect(prev?.getMinutes()).toBe(0);
    });
  });
});
