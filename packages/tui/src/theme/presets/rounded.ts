/**
 * Rounded visual theme preset.
 *
 * Softer aesthetic with rounded corners.
 *
 * @packageDocumentation
 */

import { BORDERS } from "../../render/borders.js";
import type { VisualTheme } from "../types.js";
import { defaultTheme } from "./default.js";

/**
 * Rounded visual theme.
 *
 * Features:
 * - Rounded box-drawing corners (╭─╮)
 * - Rounded tree guide style
 * - Softer visual aesthetic
 *
 * Inherits all other properties from {@link defaultTheme}.
 *
 * @example
 * ```typescript
 * import { roundedTheme } from "@outfitter/cli/theme/presets";
 *
 * // Use rounded styling
 * const box = renderBox("Hello", { border: roundedTheme.border });
 * // ╭───────╮
 * // │ Hello │
 * // ╰───────╯
 * ```
 */
export const roundedTheme: VisualTheme = {
  ...defaultTheme,
  name: "rounded",

  // Structure overrides
  border: "rounded",
  borderChars: BORDERS.rounded,
  treeGuide: "rounded",
};
