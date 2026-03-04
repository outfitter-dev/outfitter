/**
 * Horizontal stack composition.
 *
 * @packageDocumentation
 */

import { getStringWidth } from "@outfitter/cli/text";

import { joinHorizontal } from "../layout.js";
import {
  applyStyle,
  getContentLines,
  normalizeItem,
  resolveDelimiter,
} from "./stack-helpers.js";
import type { HStackOptions, StackBox, StackInput } from "./stack-types.js";

/**
 * Joins items horizontally with a delimiter.
 *
 * @param items - Items to join (strings or StackItems)
 * @param options - Configuration options
 * @returns Joined string
 *
 * @example
 * ```typescript
 * // Simple delimiter
 * hstack(["a", "b", "c"], { delimiter: "bullet", gap: 1 });
 * // → "a • b • c"
 *
 * // Multi-line with alignment
 * hstack(["Line1\nLine2", "Single"], { delimiter: "pipe", align: "center" });
 * ```
 */
export function hstack(items: StackInput[], options?: HStackOptions): string {
  if (items.length === 0) return "";

  const normalizedItems = items.map(normalizeItem);
  const delimiter = resolveDelimiter(options?.delimiter);
  const gap = options?.gap ?? 0;
  const align = options?.align ?? "top";

  // Build delimiter with gap
  const gapStr = " ".repeat(gap);
  const fullDelimiter = `${gapStr}${delimiter}${gapStr}`;

  // Apply styles and get content strings
  const contentStrings = normalizedItems.map((item) => {
    const lines = getContentLines(item.content);
    const styledLines = lines.map((line) => applyStyle(line, item.style));
    return styledLines.join("\n");
  });

  // Check if any content is multi-line
  const isMultiLine = contentStrings.some((s) => s.includes("\n"));

  if (!isMultiLine) {
    // Simple case: join with delimiter
    return contentStrings.join(fullDelimiter);
  }

  // Multi-line: use joinHorizontal with full delimiter (including gap)
  const blocks = contentStrings.map((content, idx) => {
    if (idx === contentStrings.length - 1) {
      return content;
    }
    // Append full delimiter (with gap) to each line of this block
    const lines = content.split("\n");
    return lines.map((line) => line + fullDelimiter).join("\n");
  });

  return joinHorizontal(blocks, { gap: 0, align });
}

/**
 * Creates a horizontal stack with metadata for composition.
 *
 * @param items - Items to join
 * @param options - Configuration options
 * @returns StackBox with output, width, and height
 */
export function createHStack(
  items: StackInput[],
  options?: HStackOptions
): StackBox {
  const output = hstack(items, options);
  const lines = output.split("\n");
  const width = Math.max(...lines.map(getStringWidth));

  return {
    output,
    width,
    height: lines.length,
  };
}
