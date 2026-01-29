/**
 * Type-safe demo registry.
 *
 * Provides metadata for all primitives that enforces compile-time completeness.
 * Adding a new theme method or spinner style without metadata causes a type error.
 *
 * @packageDocumentation
 */

import type { BorderStyle } from "../render/borders.js";
import type { Theme } from "../render/colors.js";
import type { ListStyle } from "../render/list.js";
import type { SpinnerStyle } from "../render/spinner.js";
import type {
  PrimitiveId,
  PrimitiveMeta,
  ThemeMethodMeta,
  VariantMeta,
} from "./types.js";

// ============================================================================
// Theme Method Metadata
// ============================================================================

/**
 * Type-safe metadata for all theme methods.
 *
 * Uses `keyof Theme` to ensure every theme method has metadata.
 * Adding a new method to Theme without updating this causes a compile error.
 */
export const THEME_METHOD_META: Record<keyof Theme, ThemeMethodMeta> = {
  // Semantic colors
  success: {
    category: "semantic",
    description: "Green for success messages",
    defaultExample: "Operation completed",
  },
  warning: {
    category: "semantic",
    description: "Yellow for warnings",
    defaultExample: "Proceed with caution",
  },
  error: {
    category: "semantic",
    description: "Red for errors",
    defaultExample: "Something went wrong",
  },
  info: {
    category: "semantic",
    description: "Blue for information",
    defaultExample: "For your information",
  },
  primary: {
    category: "semantic",
    description: "Default text (no color)",
    defaultExample: "Main content",
  },
  secondary: {
    category: "semantic",
    description: "Gray for secondary text",
    defaultExample: "Supporting text",
  },
  muted: {
    category: "semantic",
    description: "Dim for de-emphasized text",
    defaultExample: "(optional)",
  },
  accent: {
    category: "semantic",
    description: "Cyan for highlights",
    defaultExample: "Highlighted item",
  },
  highlight: {
    category: "semantic",
    description: "Bold for emphasis",
    defaultExample: "Important",
  },
  link: {
    category: "semantic",
    description: "Cyan + underline for URLs",
    defaultExample: "https://example.com",
  },
  destructive: {
    category: "semantic",
    description: "Bright red for dangerous actions",
    defaultExample: "Delete forever",
  },
  subtle: {
    category: "semantic",
    description: "Dim gray for fine print",
    defaultExample: "Fine print",
  },

  // Utility methods
  bold: {
    category: "utility",
    description: "Bold styling",
    defaultExample: "Strong emphasis",
  },
  italic: {
    category: "utility",
    description: "Italic styling",
    defaultExample: "Subtle emphasis",
  },
  underline: {
    category: "utility",
    description: "Underline styling",
    defaultExample: "Underlined text",
  },
  dim: {
    category: "utility",
    description: "Dim styling",
    defaultExample: "De-emphasized",
  },
};

/**
 * Gets theme methods grouped by category.
 */
export function getThemeMethodsByCategory(): {
  semantic: Array<keyof Theme>;
  utility: Array<keyof Theme>;
} {
  const semantic: Array<keyof Theme> = [];
  const utility: Array<keyof Theme> = [];

  for (const [key, meta] of Object.entries(THEME_METHOD_META)) {
    if (meta.category === "semantic") {
      semantic.push(key as keyof Theme);
    } else {
      utility.push(key as keyof Theme);
    }
  }

  return { semantic, utility };
}

// ============================================================================
// Border Style Metadata
// ============================================================================

/**
 * Type-safe metadata for all border styles.
 */
export const BORDER_STYLE_META: Record<
  BorderStyle,
  VariantMeta<BorderStyle>
> = {
  single: {
    value: "single",
    label: "Single",
    description: "Standard Unicode single-line borders (┌─┐)",
  },
  double: {
    value: "double",
    label: "Double",
    description: "Double-line borders (╔═╗)",
  },
  rounded: {
    value: "rounded",
    label: "Rounded",
    description: "Rounded corners with single lines (╭─╮)",
  },
  heavy: {
    value: "heavy",
    label: "Heavy",
    description: "Thick/heavy borders (┏━┓)",
  },
  ascii: {
    value: "ascii",
    label: "ASCII",
    description: "ASCII-only fallback (+, -, |)",
  },
  none: {
    value: "none",
    label: "None",
    description: "No borders (empty strings)",
  },
};

/**
 * Gets all border styles as an array.
 */
export function getBorderStyles(): BorderStyle[] {
  return Object.keys(BORDER_STYLE_META) as BorderStyle[];
}

// ============================================================================
// Spinner Style Metadata
// ============================================================================

/**
 * Type-safe metadata for all spinner styles.
 */
export const SPINNER_STYLE_META: Record<
  SpinnerStyle,
  VariantMeta<SpinnerStyle>
> = {
  dots: {
    value: "dots",
    label: "Dots",
    description: "Braille dots animation (default, smooth)",
  },
  line: {
    value: "line",
    label: "Line",
    description: "Classic ASCII spinner (-\\|/)",
  },
  arc: {
    value: "arc",
    label: "Arc",
    description: "Corner arc rotation",
  },
  circle: {
    value: "circle",
    label: "Circle",
    description: "Half-filled circle rotation",
  },
  bounce: {
    value: "bounce",
    label: "Bounce",
    description: "Bouncing dot (vertical)",
  },
  ping: {
    value: "ping",
    label: "Ping",
    description: "Bouncing dot in brackets (horizontal)",
  },
};

/**
 * Gets all spinner styles as an array.
 */
export function getSpinnerStyles(): SpinnerStyle[] {
  return Object.keys(SPINNER_STYLE_META) as SpinnerStyle[];
}

// ============================================================================
// List Style Metadata
// ============================================================================

/**
 * Type-safe metadata for all list styles.
 */
export const LIST_STYLE_META: Record<ListStyle, VariantMeta<ListStyle>> = {
  dash: {
    value: "dash",
    label: "Dash",
    description: "Uses - character (default)",
  },
  bullet: {
    value: "bullet",
    label: "Bullet",
    description: "Uses • character",
  },
  number: {
    value: "number",
    label: "Number",
    description: "Uses 1. for top-level, a. for nested, i. for deeply nested",
  },
  checkbox: {
    value: "checkbox",
    label: "Checkbox",
    description: "Uses ☐ for unchecked, ☑ for checked",
  },
};

/**
 * Gets all list styles as an array.
 */
export function getListStyles(): ListStyle[] {
  return Object.keys(LIST_STYLE_META) as ListStyle[];
}

// ============================================================================
// Primitive Metadata
// ============================================================================

/**
 * Type-safe metadata for all primitives.
 */
export const PRIMITIVE_META: Record<PrimitiveId, PrimitiveMeta> = {
  colors: {
    id: "colors",
    name: "Colors",
    description: "Semantic color theme with ANSI support",
    importExample: 'import { createTheme } from "@outfitter/cli/render";',
  },
  borders: {
    id: "borders",
    name: "Borders",
    description: "Box-drawing character sets",
    importExample:
      'import { BORDERS, getBorderCharacters } from "@outfitter/cli/render";',
  },
  spinner: {
    id: "spinner",
    name: "Spinner",
    description: "Animated spinners for async operations",
    importExample:
      'import { renderSpinner, SPINNERS } from "@outfitter/cli/render";',
  },
  list: {
    id: "list",
    name: "List",
    description: "Bullet, numbered, and checkbox lists",
    importExample: 'import { renderList } from "@outfitter/cli/render";',
  },
  box: {
    id: "box",
    name: "Box",
    description: "Bordered panels with optional titles",
    importExample: 'import { renderBox } from "@outfitter/cli/render";',
  },
  table: {
    id: "table",
    name: "Table",
    description: "Unicode tables with multiple border styles",
    importExample: 'import { renderTable } from "@outfitter/cli/render";',
  },
  progress: {
    id: "progress",
    name: "Progress",
    description: "Progress bars with filled/empty segments",
    importExample: 'import { renderProgress } from "@outfitter/cli/render";',
  },
  tree: {
    id: "tree",
    name: "Tree",
    description: "Hierarchical tree rendering",
    importExample: 'import { renderTree } from "@outfitter/cli/render";',
  },
  text: {
    id: "text",
    name: "Text",
    description: "Text utilities (width, wrap, truncate, pad)",
    importExample:
      'import { getStringWidth, wrapText, truncateText, padText } from "@outfitter/cli/render";',
  },
  markdown: {
    id: "markdown",
    name: "Markdown",
    description: "Markdown to terminal ANSI rendering",
    importExample: 'import { renderMarkdown } from "@outfitter/cli/render";',
  },
  indicators: {
    id: "indicators",
    name: "Indicators",
    description: "Status symbols, selection markers, and progress indicators",
    importExample:
      'import { getIndicator, INDICATORS } from "@outfitter/cli/render";',
  },
};

/**
 * Gets all primitive IDs as an array.
 */
export function getPrimitiveIds(): PrimitiveId[] {
  return Object.keys(PRIMITIVE_META) as PrimitiveId[];
}

/**
 * Gets metadata for a specific primitive.
 */
export function getPrimitiveMeta(id: PrimitiveId): PrimitiveMeta {
  return PRIMITIVE_META[id];
}
