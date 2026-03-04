/**
 * Custom renderer registry for output shapes.
 *
 * @packageDocumentation
 */

import type { RenderOptions, Shape } from "./shape-types.js";

// ============================================================================
// Custom Renderer Registry
// ============================================================================

/**
 * A function that renders a shape to a string.
 *
 * @typeParam S - The specific shape type this renderer handles
 */
export type ShapeRenderer<S extends Shape = Shape> = (
  shape: S,
  options?: RenderOptions
) => string;

/** Registry map: shape type -> renderer function */
const customRenderers = new Map<string, ShapeRenderer>();

/**
 * Registers a custom renderer for a shape type.
 * Custom renderers take precedence over built-in renderers.
 *
 * @param shapeType - The shape type to register (e.g., "collection", "hierarchy")
 * @param renderer - The renderer function to use for this shape type
 *
 * @example
 * ```typescript
 * registerRenderer("collection", (shape, opts) => {
 *   return shape.items.map(item => `- ${item}`).join("\n");
 * });
 * ```
 */
export function registerRenderer<S extends Shape>(
  shapeType: S["type"],
  renderer: ShapeRenderer<S>
): void {
  customRenderers.set(shapeType, renderer as ShapeRenderer);
}

/**
 * Removes a custom renderer, reverting to built-in behavior.
 *
 * @param shapeType - The shape type to unregister
 * @returns `true` if a renderer was removed, `false` if none existed
 *
 * @example
 * ```typescript
 * unregisterRenderer("collection"); // Reverts to built-in table/list rendering
 * ```
 */
export function unregisterRenderer(shapeType: string): boolean {
  return customRenderers.delete(shapeType);
}

/**
 * Clears all custom renderers, reverting to built-in behavior.
 * Useful for testing to ensure clean state between tests.
 *
 * @example
 * ```typescript
 * afterEach(() => {
 *   clearRenderers();
 * });
 * ```
 */
export function clearRenderers(): void {
  customRenderers.clear();
}

/**
 * Retrieves a custom renderer for the given shape type, if one is registered.
 *
 * @param shapeType - The shape type to look up
 * @returns The registered renderer, or `undefined` if none exists
 */
export function getCustomRenderer(
  shapeType: string
): ShapeRenderer | undefined {
  return customRenderers.get(shapeType);
}
