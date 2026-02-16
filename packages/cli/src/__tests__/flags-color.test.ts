import { describe, expect, it } from "bun:test";
import { colorPreset, composePresets, verbosePreset } from "../flags.js";

describe("colorPreset", () => {
  describe("defaults", () => {
    it("has id 'color'", () => {
      const preset = colorPreset();
      expect(preset.id).toBe("color");
    });

    it("defines one option", () => {
      const preset = colorPreset();
      expect(preset.options).toHaveLength(2);
      expect(preset.options.map((option) => option.flags)).toEqual([
        "--color [mode]",
        "--no-color",
      ]);
    });

    it("resolves to 'auto' by default", () => {
      const preset = colorPreset();
      expect(preset.resolve({}).color).toBe("auto");
    });

    it("returns fresh instance per call", () => {
      expect(colorPreset()).not.toBe(colorPreset());
    });
  });

  describe("color mode resolution", () => {
    it("resolves 'always' mode", () => {
      const preset = colorPreset();
      expect(preset.resolve({ color: "always" }).color).toBe("always");
    });

    it("resolves 'never' mode", () => {
      const preset = colorPreset();
      expect(preset.resolve({ color: "never" }).color).toBe("never");
    });

    it("resolves 'auto' mode explicitly", () => {
      const preset = colorPreset();
      expect(preset.resolve({ color: "auto" }).color).toBe("auto");
    });

    it("resolves false (Commander --no-color) to 'never'", () => {
      const preset = colorPreset();
      expect(preset.resolve({ color: false }).color).toBe("never");
    });

    it("defaults to 'auto' on invalid input", () => {
      const preset = colorPreset();
      expect(preset.resolve({ color: "invalid" }).color).toBe("auto");
    });

    it("defaults to 'auto' on numeric input", () => {
      const preset = colorPreset();
      expect(preset.resolve({ color: 42 }).color).toBe("auto");
    });

    it("defaults to 'auto' on undefined", () => {
      const preset = colorPreset();
      expect(preset.resolve({ color: undefined }).color).toBe("auto");
    });

    it("resolves true (Commander bare --color) to 'always'", () => {
      const preset = colorPreset();
      expect(preset.resolve({ color: true }).color).toBe("always");
    });
  });

  describe("composition", () => {
    it("composes with other presets", () => {
      const composed = composePresets(verbosePreset(), colorPreset());
      expect(composed.options).toHaveLength(3);
      const result = composed.resolve({
        verbose: true,
        color: "never",
      });
      expect(result).toEqual({
        verbose: true,
        color: "never",
      });
    });

    it("deduplicates by id when composed twice", () => {
      const composed = composePresets(colorPreset(), colorPreset());
      expect(composed.options).toHaveLength(2);
    });
  });
});
