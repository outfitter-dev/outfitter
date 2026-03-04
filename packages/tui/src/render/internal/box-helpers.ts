/**
 * Helper functions for box rendering.
 *
 * Provides alignment, padding normalization, margin normalization,
 * and border normalization utilities.
 *
 * @packageDocumentation
 */

import { getStringWidth } from "@outfitter/cli/text";

import type {
  BoxAlign,
  BoxBorders,
  BoxSpacing,
  NormalizedBorders,
  NormalizedSpacing,
} from "./box-types.js";

// ============================================================================
// Helpers
// ============================================================================

/**
 * Pads a line to a specific width with given alignment.
 */
export function alignLine(
  line: string,
  width: number,
  align: BoxAlign
): string {
  const lineWidth = getStringWidth(line);
  const padding = width - lineWidth;

  if (padding <= 0) {
    return line;
  }

  switch (align) {
    case "center": {
      const leftPad = Math.floor(padding / 2);
      const rightPad = padding - leftPad;
      return " ".repeat(leftPad) + line + " ".repeat(rightPad);
    }
    case "right":
      return " ".repeat(padding) + line;
    default:
      // "left" alignment (default): pad on right
      return line + " ".repeat(padding);
  }
}

/**
 * Normalizes padding input to have all four sides.
 * For backward compatibility, when padding is a number it only applies to horizontal (left/right).
 * When padding is an object, all sides can be specified.
 */
export function normalizePadding(
  padding: number | BoxSpacing | undefined,
  defaultValue: number
): NormalizedSpacing {
  if (padding === undefined) {
    return { top: 0, right: defaultValue, bottom: 0, left: defaultValue };
  }
  if (typeof padding === "number") {
    // Backward compatibility: number only applies to horizontal padding
    return { top: 0, right: padding, bottom: 0, left: padding };
  }
  return {
    top: padding.top ?? 0,
    right: padding.right ?? defaultValue,
    bottom: padding.bottom ?? 0,
    left: padding.left ?? defaultValue,
  };
}

/**
 * Normalizes margin input to have all four sides.
 * When margin is a number, it applies to all sides.
 */
export function normalizeMargin(
  margin: number | BoxSpacing | undefined,
  defaultValue: number
): NormalizedSpacing {
  if (margin === undefined) {
    return {
      top: defaultValue,
      right: defaultValue,
      bottom: defaultValue,
      left: defaultValue,
    };
  }
  if (typeof margin === "number") {
    return { top: margin, right: margin, bottom: margin, left: margin };
  }
  return {
    top: margin.top ?? defaultValue,
    right: margin.right ?? defaultValue,
    bottom: margin.bottom ?? defaultValue,
    left: margin.left ?? defaultValue,
  };
}

/**
 * Normalizes borders input to have all four sides.
 */
export function normalizeBorders(
  borders: BoxBorders | undefined
): NormalizedBorders {
  if (borders === undefined) {
    return { top: true, right: true, bottom: true, left: true };
  }
  return {
    top: borders.top ?? true,
    right: borders.right ?? true,
    bottom: borders.bottom ?? true,
    left: borders.left ?? true,
  };
}
