/**
 * Tests for Shape types and unified render() function
 *
 * TDD RED PHASE: These tests define expected behavior for output shapes.
 *
 * Tests cover:
 * - Shape type guards (4 tests)
 * - render() with Collection type (3 tests)
 * - render() with Hierarchy type (2 tests)
 * - render() with KeyValue type (2 tests)
 * - render() with Resource type (3 tests)
 * - render() options.format override (2 tests)
 * - Standalone renderers still work (1 test)
 *
 * Total: 17 tests
 */
import { describe, expect, it } from "bun:test";
import {
  type Collection,
  type Hierarchy,
  isCollection,
  isHierarchy,
  isKeyValue,
  isResource,
  type KeyValue,
  type RenderOptions,
  type Resource,
  render,
  renderJson,
  renderList,
  renderTable,
  renderTree,
  type Shape,
} from "../index.js";

// ============================================================================
// Shape Type Guards Tests (4 tests)
// ============================================================================

describe("Shape Type Guards", () => {
  it("isCollection() identifies Collection shapes", () => {
    const collection: Collection = {
      type: "collection",
      items: [{ name: "Alice" }, { name: "Bob" }],
    };
    const notCollection: Resource = {
      type: "resource",
      data: { name: "test" },
    };

    expect(isCollection(collection)).toBe(true);
    expect(isCollection(notCollection)).toBe(false);
  });

  it("isHierarchy() identifies Hierarchy shapes", () => {
    const hierarchy: Hierarchy = {
      type: "hierarchy",
      root: { name: "root", children: [] },
    };
    const notHierarchy: Collection = {
      type: "collection",
      items: [],
    };

    expect(isHierarchy(hierarchy)).toBe(true);
    expect(isHierarchy(notHierarchy)).toBe(false);
  });

  it("isKeyValue() identifies KeyValue shapes", () => {
    const keyValue: KeyValue = {
      type: "keyvalue",
      entries: { key1: "value1", key2: "value2" },
    };
    const notKeyValue: Resource = {
      type: "resource",
      data: {},
    };

    expect(isKeyValue(keyValue)).toBe(true);
    expect(isKeyValue(notKeyValue)).toBe(false);
  });

  it("isResource() identifies Resource shapes", () => {
    const resource: Resource = {
      type: "resource",
      data: { content: "test" },
      format: "json",
    };
    const notResource: KeyValue = {
      type: "keyvalue",
      entries: {},
    };

    expect(isResource(resource)).toBe(true);
    expect(isResource(notResource)).toBe(false);
  });
});

// ============================================================================
// render() with Collection Tests (3 tests)
// ============================================================================

describe("render() with Collection", () => {
  it("renders Collection with object items as table", () => {
    const collection: Collection = {
      type: "collection",
      items: [
        { name: "Alice", age: 30 },
        { name: "Bob", age: 25 },
      ],
    };

    const result = render(collection);

    // Should render as table with headers
    expect(result).toContain("Alice");
    expect(result).toContain("Bob");
    expect(result).toContain("30");
    expect(result).toContain("25");
    // Should have table structure (borders)
    expect(result).toMatch(/[|+-]/);
  });

  it("renders Collection with primitive items as list", () => {
    const collection: Collection = {
      type: "collection",
      items: ["First item", "Second item", "Third item"],
    };

    const result = render(collection);

    // Should render as bullet list
    expect(result).toContain("First item");
    expect(result).toContain("Second item");
    expect(result).toContain("Third item");
    // Should have bullet markers
    expect(result).toMatch(/[•\-*]/);
  });

  it("respects Collection headers option for table rendering", () => {
    const collection: Collection = {
      type: "collection",
      items: [{ n: "Alice", a: 30 }],
      headers: { n: "Name", a: "Age" },
    };

    const result = render(collection);

    // Should use custom headers
    expect(result).toContain("Name");
    expect(result).toContain("Age");
  });
});

// ============================================================================
// render() with Hierarchy Tests (2 tests)
// ============================================================================

describe("render() with Hierarchy", () => {
  it("renders Hierarchy using renderTree()", () => {
    const hierarchy: Hierarchy = {
      type: "hierarchy",
      root: {
        name: "src",
        children: [
          { name: "index.ts", children: [] },
          { name: "utils", children: [{ name: "helpers.ts", children: [] }] },
        ],
      },
    };

    const result = render(hierarchy);

    // Should render as tree with box-drawing characters
    expect(result).toContain("src");
    expect(result).toContain("index.ts");
    expect(result).toContain("utils");
    expect(result).toContain("helpers.ts");
    // Should use unicode box-drawing characters
    expect(result).toMatch(/[├└│─]/);
  });

  it("handles empty Hierarchy", () => {
    const hierarchy: Hierarchy = {
      type: "hierarchy",
      root: { name: "empty", children: [] },
    };

    const result = render(hierarchy);

    expect(result).toContain("empty");
  });
});

// ============================================================================
// render() with KeyValue Tests (2 tests)
// ============================================================================

describe("render() with KeyValue", () => {
  it("renders KeyValue entries as formatted pairs", () => {
    const keyValue: KeyValue = {
      type: "keyvalue",
      entries: {
        name: "John Doe",
        email: "john@example.com",
        status: "active",
      },
    };

    const result = render(keyValue);

    // Should contain all keys and values
    expect(result).toContain("name");
    expect(result).toContain("John Doe");
    expect(result).toContain("email");
    expect(result).toContain("john@example.com");
    expect(result).toContain("status");
    expect(result).toContain("active");
  });

  it("handles nested values in KeyValue", () => {
    const keyValue: KeyValue = {
      type: "keyvalue",
      entries: {
        config: { debug: true, level: "info" },
        count: 42,
      },
    };

    const result = render(keyValue);

    expect(result).toContain("config");
    expect(result).toContain("debug");
    expect(result).toContain("count");
    expect(result).toContain("42");
  });
});

// ============================================================================
// render() with Resource Tests (3 tests)
// ============================================================================

describe("render() with Resource", () => {
  it("renders Resource with json format using renderJson()", () => {
    const resource: Resource = {
      type: "resource",
      data: { name: "test", value: 42 },
      format: "json",
    };

    const result = render(resource);

    // Should be valid JSON output
    expect(result).toContain('"name"');
    expect(result).toContain('"test"');
    expect(result).toContain("42");
    // Should be formatted (indented)
    expect(result).toContain("\n");
  });

  it("renders Resource with text format using renderText()", () => {
    const resource: Resource = {
      type: "resource",
      data: "Plain text content",
      format: "text",
    };

    const result = render(resource);

    expect(result).toBe("Plain text content");
  });

  it("renders Resource with markdown format using renderMarkdown()", () => {
    const resource: Resource = {
      type: "resource",
      data: "# Heading\n\nSome **bold** text",
      format: "markdown",
    };

    const result = render(resource);

    expect(result).toContain("Heading");
    expect(result).toContain("bold");
    // Markdown syntax should be processed (bold markers removed)
    expect(result).not.toContain("**");
  });

  it("defaults Resource to json format when unspecified", () => {
    const resource: Resource = {
      type: "resource",
      data: { key: "value" },
    };

    const result = render(resource);

    // Should render as JSON by default
    expect(result).toContain('"key"');
    expect(result).toContain('"value"');
  });
});

// ============================================================================
// render() options.format Override Tests (2 tests)
// ============================================================================

describe("render() options.format override", () => {
  it("options.format=json overrides auto-selection for Collection", () => {
    const collection: Collection = {
      type: "collection",
      items: [{ name: "Alice" }, { name: "Bob" }],
    };

    const result = render(collection, { format: "json" });

    // Should render as JSON instead of table
    expect(result).toContain("[");
    expect(result).toContain('"name"');
    expect(result).toContain('"Alice"');
  });

  it("options.format=list forces list rendering for Collection with objects", () => {
    const collection: Collection = {
      type: "collection",
      items: [{ name: "Alice" }, { name: "Bob" }],
    };

    const result = render(collection, { format: "list" });

    // Should render as list (not table)
    expect(result).toMatch(/[•\-*]/);
    // Items should be stringified
    expect(result).toContain("Alice");
  });
});

// ============================================================================
// Standalone Renderers Still Work (1 test)
// ============================================================================

describe("Standalone renderers", () => {
  it("existing render functions work independently", () => {
    // Ensure existing renderers still work standalone
    const tableResult = renderTable([{ a: 1 }]);
    const listResult = renderList(["item"]);
    const treeResult = renderTree({ root: { child: null } });
    const jsonResult = renderJson({ key: "value" });

    expect(tableResult).toContain("1");
    expect(listResult).toContain("item");
    expect(treeResult).toContain("root");
    expect(treeResult).toContain("child");
    expect(jsonResult).toContain("key");
  });
});

// ============================================================================
// Shape Type Compilation Tests
// ============================================================================

describe("Shape type compilation", () => {
  it("Shape union accepts all valid shape types", () => {
    // This test primarily verifies TypeScript compilation
    const shapes: Shape[] = [
      { type: "collection", items: [] },
      { type: "hierarchy", root: { name: "root", children: [] } },
      { type: "keyvalue", entries: {} },
      { type: "resource", data: null },
    ];

    expect(shapes.length).toBe(4);
  });

  it("RenderOptions type has expected properties", () => {
    const options: RenderOptions = {
      width: 80,
      color: true,
      format: "json",
    };

    expect(options.width).toBe(80);
    expect(options.color).toBe(true);
    expect(options.format).toBe("json");
  });
});
