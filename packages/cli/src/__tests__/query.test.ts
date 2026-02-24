import { describe, expect, it } from "bun:test";

import { composePresets, verbosePreset } from "../flags.js";
import { jqPreset, outputModePreset } from "../query.js";

describe("outputModePreset", () => {
  describe("defaults", () => {
    it("has id 'outputMode'", () => {
      const preset = outputModePreset();
      expect(preset.id).toBe("outputMode");
    });

    it("defines one option", () => {
      const preset = outputModePreset();
      expect(preset.options).toHaveLength(1);
      expect(preset.options[0]?.flags).toBe("-o, --output <mode>");
    });

    it("resolves to 'human' by default", () => {
      const preset = outputModePreset();
      expect(preset.resolve({}).outputMode).toBe("human");
    });

    it("returns fresh instance per call", () => {
      expect(outputModePreset()).not.toBe(outputModePreset());
    });
  });

  describe("output mode resolution", () => {
    it("resolves 'json' mode", () => {
      const preset = outputModePreset();
      expect(preset.resolve({ output: "json" }).outputMode).toBe("json");
    });

    it("resolves 'human' mode", () => {
      const preset = outputModePreset();
      expect(preset.resolve({ output: "human" }).outputMode).toBe("human");
    });

    it("defaults to 'human' on invalid input", () => {
      const preset = outputModePreset();
      expect(preset.resolve({ output: "invalid" }).outputMode).toBe("human");
    });

    it("defaults to 'human' on non-string input", () => {
      const preset = outputModePreset();
      expect(preset.resolve({ output: 42 }).outputMode).toBe("human");
    });
  });

  describe("custom config", () => {
    it("supports custom default mode", () => {
      const preset = outputModePreset({ defaultMode: "json" });
      expect(preset.resolve({}).outputMode).toBe("json");
    });

    it("supports custom modes list", () => {
      const preset = outputModePreset({
        modes: ["human", "json", "table"],
      });
      expect(preset.resolve({ output: "table" }).outputMode).toBe("table");
    });

    it("rejects modes not in the allowed list", () => {
      const preset = outputModePreset({
        modes: ["human", "json"],
      });
      expect(preset.resolve({ output: "table" }).outputMode).toBe("human");
    });

    it("includes jsonl when configured", () => {
      const preset = outputModePreset({ includeJsonl: true });
      expect(preset.resolve({ output: "jsonl" }).outputMode).toBe("jsonl");
    });

    it("accepts defaultMode even when modes list omits it", () => {
      const preset = outputModePreset({
        modes: ["json"],
        defaultMode: "jsonl",
      });
      expect(preset.resolve({}).outputMode).toBe("jsonl");
      expect(preset.resolve({ output: "jsonl" }).outputMode).toBe("jsonl");
    });
  });

  describe("composition", () => {
    it("composes with other presets", () => {
      const composed = composePresets(outputModePreset(), verbosePreset());
      expect(composed.options).toHaveLength(2);
      const result = composed.resolve({
        output: "json",
        verbose: true,
      });
      expect(result).toEqual({
        outputMode: "json",
        verbose: true,
      });
    });
  });
});

describe("jqPreset", () => {
  describe("defaults", () => {
    it("has id 'jq'", () => {
      const preset = jqPreset();
      expect(preset.id).toBe("jq");
    });

    it("defines one option", () => {
      const preset = jqPreset();
      expect(preset.options).toHaveLength(1);
      expect(preset.options[0]?.flags).toBe("--jq <expr>");
    });

    it("resolves to undefined by default", () => {
      const preset = jqPreset();
      expect(preset.resolve({}).jq).toBeUndefined();
    });

    it("returns fresh instance per call", () => {
      expect(jqPreset()).not.toBe(jqPreset());
    });
  });

  describe("jq expression resolution", () => {
    it("resolves a jq expression", () => {
      const preset = jqPreset();
      expect(preset.resolve({ jq: ".data[]" }).jq).toBe(".data[]");
    });

    it("resolves complex jq expression", () => {
      const preset = jqPreset();
      expect(
        preset.resolve({ jq: ".[] | select(.active == true) | .name" }).jq
      ).toBe(".[] | select(.active == true) | .name");
    });

    it("returns undefined for non-string input", () => {
      const preset = jqPreset();
      expect(preset.resolve({ jq: 42 }).jq).toBeUndefined();
    });

    it("returns undefined for empty string", () => {
      const preset = jqPreset();
      expect(preset.resolve({ jq: "" }).jq).toBeUndefined();
    });
  });

  describe("composition", () => {
    it("composes with outputMode preset", () => {
      const composed = composePresets(outputModePreset(), jqPreset());
      expect(composed.options).toHaveLength(2);
      const result = composed.resolve({
        output: "json",
        jq: ".data",
      });
      expect(result).toEqual({
        outputMode: "json",
        jq: ".data",
      });
    });
  });
});
