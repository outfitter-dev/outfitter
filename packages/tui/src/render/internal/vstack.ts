/**
 * Vertical stack composition.
 *
 * @packageDocumentation
 */

import { getStringWidth } from "@outfitter/cli/text";

import { renderBox } from "../box.js";
import { joinVertical } from "../layout.js";
import { TREE_GUIDES, type TreeGuideStyle } from "../tree.js";
import {
  applyStyle,
  getContentLines,
  normalizeItem,
  resolveMarker,
} from "./stack-helpers.js";
import {
  DEFAULT_STACK_THEME,
  getMarker,
  type ItemState,
  type MarkerName,
  type StackBox,
  type StackInput,
  type StackItem,
  type StackTheme,
  type VStackOptions,
} from "./stack-types.js";

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
// Vertical Stack Render Modes
// ============================================================================

/**
 * Vertical guide characters for different styles.
 * Single character (no trailing space) for guide mode.
 */
const GUIDE_CHARS: Record<TreeGuideStyle, string> = {
  single: "\u2502",
  heavy: "\u2503",
  double: "\u2551",
  rounded: "\u2502",
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

// ============================================================================
// Vertical Stack
// ============================================================================

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
 *
 * // Compact mode
 * vstack(items, { mode: "compact" });
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
