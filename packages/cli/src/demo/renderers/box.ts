/**
 * Box demo renderer.
 *
 * @packageDocumentation
 */

import { renderBox } from "../../render/box.js";
import type { Theme } from "../../render/colors.js";
import { BORDER_STYLE_META, getBorderStyles } from "../registry.js";
import { getExample } from "../templates.js";
import type { DemoConfig } from "../types.js";

/**
 * Renders the box demo section.
 */
export function renderBoxDemo(config: DemoConfig, theme: Theme): string {
  const showCode = config.showCode ?? true;
  const showDescriptions = config.showDescriptions ?? true;

  const lines: string[] = [];

  // ==========================================================================
  // Basic Box Section
  // ==========================================================================
  lines.push("BASIC BOX");
  lines.push("=========");
  lines.push("");

  if (showCode) {
    lines.push('import { renderBox } from "@outfitter/cli/render";');
    lines.push("");
  }

  const content = getExample("boxContent", config.examples);

  if (showCode) {
    lines.push(`renderBox("${content}")`);
    lines.push("");
  }

  lines.push(renderBox(content));
  lines.push("");

  // ==========================================================================
  // Box with Title Section
  // ==========================================================================
  lines.push("BOX WITH TITLE");
  lines.push("==============");
  lines.push("");

  const title = getExample("boxTitle", config.examples);

  if (showCode) {
    lines.push(`renderBox("${content}", { title: "${title}" })`);
    lines.push("");
  }

  lines.push(renderBox(content, { title }));
  lines.push("");

  // ==========================================================================
  // Border Styles Section
  // ==========================================================================
  lines.push("BORDER STYLES");
  lines.push("=============");
  lines.push("");

  const styles = getBorderStyles().filter((s) => s !== "none");

  for (const style of styles) {
    const meta = BORDER_STYLE_META[style];

    lines.push(`${meta.label.toUpperCase()}`);
    if (showDescriptions) {
      lines.push(theme.muted(meta.description));
    }
    lines.push("");

    lines.push(renderBox("Content", { border: style }));
    lines.push("");
  }

  // ==========================================================================
  // Alignment Section
  // ==========================================================================
  lines.push("ALIGNMENT");
  lines.push("=========");
  lines.push("");

  const alignments: Array<"left" | "center" | "right"> = [
    "left",
    "center",
    "right",
  ];

  for (const align of alignments) {
    if (showCode) {
      lines.push(`renderBox("${align}", { width: 30, align: "${align}" })`);
    }
    lines.push(renderBox(align, { width: 30, align }));
    lines.push("");
  }

  // ==========================================================================
  // Multi-line Content Section
  // ==========================================================================
  lines.push("MULTI-LINE CONTENT");
  lines.push("==================");
  lines.push("");

  const multiLine = ["Line one", "Line two", "Line three"];

  if (showCode) {
    lines.push('renderBox(["Line one", "Line two", "Line three"])');
    lines.push("");
  }

  lines.push(renderBox(multiLine));
  lines.push("");

  // ==========================================================================
  // Sections with Dividers
  // ==========================================================================
  lines.push("SECTIONS WITH DIVIDERS");
  lines.push("======================");
  lines.push("");

  if (showDescriptions) {
    lines.push(
      theme.muted("Use sections to separate content with internal dividers.")
    );
    lines.push("");
  }

  if (showCode) {
    lines.push('renderBox("", {');
    lines.push('  sections: ["Header", ["Line 1", "Line 2"], "Footer"],');
    lines.push('  border: "rounded",');
    lines.push("})");
    lines.push("");
  }

  lines.push(
    renderBox("", {
      sections: ["Header", ["Line 1", "Line 2"], "Footer"],
      border: "rounded",
    })
  );
  lines.push("");

  // Status panel example
  if (showDescriptions) {
    lines.push(theme.muted("Example: Status panel with sections"));
    lines.push("");
  }

  if (showCode) {
    lines.push('renderBox("", {');
    lines.push("  sections: [");
    lines.push('    "System Status",');
    lines.push('    ["CPU: 45%", "Memory: 2.1 GB", "Disk: 120 GB free"],');
    lines.push('    "Updated: 2 min ago"');
    lines.push("  ],");
    lines.push('  border: "single",');
    lines.push("  width: 30,");
    lines.push("})");
    lines.push("");
  }

  lines.push(
    renderBox("", {
      sections: [
        "System Status",
        ["CPU: 45%", "Memory: 2.1 GB", "Disk: 120 GB free"],
        "Updated: 2 min ago",
      ],
      border: "single",
      width: 30,
    })
  );

  return lines.join("\n");
}
