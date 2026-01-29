/**
 * Tree demo renderer.
 *
 * @packageDocumentation
 */

import type { Theme } from "../../render/colors.js";
import {
  renderTree,
  TREE_GUIDES,
  type TreeGuideStyle,
} from "../../render/tree.js";
import { getExample } from "../templates.js";
import type { DemoConfig } from "../types.js";

/**
 * Renders the tree demo section.
 */
export function renderTreeDemo(config: DemoConfig, _theme: Theme): string {
  const showCode = config.showCode ?? true;

  const lines: string[] = [];

  // ==========================================================================
  // Basic Tree Section
  // ==========================================================================
  lines.push("BASIC TREE");
  lines.push("==========");
  lines.push("");

  if (showCode) {
    lines.push('import { renderTree } from "@outfitter/cli/tree";');
    lines.push("");
  }

  const treeData = getExample("treeData", config.examples);

  if (showCode) {
    lines.push("renderTree({");
    lines.push("  src: {");
    lines.push("    components: { Button: null, Input: null },");
    lines.push("    utils: null,");
    lines.push("  },");
    lines.push("  tests: null,");
    lines.push("})");
    lines.push("");
  }

  lines.push(renderTree(treeData as Record<string, unknown>));
  lines.push("");

  // ==========================================================================
  // Guide Styles Section
  // ==========================================================================
  lines.push("GUIDE STYLES");
  lines.push("============");
  lines.push("");

  const guideDemo = {
    root: {
      child1: {
        leaf: null,
      },
      child2: null,
    },
  };

  const guideStyles: TreeGuideStyle[] = [
    "single",
    "rounded",
    "heavy",
    "double",
  ];

  for (const style of guideStyles) {
    const guide = TREE_GUIDES[style];
    lines.push(
      `${style.toUpperCase()} (fork: "${guide.fork.trim()}", end: "${guide.end.trim()}")`
    );
    lines.push("");
    lines.push(renderTree(guideDemo, { guide: style }));
    lines.push("");
  }

  // ==========================================================================
  // Max Depth Section
  // ==========================================================================
  lines.push("MAX DEPTH");
  lines.push("=========");
  lines.push("");

  const deepTree = {
    level1: {
      level2: {
        level3: {
          level4: null,
        },
      },
    },
  };

  if (showCode) {
    lines.push("renderTree(tree, { maxDepth: 2 })");
    lines.push("");
  }

  lines.push("Full tree:");
  lines.push(renderTree(deepTree));
  lines.push("");
  lines.push("With maxDepth: 2:");
  lines.push(renderTree(deepTree, { maxDepth: 2 }));
  lines.push("");

  // ==========================================================================
  // Custom Labels Section
  // ==========================================================================
  lines.push("CUSTOM LABELS");
  lines.push("=============");
  lines.push("");

  const fileTree = {
    src: {
      "index.ts": null,
      components: {
        "Button.tsx": null,
      },
    },
    "package.json": null,
  };

  if (showCode) {
    lines.push("renderTree(tree, {");
    lines.push("  renderLabel: (key, value) => {");
    lines.push("    if (value && typeof value === 'object') {");
    // biome-ignore lint/suspicious/noTemplateCurlyInString: code example display
    lines.push("      return `📁 ${key}/`;");
    lines.push("    }");
    // biome-ignore lint/suspicious/noTemplateCurlyInString: code example display
    lines.push("    return `📄 ${key}`;");
    lines.push("  }");
    lines.push("})");
    lines.push("");
  }

  lines.push(
    renderTree(fileTree, {
      renderLabel: (key, value) => {
        if (value && typeof value === "object") {
          return `📁 ${key}/`;
        }
        return `📄 ${key}`;
      },
    })
  );
  lines.push("");

  // ==========================================================================
  // Usage Notes Section
  // ==========================================================================
  lines.push("USAGE NOTES");
  lines.push("===========");
  lines.push("");
  lines.push("• Objects become branches with children");
  lines.push("• null values become leaf nodes (terminal)");
  lines.push("• Use guide option to change visual style");
  lines.push("• Use maxDepth to limit rendering depth");
  lines.push("• Use renderLabel for custom node formatting");

  return lines.join("\n");
}
