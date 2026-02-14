/**
 * Theme resolution utilities.
 *
 * @packageDocumentation
 */

import { getIndicator, isUnicodeSupported } from "../render/indicators.js";
import type { GlyphPair, SemanticState, VisualTheme } from "./types.js";

/**
 * Resolves a glyph pair to a single character based on terminal capability.
 *
 * Uses terminal detection to choose between unicode and fallback characters.
 * Can be overridden with the `forceUnicode` parameter.
 *
 * @param glyph - The glyph pair to resolve
 * @param forceUnicode - Override terminal detection (true = unicode, false = fallback)
 * @returns The appropriate character for the terminal
 *
 * @example
 * ```typescript
 * const bullet: GlyphPair = { unicode: "•", fallback: "*" };
 *
 * // Auto-detect terminal capability
 * resolveGlyph(bullet);       // "•" or "*" based on terminal
 *
 * // Force unicode
 * resolveGlyph(bullet, true);  // "•"
 *
 * // Force fallback
 * resolveGlyph(bullet, false); // "*"
 * ```
 */
export function resolveGlyph(glyph: GlyphPair, forceUnicode?: boolean): string {
  const useUnicode = forceUnicode ?? isUnicodeSupported();
  return useUnicode ? glyph.unicode : glyph.fallback;
}

/**
 * Resolves a semantic state to its visual marker character.
 *
 * Looks up the marker specification in the theme and returns the
 * appropriate character. Supports both indicator-type markers (from
 * the INDICATORS registry) and custom glyph pairs.
 *
 * @param theme - The visual theme containing marker definitions
 * @param state - The semantic state to resolve
 * @param forceUnicode - Override terminal detection
 * @returns The marker character for the given state
 *
 * @example
 * ```typescript
 * import { defaultTheme, resolveStateMarker } from "@outfitter/cli/theme";
 *
 * // Resolve success marker (indicator-type)
 * resolveStateMarker(defaultTheme, "success", true);  // "✔"
 * resolveStateMarker(defaultTheme, "success", false); // "[ok]"
 *
 * // Resolve with custom theme marker
 * const theme = createVisualTheme({
 *   overrides: {
 *     markers: {
 *       current: { type: "custom", glyph: { unicode: "★", fallback: "*" } }
 *     }
 *   }
 * });
 * resolveStateMarker(theme, "current", true); // "★"
 * ```
 */
export function resolveStateMarker(
  theme: VisualTheme,
  state: SemanticState,
  forceUnicode?: boolean
): string {
  // Get marker spec for the state, fall back to "default" if not found
  const markerSpec = theme.markers[state] ?? theme.markers.default;

  if (markerSpec.type === "indicator") {
    return getIndicator(markerSpec.category, markerSpec.name, forceUnicode);
  }

  // Custom glyph
  return resolveGlyph(markerSpec.glyph, forceUnicode);
}
