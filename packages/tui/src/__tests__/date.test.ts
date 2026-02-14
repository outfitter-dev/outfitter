/**
 * Tests for parseDateRange()
 *
 * TDD RED PHASE: These tests define expected behavior for date range parsing.
 */
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { endOfDay, parseDateRange, startOfDay } from "../render/date.js";

// ============================================================================
// Helper Function Tests
// ============================================================================

describe("startOfDay()", () => {
  it("returns date at 00:00:00.000", () => {
    const date = new Date("2024-06-15T14:30:45.123Z");
    const result = startOfDay(date);

    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
    expect(result.getSeconds()).toBe(0);
    expect(result.getMilliseconds()).toBe(0);
  });

  it("preserves the date", () => {
    const date = new Date("2024-06-15T14:30:45.123Z");
    const result = startOfDay(date);

    expect(result.getFullYear()).toBe(date.getFullYear());
    expect(result.getMonth()).toBe(date.getMonth());
    expect(result.getDate()).toBe(date.getDate());
  });

  it("does not mutate the original date", () => {
    const date = new Date("2024-06-15T14:30:45.123Z");
    const originalTime = date.getTime();

    startOfDay(date);

    expect(date.getTime()).toBe(originalTime);
  });
});

describe("endOfDay()", () => {
  it("returns date at 23:59:59.999", () => {
    const date = new Date("2024-06-15T14:30:45.123Z");
    const result = endOfDay(date);

    expect(result.getHours()).toBe(23);
    expect(result.getMinutes()).toBe(59);
    expect(result.getSeconds()).toBe(59);
    expect(result.getMilliseconds()).toBe(999);
  });

  it("preserves the date", () => {
    const date = new Date("2024-06-15T14:30:45.123Z");
    const result = endOfDay(date);

    expect(result.getFullYear()).toBe(date.getFullYear());
    expect(result.getMonth()).toBe(date.getMonth());
    expect(result.getDate()).toBe(date.getDate());
  });

  it("does not mutate the original date", () => {
    const date = new Date("2024-06-15T14:30:45.123Z");
    const originalTime = date.getTime();

    endOfDay(date);

    expect(date.getTime()).toBe(originalTime);
  });
});

// ============================================================================
// parseDateRange() Tests
// ============================================================================

describe("parseDateRange()", () => {
  let originalNow: typeof Date.now;
  let fixedNow: Date;

  beforeEach(() => {
    // Fix "now" to 2024-06-15 12:00:00 UTC for predictable tests
    originalNow = Date.now;
    fixedNow = new Date("2024-06-15T12:00:00.000Z");
    Date.now = () => fixedNow.getTime();
  });

  afterEach(() => {
    Date.now = originalNow;
  });

  // ==========================================================================
  // Named Ranges
  // ==========================================================================

  describe("named ranges", () => {
    it('parses "today" as current day', () => {
      const result = parseDateRange("today");

      expect(result.isOk()).toBe(true);
      const range = result.unwrap();

      // Start should be 00:00:00.000 on 2024-06-15 (local time)
      expect(range.start.getFullYear()).toBe(2024);
      expect(range.start.getMonth()).toBe(5); // June is 5 (0-indexed)
      expect(range.start.getDate()).toBe(15);
      expect(range.start.getHours()).toBe(0);
      expect(range.start.getMinutes()).toBe(0);
      expect(range.start.getSeconds()).toBe(0);
      expect(range.start.getMilliseconds()).toBe(0);

      // End should be 23:59:59.999 on same day
      expect(range.end.getHours()).toBe(23);
      expect(range.end.getMinutes()).toBe(59);
      expect(range.end.getSeconds()).toBe(59);
      expect(range.end.getMilliseconds()).toBe(999);
    });

    it('parses "yesterday" as previous day', () => {
      const result = parseDateRange("yesterday");

      expect(result.isOk()).toBe(true);
      const range = result.unwrap();

      // Should be 2024-06-14
      expect(range.start.getFullYear()).toBe(2024);
      expect(range.start.getMonth()).toBe(5);
      expect(range.start.getDate()).toBe(14);
      expect(range.start.getHours()).toBe(0);

      expect(range.end.getDate()).toBe(14);
      expect(range.end.getHours()).toBe(23);
      expect(range.end.getMinutes()).toBe(59);
    });

    it('parses "last week" as last 7 days', () => {
      const result = parseDateRange("last week");

      expect(result.isOk()).toBe(true);
      const range = result.unwrap();

      // Start should be 7 days ago (2024-06-08) at 00:00:00
      expect(range.start.getFullYear()).toBe(2024);
      expect(range.start.getMonth()).toBe(5);
      expect(range.start.getDate()).toBe(8);
      expect(range.start.getHours()).toBe(0);

      // End should be today at 23:59:59.999
      expect(range.end.getFullYear()).toBe(2024);
      expect(range.end.getMonth()).toBe(5);
      expect(range.end.getDate()).toBe(15);
      expect(range.end.getHours()).toBe(23);
      expect(range.end.getMinutes()).toBe(59);
    });

    it('parses "last month" as last 30 days', () => {
      const result = parseDateRange("last month");

      expect(result.isOk()).toBe(true);
      const range = result.unwrap();

      // Start should be 30 days ago (2024-05-16) at 00:00:00
      expect(range.start.getFullYear()).toBe(2024);
      expect(range.start.getMonth()).toBe(4); // May is 4 (0-indexed)
      expect(range.start.getDate()).toBe(16);
      expect(range.start.getHours()).toBe(0);

      // End should be today at 23:59:59.999
      expect(range.end.getFullYear()).toBe(2024);
      expect(range.end.getMonth()).toBe(5);
      expect(range.end.getDate()).toBe(15);
      expect(range.end.getHours()).toBe(23);
    });

    it("handles case-insensitive named ranges", () => {
      expect(parseDateRange("TODAY").isOk()).toBe(true);
      expect(parseDateRange("Today").isOk()).toBe(true);
      expect(parseDateRange("YESTERDAY").isOk()).toBe(true);
      expect(parseDateRange("Last Week").isOk()).toBe(true);
      expect(parseDateRange("LAST MONTH").isOk()).toBe(true);
    });
  });

  // ==========================================================================
  // Explicit Range (YYYY-MM-DD..YYYY-MM-DD)
  // ==========================================================================

  describe("explicit range", () => {
    it("parses valid date range with .. separator", () => {
      const result = parseDateRange("2024-01-01..2024-12-31");

      expect(result.isOk()).toBe(true);
      const range = result.unwrap();

      // Start: 2024-01-01 00:00:00.000
      expect(range.start.getFullYear()).toBe(2024);
      expect(range.start.getMonth()).toBe(0);
      expect(range.start.getDate()).toBe(1);
      expect(range.start.getHours()).toBe(0);
      expect(range.start.getMinutes()).toBe(0);

      // End: 2024-12-31 23:59:59.999
      expect(range.end.getFullYear()).toBe(2024);
      expect(range.end.getMonth()).toBe(11);
      expect(range.end.getDate()).toBe(31);
      expect(range.end.getHours()).toBe(23);
      expect(range.end.getMinutes()).toBe(59);
    });

    it("parses same-day range", () => {
      const result = parseDateRange("2024-06-15..2024-06-15");

      expect(result.isOk()).toBe(true);
      const range = result.unwrap();

      expect(range.start.getFullYear()).toBe(2024);
      expect(range.start.getMonth()).toBe(5);
      expect(range.start.getDate()).toBe(15);

      expect(range.end.getFullYear()).toBe(2024);
      expect(range.end.getMonth()).toBe(5);
      expect(range.end.getDate()).toBe(15);
    });

    it("returns error when start > end", () => {
      const result = parseDateRange("2024-12-31..2024-01-01");

      expect(result.isErr()).toBe(true);
      const error = result.error;
      expect(error?._tag).toBe("ValidationError");
      expect(error?.message).toContain("start date must be before");
    });

    it("returns error for invalid start date in range", () => {
      const result = parseDateRange("invalid..2024-12-31");

      expect(result.isErr()).toBe(true);
      const error = result.error;
      expect(error?._tag).toBe("ValidationError");
      expect(error?.message).toContain("Invalid start date");
    });

    it("returns error for invalid end date in range", () => {
      const result = parseDateRange("2024-01-01..invalid");

      expect(result.isErr()).toBe(true);
      const error = result.error;
      expect(error?._tag).toBe("ValidationError");
      expect(error?.message).toContain("Invalid end date");
    });

    it("handles ranges crossing year boundaries", () => {
      const result = parseDateRange("2023-12-01..2024-01-31");

      expect(result.isOk()).toBe(true);
      const range = result.unwrap();

      expect(range.start.getFullYear()).toBe(2023);
      expect(range.end.getFullYear()).toBe(2024);
    });
  });

  // ==========================================================================
  // Single Date (YYYY-MM-DD)
  // ==========================================================================

  describe("single date", () => {
    it("parses valid single date", () => {
      const result = parseDateRange("2024-06-15");

      expect(result.isOk()).toBe(true);
      const range = result.unwrap();

      // Start: 2024-06-15 00:00:00.000
      expect(range.start.getFullYear()).toBe(2024);
      expect(range.start.getMonth()).toBe(5);
      expect(range.start.getDate()).toBe(15);
      expect(range.start.getHours()).toBe(0);
      expect(range.start.getMinutes()).toBe(0);

      // End: 2024-06-15 23:59:59.999
      expect(range.end.getFullYear()).toBe(2024);
      expect(range.end.getMonth()).toBe(5);
      expect(range.end.getDate()).toBe(15);
      expect(range.end.getHours()).toBe(23);
      expect(range.end.getMinutes()).toBe(59);
    });

    it("returns error for invalid single date", () => {
      const result = parseDateRange("2024-13-45");

      expect(result.isErr()).toBe(true);
      const error = result.error;
      expect(error?._tag).toBe("ValidationError");
    });

    it("returns error for malformed date format", () => {
      const result = parseDateRange("06-15-2024");

      expect(result.isErr()).toBe(true);
      const error = result.error;
      expect(error?._tag).toBe("ValidationError");
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe("edge cases", () => {
    it("returns error for empty string", () => {
      const result = parseDateRange("");

      expect(result.isErr()).toBe(true);
      const error = result.error;
      expect(error?._tag).toBe("ValidationError");
      expect(error?.message).toContain("cannot be empty");
    });

    it("returns error for whitespace-only string", () => {
      const result = parseDateRange("   ");

      expect(result.isErr()).toBe(true);
      const error = result.error;
      expect(error?._tag).toBe("ValidationError");
    });

    it("trims whitespace from input", () => {
      const result = parseDateRange("  today  ");

      expect(result.isOk()).toBe(true);
    });

    it("returns error for unrecognized input", () => {
      const result = parseDateRange("invalid");

      expect(result.isErr()).toBe(true);
      const error = result.error;
      expect(error?._tag).toBe("ValidationError");
    });

    it("returns error for partial range with single dot", () => {
      const result = parseDateRange("2024-01-01.2024-12-31");

      expect(result.isErr()).toBe(true);
    });

    it("returns error for incomplete range", () => {
      const result = parseDateRange("2024-01-01..");

      expect(result.isErr()).toBe(true);
    });

    it("returns error for range with only separator", () => {
      const result = parseDateRange("..");

      expect(result.isErr()).toBe(true);
    });

    it("handles leap year date", () => {
      const result = parseDateRange("2024-02-29");

      expect(result.isOk()).toBe(true);
      const range = result.unwrap();
      expect(range.start.getFullYear()).toBe(2024);
      expect(range.start.getMonth()).toBe(1);
      expect(range.start.getDate()).toBe(29);
    });

    it("returns error for invalid leap year date", () => {
      const result = parseDateRange("2023-02-29");

      expect(result.isErr()).toBe(true);
    });
  });

  // ==========================================================================
  // Type Safety
  // ==========================================================================

  describe("type safety", () => {
    it("returns DateRange with Date objects", () => {
      const result = parseDateRange("today");

      expect(result.isOk()).toBe(true);
      const range = result.unwrap();

      expect(range.start).toBeInstanceOf(Date);
      expect(range.end).toBeInstanceOf(Date);
    });

    it("returns ValidationError on failure", () => {
      const result = parseDateRange("invalid");

      expect(result.isErr()).toBe(true);
      const error = result.error;

      expect(error?._tag).toBe("ValidationError");
      expect(typeof error?.message).toBe("string");
    });
  });
});
