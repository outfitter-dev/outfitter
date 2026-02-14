/**
 * Separator render utility for visual dividers.
 *
 * @packageDocumentation
 */

import { getTerminalWidth } from "./layout.js";
import type { WidthMode } from "./types.js";

/**
 * Width mode for separators.
 *
 * Separators only support "text", "full", and numeric widths.
 * Container-relative modes require context, which separators don't use.
 */
type SeparatorWidthMode = Extract<WidthMode, "text" | "full" | number>;

/**
 * Separator style for dividers.
 * Single characters repeat to fill width.
 * Two-character patterns (like "- ") alternate to create dashed effect.
 */
export type DividerStyle = "─" | "━" | "═" | "- " | "· ";

/**
 * Options for rendering a separator.
 */
export interface SeparatorOptions {
  /** Separator style (default: "─") */
  style?: DividerStyle;
  /** Width mode (default: 40) */
  width?: SeparatorWidthMode;
}

/**
 * Renders a horizontal separator line.
 *
 * @param options - Rendering options
 * @returns Formatted separator string
 *
 * @example
 * ```typescript
 * import { renderSeparator } from "@outfitter/cli/render";
 *
 * console.log(renderSeparator());
 * // ────────────────────────────────────────
 *
 * console.log(renderSeparator({ style: "━", width: 20 }));
 * // ━━━━━━━━━━━━━━━━━━━━
 *
 * console.log(renderSeparator({ style: "- ", width: 20 }));
 * // - - - - - - - - - -
 * ```
 */
export function renderSeparator(options?: SeparatorOptions): string {
  const style = options?.style ?? "─";
  const widthMode = options?.width ?? 40;

  // Calculate width
  let width: number;
  if (widthMode === "text") {
    // For separator, "text" doesn't make sense, use default
    width = 40;
  } else if (widthMode === "full") {
    // Use terminal width helper for consistency
    width = getTerminalWidth();
  } else {
    width = widthMode;
  }

  // For two-character patterns, repeat to fill width
  if (style.length === 2) {
    const repetitions = Math.ceil(width / 2);
    return style.repeat(repetitions).slice(0, width);
  }

  // Single character, just repeat
  return style.repeat(width);
}
