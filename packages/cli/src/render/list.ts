/**
 * List rendering utilities.
 *
 * Renders arrays as bullet lists with optional nesting.
 *
 * @packageDocumentation
 */

/**
 * A list item with optional nested children for {@link renderList}.
 *
 * @example
 * ```typescript
 * const item: NestedListItem = {
 *   text: "Parent item",
 *   children: ["Child 1", "Child 2"],
 * };
 * ```
 */
export interface NestedListItem {
  /** The text content of this list item */
  text: string;
  /** Optional nested child items (strings or nested items) */
  children?: Array<string | NestedListItem>;
}

/**
 * A list item that can be either a simple string or a nested item with children.
 *
 * @example
 * ```typescript
 * const items: ListItem[] = [
 *   "Simple item",
 *   { text: "Parent", children: ["Child 1", "Child 2"] },
 * ];
 * ```
 */
export type ListItem = string | NestedListItem;

/**
 * Renders items as a bullet list with optional nesting.
 *
 * Supports both simple string items and nested items with children.
 * Nested items are indented with 2 spaces per level.
 *
 * @param items - Array of list items (strings or nested items)
 * @returns Formatted bullet list string
 *
 * @example
 * ```typescript
 * // Simple list
 * console.log(renderList(["First", "Second", "Third"]));
 * // - First
 * // - Second
 * // - Third
 *
 * // Nested list
 * console.log(renderList([
 *   "Parent item",
 *   { text: "Item with children", children: ["Child 1", "Child 2"] },
 * ]));
 * // - Parent item
 * // - Item with children
 * //   - Child 1
 * //   - Child 2
 * ```
 */
export function renderList(items: ListItem[]): string {
  const lines: string[] = [];

  const renderItem = (item: ListItem, indent: number): void => {
    const prefix = `${"  ".repeat(indent)}- `;

    if (typeof item === "string") {
      lines.push(prefix + item);
    } else {
      lines.push(prefix + item.text);
      if (item.children) {
        for (const child of item.children) {
          renderItem(child, indent + 1);
        }
      }
    }
  };

  for (const item of items) {
    renderItem(item, 0);
  }

  return lines.join("\n");
}
