/**
 * Tests for `outfitter demo` command.
 *
 * @packageDocumentation
 */

import { describe, expect, test } from "bun:test";
import {
  type DemoSection,
  getSection,
  getSectionIds,
  getSections,
  registerSection,
  runAllSections,
  runSection,
} from "../commands/demo/index.js";

// =============================================================================
// Test Utilities
// =============================================================================

/**
 * Creates a mock demo section for testing.
 */
function createMockSection(
  id: string,
  description: string,
  output: string
): DemoSection {
  return {
    id,
    description,
    run: () => output,
  };
}

// =============================================================================
// Section Registry Tests
// =============================================================================

describe("demo section registry", () => {
  // Note: Tests use unique section IDs to avoid conflicts since
  // the registry is a module-level singleton that persists across tests.

  test("getSections returns readonly array", () => {
    const sections = getSections();
    expect(Array.isArray(sections)).toBe(true);
  });

  test("registerSection adds section to registry", () => {
    const uniqueId = `test-section-${Date.now()}`;
    const section = createMockSection(uniqueId, "Test section", "test output");

    const beforeCount = getSections().length;
    registerSection(section);
    const afterCount = getSections().length;

    expect(afterCount).toBe(beforeCount + 1);
  });

  test("getSection returns section by id", () => {
    const uniqueId = `test-get-${Date.now()}`;
    const section = createMockSection(uniqueId, "Test section", "test output");
    registerSection(section);

    const found = getSection(uniqueId);

    expect(found).toBeDefined();
    expect(found?.id).toBe(uniqueId);
  });

  test("getSection returns undefined for unknown id", () => {
    const found = getSection("nonexistent-section-id");
    expect(found).toBeUndefined();
  });

  test("getSectionIds returns array of section ids", () => {
    const uniqueId = `test-ids-${Date.now()}`;
    registerSection(createMockSection(uniqueId, "Test", "output"));

    const ids = getSectionIds();

    expect(Array.isArray(ids)).toBe(true);
    expect(ids).toContain(uniqueId);
  });

  test("runSection executes section and returns output", () => {
    const uniqueId = `test-run-${Date.now()}`;
    const expectedOutput = "Hello from test section";
    registerSection(createMockSection(uniqueId, "Test", expectedOutput));

    const output = runSection(uniqueId);

    expect(output).toBe(expectedOutput);
  });

  test("runSection returns undefined for unknown section", () => {
    const output = runSection("nonexistent-section-for-run");
    expect(output).toBeUndefined();
  });

  test("runAllSections executes all sections", () => {
    const id1 = `test-all-1-${Date.now()}`;
    const id2 = `test-all-2-${Date.now()}`;
    registerSection(createMockSection(id1, "Section 1", "output1"));
    registerSection(createMockSection(id2, "Section 2", "output2"));

    const output = runAllSections();

    expect(output).toContain("output1");
    expect(output).toContain("output2");
  });
});

// =============================================================================
// Demo Command Tests
// =============================================================================

describe("demo command", () => {
  test("runDemo returns output and exit code", async () => {
    const { runDemo } = await import("../commands/demo.js");

    const result = runDemo({});

    expect(result).toHaveProperty("output");
    expect(result).toHaveProperty("exitCode");
    expect(typeof result.output).toBe("string");
    expect(typeof result.exitCode).toBe("number");
  });

  test("runDemo with --list returns section list", async () => {
    const { runDemo } = await import("../commands/demo.js");

    const result = runDemo({ list: true });

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("Available demo sections");
  });

  test("runDemo with unknown section returns error", async () => {
    const { runDemo } = await import("../commands/demo.js");

    const result = runDemo({ section: "nonexistent-demo-section" });

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain("Unknown section");
  });

  test("runDemo with 'all' runs all sections", async () => {
    const { runDemo } = await import("../commands/demo.js");
    const uniqueId = `test-demo-all-${Date.now()}`;
    registerSection(createMockSection(uniqueId, "Test", "demo-all-output"));

    const result = runDemo({ section: "all" });

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("demo-all-output");
  });
});

// =============================================================================
// Demo Result Structure Tests
// =============================================================================

describe("demo result structure", () => {
  test("DemoResult has correct structure", async () => {
    const { runDemo } = await import("../commands/demo.js");

    const result = runDemo({});

    expect(result).toHaveProperty("output");
    expect(result).toHaveProperty("exitCode");
    expect(typeof result.output).toBe("string");
    expect(typeof result.exitCode).toBe("number");
  });
});

// =============================================================================
// Colors Section Tests
// =============================================================================

describe("colors demo section", () => {
  test("colors section is registered", async () => {
    // Import demo to trigger section registration
    await import("../commands/demo.js");

    const section = getSection("colors");
    expect(section).toBeDefined();
    expect(section?.id).toBe("colors");
  });

  test("colors section produces output with theme examples", async () => {
    await import("../commands/demo.js");

    const output = runSection("colors");

    expect(output).toBeDefined();
    expect(output).toContain("THEME COLORS");
    expect(output).toContain("createTheme");
    expect(output).toContain("theme.success");
    expect(output).toContain("theme.error");
  });

  test("colors section includes direct colors", async () => {
    await import("../commands/demo.js");

    const output = runSection("colors");

    expect(output).toContain("DIRECT COLORS");
    expect(output).toContain("applyColor");
  });

  test("colors section includes raw tokens", async () => {
    await import("../commands/demo.js");

    const output = runSection("colors");

    expect(output).toContain("RAW TOKENS");
    expect(output).toContain("createTokens");
  });

  test("colors section includes environment info", async () => {
    await import("../commands/demo.js");

    const output = runSection("colors");

    expect(output).toContain("ENVIRONMENT");
    expect(output).toContain("Colors:");
    expect(output).toContain("NO_COLOR:");
    expect(output).toContain("FORCE_COLOR:");
  });

  test("runDemo with colors section works", async () => {
    const { runDemo } = await import("../commands/demo.js");

    const result = runDemo({ section: "colors" });

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("THEME COLORS");
  });
});
