/**
 * Spinner rendering utilities.
 *
 * Provides animated spinner frames for async operations with
 * multiple styles and graceful degradation for non-TTY contexts.
 *
 * @packageDocumentation
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Available spinner animation styles.
 *
 * - `dots`: Braille dots animation (default, smooth)
 * - `line`: Classic ASCII spinner (-\|/)
 * - `arc`: Corner arc rotation
 * - `circle`: Half-filled circle rotation
 * - `bounce`: Bouncing dot (vertical)
 * - `ping`: Bouncing dot in brackets (horizontal)
 */
export type SpinnerStyle =
  | "dots"
  | "line"
  | "arc"
  | "circle"
  | "bounce"
  | "ping";

/**
 * Spinner animation frame definition.
 */
export interface SpinnerFrames {
  /** Array of characters to cycle through */
  frames: string[];
  /** Milliseconds between frame changes */
  interval: number;
}

// ============================================================================
// Spinner Presets
// ============================================================================

/**
 * Predefined spinner animations.
 *
 * @example
 * ```typescript
 * const dotsSpinner = SPINNERS.dots;
 * console.log(dotsSpinner.frames[0]); // "⠋"
 * console.log(dotsSpinner.interval);  // 80
 * ```
 */
export const SPINNERS: Record<SpinnerStyle, SpinnerFrames> = {
  dots: {
    frames: ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"],
    interval: 80,
  },
  line: {
    frames: ["-", "\\", "|", "/"],
    interval: 100,
  },
  arc: {
    frames: ["◜", "◝", "◞", "◟"],
    interval: 100,
  },
  circle: {
    frames: ["◐", "◓", "◑", "◒"],
    interval: 100,
  },
  bounce: {
    frames: ["⠁", "⠂", "⠄", "⠂"],
    interval: 120,
  },
  ping: {
    frames: [
      "(●    )",
      "( ●   )",
      "(  ●  )",
      "(   ● )",
      "(    ●)",
      "(   ● )",
      "(  ●  )",
      "( ●   )",
    ],
    interval: 80,
  },
};

// ============================================================================
// Static Functions
// ============================================================================

/**
 * Gets the spinner frame for a given elapsed time.
 *
 * Calculates which frame to display based on elapsed milliseconds
 * and the spinner's interval setting. Automatically wraps around
 * when the elapsed time exceeds a full cycle.
 *
 * @param style - The spinner style to use
 * @param elapsed - Elapsed time in milliseconds since spinner started
 * @returns The frame character to display
 *
 * @example
 * ```typescript
 * // Get frame at start
 * getSpinnerFrame("dots", 0); // "⠋"
 *
 * // Get frame after 160ms
 * getSpinnerFrame("dots", 160); // "⠹" (third frame)
 *
 * // Frames wrap around automatically
 * const fullCycle = SPINNERS.dots.interval * SPINNERS.dots.frames.length;
 * getSpinnerFrame("dots", fullCycle); // "⠋" (back to first)
 * ```
 */
export function getSpinnerFrame(style: SpinnerStyle, elapsed: number): string {
  const spinner = SPINNERS[style];
  const frameIndex =
    Math.floor(elapsed / spinner.interval) % spinner.frames.length;
  return spinner.frames[frameIndex] ?? spinner.frames[0] ?? "...";
}

/**
 * Renders a static spinner frame with optional message.
 *
 * This is the non-interactive version for logging and non-TTY contexts.
 * For animated spinners, use the elapsed parameter with `getSpinnerFrame()`.
 *
 * @param style - The spinner style to use
 * @param message - Optional message to display after the spinner
 * @returns Formatted spinner string
 *
 * @example
 * ```typescript
 * // Simple spinner
 * console.log(renderSpinner("dots"));
 * // "⠋"
 *
 * // Spinner with message
 * console.log(renderSpinner("dots", "Loading..."));
 * // "⠋ Loading..."
 *
 * // For logs (non-TTY)
 * logger.info(renderSpinner("line", "Fetching data"));
 * // "- Fetching data"
 * ```
 */
export function renderSpinner(style: SpinnerStyle, message?: string): string {
  const frame = getSpinnerFrame(style, 0);

  if (message && message.length > 0) {
    return `${frame} ${message}`;
  }

  return frame;
}
