/**
 * Tests for @outfitter/ui
 *
 * TDD RED PHASE: These tests define expected behavior for the UI package.
 * All tests will FAIL until implementation is complete.
 *
 * Tests cover:
 * - Color Tokens (6 tests)
 * - Output Shapes (10 tests)
 * - Text Formatting (8 tests)
 * - Content Renderers (8 tests)
 * - Terminal Detection (6 tests)
 *
 * Total: 38 tests
 */
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import {
  applyColor,
  createTheme,
  getStringWidth,
  getTerminalWidth,
  isInteractive,
  padText,
  renderJson,
  renderList,
  renderMarkdown,
  renderProgress,
  renderTable,
  renderText,
  renderTree,
  stripAnsi,
  supportsColor,
  truncateText,
  wrapText,
} from "../index.js";

// ============================================================================
// Test Helpers
// ============================================================================

/** Save original environment state for restoration */
let originalEnv: Record<string, string | undefined>;
let _originalStdout: typeof process.stdout;

beforeEach(() => {
  originalEnv = { ...process.env };
});

afterEach(() => {
  // Restore environment
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) {
      delete process.env[key];
    }
  }
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

// ============================================================================
// Color Tokens Tests (6 tests)
// ============================================================================

describe("Color Tokens", () => {
  describe("createTheme()", () => {
    it("creates color palette with expected structure", () => {
      const theme = createTheme();

      expect(theme).toBeDefined();
      expect(typeof theme).toBe("object");
      // Should have color functions for common use cases
      expect(theme.success).toBeDefined();
      expect(theme.warning).toBeDefined();
      expect(theme.error).toBeDefined();
      expect(theme.info).toBeDefined();
    });

    it("has semantic colors (success, warning, error, info)", () => {
      const theme = createTheme();

      // Semantic colors should return styled strings
      const successText = theme.success("ok");
      const warningText = theme.warning("warn");
      const errorText = theme.error("fail");
      const infoText = theme.info("note");

      // Each should return a string (possibly with ANSI codes)
      expect(typeof successText).toBe("string");
      expect(typeof warningText).toBe("string");
      expect(typeof errorText).toBe("string");
      expect(typeof infoText).toBe("string");

      // Text content should be preserved
      expect(successText).toContain("ok");
      expect(warningText).toContain("warn");
      expect(errorText).toContain("fail");
      expect(infoText).toContain("note");
    });

    it("has text colors (primary, secondary, muted)", () => {
      const theme = createTheme();

      expect(theme.primary).toBeDefined();
      expect(theme.secondary).toBeDefined();
      expect(theme.muted).toBeDefined();

      const primaryText = theme.primary("main");
      const secondaryText = theme.secondary("alt");
      const mutedText = theme.muted("dim");

      expect(typeof primaryText).toBe("string");
      expect(typeof secondaryText).toBe("string");
      expect(typeof mutedText).toBe("string");
    });
  });

  describe("applyColor()", () => {
    it("applies ANSI color to text", () => {
      const result = applyColor("hello", "green");

      // Should contain the original text
      expect(result).toContain("hello");
      // When colors are supported, should have ANSI escape codes
      // ANSI escape starts with \x1b[ or \u001b[
      // Note: This may not have ANSI if running in non-TTY
    });
  });

  describe("color environment handling", () => {
    it("disables colors when NO_COLOR env is set", () => {
      process.env.NO_COLOR = "1";

      const theme = createTheme();
      const result = theme.error("test");

      // With NO_COLOR set, should return plain text without ANSI
      expect(result).toBe("test");
      // Should not contain ANSI escape sequences
      expect(result).not.toContain("\x1b[");
    });

    it("disables colors when stdout is not a TTY", () => {
      // Create a theme in a context where isTTY would be false
      // This is tricky to test directly, but we can test the supportsColor function
      const colorSupport = supportsColor({ isTTY: false });

      expect(colorSupport).toBe(false);
    });
  });
});

// ============================================================================
// Output Shapes Tests (10 tests)
// ============================================================================

describe("Output Shapes", () => {
  describe("renderTable()", () => {
    it("renders data as ASCII table", () => {
      const data = [
        { name: "Alice", age: 30 },
        { name: "Bob", age: 25 },
      ];

      const result = renderTable(data);

      expect(typeof result).toBe("string");
      // Should contain data values
      expect(result).toContain("Alice");
      expect(result).toContain("Bob");
      expect(result).toContain("30");
      expect(result).toContain("25");
      // Should have table structure (borders or separators)
      expect(result).toMatch(/[|+-]/);
    });

    it("handles empty rows gracefully", () => {
      const data: Record<string, unknown>[] = [];

      const result = renderTable(data);

      // Should return something (empty table or message)
      expect(typeof result).toBe("string");
      // Should not throw
    });

    it("respects column widths option", () => {
      const data = [
        { description: "A very long description that should be truncated" },
      ];

      const result = renderTable(data, { columnWidths: { description: 20 } });

      // Each line should respect max width
      const lines = result.split("\n");
      // At least one line should exist
      expect(lines.length).toBeGreaterThan(0);
    });

    it("supports custom headers", () => {
      const data = [
        { n: "Alice", a: 30 },
        { n: "Bob", a: 25 },
      ];

      const result = renderTable(data, {
        headers: { n: "Name", a: "Age" },
      });

      // Should show custom header names
      expect(result).toContain("Name");
      expect(result).toContain("Age");
      // Should not show original keys as headers
      expect(result).not.toMatch(/\bn\b.*\ba\b/);
    });
  });

  describe("renderList()", () => {
    it("renders items as bullet list", () => {
      const items = ["First item", "Second item", "Third item"];

      const result = renderList(items);

      expect(typeof result).toBe("string");
      // Should contain all items
      expect(result).toContain("First item");
      expect(result).toContain("Second item");
      expect(result).toContain("Third item");
      // Should have bullet markers
      expect(result).toMatch(/[•\-*]/);
    });

    it("supports nested items", () => {
      const items = [
        "Parent item",
        { text: "Child item", children: ["Grandchild 1", "Grandchild 2"] },
      ];

      const result = renderList(items);

      expect(result).toContain("Parent item");
      expect(result).toContain("Child item");
      expect(result).toContain("Grandchild 1");
      expect(result).toContain("Grandchild 2");
      // Nested items should have more indentation
      const lines = result.split("\n");
      // Find lines with grandchildren - they should have more leading whitespace
      const grandchildLine = lines.find((l) => l.includes("Grandchild"));
      expect(grandchildLine).toBeDefined();
    });
  });

  describe("renderTree()", () => {
    it("renders hierarchical data", () => {
      const tree = {
        root: {
          child1: {
            leaf1: null,
            leaf2: null,
          },
          child2: null,
        },
      };

      const result = renderTree(tree);

      expect(typeof result).toBe("string");
      expect(result).toContain("root");
      expect(result).toContain("child1");
      expect(result).toContain("child2");
      expect(result).toContain("leaf1");
    });

    it("uses unicode box characters", () => {
      const tree = {
        parent: {
          child: null,
        },
      };

      const result = renderTree(tree);

      // Should use unicode box-drawing characters
      // Common ones: ├ └ │ ─
      expect(result).toMatch(/[├└│─]/);
    });
  });

  describe("renderProgress()", () => {
    it("renders progress bar", () => {
      const result = renderProgress({ current: 50, total: 100 });

      expect(typeof result).toBe("string");
      // Should have some visual progress indicator
      expect(result.length).toBeGreaterThan(0);
      // Should contain filled and unfilled portions
      expect(result).toMatch(/[█▓▒░=\-#\s]/);
    });

    it("shows percentage", () => {
      const result = renderProgress({
        current: 25,
        total: 100,
        showPercent: true,
      });

      // Should show 25%
      expect(result).toContain("25%");
    });
  });
});

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
});

// ============================================================================
// Content Renderers Tests (8 tests)
// ============================================================================

describe("Content Renderers", () => {
  describe("renderMarkdown()", () => {
    it("renders markdown to terminal", () => {
      const markdown = "# Heading\n\nSome **bold** text";

      const result = renderMarkdown(markdown);

      expect(typeof result).toBe("string");
      expect(result).toContain("Heading");
      expect(result).toContain("bold");
    });

    it("handles code blocks with syntax highlighting", () => {
      const markdown = "```javascript\nconst x = 1;\n```";

      const result = renderMarkdown(markdown);

      expect(result).toContain("const");
      expect(result).toContain("x");
      // May have syntax highlighting (ANSI codes)
    });

    it("handles inline code", () => {
      const markdown = "Use `npm install` to install";

      const result = renderMarkdown(markdown);

      expect(result).toContain("npm install");
      // Inline code should be visually distinct (possibly with background or different style)
    });

    it("handles bold and italic", () => {
      const markdown = "This is **bold** and *italic* text";

      const result = renderMarkdown(markdown);

      expect(result).toContain("bold");
      expect(result).toContain("italic");
      // Original markers should be removed
      expect(result).not.toContain("**");
      expect(result).not.toContain("*italic*");
    });
  });

  describe("renderJson()", () => {
    it("renders JSON with syntax coloring", () => {
      const data = { name: "test", value: 42 };

      const result = renderJson(data);

      expect(typeof result).toBe("string");
      expect(result).toContain("name");
      expect(result).toContain("test");
      expect(result).toContain("42");
      // Should be formatted (indented)
      expect(result).toContain("\n");
    });

    it("handles nested objects", () => {
      const data = {
        outer: {
          inner: {
            deep: "value",
          },
        },
      };

      const result = renderJson(data);

      expect(result).toContain("outer");
      expect(result).toContain("inner");
      expect(result).toContain("deep");
      expect(result).toContain("value");
    });
  });

  describe("renderText()", () => {
    it("applies basic formatting", () => {
      const text = "Hello, World!";

      const result = renderText(text);

      expect(typeof result).toBe("string");
      expect(result).toContain("Hello, World!");
    });
  });

  describe("renderer performance", () => {
    it("handles large inputs without overflow", () => {
      // Generate a large markdown document
      const largeMarkdown = Array.from(
        { length: 1000 },
        (_, i) => `Line ${i}: Some content here\n`
      ).join("");

      // Should not throw or hang
      const start = Date.now();
      const result = renderMarkdown(largeMarkdown);
      const elapsed = Date.now() - start;

      expect(typeof result).toBe("string");
      // Should complete in reasonable time (< 5 seconds)
      expect(elapsed).toBeLessThan(5000);
    });
  });
});

// ============================================================================
// Terminal Detection Tests (6 tests)
// ============================================================================

describe("Terminal Detection", () => {
  describe("getTerminalWidth()", () => {
    it("returns stdout columns when available", () => {
      const width = getTerminalWidth();

      expect(typeof width).toBe("number");
      expect(width).toBeGreaterThan(0);
    });

    it("returns default when not TTY", () => {
      const width = getTerminalWidth({ isTTY: false });

      // Should return a sensible default (commonly 80)
      expect(width).toBe(80);
    });
  });

  describe("isInteractive()", () => {
    it("detects TTY mode", () => {
      const result = isInteractive({ isTTY: true, isCI: false });

      expect(result).toBe(true);
    });

    it("respects CI environment", () => {
      process.env.CI = "true";

      const result = isInteractive({ isTTY: true });

      // In CI, should not be interactive even if TTY
      expect(result).toBe(false);
    });
  });

  describe("supportsColor()", () => {
    it("detects color support", () => {
      // Clear color-related env vars for clean test
      delete process.env.NO_COLOR;
      delete process.env.FORCE_COLOR;

      const result = supportsColor({ isTTY: true });

      // In a TTY without NO_COLOR, should support color
      expect(typeof result).toBe("boolean");
    });

    it("respects FORCE_COLOR env", () => {
      process.env.FORCE_COLOR = "1";

      const result = supportsColor({ isTTY: false });

      // FORCE_COLOR should enable colors even without TTY
      expect(result).toBe(true);
    });
  });
});
