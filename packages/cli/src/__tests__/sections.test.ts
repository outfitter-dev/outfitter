/**
 * Tests for heading and separator render utilities
 *
 * Tests cover:
 * - renderHeading (8 tests)
 * - renderSeparator (5 tests)
 *
 * Total: 13 tests
 */
import { describe, expect, it } from "bun:test";
import { renderHeading } from "../render/heading.js";
import { renderSeparator } from "../render/separator.js";

// ============================================================================
// Heading Tests
// ============================================================================

describe("renderHeading", () => {
  describe("default behavior", () => {
    it("renders heading with equals separator matching text width (uppercase)", () => {
      const result = renderHeading("Colors");
      expect(result).toBe("COLORS\n======");
    });

    it("renders multi-word heading in uppercase", () => {
      const result = renderHeading("Theme Colors");
      expect(result).toBe("THEME COLORS\n============");
    });
  });

  describe("separator styles", () => {
    it("renders with dash separator", () => {
      const result = renderHeading("Status", { separator: "-" });
      expect(result).toBe("STATUS\n------");
    });

    it("renders with box drawing thin separator", () => {
      const result = renderHeading("Status", { separator: "─" });
      expect(result).toBe("STATUS\n──────");
    });

    it("renders with box drawing heavy separator", () => {
      const result = renderHeading("Status", { separator: "━" });
      expect(result).toBe("STATUS\n━━━━━━");
    });

    it("renders with box drawing double separator", () => {
      const result = renderHeading("Status", { separator: "═" });
      expect(result).toBe("STATUS\n══════");
    });
  });

  describe("width modes", () => {
    it("renders with text width (default)", () => {
      const result = renderHeading("Hi", { width: "text" });
      expect(result).toBe("HI\n==");
    });

    it("renders with fixed width", () => {
      const result = renderHeading("Hi", { width: 10 });
      expect(result).toBe("HI\n==========");
    });
  });

  describe("case transformations", () => {
    it("renders in lowercase", () => {
      const result = renderHeading("Theme Colors", { case: "lower" });
      expect(result).toBe("theme colors\n============");
    });

    it("renders in title case", () => {
      const result = renderHeading("theme colors", { case: "title" });
      expect(result).toBe("Theme Colors\n============");
    });

    it("renders with no case transformation", () => {
      const result = renderHeading("Theme Colors", { case: "none" });
      expect(result).toBe("Theme Colors\n============");
    });
  });
});

// ============================================================================
// Separator Tests
// ============================================================================

describe("renderSeparator", () => {
  describe("default behavior", () => {
    it("renders thin separator with default width", () => {
      const result = renderSeparator();
      // Default width is 40
      expect(result).toBe("─".repeat(40));
    });
  });

  describe("styles", () => {
    it("renders heavy separator", () => {
      const result = renderSeparator({ style: "━", width: 10 });
      expect(result).toBe("━━━━━━━━━━");
    });

    it("renders double separator", () => {
      const result = renderSeparator({ style: "═", width: 10 });
      expect(result).toBe("══════════");
    });

    it("renders dash-space separator", () => {
      const result = renderSeparator({ style: "- ", width: 10 });
      expect(result).toBe("- - - - - ");
    });

    it("renders dot-space separator", () => {
      const result = renderSeparator({ style: "· ", width: 10 });
      expect(result).toBe("· · · · · ");
    });
  });

  describe("width modes", () => {
    it("renders with fixed width", () => {
      const result = renderSeparator({ width: 20 });
      expect(result).toBe("─".repeat(20));
    });
  });
});
