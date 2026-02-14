/**
 * Tests for list rendering with style options
 *
 * Tests cover:
 * - Default dash style (3 tests)
 * - Bullet style (2 tests)
 * - Number style (4 tests)
 * - Checkbox style (3 tests)
 * - Options handling (3 tests)
 *
 * Total: 15 tests
 */
import { describe, expect, it } from "bun:test";
import { renderList } from "../render/index.js";

// ============================================================================
// Default Dash Style Tests
// ============================================================================

describe("renderList() with dash style", () => {
  describe("default style", () => {
    it("uses dash (-) by default", () => {
      const items = ["First", "Second", "Third"];

      const result = renderList(items);

      expect(result).toContain("-");
      expect(result).toContain("- First");
      expect(result).toContain("- Second");
      expect(result).toContain("- Third");
    });

    it("handles nested items with dash style", () => {
      const items = [
        "Parent",
        { text: "Child", children: ["Grandchild 1", "Grandchild 2"] },
      ];

      const result = renderList(items);

      expect(result).toContain("- Parent");
      expect(result).toContain("- Child");
      // Nested items should also use dashes
      expect(result).toContain("- Grandchild 1");
      expect(result).toContain("- Grandchild 2");
    });

    it("indents nested items", () => {
      const items = [{ text: "Parent", children: ["Child"] }];

      const result = renderList(items);
      const lines = result.split("\n");

      // Parent should have no leading indent
      expect(lines[0]).toMatch(/^- Parent/);
      // Child should have indentation
      expect(lines[1]).toMatch(/^\s+- Child/);
    });
  });
});

// ============================================================================
// Bullet Style Tests
// ============================================================================

describe("renderList() with bullet style", () => {
  it("uses bullet (•) when style is bullet", () => {
    const items = ["First", "Second"];

    const result = renderList(items, { style: "bullet" });

    expect(result).toContain("• First");
    expect(result).toContain("• Second");
    expect(result).not.toContain("- ");
  });

  it("handles nested items with bullet style", () => {
    const items = [{ text: "Parent", children: ["Child"] }];

    const result = renderList(items, { style: "bullet" });

    expect(result).toContain("• Parent");
    expect(result).toContain("• Child");
  });
});

// ============================================================================
// Number Style Tests
// ============================================================================

describe("renderList() with number style", () => {
  it("uses numbers for top-level items", () => {
    const items = ["First", "Second", "Third"];

    const result = renderList(items, { style: "number" });

    expect(result).toContain("1. First");
    expect(result).toContain("2. Second");
    expect(result).toContain("3. Third");
  });

  it("uses letters for nested items", () => {
    const items = [{ text: "Parent", children: ["Child 1", "Child 2"] }];

    const result = renderList(items, { style: "number" });

    expect(result).toContain("1. Parent");
    // Nested should use lowercase letters
    expect(result).toContain("a. Child 1");
    expect(result).toContain("b. Child 2");
  });

  it("uses roman numerals for deeply nested items", () => {
    const items = [
      {
        text: "Level 1",
        children: [{ text: "Level 2", children: ["Level 3"] }],
      },
    ];

    const result = renderList(items, { style: "number" });

    expect(result).toContain("1. Level 1");
    expect(result).toContain("a. Level 2");
    // Third level should use roman numerals
    expect(result).toContain("i. Level 3");
  });

  it("aligns nested items with parent content", () => {
    const items = [
      {
        text: "First section",
        children: [
          { text: "Subsection A", children: ["Detail i", "Detail ii"] },
          "Subsection B",
        ],
      },
      "Second section",
    ];

    const result = renderList(items, { style: "number" });
    const lines = result.split("\n");

    // "1. First section" - children should start at column 3 (after "1. ")
    expect(lines[0]).toBe("1. First section");
    expect(lines[1]).toBe("   a. Subsection A");
    // "a. " is 3 chars, so grandchildren start at column 3 + 3 = 6
    expect(lines[2]).toBe("      i. Detail i");
    expect(lines[3]).toBe("      ii. Detail ii");
    expect(lines[4]).toBe("   b. Subsection B");
    expect(lines[5]).toBe("2. Second section");
  });
});

// ============================================================================
// Checkbox Style Tests
// ============================================================================

describe("renderList() with checkbox style", () => {
  it("renders unchecked boxes by default", () => {
    const items = ["Task 1", "Task 2"];

    const result = renderList(items, { style: "checkbox" });

    // Unchecked checkbox character
    expect(result).toContain("☐ Task 1");
    expect(result).toContain("☐ Task 2");
  });

  it("renders checked items when specified in options", () => {
    const items = ["Task 1", "Task 2", "Task 3"];

    const result = renderList(items, {
      style: "checkbox",
      checked: new Set([1]), // Second item (0-indexed) is checked
    });

    expect(result).toContain("☐ Task 1");
    expect(result).toContain("☑ Task 2"); // Checked
    expect(result).toContain("☐ Task 3");
  });

  it("renders checked items when item has checked property", () => {
    const items = [
      { text: "Unchecked task", checked: false },
      { text: "Checked task", checked: true },
    ];

    const result = renderList(items, { style: "checkbox" });

    expect(result).toContain("☐ Unchecked task");
    expect(result).toContain("☑ Checked task");
  });
});

// ============================================================================
// Options Handling Tests
// ============================================================================

describe("renderList() options", () => {
  it("respects custom indent size", () => {
    const items = [{ text: "Parent", children: ["Child"] }];

    const result = renderList(items, { indent: 4 });
    const lines = result.split("\n");

    // Child should have 4 spaces of indentation (instead of default 2)
    expect(lines[1]).toMatch(/^ {4}- Child/);
  });

  it("explicit style dash matches default", () => {
    const items = ["Item"];

    const defaultResult = renderList(items);
    const explicitResult = renderList(items, { style: "dash" });

    expect(defaultResult).toBe(explicitResult);
  });

  it("supports mixed styles with childStyle override", () => {
    const items = [
      {
        text: "Section 1",
        childStyle: "bullet" as const,
        children: ["Unordered A", "Unordered B"],
      },
      {
        text: "Section 2",
        children: [{ text: "Nested numbered", children: ["Sub-item"] }],
      },
    ];

    const result = renderList(items, { style: "number" });
    const lines = result.split("\n");

    // Section 1 has bullet children
    expect(lines[0]).toBe("1. Section 1");
    expect(lines[1]).toBe("   • Unordered A");
    expect(lines[2]).toBe("   • Unordered B");

    // Section 2 keeps numbered style for children
    expect(lines[3]).toBe("2. Section 2");
    expect(lines[4]).toContain("a. Nested numbered");
    expect(lines[5]).toContain("i. Sub-item");
  });
});
