/**
 * JSON and text rendering utilities.
 *
 * Simple renderers for JSON and plain text output.
 *
 * @packageDocumentation
 */

/**
 * Renders data as pretty-printed JSON.
 *
 * Uses `JSON.stringify` with 2-space indentation.
 * Suitable for displaying structured data in terminal output.
 *
 * @param data - Data to render as JSON
 * @returns Pretty-printed JSON string
 *
 * @example
 * ```typescript
 * console.log(renderJson({ name: "test", value: 42 }));
 * // {
 * //   "name": "test",
 * //   "value": 42
 * // }
 * ```
 */
export function renderJson(data: unknown): string {
  const json = JSON.stringify(data, null, 2);
  return json;
}

/**
 * Renders plain text unchanged.
 *
 * This is a pass-through function that returns the input text as-is.
 * Useful as a placeholder or for consistent API across render functions.
 *
 * @param text - Text to render
 * @returns The input text unchanged
 *
 * @example
 * ```typescript
 * renderText("Hello, World!"); // "Hello, World!"
 * ```
 */
export function renderText(text: string): string {
  return text;
}
