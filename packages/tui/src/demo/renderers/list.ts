/**
 * List demo renderer.
 *
 * @packageDocumentation
 */

import type { Theme } from "@outfitter/cli/colors";
import { renderList } from "../../render/list.js";
import { getListStyles, LIST_STYLE_META } from "../registry.js";
import { demoSection } from "../section.js";
import { getExample } from "../templates.js";
import type { DemoConfig } from "../types.js";

/**
 * Renders the list demo section.
 */
export function renderListDemo(config: DemoConfig, theme: Theme): string {
  const showCode = config.showCode ?? true;
  const showDescriptions = config.showDescriptions ?? true;

  const lines: string[] = [];

  // ==========================================================================
  // List Styles Section
  // ==========================================================================
  lines.push(demoSection("List Styles"));
  lines.push("");

  if (showCode) {
    lines.push('import { renderList } from "@outfitter/cli/render";');
    lines.push("");
  }

  const items = getExample("listItems", config.examples);
  const styles = getListStyles();

  for (const style of styles) {
    const meta = LIST_STYLE_META[style];

    lines.push(`${meta.label.toUpperCase()} STYLE`);
    if (showDescriptions) {
      lines.push(theme.muted(meta.description));
    }
    lines.push("");

    if (showCode) {
      lines.push(`renderList(items, { style: "${style}" })`);
      lines.push("");
    }

    // Checkbox style needs special handling
    if (style === "checkbox") {
      const output = renderList(items, {
        style,
        checked: new Set([1]), // Second item checked
      });
      lines.push(output);
    } else {
      const output = renderList(items, { style });
      lines.push(output);
    }
    lines.push("");
  }

  // ==========================================================================
  // Nested Lists Section
  // ==========================================================================
  lines.push(demoSection("Nested Lists"));
  lines.push("");

  const nestedItems = [
    "Top level item",
    {
      text: "Parent with children",
      children: ["Child one", "Child two"],
    },
    "Another top level",
  ];

  if (showCode) {
    lines.push("renderList([");
    lines.push('  "Top level item",');
    lines.push(
      '  { text: "Parent with children", children: ["Child one", "Child two"] },'
    );
    lines.push('  "Another top level",');
    lines.push("])");
    lines.push("");
  }

  lines.push(renderList(nestedItems));
  lines.push("");

  // ==========================================================================
  // Numbered Nesting Section
  // ==========================================================================
  lines.push(demoSection("Numbered with Nesting"));
  lines.push("");

  const numberedNested = [
    {
      text: "First section",
      children: [
        {
          text: "Subsection A",
          children: ["Detail i", "Detail ii"],
        },
        "Subsection B",
      ],
    },
    "Second section",
  ];

  if (showCode) {
    lines.push('renderList(items, { style: "number" })');
    lines.push("");
  }

  lines.push(renderList(numberedNested, { style: "number" }));
  lines.push("");

  // ==========================================================================
  // Mixed Styles Section
  // ==========================================================================
  lines.push(demoSection("Mixed Styles"));
  lines.push("");

  if (showDescriptions) {
    lines.push(theme.muted("Use childStyle to override style for children"));
    lines.push("");
  }

  const mixedItems = [
    {
      text: "Requirements",
      childStyle: "bullet" as const,
      children: ["Must be fast", "Must be reliable"],
    },
    {
      text: "Tasks",
      childStyle: "checkbox" as const,
      children: [
        { text: "Write tests", checked: true },
        { text: "Deploy to prod", checked: false },
      ],
    },
  ];

  if (showCode) {
    lines.push("renderList([");
    lines.push(
      '  { text: "Requirements", childStyle: "bullet", children: [...] },'
    );
    lines.push('  { text: "Tasks", childStyle: "checkbox", children: [...] },');
    lines.push('], { style: "number" })');
    lines.push("");
  }

  lines.push(renderList(mixedItems, { style: "number" }));

  return lines.join("\n");
}
