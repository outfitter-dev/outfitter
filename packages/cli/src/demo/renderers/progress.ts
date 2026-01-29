/**
 * Progress demo renderer.
 *
 * @packageDocumentation
 */

import type { Theme } from "../../render/colors.js";
import { renderProgress } from "../../render/progress.js";
import { demoSection } from "../section.js";
import type { DemoConfig } from "../types.js";

/**
 * Renders the progress demo section.
 */
export function renderProgressDemo(config: DemoConfig, _theme: Theme): string {
  const showCode = config.showCode ?? true;

  const lines: string[] = [];

  // ==========================================================================
  // Basic Progress Section
  // ==========================================================================
  lines.push(demoSection("Basic Progress Bar"));
  lines.push("");

  if (showCode) {
    lines.push('import { renderProgress } from "@outfitter/cli/render";');
    lines.push("");
  }

  const percentages = [0, 25, 50, 75, 100];

  for (const pct of percentages) {
    const bar = renderProgress({ current: pct, total: 100 });
    lines.push(`${pct.toString().padStart(3)}% ${bar}`);
  }
  lines.push("");

  // ==========================================================================
  // With Percentage Display Section
  // ==========================================================================
  lines.push(demoSection("With Percentage Display"));
  lines.push("");

  if (showCode) {
    lines.push(
      "renderProgress({ current: 75, total: 100, showPercent: true })"
    );
    lines.push("");
  }

  lines.push(renderProgress({ current: 75, total: 100, showPercent: true }));
  lines.push("");

  // ==========================================================================
  // Custom Width Section
  // ==========================================================================
  lines.push(demoSection("Custom Width"));
  lines.push("");

  const widths = [10, 20, 30, 40];

  for (const width of widths) {
    if (showCode) {
      lines.push(
        `renderProgress({ current: 50, total: 100, width: ${width} })`
      );
    }
    const bar = renderProgress({ current: 50, total: 100, width });
    lines.push(`  ${bar}`);
    lines.push("");
  }

  // ==========================================================================
  // Edge Cases Section
  // ==========================================================================
  lines.push(demoSection("Edge Cases"));
  lines.push("");

  lines.push("Empty (0%):");
  lines.push(`  ${renderProgress({ current: 0, total: 100 })}`);
  lines.push("");

  lines.push("Full (100%):");
  lines.push(`  ${renderProgress({ current: 100, total: 100 })}`);
  lines.push("");

  lines.push("Over 100% (capped):");
  lines.push(
    `  ${renderProgress({ current: 150, total: 100, showPercent: true })}`
  );
  lines.push("");

  lines.push("Negative (floored to 0%):");
  lines.push(
    `  ${renderProgress({ current: -10, total: 100, showPercent: true })}`
  );

  return lines.join("\n");
}
