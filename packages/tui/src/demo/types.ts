/**
 * Demo system types.
 *
 * Defines the core interfaces for the self-documenting demo system.
 *
 * @packageDocumentation
 */

import type { Theme } from "@outfitter/cli/colors";

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
  /** Default example text */
  defaultExample: string;
  /** Human-readable description */
  description: string;
}

/**
 * Metadata for a primitive variant (spinner styles, border styles, etc).
 */
export interface VariantMeta<T extends string> {
  /** Description of the variant */
  description: string;
  /** Human-readable label */
  label: string;
  /** The variant value */
  value: T;
}

/**
 * Metadata describing a primitive for demo generation.
 */
export interface PrimitiveMeta {
  /** Brief description */
  description: string;
  /** Primitive identifier */
  id: PrimitiveId;
  /** Import statement example */
  importExample: string;
  /** Human-readable name */
  name: string;
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
  accent: string;

  // Theme utility methods
  bold: string;

  // General examples
  boxContent: string;
  boxTitle: string;
  destructive: string;
  dim: string;
  error: string;
  highlight: string;
  info: string;
  italic: string;
  link: string;
  listItems: string[];
  markdownSample: string;
  muted: string;
  primary: string;
  progressLabel: string;
  secondary: string;
  spinnerMessage: string;
  subtle: string;
  // Theme semantic colors
  success: string;
  tableData: Record<string, unknown>[];
  treeData: Record<string, unknown>;
  underline: string;
  warning: string;
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
