/**
 * Box submodule for @outfitter/cli.
 *
 * Provides box rendering utilities for bordered panels with optional titles.
 *
 * @example
 * ```typescript
 * import { renderBox, type BoxOptions, type BoxAlign } from "@outfitter/tui/box";
 *
 * // Simple box
 * console.log(renderBox("Hello, world!"));
 *
 * // Box with title and rounded corners
 * console.log(renderBox("All systems go", {
 *   title: "Status",
 *   border: "rounded",
 * }));
 * ```
 *
 * @packageDocumentation
 */

// eslint-disable-next-line oxc/no-barrel-file -- intentional re-exports for subpath API
export { type BoxAlign, type BoxOptions, renderBox } from "../render/box.js";
