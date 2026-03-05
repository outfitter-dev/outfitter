/**
 * Type guards and helper functions for output shapes.
 *
 * @packageDocumentation
 */

import type {
  Collection,
  Hierarchy,
  KeyValue,
  Resource,
  Shape,
  TreeNode,
} from "./shape-types.js";

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
