/**
 * Minimal visual theme preset.
 *
 * ASCII-only, low-chrome theme for limited terminals.
 *
 * @packageDocumentation
 */

import { BORDERS } from "../../render/borders.js";
import type { VisualTheme } from "../types.js";
import { defaultTheme } from "./default.js";

/**
 * Minimal visual theme.
 *
 * Features:
 * - ASCII-only borders (+, -, |)
 * - ASCII-safe list bullets and checkboxes
 * - Line spinner (ASCII-compatible)
 * - No unicode characters anywhere
 *
 * Use this theme when targeting terminals without unicode support
 * or when running in CI/log environments.
 *
 * @example
 * ```typescript
 * import { minimalTheme } from "@outfitter/cli/theme/presets";
 *
 * // Use ASCII-safe styling
 * const box = renderBox("Hello", { border: minimalTheme.border });
 * // +-------+
 * // | Hello |
 * // +-------+
 * ```
 */
export const minimalTheme: VisualTheme = {
  ...defaultTheme,
  name: "minimal",

  // Structure overrides - ASCII only
  border: "ascii",
  borderChars: BORDERS.ascii,
  treeGuide: "single", // Uses unicode but will fallback
  delimiter: "bullet",

  // Markers - use same indicator references, they have fallbacks
  markers: {
    ...defaultTheme.markers,
  },

  // List glyphs - ASCII safe
  listBullet: { unicode: "-", fallback: "-" },
  checkbox: {
    checked: { unicode: "[x]", fallback: "[x]" },
    unchecked: { unicode: "[ ]", fallback: "[ ]" },
  },

  // Spinner - ASCII compatible
  spinner: "line",
};
