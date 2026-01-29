/**
 * List submodule for @outfitter/cli.
 *
 * Provides list rendering utilities with multiple styles and nesting support.
 *
 * @example
 * ```typescript
 * import { renderList, type ListStyle, type ListOptions } from "@outfitter/cli/list";
 *
 * // Bullet list
 * console.log(renderList(["Item 1", "Item 2"]));
 *
 * // Numbered list
 * console.log(renderList(["First", "Second"], { style: "number" }));
 *
 * // Nested list
 * console.log(renderList([
 *   { text: "Parent", children: ["Child 1", "Child 2"] }
 * ]));
 * ```
 *
 * @packageDocumentation
 */

// biome-ignore lint/performance/noBarrelFile: intentional re-exports for subpath API
export {
  type ListItem,
  type ListOptions,
  type ListStyle,
  type NestedListItem,
  renderList,
} from "../render/list.js";
