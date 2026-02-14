/**
 * Heading render utility for section headers.
 *
 * @packageDocumentation
 */

import { getTerminalWidth } from "./layout.js";
import type { WidthMode } from "./types.js";

/**
 * Separator style for headings.
 */
export type SeparatorStyle = "=" | "-" | "─" | "━" | "═";

/**
 * Width mode for headings.
 *
 * Note: Headings only support "text", "full", and numeric widths.
 * Use the shared WidthMode type for full container-relative support.
 *
 * @see WidthMode for the complete type definition
 */
export type HeadingWidthMode = Extract<WidthMode, "text" | "full" | number>;

/**
 * Case transformation for heading text.
 */
export type CaseMode = "upper" | "lower" | "title" | "none";

/**
 * Options for rendering a heading.
 */
export interface HeadingOptions {
  /** Separator character/style (default: "=") */
  separator?: SeparatorStyle;
  /** Width mode (default: "text") */
  width?: HeadingWidthMode;
  /** Case transformation (default: "upper") */
  case?: CaseMode;
}

/** ANSI escape sequence pattern */
// biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI escape detection requires matching ESC character
const ANSI_PATTERN = /\x1b\[[0-9;]*m/g;

/**
 * Transforms text to title case, preserving ANSI escape codes.
 */
function toTitleCase(text: string): string {
  return text.replace(
    /\w\S*/g,
    (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  );
}

/**
 * Applies case transformation to text while preserving ANSI escape codes.
 * ANSI sequences are extracted, transformation applied to visible text only,
 * then sequences are restored to their original positions.
 */
function applyCase(text: string, caseMode: CaseMode): string {
  if (caseMode === "none") {
    return text;
  }

  // Check if text contains ANSI codes
  const hasAnsi = ANSI_PATTERN.test(text);
  ANSI_PATTERN.lastIndex = 0; // Reset regex state

  if (!hasAnsi) {
    // No ANSI codes, apply transformation directly
    switch (caseMode) {
      case "upper":
        return text.toUpperCase();
      case "lower":
        return text.toLowerCase();
      case "title":
        return toTitleCase(text);
      default: {
        const _exhaustive: never = caseMode;
        return _exhaustive;
      }
    }
  }

  // Extract ANSI sequences and their positions
  const sequences: Array<{ index: number; seq: string }> = [];
  for (const match of text.matchAll(ANSI_PATTERN)) {
    sequences.push({ index: match.index, seq: match[0] });
  }

  // Strip ANSI codes and apply transformation
  const stripped = Bun.stripANSI(text);
  let transformed: string;
  switch (caseMode) {
    case "upper":
      transformed = stripped.toUpperCase();
      break;
    case "lower":
      transformed = stripped.toLowerCase();
      break;
    case "title":
      transformed = toTitleCase(stripped);
      break;
    default: {
      const _exhaustive: never = caseMode;
      return _exhaustive;
    }
  }

  // Reinsert ANSI sequences at original positions
  let result = transformed;
  let offset = 0;
  for (const { index, seq } of sequences) {
    const insertPos = index + offset;
    result = result.slice(0, insertPos) + seq + result.slice(insertPos);
    offset += seq.length;
  }

  return result;
}

/**
 * Calculates the display width of text.
 * Uses Bun's stringWidth for accurate width calculation with ANSI and Unicode.
 */
function getTextWidth(text: string): number {
  return Bun.stringWidth(text);
}

/**
 * Renders a section heading with a separator line below.
 *
 * @param text - The heading text
 * @param options - Rendering options
 * @returns Formatted heading string
 *
 * @example
 * ```typescript
 * import { renderHeading } from "@outfitter/cli/render";
 *
 * console.log(renderHeading("Theme Colors"));
 * // THEME COLORS
 * // ============
 *
 * console.log(renderHeading("Status", { separator: "─", case: "none" }));
 * // Status
 * // ──────
 * ```
 */
export function renderHeading(text: string, options?: HeadingOptions): string {
  const separator = options?.separator ?? "=";
  const widthMode = options?.width ?? "text";
  const caseMode = options?.case ?? "upper";

  // Apply case transformation
  const transformedText = applyCase(text, caseMode);

  // Calculate width
  let width: number;
  if (widthMode === "text") {
    width = getTextWidth(transformedText);
  } else if (widthMode === "full") {
    // Use terminal width helper for consistency
    width = getTerminalWidth();
  } else {
    width = widthMode;
  }

  // Build separator line
  const separatorLine = separator.repeat(width);

  return `${transformedText}\n${separatorLine}`;
}
