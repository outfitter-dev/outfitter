import { describe, expect, it } from "bun:test";
import {
  composePresets,
  interactionPreset,
  strictPreset,
  verbosePreset,
} from "../flags.js";

describe("interactionPreset", () => {
  describe("defaults", () => {
    it("has id 'interaction'", () => {
      const preset = interactionPreset();
      expect(preset.id).toBe("interaction");
    });

    it("defines three options", () => {
      const preset = interactionPreset();
      expect(preset.options).toHaveLength(3);
      expect(preset.options.map((o) => o.flags)).toEqual([
        "--non-interactive",
        "--no-input",
        "-y, --yes",
      ]);
    });

    it("resolves interactive as true by default", () => {
      const preset = interactionPreset();
      const result = preset.resolve({});
      expect(result).toEqual({ interactive: true, yes: false });
    });

    it("returns fresh instance per call", () => {
      expect(interactionPreset()).not.toBe(interactionPreset());
    });
  });

  describe("interactive resolution", () => {
    it("sets interactive to false when --non-interactive is passed", () => {
      const preset = interactionPreset();
      expect(preset.resolve({ nonInteractive: true }).interactive).toBe(false);
    });

    it("sets interactive to false when --no-input is passed", () => {
      const preset = interactionPreset();
      expect(preset.resolve({ noInput: true }).interactive).toBe(false);
    });

    it("sets interactive to false for Commander's --no-input shape", () => {
      const preset = interactionPreset();
      expect(preset.resolve({ input: false }).interactive).toBe(false);
    });

    it("handles kebab-case key for non-interactive", () => {
      const preset = interactionPreset();
      expect(preset.resolve({ "non-interactive": true }).interactive).toBe(
        false
      );
    });

    it("handles kebab-case key for no-input", () => {
      const preset = interactionPreset();
      expect(preset.resolve({ "no-input": true }).interactive).toBe(false);
    });

    it("stays true when flags are explicitly false", () => {
      const preset = interactionPreset();
      expect(
        preset.resolve({ nonInteractive: false, noInput: false }).interactive
      ).toBe(true);
    });

    it("keeps alias truthy values even when another alias is false", () => {
      const preset = interactionPreset();
      expect(
        preset.resolve({ nonInteractive: false, noInput: true }).interactive
      ).toBe(false);
    });
  });

  describe("yes resolution", () => {
    it("resolves yes as true when passed", () => {
      const preset = interactionPreset();
      expect(preset.resolve({ yes: true }).yes).toBe(true);
    });

    it("resolves yes as false by default", () => {
      const preset = interactionPreset();
      expect(preset.resolve({}).yes).toBe(false);
    });

    it("coerces truthy values to boolean", () => {
      const preset = interactionPreset();
      expect(preset.resolve({ yes: 1 }).yes).toBe(true);
      expect(preset.resolve({ yes: "yes" }).yes).toBe(true);
    });
  });

  describe("composition", () => {
    it("composes with other presets", () => {
      const composed = composePresets(verbosePreset(), interactionPreset());
      expect(composed.options).toHaveLength(4);
      const result = composed.resolve({
        verbose: true,
        nonInteractive: true,
        yes: true,
      });
      expect(result).toEqual({
        verbose: true,
        interactive: false,
        yes: true,
      });
    });

    it("deduplicates by id when composed twice", () => {
      const composed = composePresets(interactionPreset(), interactionPreset());
      expect(composed.options).toHaveLength(3);
    });
  });
});

describe("strictPreset", () => {
  describe("defaults", () => {
    it("has id 'strict'", () => {
      const preset = strictPreset();
      expect(preset.id).toBe("strict");
    });

    it("defines one option", () => {
      const preset = strictPreset();
      expect(preset.options).toHaveLength(1);
      expect(preset.options[0]?.flags).toBe("--strict");
    });

    it("resolves strict as false by default", () => {
      const preset = strictPreset();
      expect(preset.resolve({}).strict).toBe(false);
    });

    it("returns fresh instance per call", () => {
      expect(strictPreset()).not.toBe(strictPreset());
    });
  });

  describe("resolution", () => {
    it("resolves strict as true when passed", () => {
      const preset = strictPreset();
      expect(preset.resolve({ strict: true }).strict).toBe(true);
    });

    it("coerces truthy values to boolean", () => {
      const preset = strictPreset();
      expect(preset.resolve({ strict: 1 }).strict).toBe(true);
      expect(preset.resolve({ strict: "yes" }).strict).toBe(true);
    });
  });

  describe("composition", () => {
    it("composes with interaction and other presets", () => {
      const composed = composePresets(
        interactionPreset(),
        strictPreset(),
        verbosePreset()
      );
      expect(composed.options).toHaveLength(5);
      const result = composed.resolve({
        strict: true,
        verbose: true,
      });
      expect(result).toEqual({
        interactive: true,
        yes: false,
        strict: true,
        verbose: true,
      });
    });
  });
});
