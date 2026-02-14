/**
 * Default visual theme preset.
 *
 * Standard theme with single-line borders, standard indicators,
 * and bullet delimiters.
 *
 * @packageDocumentation
 */

import { ANSI } from "@outfitter/cli/colors";
import { BORDERS } from "../../render/borders.js";
import type { VisualTheme } from "../types.js";

/**
 * Default visual theme.
 *
 * Features:
 * - Single-line box-drawing borders (┌─┐)
 * - Standard status indicators
 * - Bullet delimiters
 * - Dots spinner
 *
 * @example
 * ```typescript
 * import { defaultTheme } from "@outfitter/cli/theme/presets";
 *
 * // Use default styling
 * const box = renderBox("Hello", { border: defaultTheme.border });
 * ```
 */
export const defaultTheme: VisualTheme = {
  name: "default",

  // Structure
  border: "single",
  borderChars: BORDERS.single,
  treeGuide: "single",
  delimiter: "bullet",

  // Markers (semantic state → visual)
  markers: {
    default: { type: "indicator", category: "marker", name: "circleOutline" },
    current: { type: "indicator", category: "marker", name: "circleDot" },
    focused: { type: "indicator", category: "marker", name: "pointer" },
    checked: { type: "indicator", category: "marker", name: "checkboxChecked" },
    disabled: { type: "indicator", category: "marker", name: "dash" },
    success: { type: "indicator", category: "status", name: "success" },
    warning: { type: "indicator", category: "status", name: "warning" },
    error: { type: "indicator", category: "status", name: "error" },
    info: { type: "indicator", category: "status", name: "info" },
  },

  // List glyphs
  listBullet: { unicode: "•", fallback: "-" },
  checkbox: {
    checked: { unicode: "☑", fallback: "[x]" },
    unchecked: { unicode: "☐", fallback: "[ ]" },
  },

  // Colors (ANSI codes)
  colors: {
    success: ANSI.green,
    warning: ANSI.yellow,
    error: ANSI.red,
    info: ANSI.blue,
    primary: "",
    secondary: ANSI.gray,
    muted: ANSI.dim,
    accent: ANSI.cyan,
    highlight: ANSI.bold,
    link: `${ANSI.cyan}${ANSI.underline}`,
    destructive: ANSI.brightRed,
    subtle: `${ANSI.dim}${ANSI.gray}`,
  },

  // Spacing defaults
  spacing: {
    boxPadding: 1,
    listIndent: 2,
    stackGap: 0,
    horizontalGap: 1,
  },

  // Spinner
  spinner: "dots",
};
