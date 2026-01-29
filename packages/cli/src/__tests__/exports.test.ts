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

describe("@outfitter/cli/table exports", () => {
  it("exports renderTable function", async () => {
    const table = await import("../table/index.js");
    expect(typeof table.renderTable).toBe("function");
  });

  it("renderTable renders data correctly", async () => {
    const { renderTable } = await import("../table/index.js");
    const result = renderTable([{ id: 1, name: "Alice" }]);
    expect(result).toContain("id");
    expect(result).toContain("name");
    expect(result).toContain("Alice");
  });
});

describe("@outfitter/cli/list exports", () => {
  it("exports renderList function", async () => {
    const list = await import("../list/index.js");
    expect(typeof list.renderList).toBe("function");
  });

  it("exports ListStyle type (usable via renderList options)", async () => {
    const { renderList } = await import("../list/index.js");
    // Verify bullet style works
    const bullet = renderList(["Item 1"], { style: "bullet" });
    expect(bullet).toContain("\u2022");
    // Verify number style works
    const numbered = renderList(["Item 1"], { style: "number" });
    expect(numbered).toContain("1.");
  });
});

describe("@outfitter/cli/box exports", () => {
  it("exports renderBox function", async () => {
    const box = await import("../box/index.js");
    expect(typeof box.renderBox).toBe("function");
  });

  it("renderBox renders content in a box", async () => {
    const { renderBox } = await import("../box/index.js");
    const result = renderBox("Hello");
    // Should have top-left corner character
    expect(result).toContain("\u250C");
    expect(result).toContain("Hello");
  });
});

describe("@outfitter/cli/tree exports", () => {
  it("exports renderTree function", async () => {
    const tree = await import("../tree/index.js");
    expect(typeof tree.renderTree).toBe("function");
  });

  it("renderTree renders hierarchical data", async () => {
    const { renderTree } = await import("../tree/index.js");
    const result = renderTree({ src: { lib: null }, tests: null });
    expect(result).toContain("src");
    expect(result).toContain("tests");
  });
});

describe("@outfitter/cli/borders exports", () => {
  it("exports BORDERS constant", async () => {
    const borders = await import("../borders/index.js");
    expect(typeof borders.BORDERS).toBe("object");
  });

  it("exports getBorderCharacters function", async () => {
    const borders = await import("../borders/index.js");
    expect(typeof borders.getBorderCharacters).toBe("function");
  });

  it("exports drawHorizontalLine function", async () => {
    const borders = await import("../borders/index.js");
    expect(typeof borders.drawHorizontalLine).toBe("function");
  });

  it("BORDERS contains expected styles", async () => {
    const { BORDERS } = await import("../borders/index.js");
    expect(BORDERS.single).toBeDefined();
    expect(BORDERS.double).toBeDefined();
    expect(BORDERS.rounded).toBeDefined();
    expect(BORDERS.heavy).toBeDefined();
    expect(BORDERS.none).toBeDefined();
  });
});

describe("@outfitter/cli/preset/standard exports", () => {
  it("exports createTheme from colors", async () => {
    const standard = await import("../preset/standard.js");
    expect(typeof standard.createTheme).toBe("function");
  });

  it("exports ANSI from colors", async () => {
    const standard = await import("../preset/standard.js");
    expect(typeof standard.ANSI).toBe("object");
    expect(standard.ANSI.reset).toBe("\x1b[0m");
  });

  it("exports renderTable from table", async () => {
    const standard = await import("../preset/standard.js");
    expect(typeof standard.renderTable).toBe("function");
  });

  it("exports renderList from list", async () => {
    const standard = await import("../preset/standard.js");
    expect(typeof standard.renderList).toBe("function");
  });

  it("exports renderBox from box", async () => {
    const standard = await import("../preset/standard.js");
    expect(typeof standard.renderBox).toBe("function");
  });

  it("works functionally with all exports", async () => {
    const { createTheme, renderTable, renderList, renderBox } = await import(
      "../preset/standard.js"
    );

    // Theme creates semantic colors
    const theme = createTheme();
    expect(typeof theme.success).toBe("function");

    // Table renders data
    const table = renderTable([{ id: 1 }]);
    expect(table).toContain("id");

    // List renders items
    const list = renderList(["Item"]);
    expect(list).toContain("Item");

    // Box renders content
    const box = renderBox("Hello");
    expect(box).toContain("Hello");
  });
});

describe("@outfitter/cli/preset/full exports", () => {
  it("exports everything from standard", async () => {
    const full = await import("../preset/full.js");
    expect(typeof full.createTheme).toBe("function");
    expect(typeof full.ANSI).toBe("object");
    expect(typeof full.renderTable).toBe("function");
    expect(typeof full.renderList).toBe("function");
    expect(typeof full.renderBox).toBe("function");
  });

  it("exports renderTree from tree", async () => {
    const full = await import("../preset/full.js");
    expect(typeof full.renderTree).toBe("function");
  });

  it("exports BORDERS from borders", async () => {
    const full = await import("../preset/full.js");
    expect(typeof full.BORDERS).toBe("object");
    expect(full.BORDERS.rounded).toBeDefined();
  });

  it("exports getBorderCharacters from borders", async () => {
    const full = await import("../preset/full.js");
    expect(typeof full.getBorderCharacters).toBe("function");
  });

  it("works functionally with tree and borders", async () => {
    const { renderTree, getBorderCharacters } = await import(
      "../preset/full.js"
    );

    // Tree renders hierarchical data
    const tree = renderTree({ src: null });
    expect(tree).toContain("src");

    // Border characters are retrievable
    const chars = getBorderCharacters("rounded");
    expect(chars.topLeft).toBe("\u256D");
  });
});

// =============================================================================
// Root Export Tests
// =============================================================================
// The root @outfitter/cli export should be minimal: only colors and output.
// All rendering primitives should be via submodules or presets.

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
  // SHOULD NOT export: Rendering primitives (use submodules)
  // -------------------------------------------------------------------------
  it("does NOT export renderTable (use @outfitter/cli/table)", async () => {
    const mod = (await import("../index.js")) as Record<string, unknown>;
    expect(mod.renderTable).toBeUndefined();
  });

  it("does NOT export renderList (use @outfitter/cli/list)", async () => {
    const mod = (await import("../index.js")) as Record<string, unknown>;
    expect(mod.renderList).toBeUndefined();
  });

  it("does NOT export renderBox (use @outfitter/cli/box)", async () => {
    const mod = (await import("../index.js")) as Record<string, unknown>;
    expect(mod.renderBox).toBeUndefined();
  });

  it("does NOT export renderTree (use @outfitter/cli/tree)", async () => {
    const mod = (await import("../index.js")) as Record<string, unknown>;
    expect(mod.renderTree).toBeUndefined();
  });

  it("does NOT export BORDERS (use @outfitter/cli/borders)", async () => {
    const mod = (await import("../index.js")) as Record<string, unknown>;
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

  it("does NOT export buildCliCommands (use @outfitter/cli/actions)", async () => {
    const mod = (await import("../index.js")) as Record<string, unknown>;
    expect(mod.buildCliCommands).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // SHOULD NOT export: Input utilities (use @outfitter/cli/input)
  // -------------------------------------------------------------------------
  it("does NOT export input utilities (use @outfitter/cli/input)", async () => {
    const mod = (await import("../index.js")) as Record<string, unknown>;
    expect(mod.parseFilter).toBeUndefined();
    expect(mod.parseRange).toBeUndefined();
    expect(mod.parseKeyValue).toBeUndefined();
    expect(mod.parseGlob).toBeUndefined();
    expect(mod.parseSortSpec).toBeUndefined();
    expect(mod.normalizeId).toBeUndefined();
    expect(mod.collectIds).toBeUndefined();
    expect(mod.expandFileArg).toBeUndefined();
    expect(mod.confirmDestructive).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // SHOULD NOT export: Pagination (use @outfitter/cli/pagination)
  // -------------------------------------------------------------------------
  it("does NOT export pagination utilities (use @outfitter/cli/pagination)", async () => {
    const mod = (await import("../index.js")) as Record<string, unknown>;
    expect(mod.saveCursor).toBeUndefined();
    expect(mod.loadCursor).toBeUndefined();
    expect(mod.clearCursor).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // SHOULD NOT export: exitWithError (use @outfitter/cli/output)
  // -------------------------------------------------------------------------
  it("does NOT export exitWithError (use @outfitter/cli/output)", async () => {
    const mod = (await import("../index.js")) as Record<string, unknown>;
    expect(mod.exitWithError).toBeUndefined();
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
