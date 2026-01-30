/**
 * Tests for stack composition system.
 *
 * @packageDocumentation
 */

import { describe, expect, test } from "bun:test";
import {
  createHStack,
  createVStack,
  DEFAULT_STACK_THEME,
  DELIMITERS,
  type DelimiterName,
  getDelimiter,
  getMarker,
  hstack,
  vstack,
  vstackItem,
} from "../render/stack.js";

// ============================================================================
// Phase 0: Delimiter Registry
// ============================================================================

describe("DELIMITERS", () => {
  test("has expected keys", () => {
    const expectedKeys: DelimiterName[] = [
      "space",
      "bullet",
      "dot",
      "pipe",
      "arrow",
      "slash",
      "colon",
    ];

    for (const key of expectedKeys) {
      expect(DELIMITERS[key]).toBeDefined();
    }
  });

  test("each delimiter has unicode and fallback strings", () => {
    for (const [_name, delimiter] of Object.entries(DELIMITERS)) {
      expect(typeof delimiter.unicode).toBe("string");
      expect(typeof delimiter.fallback).toBe("string");
      expect(delimiter.unicode.length).toBeGreaterThan(0);
      expect(delimiter.fallback.length).toBeGreaterThan(0);
    }
  });

  test("specific delimiters have correct values", () => {
    expect(DELIMITERS.bullet.unicode).toBe("•");
    expect(DELIMITERS.bullet.fallback).toBe("*");
    expect(DELIMITERS.arrow.unicode).toBe("→");
    expect(DELIMITERS.arrow.fallback).toBe("->");
    expect(DELIMITERS.pipe.unicode).toBe("│");
    expect(DELIMITERS.pipe.fallback).toBe("|");
  });
});

describe("getDelimiter", () => {
  test("returns unicode by default", () => {
    expect(getDelimiter("bullet")).toBe("•");
    expect(getDelimiter("arrow")).toBe("→");
    expect(getDelimiter("pipe")).toBe("│");
  });

  test("returns unicode when forceUnicode is true", () => {
    expect(getDelimiter("bullet", true)).toBe("•");
    expect(getDelimiter("arrow", true)).toBe("→");
  });

  test("returns fallback when forceUnicode is false", () => {
    expect(getDelimiter("bullet", false)).toBe("*");
    expect(getDelimiter("arrow", false)).toBe("->");
    expect(getDelimiter("pipe", false)).toBe("|");
  });
});

describe("getMarker", () => {
  test("returns unicode marker by default", () => {
    expect(getMarker("circleDot")).toBe("◉");
    expect(getMarker("circleOutline")).toBe("○");
    expect(getMarker("pointer")).toBe("❯");
  });

  test("returns fallback marker when forceUnicode is false", () => {
    expect(getMarker("circleDot", false)).toBe("(*)");
    expect(getMarker("circleOutline", false)).toBe("o");
    expect(getMarker("pointer", false)).toBe(">");
  });

  test("returns custom string marker as-is", () => {
    expect(getMarker("★")).toBe("★");
    expect(getMarker("custom")).toBe("custom");
  });
});

// ============================================================================
// Phase 1: Horizontal Stack (hstack)
// ============================================================================

describe("hstack", () => {
  test("joins items with default (space) delimiter", () => {
    const result = hstack(["a", "b", "c"]);
    expect(result).toBe("a b c");
  });

  test("joins items with named delimiter (bullet)", () => {
    const result = hstack(["main", "Draft", "2 hours ago"], {
      delimiter: "bullet",
    });
    expect(result).toBe("main•Draft•2 hours ago");
  });

  test("joins items with named delimiter (arrow)", () => {
    const result = hstack(["src", "components", "Button.tsx"], {
      delimiter: "arrow",
    });
    expect(result).toBe("src→components→Button.tsx");
  });

  test("joins items with custom string delimiter", () => {
    const result = hstack(["a", "b", "c"], { delimiter: " | " });
    expect(result).toBe("a | b | c");
  });

  test("applies gap spacing around delimiter", () => {
    const result = hstack(["main", "Draft", "2 hours ago"], {
      delimiter: "bullet",
      gap: 1,
    });
    expect(result).toBe("main • Draft • 2 hours ago");
  });

  test("handles empty array", () => {
    const result = hstack([]);
    expect(result).toBe("");
  });

  test("handles single item", () => {
    const result = hstack(["only"]);
    expect(result).toBe("only");
  });

  test("handles multi-line items with top alignment (default)", () => {
    const result = hstack(["Line1\nLine2", "Single"], { delimiter: "pipe" });
    const lines = result.split("\n");
    expect(lines.length).toBe(2);
    expect(lines[0]).toBe("Line1│Single");
    expect(lines[1]).toBe("Line2│      ");
  });

  test("handles multi-line items with center alignment", () => {
    const result = hstack(["Line1\nLine2\nLine3", "Single"], {
      delimiter: "pipe",
      align: "center",
    });
    const lines = result.split("\n");
    expect(lines.length).toBe(3);
    expect(lines[0]).toBe("Line1│      ");
    expect(lines[1]).toBe("Line2│Single");
    expect(lines[2]).toBe("Line3│      ");
  });

  test("handles multi-line items with bottom alignment", () => {
    const result = hstack(["Line1\nLine2", "Single"], {
      delimiter: "pipe",
      align: "bottom",
    });
    const lines = result.split("\n");
    expect(lines.length).toBe(2);
    expect(lines[0]).toBe("Line1│      ");
    expect(lines[1]).toBe("Line2│Single");
  });

  test("handles StackItem objects with style functions", () => {
    const bold = (s: string) => `**${s}**`;
    const result = hstack([{ content: "styled", style: bold }, "plain"], {
      delimiter: "bullet",
      gap: 1,
    });
    expect(result).toBe("**styled** • plain");
  });
});

describe("createHStack", () => {
  test("returns StackBox with width and height for single-line", () => {
    const box = createHStack(["a", "b", "c"], { delimiter: "bullet", gap: 1 });
    expect(box.output).toBe("a • b • c");
    expect(box.width).toBe(9);
    expect(box.height).toBe(1);
  });

  test("returns StackBox with height for multi-line", () => {
    const box = createHStack(["Line1\nLine2", "Single"], { delimiter: "pipe" });
    expect(box.height).toBe(2);
  });
});

// ============================================================================
// Phase 2: Vertical Stack (vstack)
// ============================================================================

describe("vstackItem", () => {
  test("creates item with header only", () => {
    const item = vstackItem("Header");
    expect(item.content).toEqual(["Header"]);
    expect(item.state).toBe("default");
  });

  test("creates item with header and body", () => {
    const item = vstackItem("Header", ["Body line 1", "Body line 2"]);
    expect(item.content).toEqual(["Header", "Body line 1", "Body line 2"]);
  });

  test("creates item with state", () => {
    const item = vstackItem("Header", [], { state: "current" });
    expect(item.state).toBe("current");
  });

  test("creates item with explicit marker", () => {
    const item = vstackItem("Header", [], { marker: "star" });
    expect(item.marker).toBe("star");
  });

  test("creates item with compact representation", () => {
    const item = vstackItem("Header", ["Body"], {
      compact: "Header • Body",
    });
    expect(item.compact).toBe("Header • Body");
  });

  test("creates item with style function", () => {
    const bold = (s: string) => `**${s}**`;
    const item = vstackItem("Header", [], { style: bold });
    expect(item.style).toBe(bold);
  });
});

describe("DEFAULT_STACK_THEME", () => {
  test("has marker mappings for all states", () => {
    expect(DEFAULT_STACK_THEME.markers.default).toBe("circleOutline");
    expect(DEFAULT_STACK_THEME.markers.current).toBe("circleDot");
    expect(DEFAULT_STACK_THEME.markers.focused).toBe("pointer");
    expect(DEFAULT_STACK_THEME.markers.checked).toBe("checkboxChecked");
    expect(DEFAULT_STACK_THEME.markers.disabled).toBe("dash");
  });

  test("has default delimiter", () => {
    expect(DEFAULT_STACK_THEME.delimiter).toBe("bullet");
  });

  test("has default guide style", () => {
    expect(DEFAULT_STACK_THEME.guide).toBe("single");
  });
});

describe("vstack", () => {
  test("plain mode joins items with newlines", () => {
    const result = vstack(["Item 1", "Item 2", "Item 3"], { mode: "plain" });
    expect(result).toBe("Item 1\nItem 2\nItem 3");
  });

  test("plain mode with gap inserts blank lines", () => {
    const result = vstack(["Item 1", "Item 2"], { mode: "plain", gap: 1 });
    expect(result).toBe("Item 1\n\nItem 2");
  });

  test("guide mode adds vertical guide on body lines", () => {
    const items = [
      vstackItem("Header 1", ["Body line 1", "Body line 2"]),
      vstackItem("Header 2", ["Body line"]),
    ];
    const result = vstack(items, { mode: "guide" });
    const lines = result.split("\n");

    // First item
    expect(lines[0]).toBe("○ Header 1");
    expect(lines[1]).toBe("│ Body line 1");
    expect(lines[2]).toBe("│ Body line 2");
    expect(lines[3]).toBe("│");

    // Second item
    expect(lines[4]).toBe("○ Header 2");
    expect(lines[5]).toBe("│ Body line");
  });

  test("guide mode with current state uses circleDot marker", () => {
    const items = [
      vstackItem("Current", ["Body"], { state: "current" }),
      vstackItem("Default", ["Body"]),
    ];
    const result = vstack(items, { mode: "guide" });
    const lines = result.split("\n");

    expect(lines[0]).toBe("◉ Current");
    expect(lines[3]).toBe("○ Default");
  });

  test("guide mode with explicit marker overrides theme", () => {
    const items = [vstackItem("Custom", ["Body"], { marker: "★" })];
    const result = vstack(items, { mode: "guide" });
    const lines = result.split("\n");

    expect(lines[0]).toBe("★ Custom");
  });

  test("guide mode with known marker name", () => {
    const items = [vstackItem("Checked", [], { marker: "checkboxChecked" })];
    const result = vstack(items, { mode: "guide" });

    expect(result).toBe("☑ Checked");
  });

  test("tree mode uses fork and end markers", () => {
    const items = [
      vstackItem("First", ["Body 1"]),
      vstackItem("Last", ["Body 2"]),
    ];
    const result = vstack(items, { mode: "tree" });
    const lines = result.split("\n");

    expect(lines[0]).toBe("├── First");
    expect(lines[1]).toBe("│   Body 1");
    expect(lines[2]).toBe("└── Last");
    expect(lines[3]).toBe("    Body 2");
  });

  test("boxed mode wraps each item in a box", () => {
    const result = vstack(["Item 1", "Item 2"], { mode: "boxed" });

    expect(result).toContain("┌");
    expect(result).toContain("│ Item 1");
    expect(result).toContain("└");
    expect(result).toContain("│ Item 2");
  });

  test("compact mode uses compact field from items", () => {
    const items = [
      vstackItem("feature/auth", ["PR #190 (Draft)", "2 hours ago"], {
        state: "current",
        compact: "feature/auth • Draft • 2h ago",
      }),
      vstackItem("feature/api", ["PR #189"], {
        compact: "feature/api • 1d ago",
      }),
    ];
    const result = vstack(items, { mode: "compact" });
    const lines = result.split("\n");

    expect(lines[0]).toBe("◉ feature/auth • Draft • 2h ago");
    expect(lines[1]).toBe("○ feature/api • 1d ago");
  });

  test("compact mode falls back to header if no compact field", () => {
    const items = [vstackItem("Header only", ["Body ignored"])];
    const result = vstack(items, { mode: "compact" });

    expect(result).toBe("○ Header only");
  });

  test("custom theme overrides default markers", () => {
    const todoTheme = {
      markers: {
        default: "checkbox" as const,
        checked: "checkboxChecked" as const,
        current: "pointer" as const,
        focused: "pointer" as const,
        disabled: "dash" as const,
      },
    };
    const items = [
      vstackItem("Unchecked", [], { state: "default" }),
      vstackItem("Done", [], { state: "checked" }),
    ];
    const result = vstack(items, { mode: "plain", theme: todoTheme });
    const lines = result.split("\n");

    expect(lines[0]).toBe("☐ Unchecked");
    expect(lines[1]).toBe("☑ Done");
  });

  test("guide style shorthand sets tree guide style", () => {
    const items = [vstackItem("Heavy", ["Body"])];
    const result = vstack(items, { mode: "guide", guide: "heavy" });
    const lines = result.split("\n");

    expect(lines[0]).toBe("○ Heavy");
    expect(lines[1]).toBe("┃ Body");
  });

  test("different guide styles", () => {
    const items = [vstackItem("Header", ["Body"])];

    const single = vstack(items, { mode: "guide", guide: "single" });
    expect(single.split("\n")[1]).toBe("│ Body");

    const heavy = vstack(items, { mode: "guide", guide: "heavy" });
    expect(heavy.split("\n")[1]).toBe("┃ Body");

    const double = vstack(items, { mode: "guide", guide: "double" });
    expect(double.split("\n")[1]).toBe("║ Body");

    const rounded = vstack(items, { mode: "guide", guide: "rounded" });
    expect(rounded.split("\n")[1]).toBe("│ Body");
  });

  test("handles empty array", () => {
    const result = vstack([]);
    expect(result).toBe("");
  });

  test("handles single item", () => {
    const result = vstack(["Only item"], { mode: "plain" });
    expect(result).toBe("Only item");
  });

  test("applies style function to content", () => {
    const bold = (s: string) => `**${s}**`;
    const items = [vstackItem("Header", ["Body"], { style: bold })];
    const result = vstack(items, { mode: "guide" });
    const lines = result.split("\n");

    expect(lines[0]).toBe("○ **Header**");
    expect(lines[1]).toBe("│ **Body**");
  });
});

describe("createVStack", () => {
  test("returns StackBox with output, width, and height", () => {
    const box = createVStack(["Item 1", "Item 2"], { mode: "plain" });

    expect(box.output).toBe("Item 1\nItem 2");
    expect(box.height).toBe(2);
    expect(box.width).toBe(6); // "Item 1" is the widest
  });

  test("calculates width for guide mode", () => {
    const items = [vstackItem("Header", ["Body line"])];
    const box = createVStack(items, { mode: "guide" });

    // "○ Header" = 8 chars, "│ Body line" = 11 chars
    expect(box.width).toBe(11);
  });
});

// ============================================================================
// Box/Stack Integration
// ============================================================================

describe("isRenderable", () => {
  test("returns true for StackBox", () => {
    const { isRenderable } = require("../render/stack.js");
    const stack = createVStack(["Item"], { mode: "plain" });
    expect(isRenderable(stack)).toBe(true);
  });

  test("returns true for object with output/width/height", () => {
    const { isRenderable } = require("../render/stack.js");
    const box = { output: "test", width: 4, height: 1 };
    expect(isRenderable(box)).toBe(true);
  });

  test("returns false for plain string", () => {
    const { isRenderable } = require("../render/stack.js");
    expect(isRenderable("test")).toBe(false);
  });

  test("returns false for object missing properties", () => {
    const { isRenderable } = require("../render/stack.js");
    expect(isRenderable({ output: "test" })).toBe(false);
  });
});

describe("hstack with Renderable", () => {
  test("accepts StackBox directly", () => {
    const stack1 = createVStack(["A", "B"], { mode: "plain" });
    const stack2 = createVStack(["X", "Y"], { mode: "plain" });

    const result = hstack([stack1, stack2], { delimiter: "pipe", gap: 1 });
    const lines = result.split("\n");

    expect(lines[0]).toBe("A │ X");
    expect(lines[1]).toBe("B │ Y");
  });

  test("accepts mixed strings and StackBox", () => {
    const stack = createVStack(["Item"], { mode: "plain" });
    // gap: 1 with default space delimiter = " " + " " + " " = 3 spaces
    const result = hstack(["Label:", stack], { gap: 1 });
    expect(result).toBe("Label:   Item");

    // Without gap, just the space delimiter
    const result2 = hstack(["Label:", stack]);
    expect(result2).toBe("Label: Item");
  });

  test("accepts Box-like objects", () => {
    const box = { output: "BoxContent", width: 10, height: 1 };
    const result = hstack(["Before", box, "After"], {
      delimiter: "bullet",
      gap: 1,
    });

    expect(result).toBe("Before • BoxContent • After");
  });
});

describe("vstack with Renderable", () => {
  test("accepts StackBox directly", () => {
    const inner = createHStack(["a", "b"], { delimiter: "bullet", gap: 1 });
    const result = vstack([inner, "plain text"], { mode: "plain" });
    const lines = result.split("\n");

    expect(lines[0]).toBe("a • b");
    expect(lines[1]).toBe("plain text");
  });

  test("accepts Box-like objects", () => {
    const box = { output: "Line1\nLine2", width: 5, height: 2 };
    const result = vstack([box, "After"], { mode: "plain" });
    const lines = result.split("\n");

    expect(lines[0]).toBe("Line1");
    expect(lines[1]).toBe("Line2");
    expect(lines[2]).toBe("After");
  });
});

describe("nested composition", () => {
  test("StackBox inside createBox-like wrapper", () => {
    // Simulate what createBox does with a StackBox
    const stack = createVStack(
      [vstackItem("Item 1", [], { state: "current" }), vstackItem("Item 2")],
      { mode: "guide" }
    );

    // The output should be usable directly
    expect(stack.output).toContain("◉ Item 1");
    expect(stack.output).toContain("○ Item 2");
    expect(stack.height).toBeGreaterThan(1);
    expect(stack.width).toBeGreaterThan(0);
  });

  test("hstack of vstacks creates grid-like layout", () => {
    const col1 = createVStack(["A1", "A2", "A3"], { mode: "plain" });
    const col2 = createVStack(["B1", "B2", "B3"], { mode: "plain" });
    const col3 = createVStack(["C1", "C2", "C3"], { mode: "plain" });

    const grid = hstack([col1, col2, col3], { delimiter: "pipe", gap: 1 });
    const lines = grid.split("\n");

    expect(lines[0]).toBe("A1 │ B1 │ C1");
    expect(lines[1]).toBe("A2 │ B2 │ C2");
    expect(lines[2]).toBe("A3 │ B3 │ C3");
  });
});

// ============================================================================
// boxify / unbox helpers
// ============================================================================

describe("boxify", () => {
  test("wraps a string in a box", () => {
    const { boxify } = require("../render/stack.js");
    const box = boxify("Hello");

    expect(box.output).toContain("┌");
    expect(box.output).toContain("Hello");
    expect(box.output).toContain("└");
    expect(box.width).toBeGreaterThan(0);
    expect(box.height).toBeGreaterThan(0);
  });

  test("wraps a StackBox in a box", () => {
    const { boxify } = require("../render/stack.js");
    const stack = createVStack(["Item 1", "Item 2"], { mode: "plain" });
    const box = boxify(stack, { title: "Items" });

    expect(box.output).toContain("Items");
    expect(box.output).toContain("Item 1");
    expect(box.output).toContain("Item 2");
  });

  test("accepts border style option", () => {
    const { boxify } = require("../render/stack.js");
    const box = boxify("Content", { border: "double" });

    expect(box.output).toContain("╔");
    expect(box.output).toContain("╚");
  });

  test("accepts rounded border", () => {
    const { boxify } = require("../render/stack.js");
    const box = boxify("Content", { border: "rounded" });

    expect(box.output).toContain("╭");
    expect(box.output).toContain("╰");
  });

  test("boxified content can be used in hstack", () => {
    const { boxify } = require("../render/stack.js");
    const box1 = boxify("A");
    const box2 = boxify("B");

    const result = hstack([box1, box2], { gap: 1 });
    expect(result).toContain("A");
    expect(result).toContain("B");
  });
});

describe("unbox", () => {
  test("extracts output from Renderable", () => {
    const { unbox } = require("../render/stack.js");
    const stack = createVStack(["Line 1", "Line 2"], { mode: "plain" });

    const raw = unbox(stack);

    expect(raw).toBe("Line 1\nLine 2");
    expect(typeof raw).toBe("string");
  });

  test("passes through strings unchanged", () => {
    const { unbox } = require("../render/stack.js");

    expect(unbox("already a string")).toBe("already a string");
  });

  test("works with boxified content", () => {
    const { boxify, unbox } = require("../render/stack.js");
    const box = boxify("Content", { border: "single" });

    const raw = unbox(box);

    expect(typeof raw).toBe("string");
    expect(raw).toContain("Content");
    expect(raw).toContain("┌");
  });
});
