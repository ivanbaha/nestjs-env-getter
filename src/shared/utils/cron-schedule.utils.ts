/**
 * Standard 5-field cron format: minute hour day-of-month month day-of-week
 * Extended 6-field cron format: second minute hour day-of-month month day-of-week.
 *
 * Field ranges:
 * - Seconds: 0-59
 * - Minutes: 0-59
 * - Hours: 0-23
 * - Day of Month: 1-31
 * - Month: 1-12 (or JAN-DEC)
 * - Day of Week: 0-7 (0 and 7 are Sunday, or SUN-SAT).
 *
 * Special characters: * , - /.
 */

/**
 * Validates a cron field value against its allowed range.
 * @param field - The cron field string to validate.
 * @param min - The minimum allowed value.
 * @param max - The maximum allowed value.
 * @returns True if the field is valid, false otherwise.
 */
function isValidCronField(field: string, min: number, max: number): boolean {
  // Handle wildcard
  if (field === "*") return true;

  // Handle step values (e.g., */5, 1-10/2)
  const stepMatch = /^(.+)\/(\d+)$/.exec(field);
  if (stepMatch) {
    const base = stepMatch[1] as string;
    const step = stepMatch[2] as string;
    const stepNum = parseInt(step, 10);
    if (isNaN(stepNum) || stepNum < 1) return false;
    // Validate base part
    return isValidCronField(base, min, max);
  }

  // Handle ranges (e.g., 1-5)
  const rangeMatch = /^(\d+)-(\d+)$/.exec(field);
  if (rangeMatch) {
    const start = rangeMatch[1] as string;
    const end = rangeMatch[2] as string;
    const startNum = parseInt(start, 10);
    const endNum = parseInt(end, 10);
    return startNum >= min && endNum <= max && startNum <= endNum;
  }

  // Handle lists (e.g., 1,3,5)
  if (field.includes(",")) {
    const parts = field.split(",");
    return parts.every((part) => isValidCronField(part.trim(), min, max));
  }

  // Handle single numeric values
  const num = parseInt(field, 10);
  return !isNaN(num) && num >= min && num <= max;
}

/**
 * Month name to number mapping.
 */
const monthNames: Record<string, number> = {
  JAN: 1,
  FEB: 2,
  MAR: 3,
  APR: 4,
  MAY: 5,
  JUN: 6,
  JUL: 7,
  AUG: 8,
  SEP: 9,
  OCT: 10,
  NOV: 11,
  DEC: 12,
};

/**
 * Day of week name to number mapping.
 */
const dayNames: Record<string, number> = {
  SUN: 0,
  MON: 1,
  TUE: 2,
  WED: 3,
  THU: 4,
  FRI: 5,
  SAT: 6,
};

/**
 * Normalizes month names (JAN-DEC) to numbers (1-12).
 * @param field - The month field string.
 * @returns The normalized field with numbers.
 */
function normalizeMonthField(field: string): string {
  let normalized = field.toUpperCase();
  for (const [name, num] of Object.entries(monthNames)) {
    normalized = normalized.replace(new RegExp(`\\b${name}\\b`, "g"), String(num));
  }
  return normalized;
}

/**
 * Normalizes day of week names (SUN-SAT) to numbers (0-6).
 * Also normalizes 7 to 0 (both represent Sunday).
 * @param field - The day of week field string.
 * @returns The normalized field with numbers.
 */
function normalizeDayOfWeekField(field: string): string {
  let normalized = field.toUpperCase();
  for (const [name, num] of Object.entries(dayNames)) {
    normalized = normalized.replace(new RegExp(`\\b${name}\\b`, "g"), String(num));
  }
  // Normalize 7 to 0 (both represent Sunday)
  normalized = normalized.replace(/\b7\b/g, "0");
  return normalized;
}

/**
 * Checks if the given value is a valid cron expression.
 * Supports both 5-field (minute hour day-of-month month day-of-week)
 * and 6-field (second minute hour day-of-month month day-of-week) formats.
 * @param value - The cron expression string to validate.
 * @returns True if the value is a valid cron expression, false otherwise.
 */
export function isValidCronExpression(value: string): boolean {
  if (typeof value !== "string") return false;

  const fields = value.trim().split(/\s+/);

  // Must have 5 or 6 fields
  if (fields.length !== 5 && fields.length !== 6) return false;

  // Field indices and ranges based on format
  const isSixField = fields.length === 6;
  const fieldConfigs = isSixField
    ? [
        { idx: 0, min: 0, max: 59, name: "second" },
        { idx: 1, min: 0, max: 59, name: "minute" },
        { idx: 2, min: 0, max: 23, name: "hour" },
        { idx: 3, min: 1, max: 31, name: "day of month" },
        { idx: 4, min: 1, max: 12, name: "month", normalize: normalizeMonthField },
        { idx: 5, min: 0, max: 6, name: "day of week", normalize: normalizeDayOfWeekField },
      ]
    : [
        { idx: 0, min: 0, max: 59, name: "minute" },
        { idx: 1, min: 0, max: 23, name: "hour" },
        { idx: 2, min: 1, max: 31, name: "day of month" },
        { idx: 3, min: 1, max: 12, name: "month", normalize: normalizeMonthField },
        { idx: 4, min: 0, max: 6, name: "day of week", normalize: normalizeDayOfWeekField },
      ];

  for (const config of fieldConfigs) {
    let field = fields[config.idx] as string;
    if (config.normalize) {
      field = config.normalize(field);
    }
    if (!isValidCronField(field, config.min, config.max)) {
      return false;
    }
  }

  return true;
}

/**
 * Parses a cron field into an array of matching values.
 * @param field - The cron field string.
 * @param min - The minimum allowed value.
 * @param max - The maximum allowed value.
 * @returns An array of matching values.
 */
function parseCronField(field: string, min: number, max: number): number[] {
  // Handle wildcard
  if (field === "*") {
    const result: number[] = [];
    for (let i = min; i <= max; i++) {
      result.push(i);
    }
    return result;
  }

  // Handle step values (e.g., */5, 1-10/2)
  const stepMatch = /^(.+)\/(\d+)$/.exec(field);
  if (stepMatch) {
    const base = stepMatch[1] as string;
    const step = stepMatch[2] as string;
    const stepNum = parseInt(step, 10);
    const baseValues = parseCronField(base, min, max);
    const result: number[] = [];
    for (let i = 0; i < baseValues.length; i += stepNum) {
      result.push(baseValues[i] as number);
    }
    return result;
  }

  // Handle ranges (e.g., 1-5)
  const rangeMatch = /^(\d+)-(\d+)$/.exec(field);
  if (rangeMatch) {
    const start = rangeMatch[1] as string;
    const end = rangeMatch[2] as string;
    const startNum = parseInt(start, 10);
    const endNum = parseInt(end, 10);
    const result: number[] = [];
    for (let i = startNum; i <= endNum; i++) {
      result.push(i);
    }
    return result;
  }

  // Handle lists (e.g., 1,3,5)
  if (field.includes(",")) {
    const parts = field.split(",");
    const result: number[] = [];
    for (const part of parts) {
      result.push(...parseCronField(part.trim(), min, max));
    }
    return [...new Set(result)].sort((a, b) => a - b);
  }

  // Handle single numeric values
  const num = parseInt(field, 10);
  return [num];
}

/**
 * Represents a parsed cron schedule with utility methods.
 * Wraps a validated cron expression and provides methods to
 * calculate next execution time and check if a date matches the schedule.
 */
export class CronSchedule {
  private readonly expression: string;
  private readonly isSixField: boolean;
  private readonly seconds: number[];
  private readonly minutes: number[];
  private readonly hours: number[];
  private readonly daysOfMonth: number[];
  private readonly months: number[];
  private readonly daysOfWeek: number[];

  /**
   * Creates a new CronSchedule instance.
   * @param expression - The cron expression string (must be pre-validated).
   */
  constructor(expression: string) {
    this.expression = expression.trim();
    const fields = this.expression.split(/\s+/);
    this.isSixField = fields.length === 6;

    if (this.isSixField) {
      this.seconds = parseCronField(fields[0] as string, 0, 59);
      this.minutes = parseCronField(fields[1] as string, 0, 59);
      this.hours = parseCronField(fields[2] as string, 0, 23);
      this.daysOfMonth = parseCronField(fields[3] as string, 1, 31);
      this.months = parseCronField(normalizeMonthField(fields[4] as string), 1, 12);
      this.daysOfWeek = parseCronField(normalizeDayOfWeekField(fields[5] as string), 0, 6);
    } else {
      this.seconds = [0]; // Default to 0 seconds for 5-field cron
      this.minutes = parseCronField(fields[0] as string, 0, 59);
      this.hours = parseCronField(fields[1] as string, 0, 23);
      this.daysOfMonth = parseCronField(fields[2] as string, 1, 31);
      this.months = parseCronField(normalizeMonthField(fields[3] as string), 1, 12);
      this.daysOfWeek = parseCronField(normalizeDayOfWeekField(fields[4] as string), 0, 6);
    }
  }

  /**
   * Returns the original cron expression string.
   * @returns The cron expression.
   */
  toString(): string {
    return this.expression;
  }

  /**
   * Checks if the given date matches the cron schedule.
   * @param date - The date to check.
   * @returns True if the date matches the schedule, false otherwise.
   */
  isMatching(date: Date): boolean {
    const second = date.getSeconds();
    const minute = date.getMinutes();
    const hour = date.getHours();
    const dayOfMonth = date.getDate();
    const month = date.getMonth() + 1; // JavaScript months are 0-indexed
    const dayOfWeek = date.getDay();

    return (
      this.seconds.includes(second) &&
      this.minutes.includes(minute) &&
      this.hours.includes(hour) &&
      this.daysOfMonth.includes(dayOfMonth) &&
      this.months.includes(month) &&
      this.daysOfWeek.includes(dayOfWeek)
    );
  }

  /**
   * Calculates the next execution time after the given date.
   * @param from - The starting date (defaults to current time).
   * @param maxIterations - Maximum number of iterations to search (defaults to 366 days * 24 hours * 60 minutes = 527040).
   * @returns The next execution date, or null if no match found within iteration limit.
   */
  getNextTime(from: Date = new Date(), maxIterations: number = 527040): Date | null {
    // Start from the next second or minute depending on format
    const current = new Date(from.getTime());
    if (this.isSixField) {
      current.setSeconds(current.getSeconds() + 1);
      current.setMilliseconds(0);
    } else {
      current.setMinutes(current.getMinutes() + 1);
      current.setSeconds(0);
      current.setMilliseconds(0);
    }

    for (let i = 0; i < maxIterations; i++) {
      // Check month
      if (!this.months.includes(current.getMonth() + 1)) {
        // Move to next month
        current.setMonth(current.getMonth() + 1);
        current.setDate(1);
        current.setHours(0);
        current.setMinutes(0);
        current.setSeconds(0);
        continue;
      }

      // Check day of month and day of week
      const dayOfMonth = current.getDate();
      const dayOfWeek = current.getDay();
      if (!this.daysOfMonth.includes(dayOfMonth) || !this.daysOfWeek.includes(dayOfWeek)) {
        // Move to next day
        current.setDate(current.getDate() + 1);
        current.setHours(0);
        current.setMinutes(0);
        current.setSeconds(0);
        continue;
      }

      // Check hour
      if (!this.hours.includes(current.getHours())) {
        // Move to next hour
        current.setHours(current.getHours() + 1);
        current.setMinutes(0);
        current.setSeconds(0);
        continue;
      }

      // Check minute
      if (!this.minutes.includes(current.getMinutes())) {
        // Move to next minute
        current.setMinutes(current.getMinutes() + 1);
        current.setSeconds(0);
        continue;
      }

      // Check second (for 6-field cron)
      if (this.isSixField && !this.seconds.includes(current.getSeconds())) {
        // Move to next second
        current.setSeconds(current.getSeconds() + 1);
        continue;
      }

      // Found a match
      return current;
    }

    // No match found within iteration limit
    return null;
  }
}
