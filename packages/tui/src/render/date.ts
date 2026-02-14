/**
 * Date range parsing utilities.
 *
 * Provides utilities for parsing date range strings into structured DateRange objects.
 * Supports named ranges (today, yesterday, last week, last month), explicit ranges
 * (YYYY-MM-DD..YYYY-MM-DD), and single dates (YYYY-MM-DD).
 *
 * @packageDocumentation
 */

import { Result, ValidationError } from "@outfitter/contracts";

/**
 * Represents a date range with start and end dates.
 */
export interface DateRange {
  /** Start of the range (inclusive, at 00:00:00.000) */
  start: Date;
  /** End of the range (inclusive, at 23:59:59.999) */
  end: Date;
}

/** ISO date format regex: YYYY-MM-DD */
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/** Named range keywords (lowercase) */
const NAMED_RANGES = ["today", "yesterday", "last week", "last month"] as const;

type NamedRange = (typeof NAMED_RANGES)[number];

/**
 * Returns a new Date set to the start of the day (00:00:00.000).
 *
 * @param date - The date to adjust
 * @returns A new Date object at 00:00:00.000 on the same day
 *
 * @example
 * ```typescript
 * startOfDay(new Date("2024-06-15T14:30:00Z"))
 * // Returns 2024-06-15T00:00:00.000 (local time)
 * ```
 */
export function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

/**
 * Returns a new Date set to the end of the day (23:59:59.999).
 *
 * @param date - The date to adjust
 * @returns A new Date object at 23:59:59.999 on the same day
 *
 * @example
 * ```typescript
 * endOfDay(new Date("2024-06-15T14:30:00Z"))
 * // Returns 2024-06-15T23:59:59.999 (local time)
 * ```
 */
export function endOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

/**
 * Checks if a string is a valid named range.
 */
function isNamedRange(input: string): input is NamedRange {
  return NAMED_RANGES.includes(input as NamedRange);
}

/**
 * Parses a named range into a DateRange.
 */
function parseNamedRange(name: NamedRange): DateRange {
  const now = new Date(Date.now());

  switch (name) {
    case "today": {
      return {
        start: startOfDay(now),
        end: endOfDay(now),
      };
    }
    case "yesterday": {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      return {
        start: startOfDay(yesterday),
        end: endOfDay(yesterday),
      };
    }
    case "last week": {
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return {
        start: startOfDay(weekAgo),
        end: endOfDay(now),
      };
    }
    case "last month": {
      const monthAgo = new Date(now);
      monthAgo.setDate(monthAgo.getDate() - 30);
      return {
        start: startOfDay(monthAgo),
        end: endOfDay(now),
      };
    }
    default: {
      // Exhaustive check: all NamedRange cases are handled above
      const _exhaustive: never = name;
      throw new Error(`Unhandled named range: ${_exhaustive}`);
    }
  }
}

/**
 * Parses a YYYY-MM-DD string into a Date, validating the date is real.
 * Returns null if the date is invalid.
 */
function parseIsoDate(dateStr: string): Date | null {
  if (!ISO_DATE_REGEX.test(dateStr)) {
    return null;
  }

  // Parse components manually to avoid timezone issues
  const parts = dateStr.split("-");
  const yearStr = parts[0];
  const monthStr = parts[1];
  const dayStr = parts[2];

  if (yearStr === undefined || monthStr === undefined || dayStr === undefined) {
    return null;
  }

  const year = Number.parseInt(yearStr, 10);
  const month = Number.parseInt(monthStr, 10) - 1; // JS months are 0-indexed
  const day = Number.parseInt(dayStr, 10);

  // Create date and verify it's valid (e.g., 2024-02-30 would become 2024-03-01)
  const date = new Date(year, month, day);

  // Validate the date didn't overflow (e.g., Feb 30 becoming Mar 2)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

/**
 * Parses date range strings into structured DateRange.
 *
 * Supported formats:
 * - `"today"` - Current day (00:00:00 to 23:59:59)
 * - `"yesterday"` - Previous day
 * - `"last week"` - Last 7 days
 * - `"last month"` - Last 30 days
 * - `"2024-01-01..2024-12-31"` - Explicit range
 * - `"2024-01-01"` - Single day
 *
 * @param input - The date range string to parse
 * @returns Result containing DateRange on success, or ValidationError on failure
 *
 * @example
 * ```typescript
 * parseDateRange("today")
 * // Ok({ start: today 00:00, end: today 23:59:59 })
 *
 * parseDateRange("2024-01-01..2024-12-31")
 * // Ok({ start: 2024-01-01 00:00, end: 2024-12-31 23:59:59 })
 *
 * parseDateRange("invalid")
 * // Err(ValidationError)
 * ```
 */
export function parseDateRange(
  input: string
): Result<DateRange, InstanceType<typeof ValidationError>> {
  // Trim whitespace
  const trimmed = input.trim();

  // Check for empty input
  if (trimmed === "") {
    return Result.err(
      new ValidationError({
        message: "Date range input cannot be empty",
        field: "dateRange",
      })
    );
  }

  // Normalize to lowercase for named range matching
  const normalized = trimmed.toLowerCase();

  // Try named ranges first
  if (isNamedRange(normalized)) {
    return Result.ok(parseNamedRange(normalized));
  }

  // Check for explicit range (YYYY-MM-DD..YYYY-MM-DD)
  if (trimmed.includes("..")) {
    const parts = trimmed.split("..");

    // Validate we have exactly two parts
    if (parts.length !== 2 || parts[0] === "" || parts[1] === "") {
      return Result.err(
        new ValidationError({
          message:
            'Invalid date range format. Expected "YYYY-MM-DD..YYYY-MM-DD"',
          field: "dateRange",
        })
      );
    }

    const startStr = parts[0];
    const endStr = parts[1];

    // Already validated parts.length === 2 above, but satisfy the linter
    if (startStr === undefined || endStr === undefined) {
      return Result.err(
        new ValidationError({
          message:
            'Invalid date range format. Expected "YYYY-MM-DD..YYYY-MM-DD"',
          field: "dateRange",
        })
      );
    }

    const startDate = parseIsoDate(startStr);
    const endDate = parseIsoDate(endStr);

    if (startDate === null) {
      return Result.err(
        new ValidationError({
          message: `Invalid start date: "${startStr}". Expected format: YYYY-MM-DD`,
          field: "dateRange",
        })
      );
    }

    if (endDate === null) {
      return Result.err(
        new ValidationError({
          message: `Invalid end date: "${endStr}". Expected format: YYYY-MM-DD`,
          field: "dateRange",
        })
      );
    }

    // Validate start <= end
    if (startDate.getTime() > endDate.getTime()) {
      return Result.err(
        new ValidationError({
          message:
            "Invalid date range: start date must be before or equal to end date",
          field: "dateRange",
        })
      );
    }

    return Result.ok({
      start: startOfDay(startDate),
      end: endOfDay(endDate),
    });
  }

  // Try single date (YYYY-MM-DD)
  const singleDate = parseIsoDate(trimmed);
  if (singleDate !== null) {
    return Result.ok({
      start: startOfDay(singleDate),
      end: endOfDay(singleDate),
    });
  }

  // Unrecognized input
  return Result.err(
    new ValidationError({
      message: `Unrecognized date range: "${trimmed}". Expected "today", "yesterday", "last week", "last month", "YYYY-MM-DD", or "YYYY-MM-DD..YYYY-MM-DD"`,
      field: "dateRange",
    })
  );
}
