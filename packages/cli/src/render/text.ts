/**
 * Text formatting utilities.
 *
 * Functions for measuring, wrapping, truncating, and padding text
 * while respecting ANSI escape codes.
 *
 * @packageDocumentation
 */

import { ANSI } from "./colors.js";

// ============================================================================
// Constants
// ============================================================================

/**
 * Regular expression pattern to match ANSI escape codes.
 */
// biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI escape codes require control characters
export const ANSI_REGEX: RegExp = /\x1b\[[0-9;]*m/g;

// ============================================================================
// Text Functions
// ============================================================================

/**
 * Removes ANSI escape codes from text.
 *
 * Useful for calculating visible string length or logging to files
 * where ANSI codes would appear as garbage.
 *
 * @param text - Text that may contain ANSI escape codes
 * @returns Text with all ANSI escape codes removed
 *
 * @example
 * ```typescript
 * const colored = "\x1b[32mGreen\x1b[0m text";
 * console.log(stripAnsi(colored)); // "Green text"
 * ```
 */
export function stripAnsi(text: string): string {
  return text.replace(ANSI_REGEX, "");
}

/**
 * Calculates the visible width of text, ignoring ANSI escape codes.
 *
 * Uses `Bun.stringWidth()` internally, which correctly handles:
 * - ANSI escape codes (ignored)
 * - Wide characters (CJK, emoji) counting as 2 columns
 * - Zero-width characters
 *
 * @param text - Text to measure (may contain ANSI codes)
 * @returns Visible width in terminal columns
 *
 * @example
 * ```typescript
 * getStringWidth("Hello");                    // 5
 * getStringWidth("\x1b[31mHello\x1b[0m");     // 5 (ANSI ignored)
 * getStringWidth("Hello");                    // 5
 * ```
 */
export function getStringWidth(text: string): number {
  return Bun.stringWidth(text);
}

/**
 * Wraps text at a specified width, preserving ANSI escape codes.
 *
 * Performs word-wrapping at the specified column width while:
 * - Preserving ANSI escape codes across line breaks
 * - Respecting word boundaries (no mid-word breaks)
 * - Trimming trailing whitespace from lines
 *
 * Uses Bun's native `Bun.wrapAnsi()` for high performance.
 *
 * @param text - Text to wrap (may contain ANSI codes)
 * @param width - Maximum visible width per line
 * @returns Wrapped text with newlines
 *
 * @example
 * ```typescript
 * const long = "This is a long sentence that should be wrapped";
 * console.log(wrapText(long, 20));
 * // This is a long
 * // sentence that
 * // should be wrapped
 *
 * // ANSI codes are preserved across line breaks
 * const colored = "\x1b[32mGreen text that wraps\x1b[0m";
 * console.log(wrapText(colored, 10));
 * ```
 */
export function wrapText(text: string, width: number): string {
  return Bun.wrapAnsi(text, width);
}

/**
 * Truncates text with ellipsis, respecting ANSI escape codes.
 *
 * Preserves ANSI escape sequences while truncating to visible width.
 * Adds "..." when text exceeds maxWidth. The ellipsis is included
 * in the maxWidth calculation.
 *
 * @param text - Text to truncate (may contain ANSI codes)
 * @param maxWidth - Maximum visible width including ellipsis
 * @returns Truncated text with ellipsis if needed
 *
 * @example
 * ```typescript
 * truncateText("Hello World", 8);  // "Hello..."
 * truncateText("Short", 10);       // "Short" (no change)
 *
 * // ANSI codes are preserved
 * truncateText("\x1b[32mGreen text\x1b[0m", 8);
 * // "\x1b[32mGreen\x1b[0m..."
 * ```
 */
export function truncateText(text: string, maxWidth: number): string {
  const visibleWidth = getStringWidth(text);

  if (visibleWidth <= maxWidth) {
    return text;
  }

  const ellipsis = "...";
  const ellipsisWidth = 3;
  const targetWidth = maxWidth - ellipsisWidth;

  if (targetWidth <= 0) {
    return ellipsis.slice(0, maxWidth);
  }

  // We need to truncate while preserving ANSI codes
  const stripped = stripAnsi(text);
  let result = "";
  let currentWidth = 0;
  let textIndex = 0;
  let fullIndex = 0;

  while (currentWidth < targetWidth && textIndex < stripped.length) {
    // Check if we're at an ANSI escape sequence in the original text
    while (fullIndex < text.length && text[fullIndex] === "\x1b") {
      // Find end of ANSI sequence
      // biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI escape codes require control characters
      const match = text.slice(fullIndex).match(/^\x1b\[[0-9;]*m/);
      if (match) {
        result += match[0];
        fullIndex += match[0].length;
      } else {
        break;
      }
    }

    if (fullIndex < text.length) {
      const char = text[fullIndex];
      if (char !== undefined) {
        const charWidth = Bun.stringWidth(char);
        if (currentWidth + charWidth <= targetWidth) {
          result += char;
          currentWidth += charWidth;
          textIndex++;
          fullIndex++;
        } else {
          break;
        }
      }
    }
  }

  // Add reset if we had ANSI codes
  const hasAnsi = result.includes("\x1b[");
  return result + (hasAnsi ? ANSI.reset : "") + ellipsis;
}

/**
 * Pads text to a specified width with trailing spaces, handling ANSI codes.
 *
 * Uses {@link getStringWidth} to calculate visible width, ignoring ANSI
 * escape codes. If text is already at or exceeds the target width,
 * returns it unchanged.
 *
 * @param text - Text to pad (may contain ANSI codes)
 * @param width - Target visible width
 * @returns Text padded with trailing spaces to reach target width
 *
 * @example
 * ```typescript
 * padText("Hi", 10);                        // "Hi        "
 * padText("\x1b[32mHi\x1b[0m", 10);          // "\x1b[32mHi\x1b[0m        "
 * padText("Already long enough", 5);        // "Already long enough"
 * ```
 */
export function padText(text: string, width: number): string {
  const visibleWidth = getStringWidth(text);
  const paddingNeeded = width - visibleWidth;

  if (paddingNeeded <= 0) {
    return text;
  }

  return text + " ".repeat(paddingNeeded);
}

/**
 * Pluralizes a word based on count.
 *
 * Returns a string with the count and the appropriate singular or plural
 * form of the word. By default, adds 's' for plural. Custom plural forms
 * can be provided for irregular words.
 *
 * @param count - The number of items
 * @param singular - The singular form of the word
 * @param plural - Optional custom plural form (defaults to singular + 's')
 * @returns Formatted string with count and pluralized word
 *
 * @example
 * ```typescript
 * pluralize(1, "item");           // "1 item"
 * pluralize(5, "item");           // "5 items"
 * pluralize(0, "child", "children"); // "0 children"
 * ```
 */
export function pluralize(
  count: number,
  singular: string,
  plural?: string
): string {
  const word = count === 1 ? singular : (plural ?? `${singular}s`);
  return `${count} ${word}`;
}

/**
 * Converts text to URL-safe slug.
 *
 * Transforms text into a lowercase, hyphen-separated string suitable
 * for URLs. Replaces ampersands with 'and', removes special characters,
 * and collapses multiple hyphens.
 *
 * @param text - Text to convert to slug
 * @returns URL-safe slug
 *
 * @example
 * ```typescript
 * slugify("Hello World!");       // "hello-world"
 * slugify("This & That");        // "this-and-that"
 * slugify("  Multiple   Spaces  "); // "multiple-spaces"
 * ```
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
