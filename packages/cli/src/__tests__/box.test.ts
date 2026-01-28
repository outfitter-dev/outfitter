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
import { renderBox } from "../render/index.js";

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
