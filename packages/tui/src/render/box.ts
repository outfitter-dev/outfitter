/**
 * Box rendering utilities.
 *
 * Renders content within bordered panels with optional titles.
 *
 * @packageDocumentation
 */

import { getStringWidth, truncateText, wrapText } from "@outfitter/cli/text";

import { getBorderCharacters } from "./borders.js";
import { contentToLines } from "./internal/box-composition.js";
import {
  alignLine,
  normalizeBorders,
  normalizeMargin,
  normalizePadding,
} from "./internal/box-helpers.js";

// ============================================================================
// Re-exports
// ============================================================================

// Types
export type {
  Box,
  BoxAlign,
  BoxBorders,
  BoxContent,
  BoxOptions,
  BoxSpacing,
  NormalizedBorders,
  NormalizedSpacing,
} from "./internal/box-types.js";

// Helpers
export {
  normalizeBorders,
  normalizeMargin,
  normalizePadding,
} from "./internal/box-helpers.js";

// ============================================================================
// Imports for inline use
// ============================================================================

import type { Box, BoxContent, BoxOptions } from "./internal/box-types.js";

// ============================================================================
// Main Function
// ============================================================================

/**
 * Renders content within a bordered panel.
 *
 * Creates a box with Unicode borders around the content. Supports multiple
 * border styles, titles, padding, and alignment options.
 *
 * @param content - The content to render (string or array of strings)
 * @param options - Optional configuration for border style, padding, etc.
 * @returns Formatted box string
 *
 * @example
 * ```typescript
 * // Simple box
 * console.log(renderBox("Hello, world!"));
 * // ┌───────────────┐
 * // │ Hello, world! │
 * // └───────────────┘
 *
 * // Box with title
 * console.log(renderBox("All systems go", { title: "Status" }));
 * // ┌─ Status ──────┐
 * // │ All systems go │
 * // └────────────────┘
 *
 * // Rounded box with padding
 * console.log(renderBox(["Line 1", "Line 2"], {
 *   border: "rounded",
 *   padding: 2,
 * }));
 * // ╭──────────────╮
 * // │              │
 * // │  Line 1      │
 * // │  Line 2      │
 * // │              │
 * // ╰──────────────╯
 * ```
 */
export function renderBox(
  content: string | string[],
  options?: BoxOptions
): string {
  const border = options?.border ?? "single";
  const title = options?.title;
  const align = options?.align ?? "left";
  const fixedWidth = options?.width;
  const sections = options?.sections;

  // Normalize spacing and borders
  const pad = normalizePadding(options?.padding, 1);
  const margin = normalizeMargin(options?.margin, 0);
  const borders = normalizeBorders(options?.borders);

  const chars = getBorderCharacters(border);

  // Convert content to lines (or use sections if provided)
  let lines: string[];
  // Track section boundaries for divider insertion
  let sectionBoundaries: number[] = [];

  if (sections && sections.length > 0) {
    // Sections mode: convert each section to lines and track boundaries
    lines = [];
    for (const [idx, section] of sections.entries()) {
      const sectionLines =
        typeof section === "string" ? section.split("\n") : section;
      lines.push(...sectionLines);
      // Track where this section ends (cumulative line count)
      if (idx < sections.length - 1) {
        sectionBoundaries.push(lines.length);
      }
    }
  } else if (typeof content === "string") {
    lines = content.split("\n");
  } else {
    lines = content;
  }

  // Calculate horizontal padding/border overhead
  const leftOverhead = (borders.left ? 1 : 0) + pad.left;
  const rightOverhead = (borders.right ? 1 : 0) + pad.right;
  const horizontalOverhead = leftOverhead + rightOverhead;

  // Handle wrapping if width is specified
  if (fixedWidth) {
    // Calculate available content width (total - borders - padding)
    const contentWidthForWrap = fixedWidth - horizontalOverhead;
    if (contentWidthForWrap > 0) {
      const wrappedLines: string[] = [];
      const newBoundaries: number[] = [];
      let boundaryIdx = 0;
      let originalLineCount = 0;

      for (const line of lines) {
        if (getStringWidth(line) > contentWidthForWrap) {
          const wrapped = wrapText(line, contentWidthForWrap);
          wrappedLines.push(...wrapped.split("\n"));
        } else {
          wrappedLines.push(line);
        }

        originalLineCount++;

        // Adjust section boundaries for wrapped lines
        const boundary = sectionBoundaries[boundaryIdx];
        if (boundary !== undefined && originalLineCount === boundary) {
          newBoundaries.push(wrappedLines.length);
          boundaryIdx++;
        }
      }
      lines = wrappedLines;
      sectionBoundaries = newBoundaries;
    }
  }

  // Calculate content width (max line width)
  let contentWidth = 0;
  for (const line of lines) {
    const w = getStringWidth(line);
    if (w > contentWidth) {
      contentWidth = w;
    }
  }

  // If fixed width, use it; otherwise calculate from content
  let boxWidth: number;
  if (fixedWidth) {
    boxWidth = fixedWidth;
    contentWidth = fixedWidth - horizontalOverhead;
  } else {
    // Box width = borders + padding + content
    boxWidth = horizontalOverhead + contentWidth;

    // Ensure minimum width for title if present (only for auto-width)
    if (title && borders.top) {
      // Title needs: "─ " + title + " ─" = 4 chars + title length, plus corner chars
      const minBoxWidthForTitle =
        getStringWidth(title) +
        4 +
        (borders.left ? 1 : 0) +
        (borders.right ? 1 : 0);
      if (boxWidth < minBoxWidthForTitle) {
        boxWidth = minBoxWidthForTitle;
        contentWidth = boxWidth - horizontalOverhead;
      }
    }
  }

  const output: string[] = [];
  const leftPaddingStr = " ".repeat(pad.left);
  const rightPaddingStr = " ".repeat(pad.right);
  const marginLeftStr = " ".repeat(margin.left);
  const marginRightStr = " ".repeat(margin.right);

  // Helper to build a content line
  const buildContentLine = (lineContent: string): string => {
    const aligned = alignLine(lineContent, contentWidth, align);
    const leftBorder = borders.left ? chars.vertical : "";
    const rightBorder = borders.right ? chars.vertical : "";
    return (
      marginLeftStr +
      leftBorder +
      leftPaddingStr +
      aligned +
      rightPaddingStr +
      rightBorder +
      marginRightStr
    );
  };

  // Calculate inner width (for horizontal borders)
  const innerWidth =
    boxWidth - (borders.left ? 1 : 0) - (borders.right ? 1 : 0);

  // Add top margin
  for (let i = 0; i < margin.top; i++) {
    output.push("");
  }

  // Top border with optional title
  if (borders.top) {
    let topBorder: string;
    if (title) {
      // Truncate title if needed
      // Title needs: "─ " + title + " ─" at minimum (4 extra chars)
      const maxTitleWidth = Math.max(0, innerWidth - 4);
      let displayTitle = title;

      // If width is too small for even a single character title, skip title
      if (maxTitleWidth === 0) {
        topBorder =
          marginLeftStr +
          (borders.left ? chars.topLeft : "") +
          chars.horizontal.repeat(Math.max(0, innerWidth)) +
          (borders.right ? chars.topRight : "") +
          marginRightStr;
      } else {
        if (getStringWidth(title) > maxTitleWidth) {
          displayTitle = truncateText(title, maxTitleWidth);
        }
        const titlePart = `${chars.horizontal} ${displayTitle} `;
        const remainingWidth = Math.max(
          0,
          innerWidth - getStringWidth(titlePart)
        );
        topBorder =
          marginLeftStr +
          (borders.left ? chars.topLeft : "") +
          titlePart +
          chars.horizontal.repeat(remainingWidth) +
          (borders.right ? chars.topRight : "") +
          marginRightStr;
      }
    } else {
      topBorder =
        marginLeftStr +
        (borders.left ? chars.topLeft : "") +
        chars.horizontal.repeat(innerWidth) +
        (borders.right ? chars.topRight : "") +
        marginRightStr;
    }
    output.push(topBorder);
  }

  // Top padding lines
  for (let i = 0; i < pad.top; i++) {
    output.push(buildContentLine(""));
  }

  // Track which boundary we're looking at
  let boundaryIdx = 0;

  // Content lines with padding (and dividers between sections)
  for (const [idx, line] of lines.entries()) {
    output.push(buildContentLine(line));

    // Insert divider after this line if it's a section boundary
    const boundary = sectionBoundaries[boundaryIdx];
    if (boundary !== undefined && idx + 1 === boundary) {
      const divider =
        marginLeftStr +
        (borders.left ? chars.leftT : "") +
        chars.horizontal.repeat(innerWidth) +
        (borders.right ? chars.rightT : "") +
        marginRightStr;
      output.push(divider);
      boundaryIdx++;
    }
  }

  // Bottom padding lines
  for (let i = 0; i < pad.bottom; i++) {
    output.push(buildContentLine(""));
  }

  // Bottom border
  if (borders.bottom) {
    const bottomBorder =
      marginLeftStr +
      (borders.left ? chars.bottomLeft : "") +
      chars.horizontal.repeat(innerWidth) +
      (borders.right ? chars.bottomRight : "") +
      marginRightStr;
    output.push(bottomBorder);
  }

  // Add bottom margin
  for (let i = 0; i < margin.bottom; i++) {
    output.push("");
  }

  return output.join("\n");
}

// ============================================================================
// Box Composition
// ============================================================================

/**
 * Creates a Box object that can be composed with other boxes.
 *
 * Unlike `renderBox` which returns a string, `createBox` returns a Box object
 * with metadata (width, height) that enables nested composition.
 *
 * @param content - The content to render (string, string[], Box, or array of mixed)
 * @param options - Optional configuration for border style, padding, etc.
 * @returns Box object with output, width, and height
 *
 * @example
 * ```typescript
 * // Simple box
 * const box = createBox("Hello");
 * console.log(box.output);
 * console.log(`Width: ${box.width}, Height: ${box.height}`);
 *
 * // Nested boxes
 * const inner = createBox("Inner", { border: "rounded" });
 * const outer = createBox(inner, { border: "double", title: "Container" });
 * console.log(outer.output);
 * // ╔═ Container ═══════════════╗
 * // ║ ╭───────────────────────╮ ║
 * // ║ │ Inner                 │ ║
 * // ║ ╰───────────────────────╯ ║
 * // ╚═══════════════════════════╝
 * ```
 */
export function createBox(
  content: BoxContent | BoxContent[],
  options?: BoxOptions
): Box {
  // Convert BoxContent to string lines
  const lines = contentToLines(content);
  const output = renderBox(lines, options);
  const outputLines = output.split("\n");

  // Calculate max display width across all lines (handles ANSI, Unicode, margins)
  let maxWidth = 0;
  for (const line of outputLines) {
    const lineWidth = getStringWidth(line);
    if (lineWidth > maxWidth) {
      maxWidth = lineWidth;
    }
  }

  return {
    output,
    width: maxWidth,
    height: outputLines.length,
  };
}
