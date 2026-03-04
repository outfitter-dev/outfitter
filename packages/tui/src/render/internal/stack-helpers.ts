/**
 * Internal helper functions for stack composition.
 *
 * @packageDocumentation
 */

import {
  DELIMITERS,
  getDelimiter,
  getMarker,
  isRenderable,
  type DelimiterName,
  type StackInput,
  type StackItem,
  type StackTheme,
} from "./stack-types.js";

/**
 * Checks if a delimiter string is a known delimiter name.
 */
export function isDelimiterName(value: string): value is DelimiterName {
  return value in DELIMITERS;
}

/**
 * Resolves a delimiter option to a character.
 */
export function resolveDelimiter(
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
 * Normalizes input to StackItem.
 * - Plain strings get no state (no marker)
 * - Renderables (Box/StackBox) are converted to content strings
 * - StackItems are passed through
 */
export function normalizeItem(item: StackInput): StackItem {
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
export function shouldShowMarker(item: StackItem): boolean {
  return item.state !== undefined || item.marker !== undefined;
}

/**
 * Resolves marker for an item using theme.
 * Returns empty string if item shouldn't show a marker.
 */
export function resolveMarker(
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
export function getContentLines(content: string | string[]): string[] {
  if (typeof content === "string") {
    return content.split("\n");
  }
  return content;
}

/**
 * Applies style function to content if present.
 */
export function applyStyle(
  content: string,
  style?: (s: string) => string
): string {
  return style ? style(content) : content;
}
