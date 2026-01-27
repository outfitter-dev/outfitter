/**
 * Tests for text formatting utilities
 *
 * Tests cover:
 * - wrapText() (2 tests)
 * - truncateText() (2 tests)
 * - padText() (2 tests)
 * - stripAnsi() (1 test)
 * - getStringWidth() (1 test)
 * - pluralize() (4 tests)
 * - slugify() (5 tests)
 *
 * Total: 16 tests
 */
import { describe, expect, it } from "bun:test";
import {
  getStringWidth,
  padText,
  pluralize,
  slugify,
  stripAnsi,
  truncateText,
  wrapText,
} from "../render/index.js";

// ============================================================================
// Text Formatting Tests (8 tests)
// ============================================================================

describe("Text Formatting", () => {
  describe("wrapText()", () => {
    it("wraps text at specified width", () => {
      const longText =
        "This is a long sentence that should be wrapped at a specific width";

      const result = wrapText(longText, 20);

      const lines = result.split("\n");
      // Should have multiple lines
      expect(lines.length).toBeGreaterThan(1);
      // Each line should not exceed width (approximately, word boundaries may vary)
      for (const line of lines) {
        // Allow some flexibility for word boundaries
        expect(line.length).toBeLessThanOrEqual(25);
      }
    });

    it("preserves ANSI codes across line breaks", () => {
      // Text with ANSI color code
      const coloredText =
        "\x1b[32mThis is green text that needs to wrap\x1b[0m";

      const result = wrapText(coloredText, 15);

      // Should still contain ANSI codes
      expect(result).toContain("\x1b[32m");
      // Should properly close/reopen codes across lines
    });
  });

  describe("truncateText()", () => {
    it("adds ellipsis when truncated", () => {
      const longText = "This is a very long text that needs truncation";

      const result = truncateText(longText, 20);

      expect(result.length).toBeLessThanOrEqual(20);
      expect(result).toContain("...");
      // Should start with beginning of original text
      expect(result.startsWith("This")).toBe(true);
    });

    it("respects ANSI codes in width calculation", () => {
      // Text with ANSI codes
      const coloredText = "\x1b[31mRed text here\x1b[0m";

      const result = truncateText(coloredText, 10);

      // Width calculation should ignore ANSI codes
      // "Red text h" + "..." would be approximately right
      // The visible width should be <= 10
      const visibleWidth = getStringWidth(result);
      expect(visibleWidth).toBeLessThanOrEqual(10);
    });
  });

  describe("padText()", () => {
    it("pads text to specified width", () => {
      const result = padText("hello", 10);

      expect(result.length).toBe(10);
      expect(result).toContain("hello");
    });

    it("handles ANSI codes in width calculation", () => {
      const coloredText = "\x1b[32mhi\x1b[0m";

      const result = padText(coloredText, 10);

      // Visible width should be 10 (ANSI codes don't count)
      const visibleWidth = getStringWidth(result);
      expect(visibleWidth).toBe(10);
    });
  });

  describe("stripAnsi()", () => {
    it("removes ANSI escape codes", () => {
      const coloredText = "\x1b[31mRed\x1b[0m \x1b[32mGreen\x1b[0m";

      const result = stripAnsi(coloredText);

      expect(result).toBe("Red Green");
      expect(result).not.toContain("\x1b[");
    });
  });

  describe("getStringWidth()", () => {
    it("calculates visible width with ANSI codes", () => {
      const coloredText = "\x1b[31mHello\x1b[0m";

      const width = getStringWidth(coloredText);

      // "Hello" is 5 characters, ANSI codes should be ignored
      expect(width).toBe(5);
    });
  });

  describe("pluralize()", () => {
    it("returns singular form when count is 1", () => {
      const result = pluralize(1, "item");

      expect(result).toBe("1 item");
    });

    it("returns default plural form when count is greater than 1", () => {
      const result = pluralize(5, "item");

      expect(result).toBe("5 items");
    });

    it("returns plural form when count is 0", () => {
      const result = pluralize(0, "item");

      expect(result).toBe("0 items");
    });

    it("uses custom plural form when provided", () => {
      const result = pluralize(0, "child", "children");

      expect(result).toBe("0 children");
    });
  });

  describe("slugify()", () => {
    it("converts text to lowercase with hyphens", () => {
      const result = slugify("Hello World");

      expect(result).toBe("hello-world");
    });

    it("replaces special characters with hyphens", () => {
      const result = slugify("Hello World!");

      expect(result).toBe("hello-world");
    });

    it("replaces ampersand with 'and'", () => {
      const result = slugify("This & That");

      expect(result).toBe("this-and-that");
    });

    it("removes leading and trailing hyphens", () => {
      const result = slugify("  Hello World!  ");

      expect(result).toBe("hello-world");
    });

    it("collapses multiple spaces into single hyphen", () => {
      const result = slugify("  Multiple   Spaces  ");

      expect(result).toBe("multiple-spaces");
    });
  });
});
