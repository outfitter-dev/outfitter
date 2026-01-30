/**
 * Visual Theme System types.
 *
 * Provides interfaces for unified visual primitives across CLI components.
 *
 * @packageDocumentation
 */

import type { BorderCharacters, BorderStyle } from "../render/borders.js";
import type { IndicatorCategory } from "../render/indicators.js";
import type { SpinnerStyle } from "../render/spinner.js";
import type { DelimiterName } from "../render/stack.js";
import type { TreeGuideStyle } from "../render/tree.js";

// ============================================================================
// Glyph Types
// ============================================================================

/**
 * A glyph with unicode and ASCII fallback representations.
 *
 * Used for characters that may not be available in all terminals.
 * The appropriate character is selected at runtime based on terminal capability.
 *
 * @example
 * ```typescript
 * const bullet: GlyphPair = { unicode: "•", fallback: "*" };
 * const checkbox: GlyphPair = { unicode: "☑", fallback: "[x]" };
 * ```
 */
export interface GlyphPair {
  /** Unicode character for modern terminals */
  unicode: string;
  /** ASCII fallback for limited terminals */
  fallback: string;
}

// ============================================================================
// Semantic State
// ============================================================================

/**
 * Semantic states that can be mapped to visual markers.
 *
 * These represent the logical state of an item, which themes translate
 * to specific visual representations.
 */
export type SemanticState =
  | "default"
  | "current"
  | "focused"
  | "checked"
  | "disabled"
  | "success"
  | "warning"
  | "error"
  | "info";

// ============================================================================
// Marker Specification
// ============================================================================

/**
 * Specification for how to render a semantic state marker.
 *
 * Can either reference an existing indicator from the INDICATORS registry,
 * or provide a custom glyph pair.
 *
 * @example
 * ```typescript
 * // Reference existing indicator
 * const successMarker: MarkerSpec = {
 *   type: "indicator",
 *   category: "status",
 *   name: "success"
 * };
 *
 * // Custom glyph
 * const starMarker: MarkerSpec = {
 *   type: "custom",
 *   glyph: { unicode: "★", fallback: "*" }
 * };
 * ```
 */
export type MarkerSpec =
  | {
      type: "indicator";
      category: IndicatorCategory;
      name: string;
    }
  | {
      type: "custom";
      glyph: GlyphPair;
    };

// ============================================================================
// Theme Colors
// ============================================================================

/**
 * Semantic color tokens as ANSI escape codes.
 *
 * Colors are stored as raw ANSI codes and can be empty strings
 * when colors are disabled.
 */
export interface ThemeColors {
  /** Green - success messages, completed items */
  success: string;
  /** Yellow - warnings, caution */
  warning: string;
  /** Red - errors, failures */
  error: string;
  /** Blue - informational messages */
  info: string;
  /** Default text color (typically empty string) */
  primary: string;
  /** Gray - secondary text */
  secondary: string;
  /** Dim - de-emphasized text */
  muted: string;
  /** Cyan - interactive elements, highlights */
  accent: string;
  /** Bold - strong emphasis */
  highlight: string;
  /** Cyan + underline - URLs, clickable references */
  link: string;
  /** Bright red - dangerous actions */
  destructive: string;
  /** Dim gray - less prominent than muted */
  subtle: string;
}

// ============================================================================
// Theme Spacing
// ============================================================================

/**
 * Default spacing values for various components.
 */
export interface ThemeSpacing {
  /** Default padding inside boxes (characters) */
  boxPadding: number;
  /** Indentation for nested list items (characters) */
  listIndent: number;
  /** Gap between items in vertical stacks (lines) */
  stackGap: number;
  /** Gap between items in horizontal stacks (characters) */
  horizontalGap: number;
}

// ============================================================================
// Visual Theme
// ============================================================================

/**
 * Complete visual theme configuration.
 *
 * Consolidates all visual primitives (borders, delimiters, markers, guides,
 * colors) into a cohesive design system. Themes can be used as-is (presets)
 * or customized via {@link createVisualTheme}.
 *
 * @example
 * ```typescript
 * import { defaultTheme, roundedTheme, createVisualTheme } from "@outfitter/cli/theme";
 *
 * // Use a preset
 * const box = renderBox("Hello", { theme: roundedTheme });
 *
 * // Create a custom theme
 * const brandTheme = createVisualTheme({
 *   extends: roundedTheme,
 *   overrides: {
 *     colors: { accent: "\x1b[38;5;39m" },
 *     spacing: { boxPadding: 2 }
 *   }
 * });
 * ```
 */
export interface VisualTheme {
  /** Theme identifier */
  name: string;

  // Structure
  /** Border style preset name */
  border: BorderStyle;
  /** Derived border characters for the border style */
  borderChars: BorderCharacters;
  /** Tree guide style for hierarchical displays */
  treeGuide: TreeGuideStyle;
  /** Default delimiter for inline separators */
  delimiter: DelimiterName;

  // Markers (semantic state → visual)
  /** Map of semantic states to marker specifications */
  markers: Record<SemanticState, MarkerSpec>;
  /** Default list bullet glyph */
  listBullet: GlyphPair;
  /** Checkbox glyphs for checked/unchecked states */
  checkbox: {
    checked: GlyphPair;
    unchecked: GlyphPair;
  };

  // Colors (semantic → ANSI codes)
  /** Semantic color tokens */
  colors: ThemeColors;

  // Spacing defaults
  /** Default spacing values */
  spacing: ThemeSpacing;

  // Spinner
  /** Default spinner animation style */
  spinner: SpinnerStyle;
}

// ============================================================================
// Partial Theme (for overrides)
// ============================================================================

/**
 * Partial theme for overriding specific properties.
 *
 * Used by {@link createVisualTheme} to allow partial customization
 * while inheriting defaults.
 */
export type PartialVisualTheme = {
  [K in keyof VisualTheme]?: K extends "colors"
    ? Partial<ThemeColors>
    : K extends "spacing"
      ? Partial<ThemeSpacing>
      : K extends "markers"
        ? Partial<Record<SemanticState, MarkerSpec>>
        : K extends "checkbox"
          ? Partial<VisualTheme["checkbox"]>
          : VisualTheme[K];
};
