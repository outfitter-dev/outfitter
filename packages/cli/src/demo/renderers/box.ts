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

  return lines.join("\n");
}
