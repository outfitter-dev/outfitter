/**
 * Tests for Visual Theme System.
 *
 * @packageDocumentation
 */

import { describe, expect, test } from "bun:test";
// Phase 1: Types and Presets
// Phase 2: Factory and Resolution
// Phase 3: Context Integration
import {
  boldTheme,
  createThemedContext,
  createVisualTheme,
  defaultTheme,
  type GlyphPair,
  getContextTheme,
  type MarkerSpec,
  minimalTheme,
  resolveGlyph,
  resolveStateMarker,
  roundedTheme,
  type SemanticState,
  type ThemedLayoutContext,
  type VisualTheme,
} from "../theme/index.js";

// ============================================================================
// Phase 1: Types and Presets
// ============================================================================

describe("VisualTheme types", () => {
  test("VisualTheme has all required properties", () => {
    const theme: VisualTheme = defaultTheme;

    // Structure
    expect(theme.name).toBeDefined();
    expect(theme.border).toBeDefined();
    expect(theme.borderChars).toBeDefined();
    expect(theme.treeGuide).toBeDefined();
    expect(theme.delimiter).toBeDefined();

    // Markers
    expect(theme.markers).toBeDefined();
    expect(theme.listBullet).toBeDefined();
    expect(theme.checkbox).toBeDefined();

    // Colors
    expect(theme.colors).toBeDefined();
    expect(theme.colors.success).toBeDefined();
    expect(theme.colors.warning).toBeDefined();
    expect(theme.colors.error).toBeDefined();
    expect(theme.colors.info).toBeDefined();
    expect(theme.colors.primary).toBeDefined();
    expect(theme.colors.secondary).toBeDefined();
    expect(theme.colors.muted).toBeDefined();
    expect(theme.colors.accent).toBeDefined();
    expect(theme.colors.highlight).toBeDefined();
    expect(theme.colors.link).toBeDefined();
    expect(theme.colors.destructive).toBeDefined();
    expect(theme.colors.subtle).toBeDefined();

    // Spacing
    expect(theme.spacing).toBeDefined();
    expect(theme.spacing.boxPadding).toBeDefined();
    expect(theme.spacing.listIndent).toBeDefined();
    expect(theme.spacing.stackGap).toBeDefined();
    expect(theme.spacing.horizontalGap).toBeDefined();

    // Spinner
    expect(theme.spinner).toBeDefined();
  });

  test("GlyphPair has unicode and fallback", () => {
    const glyph: GlyphPair = { unicode: "•", fallback: "*" };
    expect(glyph.unicode).toBe("•");
    expect(glyph.fallback).toBe("*");
  });

  test("SemanticState includes all expected states", () => {
    const states: SemanticState[] = [
      "default",
      "current",
      "focused",
      "checked",
      "disabled",
      "success",
      "warning",
      "error",
      "info",
    ];

    // Verify all states exist in defaultTheme.markers
    for (const state of states) {
      expect(defaultTheme.markers[state]).toBeDefined();
    }
  });

  test("MarkerSpec supports indicator type", () => {
    const indicatorMarker: MarkerSpec = {
      type: "indicator",
      category: "status",
      name: "success",
    };
    expect(indicatorMarker.type).toBe("indicator");
    expect(indicatorMarker.category).toBe("status");
    expect(indicatorMarker.name).toBe("success");
  });

  test("MarkerSpec supports custom type", () => {
    const customMarker: MarkerSpec = {
      type: "custom",
      glyph: { unicode: "★", fallback: "*" },
    };
    expect(customMarker.type).toBe("custom");
    expect(customMarker.glyph.unicode).toBe("★");
    expect(customMarker.glyph.fallback).toBe("*");
  });
});

describe("Preset themes", () => {
  test("defaultTheme has all required properties", () => {
    expect(defaultTheme.name).toBe("default");
    expect(defaultTheme.border).toBe("single");
    expect(defaultTheme.treeGuide).toBe("single");
    expect(defaultTheme.delimiter).toBe("bullet");
    expect(defaultTheme.spinner).toBe("dots");
  });

  test("defaultTheme borderChars match single style", () => {
    expect(defaultTheme.borderChars.topLeft).toBe("┌");
    expect(defaultTheme.borderChars.topRight).toBe("┐");
    expect(defaultTheme.borderChars.bottomLeft).toBe("└");
    expect(defaultTheme.borderChars.bottomRight).toBe("┘");
    expect(defaultTheme.borderChars.horizontal).toBe("─");
    expect(defaultTheme.borderChars.vertical).toBe("│");
  });

  test("roundedTheme uses rounded borders", () => {
    expect(roundedTheme.name).toBe("rounded");
    expect(roundedTheme.border).toBe("rounded");
    expect(roundedTheme.treeGuide).toBe("rounded");
    expect(roundedTheme.borderChars.topLeft).toBe("╭");
    expect(roundedTheme.borderChars.topRight).toBe("╮");
    expect(roundedTheme.borderChars.bottomLeft).toBe("╰");
    expect(roundedTheme.borderChars.bottomRight).toBe("╯");
  });

  test("minimalTheme uses ASCII-only glyphs", () => {
    expect(minimalTheme.name).toBe("minimal");
    expect(minimalTheme.border).toBe("ascii");

    // List bullet should have ASCII-safe fallbacks
    expect(minimalTheme.listBullet.unicode).toBe("-");
    expect(minimalTheme.listBullet.fallback).toBe("-");

    // Checkbox should be ASCII-safe
    expect(minimalTheme.checkbox.unchecked.unicode).toBe("[ ]");
    expect(minimalTheme.checkbox.checked.unicode).toBe("[x]");

    // Spinner should be ASCII-compatible
    expect(minimalTheme.spinner).toBe("line");
  });

  test("boldTheme uses heavy borders", () => {
    expect(boldTheme.name).toBe("bold");
    expect(boldTheme.border).toBe("heavy");
    expect(boldTheme.borderChars.topLeft).toBe("┏");
    expect(boldTheme.borderChars.horizontal).toBe("━");
    expect(boldTheme.borderChars.vertical).toBe("┃");
  });

  test("all presets have valid color definitions", () => {
    const themes = [defaultTheme, roundedTheme, minimalTheme, boldTheme];

    for (const theme of themes) {
      // Colors should be strings (ANSI codes or empty)
      expect(typeof theme.colors.success).toBe("string");
      expect(typeof theme.colors.warning).toBe("string");
      expect(typeof theme.colors.error).toBe("string");
      expect(typeof theme.colors.info).toBe("string");
    }
  });
});

// ============================================================================
// Phase 2: Factory and Resolution
// ============================================================================

describe("createVisualTheme", () => {
  test("with no options returns defaultTheme", () => {
    const theme = createVisualTheme();
    expect(theme.name).toBe("default");
    expect(theme.border).toBe("single");
  });

  test("with extends merges correctly", () => {
    const theme = createVisualTheme({
      extends: roundedTheme,
    });
    expect(theme.border).toBe("rounded");
    expect(theme.treeGuide).toBe("rounded");
  });

  test("with overrides applies changes", () => {
    const theme = createVisualTheme({
      overrides: {
        border: "double",
        delimiter: "arrow",
      },
    });
    expect(theme.border).toBe("double");
    expect(theme.delimiter).toBe("arrow");
  });

  test("overrides take precedence over extends", () => {
    const theme = createVisualTheme({
      extends: roundedTheme,
      overrides: {
        border: "heavy",
      },
    });
    expect(theme.border).toBe("heavy");
    // Other properties should come from rounded
    expect(theme.treeGuide).toBe("rounded");
  });

  test("updates borderChars when border changes", () => {
    const theme = createVisualTheme({
      overrides: {
        border: "double",
      },
    });
    expect(theme.borderChars.topLeft).toBe("╔");
    expect(theme.borderChars.horizontal).toBe("═");
  });

  test("deep merges colors", () => {
    const theme = createVisualTheme({
      overrides: {
        colors: {
          success: "\x1b[38;5;82m", // Custom green
        },
      },
    });
    expect(theme.colors.success).toBe("\x1b[38;5;82m");
    // Other colors should remain from default
    expect(theme.colors.error).toBe(defaultTheme.colors.error);
  });

  test("deep merges spacing", () => {
    const theme = createVisualTheme({
      overrides: {
        spacing: {
          boxPadding: 2,
        },
      },
    });
    expect(theme.spacing.boxPadding).toBe(2);
    // Other spacing should remain from default
    expect(theme.spacing.listIndent).toBe(defaultTheme.spacing.listIndent);
  });

  test("deep merges markers", () => {
    const customMarker: MarkerSpec = {
      type: "custom",
      glyph: { unicode: "★", fallback: "*" },
    };
    const theme = createVisualTheme({
      overrides: {
        markers: {
          current: customMarker,
        },
      },
    });
    expect(theme.markers.current).toEqual(customMarker);
    // Other markers should remain from default
    expect(theme.markers.default).toEqual(defaultTheme.markers.default);
  });

  test("can set custom name", () => {
    const theme = createVisualTheme({
      overrides: {
        name: "my-brand",
      },
    });
    expect(theme.name).toBe("my-brand");
  });
});

describe("resolveGlyph", () => {
  const glyph: GlyphPair = { unicode: "•", fallback: "*" };

  test("returns unicode when supported", () => {
    const result = resolveGlyph(glyph, true);
    expect(result).toBe("•");
  });

  test("returns fallback when not supported", () => {
    const result = resolveGlyph(glyph, false);
    expect(result).toBe("*");
  });

  test("auto-detects terminal capability by default", () => {
    // This will return one or the other based on terminal
    const result = resolveGlyph(glyph);
    expect(result === "•" || result === "*").toBe(true);
  });
});

describe("resolveStateMarker", () => {
  test("resolves indicator-type markers", () => {
    const theme = createVisualTheme();
    const result = resolveStateMarker(theme, "success", true);
    // Success uses status.success indicator → "✔"
    expect(result).toBe("✔");
  });

  test("resolves custom-type markers", () => {
    const customMarker: MarkerSpec = {
      type: "custom",
      glyph: { unicode: "★", fallback: "*" },
    };
    const theme = createVisualTheme({
      overrides: {
        markers: {
          current: customMarker,
        },
      },
    });
    const result = resolveStateMarker(theme, "current", true);
    expect(result).toBe("★");
  });

  test("uses fallback for custom markers when unicode not supported", () => {
    const customMarker: MarkerSpec = {
      type: "custom",
      glyph: { unicode: "★", fallback: "*" },
    };
    const theme = createVisualTheme({
      overrides: {
        markers: {
          current: customMarker,
        },
      },
    });
    const result = resolveStateMarker(theme, "current", false);
    expect(result).toBe("*");
  });

  test("falls back to default state when state not found", () => {
    const theme = createVisualTheme();
    // Using type assertion for testing edge case
    const result = resolveStateMarker(
      theme,
      "nonexistent" as SemanticState,
      true
    );
    // Should fall back to default marker
    expect(typeof result).toBe("string");
  });
});

// ============================================================================
// Phase 3: Context Integration
// ============================================================================

describe("createThemedContext", () => {
  test("with theme sets theme", () => {
    const ctx = createThemedContext({ theme: roundedTheme, width: 80 });
    expect(ctx.theme).toBe(roundedTheme);
    expect(ctx.width).toBe(80);
  });

  test("with parent inherits theme", () => {
    const parent = createThemedContext({ theme: roundedTheme, width: 100 });
    const child = createThemedContext({ width: 50, parent });
    expect(child.theme).toBe(roundedTheme);
    expect(child.parent).toBe(parent);
  });

  test("with explicit theme overrides parent", () => {
    const parent = createThemedContext({ theme: roundedTheme, width: 100 });
    const child = createThemedContext({ theme: boldTheme, width: 50, parent });
    expect(child.theme).toBe(boldTheme);
  });

  test("defaults to defaultTheme when no theme or parent", () => {
    const ctx = createThemedContext({ width: 80 });
    expect(ctx.theme).toBe(defaultTheme);
  });

  test("inherits width from parent when not specified", () => {
    const parent = createThemedContext({ theme: defaultTheme, width: 100 });
    const child = createThemedContext({ parent });
    // Child should calculate width based on parent
    expect(child.width).toBeLessThanOrEqual(parent.width);
  });
});

describe("getContextTheme", () => {
  test("returns theme from context", () => {
    const ctx = createThemedContext({ theme: roundedTheme, width: 80 });
    expect(getContextTheme(ctx)).toBe(roundedTheme);
  });

  test("returns defaultTheme when no context", () => {
    expect(getContextTheme()).toBe(defaultTheme);
    expect(getContextTheme(undefined)).toBe(defaultTheme);
  });
});

describe("ThemedLayoutContext", () => {
  test("extends LayoutContext with theme", () => {
    const ctx: ThemedLayoutContext = createThemedContext({
      theme: defaultTheme,
      width: 80,
    });

    // Has LayoutContext properties
    expect(ctx.width).toBe(80);

    // Has theme property
    expect(ctx.theme).toBeDefined();
    expect(ctx.theme.name).toBe("default");
  });

  test("parent can be ThemedLayoutContext", () => {
    const parent = createThemedContext({ theme: roundedTheme, width: 100 });
    const child = createThemedContext({ width: 50, parent });

    expect(child.parent).toBe(parent);
    expect((child.parent as ThemedLayoutContext).theme).toBe(roundedTheme);
  });
});
