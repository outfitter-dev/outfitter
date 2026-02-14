/**
 * Tests for submodule exports.
 *
 * Verifies that submodule entry points export the expected symbols.
 */

import { describe, expect, it } from "bun:test";

describe("@outfitter/cli/colors exports", () => {
  it("exports createTheme function", async () => {
    const colors = await import("../colors/index.js");
    expect(typeof colors.createTheme).toBe("function");
  });

  it("exports ANSI constant object", async () => {
    const colors = await import("../colors/index.js");
    expect(typeof colors.ANSI).toBe("object");
    expect(colors.ANSI.reset).toBe("\x1b[0m");
    expect(colors.ANSI.green).toBe("\x1b[32m");
  });

  it("exports createTokens function", async () => {
    const colors = await import("../colors/index.js");
    expect(typeof colors.createTokens).toBe("function");
  });

  it("exports applyColor function", async () => {
    const colors = await import("../colors/index.js");
    expect(typeof colors.applyColor).toBe("function");
  });

  it("Theme type is usable (createTheme returns Theme)", async () => {
    const { createTheme } = await import("../colors/index.js");
    const theme = createTheme();

    // Verify theme has expected semantic color methods
    expect(typeof theme.success).toBe("function");
    expect(typeof theme.error).toBe("function");
    expect(typeof theme.warning).toBe("function");
    expect(typeof theme.info).toBe("function");
    expect(typeof theme.muted).toBe("function");
  });
});

describe("@outfitter/cli/text exports", () => {
  it("exports text utility functions", async () => {
    const text = await import("../text.js");
    expect(typeof text.getStringWidth).toBe("function");
    expect(typeof text.stripAnsi).toBe("function");
    expect(typeof text.wrapText).toBe("function");
    expect(typeof text.truncateText).toBe("function");
    expect(typeof text.padText).toBe("function");
    expect(typeof text.pluralize).toBe("function");
    expect(typeof text.slugify).toBe("function");
  });
});

// =============================================================================
// Root Export Tests
// =============================================================================
// The root @outfitter/cli export should be minimal: only colors and output.
// All rendering primitives are now in @outfitter/tui.

describe("@outfitter/cli (root)", () => {
  // -------------------------------------------------------------------------
  // SHOULD export: Colors essentials
  // -------------------------------------------------------------------------
  it("exports createTheme function", async () => {
    const { createTheme } = await import("../index.js");
    expect(typeof createTheme).toBe("function");
  });

  it("exports ANSI constant object", async () => {
    const { ANSI } = await import("../index.js");
    expect(typeof ANSI).toBe("object");
    expect(ANSI.reset).toBe("\x1b[0m");
  });

  // -------------------------------------------------------------------------
  // SHOULD export: Output essentials
  // -------------------------------------------------------------------------
  it("exports output function", async () => {
    const { output } = await import("../index.js");
    expect(typeof output).toBe("function");
  });

  // -------------------------------------------------------------------------
  // SHOULD NOT export: Rendering primitives (moved to @outfitter/tui)
  // -------------------------------------------------------------------------
  it("does NOT export rendering primitives (moved to @outfitter/tui)", async () => {
    const mod = (await import("../index.js")) as Record<string, unknown>;
    expect(mod.renderTable).toBeUndefined();
    expect(mod.renderList).toBeUndefined();
    expect(mod.renderBox).toBeUndefined();
    expect(mod.renderTree).toBeUndefined();
    expect(mod.BORDERS).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // SHOULD NOT export: CLI factory and commands (use submodules)
  // -------------------------------------------------------------------------
  it("does NOT export createCLI (use @outfitter/cli/cli)", async () => {
    const mod = (await import("../index.js")) as Record<string, unknown>;
    expect(mod.createCLI).toBeUndefined();
  });

  it("does NOT export command (use @outfitter/cli/command)", async () => {
    const mod = (await import("../index.js")) as Record<string, unknown>;
    expect(mod.command).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // SHOULD NOT export: Input utilities (use @outfitter/cli/input)
  // -------------------------------------------------------------------------
  it("does NOT export input utilities (use @outfitter/cli/input)", async () => {
    const mod = (await import("../index.js")) as Record<string, unknown>;
    expect(mod.parseFilter).toBeUndefined();
    expect(mod.parseRange).toBeUndefined();
    expect(mod.collectIds).toBeUndefined();
    expect(mod.confirmDestructive).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // Functional test: minimal exports work together
  // -------------------------------------------------------------------------
  it("works functionally with minimal exports", async () => {
    const { createTheme, ANSI, output } = await import("../index.js");

    // Theme creates semantic colors
    const theme = createTheme();
    expect(typeof theme.success).toBe("function");
    expect(typeof theme.error).toBe("function");

    // ANSI codes work
    expect(`${ANSI.green}test${ANSI.reset}`).toBe("\x1b[32mtest\x1b[0m");

    // Output function is callable (don't actually call to avoid stdout)
    expect(typeof output).toBe("function");
  });
});
