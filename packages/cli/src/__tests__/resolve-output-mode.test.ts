/**
 * Tests for the centralized output mode resolver.
 *
 * @packageDocumentation
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import {
  type OutputModeSource,
  type ResolvedOutputMode,
  resolveOutputMode,
} from "../query.js";

const originalJson = process.env["OUTFITTER_JSON"];
const originalJsonl = process.env["OUTFITTER_JSONL"];
const originalArgv = process.argv;

beforeEach(() => {
  delete process.env["OUTFITTER_JSON"];
  delete process.env["OUTFITTER_JSONL"];
  process.argv = ["bun", "outfitter", "some-command"];
});

afterEach(() => {
  if (originalJson === undefined) {
    delete process.env["OUTFITTER_JSON"];
  } else {
    process.env["OUTFITTER_JSON"] = originalJson;
  }

  if (originalJsonl === undefined) {
    delete process.env["OUTFITTER_JSONL"];
  } else {
    process.env["OUTFITTER_JSONL"] = originalJsonl;
  }

  process.argv = originalArgv;
});

describe("resolveOutputMode", () => {
  describe("return shape", () => {
    test("returns mode and source properties", () => {
      const result = resolveOutputMode({});
      expect(result).toHaveProperty("mode");
      expect(result).toHaveProperty("source");
    });

    test("source is one of flag, env, or default", () => {
      const result = resolveOutputMode({});
      expect(["flag", "env", "default"]).toContain(result.source);
    });
  });

  describe("explicit --output flag (source: flag)", () => {
    test("uses explicit --output json", () => {
      process.argv = ["bun", "outfitter", "check", "--output", "json"];
      const result = resolveOutputMode({ output: "json" });
      expect(result).toEqual({ mode: "json", source: "flag" });
    });

    test("uses explicit --output jsonl", () => {
      process.argv = ["bun", "outfitter", "check", "--output", "jsonl"];
      const result = resolveOutputMode({ output: "jsonl" });
      expect(result).toEqual({ mode: "jsonl", source: "flag" });
    });

    test("uses explicit --output human", () => {
      process.argv = ["bun", "outfitter", "check", "--output", "human"];
      const result = resolveOutputMode({ output: "human" });
      expect(result).toEqual({ mode: "human", source: "flag" });
    });

    test("explicit --output overrides env var", () => {
      process.env["OUTFITTER_JSON"] = "1";
      process.argv = ["bun", "outfitter", "check", "--output", "human"];
      const result = resolveOutputMode({ output: "human" });
      expect(result).toEqual({ mode: "human", source: "flag" });
    });

    test("explicit -o short flag is detected", () => {
      process.argv = ["bun", "outfitter", "check", "-o", "json"];
      const result = resolveOutputMode({ output: "json" });
      expect(result).toEqual({ mode: "json", source: "flag" });
    });

    test("explicit --output=json inline form is detected", () => {
      process.argv = ["bun", "outfitter", "check", "--output=json"];
      const result = resolveOutputMode({ output: "json" });
      expect(result).toEqual({ mode: "json", source: "flag" });
    });
  });

  describe("legacy --json/--jsonl flags (source: flag)", () => {
    test("uses legacy --json flag", () => {
      const result = resolveOutputMode({ json: true });
      expect(result).toEqual({ mode: "json", source: "flag" });
    });

    test("uses legacy --jsonl flag", () => {
      const result = resolveOutputMode({ jsonl: true });
      expect(result).toEqual({ mode: "jsonl", source: "flag" });
    });

    test("legacy --json overrides env var", () => {
      process.env["OUTFITTER_JSONL"] = "1";
      const result = resolveOutputMode({ json: true });
      expect(result).toEqual({ mode: "json", source: "flag" });
    });
  });

  describe("env var fallback (source: env)", () => {
    test("uses OUTFITTER_JSON=1 when no explicit flag", () => {
      process.env["OUTFITTER_JSON"] = "1";
      const result = resolveOutputMode({});
      expect(result).toEqual({ mode: "json", source: "env" });
    });

    test("uses OUTFITTER_JSONL=1 when no explicit flag", () => {
      process.env["OUTFITTER_JSONL"] = "1";
      const result = resolveOutputMode({});
      expect(result).toEqual({ mode: "jsonl", source: "env" });
    });

    test("OUTFITTER_JSONL takes priority over OUTFITTER_JSON", () => {
      process.env["OUTFITTER_JSON"] = "1";
      process.env["OUTFITTER_JSONL"] = "1";
      const result = resolveOutputMode({});
      expect(result).toEqual({ mode: "jsonl", source: "env" });
    });

    test("env var works when Commander default sets output to human", () => {
      // Commander sets flags.output = "human" as default even when user
      // did not pass --output. The resolver must detect this is not explicit.
      process.env["OUTFITTER_JSON"] = "1";
      const result = resolveOutputMode({ output: "human" });
      expect(result).toEqual({ mode: "json", source: "env" });
    });

    test("OUTFITTER_JSONL works when Commander default sets output to human", () => {
      process.env["OUTFITTER_JSONL"] = "1";
      const result = resolveOutputMode({ output: "human" });
      expect(result).toEqual({ mode: "jsonl", source: "env" });
    });
  });

  describe("default fallback (source: default)", () => {
    test("defaults to human when no flag or env var", () => {
      const result = resolveOutputMode({});
      expect(result).toEqual({ mode: "human", source: "default" });
    });

    test("defaults to human when Commander sets output to human implicitly", () => {
      const result = resolveOutputMode({ output: "human" });
      expect(result).toEqual({ mode: "human", source: "default" });
    });

    test("respects custom defaultMode", () => {
      const result = resolveOutputMode({}, { defaultMode: "json" });
      expect(result).toEqual({ mode: "json", source: "default" });
    });
  });

  describe("forceHumanWhenImplicit option", () => {
    test("returns human when flag is implicit and forceHumanWhenImplicit is true", () => {
      process.env["OUTFITTER_JSON"] = "1";
      const result = resolveOutputMode({}, { forceHumanWhenImplicit: true });
      expect(result).toEqual({ mode: "human", source: "default" });
    });

    test("explicit flag overrides forceHumanWhenImplicit", () => {
      process.argv = ["bun", "outfitter", "check", "--output", "json"];
      const result = resolveOutputMode(
        { output: "json" },
        { forceHumanWhenImplicit: true }
      );
      expect(result).toEqual({ mode: "json", source: "flag" });
    });

    test("legacy --json flag overrides forceHumanWhenImplicit", () => {
      const result = resolveOutputMode(
        { json: true },
        { forceHumanWhenImplicit: true }
      );
      expect(result).toEqual({ mode: "json", source: "flag" });
    });
  });

  describe("argv options", () => {
    test("accepts custom argv for explicit flag detection", () => {
      const result = resolveOutputMode(
        { output: "json" },
        { argv: ["--output", "json"] }
      );
      expect(result).toEqual({ mode: "json", source: "flag" });
    });

    test("uses process.argv when argv option is not provided", () => {
      process.argv = ["bun", "outfitter", "check", "--output", "json"];
      const result = resolveOutputMode({ output: "json" });
      expect(result).toEqual({ mode: "json", source: "flag" });
    });
  });

  describe("edge cases", () => {
    test("non-standard output mode value falls back to default", () => {
      process.argv = ["bun", "outfitter", "check", "--output", "nope"];
      const result = resolveOutputMode({ output: "nope" });
      // The flag was explicit but invalid — still recognized as a flag attempt
      // The resolve of outputModePreset would coerce to default, but the
      // centralized resolver sees the raw value
      expect(result.source).toBe("flag");
    });

    test("OUTFITTER_JSON=0 does not trigger json mode", () => {
      process.env["OUTFITTER_JSON"] = "0";
      const result = resolveOutputMode({});
      expect(result).toEqual({ mode: "human", source: "default" });
    });

    test("OUTFITTER_JSONL=0 does not trigger jsonl mode", () => {
      process.env["OUTFITTER_JSONL"] = "0";
      const result = resolveOutputMode({});
      expect(result).toEqual({ mode: "human", source: "default" });
    });
  });
});
