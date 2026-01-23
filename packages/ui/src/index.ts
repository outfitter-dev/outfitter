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
// Color Tokens - Stub Exports
// ============================================================================

/**
 * Creates a theme with semantic and text color functions.
 * Respects NO_COLOR environment variable and TTY detection.
 */
export function createTheme(): Theme {
	throw new Error("Not implemented");
}

/**
 * Applies a color to text using ANSI escape codes.
 * Returns plain text if colors are not supported.
 */
export function applyColor(_text: string, _color: ColorName): string {
	throw new Error("Not implemented");
}

/**
 * Checks if the current environment supports colors.
 */
export function supportsColor(_options?: TerminalOptions): boolean {
	throw new Error("Not implemented");
}

// ============================================================================
// Output Shapes - Stub Exports
// ============================================================================

/**
 * Renders data as an ASCII table.
 */
export function renderTable(
	_data: Array<Record<string, unknown>>,
	_options?: TableOptions,
): string {
	throw new Error("Not implemented");
}

/**
 * Renders items as a bullet list with optional nesting.
 */
export function renderList(_items: ListItem[]): string {
	throw new Error("Not implemented");
}

/**
 * Renders hierarchical data as a tree with unicode box characters.
 */
export function renderTree(_tree: Record<string, unknown>): string {
	throw new Error("Not implemented");
}

/**
 * Renders a progress bar.
 */
export function renderProgress(_options: ProgressOptions): string {
	throw new Error("Not implemented");
}

// ============================================================================
// Text Formatting - Stub Exports
// ============================================================================

/**
 * Wraps text at specified width, preserving ANSI codes.
 */
export function wrapText(_text: string, _width: number): string {
	throw new Error("Not implemented");
}

/**
 * Truncates text with ellipsis, respecting ANSI codes.
 */
export function truncateText(_text: string, _maxWidth: number): string {
	throw new Error("Not implemented");
}

/**
 * Pads text to specified width, handling ANSI codes.
 */
export function padText(_text: string, _width: number): string {
	throw new Error("Not implemented");
}

/**
 * Removes ANSI escape codes from text.
 */
export function stripAnsi(_text: string): string {
	throw new Error("Not implemented");
}

/**
 * Calculates visible width of text, ignoring ANSI codes.
 */
export function getStringWidth(_text: string): number {
	throw new Error("Not implemented");
}

// ============================================================================
// Content Renderers - Stub Exports
// ============================================================================

/**
 * Renders markdown to terminal with styling.
 */
export function renderMarkdown(_markdown: string): string {
	throw new Error("Not implemented");
}

/**
 * Renders JSON with syntax coloring.
 */
export function renderJson(_data: unknown): string {
	throw new Error("Not implemented");
}

/**
 * Renders plain text with basic formatting.
 */
export function renderText(_text: string): string {
	throw new Error("Not implemented");
}

// ============================================================================
// Terminal Detection - Stub Exports
// ============================================================================

/**
 * Gets the terminal width, with fallback for non-TTY.
 */
export function getTerminalWidth(_options?: TerminalOptions): number {
	throw new Error("Not implemented");
}

/**
 * Checks if the terminal is interactive.
 */
export function isInteractive(_options?: TerminalOptions): boolean {
	throw new Error("Not implemented");
}
