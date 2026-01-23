/**
 * @outfitter/ui
 *
 * Color tokens, output shapes, and terminal renderers.
 * Provides consistent terminal UI primitives for CLI output
 * including tables, trees, progress indicators, and styled text.
 *
 * @packageDocumentation
 */

import { getEnvBoolean } from "@outfitter/config";

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
}

/**
 * Available color names for the {@link applyColor} function.
 *
 * @example
 * ```typescript
 * import { applyColor, ColorName } from "@outfitter/ui";
 *
 * const color: ColorName = "green";
 * console.log(applyColor("Success", color));
 * ```
 */
export type ColorName = "green" | "yellow" | "red" | "blue" | "cyan" | "magenta" | "white" | "gray";

/**
 * Configuration options for {@link renderTable}.
 *
 * @example
 * ```typescript
 * const options: TableOptions = {
 *   headers: { id: "ID", name: "Name" },
 *   columnWidths: { description: 20 },
 * };
 * ```
 */
export interface TableOptions {
	/**
	 * Fixed column widths by key.
	 * If not specified, column width is calculated from content.
	 */
	columnWidths?: Record<string, number>;
	/**
	 * Custom header labels by key.
	 * If not specified, the object key is used as the header.
	 */
	headers?: Record<string, string>;
}

/**
 * A list item with optional nested children for {@link renderList}.
 *
 * @example
 * ```typescript
 * const item: NestedListItem = {
 *   text: "Parent item",
 *   children: ["Child 1", "Child 2"],
 * };
 * ```
 */
export interface NestedListItem {
	/** The text content of this list item */
	text: string;
	/** Optional nested child items (strings or nested items) */
	children?: Array<string | NestedListItem>;
}

/**
 * A list item that can be either a simple string or a nested item with children.
 *
 * @example
 * ```typescript
 * const items: ListItem[] = [
 *   "Simple item",
 *   { text: "Parent", children: ["Child 1", "Child 2"] },
 * ];
 * ```
 */
export type ListItem = string | NestedListItem;

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
 * // Renders: [███████████████░░░░░] 75%
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
 * Options for terminal detection functions.
 *
 * These options allow overriding automatic detection for testing
 * or specific environments.
 *
 * @example
 * ```typescript
 * // Force TTY mode for testing
 * supportsColor({ isTTY: true });
 *
 * // Simulate CI environment
 * isInteractive({ isTTY: true, isCI: true }); // returns false
 * ```
 */
export interface TerminalOptions {
	/** Override TTY detection (uses process.stdout.isTTY if not specified) */
	isTTY?: boolean;
	/** Override CI detection (uses CI env variable if not specified) */
	isCI?: boolean;
}

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
	/** Green color for success messages */
	success: string;
	/** Yellow color for warning messages */
	warning: string;
	/** Red color for error messages */
	error: string;
	/** Blue color for informational messages */
	info: string;
	/** Dim/gray color for de-emphasized text */
	muted: string;
	/** Bright/highlight color for emphasis */
	accent: string;
	/** Default text color (typically empty string) */
	primary: string;
	/** Subdued color for secondary text */
	secondary: string;
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
// Shape Types
// ============================================================================

/**
 * A tree node for hierarchical data structures.
 *
 * @example
 * ```typescript
 * const tree: TreeNode = {
 *   name: "src",
 *   children: [
 *     { name: "index.ts", children: [] },
 *     { name: "utils", children: [{ name: "helpers.ts", children: [] }] },
 *   ],
 * };
 * ```
 */
export interface TreeNode {
	/** The name/label of this node */
	name: string;
	/** Child nodes (empty array for leaf nodes) */
	children: TreeNode[];
}

/**
 * A collection of items, rendered as table (objects) or list (primitives).
 *
 * @example
 * ```typescript
 * // Table rendering (array of objects)
 * const users: Collection = {
 *   type: "collection",
 *   items: [{ name: "Alice", age: 30 }, { name: "Bob", age: 25 }],
 *   headers: { name: "Name", age: "Age" },
 * };
 *
 * // List rendering (array of primitives)
 * const tasks: Collection = {
 *   type: "collection",
 *   items: ["Task 1", "Task 2", "Task 3"],
 * };
 * ```
 */
export interface Collection {
	/** Discriminant for Collection type */
	type: "collection";
	/** Array of items to render */
	items: unknown[];
	/** Optional custom headers for table rendering */
	headers?: Record<string, string>;
}

/**
 * A hierarchical tree structure.
 *
 * @example
 * ```typescript
 * const fileTree: Hierarchy = {
 *   type: "hierarchy",
 *   root: {
 *     name: "project",
 *     children: [
 *       { name: "src", children: [{ name: "index.ts", children: [] }] },
 *       { name: "package.json", children: [] },
 *     ],
 *   },
 * };
 * ```
 */
export interface Hierarchy {
	/** Discriminant for Hierarchy type */
	type: "hierarchy";
	/** Root node of the tree */
	root: TreeNode;
}

/**
 * Key-value pairs for displaying configuration or metadata.
 *
 * @example
 * ```typescript
 * const config: KeyValue = {
 *   type: "keyvalue",
 *   entries: {
 *     name: "my-app",
 *     version: "1.0.0",
 *     debug: true,
 *   },
 * };
 * ```
 */
export interface KeyValue {
	/** Discriminant for KeyValue type */
	type: "keyvalue";
	/** Key-value entries to display */
	entries: Record<string, unknown>;
}

/**
 * A resource with content in a specific format.
 *
 * @example
 * ```typescript
 * const jsonResource: Resource = {
 *   type: "resource",
 *   data: { name: "test", value: 42 },
 *   format: "json",
 * };
 *
 * const markdownResource: Resource = {
 *   type: "resource",
 *   data: "# Heading\n\nSome **bold** text",
 *   format: "markdown",
 * };
 * ```
 */
export interface Resource {
	/** Discriminant for Resource type */
	type: "resource";
	/** The content to render */
	data: unknown;
	/** Output format (defaults to "json") */
	format?: "json" | "markdown" | "text";
}

/**
 * Discriminated union of all output shape types.
 *
 * Use the type guards {@link isCollection}, {@link isHierarchy},
 * {@link isKeyValue}, and {@link isResource} for type narrowing.
 *
 * @example
 * ```typescript
 * function processShape(shape: Shape) {
 *   if (isCollection(shape)) {
 *     console.log(`Collection with ${shape.items.length} items`);
 *   } else if (isHierarchy(shape)) {
 *     console.log(`Tree rooted at ${shape.root.name}`);
 *   }
 * }
 * ```
 */
export type Shape = Collection | Hierarchy | KeyValue | Resource;

/**
 * Options for the unified {@link render} function.
 *
 * @example
 * ```typescript
 * const options: RenderOptions = {
 *   width: 80,
 *   color: true,
 *   format: "json",
 * };
 * ```
 */
export interface RenderOptions {
	/** Maximum width for output (used by some renderers) */
	width?: number;
	/** Whether to use ANSI colors in output */
	color?: boolean;
	/** Force a specific output format, overriding auto-selection */
	format?: "table" | "list" | "tree" | "json" | "text";
}

// ============================================================================
// ANSI Constants
// ============================================================================

const ANSI = {
	reset: "\x1b[0m",
	bold: "\x1b[1m",
	dim: "\x1b[2m",
	italic: "\x1b[3m",
	// Foreground colors
	green: "\x1b[32m",
	yellow: "\x1b[33m",
	red: "\x1b[31m",
	blue: "\x1b[34m",
	cyan: "\x1b[36m",
	magenta: "\x1b[35m",
	white: "\x1b[37m",
	gray: "\x1b[90m",
} as const;

// ============================================================================
// Terminal Detection
// ============================================================================

/**
 * Checks if the current environment supports ANSI colors.
 *
 * Detection priority:
 * 1. `NO_COLOR` env variable - if set (even empty), returns false (per no-color.org)
 * 2. `FORCE_COLOR` env variable - if set, returns true (numeric levels > 0)
 * 3. Falls back to TTY detection via `process.stdout.isTTY`
 *
 * @param options - Optional overrides for TTY detection
 * @returns `true` if colors are supported, `false` otherwise
 *
 * @example
 * ```typescript
 * if (supportsColor()) {
 *   console.log("\x1b[32mGreen text\x1b[0m");
 * } else {
 *   console.log("Plain text");
 * }
 *
 * // With explicit TTY override for testing
 * supportsColor({ isTTY: true });  // true (unless NO_COLOR is set)
 * supportsColor({ isTTY: false }); // false (unless FORCE_COLOR is set)
 * ```
 */
export function supportsColor(options?: TerminalOptions): boolean {
	// NO_COLOR takes priority (per https://no-color.org/)
	// biome-ignore lint/complexity/useLiteralKeys: TypeScript noPropertyAccessFromIndexSignature requires bracket notation
	if (process.env["NO_COLOR"] !== undefined) {
		return false;
	}

	// FORCE_COLOR enables colors if NO_COLOR is not set
	// Accept numeric levels: 0 disables, 1+ enables
	// biome-ignore lint/complexity/useLiteralKeys: TypeScript noPropertyAccessFromIndexSignature requires bracket notation
	if (process.env["FORCE_COLOR"] !== undefined) {
		const value = process.env["FORCE_COLOR"];
		if (value === "") {
			return true;
		}
		const numeric = Number(value);
		if (!Number.isNaN(numeric)) {
			return numeric > 0;
		}
		return true;
	}

	// Check isTTY option if provided
	if (options?.isTTY !== undefined) {
		return options.isTTY;
	}

	// Default to checking stdout
	return process.stdout.isTTY ?? false;
}

/**
 * Gets the terminal width in columns.
 *
 * Returns `process.stdout.columns` when in a TTY, or 80 as a fallback
 * for non-TTY environments (pipes, CI, etc.).
 *
 * @param options - Optional overrides for TTY detection
 * @returns Terminal width in columns (default: 80 if not TTY)
 *
 * @example
 * ```typescript
 * const width = getTerminalWidth();
 * console.log(`Terminal is ${width} columns wide`);
 *
 * // Force non-TTY mode (always returns 80)
 * getTerminalWidth({ isTTY: false }); // 80
 * ```
 */
export function getTerminalWidth(options?: TerminalOptions): number {
	const isTTY = options?.isTTY ?? process.stdout.isTTY ?? false;

	if (!isTTY) {
		return 80;
	}

	return process.stdout.columns ?? 80;
}

/**
 * Checks if the terminal is interactive.
 *
 * A terminal is considered interactive when:
 * - It is a TTY (process.stdout.isTTY is true)
 * - It is NOT running in a CI environment (CI env variable is not set)
 *
 * Use this to decide whether to show interactive prompts or use
 * non-interactive fallbacks.
 *
 * @param options - Optional overrides for TTY and CI detection
 * @returns `true` if interactive prompts are safe to use
 *
 * @example
 * ```typescript
 * if (isInteractive()) {
 *   // Safe to use interactive prompts
 *   const answer = await prompt("Continue?");
 * } else {
 *   // Use non-interactive defaults
 *   console.log("Running in non-interactive mode");
 * }
 * ```
 */
export function isInteractive(options?: TerminalOptions): boolean {
	// Check CI environment first
	// Using getEnvBoolean for dynamic reads (needed for tests)
	const isCI = options?.isCI ?? getEnvBoolean("CI") === true;

	if (isCI) {
		return false;
	}

	// Check TTY
	const isTTY = options?.isTTY ?? process.stdout.isTTY ?? false;
	return isTTY;
}

// ============================================================================
// Color Tokens
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
		// Semantic colors
		success: colorFn(ANSI.green),
		warning: colorFn(ANSI.yellow),
		error: colorFn(ANSI.red),
		info: colorFn(ANSI.blue),
		// Text colors
		primary: colorFn(""), // No color, just the text
		secondary: colorFn(ANSI.gray),
		muted: colorFn(ANSI.dim),
	};
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
	// Determine if colors should be enabled
	let colorEnabled: boolean;

	// colorLevel: 0 always disables colors
	if (options?.colorLevel === 0) {
		colorEnabled = false;
	}
	// forceColor option takes precedence over environment
	else if (options?.forceColor === true) {
		colorEnabled = true;
	}
	// FORCE_COLOR env takes precedence over NO_COLOR
	// Supports FORCE_COLOR=1, FORCE_COLOR=2, FORCE_COLOR=3 (common for color levels)
	else if (process.env["FORCE_COLOR"] !== undefined) {
		const value = process.env["FORCE_COLOR"];
		if (value === "") {
			colorEnabled = true;
		} else {
			const numeric = Number(value);
			colorEnabled = Number.isNaN(numeric) ? true : numeric > 0;
		}
	}
	// NO_COLOR env disables colors
	// Per no-color.org spec, any value disables colors
	else if (process.env["NO_COLOR"] !== undefined) {
		colorEnabled = false;
	}
	// colorLevel 1-3 enables colors
	else if (options?.colorLevel !== undefined && options.colorLevel > 0) {
		colorEnabled = true;
	}
	// Fall back to TTY detection
	else {
		colorEnabled = process.stdout.isTTY ?? false;
	}

	// Return empty strings when colors are disabled
	if (!colorEnabled) {
		return {
			success: "",
			warning: "",
			error: "",
			info: "",
			muted: "",
			accent: "",
			primary: "",
			secondary: "",
		};
	}

	// Return ANSI codes when colors are enabled
	return {
		// Semantic colors
		success: ANSI.green,
		warning: ANSI.yellow,
		error: ANSI.red,
		info: ANSI.blue,
		// Text colors
		muted: ANSI.dim,
		accent: ANSI.cyan,
		primary: "", // Primary uses default terminal color
		secondary: ANSI.gray,
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

// ============================================================================
// Text Formatting
// ============================================================================

// ANSI escape sequence regex pattern
// biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI escape codes require control characters
const ANSI_REGEX = /\x1b\[[0-9;]*m/g;

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
	const words = text.split(/(\s+)/);
	const lines: string[] = [];
	let currentLine = "";
	let currentWidth = 0;

	// Track active ANSI codes for carrying across lines
	let activeAnsi = "";

	for (const word of words) {
		// Check if this is whitespace
		if (/^\s+$/.test(word)) {
			// Don't add leading whitespace to new line
			if (currentLine !== "") {
				currentLine += word;
				currentWidth += getStringWidth(word);
			}
			continue;
		}

		const wordWidth = getStringWidth(word);

		// Extract any ANSI codes from this word
		// biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI escape codes require control characters
		const ansiMatches = word.match(/\x1b\[[0-9;]*m/g);
		if (ansiMatches) {
			for (const code of ansiMatches) {
				if (code === ANSI.reset) {
					activeAnsi = "";
				} else {
					activeAnsi = code;
				}
			}
		}

		if (currentWidth + wordWidth > width && currentLine !== "") {
			// Close any active ANSI at end of line
			if (activeAnsi !== "") {
				// Find the ANSI code in the word before adding reset
				const hasReset = word.includes(ANSI.reset);
				if (!hasReset && activeAnsi !== "") {
					// Word has active ansi that continues
				}
			}
			lines.push(currentLine.trimEnd());
			// Start new line with active ANSI
			currentLine = activeAnsi !== "" ? activeAnsi + word : word;
			currentWidth = wordWidth;
		} else {
			currentLine += word;
			currentWidth += wordWidth;
		}
	}

	if (currentLine !== "") {
		lines.push(currentLine.trimEnd());
	}

	return lines.join("\n");
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

// ============================================================================
// Output Shapes
// ============================================================================

/**
 * Renders an array of objects as an ASCII table with borders.
 *
 * Automatically calculates column widths based on content unless
 * overridden in options. Supports custom header labels and
 * truncates cell content that exceeds column width.
 *
 * @param data - Array of objects to render as rows
 * @param options - Table rendering options
 * @returns Formatted table string with borders
 *
 * @example
 * ```typescript
 * const table = renderTable(
 *   [
 *     { id: 1, name: "Alice", status: "Active" },
 *     { id: 2, name: "Bob", status: "Inactive" },
 *   ],
 *   {
 *     headers: { id: "ID", name: "Name" },
 *     columnWidths: { status: 10 },
 *   }
 * );
 *
 * console.log(table);
 * // +----+-------+----------+
 * // | ID | Name  | status   |
 * // +----+-------+----------+
 * // | 1  | Alice | Active   |
 * // | 2  | Bob   | Inactive |
 * // +----+-------+----------+
 * ```
 */
export function renderTable(data: Array<Record<string, unknown>>, options?: TableOptions): string {
	if (data.length === 0) {
		return "";
	}

	// Get all keys from data
	const allKeys = new Set<string>();
	for (const row of data) {
		for (const key of Object.keys(row)) {
			allKeys.add(key);
		}
	}
	const keys = Array.from(allKeys);

	// Map headers
	const headers = options?.headers ?? {};
	const getHeader = (key: string): string => headers[key] ?? key;

	// Calculate column widths
	const columnWidths: Record<string, number> = {};
	for (const key of keys) {
		const headerWidth = getStringWidth(getHeader(key));
		let maxDataWidth = 0;

		for (const row of data) {
			const value = row[key];
			const strValue = value === undefined || value === null ? "" : String(value);
			const width = getStringWidth(strValue);
			if (width > maxDataWidth) {
				maxDataWidth = width;
			}
		}

		// Use option width if provided, otherwise calculate
		const optionWidth = options?.columnWidths?.[key];
		columnWidths[key] = optionWidth ?? Math.max(headerWidth, maxDataWidth);
	}

	// Build table
	const lines: string[] = [];

	// Header separator
	const headerSep = `+${keys.map((k) => "-".repeat((columnWidths[k] ?? 0) + 2)).join("+")}+`;

	// Header row
	const headerRow = `|${keys
		.map((k) => {
			const header = getHeader(k);
			const width = columnWidths[k] ?? 0;
			return ` ${padText(header, width)} `;
		})
		.join("|")}|`;

	lines.push(headerSep);
	lines.push(headerRow);
	lines.push(headerSep);

	// Data rows
	for (const row of data) {
		const rowStr = `|${keys
			.map((k) => {
				const value = row[k];
				let strValue = value === undefined || value === null ? "" : String(value);
				const width = columnWidths[k] ?? 0;

				// Truncate if needed
				if (getStringWidth(strValue) > width) {
					strValue = truncateText(strValue, width);
				}

				return ` ${padText(strValue, width)} `;
			})
			.join("|")}|`;
		lines.push(rowStr);
	}

	lines.push(headerSep);

	return lines.join("\n");
}

/**
 * Renders items as a bullet list with optional nesting.
 *
 * Supports both simple string items and nested items with children.
 * Nested items are indented with 2 spaces per level.
 *
 * @param items - Array of list items (strings or nested items)
 * @returns Formatted bullet list string
 *
 * @example
 * ```typescript
 * // Simple list
 * console.log(renderList(["First", "Second", "Third"]));
 * // - First
 * // - Second
 * // - Third
 *
 * // Nested list
 * console.log(renderList([
 *   "Parent item",
 *   { text: "Item with children", children: ["Child 1", "Child 2"] },
 * ]));
 * // - Parent item
 * // - Item with children
 * //   - Child 1
 * //   - Child 2
 * ```
 */
export function renderList(items: ListItem[]): string {
	const lines: string[] = [];

	const renderItem = (item: ListItem, indent: number): void => {
		const prefix = "  ".repeat(indent) + "- ";

		if (typeof item === "string") {
			lines.push(prefix + item);
		} else {
			lines.push(prefix + item.text);
			if (item.children) {
				for (const child of item.children) {
					renderItem(child, indent + 1);
				}
			}
		}
	};

	for (const item of items) {
		renderItem(item, 0);
	}

	return lines.join("\n");
}

/**
 * Renders hierarchical data as a tree with unicode box-drawing characters.
 *
 * Uses unicode characters (not, not, |, -) for tree structure.
 * Nested objects are rendered as child nodes; leaf values (null, primitives)
 * are rendered as terminal nodes.
 *
 * @param tree - Hierarchical object to render
 * @returns Formatted tree string with box-drawing characters
 *
 * @example
 * ```typescript
 * const tree = {
 *   src: {
 *     components: {
 *       Button: null,
 *       Input: null,
 *     },
 *     utils: null,
 *   },
 *   tests: null,
 * };
 *
 * console.log(renderTree(tree));
 * // +-- src
 * // |   +-- components
 * // |   |   +-- Button
 * // |   |   L-- Input
 * // |   L-- utils
 * // L-- tests
 * ```
 */
export function renderTree(tree: Record<string, unknown>): string {
	const lines: string[] = [];

	const renderNode = (key: string, value: unknown, prefix: string, isLast: boolean): void => {
		const connector = isLast ? "└── " : "├── ";
		lines.push(prefix + connector + key);

		if (value !== null && typeof value === "object") {
			const entries = Object.entries(value as Record<string, unknown>);
			const childPrefix = prefix + (isLast ? "    " : "│   ");

			entries.forEach(([childKey, childValue], index) => {
				const childIsLast = index === entries.length - 1;
				renderNode(childKey, childValue, childPrefix, childIsLast);
			});
		}
	};

	const entries = Object.entries(tree);
	entries.forEach(([key, value], index) => {
		const isLast = index === entries.length - 1;
		renderNode(key, value, "", isLast);
	});

	return lines.join("\n");
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
		const bar = "░".repeat(width);
		return showPercent ? `[${bar}] 0%` : `[${bar}]`;
	}

	const percent = Math.min(100, Math.max(0, (current / total) * 100));
	const filled = Math.round((percent / 100) * width);
	const empty = width - filled;

	const bar = "█".repeat(filled) + "░".repeat(empty);

	if (showPercent) {
		return `[${bar}] ${Math.round(percent)}%`;
	}

	return `[${bar}]`;
}

// ============================================================================
// Content Renderers
// ============================================================================

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
	result = result.replace(/```(\w*)\n([\s\S]*?)```/g, (_match, _lang, code: string) => {
		const trimmed = code.trimEnd();
		if (colorEnabled) {
			return `${ANSI.dim}${trimmed}${ANSI.reset}`;
		}
		return trimmed;
	});

	// Headings (# Heading)
	result = result.replace(/^(#{1,6})\s+(.+)$/gm, (_match, _hashes, text: string) => {
		if (colorEnabled) {
			return `${ANSI.bold}${text}${ANSI.reset}`;
		}
		return text;
	});

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
	result = result.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, (_match, text: string) => {
		if (colorEnabled) {
			return `${ANSI.italic}${text}${ANSI.reset}`;
		}
		return text;
	});
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

/**
 * Renders data as pretty-printed JSON.
 *
 * Uses `JSON.stringify` with 2-space indentation.
 * Suitable for displaying structured data in terminal output.
 *
 * @param data - Data to render as JSON
 * @returns Pretty-printed JSON string
 *
 * @example
 * ```typescript
 * console.log(renderJson({ name: "test", value: 42 }));
 * // {
 * //   "name": "test",
 * //   "value": 42
 * // }
 * ```
 */
export function renderJson(data: unknown): string {
	const json = JSON.stringify(data, null, 2);
	return json;
}

/**
 * Renders plain text unchanged.
 *
 * This is a pass-through function that returns the input text as-is.
 * Useful as a placeholder or for consistent API across render functions.
 *
 * @param text - Text to render
 * @returns The input text unchanged
 *
 * @example
 * ```typescript
 * renderText("Hello, World!"); // "Hello, World!"
 * ```
 */
export function renderText(text: string): string {
	return text;
}

// ============================================================================
// Date/Time Formatting
// ============================================================================

/**
 * Formats a date as a human-friendly relative time string.
 *
 * Converts timestamps to natural language like "just now", "5 minutes ago",
 * "yesterday", or "in 3 hours". Handles both past and future dates.
 *
 * @param date - Date to format (Date object, timestamp number, or ISO string)
 * @returns Human-friendly relative time string
 *
 * @example
 * ```typescript
 * formatRelative(new Date())              // "just now"
 * formatRelative(Date.now() - 30000)      // "30 seconds ago"
 * formatRelative(Date.now() - 3600000)    // "1 hour ago"
 * formatRelative(Date.now() + 300000)     // "in 5 minutes"
 * ```
 */
export function formatRelative(date: Date | number | string): string {
	// Convert input to timestamp
	let timestamp: number;

	if (date instanceof Date) {
		timestamp = date.getTime();
	} else if (typeof date === "number") {
		timestamp = date;
	} else {
		// Try parsing as ISO string
		const parsed = Date.parse(date);
		if (Number.isNaN(parsed)) {
			return "invalid date";
		}
		timestamp = parsed;
	}

	// Validate timestamp is a finite number (handles invalid Date, NaN, Infinity)
	if (!Number.isFinite(timestamp)) {
		return "invalid date";
	}

	const now = Date.now();
	const diffMs = now - timestamp;
	const absDiffMs = Math.abs(diffMs);
	const isFuture = diffMs < 0;

	// Time constants
	const SECOND = 1000;
	const MINUTE = 60 * SECOND;
	const HOUR = 60 * MINUTE;
	const DAY = 24 * HOUR;
	const MONTH = 30 * DAY;
	const YEAR = 365 * DAY;

	// Just now (within 10 seconds)
	if (absDiffMs < 10 * SECOND) {
		return "just now";
	}

	// Seconds (10-59 seconds)
	if (absDiffMs < MINUTE) {
		const seconds = Math.floor(absDiffMs / SECOND);
		return isFuture ? `in ${seconds} seconds` : `${seconds} seconds ago`;
	}

	// Minutes (1-59 minutes)
	if (absDiffMs < HOUR) {
		const minutes = Math.floor(absDiffMs / MINUTE);
		if (minutes === 1) {
			return isFuture ? "in 1 minute" : "1 minute ago";
		}
		return isFuture ? `in ${minutes} minutes` : `${minutes} minutes ago`;
	}

	// Hours (1-23 hours)
	if (absDiffMs < DAY) {
		const hours = Math.floor(absDiffMs / HOUR);
		if (hours === 1) {
			return isFuture ? "in 1 hour" : "1 hour ago";
		}
		return isFuture ? `in ${hours} hours` : `${hours} hours ago`;
	}

	// Yesterday/Tomorrow (24-47 hours)
	if (absDiffMs < 2 * DAY) {
		return isFuture ? "tomorrow" : "yesterday";
	}

	// Days (2-29 days)
	if (absDiffMs < MONTH) {
		const days = Math.floor(absDiffMs / DAY);
		return isFuture ? `in ${days} days` : `${days} days ago`;
	}

	// Months (1-11 months)
	if (absDiffMs < YEAR) {
		const months = Math.floor(absDiffMs / MONTH);
		if (months === 1) {
			return isFuture ? "in 1 month" : "1 month ago";
		}
		return isFuture ? `in ${months} months` : `${months} months ago`;
	}

	// Years
	const years = Math.floor(absDiffMs / YEAR);
	if (years === 1) {
		return isFuture ? "in 1 year" : "1 year ago";
	}
	return isFuture ? `in ${years} years` : `${years} years ago`;
}

// ============================================================================
// Shape Type Guards
// ============================================================================

/**
 * Type guard for {@link Collection} shapes.
 *
 * @param shape - Shape to check
 * @returns `true` if the shape is a Collection
 *
 * @example
 * ```typescript
 * if (isCollection(shape)) {
 *   console.log(`Has ${shape.items.length} items`);
 * }
 * ```
 */
export function isCollection(shape: Shape): shape is Collection {
	return shape.type === "collection";
}

/**
 * Type guard for {@link Hierarchy} shapes.
 *
 * @param shape - Shape to check
 * @returns `true` if the shape is a Hierarchy
 *
 * @example
 * ```typescript
 * if (isHierarchy(shape)) {
 *   console.log(`Root: ${shape.root.name}`);
 * }
 * ```
 */
export function isHierarchy(shape: Shape): shape is Hierarchy {
	return shape.type === "hierarchy";
}

/**
 * Type guard for {@link KeyValue} shapes.
 *
 * @param shape - Shape to check
 * @returns `true` if the shape is a KeyValue
 *
 * @example
 * ```typescript
 * if (isKeyValue(shape)) {
 *   console.log(`Keys: ${Object.keys(shape.entries).join(", ")}`);
 * }
 * ```
 */
export function isKeyValue(shape: Shape): shape is KeyValue {
	return shape.type === "keyvalue";
}

/**
 * Type guard for {@link Resource} shapes.
 *
 * @param shape - Shape to check
 * @returns `true` if the shape is a Resource
 *
 * @example
 * ```typescript
 * if (isResource(shape)) {
 *   console.log(`Format: ${shape.format ?? "json"}`);
 * }
 * ```
 */
export function isResource(shape: Shape): shape is Resource {
	return shape.type === "resource";
}

// ============================================================================
// Unified Render Function
// ============================================================================

/**
 * Converts a TreeNode to the Record format expected by renderTree.
 */
function treeNodeToRecord(node: TreeNode): Record<string, unknown> {
	if (node.children.length === 0) {
		return { [node.name]: null };
	}

	const childRecord: Record<string, unknown> = {};
	for (const child of node.children) {
		const childObj = treeNodeToRecord(child);
		Object.assign(childRecord, childObj);
	}

	return { [node.name]: childRecord };
}

/**
 * Checks if an item is a plain object (not null, not array, not primitive).
 */
function isPlainObject(item: unknown): item is Record<string, unknown> {
	return item !== null && typeof item === "object" && !Array.isArray(item);
}

/**
 * Unified render function that auto-selects the appropriate renderer based on shape type.
 *
 * Auto-selection logic:
 * - **Collection**: Uses {@link renderTable} for object items, {@link renderList} for primitives
 * - **Hierarchy**: Uses {@link renderTree}
 * - **KeyValue**: Renders as formatted key-value pairs (JSON-like)
 * - **Resource**: Uses {@link renderJson}, {@link renderMarkdown}, or {@link renderText} based on format
 *
 * The `options.format` parameter can override auto-selection.
 *
 * @param shape - The shape to render
 * @param options - Rendering options
 * @returns Rendered string output
 *
 * @example
 * ```typescript
 * // Collection auto-selects table or list
 * render({ type: "collection", items: [{ name: "Alice" }] });
 * render({ type: "collection", items: ["item1", "item2"] });
 *
 * // Hierarchy uses tree rendering
 * render({ type: "hierarchy", root: { name: "src", children: [] } });
 *
 * // KeyValue renders formatted pairs
 * render({ type: "keyvalue", entries: { key: "value" } });
 *
 * // Resource respects format option
 * render({ type: "resource", data: obj, format: "json" });
 *
 * // Override with options.format
 * render({ type: "collection", items: [{ a: 1 }] }, { format: "json" });
 * ```
 */
export function render(shape: Shape, options?: RenderOptions): string {
	const format = options?.format;

	// Handle format override
	if (format === "json") {
		if (isCollection(shape)) {
			return renderJson(shape.items);
		}
		if (isHierarchy(shape)) {
			return renderJson(treeNodeToRecord(shape.root));
		}
		if (isKeyValue(shape)) {
			return renderJson(shape.entries);
		}
		if (isResource(shape)) {
			return renderJson(shape.data);
		}
	}

	if (format === "list") {
		if (isCollection(shape)) {
			// Convert items to strings for list rendering
			const listItems = shape.items.map((item) => {
				if (typeof item === "string") {
					return item;
				}
				if (isPlainObject(item)) {
					// For objects, extract a reasonable string representation
					const name = (item as Record<string, unknown>)["name"];
					if (typeof name === "string") {
						return name;
					}
					return JSON.stringify(item);
				}
				return String(item);
			});
			return renderList(listItems);
		}
	}

	if (format === "table") {
		if (isCollection(shape)) {
			const items = shape.items.filter(isPlainObject) as Array<Record<string, unknown>>;
			return renderTable(items, shape.headers ? { headers: shape.headers } : undefined);
		}
	}

	if (format === "tree") {
		if (isHierarchy(shape)) {
			return renderTree(treeNodeToRecord(shape.root));
		}
	}

	if (format === "text") {
		if (isResource(shape)) {
			return renderText(String(shape.data));
		}
	}

	// Auto-selection based on shape type
	if (isCollection(shape)) {
		// Check if items are objects (use table) or primitives (use list)
		const hasObjectItems = shape.items.length > 0 && shape.items.every(isPlainObject);

		if (hasObjectItems) {
			const items = shape.items as Array<Record<string, unknown>>;
			return renderTable(items, shape.headers ? { headers: shape.headers } : undefined);
		}

		// Render as list
		const listItems = shape.items.map((item) => {
			if (typeof item === "string") {
				return item;
			}
			return String(item);
		});
		return renderList(listItems);
	}

	if (isHierarchy(shape)) {
		return renderTree(treeNodeToRecord(shape.root));
	}

	if (isKeyValue(shape)) {
		// Render key-value pairs in a formatted way
		return renderJson(shape.entries);
	}

	if (isResource(shape)) {
		const resourceFormat = shape.format ?? "json";

		if (resourceFormat === "markdown") {
			return renderMarkdown(String(shape.data));
		}

		if (resourceFormat === "text") {
			return renderText(String(shape.data));
		}

		// Default to JSON
		return renderJson(shape.data);
	}

	// Fallback (should never reach here with proper typing)
	return renderJson(shape);
}
