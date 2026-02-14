/**
 * Output shapes and unified render function.
 *
 * Provides typed output shapes (Collection, Hierarchy, KeyValue, Resource)
 * and a unified render function that auto-selects the appropriate renderer.
 *
 * @packageDocumentation
 */

import { renderJson, renderText } from "./json.js";
import { renderList } from "./list.js";
import { renderMarkdown } from "./markdown.js";
import { renderTable } from "./table.js";
import { renderTree } from "./tree.js";

// ============================================================================
// Shape Types
// ============================================================================

/**
 * A tree node for hierarchical data structures.
 *
 * @example
 * ```typescript
 * const tree: TreeNode = {
 *   name: "src",
 *   children: [
 *     { name: "index.ts", children: [] },
 *     { name: "utils", children: [{ name: "helpers.ts", children: [] }] },
 *   ],
 * };
 * ```
 */
export interface TreeNode {
  /** The name/label of this node */
  name: string;
  /** Child nodes (empty array for leaf nodes) */
  children: TreeNode[];
}

/**
 * A collection of items, rendered as table (objects) or list (primitives).
 *
 * @example
 * ```typescript
 * // Table rendering (array of objects)
 * const users: Collection = {
 *   type: "collection",
 *   items: [{ name: "Alice", age: 30 }, { name: "Bob", age: 25 }],
 *   headers: { name: "Name", age: "Age" },
 * };
 *
 * // List rendering (array of primitives)
 * const tasks: Collection = {
 *   type: "collection",
 *   items: ["Task 1", "Task 2", "Task 3"],
 * };
 * ```
 */
export interface Collection {
  /** Discriminant for Collection type */
  type: "collection";
  /** Array of items to render */
  items: unknown[];
  /** Optional custom headers for table rendering */
  headers?: Record<string, string>;
}

/**
 * A hierarchical tree structure.
 *
 * @example
 * ```typescript
 * const fileTree: Hierarchy = {
 *   type: "hierarchy",
 *   root: {
 *     name: "project",
 *     children: [
 *       { name: "src", children: [{ name: "index.ts", children: [] }] },
 *       { name: "package.json", children: [] },
 *     ],
 *   },
 * };
 * ```
 */
export interface Hierarchy {
  /** Discriminant for Hierarchy type */
  type: "hierarchy";
  /** Root node of the tree */
  root: TreeNode;
}

/**
 * Key-value pairs for displaying configuration or metadata.
 *
 * @example
 * ```typescript
 * const config: KeyValue = {
 *   type: "keyvalue",
 *   entries: {
 *     name: "my-app",
 *     version: "1.0.0",
 *     debug: true,
 *   },
 * };
 * ```
 */
export interface KeyValue {
  /** Discriminant for KeyValue type */
  type: "keyvalue";
  /** Key-value entries to display */
  entries: Record<string, unknown>;
}

/**
 * A resource with content in a specific format.
 *
 * @example
 * ```typescript
 * const jsonResource: Resource = {
 *   type: "resource",
 *   data: { name: "test", value: 42 },
 *   format: "json",
 * };
 *
 * const markdownResource: Resource = {
 *   type: "resource",
 *   data: "# Heading\n\nSome **bold** text",
 *   format: "markdown",
 * };
 * ```
 */
export interface Resource {
  /** Discriminant for Resource type */
  type: "resource";
  /** The content to render */
  data: unknown;
  /** Output format (defaults to "json") */
  format?: "json" | "markdown" | "text";
}

/**
 * Discriminated union of all output shape types.
 *
 * Use the type guards {@link isCollection}, {@link isHierarchy},
 * {@link isKeyValue}, and {@link isResource} for type narrowing.
 *
 * @example
 * ```typescript
 * function processShape(shape: Shape) {
 *   if (isCollection(shape)) {
 *     console.log(`Collection with ${shape.items.length} items`);
 *   } else if (isHierarchy(shape)) {
 *     console.log(`Tree rooted at ${shape.root.name}`);
 *   }
 * }
 * ```
 */
export type Shape = Collection | Hierarchy | KeyValue | Resource;

/**
 * Options for the unified {@link render} function.
 *
 * @example
 * ```typescript
 * const options: RenderOptions = {
 *   width: 80,
 *   color: true,
 *   format: "json",
 * };
 * ```
 */
export interface RenderOptions {
  /** Maximum width for output (used by some renderers) */
  width?: number;
  /** Whether to use ANSI colors in output */
  color?: boolean;
  /** Force a specific output format, overriding auto-selection */
  format?: "table" | "list" | "tree" | "json" | "text";
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard for {@link Collection} shapes.
 *
 * @param shape - Shape to check
 * @returns `true` if the shape is a Collection
 *
 * @example
 * ```typescript
 * if (isCollection(shape)) {
 *   console.log(`Has ${shape.items.length} items`);
 * }
 * ```
 */
export function isCollection(shape: Shape): shape is Collection {
  return shape.type === "collection";
}

/**
 * Type guard for {@link Hierarchy} shapes.
 *
 * @param shape - Shape to check
 * @returns `true` if the shape is a Hierarchy
 *
 * @example
 * ```typescript
 * if (isHierarchy(shape)) {
 *   console.log(`Root: ${shape.root.name}`);
 * }
 * ```
 */
export function isHierarchy(shape: Shape): shape is Hierarchy {
  return shape.type === "hierarchy";
}

/**
 * Type guard for {@link KeyValue} shapes.
 *
 * @param shape - Shape to check
 * @returns `true` if the shape is a KeyValue
 *
 * @example
 * ```typescript
 * if (isKeyValue(shape)) {
 *   console.log(`Keys: ${Object.keys(shape.entries).join(", ")}`);
 * }
 * ```
 */
export function isKeyValue(shape: Shape): shape is KeyValue {
  return shape.type === "keyvalue";
}

/**
 * Type guard for {@link Resource} shapes.
 *
 * @param shape - Shape to check
 * @returns `true` if the shape is a Resource
 *
 * @example
 * ```typescript
 * if (isResource(shape)) {
 *   console.log(`Format: ${shape.format ?? "json"}`);
 * }
 * ```
 */
export function isResource(shape: Shape): shape is Resource {
  return shape.type === "resource";
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Converts a TreeNode to the Record format expected by renderTree.
 */
export function treeNodeToRecord(node: TreeNode): Record<string, unknown> {
  if (node.children.length === 0) {
    return { [node.name]: null };
  }

  const childRecord: Record<string, unknown> = {};
  for (const child of node.children) {
    const childObj = treeNodeToRecord(child);
    Object.assign(childRecord, childObj);
  }

  return { [node.name]: childRecord };
}

/**
 * Checks if an item is a plain object (not null, not array, not primitive).
 */
export function isPlainObject(item: unknown): item is Record<string, unknown> {
  return item !== null && typeof item === "object" && !Array.isArray(item);
}

// ============================================================================
// Custom Renderer Registry
// ============================================================================

/**
 * A function that renders a shape to a string.
 *
 * @typeParam S - The specific shape type this renderer handles
 */
export type ShapeRenderer<S extends Shape = Shape> = (
  shape: S,
  options?: RenderOptions
) => string;

/** Registry map: shape type -> renderer function */
const customRenderers = new Map<string, ShapeRenderer>();

/**
 * Registers a custom renderer for a shape type.
 * Custom renderers take precedence over built-in renderers.
 *
 * @param shapeType - The shape type to register (e.g., "collection", "hierarchy")
 * @param renderer - The renderer function to use for this shape type
 *
 * @example
 * ```typescript
 * registerRenderer("collection", (shape, opts) => {
 *   return shape.items.map(item => `- ${item}`).join("\n");
 * });
 * ```
 */
export function registerRenderer<S extends Shape>(
  shapeType: S["type"],
  renderer: ShapeRenderer<S>
): void {
  customRenderers.set(shapeType, renderer as ShapeRenderer);
}

/**
 * Removes a custom renderer, reverting to built-in behavior.
 *
 * @param shapeType - The shape type to unregister
 * @returns `true` if a renderer was removed, `false` if none existed
 *
 * @example
 * ```typescript
 * unregisterRenderer("collection"); // Reverts to built-in table/list rendering
 * ```
 */
export function unregisterRenderer(shapeType: string): boolean {
  return customRenderers.delete(shapeType);
}

/**
 * Clears all custom renderers, reverting to built-in behavior.
 * Useful for testing to ensure clean state between tests.
 *
 * @example
 * ```typescript
 * afterEach(() => {
 *   clearRenderers();
 * });
 * ```
 */
export function clearRenderers(): void {
  customRenderers.clear();
}

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
 * // Collection auto-selects table or list
 * render({ type: "collection", items: [{ name: "Alice" }] });
 * render({ type: "collection", items: ["item1", "item2"] });
 *
 * // Hierarchy uses tree rendering
 * render({ type: "hierarchy", root: { name: "src", children: [] } });
 *
 * // KeyValue renders formatted pairs
 * render({ type: "keyvalue", entries: { key: "value" } });
 *
 * // Resource respects format option
 * render({ type: "resource", data: obj, format: "json" });
 *
 * // Override with options.format
 * render({ type: "collection", items: [{ a: 1 }] }, { format: "json" });
 * ```
 */
export function render(shape: Shape, options?: RenderOptions): string {
  // Check custom renderer registry first
  const customRenderer = customRenderers.get(shape.type);
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
