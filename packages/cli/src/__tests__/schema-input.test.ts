/**
 * Tests for schema-input.ts — Zod-to-Commander flag derivation internals.
 *
 * @packageDocumentation
 */

import { describe, expect, it } from "bun:test";

import { z } from "zod";

import {
  camelToKebab,
  createCommanderOption,
  deriveFlags,
  unwrapZodField,
  validateInput,
} from "../schema-input.js";

// =============================================================================
// camelToKebab
// =============================================================================

describe("camelToKebab", () => {
  it("converts simple camelCase", () => {
    expect(camelToKebab("outputDir")).toBe("output-dir");
  });

  it("handles multiple uppercase letters", () => {
    expect(camelToKebab("myOutputDirPath")).toBe("my-output-dir-path");
  });

  it("passes through already-lowercase strings", () => {
    expect(camelToKebab("name")).toBe("name");
  });

  it("handles empty string", () => {
    expect(camelToKebab("")).toBe("");
  });

  it("handles leading uppercase", () => {
    expect(camelToKebab("Name")).toBe("-name");
  });

  it("handles single character", () => {
    expect(camelToKebab("x")).toBe("x");
  });
});

// =============================================================================
// unwrapZodField
// =============================================================================

describe("unwrapZodField", () => {
  it("unwraps a plain z.string()", () => {
    const info = unwrapZodField(z.string());
    expect(info.baseType).toBe("string");
    expect(info.isOptional).toBe(false);
    expect(info.hasDefault).toBe(false);
  });

  it("unwraps z.string().optional()", () => {
    const info = unwrapZodField(z.string().optional());
    expect(info.baseType).toBe("string");
    expect(info.isOptional).toBe(true);
    expect(info.hasDefault).toBe(false);
  });

  it("unwraps z.string().default('hi')", () => {
    const info = unwrapZodField(z.string().default("hi"));
    expect(info.baseType).toBe("string");
    expect(info.hasDefault).toBe(true);
    expect(info.defaultValue).toBe("hi");
  });

  it("unwraps z.string().describe('desc')", () => {
    const info = unwrapZodField(z.string().describe("desc"));
    expect(info.description).toBe("desc");
    expect(info.baseType).toBe("string");
  });

  it("unwraps z.enum(['a', 'b'])", () => {
    const info = unwrapZodField(z.enum(["a", "b"]));
    expect(info.baseType).toBe("enum");
    expect(info.enumValues).toEqual(["a", "b"]);
  });

  it("unwraps z.number()", () => {
    const info = unwrapZodField(z.number());
    expect(info.baseType).toBe("number");
  });

  it("unwraps z.boolean()", () => {
    const info = unwrapZodField(z.boolean());
    expect(info.baseType).toBe("boolean");
  });

  it("unwraps z.string().optional().default('x')", () => {
    const info = unwrapZodField(z.string().optional().default("x"));
    expect(info.baseType).toBe("string");
    expect(info.hasDefault).toBe(true);
    expect(info.defaultValue).toBe("x");
    expect(info.isOptional).toBe(true);
  });
});

// =============================================================================
// deriveFlags
// =============================================================================

describe("deriveFlags", () => {
  it("derives flags from a simple schema", () => {
    const schema = z.object({
      name: z.string().describe("User name"),
      verbose: z.boolean().default(false),
    });

    const flags = deriveFlags(schema, new Set());
    expect(flags).toHaveLength(2);

    const nameFlag = flags.find((f) => f.name === "name");
    expect(nameFlag?.longFlag).toBe("--name");
    expect(nameFlag?.flagString).toBe("--name <value>");
    expect(nameFlag?.isBoolean).toBe(false);
    expect(nameFlag?.isRequired).toBe(true);

    const verboseFlag = flags.find((f) => f.name === "verbose");
    expect(verboseFlag?.longFlag).toBe("--verbose");
    expect(verboseFlag?.isBoolean).toBe(true);
    expect(verboseFlag?.isRequired).toBe(false);
  });

  it("skips fields with explicit overrides", () => {
    const schema = z.object({
      name: z.string(),
      output: z.string(),
    });

    const flags = deriveFlags(schema, new Set(["--output"]));
    expect(flags).toHaveLength(1);
    expect(flags[0]?.name).toBe("name");
  });

  it("converts camelCase field names to kebab-case flags", () => {
    const schema = z.object({ outputDir: z.string() });
    const flags = deriveFlags(schema, new Set());
    expect(flags[0]?.longFlag).toBe("--output-dir");
  });

  it("derives number flags with <n> placeholder", () => {
    const schema = z.object({ count: z.number() });
    const flags = deriveFlags(schema, new Set());
    expect(flags[0]?.flagString).toBe("--count <n>");
  });

  it("derives enum flags with <value> placeholder", () => {
    const schema = z.object({ format: z.enum(["json", "text"]) });
    const flags = deriveFlags(schema, new Set());
    expect(flags[0]?.flagString).toBe("--format <value>");
  });
});

// =============================================================================
// createCommanderOption
// =============================================================================

describe("createCommanderOption", () => {
  it("creates an option with choices for enum fields", () => {
    const schema = z.object({ format: z.enum(["json", "text"]) });
    const flags = deriveFlags(schema, new Set());
    const option = createCommanderOption(flags[0]!, schema);
    expect(option.flags).toBe("--format <value>");
    // Commander stores choices as .argChoices
    expect((option as unknown as { argChoices: string[] }).argChoices).toEqual([
      "json",
      "text",
    ]);
  });

  it("creates a mandatory option for required fields", () => {
    const schema = z.object({ name: z.string().describe("User name") });
    const flags = deriveFlags(schema, new Set());
    const option = createCommanderOption(flags[0]!, schema);
    expect(option.mandatory).toBe(true);
  });

  it("sets a default value when present", () => {
    const schema = z.object({ count: z.number().default(5) });
    const flags = deriveFlags(schema, new Set());
    const option = createCommanderOption(flags[0]!, schema);
    expect(option.defaultValue).toBe(5);
  });

  it("adds argParser for number fields", () => {
    const schema = z.object({ count: z.number() });
    const flags = deriveFlags(schema, new Set());
    const option = createCommanderOption(flags[0]!, schema);
    // Verify argParser was set by checking parseArg exists
    expect(option.parseArg).toBeDefined();
    // It should parse "42" → 42
    expect(option.parseArg!("42", undefined as unknown as number)).toBe(42);
  });
});

// =============================================================================
// validateInput
// =============================================================================

describe("validateInput", () => {
  it("extracts valid input from flags", () => {
    const schema = z.object({
      name: z.string(),
      count: z.number().default(10),
    });

    const result = validateInput({ name: "test", count: 5 }, schema);
    expect(result).toEqual({ name: "test", count: 5 });
  });

  it("applies schema defaults for missing flags", () => {
    const schema = z.object({
      name: z.string(),
      count: z.number().default(10),
    });

    const result = validateInput({ name: "test" }, schema);
    expect(result).toEqual({ name: "test", count: 10 });
  });

  it("throws ValidationError on validation failure", () => {
    const schema = z.object({ name: z.string() });
    expect(() => validateInput({}, schema)).toThrow("Invalid input");
  });
});
