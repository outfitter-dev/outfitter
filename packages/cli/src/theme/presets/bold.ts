/**
 * Bold visual theme preset.
 *
 * Heavy borders with strong contrast.
 *
 * @packageDocumentation
 */

import { BORDERS } from "../../render/borders.js";
import type { VisualTheme } from "../types.js";
import { defaultTheme } from "./default.js";

/**
 * Bold visual theme.
 *
 * Features:
 * - Heavy/thick box-drawing borders (┏━┓)
 * - Heavy tree guide style
 * - Strong visual weight
 *
 * Inherits all other properties from {@link defaultTheme}.
 *
 * @example
 * ```typescript
 * import { boldTheme } from "@outfitter/cli/theme/presets";
 *
 * // Use bold styling
 * const box = renderBox("Hello", { border: boldTheme.border });
 * // ┏━━━━━━━┓
 * // ┃ Hello ┃
 * // ┗━━━━━━━┛
 * ```
 */
export const boldTheme: VisualTheme = {
  ...defaultTheme,
  name: "bold",

  // Structure overrides
  border: "heavy",
  borderChars: BORDERS.heavy,
  treeGuide: "heavy",
};
