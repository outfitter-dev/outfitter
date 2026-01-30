/**
 * Color tokens and ANSI utilities.
 *
 * Provides ANSI escape code constants, theme creation, and color application functions.
 *
 * @packageDocumentation
 */

import { resolveColorEnv, supportsColor } from "../terminal/detection.js";

// ============================================================================
// ANSI Constants
// ============================================================================

/**
 * ANSI escape code constants for terminal styling.
 */
export const ANSI = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  italic: "\x1b[3m",
  underline: "\x1b[4m",
  // Foreground colors
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
  white: "\x1b[37m",
  gray: "\x1b[90m",
  // Bright foreground colors
  brightCyan: "\x1b[96m",
  brightRed: "\x1b[91m",
  brightYellow: "\x1b[93m",
  brightGreen: "\x1b[92m",
  brightBlue: "\x1b[94m",
} as const;

// ============================================================================
// Types
// ============================================================================

/**
 * Theme interface with semantic and text color functions.
 *
 * Each function wraps text in ANSI escape codes when colors are supported.
 * When colors are not supported (NO_COLOR set, non-TTY), functions return the text unchanged.
 *
 * @example
 * ```typescript
 * const theme = createTheme();
 * console.log(theme.success("Done!"));       // Green text
 * console.log(theme.error("Failed!"));       // Red text
 * console.log(theme.muted("(optional)"));    // Dim text
 * ```
 */
export interface Theme {
  // Semantic colors (existing)
  /** Applies green color for success messages */
  success: (text: string) => string;
  /** Applies yellow color for warning messages */
  warning: (text: string) => string;
  /** Applies red color for error messages */
  error: (text: string) => string;
  /** Applies blue color for informational messages */
  info: (text: string) => string;
  /** Returns text unchanged (primary/default text) */
  primary: (text: string) => string;
  /** Applies gray color for secondary text */
  secondary: (text: string) => string;
  /** Applies dim styling for de-emphasized text */
  muted: (text: string) => string;

  // Semantic colors (new)
  /** Applies cyan color for interactive elements and highlights */
  accent: (text: string) => string;
  /** Applies bold for strong emphasis */
  highlight: (text: string) => string;
  /** Applies cyan + underline for URLs and clickable references */
  link: (text: string) => string;
  /** Applies bright red for dangerous actions */
  destructive: (text: string) => string;
  /** Applies dim gray for less prominent text than muted */
  subtle: (text: string) => string;

  // Utility methods
  /** Applies bold styling */
  bold: (text: string) => string;
  /** Applies italic styling */
  italic: (text: string) => string;
  /** Applies underline styling */
  underline: (text: string) => string;
  /** Applies dim styling (alias for muted style) */
  dim: (text: string) => string;
}

/**
 * Available color names for the {@link applyColor} function.
 *
 * @example
 * ```typescript
 * import { applyColor, ColorName } from "@outfitter/cli";
 *
 * const color: ColorName = "green";
 * console.log(applyColor("Success", color));
 * ```
 */
export type ColorName =
  | "green"
  | "yellow"
  | "red"
  | "blue"
  | "cyan"
  | "magenta"
  | "white"
  | "gray";

/**
 * Semantic color tokens as raw ANSI escape code strings.
 *
 * Unlike {@link Theme} which provides wrapper functions, Tokens provides
 * raw ANSI codes that can be used directly in template strings.
 *
 * When colors are not supported (NO_COLOR set, colorLevel: 0), all tokens
 * are empty strings.
 *
 * @example
 * ```typescript
 * const tokens = createTokens();
 * const reset = "\x1b[0m";
 *
 * console.log(`${tokens.success}Operation completed${reset}`);
 * console.log(`${tokens.error}Failed to connect${reset}`);
 * console.log(`${tokens.muted}(optional step)${reset}`);
 * ```
 */
export interface Tokens {
  // Semantic colors (existing)
  /** Green color for success messages */
  success: string;
  /** Yellow color for warning messages */
  warning: string;
  /** Red color for error messages */
  error: string;
  /** Blue color for informational messages */
  info: string;
  /** Default text color (typically empty string) */
  primary: string;
  /** Subdued color for secondary text */
  secondary: string;
  /** Dim/gray color for de-emphasized text */
  muted: string;

  // Semantic colors (new)
  /** Cyan color for interactive elements and highlights */
  accent: string;
  /** Bold for strong emphasis */
  highlight: string;
  /** Cyan + underline for URLs and clickable references */
  link: string;
  /** Bright red for dangerous actions */
  destructive: string;
  /** Dim gray for less prominent text than muted */
  subtle: string;

  // Utility tokens
  /** Bold styling */
  bold: string;
  /** Italic styling */
  italic: string;
  /** Underline styling */
  underline: string;
  /** Dim styling */
  dim: string;
}

/**
 * Configuration options for {@link createTokens}.
 *
 * @example
 * ```typescript
 * // Force colors even with NO_COLOR set
 * const tokens = createTokens({ forceColor: true });
 *
 * // Disable colors entirely
 * const noColorTokens = createTokens({ colorLevel: 0 });
 * ```
 */
export interface TokenOptions {
  /**
   * Override NO_COLOR environment variable.
   * When true, colors are enabled regardless of NO_COLOR.
   */
  forceColor?: boolean;
  /**
   * Color support level:
   * - 0: No color support (all tokens are empty strings)
   * - 1: Basic ANSI colors (16 colors)
   * - 2: 256 color support
   * - 3: True color (16 million colors)
   *
   * When not specified, level is auto-detected from environment.
   */
  colorLevel?: 0 | 1 | 2 | 3;
}

// ============================================================================
// Color Functions
// ============================================================================

/**
 * Creates a theme with semantic and text color functions.
 *
 * The theme provides functions that wrap text in ANSI escape codes.
 * When colors are not supported (NO_COLOR set, non-TTY), functions
 * return the text unchanged.
 *
 * Color support is determined once at theme creation time using
 * {@link supportsColor}.
 *
 * @returns Theme object with color functions
 *
 * @example
 * ```typescript
 * const theme = createTheme();
 *
 * // Semantic colors
 * console.log(theme.success("Done!"));       // Green
 * console.log(theme.warning("Caution"));     // Yellow
 * console.log(theme.error("Failed!"));       // Red
 * console.log(theme.info("Note"));           // Blue
 *
 * // Text colors
 * console.log(theme.primary("Main text"));   // Default
 * console.log(theme.secondary("Alt text"));  // Gray
 * console.log(theme.muted("(optional)"));    // Dim
 * ```
 */
export function createTheme(): Theme {
  const colorEnabled = supportsColor();

  const colorFn = (ansiCode: string) => (text: string) => {
    if (!colorEnabled) {
      return text;
    }
    return `${ansiCode}${text}${ANSI.reset}`;
  };

  return {
    // Semantic colors (existing)
    success: colorFn(ANSI.green),
    warning: colorFn(ANSI.yellow),
    error: colorFn(ANSI.red),
    info: colorFn(ANSI.blue),
    primary: colorFn(""), // No color, just the text
    secondary: colorFn(ANSI.gray),
    muted: colorFn(ANSI.dim),

    // Semantic colors (new)
    accent: colorFn(ANSI.cyan),
    highlight: colorFn(ANSI.bold),
    link: colorFn(`${ANSI.cyan}${ANSI.underline}`),
    destructive: colorFn(ANSI.brightRed),
    subtle: colorFn(`${ANSI.dim}${ANSI.gray}`),

    // Utility methods
    bold: colorFn(ANSI.bold),
    italic: colorFn(ANSI.italic),
    underline: colorFn(ANSI.underline),
    dim: colorFn(ANSI.dim),
  };
}

/**
 * Resolves whether color tokens should be enabled based on options.
 *
 * @param options - Token options
 * @returns `true` if colors should be enabled
 */
export function resolveTokenColorEnabled(options?: TokenOptions): boolean {
  // colorLevel: 0 always disables colors
  if (options?.colorLevel === 0) {
    return false;
  }
  // forceColor option takes precedence over environment
  if (options?.forceColor === true) {
    return true;
  }
  // Explicit color level overrides environment
  if (options?.colorLevel !== undefined) {
    return options.colorLevel > 0;
  }
  const env = resolveColorEnv({ forceColorFirst: true });
  if (env !== undefined) {
    return env;
  }
  return process.stdout.isTTY ?? false;
}

/**
 * Creates semantic color tokens as raw ANSI escape code strings.
 *
 * Unlike {@link createTheme} which returns wrapper functions, this returns
 * raw ANSI codes that can be used directly in template strings. This is
 * useful for more complex string formatting scenarios.
 *
 * Color support is determined at token creation time using environment
 * detection (NO_COLOR, FORCE_COLOR) or explicit options.
 *
 * @param options - Optional configuration for color behavior
 * @returns Object with semantic color tokens as ANSI strings
 *
 * @example
 * ```typescript
 * const tokens = createTokens();
 * const reset = "\x1b[0m";
 *
 * // Use in template strings
 * console.log(`${tokens.success}Done!${reset}`);
 * console.log(`${tokens.error}Failed${reset}`);
 *
 * // Build complex formatted strings
 * const status = `${tokens.info}Status:${reset} ${tokens.success}OK${reset}`;
 * ```
 */
export function createTokens(options?: TokenOptions): Tokens {
  const colorEnabled = resolveTokenColorEnabled(options);

  // Return empty strings when colors are disabled
  if (!colorEnabled) {
    return {
      // Semantic colors (existing)
      success: "",
      warning: "",
      error: "",
      info: "",
      primary: "",
      secondary: "",
      muted: "",
      // Semantic colors (new)
      accent: "",
      highlight: "",
      link: "",
      destructive: "",
      subtle: "",
      // Utility tokens
      bold: "",
      italic: "",
      underline: "",
      dim: "",
    };
  }

  // Return ANSI codes when colors are enabled
  return {
    // Semantic colors (existing)
    success: ANSI.green,
    warning: ANSI.yellow,
    error: ANSI.red,
    info: ANSI.blue,
    primary: "", // Primary uses default terminal color
    secondary: ANSI.gray,
    muted: ANSI.dim,
    // Semantic colors (new)
    accent: ANSI.cyan,
    highlight: ANSI.bold,
    link: `${ANSI.cyan}${ANSI.underline}`,
    destructive: ANSI.brightRed,
    subtle: `${ANSI.dim}${ANSI.gray}`,
    // Utility tokens
    bold: ANSI.bold,
    italic: ANSI.italic,
    underline: ANSI.underline,
    dim: ANSI.dim,
  };
}

/**
 * Applies a named color to text using ANSI escape codes.
 *
 * Returns plain text if colors are not supported (NO_COLOR set, non-TTY).
 * For semantic colors (success, error, etc.), use {@link createTheme} instead.
 *
 * @param text - The text to colorize
 * @param color - The color name to apply
 * @returns Text wrapped in ANSI escape codes, or plain text if colors not supported
 *
 * @example
 * ```typescript
 * console.log(applyColor("Success", "green"));
 * console.log(applyColor("Warning", "yellow"));
 * console.log(applyColor("Error", "red"));
 * console.log(applyColor("Info", "blue"));
 * ```
 */
export function applyColor(text: string, color: ColorName): string {
  if (!supportsColor()) {
    return text;
  }

  const ansiCode = ANSI[color];
  return `${ansiCode}${text}${ANSI.reset}`;
}
