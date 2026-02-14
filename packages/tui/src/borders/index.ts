/**
 * Borders submodule for @outfitter/cli.
 *
 * Provides border character sets and line drawing utilities for tables and boxes.
 *
 * @example
 * ```typescript
 * import {
 *   BORDERS,
 *   getBorderCharacters,
 *   drawHorizontalLine,
 *   type BorderStyle,
 *   type BorderCharacters,
 * } from "@outfitter/cli/borders";
 *
 * // Get rounded border characters
 * const chars = getBorderCharacters("rounded");
 * console.log(chars.topLeft); // ╭
 *
 * // Draw a horizontal line
 * const line = drawHorizontalLine(20, chars, "top");
 * console.log(line); // ╭────────────────────╮
 * ```
 *
 * @packageDocumentation
 */

// biome-ignore lint/performance/noBarrelFile: intentional re-exports for subpath API
export {
  BORDERS,
  type BorderCharacters,
  type BorderStyle,
  drawHorizontalLine,
  getBorderCharacters,
  type LinePosition,
} from "../render/borders.js";
