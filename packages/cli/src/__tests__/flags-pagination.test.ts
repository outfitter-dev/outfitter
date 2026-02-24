import { describe, expect, it } from "bun:test";

import { composePresets, paginationPreset, verbosePreset } from "../flags.js";

describe("paginationPreset", () => {
  describe("defaults", () => {
    it("has id 'pagination'", () => {
      const preset = paginationPreset();
      expect(preset.id).toBe("pagination");
    });

    it("defines three options", () => {
      const preset = paginationPreset();
      expect(preset.options).toHaveLength(3);
      expect(preset.options.map((o) => o.flags)).toEqual([
        "-l, --limit <n>",
        "--next",
        "--reset",
      ]);
    });

    it("resolves with default limit of 20", () => {
      const preset = paginationPreset();
      const result = preset.resolve({});
      expect(result).toEqual({ limit: 20, next: false, reset: false });
    });

    it("returns fresh instance per call", () => {
      expect(paginationPreset()).not.toBe(paginationPreset());
    });
  });

  describe("limit resolution", () => {
    it("parses string limit from Commander", () => {
      const preset = paginationPreset();
      expect(preset.resolve({ limit: "50" }).limit).toBe(50);
    });

    it("parses numeric limit", () => {
      const preset = paginationPreset();
      expect(preset.resolve({ limit: 50 }).limit).toBe(50);
    });

    it("clamps to maxLimit (default 100)", () => {
      const preset = paginationPreset();
      expect(preset.resolve({ limit: "200" }).limit).toBe(100);
    });

    it("clamps to custom maxLimit", () => {
      const preset = paginationPreset({ maxLimit: 50 });
      expect(preset.resolve({ limit: "75" }).limit).toBe(50);
    });

    it("uses custom defaultLimit when not provided", () => {
      const preset = paginationPreset({ defaultLimit: 10 });
      expect(preset.resolve({}).limit).toBe(10);
    });

    it("floors fractional values", () => {
      const preset = paginationPreset();
      expect(preset.resolve({ limit: "25.7" }).limit).toBe(25);
    });

    it("defaults on zero", () => {
      const preset = paginationPreset();
      expect(preset.resolve({ limit: "0" }).limit).toBe(20);
    });

    it("defaults on negative values", () => {
      const preset = paginationPreset();
      expect(preset.resolve({ limit: "-5" }).limit).toBe(20);
    });

    it("defaults on non-numeric strings", () => {
      const preset = paginationPreset();
      expect(preset.resolve({ limit: "abc" }).limit).toBe(20);
    });

    it("defaults on NaN", () => {
      const preset = paginationPreset();
      expect(preset.resolve({ limit: Number.NaN }).limit).toBe(20);
    });

    it("defaults on Infinity", () => {
      const preset = paginationPreset();
      expect(preset.resolve({ limit: Number.POSITIVE_INFINITY }).limit).toBe(
        20
      );
    });

    it("handles limit of exactly 1", () => {
      const preset = paginationPreset();
      expect(preset.resolve({ limit: "1" }).limit).toBe(1);
    });

    it("handles limit of exactly maxLimit", () => {
      const preset = paginationPreset({ maxLimit: 50 });
      expect(preset.resolve({ limit: "50" }).limit).toBe(50);
    });
  });

  describe("boolean flags", () => {
    it("resolves next as boolean", () => {
      const preset = paginationPreset();
      expect(preset.resolve({ next: true }).next).toBe(true);
      expect(preset.resolve({ next: false }).next).toBe(false);
      expect(preset.resolve({}).next).toBe(false);
    });

    it("resolves reset as boolean", () => {
      const preset = paginationPreset();
      expect(preset.resolve({ reset: true }).reset).toBe(true);
      expect(preset.resolve({ reset: false }).reset).toBe(false);
      expect(preset.resolve({}).reset).toBe(false);
    });

    it("coerces truthy values to boolean", () => {
      const preset = paginationPreset();
      expect(preset.resolve({ next: 1 }).next).toBe(true);
      expect(preset.resolve({ reset: "yes" }).reset).toBe(true);
    });
  });

  describe("description includes defaults", () => {
    it("includes default limit in description", () => {
      const preset = paginationPreset();
      expect(preset.options[0]?.description).toContain("20");
      expect(preset.options[0]?.description).toContain("100");
    });

    it("includes custom values in description", () => {
      const preset = paginationPreset({ defaultLimit: 10, maxLimit: 50 });
      expect(preset.options[0]?.description).toContain("10");
      expect(preset.options[0]?.description).toContain("50");
    });

    it("sanitizes invalid config values to safe defaults", () => {
      const preset = paginationPreset({
        defaultLimit: Number.NaN,
        maxLimit: Number.POSITIVE_INFINITY,
      });
      expect(preset.resolve({}).limit).toBe(20);
      expect(preset.options[0]?.description).toContain("20");
      expect(preset.options[0]?.description).toContain("100");
    });

    it("clamps configured defaultLimit to maxLimit", () => {
      const preset = paginationPreset({ defaultLimit: 250, maxLimit: 50 });
      expect(preset.resolve({}).limit).toBe(50);
      expect(preset.options[0]?.description).toContain("50");
    });
  });

  describe("composition", () => {
    it("composes with other presets", () => {
      const composed = composePresets(verbosePreset(), paginationPreset());
      expect(composed.options).toHaveLength(4); // verbose + limit + next + reset
      const result = composed.resolve({
        verbose: true,
        limit: "30",
        next: true,
      });
      expect(result).toEqual({
        verbose: true,
        limit: 30,
        next: true,
        reset: false,
      });
    });

    it("deduplicates by id when composed twice", () => {
      const composed = composePresets(
        paginationPreset(),
        paginationPreset({ defaultLimit: 10 })
      );
      expect(composed.options).toHaveLength(3); // first wins, not doubled
      expect(composed.resolve({}).limit).toBe(20); // first default wins
    });
  });
});
