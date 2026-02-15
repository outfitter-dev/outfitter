import { describe, expect, it } from "bun:test";
import {
  composePresets,
  executionPreset,
  timeWindowPreset,
  verbosePreset,
} from "../flags.js";

describe("timeWindowPreset", () => {
  describe("defaults", () => {
    it("has id 'timeWindow'", () => {
      const preset = timeWindowPreset();
      expect(preset.id).toBe("timeWindow");
    });

    it("defines two options", () => {
      const preset = timeWindowPreset();
      expect(preset.options).toHaveLength(2);
      expect(preset.options.map((o) => o.flags)).toEqual([
        "--since <date>",
        "--until <date>",
      ]);
    });

    it("resolves both as undefined by default", () => {
      const preset = timeWindowPreset();
      const result = preset.resolve({});
      expect(result).toEqual({ since: undefined, until: undefined });
    });

    it("returns fresh instance per call", () => {
      expect(timeWindowPreset()).not.toBe(timeWindowPreset());
    });
  });

  describe("ISO date parsing", () => {
    it("parses ISO 8601 date string for --since", () => {
      const preset = timeWindowPreset();
      const result = preset.resolve({ since: "2024-01-15" });
      expect(result.since).toBeInstanceOf(Date);
      expect(result.since?.toISOString()).toContain("2024-01-15");
    });

    it("parses ISO 8601 date string for --until", () => {
      const preset = timeWindowPreset();
      const result = preset.resolve({ until: "2024-06-30" });
      expect(result.until).toBeInstanceOf(Date);
      expect(result.until?.toISOString()).toContain("2024-06-30");
    });

    it("parses full ISO 8601 datetime", () => {
      const preset = timeWindowPreset();
      const result = preset.resolve({ since: "2024-01-15T10:30:00Z" });
      expect(result.since).toBeInstanceOf(Date);
      expect(result.since?.getUTCHours()).toBe(10);
    });
  });

  describe("duration parsing", () => {
    it("parses days duration (7d)", () => {
      const preset = timeWindowPreset();
      const before = Date.now();
      const result = preset.resolve({ since: "7d" });
      const after = Date.now();

      expect(result.since).toBeInstanceOf(Date);
      const expected = 7 * 24 * 60 * 60 * 1000;
      expect(before - result.since?.getTime()).toBeGreaterThanOrEqual(
        expected - 100
      );
      expect(after - result.since?.getTime()).toBeLessThanOrEqual(
        expected + 100
      );
    });

    it("parses hours duration (24h)", () => {
      const preset = timeWindowPreset();
      const result = preset.resolve({ since: "24h" });
      expect(result.since).toBeInstanceOf(Date);
      const diff = Date.now() - result.since?.getTime();
      expect(diff).toBeGreaterThan(23 * 60 * 60 * 1000);
      expect(diff).toBeLessThan(25 * 60 * 60 * 1000);
    });

    it("parses minutes duration (30m)", () => {
      const preset = timeWindowPreset();
      const result = preset.resolve({ since: "30m" });
      expect(result.since).toBeInstanceOf(Date);
      const diff = Date.now() - result.since?.getTime();
      expect(diff).toBeGreaterThan(29 * 60 * 1000);
      expect(diff).toBeLessThan(31 * 60 * 1000);
    });

    it("parses weeks duration (2w)", () => {
      const preset = timeWindowPreset();
      const result = preset.resolve({ since: "2w" });
      expect(result.since).toBeInstanceOf(Date);
      const diff = Date.now() - result.since?.getTime();
      const expected = 14 * 24 * 60 * 60 * 1000;
      expect(diff).toBeGreaterThan(expected - 1000);
      expect(diff).toBeLessThan(expected + 1000);
    });

    it("uses a single timestamp when resolving relative since/until", () => {
      const preset = timeWindowPreset();
      const originalNow = Date.now;
      Date.now = () => 1_000_000;
      try {
        const result = preset.resolve({ since: "1h", until: "30m" });
        expect(result.since).toBeInstanceOf(Date);
        expect(result.until).toBeInstanceOf(Date);
        if (!(result.since instanceof Date && result.until instanceof Date)) {
          throw new Error("Expected both since and until to be dates");
        }
        expect(result.until.getTime() - result.since.getTime()).toBe(
          30 * 60 * 1000
        );
      } finally {
        Date.now = originalNow;
      }
    });
  });

  describe("invalid input", () => {
    it("returns undefined for invalid strings", () => {
      const preset = timeWindowPreset();
      expect(preset.resolve({ since: "not-a-date" }).since).toBeUndefined();
    });

    it("returns undefined for empty string", () => {
      const preset = timeWindowPreset();
      expect(preset.resolve({ since: "" }).since).toBeUndefined();
    });

    it("returns undefined for non-string values", () => {
      const preset = timeWindowPreset();
      expect(preset.resolve({ since: 42 }).since).toBeUndefined();
      expect(preset.resolve({ since: true }).since).toBeUndefined();
    });

    it("returns undefined for invalid duration suffix", () => {
      const preset = timeWindowPreset();
      expect(preset.resolve({ since: "7x" }).since).toBeUndefined();
    });

    it("returns undefined for zero duration", () => {
      const preset = timeWindowPreset();
      expect(preset.resolve({ since: "0d" }).since).toBeUndefined();
    });

    it("returns undefined for negative duration", () => {
      const preset = timeWindowPreset();
      expect(preset.resolve({ since: "-7d" }).since).toBeUndefined();
    });
  });

  describe("composition", () => {
    it("composes with other presets", () => {
      const composed = composePresets(timeWindowPreset(), verbosePreset());
      expect(composed.options).toHaveLength(3);
      const result = composed.resolve({ since: "7d", verbose: true });
      expect(result.verbose).toBe(true);
      expect(result.since).toBeInstanceOf(Date);
    });
  });

  describe("maxRange config", () => {
    it("keeps parsed dates when range is within maxRange", () => {
      const preset = timeWindowPreset({
        maxRange: 24 * 60 * 60 * 1000, // 1 day
      });
      const result = preset.resolve({
        since: "2024-01-01T00:00:00Z",
        until: "2024-01-01T12:00:00Z",
      });

      expect(result.since).toBeInstanceOf(Date);
      expect(result.until).toBeInstanceOf(Date);
    });

    it("invalidates both bounds when range exceeds maxRange", () => {
      const preset = timeWindowPreset({
        maxRange: 6 * 60 * 60 * 1000, // 6 hours
      });
      const result = preset.resolve({
        since: "2024-01-01T00:00:00Z",
        until: "2024-01-02T00:00:00Z",
      });

      expect(result).toEqual({
        since: undefined,
        until: undefined,
      });
    });

    it("does not enforce maxRange when only one bound is provided", () => {
      const preset = timeWindowPreset({
        maxRange: 60 * 1000,
      });
      const result = preset.resolve({
        since: "2024-01-01T00:00:00Z",
      });

      expect(result.since).toBeInstanceOf(Date);
      expect(result.until).toBeUndefined();
    });
  });
});

describe("executionPreset", () => {
  describe("defaults", () => {
    it("has id 'execution'", () => {
      const preset = executionPreset();
      expect(preset.id).toBe("execution");
    });

    it("defines three options", () => {
      const preset = executionPreset();
      expect(preset.options).toHaveLength(3);
      expect(preset.options.map((o) => o.flags)).toEqual([
        "--timeout <ms>",
        "--retries <n>",
        "--offline",
      ]);
    });

    it("resolves with defaults", () => {
      const preset = executionPreset();
      const result = preset.resolve({});
      expect(result).toEqual({
        timeout: undefined,
        retries: 0,
        offline: false,
      });
    });

    it("returns fresh instance per call", () => {
      expect(executionPreset()).not.toBe(executionPreset());
    });
  });

  describe("timeout resolution", () => {
    it("parses string timeout", () => {
      const preset = executionPreset();
      expect(preset.resolve({ timeout: "5000" }).timeout).toBe(5000);
    });

    it("parses numeric timeout", () => {
      const preset = executionPreset();
      expect(preset.resolve({ timeout: 3000 }).timeout).toBe(3000);
    });

    it("returns undefined for zero", () => {
      const preset = executionPreset();
      expect(preset.resolve({ timeout: "0" }).timeout).toBeUndefined();
    });

    it("returns undefined for negative", () => {
      const preset = executionPreset();
      expect(preset.resolve({ timeout: "-100" }).timeout).toBeUndefined();
    });

    it("returns undefined for invalid string", () => {
      const preset = executionPreset();
      expect(preset.resolve({ timeout: "abc" }).timeout).toBeUndefined();
    });

    it("returns undefined when not provided", () => {
      const preset = executionPreset();
      expect(preset.resolve({}).timeout).toBeUndefined();
    });
  });

  describe("retries resolution", () => {
    it("parses string retries", () => {
      const preset = executionPreset();
      expect(preset.resolve({ retries: "3" }).retries).toBe(3);
    });

    it("parses numeric retries", () => {
      const preset = executionPreset();
      expect(preset.resolve({ retries: 5 }).retries).toBe(5);
    });

    it("defaults to 0 when not provided", () => {
      const preset = executionPreset();
      expect(preset.resolve({}).retries).toBe(0);
    });

    it("defaults to 0 for invalid input", () => {
      const preset = executionPreset();
      expect(preset.resolve({ retries: "abc" }).retries).toBe(0);
    });

    it("clamps to maxRetries (default 10)", () => {
      const preset = executionPreset();
      expect(preset.resolve({ retries: "20" }).retries).toBe(10);
    });

    it("clamps to custom maxRetries", () => {
      const preset = executionPreset({ maxRetries: 5 });
      expect(preset.resolve({ retries: "8" }).retries).toBe(5);
    });

    it("defaults to 0 for negative values", () => {
      const preset = executionPreset();
      expect(preset.resolve({ retries: "-3" }).retries).toBe(0);
    });

    it("floors fractional values", () => {
      const preset = executionPreset();
      expect(preset.resolve({ retries: "2.7" }).retries).toBe(2);
    });
  });

  describe("offline resolution", () => {
    it("resolves offline as true when passed", () => {
      const preset = executionPreset();
      expect(preset.resolve({ offline: true }).offline).toBe(true);
    });

    it("resolves offline as false by default", () => {
      const preset = executionPreset();
      expect(preset.resolve({}).offline).toBe(false);
    });
  });

  describe("custom config", () => {
    it("uses custom defaultTimeout", () => {
      const preset = executionPreset({ defaultTimeout: 5000 });
      expect(preset.resolve({}).timeout).toBe(5000);
    });

    it("uses custom defaultRetries", () => {
      const preset = executionPreset({ defaultRetries: 3 });
      expect(preset.resolve({}).retries).toBe(3);
    });
  });

  describe("composition", () => {
    it("composes with time-window and other presets", () => {
      const composed = composePresets(
        timeWindowPreset(),
        executionPreset(),
        verbosePreset()
      );
      expect(composed.options).toHaveLength(6);
      const result = composed.resolve({
        timeout: "5000",
        retries: "2",
        verbose: true,
      });
      expect(result).toEqual({
        since: undefined,
        until: undefined,
        timeout: 5000,
        retries: 2,
        offline: false,
        verbose: true,
      });
    });

    it("deduplicates by id when composed twice", () => {
      const composed = composePresets(executionPreset(), executionPreset());
      expect(composed.options).toHaveLength(3);
    });
  });
});
