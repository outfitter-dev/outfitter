/**
 * Output shapes and unified render function.
 *
 * Provides typed output shapes (Collection, Hierarchy, KeyValue, Resource)
 * and a unified render function that auto-selects the appropriate renderer.
 *
 * @packageDocumentation
 */

import {
  isCollection,
  isHierarchy,
  isKeyValue,
  isPlainObject,
  isResource,
  treeNodeToRecord,
} from "./internal/shape-guards.js";
import { getCustomRenderer } from "./internal/shape-registry.js";
import type { RenderOptions, Shape } from "./internal/shape-types.js";
import { renderJson, renderText } from "./json.js";
import { renderList } from "./list.js";
import { renderMarkdown } from "./markdown.js";
import { renderTable } from "./table.js";
import { renderTree } from "./tree.js";

// ============================================================================
// Re-exports from internal modules
// ============================================================================

export type {
  Collection,
  Hierarchy,
  KeyValue,
  RenderOptions,
  Resource,
  Shape,
  TreeNode,
} from "./internal/shape-types.js";

export {
  isCollection,
  isHierarchy,
  isKeyValue,
  isPlainObject,
  isResource,
  treeNodeToRecord,
};

export type { ShapeRenderer } from "./internal/shape-registry.js";
export {
  clearRenderers,
  registerRenderer,
  unregisterRenderer,
} from "./internal/shape-registry.js";

// ============================================================================
// Unified Render Function
// ============================================================================

/**
 * Unified render function that auto-selects the appropriate renderer based on shape type.
 *
 * Auto-selection logic:
 * - **Collection**: Uses {@link renderTable} for object items, {@link renderList} for primitives
 * - **Hierarchy**: Uses {@link renderTree}
 * - **KeyValue**: Renders as formatted key-value pairs (JSON-like)
 * - **Resource**: Uses {@link renderJson}, {@link renderMarkdown}, or {@link renderText} based on format
 *
 * The `options.format` parameter can override auto-selection.
 *
 * @param shape - The shape to render
 * @param options - Rendering options
 * @returns Rendered string output
 *
 * @example
 * ```typescript
 * render({ type: "collection", items: [{ name: "Alice" }] }); // table
 * render({ type: "collection", items: ["a", "b"] });           // list
 * render({ type: "hierarchy", root: { name: "src", children: [] } });
 * render({ type: "keyvalue", entries: { key: "value" } });
 * render({ type: "resource", data: obj, format: "json" });
 * ```
 */
export function render(shape: Shape, options?: RenderOptions): string {
  // Check custom renderer registry first
  const customRenderer = getCustomRenderer(shape.type);
  if (customRenderer) {
    return customRenderer(shape, options);
  }

  const format = options?.format;

  // Handle format override
  if (format === "json") {
    if (isCollection(shape)) {
      return renderJson(shape.items);
    }
    if (isHierarchy(shape)) {
      return renderJson(treeNodeToRecord(shape.root));
    }
    if (isKeyValue(shape)) {
      return renderJson(shape.entries);
    }
    if (isResource(shape)) {
      return renderJson(shape.data);
    }
  }

  if (format === "list" && isCollection(shape)) {
    // Convert items to strings for list rendering
    const listItems = shape.items.map((item) => {
      if (typeof item === "string") {
        return item;
      }
      if (isPlainObject(item)) {
        // For objects, extract a reasonable string representation
        const name = (item as { name?: unknown }).name;
        if (typeof name === "string") {
          return name;
        }
        return JSON.stringify(item);
      }
      return String(item);
    });
    return renderList(listItems);
  }

  if (format === "table" && isCollection(shape)) {
    const items = shape.items.filter(isPlainObject) as Record<
      string,
      unknown
    >[];
    return renderTable(
      items,
      shape.headers ? { headers: shape.headers } : undefined
    );
  }

  if (format === "tree" && isHierarchy(shape)) {
    return renderTree(treeNodeToRecord(shape.root));
  }

  if (format === "text" && isResource(shape)) {
    return renderText(String(shape.data));
  }

  // Auto-selection based on shape type
  if (isCollection(shape)) {
    // Check if items are objects (use table) or primitives (use list)
    const hasObjectItems = shape.items.every(isPlainObject);

    if (hasObjectItems) {
      const items = shape.items as Record<string, unknown>[];
      return renderTable(
        items,
        shape.headers ? { headers: shape.headers } : undefined
      );
    }

    // Render as list
    const listItems = shape.items.map((item) => {
      if (typeof item === "string") {
        return item;
      }
      return String(item);
    });
    return renderList(listItems);
  }

  if (isHierarchy(shape)) {
    return renderTree(treeNodeToRecord(shape.root));
  }

  if (isKeyValue(shape)) {
    // Render key-value pairs in a formatted way
    return renderJson(shape.entries);
  }

  if (isResource(shape)) {
    const resourceFormat = shape.format ?? "json";

    if (resourceFormat === "markdown") {
      return renderMarkdown(String(shape.data));
    }

    if (resourceFormat === "text") {
      return renderText(String(shape.data));
    }

    // Default to JSON
    return renderJson(shape.data);
  }

  // Fallback (should never reach here with proper typing)
  return renderJson(shape);
}
