/**
 * Layout utilities for arranging text blocks.
 *
 * @packageDocumentation
 */

import { type BoxOptions, normalizeBorders, normalizePadding } from "./box.js";

// ============================================================================
// Width Utilities
// ============================================================================

/**
 * Gets the current terminal width.
 *
 * Returns `process.stdout.columns` if available, otherwise falls back to 80
 * (standard terminal width).
 *
 * @returns Terminal width in characters
 *
 * @example
 * ```typescript
 * import { getTerminalWidth } from "@outfitter/cli/render";
 *
 * const width = getTerminalWidth();
 * console.log(`Terminal is ${width} columns wide`);
 * ```
 */
export function getTerminalWidth(): number {
  return process.stdout.columns ?? 80;
}

/**
 * Calculates box overhead (borders + padding) for each axis.
 *
 * Returns the total character/line count consumed by borders and padding,
 * separate from content.
 *
 * @param options - Box options (padding, borders)
 * @returns Object with horizontal and vertical overhead
 *
 * @example
 * ```typescript
 * import { getBoxOverhead } from "@outfitter/cli/render";
 *
 * const overhead = getBoxOverhead({ padding: 1, border: "single" });
 * // { horizontal: 4, vertical: 2 }
 * // horizontal: left border (1) + left padding (1) + right padding (1) + right border (1)
 * // vertical: top border (1) + bottom border (1)
 * ```
 */
export function getBoxOverhead(options: BoxOptions): {
  horizontal: number;
  vertical: number;
} {
  const pad = normalizePadding(options.padding, 1);
  const borders = normalizeBorders(options.borders);

  return {
    horizontal:
      (borders.left ? 1 : 0) + (borders.right ? 1 : 0) + pad.left + pad.right,
    vertical:
      (borders.top ? 1 : 0) + (borders.bottom ? 1 : 0) + pad.top + pad.bottom,
  };
}

/**
 * Calculates available content width inside a box.
 *
 * Accounts for borders and padding to determine how much space remains
 * for content. Use this to size nested components appropriately.
 *
 * @param options - Box options (width, padding, borders)
 * @returns Available width in characters for content
 *
 * @example
 * ```typescript
 * import { getContentWidth, createBox, renderProgress } from "@outfitter/cli/render";
 *
 * const boxOpts = { width: 40, padding: 1, border: "single" };
 * const available = getContentWidth(boxOpts); // → 36
 *
 * const progress = renderProgress(0.5, { width: available });
 * const box = createBox(progress, boxOpts);
 * ```
 */
export function getContentWidth(options: BoxOptions): number {
  const { horizontal } = getBoxOverhead(options);

  if (options.width) {
    const content = options.width - horizontal;
    return Math.max(0, content); // Clamp to non-negative
  }

  // No fixed width - use terminal width, clamped to non-negative
  return Math.max(0, getTerminalWidth() - horizontal);
}

// ============================================================================
// Layout Types
// ============================================================================

/**
 * Vertical alignment for horizontal layout.
 */
export type Alignment = "top" | "center" | "bottom";

/**
 * Options for horizontal layout.
 */
export interface HorizontalLayoutOptions {
  /** Gap (in characters) between blocks */
  gap?: number;
  /** Vertical alignment of blocks */
  align?: Alignment;
}

/**
 * Options for vertical layout.
 */
export interface VerticalLayoutOptions {
  /** Gap (in lines) between blocks */
  gap?: number;
}

/**
 * Gets the display width of a string, handling ANSI codes and Unicode.
 */
function getWidth(text: string): number {
  return Bun.stringWidth(text);
}

/**
 * Splits a block into lines.
 */
function splitLines(block: string): string[] {
  return block.split("\n");
}

/**
 * Pads a string to a specific width.
 */
function padToWidth(text: string, width: number): string {
  const currentWidth = getWidth(text);
  if (currentWidth >= width) return text;
  return text + " ".repeat(width - currentWidth);
}

/**
 * Creates an array filled with a value.
 */
function createFilledArray(length: number, value: string): string[] {
  const result: string[] = [];
  for (let i = 0; i < length; i++) {
    result.push(value);
  }
  return result;
}

/**
 * Joins multiple text blocks horizontally (side by side).
 *
 * Handles blocks of different heights by aligning them according
 * to the `align` option. Blocks are padded to maintain alignment.
 *
 * @param blocks - Array of text blocks to join
 * @param options - Layout options
 * @returns Combined string with blocks side by side
 *
 * @example
 * ```typescript
 * import { joinHorizontal } from "@outfitter/cli/render";
 * import { renderBox } from "@outfitter/cli/render";
 *
 * const left = renderBox({ content: "Left", borderStyle: "single" });
 * const right = renderBox({ content: "Right", borderStyle: "single" });
 *
 * console.log(joinHorizontal([left, right], { gap: 2 }));
 * // ┌──────┐  ┌───────┐
 * // │ Left │  │ Right │
 * // └──────┘  └───────┘
 * ```
 */
export function joinHorizontal(
  blocks: string[],
  options?: HorizontalLayoutOptions
): string {
  if (blocks.length === 0) return "";
  const first = blocks[0];
  if (first === undefined) return "";
  if (blocks.length === 1) return first;

  const gap = options?.gap ?? 0;
  const align = options?.align ?? "top";
  const gapString = " ".repeat(gap);

  // Split all blocks into lines
  const blockLines = blocks.map(splitLines);

  // Find the max height
  const maxHeight = Math.max(...blockLines.map((lines) => lines.length));

  // Find the width of each block
  const blockWidths = blockLines.map((lines) =>
    Math.max(...lines.map(getWidth))
  );

  // Pad each block to maxHeight based on alignment
  const paddedBlocks = blockLines.map((lines, blockIndex) => {
    const width = blockWidths[blockIndex] ?? 0;
    const height = lines.length;
    const padding = maxHeight - height;

    let topPadding: number;
    switch (align) {
      case "top":
        topPadding = 0;
        break;
      case "center":
        topPadding = Math.floor(padding / 2);
        break;
      case "bottom":
        topPadding = padding;
        break;
      default: {
        const _exhaustive: never = align;
        topPadding = _exhaustive;
      }
    }
    const bottomPadding = padding - topPadding;

    const emptyLine = " ".repeat(width);
    const paddedLines = [
      ...createFilledArray(topPadding, emptyLine),
      ...lines.map((line) => padToWidth(line, width)),
      ...createFilledArray(bottomPadding, emptyLine),
    ];

    return paddedLines;
  });

  // Join lines horizontally
  const resultLines: string[] = [];
  for (let i = 0; i < maxHeight; i++) {
    const lineSegments = paddedBlocks.map((block) => block[i] ?? "");
    resultLines.push(lineSegments.join(gapString));
  }

  return resultLines.join("\n");
}

/**
 * Joins multiple text blocks vertically (stacked).
 *
 * @param blocks - Array of text blocks to stack
 * @param options - Layout options
 * @returns Combined string with blocks stacked
 *
 * @example
 * ```typescript
 * import { joinVertical, renderHeading, renderSeparator } from "@outfitter/cli/render";
 *
 * const heading = renderHeading("Section Title");
 * const separator = renderSeparator({ width: 20 });
 * const content = "Some content here.";
 *
 * console.log(joinVertical([heading, separator, content], { gap: 1 }));
 * // SECTION TITLE
 * // =============
 * //
 * // ────────────────────
 * //
 * // Some content here.
 * ```
 */
export function joinVertical(
  blocks: string[],
  options?: VerticalLayoutOptions
): string {
  if (blocks.length === 0) return "";
  const first = blocks[0];
  if (first === undefined) return "";
  if (blocks.length === 1) return first;

  const gap = options?.gap ?? 0;

  // Create gap string (empty lines)
  const gapLines = gap > 0 ? "\n".repeat(gap) : "";

  return blocks.join(`\n${gapLines}`);
}
