/**
 * Full preset for @outfitter/cli.
 *
 * Includes everything from the standard preset plus less common primitives:
 * - Tree: Hierarchical data visualization
 * - Borders: Border character sets and line drawing
 *
 * @example
 * ```typescript
 * import {
 *   createTheme,
 *   renderTable,
 *   renderTree,
 *   BORDERS,
 *   getBorderCharacters,
 * } from "@outfitter/cli/preset/full";
 *
 * const theme = createTheme();
 * console.log(renderTree({ src: { lib: null }, tests: null }));
 * console.log(getBorderCharacters("rounded"));
 * ```
 *
 * @packageDocumentation
 */

// biome-ignore lint/performance/noBarrelFile: intentional preset aggregation
export {
  BORDERS,
  type BorderStyle,
  getBorderCharacters,
} from "../borders/index.js";

export { renderTree } from "../tree/index.js";
export * from "./standard.js";
