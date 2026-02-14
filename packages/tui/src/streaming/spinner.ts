/**
 * Animated spinner for terminal output.
 *
 * @packageDocumentation
 */

import { getIndicator } from "../render/indicators.js";
import { ANSI } from "./ansi.js";
import type { WritableStream } from "./writer.js";

/**
 * Spinner frame sets.
 */
const SPINNER_FRAMES = {
  dots: ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"],
  line: ["-", "\\", "|", "/"],
  simple: ["◐", "◓", "◑", "◒"],
} as const;

/**
 * Available spinner styles.
 */
export type SpinnerStyle = keyof typeof SPINNER_FRAMES;

/**
 * Options for creating a spinner.
 */
export interface SpinnerOptions {
  /** Spinner style */
  style?: SpinnerStyle;
  /** Target stream */
  stream?: WritableStream;
  /** Frame interval in ms */
  interval?: number;
}

/**
 * Spinner interface for animated progress indication.
 */
export interface Spinner {
  /** Start the spinner */
  start(): void;
  /** Update the spinner message */
  update(message: string): void;
  /** Stop with success state */
  succeed(message?: string): void;
  /** Stop with failure state */
  fail(message?: string): void;
  /** Stop the spinner */
  stop(): void;
}

/**
 * Creates an animated spinner for indicating progress.
 *
 * In TTY mode, shows an animated spinner. In non-TTY mode,
 * falls back to static output.
 *
 * @param message - Initial spinner message
 * @param options - Spinner configuration
 * @returns Spinner instance
 *
 * @example
 * ```typescript
 * import { createSpinner } from "@outfitter/cli/streaming";
 *
 * const spinner = createSpinner("Installing dependencies");
 * spinner.start();
 *
 * try {
 *   await install();
 *   spinner.succeed("Dependencies installed");
 * } catch (error) {
 *   spinner.fail("Installation failed");
 * }
 * ```
 */
export function createSpinner(
  message: string,
  options: SpinnerOptions = {}
): Spinner {
  const stream = options.stream ?? process.stdout;
  const isTTY = stream.isTTY ?? false;
  const style = options.style ?? "dots";
  const interval = options.interval ?? 80;

  const frames = SPINNER_FRAMES[style];
  let frameIndex = 0;
  let currentMessage = message;
  let timer: ReturnType<typeof setInterval> | null = null;
  let isRunning = false;

  const render = (): void => {
    if (!isTTY) {
      return;
    }

    const frame = frames[frameIndex % frames.length];
    stream.write(
      `${ANSI.carriageReturn}${ANSI.clearLine}${frame} ${currentMessage}`
    );
    frameIndex++;
  };

  const start = (): void => {
    if (isRunning) return;
    isRunning = true;

    if (!isTTY) {
      stream.write(`- ${currentMessage}\n`);
      return;
    }

    stream.write(ANSI.hideCursor);
    render();
    timer = setInterval(render, interval);
  };

  const update = (newMessage: string): void => {
    currentMessage = newMessage;

    if (!isTTY) {
      stream.write(`- ${currentMessage}\n`);
      return;
    }

    if (isRunning) {
      render();
    }
  };

  const stopWith = (symbol: string, finalMessage?: string): void => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }

    const msg = finalMessage ?? currentMessage;

    if (isTTY) {
      stream.write(`${ANSI.carriageReturn}${ANSI.clearLine}${symbol} ${msg}\n`);
      stream.write(ANSI.showCursor);
    } else {
      stream.write(`${symbol} ${msg}\n`);
    }

    isRunning = false;
  };

  const succeed = (finalMessage?: string): void => {
    const symbol = getIndicator("status", "success", isTTY);
    stopWith(symbol, finalMessage);
  };

  const fail = (finalMessage?: string): void => {
    const symbol = getIndicator("status", "error", isTTY);
    stopWith(symbol, finalMessage);
  };

  const stop = (): void => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }

    if (isTTY && isRunning) {
      stream.write(`${ANSI.carriageReturn}${ANSI.clearLine}`);
      stream.write(ANSI.showCursor);
    }

    isRunning = false;
  };

  return { start, update, succeed, fail, stop };
}
