/**
 * Tests for table rendering with Unicode borders
 *
 * Tests cover:
 * - Default Unicode borders (4 tests)
 * - Border style options (4 tests)
 * - Compact mode (2 tests)
 *
 * Total: 10 tests
 */
import { describe, expect, it } from "bun:test";
import { renderTable } from "../render/index.js";

// ============================================================================
// Default Unicode Borders Tests
// ============================================================================

describe("renderTable() with Unicode borders", () => {
  describe("default border style", () => {
    it("uses single Unicode borders by default", () => {
      const data = [
        { id: 1, name: "Alice" },
        { id: 2, name: "Bob" },
      ];

      const result = renderTable(data);

      // Should use Unicode box-drawing characters
      expect(result).toContain("┌");
      expect(result).toContain("┐");
      expect(result).toContain("└");
      expect(result).toContain("┘");
      expect(result).toContain("─");
      expect(result).toContain("│");
    });

    it("uses T-intersections for column separators", () => {
      const data = [{ col1: "a", col2: "b" }];

      const result = renderTable(data);

      // Header row separator should have cross
      expect(result).toContain("┼");
      // Top should have T
      expect(result).toContain("┬");
      // Bottom should have inverse T
      expect(result).toContain("┴");
    });

    it("renders header separator with middle line style", () => {
      const data = [{ name: "Test" }];

      const result = renderTable(data);
      const lines = result.split("\n");

      // Should have 5 lines: top border, header, separator, data, bottom border
      expect(lines.length).toBe(5);
      // Header separator should use ├ and ┤
      expect(lines[2]).toContain("├");
      expect(lines[2]).toContain("┤");
    });

    it("preserves data content", () => {
      const data = [
        { id: 1, name: "Alice", status: "Active" },
        { id: 2, name: "Bob", status: "Inactive" },
      ];

      const result = renderTable(data);

      expect(result).toContain("Alice");
      expect(result).toContain("Bob");
      expect(result).toContain("Active");
      expect(result).toContain("Inactive");
    });
  });

  // ============================================================================
  // Border Style Options Tests
  // ============================================================================

  describe("border style options", () => {
    it("supports double border style", () => {
      const data = [{ name: "Test" }];

      const result = renderTable(data, { border: "double" });

      expect(result).toContain("╔");
      expect(result).toContain("═");
      expect(result).toContain("╗");
      expect(result).toContain("║");
    });

    it("supports rounded border style", () => {
      const data = [{ name: "Test" }];

      const result = renderTable(data, { border: "rounded" });

      expect(result).toContain("╭");
      expect(result).toContain("╮");
      expect(result).toContain("╰");
      expect(result).toContain("╯");
    });

    it("supports heavy border style", () => {
      const data = [{ name: "Test" }];

      const result = renderTable(data, { border: "heavy" });

      expect(result).toContain("┏");
      expect(result).toContain("━");
      expect(result).toContain("┓");
      expect(result).toContain("┃");
    });

    it("supports none border style", () => {
      const data = [{ name: "Test" }];

      const result = renderTable(data, { border: "none" });

      // Should not contain any border characters
      expect(result).not.toContain("│");
      expect(result).not.toContain("─");
      expect(result).not.toContain("┌");
      // Should still contain the data
      expect(result).toContain("Test");
      expect(result).toContain("name");
    });
  });

  // ============================================================================
  // Compact Mode Tests
  // ============================================================================

  describe("compact mode", () => {
    it("removes all borders in compact mode", () => {
      const data = [
        { id: 1, name: "Alice" },
        { id: 2, name: "Bob" },
      ];

      const result = renderTable(data, { compact: true });

      // Should not have any border characters
      expect(result).not.toContain("│");
      expect(result).not.toContain("─");
      expect(result).not.toContain("┌");
      expect(result).not.toContain("┐");
      // Should contain data with spacing
      expect(result).toContain("Alice");
      expect(result).toContain("Bob");
    });

    it("compact mode uses space separators", () => {
      const data = [{ col1: "a", col2: "b" }];

      const result = renderTable(data, { compact: true });

      // Columns should be separated by spaces
      expect(result).toMatch(/col1\s+col2/);
      expect(result).toMatch(/a\s+b/);
    });
  });
});
