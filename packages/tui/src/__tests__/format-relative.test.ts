/**
 * Tests for formatRelative()
 *
 * TDD RED PHASE: These tests define expected behavior for relative time formatting.
 */
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { formatRelative } from "../render/index.js";

// ============================================================================
// Time Constants for Testing
// ============================================================================

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

// ============================================================================
// formatRelative() Tests
// ============================================================================

describe("formatRelative()", () => {
  let originalNow: typeof Date.now;
  let fixedNow: number;

  beforeEach(() => {
    originalNow = Date.now;
    fixedNow = Date.now();
    Date.now = () => fixedNow;
  });

  afterEach(() => {
    Date.now = originalNow;
  });

  describe("past times", () => {
    it("returns 'just now' for times less than 10 seconds ago", () => {
      const now = Date.now();
      expect(formatRelative(now)).toBe("just now");
      expect(formatRelative(now - 5 * SECOND)).toBe("just now");
      expect(formatRelative(now - 9 * SECOND)).toBe("just now");
    });

    it("returns seconds ago for times between 10-59 seconds", () => {
      const now = Date.now();
      expect(formatRelative(now - 10 * SECOND)).toBe("10 seconds ago");
      expect(formatRelative(now - 30 * SECOND)).toBe("30 seconds ago");
      expect(formatRelative(now - 59 * SECOND)).toBe("59 seconds ago");
    });

    it("returns '1 minute ago' for times around 1 minute", () => {
      const now = Date.now();
      expect(formatRelative(now - 60 * SECOND)).toBe("1 minute ago");
      expect(formatRelative(now - 90 * SECOND)).toBe("1 minute ago");
    });

    it("returns minutes ago for times between 2-59 minutes", () => {
      const now = Date.now();
      expect(formatRelative(now - 2 * MINUTE)).toBe("2 minutes ago");
      expect(formatRelative(now - 30 * MINUTE)).toBe("30 minutes ago");
      expect(formatRelative(now - 59 * MINUTE)).toBe("59 minutes ago");
    });

    it("returns '1 hour ago' for times around 1 hour", () => {
      const now = Date.now();
      expect(formatRelative(now - 60 * MINUTE)).toBe("1 hour ago");
      expect(formatRelative(now - 90 * MINUTE)).toBe("1 hour ago");
    });

    it("returns hours ago for times between 2-23 hours", () => {
      const now = Date.now();
      expect(formatRelative(now - 2 * HOUR)).toBe("2 hours ago");
      expect(formatRelative(now - 12 * HOUR)).toBe("12 hours ago");
      expect(formatRelative(now - 23 * HOUR)).toBe("23 hours ago");
    });

    it("returns 'yesterday' for times between 24-47 hours ago", () => {
      const now = Date.now();
      expect(formatRelative(now - 24 * HOUR)).toBe("yesterday");
      expect(formatRelative(now - 36 * HOUR)).toBe("yesterday");
      expect(formatRelative(now - 47 * HOUR)).toBe("yesterday");
    });

    it("returns days ago for times between 2-6 days", () => {
      const now = Date.now();
      expect(formatRelative(now - 2 * DAY)).toBe("2 days ago");
      expect(formatRelative(now - 5 * DAY)).toBe("5 days ago");
      expect(formatRelative(now - 6 * DAY)).toBe("6 days ago");
    });

    it("returns days ago for times between 7-29 days", () => {
      const now = Date.now();
      expect(formatRelative(now - 7 * DAY)).toBe("7 days ago");
      expect(formatRelative(now - 14 * DAY)).toBe("14 days ago");
      expect(formatRelative(now - 29 * DAY)).toBe("29 days ago");
    });

    it("returns '1 month ago' for times around 1 month", () => {
      const now = Date.now();
      expect(formatRelative(now - 30 * DAY)).toBe("1 month ago");
      expect(formatRelative(now - 45 * DAY)).toBe("1 month ago");
    });

    it("returns months ago for times between 2-11 months", () => {
      const now = Date.now();
      expect(formatRelative(now - 2 * MONTH)).toBe("2 months ago");
      expect(formatRelative(now - 6 * MONTH)).toBe("6 months ago");
      expect(formatRelative(now - 11 * MONTH)).toBe("11 months ago");
    });

    it("returns '1 year ago' for times around 1 year", () => {
      const now = Date.now();
      expect(formatRelative(now - 365 * DAY)).toBe("1 year ago");
      expect(formatRelative(now - 500 * DAY)).toBe("1 year ago");
    });

    it("returns years ago for times more than 2 years", () => {
      const now = Date.now();
      expect(formatRelative(now - 2 * YEAR)).toBe("2 years ago");
      expect(formatRelative(now - 5 * YEAR)).toBe("5 years ago");
    });
  });

  describe("future times", () => {
    it("returns 'just now' for times less than 10 seconds in the future", () => {
      const now = Date.now();
      expect(formatRelative(now + 5 * SECOND)).toBe("just now");
    });

    it("returns 'in X seconds' for times 10-59 seconds in the future", () => {
      const now = Date.now();
      expect(formatRelative(now + 30 * SECOND)).toBe("in 30 seconds");
    });

    it("returns 'in 1 minute' for times around 1 minute in the future", () => {
      const now = Date.now();
      expect(formatRelative(now + 60 * SECOND)).toBe("in 1 minute");
    });

    it("returns 'in X minutes' for times 2-59 minutes in the future", () => {
      const now = Date.now();
      expect(formatRelative(now + 5 * MINUTE)).toBe("in 5 minutes");
      expect(formatRelative(now + 30 * MINUTE)).toBe("in 30 minutes");
    });

    it("returns 'in 1 hour' for times around 1 hour in the future", () => {
      const now = Date.now();
      expect(formatRelative(now + 60 * MINUTE)).toBe("in 1 hour");
    });

    it("returns 'in X hours' for times 2-23 hours in the future", () => {
      const now = Date.now();
      expect(formatRelative(now + 5 * HOUR)).toBe("in 5 hours");
    });

    it("returns 'tomorrow' for times 24-47 hours in the future", () => {
      const now = Date.now();
      expect(formatRelative(now + 24 * HOUR)).toBe("tomorrow");
      expect(formatRelative(now + 36 * HOUR)).toBe("tomorrow");
    });

    it("returns 'in X days' for times 2+ days in the future", () => {
      const now = Date.now();
      expect(formatRelative(now + 3 * DAY)).toBe("in 3 days");
      expect(formatRelative(now + 7 * DAY)).toBe("in 7 days");
    });

    it("returns 'in 1 month' for times around 1 month in the future", () => {
      const now = Date.now();
      expect(formatRelative(now + 30 * DAY)).toBe("in 1 month");
    });

    it("returns 'in X months' for times 2-11 months in the future", () => {
      const now = Date.now();
      expect(formatRelative(now + 3 * MONTH)).toBe("in 3 months");
    });

    it("returns 'in 1 year' for times around 1 year in the future", () => {
      const now = Date.now();
      expect(formatRelative(now + 365 * DAY)).toBe("in 1 year");
    });

    it("returns 'in X years' for times 2+ years in the future", () => {
      const now = Date.now();
      expect(formatRelative(now + 2 * YEAR)).toBe("in 2 years");
    });
  });

  describe("input types", () => {
    it("accepts Date objects", () => {
      const date = new Date();
      const result = formatRelative(date);
      expect(result).toBe("just now");
    });

    it("accepts timestamp numbers", () => {
      const timestamp = Date.now() - 5 * MINUTE;
      const result = formatRelative(timestamp);
      expect(result).toBe("5 minutes ago");
    });

    it("accepts ISO string dates", () => {
      const isoString = new Date(Date.now() - 2 * HOUR).toISOString();
      const result = formatRelative(isoString);
      expect(result).toBe("2 hours ago");
    });
  });

  describe("edge cases", () => {
    it("handles exact boundary at 10 seconds", () => {
      const now = Date.now();
      // At exactly 10 seconds, should show "10 seconds ago" not "just now"
      expect(formatRelative(now - 10 * SECOND)).toBe("10 seconds ago");
    });

    it("handles exact boundary at 60 seconds", () => {
      const now = Date.now();
      // At exactly 60 seconds, should show "1 minute ago"
      expect(formatRelative(now - 60 * SECOND)).toBe("1 minute ago");
    });

    it("handles exact boundary at 24 hours", () => {
      const now = Date.now();
      // At exactly 24 hours, should show "yesterday"
      expect(formatRelative(now - 24 * HOUR)).toBe("yesterday");
    });

    it("handles exact boundary at 48 hours", () => {
      const now = Date.now();
      // At exactly 48 hours, should show "2 days ago"
      expect(formatRelative(now - 48 * HOUR)).toBe("2 days ago");
    });

    it("handles invalid date strings gracefully", () => {
      // Should not throw for invalid input
      const result = formatRelative("invalid-date");
      expect(typeof result).toBe("string");
    });

    it("returns 'invalid date' for invalid Date objects", () => {
      const result = formatRelative(new Date("invalid"));
      expect(result).toBe("invalid date");
    });

    it("returns 'invalid date' for non-finite timestamps", () => {
      expect(formatRelative(Number.NaN)).toBe("invalid date");
      expect(formatRelative(Number.POSITIVE_INFINITY)).toBe("invalid date");
    });
  });
});
