/**
 * Shape type definitions for output rendering.
 *
 * Provides typed output shapes (Collection, Hierarchy, KeyValue, Resource)
 * used by the unified render function.
 *
 * @packageDocumentation
 */

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
  /** Child nodes (empty array for leaf nodes) */
  children: TreeNode[];
  /** The name/label of this node */
  name: string;
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
  /** Optional custom headers for table rendering */
  headers?: Record<string, string>;
  /** Array of items to render */
  items: unknown[];
  /** Discriminant for Collection type */
  type: "collection";
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
  /** Root node of the tree */
  root: TreeNode;
  /** Discriminant for Hierarchy type */
  type: "hierarchy";
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
  /** Key-value entries to display */
  entries: Record<string, unknown>;
  /** Discriminant for KeyValue type */
  type: "keyvalue";
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
  /** The content to render */
  data: unknown;
  /** Output format (defaults to "json") */
  format?: "json" | "markdown" | "text";
  /** Discriminant for Resource type */
  type: "resource";
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
  /** Whether to use ANSI colors in output */
  color?: boolean;
  /** Force a specific output format, overriding auto-selection */
  format?: "table" | "list" | "tree" | "json" | "text";
  /** Maximum width for output (used by some renderers) */
  width?: number;
}
