/**
 * Tests for box rendering with borders and titles
 *
 * Tests cover:
 * - Basic box rendering (3 tests)
 * - Border styles (2 tests)
 * - Title rendering (2 tests)
 * - Content handling (3 tests)
 * - Width and alignment (2 tests)
 *
 * Total: 12 tests
 */
import { describe, expect, it } from "bun:test";
import { createBox, renderBox } from "../render/index.js";

// ============================================================================
// Basic Box Rendering Tests (3 tests)
// ============================================================================

describe("renderBox()", () => {
  describe("basic rendering", () => {
    it("renders a simple box with default single border", () => {
      const result = renderBox("Hello, world!");

      // Should have Unicode single border characters
      expect(result).toContain("┌");
      expect(result).toContain("─");
      expect(result).toContain("┐");
      expect(result).toContain("│");
      expect(result).toContain("└");
      expect(result).toContain("┘");
      // Should contain the content
      expect(result).toContain("Hello, world!");
    });

    it("renders box with array of content lines", () => {
      const result = renderBox(["Line 1", "Line 2", "Line 3"]);

      expect(result).toContain("Line 1");
      expect(result).toContain("Line 2");
      expect(result).toContain("Line 3");
      // Should have box structure
      expect(result).toContain("│");
    });

    it("applies default padding of 1", () => {
      const result = renderBox("X");
      const lines = result.split("\n");

      // With padding=1, content line should have spaces around the X
      // │ X │ (space before and after X)
      const contentLine = lines.find((l) => l.includes("X"));
      expect(contentLine).toMatch(/│\s+X\s+│/);
    });
  });

  // ============================================================================
  // Border Styles Tests (2 tests)
  // ============================================================================

  describe("border styles", () => {
    it("supports double border style", () => {
      const result = renderBox("Content", { border: "double" });

      // Should use double border characters
      expect(result).toContain("╔");
      expect(result).toContain("═");
      expect(result).toContain("╗");
      expect(result).toContain("║");
      expect(result).toContain("╚");
      expect(result).toContain("╝");
    });

    it("supports rounded border style", () => {
      const result = renderBox("Content", { border: "rounded" });

      // Should use rounded corner characters
      expect(result).toContain("╭");
      expect(result).toContain("╮");
      expect(result).toContain("╰");
      expect(result).toContain("╯");
    });
  });

  // ============================================================================
  // Title Rendering Tests (2 tests)
  // ============================================================================

  describe("title rendering", () => {
    it("renders title in top border", () => {
      const result = renderBox("Content", { title: "Status" });
      const lines = result.split("\n");

      // Title should appear in the first line (top border)
      expect(lines[0]).toContain("Status");
      // Title should still have border characters around it
      expect(lines[0]).toContain("┌");
      expect(lines[0]).toContain("┐");
    });

    it("truncates long title to fit width", () => {
      const result = renderBox("X", {
        title: "Very Long Title That Should Be Truncated",
        width: 20,
      });
      const lines = result.split("\n");

      // Title should be truncated with ellipsis or similar
      // Box width should not exceed 20
      expect(lines[0]?.length).toBeLessThanOrEqual(20);
    });
  });

  // ============================================================================
  // Content Handling Tests (3 tests)
  // ============================================================================

  describe("content handling", () => {
    it("wraps long content when width is specified", () => {
      const longText = "This is a very long line that should be wrapped";
      const result = renderBox(longText, { width: 20 });
      const lines = result.split("\n");

      // Content should be wrapped across multiple lines
      // Filter to just content lines (those with │ on both sides)
      const contentLines = lines.filter(
        (l) => l.includes("│") && !l.startsWith("┌") && !l.startsWith("└")
      );
      expect(contentLines.length).toBeGreaterThan(1);
    });

    it("handles empty content", () => {
      const result = renderBox("");

      // Should still produce a valid box structure
      expect(result).toContain("┌");
      expect(result).toContain("└");
    });

    it("preserves multi-line content from array", () => {
      const result = renderBox(["First", "", "Third"]);

      expect(result).toContain("First");
      expect(result).toContain("Third");
      // Should have at least 5 lines (top border, 3 content, bottom border)
      const lines = result.split("\n").filter((l) => l.length > 0);
      expect(lines.length).toBeGreaterThanOrEqual(5);
    });
  });

  // ============================================================================
  // Internal Dividers / Sections Tests (6 tests)
  // ============================================================================

  describe("sections (internal dividers)", () => {
    it("renders box with two sections and divider", () => {
      const result = renderBox("", {
        sections: ["Header", "Content"],
      });
      const lines = result.split("\n");

      // Should have 5 lines: top, header, divider, content, bottom
      expect(lines.length).toBe(5);
      expect(result).toContain("Header");
      expect(result).toContain("Content");
      // Should have T-intersection characters for divider
      expect(result).toContain("├");
      expect(result).toContain("┤");
    });

    it("renders box with three sections and two dividers", () => {
      const result = renderBox("", {
        sections: ["Header", "Body", "Footer"],
      });
      const lines = result.split("\n");

      // Should have 6 lines: top, header, divider, body, divider, footer, bottom
      expect(lines.length).toBe(7);
      expect(result).toContain("Header");
      expect(result).toContain("Body");
      expect(result).toContain("Footer");
      // Should have two dividers
      const dividerCount = lines.filter(
        (l) => l.includes("├") && l.includes("┤")
      ).length;
      expect(dividerCount).toBe(2);
    });

    it("renders multiple lines per section when section is string[]", () => {
      const result = renderBox("", {
        sections: ["Header", ["Line 1", "Line 2", "Line 3"]],
      });
      const lines = result.split("\n");

      // top + header + divider + 3 content lines + bottom = 7 lines
      expect(lines.length).toBe(7);
      expect(result).toContain("Line 1");
      expect(result).toContain("Line 2");
      expect(result).toContain("Line 3");
    });

    it("respects border style for divider characters", () => {
      const result = renderBox("", {
        sections: ["Header", "Content"],
        border: "double",
      });

      // Double border uses ╠ and ╣ for T-intersections
      expect(result).toContain("╠");
      expect(result).toContain("╣");
    });

    it("respects padding within sections", () => {
      const result = renderBox("", {
        sections: ["X", "Y"],
        padding: 2,
      });
      const lines = result.split("\n");

      // Find a content line and verify padding
      const contentLine = lines.find((l) => l.includes("X"));
      // With padding=2, should have at least 2 spaces after │
      expect(contentLine).toMatch(/│\s{2,}X\s{2,}│/);
    });

    it("sections takes precedence over content parameter", () => {
      const result = renderBox("Ignored content", {
        sections: ["Used section"],
      });

      expect(result).toContain("Used section");
      expect(result).not.toContain("Ignored content");
    });
  });

  // ============================================================================
  // Partial Borders Tests (3 tests)
  // ============================================================================

  describe("partial borders", () => {
    it("renders box with only top and bottom borders", () => {
      const result = renderBox("Content", {
        borders: { top: true, bottom: true, left: false, right: false },
      });
      const lines = result.split("\n");

      // Should have top and bottom borders
      expect(lines[0]).toContain("─");
      expect(lines.at(-1)).toContain("─");
      // Content line should NOT have vertical borders
      const contentLine = lines.find((l) => l.includes("Content"));
      expect(contentLine).not.toContain("│");
    });

    it("renders box with only left and right borders", () => {
      const result = renderBox("Content", {
        borders: { top: false, bottom: false, left: true, right: true },
      });
      const lines = result.split("\n");

      // Should have no top or bottom borders
      expect(lines[0]).not.toContain("┌");
      expect(lines[0]).not.toContain("─");
      // Content lines should have vertical borders
      const contentLine = lines.find((l) => l.includes("Content"));
      expect(contentLine).toMatch(/│.*Content.*│/);
    });

    it("renders box with single border (top only)", () => {
      const result = renderBox("Content", {
        borders: { top: true, bottom: false, left: false, right: false },
      });
      const lines = result.split("\n");

      // First line should have horizontal border
      expect(lines[0]).toContain("─");
      // Content line should not have vertical borders
      const contentLine = lines.find((l) => l.includes("Content"));
      expect(contentLine).not.toContain("│");
      // Last line should not be a border
      expect(lines.at(-1)).not.toContain("─");
    });
  });

  // ============================================================================
  // Margin Tests (3 tests)
  // ============================================================================

  describe("margin", () => {
    it("adds margin as empty lines/spaces outside box", () => {
      const result = renderBox("X", { margin: 1 });
      const lines = result.split("\n");

      // With margin: 1, should have empty lines before/after
      expect(lines[0]).toBe("");
      expect(lines.at(-1)).toBe("");
      // Content should have space indentation
      const boxLine = lines.find((l) => l.includes("┌"));
      expect(boxLine).toMatch(/^\s+┌/);
    });

    it("supports individual margin per side", () => {
      const result = renderBox("X", {
        margin: { top: 2, bottom: 0, left: 3, right: 0 },
      });
      const lines = result.split("\n");

      // Should have 2 empty lines at top
      expect(lines[0]).toBe("");
      expect(lines[1]).toBe("");
      // Box should start at line 3 (index 2)
      expect(lines[2]).toContain("┌");
      // Left margin of 3 spaces
      expect(lines[2]).toMatch(/^\s{3}┌/);
    });

    it("combines margin and padding", () => {
      const result = renderBox("X", { margin: 1, padding: 2 });
      const lines = result.split("\n");

      // Should have margin (empty line)
      expect(lines[0]).toBe("");
      // Box content should have padding of 2
      const contentLine = lines.find((l) => l.includes("X"));
      expect(contentLine).toMatch(/│\s{2,}X\s{2,}│/);
    });
  });

  // ============================================================================
  // Individual Padding Tests (2 tests)
  // ============================================================================

  describe("individual padding", () => {
    it("supports individual padding per side", () => {
      const result = renderBox("X", {
        padding: { top: 1, bottom: 0, left: 3, right: 1 },
      });
      const lines = result.split("\n");

      // With top padding of 1, should have empty content line after top border
      // Lines: top border, empty line (top padding), content, bottom border
      expect(lines.length).toBe(4);
      // Left padding of 3
      const contentLine = lines.find((l) => l.includes("X"));
      expect(contentLine).toMatch(/│\s{3}X\s{1}│/);
    });

    it("applies asymmetric vertical padding", () => {
      const result = renderBox("X", {
        padding: { top: 2, bottom: 1, left: 1, right: 1 },
      });
      const lines = result.split("\n");

      // Lines: top border, 2 empty (top padding), content, 1 empty (bottom padding), bottom border
      expect(lines.length).toBe(6);
    });
  });

  // ============================================================================
  // Width and Alignment Tests (2 tests)
  // ============================================================================

  describe("width and alignment", () => {
    it("respects fixed width option", () => {
      const result = renderBox("Hi", { width: 30 });
      const lines = result.split("\n");

      // All lines should be exactly 30 characters
      for (const line of lines) {
        if (line.length > 0) {
          expect(line.length).toBe(30);
        }
      }
    });

    it("centers content when align is center", () => {
      const result = renderBox("Hi", { width: 20, align: "center" });
      const lines = result.split("\n");

      // Find content line
      const contentLine = lines.find((l) => l.includes("Hi"));
      if (!contentLine) {
        throw new Error("Content line not found");
      }

      // "Hi" should be roughly centered
      // With width 20, padding 1, and "Hi" being 2 chars:
      // │ + padding + "Hi" centered + padding + │
      const hiIndex = contentLine.indexOf("Hi");
      const leftSpace = hiIndex - 1; // subtract for │
      const rightSpace = contentLine.length - hiIndex - 2 - 1; // subtract for "Hi" and │
      // Left and right space should be roughly equal (within 1 for odd widths)
      expect(Math.abs(leftSpace - rightSpace)).toBeLessThanOrEqual(1);
    });
  });
});

// ============================================================================
// createBox() Tests (6 tests)
// ============================================================================

describe("createBox()", () => {
  describe("basic functionality", () => {
    it("returns Box with output, width, and height", () => {
      const box = createBox("Hello");

      expect(box.output).toBeDefined();
      expect(typeof box.output).toBe("string");
      expect(box.width).toBeGreaterThan(0);
      expect(box.height).toBeGreaterThan(0);

      // Output should be valid box
      expect(box.output).toContain("Hello");
      expect(box.output).toContain("┌");
      expect(box.output).toContain("└");
    });

    it("calculates correct width and height", () => {
      const box = createBox("Test", { padding: 1 });
      const lines = box.output.split("\n");

      // Height should match actual line count
      expect(box.height).toBe(lines.length);
      // Width should match the actual line length
      expect(box.width).toBe(lines[0]?.length ?? 0);
    });
  });

  describe("nested boxes", () => {
    it("accepts Box as content for nesting", () => {
      const inner = createBox("Inner");
      const outer = createBox(inner);

      // Outer should contain inner box structure
      expect(outer.output).toContain("Inner");
      // Should have nested border characters
      expect(outer.output.match(/│/g)?.length).toBeGreaterThan(2);
    });

    it("renders nested box correctly inside outer box", () => {
      const inner = createBox("Inner", { border: "rounded" });
      const outer = createBox(inner, { border: "double" });
      const lines = outer.output.split("\n");

      // Outer box should use double borders
      expect(lines[0]).toContain("╔");
      // Inner box should use rounded borders (embedded in output)
      expect(outer.output).toContain("╭");
      expect(outer.output).toContain("╯");
    });

    it("respects outer box padding with nested content", () => {
      const inner = createBox("X", { padding: 0 });
      const outer = createBox(inner, { padding: 2, border: "double" });
      const lines = outer.output.split("\n");

      // With padding 2, inner box should be indented
      const innerBoxLine = lines.find((l) => l.includes("┌"));
      expect(innerBoxLine).toMatch(/║\s{2,}┌/);
    });

    it("handles deeply nested boxes (3 levels)", () => {
      const level1 = createBox("Core", { border: "single" });
      const level2 = createBox(level1, { border: "rounded" });
      const level3 = createBox(level2, { border: "double" });

      // Should contain content
      expect(level3.output).toContain("Core");
      // Should have all three border styles present
      expect(level3.output).toContain("╔"); // double outer
      expect(level3.output).toContain("╭"); // rounded middle
      expect(level3.output).toContain("┌"); // single inner
    });

    it("handles mixed content: string and Box together", () => {
      const innerBox = createBox("Inner box");
      // Pass both string content and a Box
      const outer = createBox(["Header text", innerBox, "Footer text"]);

      expect(outer.output).toContain("Header text");
      expect(outer.output).toContain("Inner box");
      expect(outer.output).toContain("Footer text");
    });
  });
});
