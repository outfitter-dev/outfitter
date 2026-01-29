/**
 * ANSI escape sequences for terminal control.
 *
 * @packageDocumentation
 */

/**
 * ANSI escape sequences for cursor and screen control.
 *
 * @example
 * ```typescript
 * import { ANSI } from "@outfitter/cli/streaming";
 *
 * // Move cursor up 2 lines and clear
 * process.stdout.write(ANSI.cursorUp(2) + ANSI.clearLine);
 *
 * // Hide cursor during animation
 * process.stdout.write(ANSI.hideCursor);
 * // ... do animation ...
 * process.stdout.write(ANSI.showCursor);
 * ```
 */
export const ANSI = {
  /** Move cursor up n lines */
  cursorUp: (n: number): string => `\x1b[${n}A`,

  /** Move cursor down n lines */
  cursorDown: (n: number): string => `\x1b[${n}B`,

  /** Move cursor right n columns */
  cursorRight: (n: number): string => `\x1b[${n}C`,

  /** Move cursor left n columns */
  cursorLeft: (n: number): string => `\x1b[${n}D`,

  /** Move cursor to beginning of line */
  cursorToStart: "\x1b[G",

  /** Clear entire line */
  clearLine: "\x1b[2K",

  /** Clear from cursor to end of screen */
  clearToEnd: "\x1b[0J",

  /** Clear from cursor to beginning of screen */
  clearToStart: "\x1b[1J",

  /** Clear entire screen */
  clearScreen: "\x1b[2J",

  /** Hide cursor */
  hideCursor: "\x1b[?25l",

  /** Show cursor */
  showCursor: "\x1b[?25h",

  /** Save cursor position */
  saveCursor: "\x1b[s",

  /** Restore cursor position */
  restoreCursor: "\x1b[u",

  /** Carriage return (move to start of line) */
  carriageReturn: "\r",

  /** New line */
  newLine: "\n",
} as const;
