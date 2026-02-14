/**
 * Table demo renderer.
 *
 * @packageDocumentation
 */

import type { Theme } from "@outfitter/cli/colors";
import { renderTable } from "../../render/table.js";
import { BORDER_STYLE_META, getBorderStyles } from "../registry.js";
import { demoSection } from "../section.js";
import { getExample } from "../templates.js";
import type { DemoConfig } from "../types.js";

/**
 * Renders the table demo section.
 */
export function renderTableDemo(config: DemoConfig, theme: Theme): string {
  const showCode = config.showCode ?? true;
  const showDescriptions = config.showDescriptions ?? true;

  const lines: string[] = [];

  // ==========================================================================
  // Basic Table Section
  // ==========================================================================
  lines.push(demoSection("Basic Table"));
  lines.push("");

  if (showCode) {
    lines.push('import { renderTable } from "@outfitter/cli/render";');
    lines.push("");
    lines.push("renderTable([");
    lines.push('  { id: 1, name: "Alice", status: "Active" },');
    lines.push('  { id: 2, name: "Bob", status: "Pending" },');
    lines.push("])");
    lines.push("");
  }

  const basicData = getExample("tableData", config.examples);
  lines.push(renderTable(basicData));

  // ==========================================================================
  // Custom Headers Section
  // ==========================================================================
  lines.push("");
  lines.push(demoSection("Custom Headers"));
  lines.push("");

  if (showCode) {
    lines.push("renderTable(data, {");
    lines.push('  headers: { id: "Task ID", name: "Assignee" }');
    lines.push("})");
    lines.push("");
  }

  lines.push(
    renderTable(basicData, {
      headers: { id: "Task ID", name: "Assignee" },
    })
  );

  // ==========================================================================
  // Border Styles Section
  // ==========================================================================
  lines.push("");
  lines.push(demoSection("Border Styles"));
  lines.push("");

  const styles = getBorderStyles().filter((s) => s !== "none");
  const smallData = [
    { id: 1, name: "Alice" },
    { id: 2, name: "Bob" },
  ];

  for (const style of styles) {
    const meta = BORDER_STYLE_META[style];

    lines.push(`${meta.label.toUpperCase()} (border: "${style}")`);
    if (showDescriptions) {
      lines.push(theme.muted(meta.description));
    }
    lines.push("");
    lines.push(renderTable(smallData, { border: style }));
    lines.push("");
  }

  // ==========================================================================
  // Compact Mode Section
  // ==========================================================================
  lines.push(demoSection("Compact Mode"));
  lines.push("");

  if (showCode) {
    lines.push("renderTable(data, { compact: true })");
    lines.push("");
  }

  lines.push(renderTable(smallData, { compact: true }));
  lines.push("");
  lines.push(
    theme.muted("Compact mode removes borders and uses space separators.")
  );

  // ==========================================================================
  // Wide Characters Section
  // ==========================================================================
  lines.push("");
  lines.push(demoSection("Wide Characters (CJK/Emoji)"));
  lines.push("");

  if (showCode) {
    lines.push("renderTable([");
    lines.push('  { id: 1, name: "山田太郎", status: "完了" },');
    lines.push('  { id: 2, name: "Party 🎉", status: "🚀" },');
    lines.push("])");
    lines.push("");
  }

  const wideData = [
    { id: 1, name: "山田太郎", status: "完了" },
    { id: 2, name: "Party 🎉", status: "🚀" },
  ];
  lines.push(renderTable(wideData));

  lines.push("");
  lines.push(
    theme.muted("Uses Bun.stringWidth() for correct column alignment.")
  );

  return lines.join("\n");
}
