import { type TimeMarker } from "../types";

const timeMarkersMapper: Record<TimeMarker, number> = {
  ms: 1,
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};
const timePeriodStringRegex = /^(\d+)\s*(ms|s|m|h|d)?$/i;

/**
 * Checks if the given value represents a valid time period.
 *
 * A valid time period can be:
 * - A number (interpreted as milliseconds).
 * - A string containing digits optionally followed by a time unit (`s`, `m`, `h`, or `d`).
 * @param value - The value to check.
 * @returns `true` if the value is a valid time period, otherwise `false`.
 */
export function isTimePeriod(value: string | number): boolean {
  if (typeof value === "number") return true;
  if (typeof value === "string") return timePeriodStringRegex.test(value.replace(/_/g, ""));
  return false;
}

/**
 * Parses a time period value and converts it to the specified unit.
 * - If the input is a number, it is returned as is.
 * - If the input is a string, it extracts the numeric value and optional time unit (`s`, `m`, `h`, `d`).
 * - Converts the extracted value to the desired unit using predefined multipliers.
 * @param value - The time period to parse, either a number or a string with an optional time unit.
 * @param resultIn - The unit to convert the result into, defaults to milliseconds.
 * @returns The parsed time value converted to the specified unit, or `NaN` if the input is invalid.
 */
export function parseTimePeriod(value: string | number, resultIn: TimeMarker = "ms"): number {
  if (typeof value === "number") return value;

  if (typeof value === "string") {
    const [, numb, pointer] = timePeriodStringRegex.exec(value.replace(/_/g, "")) ?? [];
    const timePointer = (pointer?.toLowerCase() || "ms") as TimeMarker;

    const multiplier = resultIn === timePointer ? 1 : timeMarkersMapper[timePointer] / timeMarkersMapper[resultIn];

    return Math.ceil(Number(numb) * multiplier);
  }

  return NaN;
}
