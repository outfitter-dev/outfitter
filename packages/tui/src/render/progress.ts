/**
 * Progress bar rendering utilities.
 *
 * Renders progress bars with filled and empty segments.
 *
 * @packageDocumentation
 */

/**
 * Configuration options for {@link renderProgress}.
 *
 * @example
 * ```typescript
 * const options: ProgressOptions = {
 *   current: 75,
 *   total: 100,
 *   width: 20,
 *   showPercent: true,
 * };
 * // Renders: [###############.....] 75%
 * ```
 */
export interface ProgressOptions {
  /** Current progress value */
  current: number;
  /** Total value (100% when current equals total) */
  total: number;
  /** Width of the progress bar in characters (default: 20) */
  width?: number;
  /** Whether to show percentage after the bar (default: false) */
  showPercent?: boolean;
}

/**
 * Renders a progress bar with filled and empty segments.
 *
 * Uses unicode block characters: filled segments, empty segments.
 * Optionally displays percentage after the bar.
 *
 * Handles edge cases:
 * - `total <= 0`: Returns empty bar with 0%
 * - `current > total`: Caps at 100%
 * - `current < 0`: Floors at 0%
 *
 * @param options - Progress bar configuration
 * @returns Formatted progress bar string
 *
 * @example
 * ```typescript
 * renderProgress({ current: 50, total: 100 });
 * // [##########..........]
 *
 * renderProgress({ current: 75, total: 100, showPercent: true });
 * // [###############.....] 75%
 *
 * renderProgress({ current: 30, total: 100, width: 10 });
 * // [###.......]
 * ```
 */
export function renderProgress(options: ProgressOptions): string {
  const { current, total, width = 20, showPercent = false } = options;

  // Guard against total <= 0 to avoid NaN/Infinity and RangeError from repeat()
  if (total <= 0) {
    const bar = "\u2591".repeat(width);
    return showPercent ? `[${bar}] 0%` : `[${bar}]`;
  }

  const percent = Math.min(100, Math.max(0, (current / total) * 100));
  const filled = Math.round((percent / 100) * width);
  const empty = width - filled;

  const bar = "\u2588".repeat(filled) + "\u2591".repeat(empty);

  if (showPercent) {
    return `[${bar}] ${Math.round(percent)}%`;
  }

  return `[${bar}]`;
}
