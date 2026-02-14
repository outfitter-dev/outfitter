/**
 * Stream writer for in-place terminal updates.
 *
 * @packageDocumentation
 */

import { ANSI } from "./ansi.js";

/**
 * Minimal writable stream interface.
 */
export interface WritableStream {
  write(str: string): boolean;
  isTTY?: boolean;
}

/**
 * Options for creating a stream writer.
 */
export interface StreamWriterOptions {
  /** Target stream (defaults to process.stdout) */
  stream?: WritableStream;
}

/**
 * Interface for managing in-place terminal output.
 */
export interface StreamWriter {
  /** Write content (replaces current content) */
  write(content: string): void;
  /** Update content in place */
  update(content: string): void;
  /** Persist current content and move to new line */
  persist(): void;
  /** Clear current content */
  clear(): void;
}

/**
 * Creates a stream writer for in-place terminal updates.
 *
 * The writer tracks the number of lines written and can update them in place.
 * In non-TTY mode, it falls back to simple line-by-line output.
 *
 * @param options - Writer configuration
 * @returns StreamWriter instance
 *
 * @example
 * ```typescript
 * import { createStreamWriter } from "@outfitter/cli/streaming";
 *
 * const writer = createStreamWriter();
 *
 * writer.write("Processing...");
 * // Do some work
 * writer.update("Processing... 50%");
 * // Do more work
 * writer.update("Processing... 100%");
 * writer.persist();
 * writer.write("Done!");
 * ```
 */
export function createStreamWriter(
  options: StreamWriterOptions = {}
): StreamWriter {
  const stream = options.stream ?? process.stdout;
  const isTTY = stream.isTTY ?? false;

  let currentLineCount = 0;
  let hasContent = false;

  const write = (content: string): void => {
    if (!isTTY) {
      // Non-TTY: simple output
      stream.write(content);
      hasContent = true;
      return;
    }

    // Clear any existing content
    if (hasContent) {
      clear();
    }

    // Write new content
    stream.write(content);
    currentLineCount = content.split("\n").length;
    hasContent = true;
  };

  const update = (content: string): void => {
    if (!isTTY) {
      // Non-TTY: just append
      stream.write(`\n${content}`);
      hasContent = true;
      return;
    }

    // Move back to start and clear only our lines (not entire screen)
    if (currentLineCount > 0) {
      stream.write(ANSI.carriageReturn);
      if (currentLineCount > 1) {
        stream.write(ANSI.cursorUp(currentLineCount - 1));
      }
      // Clear each line individually to avoid erasing unrelated output
      for (let i = 0; i < currentLineCount; i++) {
        stream.write(ANSI.clearLine);
        if (i < currentLineCount - 1) {
          stream.write(ANSI.cursorDown(1));
        }
      }
      // Move back to first line
      if (currentLineCount > 1) {
        stream.write(ANSI.cursorUp(currentLineCount - 1));
      }
      stream.write(ANSI.carriageReturn);
    }

    // Write new content
    stream.write(content);
    currentLineCount = content.split("\n").length;
    hasContent = true;
  };

  const persist = (): void => {
    if (!hasContent) return;

    stream.write("\n");
    currentLineCount = 0;
    hasContent = false;
  };

  const clear = (): void => {
    if (!(isTTY && hasContent)) {
      hasContent = false;
      currentLineCount = 0;
      return;
    }

    // Move back to start
    stream.write(ANSI.carriageReturn);
    if (currentLineCount > 1) {
      stream.write(ANSI.cursorUp(currentLineCount - 1));
    }

    // Clear all lines
    stream.write(ANSI.clearLine);
    for (let i = 1; i < currentLineCount; i++) {
      stream.write(ANSI.cursorDown(1) + ANSI.clearLine);
    }

    // Return to start
    if (currentLineCount > 1) {
      stream.write(ANSI.cursorUp(currentLineCount - 1));
    }

    currentLineCount = 0;
    hasContent = false;
  };

  return { write, update, persist, clear };
}
