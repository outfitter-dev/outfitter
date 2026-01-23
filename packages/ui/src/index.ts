/**
 * @outfitter/ui
 *
 * Color tokens, output shapes, and terminal renderers.
 * Provides consistent terminal UI primitives for CLI output
 * including tables, trees, progress indicators, and styled text.
 *
 * @packageDocumentation
 */

// ============================================================================
// Types
// ============================================================================

/** Theme type with semantic and text color functions */
export interface Theme {
	// Semantic colors
	success: (text: string) => string;
	warning: (text: string) => string;
	error: (text: string) => string;
	info: (text: string) => string;
	// Text colors
	primary: (text: string) => string;
	secondary: (text: string) => string;
	muted: (text: string) => string;
}

/** Color names for applyColor */
export type ColorName = "green" | "yellow" | "red" | "blue" | "cyan" | "magenta" | "white" | "gray";

/** Table rendering options */
export interface TableOptions {
	columnWidths?: Record<string, number>;
	headers?: Record<string, string>;
}

/** List item with optional nesting */
export interface NestedListItem {
	text: string;
	children?: Array<string | NestedListItem>;
}

/** List item type */
export type ListItem = string | NestedListItem;

/** Progress bar options */
export interface ProgressOptions {
	current: number;
	total: number;
	width?: number;
	showPercent?: boolean;
}

/** Terminal detection options */
export interface TerminalOptions {
	isTTY?: boolean;
	isCI?: boolean;
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
 * Checks if the current environment supports colors.
 */
export function supportsColor(options?: TerminalOptions): boolean {
	// NO_COLOR takes priority (per https://no-color.org/)
	// biome-ignore lint/complexity/useLiteralKeys: TypeScript noPropertyAccessFromIndexSignature requires bracket notation
	if (process.env["NO_COLOR"] !== undefined && process.env["NO_COLOR"] !== "") {
		return false;
	}

	// FORCE_COLOR enables colors if NO_COLOR is not set
	// biome-ignore lint/complexity/useLiteralKeys: TypeScript noPropertyAccessFromIndexSignature requires bracket notation
	if (process.env["FORCE_COLOR"] !== undefined && process.env["FORCE_COLOR"] !== "") {
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
 * Gets the terminal width, with fallback for non-TTY.
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
 */
export function isInteractive(options?: TerminalOptions): boolean {
	// Check CI environment first
	// biome-ignore lint/complexity/useLiteralKeys: TypeScript noPropertyAccessFromIndexSignature requires bracket notation
	const isCI = options?.isCI ?? (process.env["CI"] !== undefined && process.env["CI"] !== "");

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
 * Respects NO_COLOR environment variable and TTY detection.
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
 * Applies a color to text using ANSI escape codes.
 * Returns plain text if colors are not supported.
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
 */
export function stripAnsi(text: string): string {
	return text.replace(ANSI_REGEX, "");
}

/**
 * Calculates visible width of text, ignoring ANSI codes.
 */
export function getStringWidth(text: string): number {
	return Bun.stringWidth(text);
}

/**
 * Wraps text at specified width, preserving ANSI codes.
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
 * Truncates text with ellipsis, respecting ANSI codes.
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
 * Pads text to specified width, handling ANSI codes.
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
 * Renders data as an ASCII table.
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
 * Renders hierarchical data as a tree with unicode box characters.
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
 * Renders a progress bar.
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
 * Renders markdown to terminal with styling.
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
 * Renders JSON with syntax coloring.
 */
export function renderJson(data: unknown): string {
	const json = JSON.stringify(data, null, 2);
	return json;
}

/**
 * Renders plain text with basic formatting.
 */
export function renderText(text: string): string {
	return text;
}
