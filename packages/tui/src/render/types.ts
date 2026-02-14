/**
 * Shared types for render utilities.
 *
 * @packageDocumentation
 */

/**
 * Width mode for layout calculations.
 *
 * - `"text"` - Fit to text content (returns 0 to indicate no width constraint)
 * - `"full"` - Full terminal width
 * - `"container"` - Available container width (requires LayoutContext)
 * - `number` - Fixed character width
 * - `"${number}%"` - Percentage of container/terminal width
 *
 * @example
 * ```typescript
 * import { resolveWidth } from "@outfitter/cli/render";
 *
 * resolveWidth("full");        // → terminal width (e.g., 120)
 * resolveWidth(50);            // → 50
 * resolveWidth("50%");         // → half of terminal width
 * resolveWidth("container", ctx);  // → context width
 * ```
 */
export type WidthMode = "text" | "full" | "container" | number | `${number}%`;

/**
 * Layout context for container-aware width calculations.
 *
 * Provides width information to nested components so they can size
 * themselves relative to their container. Create contexts with
 * `createLayoutContext()` and pass them through component hierarchies.
 *
 * @example
 * ```typescript
 * import { createLayoutContext, resolveWidth } from "@outfitter/cli/render";
 *
 * const outerCtx = createLayoutContext({ width: 80, padding: 1 });
 * // outerCtx.width = 76 (80 - 4 overhead)
 *
 * const innerWidth = resolveWidth("50%", outerCtx);
 * // innerWidth = 38 (50% of 76)
 * ```
 */
export interface LayoutContext {
  /** Available content width in characters */
  readonly width: number;
  /** Parent context for chained calculations */
  readonly parent?: LayoutContext;
}
