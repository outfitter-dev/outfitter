/* eslint-disable outfitter/max-file-lines -- Stack composition types and helpers stay grouped so layout semantics remain clear. */
/**
 * Stack composition types, delimiter registry, and marker names.
 *
 * @packageDocumentation
 */

import { getIndicator, isUnicodeSupported } from "../indicators.js";
import type { TreeGuideStyle } from "../tree.js";

// ============================================================================
// Delimiter Registry
// ============================================================================

/**
 * Delimiter set with unicode and fallback representations.
 */
export interface DelimiterSet {
  /** ASCII fallback for limited terminals */
  fallback: string;
  /** Unicode character for modern terminals */
  unicode: string;
}

/**
 * Available delimiter names.
 */
export type DelimiterName =
  | "arrow"
  | "bullet"
  | "colon"
  | "dot"
  | "pipe"
  | "slash"
  | "space";

/**
 * Registry of delimiter characters with unicode and fallback support.
 *
 * @example
 * ```typescript
 * import { DELIMITERS, getDelimiter } from "@outfitter/tui/render/stack";
 *
 * // Access directly
 * console.log(DELIMITERS.bullet.unicode); // "•"
 *
 * // Or use helper
 * console.log(getDelimiter("bullet")); // "•" or "*"
 * ```
 */
export const DELIMITERS: Readonly<Record<DelimiterName, DelimiterSet>> = {
  space: { unicode: " ", fallback: " " },
  bullet: { unicode: "\u2022", fallback: "*" },
  dot: { unicode: "\u00B7", fallback: "." },
  pipe: { unicode: "\u2502", fallback: "|" },
  arrow: { unicode: "\u2192", fallback: "->" },
  slash: { unicode: "/", fallback: "/" },
  colon: { unicode: ":", fallback: ":" },
};

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
 * - `guide`: Vertical guide continuation (|)
 * - `tree`: Tree-style with fork/end markers
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
  /** Default delimiter for compact mode */
  delimiter?: DelimiterName;
  /** Default guide style */
  guide?: TreeGuideStyle;
  /** Map semantic states to marker names */
  markers: Record<ItemState, MarkerName>;
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
  /** Compact single-line representation */
  compact?: string;
  /** Full content (header + body lines) */
  content: string | string[];
  /** Explicit marker (bypasses theme) */
  marker?: MarkerName | string;
  /** Semantic state (resolved via theme) */
  state?: ItemState;
  /** Style function to apply to content */
  style?: (s: string) => string;
}

/**
 * A rendered block with metadata for composition.
 * Both Box and StackBox satisfy this interface.
 */
export interface Renderable {
  /** Height in lines */
  readonly height: number;
  /** Rendered string representation */
  readonly output: string;
  /** Width in characters */
  readonly width: number;
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
// Option Interfaces
// ============================================================================

/**
 * Options for horizontal stack.
 */
export interface HStackOptions {
  /** Vertical alignment for multi-line items */
  align?: "top" | "center" | "bottom";
  /** Delimiter between items (name or custom string) */
  delimiter?: DelimiterName | string;
  /** Gap (spaces) around delimiter */
  gap?: number;
}

/**
 * Options for vertical stack.
 */
export interface VStackOptions {
  /** Gap (lines) between items */
  gap?: number;
  /** Shorthand for theme.guide */
  guide?: TreeGuideStyle;
  /** Display mode */
  mode?: VStackMode;
  /** Theme for marker resolution */
  theme?: Partial<StackTheme>;
}

/**
 * Input type for stack functions.
 * Accepts strings, StackItems, or Renderables (Box/StackBox).
 */
export type StackInput = string | StackItem | Renderable;
