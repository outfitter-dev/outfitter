/**
 * Self-documenting demo system for CLI primitives.
 *
 * Provides a reusable demo system where primitives define their own metadata,
 * enabling automatic demo generation that stays in sync with the code.
 *
 * @packageDocumentation
 *
 * @example
 * ```typescript
 * import { renderDemo, renderAllDemos } from "@outfitter/cli/demo";
 *
 * // Render a single primitive demo
 * console.log(renderDemo("colors"));
 *
 * // Render all demos with custom examples
 * console.log(renderAllDemos({
 *   examples: {
 *     success: "Payment processed",
 *     error: "Transaction failed",
 *   }
 * }));
 * ```
 */

import { createTheme } from "@outfitter/cli/colors";
import {
  getPrimitiveIds,
  getPrimitiveMeta,
  PRIMITIVE_META,
} from "./registry.js";
// Import all renderers
import { renderBordersDemo } from "./renderers/borders.js";
import { renderBoxDemo } from "./renderers/box.js";
import { renderColorsDemo } from "./renderers/colors.js";
import { renderIndicatorsDemo } from "./renderers/indicators.js";
import { renderListDemo } from "./renderers/list.js";
import { renderMarkdownDemo } from "./renderers/markdown.js";
import { renderProgressDemo } from "./renderers/progress.js";
import { renderSpinnerDemo } from "./renderers/spinner.js";
import { renderTableDemo } from "./renderers/table.js";
import { renderTextDemo } from "./renderers/text.js";
import { renderTreeDemo } from "./renderers/tree.js";
import type {
  DemoConfig,
  DemoRegistryEntry,
  DemoRenderer,
  PrimitiveId,
  PrimitiveMeta,
} from "./types.js";

// ============================================================================
// Demo Registry
// ============================================================================

/**
 * Maps primitive IDs to their render functions.
 */
const DEMO_RENDERERS: Record<PrimitiveId, DemoRenderer> = {
  colors: renderColorsDemo,
  borders: renderBordersDemo,
  spinner: renderSpinnerDemo,
  list: renderListDemo,
  box: renderBoxDemo,
  table: renderTableDemo,
  progress: renderProgressDemo,
  tree: renderTreeDemo,
  text: renderTextDemo,
  markdown: renderMarkdownDemo,
  indicators: renderIndicatorsDemo,
};

// ============================================================================
// Public API
// ============================================================================

/**
 * Renders a demo for a specific primitive.
 *
 * @param id - The primitive to demo
 * @param config - Optional configuration for customization
 * @returns Formatted demo output string
 *
 * @example
 * ```typescript
 * // Default examples
 * console.log(renderDemo("colors"));
 *
 * // Custom examples
 * console.log(renderDemo("colors", {
 *   examples: { success: "Build completed" }
 * }));
 *
 * // No code examples
 * console.log(renderDemo("table", { showCode: false }));
 * ```
 */
export function renderDemo(id: PrimitiveId, config: DemoConfig = {}): string {
  const renderer = DEMO_RENDERERS[id];
  const theme = createTheme();
  return renderer(config, theme);
}

/**
 * Renders demos for all primitives.
 *
 * @param config - Optional configuration applied to all demos
 * @returns Combined output from all demos, separated by blank lines
 *
 * @example
 * ```typescript
 * console.log(renderAllDemos());
 *
 * // With custom config
 * console.log(renderAllDemos({
 *   showCode: false,
 *   showDescriptions: true,
 * }));
 * ```
 */
export function renderAllDemos(config: DemoConfig = {}): string {
  const theme = createTheme();
  const outputs: string[] = [];

  for (const id of getPrimitiveIds()) {
    const renderer = DEMO_RENDERERS[id];
    outputs.push(renderer(config, theme));
    outputs.push(""); // Blank line between sections
  }

  return outputs.join("\n").trimEnd();
}

/**
 * Gets all available primitive IDs.
 *
 * @returns Array of primitive identifiers
 *
 * @example
 * ```typescript
 * const ids = getPrimitiveIds();
 * // ["colors", "borders", "spinner", "list", "box", "table", "progress", "tree", "text", "markdown"]
 * ```
 */
// biome-ignore lint/performance/noBarrelFile: intentional re-export for API surface
export { getPrimitiveIds } from "./registry.js";

/**
 * Gets metadata for a specific primitive.
 *
 * @param id - The primitive ID
 * @returns Primitive metadata including name, description, and import example
 *
 * @example
 * ```typescript
 * const meta = getPrimitive("colors");
 * console.log(meta.name); // "Colors"
 * console.log(meta.importExample); // 'import { createTheme } from "@outfitter/cli/render";'
 * ```
 */
export function getPrimitive(id: PrimitiveId): PrimitiveMeta {
  return getPrimitiveMeta(id);
}

/**
 * Gets all primitives with their metadata.
 *
 * @returns Array of all primitive metadata
 */
export function getAllPrimitives(): PrimitiveMeta[] {
  return getPrimitiveIds().map((id) => PRIMITIVE_META[id]);
}

/**
 * Gets a registry entry with both metadata and renderer.
 *
 * @param id - The primitive ID
 * @returns Registry entry with meta and render function
 */
export function getDemoEntry(id: PrimitiveId): DemoRegistryEntry {
  return {
    meta: getPrimitiveMeta(id),
    render: DEMO_RENDERERS[id],
  };
}

// ============================================================================
// Re-exports for convenience
// ============================================================================

export {
  BORDER_STYLE_META,
  getBorderStyles,
  getListStyles,
  getSpinnerStyles,
  getThemeMethodsByCategory,
  LIST_STYLE_META,
  PRIMITIVE_META,
  SPINNER_STYLE_META,
  THEME_METHOD_META,
} from "./registry.js";
// Section helpers
export {
  codeBlock,
  demoContent,
  demoSection,
  demoSubsection,
  description,
  type SectionOptions,
  type SubsectionOptions,
} from "./section.js";
export { DEFAULT_EXAMPLES, getExample } from "./templates.js";
export type {
  DemoConfig,
  DemoRegistryEntry,
  DemoRenderer,
  ExampleTexts,
  PrimitiveId,
  PrimitiveMeta,
  ThemeMethodCategory,
  ThemeMethodMeta,
  VariantMeta,
} from "./types.js";
export { isPrimitiveId } from "./types.js";
