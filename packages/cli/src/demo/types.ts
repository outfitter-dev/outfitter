/**
 * Demo system types.
 *
 * Defines the core interfaces for the self-documenting demo system.
 *
 * @packageDocumentation
 */

import type { Theme } from "../render/colors.js";

// ============================================================================
// Primitive Identifiers
// ============================================================================

/**
 * Available primitive types for demos.
 */
export type PrimitiveId =
  | "colors"
  | "borders"
  | "spinner"
  | "list"
  | "box"
  | "table"
  | "progress"
  | "tree"
  | "text"
  | "markdown"
  | "indicators";

// ============================================================================
// Metadata Types
// ============================================================================

/**
 * Categorization for theme methods.
 */
export type ThemeMethodCategory = "semantic" | "utility";

/**
 * Metadata for a theme method.
 */
export interface ThemeMethodMeta {
  /** Method category (semantic or utility) */
  category: ThemeMethodCategory;
  /** Human-readable description */
  description: string;
  /** Default example text */
  defaultExample: string;
}

/**
 * Metadata for a primitive variant (spinner styles, border styles, etc).
 */
export interface VariantMeta<T extends string> {
  /** The variant value */
  value: T;
  /** Human-readable label */
  label: string;
  /** Description of the variant */
  description: string;
}

/**
 * Metadata describing a primitive for demo generation.
 */
export interface PrimitiveMeta {
  /** Primitive identifier */
  id: PrimitiveId;
  /** Human-readable name */
  name: string;
  /** Brief description */
  description: string;
  /** Import statement example */
  importExample: string;
}

// ============================================================================
// Demo Configuration
// ============================================================================

/**
 * Customizable example texts for demos.
 *
 * Keys correspond to theme method names and other example contexts.
 */
export interface ExampleTexts {
  // Theme semantic colors
  success: string;
  warning: string;
  error: string;
  info: string;
  primary: string;
  secondary: string;
  muted: string;
  accent: string;
  highlight: string;
  link: string;
  destructive: string;
  subtle: string;

  // Theme utility methods
  bold: string;
  italic: string;
  underline: string;
  dim: string;

  // General examples
  boxContent: string;
  boxTitle: string;
  spinnerMessage: string;
  progressLabel: string;
  listItems: string[];
  tableData: Record<string, unknown>[];
  treeData: Record<string, unknown>;
  markdownSample: string;
}

/**
 * Configuration for demo rendering.
 */
export interface DemoConfig {
  /**
   * Override default example texts.
   */
  examples?: Partial<ExampleTexts>;

  /**
   * Whether to show import statements.
   * @default true
   */
  showCode?: boolean;

  /**
   * Whether to show method/variant descriptions.
   * @default true
   */
  showDescriptions?: boolean;
}

// ============================================================================
// Renderer Types
// ============================================================================

/**
 * Function that renders a demo section for a primitive.
 */
export type DemoRenderer = (config: DemoConfig, theme: Theme) => string;

/**
 * Registry entry for a primitive demo.
 */
export interface DemoRegistryEntry {
  /** Primitive metadata */
  meta: PrimitiveMeta;
  /** Render function */
  render: DemoRenderer;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Checks if a string is a valid PrimitiveId.
 */
export function isPrimitiveId(value: string): value is PrimitiveId {
  const validIds: PrimitiveId[] = [
    "colors",
    "borders",
    "spinner",
    "list",
    "box",
    "table",
    "progress",
    "tree",
    "text",
    "markdown",
    "indicators",
  ];
  return validIds.includes(value as PrimitiveId);
}
