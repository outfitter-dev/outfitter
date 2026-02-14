/**
 * Visual Theme System.
 *
 * Provides a unified design system for CLI visual primitives including
 * borders, delimiters, markers, guides, colors, and spacing.
 *
 * @example
 * ```typescript
 * import {
 *   defaultTheme,
 *   roundedTheme,
 *   createVisualTheme,
 *   createThemedContext,
 *   resolveGlyph,
 * } from "@outfitter/cli/theme";
 *
 * // Use a preset theme
 * const box = renderBox("Hello", { theme: roundedTheme });
 *
 * // Create a custom theme
 * const brandTheme = createVisualTheme({
 *   extends: roundedTheme,
 *   overrides: {
 *     colors: { success: "\x1b[38;5;82m" },
 *     spacing: { boxPadding: 2 },
 *   },
 * });
 *
 * // Create themed context for cascading
 * const ctx = createThemedContext({ theme: brandTheme, width: 80 });
 * ```
 *
 * @packageDocumentation
 */

// Context
// biome-ignore lint/performance/noBarrelFile: intentional re-exports for subpath API
export {
  createThemedContext,
  getContextTheme,
  type ThemedContextOptions,
  type ThemedLayoutContext,
} from "./context.js";
// Factory
export { type CreateVisualThemeOptions, createVisualTheme } from "./create.js";
// Presets
export {
  boldTheme,
  defaultTheme,
  minimalTheme,
  roundedTheme,
} from "./presets/index.js";

// Resolution
export { resolveGlyph, resolveStateMarker } from "./resolve.js";
// Types
export type {
  GlyphPair,
  MarkerSpec,
  PartialVisualTheme,
  SemanticState,
  ThemeColors,
  ThemeSpacing,
  VisualTheme,
} from "./types.js";
