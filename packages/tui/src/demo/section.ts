/**
 * Demo section builder utilities.
 *
 * Provides composable helpers for building demo sections with consistent
 * styling using modern render primitives.
 *
 * @packageDocumentation
 */

import type { Theme } from "@outfitter/cli/colors";
import {
  type CaseMode,
  renderHeading,
  type SeparatorStyle,
} from "../render/heading.js";
import { joinVertical } from "../render/layout.js";

/**
 * Options for creating a demo section.
 */
export interface SectionOptions {
  /** Separator character style (default: "─") */
  separator?: SeparatorStyle;
  /** Case transformation (default: "title") */
  case?: CaseMode;
}

/**
 * Options for creating a subsection.
 */
export interface SubsectionOptions {
  /** Separator character style (default: "─") */
  separator?: SeparatorStyle;
  /** Case transformation (default: "title") */
  case?: CaseMode;
}

/**
 * Creates a demo section heading.
 *
 * Sections are major divisions in a demo, rendered with title case text
 * and thin Unicode line separators by default.
 *
 * @param title - The section title
 * @param options - Optional rendering options
 * @returns Formatted section heading string
 *
 * @example
 * ```typescript
 * import { demoSection } from "@outfitter/cli/demo";
 *
 * console.log(demoSection("Theme Colors"));
 * // Theme Colors
 * // ────────────
 * ```
 */
export function demoSection(title: string, options?: SectionOptions): string {
  return renderHeading(title, {
    separator: options?.separator ?? "─",
    case: options?.case ?? "title",
  });
}

/**
 * Creates a demo subsection heading.
 *
 * Subsections are minor divisions within a section, rendered with title case
 * text and thin Unicode line separators by default.
 *
 * @param title - The subsection title
 * @param options - Optional rendering options
 * @returns Formatted subsection heading string
 *
 * @example
 * ```typescript
 * import { demoSubsection } from "@outfitter/cli/demo";
 *
 * console.log(demoSubsection("Status"));
 * // Status
 * // ──────
 * ```
 */
export function demoSubsection(
  title: string,
  options?: SubsectionOptions
): string {
  return renderHeading(title, {
    separator: options?.separator ?? "─",
    case: options?.case ?? "title",
  });
}

/**
 * Creates a code block for demo sections.
 *
 * Code blocks are displayed when `showCode` is enabled and provide
 * usage examples for the primitives being demonstrated.
 *
 * @param lines - Lines of code to display
 * @param show - Whether to show the code block (default: true)
 * @returns Array of code lines, or empty array if hidden
 *
 * @example
 * ```typescript
 * import { codeBlock } from "@outfitter/cli/demo";
 *
 * const code = codeBlock([
 *   'import { renderBox } from "@outfitter/cli/render";',
 *   "",
 *   'renderBox("Hello")',
 * ], true);
 * ```
 */
export function codeBlock(lines: string[], show = true): string[] {
  if (!show) return [];
  return lines;
}

/**
 * Creates a description line styled with muted theme.
 *
 * Descriptions provide contextual information about a demo section
 * when `showDescriptions` is enabled.
 *
 * @param text - The description text
 * @param theme - Theme for styling
 * @param show - Whether to show the description (default: true)
 * @returns Array with styled description, or empty array if hidden
 *
 * @example
 * ```typescript
 * import { description } from "@outfitter/cli/demo";
 *
 * const desc = description(
 *   "Control padding per side with an object.",
 *   theme,
 *   true
 * );
 * ```
 */
export function description(text: string, theme: Theme, show = true): string[] {
  if (!show) return [];
  return [theme.muted(text)];
}

/**
 * Joins demo content with vertical spacing.
 *
 * Wraps `joinVertical` with demo-appropriate defaults.
 *
 * @param blocks - Content blocks to join
 * @param gap - Lines of spacing between blocks (default: 1)
 * @returns Combined string with blocks stacked
 *
 * @example
 * ```typescript
 * import { demoSection, demoContent } from "@outfitter/cli/demo";
 *
 * const output = demoContent([
 *   demoSection("Colors"),
 *   "Color examples here...",
 *   demoSection("Borders"),
 *   "Border examples here...",
 * ]);
 * ```
 */
export function demoContent(blocks: string[], gap = 1): string {
  // Filter out empty strings to avoid extra spacing
  const filtered = blocks.filter((b) => b !== "");
  return joinVertical(filtered, { gap });
}
