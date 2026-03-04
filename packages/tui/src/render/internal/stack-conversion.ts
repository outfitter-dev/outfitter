/**
 * Box/Stack conversion helpers.
 *
 * @packageDocumentation
 */

import { isRenderable, type Renderable } from "./stack-types.js";

// ============================================================================
// Box/Stack Conversion Helpers
// ============================================================================

/**
 * Options for boxify helper.
 */
export interface BoxifyOptions {
  /** Border style */
  border?: "single" | "double" | "rounded" | "heavy" | "none";
  /** Padding inside the box */
  padding?: number;
  /** Box title */
  title?: string;
}

/**
 * Wraps content in a box for visual grouping.
 *
 * Convenience wrapper around createBox that accepts any Renderable,
 * string, or string array.
 *
 * @param content - Content to wrap (Renderable, string, or string[])
 * @param options - Box options (title, border, padding)
 * @returns Renderable box that can be used in stacks or nested
 *
 * @example
 * ```typescript
 * // Boxify a stack
 * const stack = createVStack([...], { mode: "guide" });
 * const boxed = boxify(stack, { title: "Branches", border: "rounded" });
 *
 * // Boxify plain text
 * const box = boxify("Hello World", { border: "double" });
 *
 * // Use in composition
 * hstack([boxify(stack1), boxify(stack2)], { gap: 2 });
 * ```
 */
export function boxify(
  content: Renderable | string | string[],
  options?: BoxifyOptions
): Renderable {
  // Import createBox inline to avoid circular dependency
  const { createBox: makeBox } = require("../box.js") as {
    createBox: typeof import("../box.js").createBox;
  };

  const boxContent = isRenderable(content) ? content.output : content;

  // Build options object, only including defined values
  // (exactOptionalPropertyTypes requires this)
  const boxOptions: Parameters<typeof makeBox>[1] = {
    border: options?.border ?? "single",
  };
  if (options?.title !== undefined) {
    boxOptions.title = options.title;
  }
  if (options?.padding !== undefined) {
    boxOptions.padding = options.padding;
  }

  return makeBox(boxContent, boxOptions);
}

/**
 * Extracts the raw output string from a Renderable.
 *
 * Useful when you need the string representation without the metadata,
 * or when passing to functions that only accept strings.
 *
 * @param content - Renderable or string
 * @returns The output string
 *
 * @example
 * ```typescript
 * const stack = createVStack([...], { mode: "guide" });
 * const raw = unbox(stack); // Just the string, no metadata
 *
 * // Useful for logging or string manipulation
 * console.log(unbox(boxedContent));
 *
 * // Pass-through for strings
 * unbox("already a string"); // Returns "already a string"
 * ```
 */
export function unbox(content: Renderable | string): string {
  if (isRenderable(content)) {
    return content.output;
  }
  return content;
}
