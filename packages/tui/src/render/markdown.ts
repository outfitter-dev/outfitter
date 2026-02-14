/**
 * Markdown rendering utilities.
 *
 * Renders markdown text to terminal with ANSI styling.
 *
 * @packageDocumentation
 */

import { ANSI } from "@outfitter/cli/colors";
import { supportsColor } from "@outfitter/cli/terminal";

/**
 * Renders markdown to terminal with ANSI styling.
 *
 * Supports the following markdown elements:
 * - Headings (`# Heading`) - rendered bold
 * - Bold (`**text**` or `__text__`) - rendered bold
 * - Italic (`*text*` or `_text_`) - rendered italic
 * - Inline code (`` `code` ``) - rendered cyan
 * - Code blocks (` ``` `) - rendered dim
 *
 * When colors are not supported, markdown syntax is stripped
 * but text content is preserved.
 *
 * @param markdown - Markdown text to render
 * @returns Terminal-formatted string with ANSI codes
 *
 * @example
 * ```typescript
 * const md = `# Heading
 *
 * Some **bold** and *italic* text.
 *
 * Use \`npm install\` to install.
 * `;
 *
 * console.log(renderMarkdown(md));
 * ```
 */
export function renderMarkdown(markdown: string): string {
  const colorEnabled = supportsColor();

  let result = markdown;

  // Process code blocks first (before inline code)
  result = result.replace(
    /```(\w*)\n([\s\S]*?)```/g,
    (_match, _lang, code: string) => {
      const trimmed = code.trimEnd();
      if (colorEnabled) {
        return `${ANSI.dim}${trimmed}${ANSI.reset}`;
      }
      return trimmed;
    }
  );

  // Headings (# Heading)
  result = result.replace(
    /^(#{1,6})\s+(.+)$/gm,
    (_match, _hashes, text: string) => {
      if (colorEnabled) {
        return `${ANSI.bold}${text}${ANSI.reset}`;
      }
      return text;
    }
  );

  // Bold (**text** or __text__)
  result = result.replace(/\*\*(.+?)\*\*/g, (_match, text: string) => {
    if (colorEnabled) {
      return `${ANSI.bold}${text}${ANSI.reset}`;
    }
    return text;
  });
  result = result.replace(/__(.+?)__/g, (_match, text: string) => {
    if (colorEnabled) {
      return `${ANSI.bold}${text}${ANSI.reset}`;
    }
    return text;
  });

  // Italic (*text* or _text_) - be careful not to match bold
  result = result.replace(
    /(?<!\*)\*([^*]+)\*(?!\*)/g,
    (_match, text: string) => {
      if (colorEnabled) {
        return `${ANSI.italic}${text}${ANSI.reset}`;
      }
      return text;
    }
  );
  result = result.replace(/(?<!_)_([^_]+)_(?!_)/g, (_match, text: string) => {
    if (colorEnabled) {
      return `${ANSI.italic}${text}${ANSI.reset}`;
    }
    return text;
  });

  // Inline code (`code`)
  result = result.replace(/`([^`]+)`/g, (_match, text: string) => {
    if (colorEnabled) {
      return `${ANSI.cyan}${text}${ANSI.reset}`;
    }
    return text;
  });

  return result;
}
