/**
 * Tree demo renderer.
 *
 * @packageDocumentation
 */

import type { Theme } from "../../render/colors.js";
import { renderTree } from "../../render/tree.js";
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
    lines.push('import { renderTree } from "@outfitter/cli/render";');
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
  // Deeper Nesting Section
  // ==========================================================================
  lines.push("DEEPER NESTING");
  lines.push("==============");
  lines.push("");

  const deepTree = {
    project: {
      src: {
        components: {
          ui: {
            Button: null,
            Input: null,
            Select: null,
          },
          layout: {
            Header: null,
            Footer: null,
          },
        },
        lib: {
          utils: null,
          helpers: null,
        },
      },
      tests: {
        unit: null,
        integration: null,
      },
    },
  };

  lines.push(renderTree(deepTree));
  lines.push("");

  // ==========================================================================
  // Usage Notes Section
  // ==========================================================================
  lines.push("USAGE NOTES");
  lines.push("===========");
  lines.push("");
  lines.push("• Objects become branches with children");
  lines.push("• null values become leaf nodes (terminal)");
  lines.push("• Uses Unicode box-drawing characters (├── └── │)");
  lines.push("• Keys are displayed as node labels");

  return lines.join("\n");
}
