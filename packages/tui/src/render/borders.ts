/**
 * Box-drawing border utilities.
 *
 * Provides border character sets and line drawing functions for tables, boxes, and panels.
 *
 * @packageDocumentation
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Available border style presets.
 *
 * - `single`: Standard Unicode single-line borders (┌─┐)
 * - `double`: Double-line borders (╔═╗)
 * - `rounded`: Rounded corners with single lines (╭─╮)
 * - `heavy`: Thick/heavy borders (┏━┓)
 * - `ascii`: ASCII-only fallback (+, -, |)
 * - `none`: No borders (empty strings)
 */
export type BorderStyle =
  | "single"
  | "double"
  | "rounded"
  | "heavy"
  | "ascii"
  | "none";

/**
 * Complete set of box-drawing characters for a border style.
 *
 * Includes corners, edges, and intersection characters for building
 * tables, boxes, and other bordered elements.
 */
export interface BorderCharacters {
  /** Top-left corner (e.g., ┌ ╔ ╭ ┏) */
  topLeft: string;
  /** Top-right corner (e.g., ┐ ╗ ╮ ┓) */
  topRight: string;
  /** Bottom-left corner (e.g., └ ╚ ╰ ┗) */
  bottomLeft: string;
  /** Bottom-right corner (e.g., ┘ ╝ ╯ ┛) */
  bottomRight: string;
  /** Horizontal line (e.g., ─ ═ ━) */
  horizontal: string;
  /** Vertical line (e.g., │ ║ ┃) */
  vertical: string;
  /** Top T-intersection for column separators (e.g., ┬ ╦ ┳) */
  topT: string;
  /** Bottom T-intersection for column separators (e.g., ┴ ╩ ┻) */
  bottomT: string;
  /** Left T-intersection for row separators (e.g., ├ ╠ ┣) */
  leftT: string;
  /** Right T-intersection for row separators (e.g., ┤ ╣ ┫) */
  rightT: string;
  /** Cross intersection for table cells (e.g., ┼ ╬ ╋) */
  cross: string;
}

// ============================================================================
// Border Character Sets
// ============================================================================

/**
 * Preset border character sets for each style.
 *
 * @example
 * ```typescript
 * import { BORDERS } from "@outfitter/cli";
 *
 * const single = BORDERS.single;
 * console.log(`${single.topLeft}${single.horizontal.repeat(10)}${single.topRight}`);
 * // Output: ┌──────────┐
 * ```
 */
export const BORDERS: Record<BorderStyle, BorderCharacters> = {
  single: {
    topLeft: "┌",
    topRight: "┐",
    bottomLeft: "└",
    bottomRight: "┘",
    horizontal: "─",
    vertical: "│",
    topT: "┬",
    bottomT: "┴",
    leftT: "├",
    rightT: "┤",
    cross: "┼",
  },
  double: {
    topLeft: "╔",
    topRight: "╗",
    bottomLeft: "╚",
    bottomRight: "╝",
    horizontal: "═",
    vertical: "║",
    topT: "╦",
    bottomT: "╩",
    leftT: "╠",
    rightT: "╣",
    cross: "╬",
  },
  rounded: {
    topLeft: "╭",
    topRight: "╮",
    bottomLeft: "╰",
    bottomRight: "╯",
    horizontal: "─",
    vertical: "│",
    topT: "┬",
    bottomT: "┴",
    leftT: "├",
    rightT: "┤",
    cross: "┼",
  },
  heavy: {
    topLeft: "┏",
    topRight: "┓",
    bottomLeft: "┗",
    bottomRight: "┛",
    horizontal: "━",
    vertical: "┃",
    topT: "┳",
    bottomT: "┻",
    leftT: "┣",
    rightT: "┫",
    cross: "╋",
  },
  ascii: {
    topLeft: "+",
    topRight: "+",
    bottomLeft: "+",
    bottomRight: "+",
    horizontal: "-",
    vertical: "|",
    topT: "+",
    bottomT: "+",
    leftT: "+",
    rightT: "+",
    cross: "+",
  },
  none: {
    topLeft: "",
    topRight: "",
    bottomLeft: "",
    bottomRight: "",
    horizontal: "",
    vertical: "",
    topT: "",
    bottomT: "",
    leftT: "",
    rightT: "",
    cross: "",
  },
};

// ============================================================================
// Functions
// ============================================================================

/**
 * Returns the border character set for the given style.
 *
 * @param style - The border style preset
 * @returns The complete set of border characters
 *
 * @example
 * ```typescript
 * const chars = getBorderCharacters("rounded");
 * console.log(chars.topLeft); // ╭
 * console.log(chars.topRight); // ╮
 * ```
 */
export function getBorderCharacters(style: BorderStyle): BorderCharacters {
  return BORDERS[style];
}

/**
 * Position of a horizontal line within a bordered element.
 */
export type LinePosition = "top" | "middle" | "bottom";

/**
 * Draws a horizontal line with the appropriate corner/intersection characters.
 *
 * Used for building table borders and box edges. Handles column intersections
 * when column widths are provided.
 *
 * @param width - Total width of the line content (excluding corners)
 * @param chars - Border character set to use
 * @param position - Position of line: "top", "middle", or "bottom"
 * @param columnWidths - Optional array of column widths for intersection placement
 * @returns The formatted horizontal line string
 *
 * @example
 * ```typescript
 * const chars = getBorderCharacters("single");
 *
 * // Simple line (no columns)
 * drawHorizontalLine(10, chars, "top");
 * // Returns: ┌──────────┐
 *
 * // Line with column intersections
 * drawHorizontalLine(14, chars, "middle", [5, 7]);
 * // Returns: ├─────┼───────┤
 * ```
 */
export function drawHorizontalLine(
  width: number,
  chars: BorderCharacters,
  position: LinePosition,
  columnWidths?: number[]
): string {
  // Handle "none" style - return empty string
  if (!chars.horizontal) {
    return "";
  }

  // Character mappings for each position
  const positionChars = {
    top: { left: chars.topLeft, right: chars.topRight, cross: chars.topT },
    middle: { left: chars.leftT, right: chars.rightT, cross: chars.cross },
    bottom: {
      left: chars.bottomLeft,
      right: chars.bottomRight,
      cross: chars.bottomT,
    },
  } as const;

  const { left, right, cross: intersection } = positionChars[position];

  // No columns or single column - draw simple line
  if (!columnWidths || columnWidths.length <= 1) {
    return `${left}${chars.horizontal.repeat(width)}${right}`;
  }

  // Build line with column intersections
  // Calculate actual width: sum of columns + (n-1) intersections
  const columnsWidth = columnWidths.reduce((sum, w) => sum + w, 0);
  const intersectionsWidth = columnWidths.length - 1;
  const actualWidth = columnsWidth + intersectionsWidth;

  // If columnWidths don't match expected width, adjust last column
  const adjustedWidths = [...columnWidths];
  if (actualWidth !== width && adjustedWidths.length > 0) {
    const lastIndex = adjustedWidths.length - 1;
    const lastWidth = adjustedWidths[lastIndex] ?? 0;
    adjustedWidths[lastIndex] = Math.max(0, lastWidth + (width - actualWidth));
  }

  const segments = adjustedWidths.map((colWidth) =>
    chars.horizontal.repeat(colWidth)
  );

  return `${left}${segments.join(intersection)}${right}`;
}
