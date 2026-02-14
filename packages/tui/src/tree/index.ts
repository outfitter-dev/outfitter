/**
 * Tree submodule for @outfitter/cli.
 *
 * Provides tree rendering utilities for hierarchical data visualization.
 *
 * @example
 * ```typescript
 * import { renderTree } from "@outfitter/cli/tree";
 *
 * const tree = {
 *   src: {
 *     components: { Button: null, Input: null },
 *     utils: null,
 *   },
 *   tests: null,
 * };
 *
 * console.log(renderTree(tree));
 * ```
 *
 * @packageDocumentation
 */

// biome-ignore lint/performance/noBarrelFile: intentional re-exports for subpath API
export {
  renderTree,
  TREE_GUIDES,
  type TreeGuideStyle,
  type TreeOptions,
} from "../render/tree.js";
