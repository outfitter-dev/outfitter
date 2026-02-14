/**
 * Tests for tree rendering with guide styles
 *
 * Tests cover:
 * - Basic tree rendering (2 tests)
 * - Guide styles (4 tests)
 * - Tree options (3 tests)
 *
 * Total: 9 tests
 */
import { describe, expect, it } from "bun:test";
import { renderTree, TREE_GUIDES } from "../render/tree.js";

// ============================================================================
// Basic Tree Rendering Tests (2 tests)
// ============================================================================

describe("renderTree()", () => {
  describe("basic rendering", () => {
    it("renders a flat tree with default single guide", () => {
      const tree = {
        file1: null,
        file2: null,
      };
      const result = renderTree(tree);

      // Should use single guide characters
      expect(result).toContain("├── file1");
      expect(result).toContain("└── file2");
    });

    it("renders nested tree with proper connectors", () => {
      const tree = {
        src: {
          components: {
            Button: null,
            Input: null,
          },
          utils: null,
        },
        tests: null,
      };
      const result = renderTree(tree);

      // Should have proper nesting with vertical lines
      expect(result).toContain("├── src");
      expect(result).toContain("│   ├── components");
      expect(result).toContain("│   │   ├── Button");
      expect(result).toContain("│   │   └── Input");
      expect(result).toContain("│   └── utils");
      expect(result).toContain("└── tests");
    });
  });

  // ============================================================================
  // Guide Styles Tests (4 tests)
  // ============================================================================

  describe("guide styles", () => {
    it("renders with single guide (default)", () => {
      const tree = { a: null, b: null };
      const result = renderTree(tree, { guide: "single" });

      expect(result).toContain("├── ");
      expect(result).toContain("└── ");
    });

    it("renders with rounded guide", () => {
      const tree = { a: null, b: null };
      const result = renderTree(tree, { guide: "rounded" });

      // Rounded uses ╰ instead of └
      expect(result).toContain("├── ");
      expect(result).toContain("╰── ");
    });

    it("renders with heavy guide", () => {
      const tree = { a: { b: null }, c: null };
      const result = renderTree(tree, { guide: "heavy" });

      // Heavy uses thick characters
      expect(result).toContain("┣━━ ");
      expect(result).toContain("┗━━ ");
      expect(result).toContain("┃   ");
    });

    it("renders with double guide", () => {
      const tree = { a: { b: null }, c: null };
      const result = renderTree(tree, { guide: "double" });

      // Double uses double-line characters
      expect(result).toContain("╠══ ");
      expect(result).toContain("╚══ ");
      expect(result).toContain("║   ");
    });
  });

  // ============================================================================
  // Tree Options Tests (3 tests)
  // ============================================================================

  describe("options", () => {
    it("respects maxDepth option", () => {
      const tree = {
        level1: {
          level2: {
            level3: {
              level4: null,
            },
          },
        },
      };
      const result = renderTree(tree, { maxDepth: 2 });

      // Should include level1 and level2 (depth 0 and 1)
      expect(result).toContain("level1");
      expect(result).toContain("level2");
      // Should not include level3 (depth 2 exceeds maxDepth)
      expect(result).not.toContain("level3");
      expect(result).not.toContain("level4");
    });

    it("uses custom renderLabel function", () => {
      const tree = {
        file: "txt",
        folder: { sub: null },
      };
      const result = renderTree(tree, {
        renderLabel: (key, value, _depth) => {
          if (value && typeof value === "object") {
            return `📁 ${key}/`;
          }
          return `📄 ${key}`;
        },
      });

      expect(result).toContain("📁 folder/");
      expect(result).toContain("📄 file");
      expect(result).toContain("📄 sub");
    });

    it("combines guide style with maxDepth", () => {
      const tree = {
        a: { b: { c: null } },
      };
      const result = renderTree(tree, { guide: "rounded", maxDepth: 2 });

      // Should use rounded guide
      expect(result).toContain("╰── ");
      // Should stop at depth 1 (maxDepth 2 means up to depth 1)
      expect(result).toContain("a");
      expect(result).toContain("b");
      expect(result).not.toContain("c");
    });
  });
});

// ============================================================================
// TREE_GUIDES Constant Tests
// ============================================================================

describe("TREE_GUIDES", () => {
  it("exports all expected guide styles", () => {
    expect(TREE_GUIDES).toHaveProperty("single");
    expect(TREE_GUIDES).toHaveProperty("heavy");
    expect(TREE_GUIDES).toHaveProperty("double");
    expect(TREE_GUIDES).toHaveProperty("rounded");
  });

  it("each guide has vertical, fork, and end properties", () => {
    for (const style of Object.keys(TREE_GUIDES)) {
      const guide = TREE_GUIDES[style as keyof typeof TREE_GUIDES];
      expect(guide).toHaveProperty("vertical");
      expect(guide).toHaveProperty("fork");
      expect(guide).toHaveProperty("end");
      // Each property should be a 4-character string
      expect(guide.vertical.length).toBe(4);
      expect(guide.fork.length).toBe(4);
      expect(guide.end.length).toBe(4);
    }
  });
});
