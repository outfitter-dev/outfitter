/**
 * Indicator primitives for CLI output.
 *
 * Provides status symbols, selection indicators, list bullets, and progress
 * markers with unicode and ASCII fallback support.
 *
 * @packageDocumentation
 */

/**
 * Categories of indicators available.
 */
export type IndicatorCategory =
  | "status"
  | "marker"
  | "progress"
  | "triangle"
  | "special"
  | "directional"
  | "math";

/**
 * An indicator with unicode and fallback representations.
 */
export interface IndicatorSet {
  /** Unicode character for modern terminals */
  unicode: string;
  /** ASCII fallback for limited terminals */
  fallback: string;
  /** Optional semantic color name */
  color?: string;
}

/**
 * All available indicators organized by category.
 *
 * @example
 * ```typescript
 * import { INDICATORS, getIndicator } from "@outfitter/cli/render";
 *
 * // Access directly
 * console.log(INDICATORS.status.success.unicode); // "✔"
 *
 * // Or use helper
 * console.log(getIndicator("status", "success")); // "✔" or "[ok]"
 * ```
 */
export const INDICATORS: Record<
  IndicatorCategory,
  Record<string, IndicatorSet>
> = {
  status: {
    success: { unicode: "✔", fallback: "[ok]", color: "green" },
    error: { unicode: "✖", fallback: "[x]", color: "red" },
    warning: { unicode: "⚠", fallback: "[!]", color: "yellow" },
    info: { unicode: "ℹ", fallback: "[i]", color: "blue" },
  },
  marker: {
    // Circles
    circle: { unicode: "●", fallback: "*" },
    circleOutline: { unicode: "○", fallback: "o" },
    circleDotted: { unicode: "◌", fallback: "o" },
    circleSmall: { unicode: "•", fallback: "·" },
    circleDot: { unicode: "◉", fallback: "(*)" },
    circleDotOutline: { unicode: "◯", fallback: "( )" },
    // Squares
    square: { unicode: "■", fallback: "[#]" },
    squareOutline: { unicode: "□", fallback: "[ ]" },
    squareSmall: { unicode: "◼", fallback: "[#]" },
    squareSmallOutline: { unicode: "◻", fallback: "[ ]" },
    // Lozenges
    lozenge: { unicode: "◆", fallback: "♦" },
    lozengeOutline: { unicode: "◇", fallback: "◊" },
    lozengeDot: { unicode: "◈", fallback: "♦♦" },
    // Lines
    dash: { unicode: "–", fallback: "-" },
    // Pointers
    pointer: { unicode: "❯", fallback: ">" },
    pointerSmall: { unicode: "›", fallback: ">" },
    // Checkboxes
    checkbox: { unicode: "☐", fallback: "[ ]" },
    checkboxChecked: { unicode: "☑", fallback: "[x]" },
    checkboxCross: { unicode: "☒", fallback: "[X]" },
  },
  progress: {
    // Circle-based (5 steps)
    circleEmpty: { unicode: "○", fallback: "." },
    circleQuarter: { unicode: "◔", fallback: "o" },
    circleHalf: { unicode: "◑", fallback: "O" },
    circleThree: { unicode: "◕", fallback: "0" },
    circleFull: { unicode: "●", fallback: "@" },
    // Vertical blocks (8 steps, bottom-up)
    vertical1: { unicode: "▁", fallback: "_" },
    vertical2: { unicode: "▂", fallback: "_" },
    vertical3: { unicode: "▃", fallback: "=" },
    vertical4: { unicode: "▄", fallback: "=" },
    vertical5: { unicode: "▅", fallback: "#" },
    vertical6: { unicode: "▆", fallback: "#" },
    vertical7: { unicode: "▇", fallback: "#" },
    verticalFull: { unicode: "█", fallback: "#" },
    // Horizontal blocks (8 steps, left-to-right)
    horizontal1: { unicode: "▏", fallback: "|" },
    horizontal2: { unicode: "▎", fallback: "|" },
    horizontal3: { unicode: "▍", fallback: "|" },
    horizontal4: { unicode: "▌", fallback: "|" },
    horizontal5: { unicode: "▋", fallback: "|" },
    horizontal6: { unicode: "▊", fallback: "|" },
    horizontal7: { unicode: "▉", fallback: "|" },
    horizontalFull: { unicode: "█", fallback: "#" },
    // Shades (for backgrounds/fills)
    shadeLight: { unicode: "░", fallback: "." },
    shadeMedium: { unicode: "▒", fallback: ":" },
    shadeDark: { unicode: "▓", fallback: "#" },
  },
  triangle: {
    up: { unicode: "▲", fallback: "^" },
    upSmall: { unicode: "▴", fallback: "^" },
    upOutline: { unicode: "△", fallback: "^" },
    down: { unicode: "▼", fallback: "v" },
    downSmall: { unicode: "▾", fallback: "v" },
    downOutline: { unicode: "▽", fallback: "v" },
    left: { unicode: "◀", fallback: "<" },
    leftSmall: { unicode: "◂", fallback: "<" },
    leftOutline: { unicode: "◁", fallback: "<" },
    right: { unicode: "▶", fallback: ">" },
    rightSmall: { unicode: "▸", fallback: ">" },
    rightOutline: { unicode: "▷", fallback: ">" },
  },
  special: {
    star: { unicode: "★", fallback: "*" },
    starOutline: { unicode: "☆", fallback: "*" },
    heart: { unicode: "♥", fallback: "<3" },
    heartOutline: { unicode: "♡", fallback: "<3" },
    flag: { unicode: "⚑", fallback: "[F]" },
    flagOutline: { unicode: "⚐", fallback: "[f]" },
    gear: { unicode: "⚙", fallback: "[*]" },
  },
  directional: {
    arrowUp: { unicode: "↑", fallback: "^" },
    arrowDown: { unicode: "↓", fallback: "v" },
    arrowLeft: { unicode: "←", fallback: "<-" },
    arrowRight: { unicode: "→", fallback: "->" },
    arrowLeftRight: { unicode: "↔", fallback: "<->" },
    arrowUpDown: { unicode: "↕", fallback: "^v" },
  },
  math: {
    almostEqual: { unicode: "≈", fallback: "~=" },
    notEqual: { unicode: "≠", fallback: "!=" },
    lessOrEqual: { unicode: "≤", fallback: "<=" },
    greaterOrEqual: { unicode: "≥", fallback: ">=" },
    identical: { unicode: "≡", fallback: "===" },
    infinity: { unicode: "∞", fallback: "inf" },
  },
};

/**
 * Detects if the terminal supports Unicode characters.
 *
 * Checks for:
 * - CI environments (usually support unicode)
 * - Windows Terminal / ConEmu
 * - TERM containing xterm/vt100
 * - Locale settings
 *
 * @returns true if unicode is likely supported
 */
export function isUnicodeSupported(): boolean {
  // CI environments generally support unicode
  if (process.env["CI"]) {
    return true;
  }

  // Check for Windows Terminal (supports unicode)
  if (process.env["WT_SESSION"]) {
    return true;
  }

  // Check for ConEmu (supports unicode)
  if (process.env["ConEmuTask"]) {
    return true;
  }

  // Check TERM for common unicode-supporting terminals
  const term = process.env["TERM"] ?? "";
  if (
    term === "xterm-256color" ||
    term === "xterm" ||
    term.includes("256color") ||
    term.includes("truecolor")
  ) {
    return true;
  }

  // Check locale for UTF-8
  const lang = process.env["LANG"] ?? process.env["LC_ALL"] ?? "";
  if (
    lang.toLowerCase().includes("utf-8") ||
    lang.toLowerCase().includes("utf8")
  ) {
    return true;
  }

  // Default to true on non-Windows platforms
  if (process.platform !== "win32") {
    return true;
  }

  return false;
}

/**
 * Gets an indicator character with automatic unicode/fallback selection.
 *
 * @param category - The indicator category
 * @param name - The indicator name within the category
 * @param forceUnicode - Override unicode detection (useful for testing)
 * @returns The appropriate character for the current terminal
 *
 * @example
 * ```typescript
 * // Automatic detection
 * console.log(getIndicator("status", "success"));
 *
 * // Force unicode
 * console.log(getIndicator("status", "success", true)); // "✔"
 *
 * // Force fallback
 * console.log(getIndicator("status", "success", false)); // "[ok]"
 * ```
 */
export function getIndicator(
  category: IndicatorCategory,
  name: string,
  forceUnicode?: boolean
): string {
  const indicator = INDICATORS[category][name];
  if (!indicator) {
    return "";
  }

  const useUnicode = forceUnicode ?? isUnicodeSupported();
  return useUnicode ? indicator.unicode : indicator.fallback;
}

/**
 * Progress indicator styles.
 */
export type ProgressStyle = "circle" | "vertical" | "horizontal" | "shade";

/**
 * Sequences of indicator names for each progress style.
 * Ordered from empty/low to full/high.
 */
const PROGRESS_SEQUENCES: Record<ProgressStyle, string[]> = {
  circle: [
    "circleEmpty",
    "circleQuarter",
    "circleHalf",
    "circleThree",
    "circleFull",
  ],
  vertical: [
    "vertical1",
    "vertical2",
    "vertical3",
    "vertical4",
    "vertical5",
    "vertical6",
    "vertical7",
    "verticalFull",
  ],
  horizontal: [
    "horizontal1",
    "horizontal2",
    "horizontal3",
    "horizontal4",
    "horizontal5",
    "horizontal6",
    "horizontal7",
    "horizontalFull",
  ],
  shade: ["shadeLight", "shadeMedium", "shadeDark"],
};

/**
 * Gets a progress indicator based on current/max values.
 *
 * @param style - The progress style (circle, vertical, horizontal, shade)
 * @param current - Current progress value
 * @param max - Maximum progress value
 * @param forceUnicode - Override unicode detection
 * @returns The appropriate progress indicator character
 *
 * @example
 * ```typescript
 * // Circle progress at 50%
 * getProgressIndicator("circle", 50, 100); // "◑"
 *
 * // Vertical block at 75%
 * getProgressIndicator("vertical", 6, 8); // "▆"
 *
 * // Horizontal bar at 100%
 * getProgressIndicator("horizontal", 1, 1); // "█"
 * ```
 */
export function getProgressIndicator(
  style: ProgressStyle,
  current: number,
  max: number,
  forceUnicode?: boolean
): string {
  const sequence = PROGRESS_SEQUENCES[style];
  const steps = sequence.length;

  // Calculate ratio (clamped 0-1)
  const ratio = max <= 0 ? 0 : Math.max(0, Math.min(1, current / max));

  // Map to step index (0 at 0%, last at 100%)
  const index = Math.round(ratio * (steps - 1));
  const name = sequence[index];

  if (name === undefined) {
    return "";
  }

  return getIndicator("progress", name, forceUnicode);
}

/**
 * Severity levels for escalating indicators.
 *
 * Uses the diamond family: ◇ (minor) → ◆ (moderate) → ◈ (severe)
 */
export type SeverityLevel = "minor" | "moderate" | "severe";

/**
 * Mapping from severity level to marker indicator name.
 */
const SEVERITY_MARKERS: Record<SeverityLevel, string> = {
  minor: "lozengeOutline",
  moderate: "lozenge",
  severe: "lozengeDot",
};

/**
 * Gets a severity indicator for the given level.
 *
 * @param level - The severity level
 * @param forceUnicode - Override unicode detection
 * @returns The appropriate severity indicator character
 *
 * @example
 * ```typescript
 * getSeverityIndicator("minor");    // "◇"
 * getSeverityIndicator("moderate"); // "◆"
 * getSeverityIndicator("severe");   // "◈"
 * ```
 */
export function getSeverityIndicator(
  level: SeverityLevel,
  forceUnicode?: boolean
): string {
  const name = SEVERITY_MARKERS[level];
  return getIndicator("marker", name, forceUnicode);
}
