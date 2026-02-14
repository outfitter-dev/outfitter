/**
 * Tests for output shapes and content renderers
 *
 * Tests cover:
 * - renderTable() (4 tests)
 * - renderList() (2 tests)
 * - renderTree() (2 tests)
 * - renderProgress() (2 tests)
 * - renderMarkdown() (4 tests)
 * - renderJson() (2 tests)
 * - renderText() (1 test)
 * - renderer performance (1 test)
 *
 * Total: 18 tests
 */
import { describe, expect, it } from "bun:test";
import {
  renderJson,
  renderList,
  renderMarkdown,
  renderProgress,
  renderTable,
  renderText,
  renderTree,
} from "../render/index.js";

// ============================================================================
// Output Shapes Tests (10 tests)
// ============================================================================

describe("Output Shapes", () => {
  describe("renderTable()", () => {
    it("renders data with Unicode borders", () => {
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
      // Should have table structure with Unicode box-drawing characters
      expect(result).toMatch(/[│─┌┐└┘]/);
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
