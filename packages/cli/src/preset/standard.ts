/**
 * Standard preset for @outfitter/cli.
 *
 * Provides commonly used CLI primitives for most use cases:
 * - Colors: Theme creation and ANSI escape codes
 * - Table: Tabular data rendering
 * - List: Bullet and numbered lists
 * - Box: Bordered panels
 *
 * @example
 * ```typescript
 * import {
 *   createTheme,
 *   renderTable,
 *   renderList,
 *   renderBox,
 * } from "@outfitter/cli/preset/standard";
 *
 * const theme = createTheme();
 * console.log(theme.success("Done!"));
 * console.log(renderTable([{ id: 1, name: "Alice" }]));
 * console.log(renderList(["Item 1", "Item 2"]));
 * console.log(renderBox("Hello, world!", { title: "Greeting" }));
 * ```
 *
 * @packageDocumentation
 */

// biome-ignore lint/performance/noBarrelFile: intentional preset aggregation
export { type BoxOptions, renderBox } from "../box/index.js";
export {
  ANSI,
  createTheme,
  type Theme,
  type Tokens,
} from "../colors/index.js";

export {
  type ListOptions,
  type ListStyle,
  renderList,
} from "../list/index.js";
export { renderTable, type TableOptions } from "../table/index.js";
