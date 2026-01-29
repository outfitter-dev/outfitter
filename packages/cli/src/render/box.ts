/**
 * Box rendering utilities.
 *
 * Renders content within bordered panels with optional titles.
 *
 * @packageDocumentation
 */

import { type BorderStyle, getBorderCharacters } from "./borders.js";
import { getStringWidth, truncateText, wrapText } from "./text.js";

// ============================================================================
// Types
// ============================================================================

/**
 * Text alignment options for box content.
 */
export type BoxAlign = "left" | "center" | "right";

/**
 * Options for customizing box rendering.
 *
 * @example
 * ```typescript
 * // Box with title and rounded corners
 * renderBox("Content", {
 *   title: "Status",
 *   border: "rounded",
 *   padding: 1,
 * });
 *
 * // Fixed-width centered box
 * renderBox("Centered", {
 *   width: 40,
 *   align: "center",
 * });
 * ```
 */
export interface BoxOptions {
  /**
   * Border style to use.
   * @default "single"
   */
  border?: BorderStyle;

  /**
   * Internal padding (spaces between border and content).
   * @default 1
   */
  padding?: number;

  /**
   * Fixed width for the box. If not specified, auto-fits to content.
   */
  width?: number;

  /**
   * Optional title to display in the top border.
   */
  title?: string;

  /**
   * Content alignment within the box.
   * @default "left"
   */
  align?: BoxAlign;

  /**
   * Content sections separated by internal dividers.
   * Each section can be a string or string[].
   * When provided, takes precedence over the content parameter.
   *
   * @example
   * ```typescript
   * renderBox("", {
   *   sections: [
   *     "Header",
   *     ["Line 1", "Line 2"],
   *     "Footer"
   *   ],
   *   border: "single"
   * });
   * // ┌─────────────────┐
   * // │ Header          │
   * // ├─────────────────┤
   * // │ Line 1          │
   * // │ Line 2          │
   * // ├─────────────────┤
   * // │ Footer          │
   * // └─────────────────┘
   * ```
   */
  sections?: Array<string | string[]>;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Pads a line to a specific width with given alignment.
 */
function alignLine(line: string, width: number, align: BoxAlign): string {
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
  const padding = options?.padding ?? 1;
  const title = options?.title;
  const align = options?.align ?? "left";
  const fixedWidth = options?.width;
  const sections = options?.sections;

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

  // Handle wrapping if width is specified
  if (fixedWidth) {
    // Calculate available content width (total - borders - padding)
    const contentWidthForWrap = fixedWidth - 2 - padding * 2;
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
    contentWidth = fixedWidth - 2 - padding * 2;
  } else {
    // Box width = borders (2) + padding (2 * padding) + content
    boxWidth = 2 + padding * 2 + contentWidth;

    // Ensure minimum width for title if present (only for auto-width)
    if (title) {
      // Title needs: "─ " + title + " ─" = 4 chars + title length, plus 2 for borders
      const minBoxWidthForTitle = getStringWidth(title) + 6;
      if (boxWidth < minBoxWidthForTitle) {
        boxWidth = minBoxWidthForTitle;
        contentWidth = boxWidth - 2 - padding * 2;
      }
    }
  }

  const output: string[] = [];
  const paddingStr = " ".repeat(padding);

  // Top border with optional title
  let topBorder: string;
  const innerWidth = boxWidth - 2;
  if (title) {
    // Truncate title if needed
    const maxTitleWidth = innerWidth - 4; // leave room for "─ Title ─"
    let displayTitle = title;
    if (getStringWidth(title) > maxTitleWidth) {
      displayTitle = truncateText(title, maxTitleWidth);
    }
    const titlePart = `${chars.horizontal} ${displayTitle} `;
    const remainingWidth = innerWidth - getStringWidth(titlePart);
    topBorder =
      chars.topLeft +
      titlePart +
      chars.horizontal.repeat(remainingWidth) +
      chars.topRight;
  } else {
    topBorder =
      chars.topLeft + chars.horizontal.repeat(innerWidth) + chars.topRight;
  }
  output.push(topBorder);

  // Track which boundary we're looking at
  let boundaryIdx = 0;

  // Content lines with padding (and dividers between sections)
  for (const [idx, line] of lines.entries()) {
    const alignedLine = alignLine(line, contentWidth, align);
    output.push(
      chars.vertical + paddingStr + alignedLine + paddingStr + chars.vertical
    );

    // Insert divider after this line if it's a section boundary
    const boundary = sectionBoundaries[boundaryIdx];
    if (boundary !== undefined && idx + 1 === boundary) {
      const divider =
        chars.leftT + chars.horizontal.repeat(innerWidth) + chars.rightT;
      output.push(divider);
      boundaryIdx++;
    }
  }

  // Bottom border
  const bottomBorder =
    chars.bottomLeft + chars.horizontal.repeat(innerWidth) + chars.bottomRight;
  output.push(bottomBorder);

  return output.join("\n");
}
