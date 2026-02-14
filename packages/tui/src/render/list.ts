/**
 * List rendering utilities.
 *
 * Renders arrays as bullet lists with optional nesting and multiple styles.
 *
 * @packageDocumentation
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Available list styles for {@link renderList}.
 *
 * - `dash`: Uses - character (default)
 * - `bullet`: Uses • character
 * - `number`: Uses 1. for top-level, a. for nested, i. for deeply nested
 * - `checkbox`: Uses ☐ for unchecked, ☑ for checked
 */
export type ListStyle = "dash" | "bullet" | "number" | "checkbox";

/**
 * Options for customizing list rendering.
 *
 * @example
 * ```typescript
 * // Numbered list with custom indent
 * renderList(items, { style: "number", indent: 4 });
 *
 * // Checkbox list with some items checked
 * renderList(items, { style: "checkbox", checked: new Set([1, 3]) });
 * ```
 */
export interface ListOptions {
  /**
   * The list style to use.
   * @default "dash"
   */
  style?: ListStyle;

  /**
   * Indices of checked top-level items (0-indexed) for checkbox style.
   * Only applies to top-level items. For nested items, use the
   * `checked` property on {@link NestedListItem} instead.
   */
  checked?: Set<number>;

  /**
   * Number of spaces per indentation level.
   * @default 2
   */
  indent?: number;
}

/**
 * A list item with optional nested children for {@link renderList}.
 *
 * @example
 * ```typescript
 * const item: NestedListItem = {
 *   text: "Parent item",
 *   children: ["Child 1", "Child 2"],
 * };
 *
 * // Checkbox item with checked state
 * const checkboxItem: NestedListItem = {
 *   text: "Completed task",
 *   checked: true,
 * };
 *
 * // Mixed styles: numbered parent with bullet children
 * const mixedItem: NestedListItem = {
 *   text: "Section 1",
 *   childStyle: "bullet",
 *   children: ["Unordered item A", "Unordered item B"],
 * };
 * ```
 */
export interface NestedListItem {
  /** The text content of this list item */
  text: string;
  /** Optional nested child items (strings or nested items) */
  children?: Array<string | NestedListItem>;
  /** Whether this item is checked (for checkbox style) */
  checked?: boolean;
  /** Override style for children (enables mixed numbered/bullet lists) */
  childStyle?: ListStyle;
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

// ============================================================================
// Helpers
// ============================================================================

/**
 * Converts a number to lowercase letter (1=a, 2=b, etc.)
 */
function toLetter(n: number): string {
  return String.fromCharCode(96 + n); // 96 + 1 = 97 = 'a'
}

/**
 * Converts a number to lowercase roman numeral
 */
function toRoman(n: number): string {
  const numerals: [number, string][] = [
    [10, "x"],
    [9, "ix"],
    [5, "v"],
    [4, "iv"],
    [1, "i"],
  ];
  let result = "";
  let remaining = n;
  for (const [value, symbol] of numerals) {
    while (remaining >= value) {
      result += symbol;
      remaining -= value;
    }
  }
  return result;
}

/**
 * Gets the marker for a list item based on style and depth.
 */
function getMarker(
  style: ListStyle,
  depth: number,
  index: number,
  isChecked: boolean
): string {
  switch (style) {
    case "bullet":
      return "•";
    case "dash":
      return "-";
    case "number":
      if (depth === 0) {
        return `${index + 1}.`;
      }
      if (depth === 1) {
        return `${toLetter(index + 1)}.`;
      }
      return `${toRoman(index + 1)}.`;
    case "checkbox":
      return isChecked ? "☑" : "☐";
    default: {
      // Exhaustiveness check
      const _exhaustive: never = style;
      return _exhaustive;
    }
  }
}

// ============================================================================
// Main Function
// ============================================================================

/**
 * Renders items as a list with optional nesting and multiple styles.
 *
 * Supports both simple string items and nested items with children.
 * The default style uses dash (-) characters.
 *
 * For numbered lists, child items are indented to align with the parent's
 * content (after the marker), creating proper visual hierarchy.
 *
 * @param items - Array of list items (strings or nested items)
 * @param options - Optional configuration for style, checked items, and indent
 * @returns Formatted list string
 *
 * @example
 * ```typescript
 * // Simple dash list (default)
 * console.log(renderList(["First", "Second", "Third"]));
 * // - First
 * // - Second
 * // - Third
 *
 * // Numbered list with nesting
 * console.log(renderList([
 *   { text: "First section", children: [
 *     { text: "Subsection A", children: ["Detail i", "Detail ii"] },
 *   ]},
 * ], { style: "number" }));
 * // 1. First section
 * //    a. Subsection A
 * //       i. Detail i
 * //       ii. Detail ii
 *
 * // Checkbox list
 * console.log(renderList(["Todo 1", "Todo 2"], { style: "checkbox", checked: new Set([1]) }));
 * // ☐ Todo 1
 * // ☑ Todo 2
 * ```
 */
export function renderList(items: ListItem[], options?: ListOptions): string {
  const style = options?.style ?? "dash";
  const checkedSet = options?.checked ?? new Set<number>();
  const baseIndent = options?.indent ?? 2;

  const lines: string[] = [];
  let _globalIndex = 0;

  /**
   * Renders a single item and its children.
   * @param item - The item to render
   * @param currentIndent - The number of spaces to indent this item
   * @param depth - The nesting depth (for marker style selection)
   * @param indexAtDepth - The index within the current depth level
   * @param currentStyle - The style to use for this item
   */
  const renderItem = (
    item: ListItem,
    currentIndent: number,
    depth: number,
    indexAtDepth: number,
    currentStyle: ListStyle
  ): void => {
    const indentStr = " ".repeat(currentIndent);
    const text = typeof item === "string" ? item : item.text;

    // Determine if checked: item property takes precedence, then options set
    // Note: checked option indices refer to top-level items only (depth 0)
    let isChecked = false;
    if (currentStyle === "checkbox") {
      if (typeof item !== "string" && item.checked !== undefined) {
        isChecked = item.checked;
      } else if (depth === 0) {
        // Only apply checked set to top-level items
        isChecked = checkedSet.has(indexAtDepth);
      }
    }

    const marker = getMarker(currentStyle, depth, indexAtDepth, isChecked);
    lines.push(`${indentStr}${marker} ${text}`);
    _globalIndex++;

    // Render children if present
    if (typeof item !== "string" && item.children) {
      // Determine child style: item's childStyle overrides, otherwise inherit
      const childStyle =
        typeof item !== "string" && item.childStyle
          ? item.childStyle
          : currentStyle;

      // For numbered lists, align children with parent's text content
      // For other styles, use fixed indent size
      const childIndent =
        currentStyle === "number"
          ? currentIndent + marker.length + 1
          : currentIndent + baseIndent;

      // When switching styles, reset depth for proper marker selection
      const childDepth = childStyle !== currentStyle ? 0 : depth + 1;

      let childIndex = 0;
      for (const child of item.children) {
        renderItem(child, childIndent, childDepth, childIndex, childStyle);
        childIndex++;
      }
    }
  };

  let topIndex = 0;
  for (const item of items) {
    renderItem(item, 0, 0, topIndex, style);
    topIndex++;
  }

  return lines.join("\n");
}
