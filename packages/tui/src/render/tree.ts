/**
 * Tree rendering utilities.
 *
 * Renders hierarchical data as ASCII trees with box-drawing characters.
 *
 * @packageDocumentation
 */

/**
 * Available tree guide styles.
 *
 * - `single`: Standard Unicode box-drawing (default)
 * - `heavy`: Thick/bold box-drawing characters
 * - `double`: Double-line box-drawing characters
 * - `rounded`: Rounded corners (╰ instead of └)
 */
export type TreeGuideStyle = "single" | "heavy" | "double" | "rounded";

/**
 * Tree guide character sets for different visual styles.
 */
export const TREE_GUIDES: Record<
  TreeGuideStyle,
  { vertical: string; fork: string; end: string }
> = {
  single: { vertical: "│   ", fork: "├── ", end: "└── " },
  heavy: { vertical: "┃   ", fork: "┣━━ ", end: "┗━━ " },
  double: { vertical: "║   ", fork: "╠══ ", end: "╚══ " },
  rounded: { vertical: "│   ", fork: "├── ", end: "╰── " },
};

/**
 * Options for customizing tree rendering.
 */
export interface TreeOptions {
  /**
   * Guide style for tree branches.
   * @default "single"
   */
  guide?: TreeGuideStyle;

  /**
   * Maximum depth to render (1 = root children only).
   * @default undefined (unlimited)
   */
  maxDepth?: number;

  /**
   * Custom function to render node labels.
   * Receives the key, value, and current depth.
   *
   * @example
   * ```typescript
   * renderLabel: (key, value, depth) => {
   *   if (value && typeof value === "object") {
   *     return `📁 ${key}/`;
   *   }
   *   return `📄 ${key}`;
   * }
   * ```
   */
  renderLabel?: (key: string, value: unknown, depth: number) => string;
}

/**
 * Renders hierarchical data as a tree with unicode box-drawing characters.
 *
 * Uses unicode characters for tree structure.
 * Nested objects are rendered as child nodes; leaf values (null, primitives)
 * are rendered as terminal nodes.
 *
 * @param tree - Hierarchical object to render
 * @param options - Customization options
 * @returns Formatted tree string with box-drawing characters
 *
 * @example
 * ```typescript
 * const tree = {
 *   src: {
 *     components: {
 *       Button: null,
 *       Input: null,
 *     },
 *     utils: null,
 *   },
 *   tests: null,
 * };
 *
 * console.log(renderTree(tree));
 * // ├── src
 * // │   ├── components
 * // │   │   ├── Button
 * // │   │   └── Input
 * // │   └── utils
 * // └── tests
 *
 * console.log(renderTree(tree, { guide: "rounded" }));
 * // ├── src
 * // │   ├── components
 * // │   │   ├── Button
 * // │   │   ╰── Input
 * // │   ╰── utils
 * // ╰── tests
 * ```
 */
export function renderTree(
  tree: Record<string, unknown>,
  options?: TreeOptions
): string {
  const guide = TREE_GUIDES[options?.guide ?? "single"];
  const maxDepth = options?.maxDepth;
  const renderLabel = options?.renderLabel ?? ((key: string) => key);
  const lines: string[] = [];

  const renderNode = (
    key: string,
    value: unknown,
    prefix: string,
    isLast: boolean,
    depth: number
  ): void => {
    // Check depth limit before rendering
    if (maxDepth !== undefined && depth >= maxDepth) {
      return;
    }

    const connector = isLast ? guide.end : guide.fork;
    const label = renderLabel(key, value, depth);
    lines.push(prefix + connector + label);

    if (value !== null && typeof value === "object") {
      const entries = Object.entries(value as Record<string, unknown>);
      const childPrefix = prefix + (isLast ? "    " : guide.vertical);

      entries.forEach(([childKey, childValue], index) => {
        const childIsLast = index === entries.length - 1;
        renderNode(childKey, childValue, childPrefix, childIsLast, depth + 1);
      });
    }
  };

  const entries = Object.entries(tree);
  entries.forEach(([key, value], index) => {
    const isLast = index === entries.length - 1;
    renderNode(key, value, "", isLast, 0);
  });

  return lines.join("\n");
}
