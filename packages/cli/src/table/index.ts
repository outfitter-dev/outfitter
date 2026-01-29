/**
 * Table submodule for @outfitter/cli.
 *
 * Provides table rendering utilities with Unicode box-drawing borders.
 *
 * @example
 * ```typescript
 * import { renderTable, type TableOptions } from "@outfitter/cli/table";
 *
 * const table = renderTable(
 *   [{ id: 1, name: "Alice" }, { id: 2, name: "Bob" }],
 *   { border: "rounded" }
 * );
 * console.log(table);
 * ```
 *
 * @packageDocumentation
 */

// biome-ignore lint/performance/noBarrelFile: intentional re-exports for subpath API
export { renderTable, type TableOptions } from "../render/table.js";
