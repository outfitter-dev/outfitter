/**
 * Visual theme factory.
 *
 * @packageDocumentation
 */

import { BORDERS } from "../render/borders.js";
import { defaultTheme } from "./presets/default.js";
import type { PartialVisualTheme, VisualTheme } from "./types.js";

/**
 * Options for creating a visual theme.
 */
export interface CreateVisualThemeOptions {
  /**
   * Base theme to extend from.
   * Properties not overridden will be inherited from this theme.
   * @default defaultTheme
   */
  extends?: VisualTheme;

  /**
   * Properties to override on the base/extended theme.
   * Supports partial overrides for nested objects (colors, spacing, markers).
   */
  overrides?: PartialVisualTheme;
}

/**
 * Creates a visual theme by extending and/or overriding a base theme.
 *
 * This is the primary factory for creating custom themes. You can:
 * - Start from scratch (no options → defaultTheme)
 * - Extend an existing preset
 * - Override specific properties
 * - Combine extension and overrides
 *
 * When changing the `border` property, `borderChars` is automatically
 * updated to match the new border style.
 *
 * @param options - Configuration for theme creation
 * @returns A complete VisualTheme
 *
 * @example
 * ```typescript
 * // Start with defaults
 * const theme = createVisualTheme();
 *
 * // Extend a preset
 * const rounded = createVisualTheme({ extends: roundedTheme });
 *
 * // Override specific properties
 * const custom = createVisualTheme({
 *   overrides: {
 *     border: "double",
 *     colors: { success: "\x1b[38;5;82m" },
 *     spacing: { boxPadding: 2 }
 *   }
 * });
 *
 * // Extend and override
 * const brandTheme = createVisualTheme({
 *   extends: roundedTheme,
 *   overrides: {
 *     name: "brand",
 *     colors: { accent: "\x1b[38;5;39m" }
 *   }
 * });
 * ```
 */
export function createVisualTheme(
  options?: CreateVisualThemeOptions
): VisualTheme {
  const base = options?.extends ?? defaultTheme;
  const overrides = options?.overrides ?? {};

  // Determine the border style
  const border = overrides.border ?? base.border;

  // Auto-derive borderChars if border changed and borderChars not explicitly set
  const borderChars =
    overrides.borderChars ??
    (overrides.border ? BORDERS[overrides.border] : base.borderChars);

  // Deep merge colors
  const colors = {
    ...base.colors,
    ...overrides.colors,
  };

  // Deep merge spacing
  const spacing = {
    ...base.spacing,
    ...overrides.spacing,
  };

  // Deep merge markers
  const markers = {
    ...base.markers,
    ...overrides.markers,
  };

  // Deep merge checkbox
  const checkbox = {
    checked: overrides.checkbox?.checked ?? base.checkbox.checked,
    unchecked: overrides.checkbox?.unchecked ?? base.checkbox.unchecked,
  };

  return {
    name: overrides.name ?? base.name,
    border,
    borderChars,
    treeGuide: overrides.treeGuide ?? base.treeGuide,
    delimiter: overrides.delimiter ?? base.delimiter,
    markers,
    listBullet: overrides.listBullet ?? base.listBullet,
    checkbox,
    colors,
    spacing,
    spinner: overrides.spinner ?? base.spinner,
  };
}
