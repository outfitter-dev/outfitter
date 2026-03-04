/**
 * Type definitions for box rendering.
 *
 * @packageDocumentation
 */

import type { BorderStyle } from "../borders.js";

// ============================================================================
// Types
// ============================================================================

/**
 * Text alignment options for box content.
 */
export type BoxAlign = "left" | "center" | "right";

/**
 * Spacing configuration for individual sides.
 */
export interface BoxSpacing {
  bottom?: number;
  left?: number;
  right?: number;
  top?: number;
}

/**
 * Border visibility configuration for individual sides.
 */
export interface BoxBorders {
  bottom?: boolean;
  left?: boolean;
  right?: boolean;
  top?: boolean;
}

/**
 * Options for customizing box rendering.
 *
 * @example
 * ```typescript
 * // Box with title and rounded corners
 * renderBox("Content", {
 *   title: "Status",
 *   border: "rounded",
 *   padding: 1,
 * });
 *
 * // Fixed-width centered box
 * renderBox("Centered", {
 *   width: 40,
 *   align: "center",
 * });
 * ```
 */
export interface BoxOptions {
  /**
   * Content alignment within the box.
   * @default "left"
   */
  align?: BoxAlign;
  /**
   * Border style to use.
   * @default "single"
   */
  border?: BorderStyle;

  /**
   * Control which borders to render.
   * @default { top: true, right: true, bottom: true, left: true }
   */
  borders?: BoxBorders;

  /**
   * External margin (spacing outside the box).
   * Can be a single number for all sides or an object for individual sides.
   */
  margin?: number | BoxSpacing;

  /**
   * Internal padding (spaces between border and content).
   * Can be a single number for all sides or an object for individual sides.
   * @default 1
   */
  padding?: number | BoxSpacing;

  /**
   * Content sections separated by internal dividers.
   * Each section can be a string or string[].
   * When provided, takes precedence over the content parameter.
   *
   * @example
   * ```typescript
   * renderBox("", {
   *   sections: [
   *     "Header",
   *     ["Line 1", "Line 2"],
   *     "Footer"
   *   ],
   *   border: "single"
   * });
   * // ┌─────────────────┐
   * // │ Header          │
   * // ├─────────────────┤
   * // │ Line 1          │
   * // │ Line 2          │
   * // ├─────────────────┤
   * // │ Footer          │
   * // └─────────────────┘
   * ```
   */
  sections?: Array<string | string[]>;

  /**
   * Optional title to display in the top border.
   */
  title?: string;

  /**
   * Fixed width for the box. If not specified, auto-fits to content.
   */
  width?: number;
}

/**
 * A rendered box with metadata for composition.
 */
export interface Box {
  /** Height in lines */
  readonly height: number;
  /** Rendered string representation */
  readonly output: string;
  /** Width in characters */
  readonly width: number;
}

/**
 * Content that can be rendered inside a box.
 * - string: Plain text content
 * - string[]: Multi-line content
 * - Box: Nested box (rendered string with metadata)
 */
export type BoxContent = string | string[] | Box;

/**
 * Normalized spacing with all four sides defined.
 */
export interface NormalizedSpacing {
  bottom: number;
  left: number;
  right: number;
  top: number;
}

/**
 * Normalized borders with all four sides defined.
 */
export interface NormalizedBorders {
  bottom: boolean;
  left: boolean;
  right: boolean;
  top: boolean;
}
