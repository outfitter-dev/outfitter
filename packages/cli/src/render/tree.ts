/**
 * Tree rendering utilities.
 *
 * Renders hierarchical data as ASCII trees with box-drawing characters.
 *
 * @packageDocumentation
 */

/**
 * Renders hierarchical data as a tree with unicode box-drawing characters.
 *
 * Uses unicode characters (not, not, |, -) for tree structure.
 * Nested objects are rendered as child nodes; leaf values (null, primitives)
 * are rendered as terminal nodes.
 *
 * @param tree - Hierarchical object to render
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
 * // +-- src
 * // |   +-- components
 * // |   |   +-- Button
 * // |   |   L-- Input
 * // |   L-- utils
 * // L-- tests
 * ```
 */
export function renderTree(tree: Record<string, unknown>): string {
  const lines: string[] = [];

  const renderNode = (
    key: string,
    value: unknown,
    prefix: string,
    isLast: boolean
  ): void => {
    const connector = isLast ? "\u2514\u2500\u2500 " : "\u251C\u2500\u2500 ";
    lines.push(prefix + connector + key);

    if (value !== null && typeof value === "object") {
      const entries = Object.entries(value as Record<string, unknown>);
      const childPrefix = prefix + (isLast ? "    " : "\u2502   ");

      entries.forEach(([childKey, childValue], index) => {
        const childIsLast = index === entries.length - 1;
        renderNode(childKey, childValue, childPrefix, childIsLast);
      });
    }
  };

  const entries = Object.entries(tree);
  entries.forEach(([key, value], index) => {
    const isLast = index === entries.length - 1;
    renderNode(key, value, "", isLast);
  });

  return lines.join("\n");
}
