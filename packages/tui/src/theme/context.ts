/**
 * Themed layout context utilities.
 *
 * Extends LayoutContext with theme support for cascading theme inheritance.
 *
 * @packageDocumentation
 */

import type { LayoutContext } from "../render/types.js";
import { defaultTheme } from "./presets/default.js";
import type { VisualTheme } from "./types.js";

/**
 * Layout context extended with theme information.
 *
 * Allows themes to cascade through component hierarchies. Children
 * inherit their parent's theme unless explicitly overridden.
 *
 * @example
 * ```typescript
 * import { createThemedContext, roundedTheme } from "@outfitter/cli/theme";
 *
 * // Create root context with theme
 * const ctx = createThemedContext({ theme: roundedTheme, width: 80 });
 *
 * // Child inherits theme from parent
 * const childCtx = createThemedContext({ width: 40, parent: ctx });
 * console.log(childCtx.theme.border); // "rounded" (inherited)
 *
 * // Child can override theme
 * const overrideCtx = createThemedContext({
 *   theme: boldTheme,
 *   width: 40,
 *   parent: ctx
 * });
 * console.log(overrideCtx.theme.border); // "heavy"
 * ```
 */
export interface ThemedLayoutContext extends LayoutContext {
  /** The visual theme for this context */
  readonly theme: VisualTheme;
}

/**
 * Options for creating a themed layout context.
 */
export interface ThemedContextOptions {
  /** Visual theme (inherited from parent if not specified) */
  theme?: VisualTheme;
  /** Available width in characters */
  width?: number;
  /** Parent context for inheritance */
  parent?: ThemedLayoutContext;
}

/**
 * Creates a themed layout context with cascading inheritance.
 *
 * Theme inheritance rules:
 * 1. Explicit theme → use it
 * 2. Parent exists → inherit parent's theme
 * 3. No theme or parent → use defaultTheme
 *
 * Width inheritance rules:
 * 1. Explicit width → use it
 * 2. Parent exists → inherit parent's width
 * 3. No width or parent → use terminal width (via getTerminalWidth)
 *
 * @param options - Context configuration
 * @returns A ThemedLayoutContext with resolved theme and width
 *
 * @example
 * ```typescript
 * // Root context with explicit theme and width
 * const root = createThemedContext({ theme: roundedTheme, width: 100 });
 *
 * // Child with inherited theme, explicit width
 * const child = createThemedContext({ width: 50, parent: root });
 *
 * // Nested child with overridden theme
 * const nested = createThemedContext({
 *   theme: boldTheme,
 *   parent: child
 * });
 * ```
 */
export function createThemedContext(
  options: ThemedContextOptions
): ThemedLayoutContext {
  // Resolve theme: explicit > parent > default
  const theme =
    options.theme ??
    (options.parent as ThemedLayoutContext)?.theme ??
    defaultTheme;

  // Resolve width: explicit > parent > terminal
  const width =
    options.width ?? options.parent?.width ?? process.stdout.columns ?? 80;

  return {
    width,
    theme,
    ...(options.parent && { parent: options.parent }),
  };
}

/**
 * Gets the theme from a context, with fallback to defaultTheme.
 *
 * Useful when you have an optional context and need a theme.
 *
 * @param ctx - Optional themed context
 * @returns The context's theme or defaultTheme if no context
 *
 * @example
 * ```typescript
 * function renderComponent(ctx?: ThemedLayoutContext) {
 *   const theme = getContextTheme(ctx);
 *   // theme is always defined
 * }
 * ```
 */
export function getContextTheme(ctx?: ThemedLayoutContext): VisualTheme {
  return ctx?.theme ?? defaultTheme;
}
