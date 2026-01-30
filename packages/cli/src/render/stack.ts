/**
 * Stack composition system for CLI output.
 *
 * Provides composable horizontal and vertical stack primitives with configurable
 * delimiters, display modes, and semantic formatting.
 *
 * @packageDocumentation
 */

import { renderBox } from "./box.js";
import { getIndicator, isUnicodeSupported } from "./indicators.js";
import { joinHorizontal, joinVertical } from "./layout.js";
import { getStringWidth } from "./text.js";
import { TREE_GUIDES, type TreeGuideStyle } from "./tree.js";

// ============================================================================
// Delimiter Registry
// ============================================================================

/**
 * Delimiter set with unicode and fallback representations.
 */
export interface DelimiterSet {
  /** Unicode character for modern terminals */
  unicode: string;
  /** ASCII fallback for limited terminals */
  fallback: string;
}

/**
 * Available delimiter names.
 */
export type DelimiterName = keyof typeof DELIMITERS;

/**
 * Registry of delimiter characters with unicode and fallback support.
 *
 * @example
 * ```typescript
 * import { DELIMITERS, getDelimiter } from "@outfitter/cli/render/stack";
 *
 * // Access directly
 * console.log(DELIMITERS.bullet.unicode); // "•"
 *
 * // Or use helper
 * console.log(getDelimiter("bullet")); // "•" or "*"
 * ```
 */
export const DELIMITERS = {
  space: { unicode: " ", fallback: " " },
  bullet: { unicode: "•", fallback: "*" },
  dot: { unicode: "·", fallback: "." },
  pipe: { unicode: "│", fallback: "|" },
  arrow: { unicode: "→", fallback: "->" },
  slash: { unicode: "/", fallback: "/" },
  colon: { unicode: ":", fallback: ":" },
} as const satisfies Record<string, DelimiterSet>;

/**
 * Gets a delimiter character with automatic unicode/fallback selection.
 *
 * @param name - The delimiter name
 * @param forceUnicode - Override unicode detection
 * @returns The appropriate delimiter character
 *
 * @example
 * ```typescript
 * getDelimiter("bullet");       // "•" (in unicode terminal)
 * getDelimiter("bullet", false); // "*" (force fallback)
 * ```
 */
export function getDelimiter(
  name: DelimiterName,
  forceUnicode?: boolean
): string {
  const delimiter = DELIMITERS[name];
  const useUnicode = forceUnicode ?? isUnicodeSupported();
  return useUnicode ? delimiter.unicode : delimiter.fallback;
}

// ============================================================================
// Marker Names
// ============================================================================

/**
 * Known marker names from INDICATORS.marker.
 */
export type MarkerName =
  | "circleDot"
  | "circleOutline"
  | "circle"
  | "checkbox"
  | "checkboxChecked"
  | "pointer"
  | "dash";

/**
 * Gets a marker character, either from INDICATORS or as a custom string.
 *
 * @param nameOrChar - Marker name from INDICATORS.marker or custom string
 * @param forceUnicode - Override unicode detection
 * @returns The marker character
 *
 * @example
 * ```typescript
 * getMarker("circleDot");       // "◉"
 * getMarker("circleDot", false); // "(*)"
 * getMarker("★");               // "★" (custom, returned as-is)
 * ```
 */
export function getMarker(
  nameOrChar: MarkerName | string,
  forceUnicode?: boolean
): string {
  // Known marker names
  const knownMarkers: MarkerName[] = [
    "circleDot",
    "circleOutline",
    "circle",
    "checkbox",
    "checkboxChecked",
    "pointer",
    "dash",
  ];

  if (knownMarkers.includes(nameOrChar as MarkerName)) {
    return getIndicator("marker", nameOrChar, forceUnicode);
  }

  // Custom string marker - return as-is
  return nameOrChar;
}

// ============================================================================
// Display Modes and Types
// ============================================================================

/**
 * Vertical stack display modes.
 *
 * - `plain`: Simple newlines, no guides
 * - `guide`: Vertical guide continuation (│)
 * - `tree`: Tree-style with fork/end markers (├/└)
 * - `boxed`: Each item wrapped in a box
 * - `compact`: Single line per item using compact representation
 */
export type VStackMode = "plain" | "guide" | "tree" | "boxed" | "compact";

/**
 * Semantic states for stack items.
 * Theme maps these to visual markers.
 */
export type ItemState =
  | "default"
  | "current"
  | "focused"
  | "checked"
  | "disabled";

/**
 * Theme configuration for stack rendering.
 * Maps semantic states to visual representation.
 */
export interface StackTheme {
  /** Map semantic states to marker names */
  markers: Record<ItemState, MarkerName>;
  /** Default delimiter for compact mode */
  delimiter?: DelimiterName;
  /** Default guide style */
  guide?: TreeGuideStyle;
}

/**
 * Default theme for stack rendering.
 */
export const DEFAULT_STACK_THEME: StackTheme = {
  markers: {
    default: "circleOutline",
    current: "circleDot",
    focused: "pointer",
    checked: "checkboxChecked",
    disabled: "dash",
  },
  delimiter: "bullet",
  guide: "single",
};

/**
 * An item in a stack with optional metadata.
 */
export interface StackItem {
  /** Full content (header + body lines) */
  content: string | string[];
  /** Compact single-line representation */
  compact?: string;
  /** Semantic state (resolved via theme) */
  state?: ItemState;
  /** Explicit marker (bypasses theme) */
  marker?: MarkerName | string;
  /** Style function to apply to content */
  style?: (s: string) => string;
}

/**
 * A rendered block with metadata for composition.
 * Both Box and StackBox satisfy this interface.
 */
export interface Renderable {
  /** Rendered string representation */
  readonly output: string;
  /** Width in characters */
  readonly width: number;
  /** Height in lines */
  readonly height: number;
}

/**
 * A rendered stack with metadata for composition.
 * Alias for Renderable (for semantic clarity when returning from stack functions).
 */
export type StackBox = Renderable;

/**
 * Type guard to check if a value is a Renderable (Box or StackBox).
 */
export function isRenderable(value: unknown): value is Renderable {
  return (
    typeof value === "object" &&
    value !== null &&
    "output" in value &&
    "width" in value &&
    "height" in value &&
    typeof (value as Renderable).output === "string" &&
    typeof (value as Renderable).width === "number" &&
    typeof (value as Renderable).height === "number"
  );
}

// ============================================================================
// Horizontal Stack Options
// ============================================================================

/**
 * Options for horizontal stack.
 */
export interface HStackOptions {
  /** Delimiter between items (name or custom string) */
  delimiter?: DelimiterName | string;
  /** Gap (spaces) around delimiter */
  gap?: number;
  /** Vertical alignment for multi-line items */
  align?: "top" | "center" | "bottom";
}

// ============================================================================
// Vertical Stack Options
// ============================================================================

/**
 * Options for vertical stack.
 */
export interface VStackOptions {
  /** Display mode */
  mode?: VStackMode;
  /** Gap (lines) between items */
  gap?: number;
  /** Theme for marker resolution */
  theme?: Partial<StackTheme>;
  /** Shorthand for theme.guide */
  guide?: TreeGuideStyle;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Checks if a delimiter string is a known delimiter name.
 */
function isDelimiterName(value: string): value is DelimiterName {
  return value in DELIMITERS;
}

/**
 * Resolves a delimiter option to a character.
 */
function resolveDelimiter(
  delimiter: DelimiterName | string | undefined
): string {
  if (delimiter === undefined) {
    return getDelimiter("space");
  }
  if (isDelimiterName(delimiter)) {
    return getDelimiter(delimiter);
  }
  return delimiter;
}

/**
 * Input type for stack functions.
 * Accepts strings, StackItems, or Renderables (Box/StackBox).
 */
export type StackInput = string | StackItem | Renderable;

/**
 * Normalizes input to StackItem.
 * - Plain strings get no state (no marker)
 * - Renderables (Box/StackBox) are converted to content strings
 * - StackItems are passed through
 */
function normalizeItem(item: StackInput): StackItem {
  if (typeof item === "string") {
    return { content: item }; // No state = no marker
  }
  if (isRenderable(item)) {
    return { content: item.output }; // Extract output from Box/StackBox
  }
  return item;
}

/**
 * Checks if an item should display a marker.
 * Only items with explicit state or marker show markers.
 */
function shouldShowMarker(item: StackItem): boolean {
  return item.state !== undefined || item.marker !== undefined;
}

/**
 * Resolves marker for an item using theme.
 * Returns empty string if item shouldn't show a marker.
 */
function resolveMarker(
  item: StackItem,
  theme: StackTheme
): { marker: string; show: boolean } {
  if (!shouldShowMarker(item)) {
    return { marker: "", show: false };
  }

  // Explicit marker overrides theme
  if (item.marker !== undefined) {
    return { marker: getMarker(item.marker), show: true };
  }

  // Resolve via theme
  const state = item.state ?? "default";
  const markerName = theme.markers[state];
  return { marker: getMarker(markerName), show: true };
}

/**
 * Gets content as array of lines.
 */
function getContentLines(content: string | string[]): string[] {
  if (typeof content === "string") {
    return content.split("\n");
  }
  return content;
}

/**
 * Applies style function to content if present.
 */
function applyStyle(content: string, style?: (s: string) => string): string {
  return style ? style(content) : content;
}

// ============================================================================
// Horizontal Stack
// ============================================================================

/**
 * Joins items horizontally with a delimiter.
 *
 * @param items - Items to join (strings or StackItems)
 * @param options - Configuration options
 * @returns Joined string
 *
 * @example
 * ```typescript
 * // Simple delimiter
 * hstack(["a", "b", "c"], { delimiter: "bullet", gap: 1 });
 * // → "a • b • c"
 *
 * // Multi-line with alignment
 * hstack(["Line1\nLine2", "Single"], { delimiter: "pipe", align: "center" });
 * ```
 */
export function hstack(items: StackInput[], options?: HStackOptions): string {
  if (items.length === 0) return "";

  const normalizedItems = items.map(normalizeItem);
  const delimiter = resolveDelimiter(options?.delimiter);
  const gap = options?.gap ?? 0;
  const align = options?.align ?? "top";

  // Build delimiter with gap
  const gapStr = " ".repeat(gap);
  const fullDelimiter = `${gapStr}${delimiter}${gapStr}`;

  // Apply styles and get content strings
  const contentStrings = normalizedItems.map((item) => {
    const lines = getContentLines(item.content);
    const styledLines = lines.map((line) => applyStyle(line, item.style));
    return styledLines.join("\n");
  });

  // Check if any content is multi-line
  const isMultiLine = contentStrings.some((s) => s.includes("\n"));

  if (!isMultiLine) {
    // Simple case: join with delimiter
    return contentStrings.join(fullDelimiter);
  }

  // Multi-line: use joinHorizontal with full delimiter (including gap)
  const blocks = contentStrings.map((content, idx) => {
    if (idx === contentStrings.length - 1) {
      return content;
    }
    // Append full delimiter (with gap) to each line of this block
    const lines = content.split("\n");
    return lines.map((line) => line + fullDelimiter).join("\n");
  });

  return joinHorizontal(blocks, { gap: 0, align });
}

/**
 * Creates a horizontal stack with metadata for composition.
 *
 * @param items - Items to join
 * @param options - Configuration options
 * @returns StackBox with output, width, and height
 */
export function createHStack(
  items: StackInput[],
  options?: HStackOptions
): StackBox {
  const output = hstack(items, options);
  const lines = output.split("\n");
  const width = Math.max(...lines.map(getStringWidth));

  return {
    output,
    width,
    height: lines.length,
  };
}

// ============================================================================
// Vertical Stack Item Builder
// ============================================================================

/**
 * Creates a stack item with header and optional body.
 *
 * @param header - Header line
 * @param body - Optional body lines
 * @param options - Item options (state, marker, compact, style)
 * @returns StackItem
 *
 * @example
 * ```typescript
 * vstackItem("feature/auth", ["PR #190 (Draft)", "2 hours ago"], {
 *   state: "current",
 *   compact: "feature/auth • Draft • 2h ago"
 * });
 * ```
 */
export function vstackItem(
  header: string,
  body?: string[],
  options?: {
    state?: ItemState;
    marker?: MarkerName | string;
    compact?: string;
    style?: (s: string) => string;
  }
): StackItem {
  const content = body && body.length > 0 ? [header, ...body] : [header];

  const result: StackItem = {
    content,
    state: options?.state ?? "default",
  };

  // Only include optional properties if they have values
  // (exactOptionalPropertyTypes requires this)
  if (options?.marker !== undefined) {
    result.marker = options.marker;
  }
  if (options?.compact !== undefined) {
    result.compact = options.compact;
  }
  if (options?.style !== undefined) {
    result.style = options.style;
  }

  return result;
}

// ============================================================================
// Vertical Stack
// ============================================================================

/**
 * Vertical guide characters for different styles.
 * Single character (no trailing space) for guide mode.
 */
const GUIDE_CHARS: Record<TreeGuideStyle, string> = {
  single: "│",
  heavy: "┃",
  double: "║",
  rounded: "│",
};

/**
 * Renders items in plain mode.
 * Plain strings appear without markers; vstackItem results with state show markers.
 */
function renderPlainMode(
  items: StackItem[],
  theme: StackTheme,
  gap: number
): string {
  const lines: string[] = [];

  for (const item of items) {
    const { marker, show } = resolveMarker(item, theme);
    const contentLines = getContentLines(item.content);
    const prefix = show ? `${marker} ` : "";

    // First line gets marker (if applicable)
    const firstLine = contentLines[0];
    if (firstLine !== undefined) {
      const styled = applyStyle(firstLine, item.style);
      lines.push(`${prefix}${styled}`);
    }

    // Remaining lines - indent if marker was shown
    const indent = show ? "  " : "";
    for (let i = 1; i < contentLines.length; i++) {
      const line = contentLines[i];
      if (line !== undefined) {
        const styled = applyStyle(line, item.style);
        lines.push(`${indent}${styled}`);
      }
    }
  }

  return joinVertical(lines, { gap });
}

/**
 * Renders items in guide mode.
 * Items with state/marker show markers; plain strings show default marker.
 */
function renderGuideMode(
  items: StackItem[],
  theme: StackTheme,
  guideStyle: TreeGuideStyle
): string {
  const lines: string[] = [];
  const guideChar = GUIDE_CHARS[guideStyle];

  for (let itemIdx = 0; itemIdx < items.length; itemIdx++) {
    const item = items[itemIdx];
    if (!item) continue;

    const { marker, show } = resolveMarker(item, theme);
    const contentLines = getContentLines(item.content);
    const isLastItem = itemIdx === items.length - 1;

    // In guide mode, always show a marker (use default if not explicitly set)
    const displayMarker = show ? marker : getMarker(theme.markers.default);

    // Header line with marker
    const firstLine = contentLines[0];
    if (firstLine !== undefined) {
      const styled = applyStyle(firstLine, item.style);
      lines.push(`${displayMarker} ${styled}`);
    }

    // Body lines with guide
    for (let i = 1; i < contentLines.length; i++) {
      const line = contentLines[i];
      if (line !== undefined) {
        const styled = applyStyle(line, item.style);
        lines.push(`${guideChar} ${styled}`);
      }
    }

    // Add separator line between items (except after last)
    if (!isLastItem) {
      lines.push(guideChar);
    }
  }

  return lines.join("\n");
}

/**
 * Renders items in tree mode.
 */
function renderTreeMode(
  items: StackItem[],
  guideStyle: TreeGuideStyle
): string {
  const lines: string[] = [];
  const guides = TREE_GUIDES[guideStyle];

  for (let itemIdx = 0; itemIdx < items.length; itemIdx++) {
    const item = items[itemIdx];
    if (!item) continue;

    const contentLines = getContentLines(item.content);
    const isLastItem = itemIdx === items.length - 1;
    const connector = isLastItem ? guides.end : guides.fork;
    const continuation = isLastItem ? "    " : guides.vertical;

    // Header line with tree connector
    const firstLine = contentLines[0];
    if (firstLine !== undefined) {
      const styled = applyStyle(firstLine, item.style);
      lines.push(`${connector}${styled}`);
    }

    // Body lines with continuation
    for (let i = 1; i < contentLines.length; i++) {
      const line = contentLines[i];
      if (line !== undefined) {
        const styled = applyStyle(line, item.style);
        lines.push(`${continuation}${styled}`);
      }
    }
  }

  return lines.join("\n");
}

/**
 * Renders items in boxed mode.
 */
function renderBoxedMode(items: StackItem[], gap: number): string {
  const boxes: string[] = [];

  for (const item of items) {
    const contentLines = getContentLines(item.content);
    const styled = contentLines.map((line) => applyStyle(line, item.style));
    boxes.push(renderBox(styled));
  }

  return joinVertical(boxes, { gap });
}

/**
 * Renders items in compact mode.
 * Always shows markers (uses default if not explicitly set).
 */
function renderCompactMode(items: StackItem[], theme: StackTheme): string {
  const lines: string[] = [];

  for (const item of items) {
    const { marker, show } = resolveMarker(item, theme);
    // In compact mode, always show a marker (use default if not explicitly set)
    const displayMarker = show ? marker : getMarker(theme.markers.default);

    // Use compact representation, or fall back to first content line
    let displayText: string;
    if (item.compact) {
      displayText = item.compact;
    } else {
      const contentLines = getContentLines(item.content);
      displayText = contentLines[0] ?? "";
    }

    const styled = applyStyle(displayText, item.style);
    lines.push(`${displayMarker} ${styled}`);
  }

  return lines.join("\n");
}

/**
 * Stacks items vertically with configurable display mode.
 *
 * @param items - Items to stack (strings or StackItems)
 * @param options - Configuration options
 * @returns Formatted string
 *
 * @example
 * ```typescript
 * // Guide mode (gt log style)
 * vstack([
 *   vstackItem("feature/auth", ["PR #190"], { state: "current" }),
 *   vstackItem("feature/api", ["PR #189"]),
 * ], { mode: "guide" });
 * // → ◉ feature/auth
 * //   │ PR #190
 * //   │
 * //   ○ feature/api
 * //   │ PR #189
 *
 * // Compact mode
 * vstack(items, { mode: "compact" });
 * // → ◉ feature/auth • Draft • 2h ago
 * //   ○ feature/api • 1d ago
 * ```
 */
export function vstack(items: StackInput[], options?: VStackOptions): string {
  if (items.length === 0) return "";

  const normalizedItems = items.map(normalizeItem);
  const mode = options?.mode ?? "guide";
  const gap = options?.gap ?? 0;

  // Merge theme with defaults
  const theme: StackTheme = {
    ...DEFAULT_STACK_THEME,
    ...options?.theme,
    markers: {
      ...DEFAULT_STACK_THEME.markers,
      ...options?.theme?.markers,
    },
  };

  // Guide style from option or theme
  const guideStyle = options?.guide ?? theme.guide ?? "single";

  switch (mode) {
    case "plain":
      return renderPlainMode(normalizedItems, theme, gap);
    case "guide":
      return renderGuideMode(normalizedItems, theme, guideStyle);
    case "tree":
      return renderTreeMode(normalizedItems, guideStyle);
    case "boxed":
      return renderBoxedMode(normalizedItems, gap);
    case "compact":
      return renderCompactMode(normalizedItems, theme);
    default: {
      const _exhaustive: never = mode;
      return _exhaustive;
    }
  }
}

/**
 * Creates a vertical stack with metadata for composition.
 *
 * @param items - Items to stack
 * @param options - Configuration options
 * @returns StackBox with output, width, and height
 */
export function createVStack(
  items: StackInput[],
  options?: VStackOptions
): StackBox {
  const output = vstack(items, options);
  const lines = output.split("\n");
  const width = Math.max(...lines.map(getStringWidth), 0);

  return {
    output,
    width,
    height: lines.length,
  };
}

// ============================================================================
// Box/Stack Conversion Helpers
// ============================================================================

/**
 * Options for boxify helper.
 */
export interface BoxifyOptions {
  /** Box title */
  title?: string;
  /** Border style */
  border?: "single" | "double" | "rounded" | "heavy" | "none";
  /** Padding inside the box */
  padding?: number;
}

/**
 * Wraps content in a box for visual grouping.
 *
 * Convenience wrapper around createBox that accepts any Renderable,
 * string, or string array.
 *
 * @param content - Content to wrap (Renderable, string, or string[])
 * @param options - Box options (title, border, padding)
 * @returns Renderable box that can be used in stacks or nested
 *
 * @example
 * ```typescript
 * // Boxify a stack
 * const stack = createVStack([...], { mode: "guide" });
 * const boxed = boxify(stack, { title: "Branches", border: "rounded" });
 *
 * // Boxify plain text
 * const box = boxify("Hello World", { border: "double" });
 *
 * // Use in composition
 * hstack([boxify(stack1), boxify(stack2)], { gap: 2 });
 * ```
 */
export function boxify(
  content: Renderable | string | string[],
  options?: BoxifyOptions
): Renderable {
  // Import createBox inline to avoid circular dependency
  const { createBox: makeBox } = require("./box.js") as {
    createBox: typeof import("./box.js").createBox;
  };

  const boxContent = isRenderable(content) ? content.output : content;

  // Build options object, only including defined values
  // (exactOptionalPropertyTypes requires this)
  const boxOptions: Parameters<typeof makeBox>[1] = {
    border: options?.border ?? "single",
  };
  if (options?.title !== undefined) {
    boxOptions.title = options.title;
  }
  if (options?.padding !== undefined) {
    boxOptions.padding = options.padding;
  }

  return makeBox(boxContent, boxOptions);
}

/**
 * Extracts the raw output string from a Renderable.
 *
 * Useful when you need the string representation without the metadata,
 * or when passing to functions that only accept strings.
 *
 * @param content - Renderable or string
 * @returns The output string
 *
 * @example
 * ```typescript
 * const stack = createVStack([...], { mode: "guide" });
 * const raw = unbox(stack); // Just the string, no metadata
 *
 * // Useful for logging or string manipulation
 * console.log(unbox(boxedContent));
 *
 * // Pass-through for strings
 * unbox("already a string"); // Returns "already a string"
 * ```
 */
export function unbox(content: Renderable | string): string {
  if (isRenderable(content)) {
    return content.output;
  }
  return content;
}
