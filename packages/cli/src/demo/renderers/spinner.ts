/**
 * Spinner demo renderer.
 *
 * @packageDocumentation
 */

import type { Theme } from "../../render/colors.js";
import {
  getSpinnerFrame,
  renderSpinner,
  SPINNERS,
} from "../../render/spinner.js";
import { getSpinnerStyles, SPINNER_STYLE_META } from "../registry.js";
import { demoSection } from "../section.js";
import { getExample } from "../templates.js";
import type { DemoConfig } from "../types.js";

/**
 * Renders the spinner demo section.
 */
export function renderSpinnerDemo(config: DemoConfig, theme: Theme): string {
  const showCode = config.showCode ?? true;
  const showDescriptions = config.showDescriptions ?? true;

  const lines: string[] = [];

  // ==========================================================================
  // Spinner Styles Section
  // ==========================================================================
  lines.push(demoSection("Spinner Styles"));
  lines.push("");

  if (showCode) {
    lines.push(
      'import { renderSpinner, SPINNERS } from "@outfitter/cli/render";'
    );
    lines.push("");
  }

  const message = getExample("spinnerMessage", config.examples);
  const styles = getSpinnerStyles();

  for (const style of styles) {
    const meta = SPINNER_STYLE_META[style];
    const spinner = SPINNERS[style];

    lines.push(`${meta.label.toUpperCase()} (${style})`);
    if (showDescriptions) {
      lines.push(theme.muted(meta.description));
    }

    // Show all frames in the animation
    const frameDisplay = spinner.frames.join(" ");
    lines.push(`  Frames: ${frameDisplay}`);
    lines.push(`  Interval: ${spinner.interval}ms`);

    // Show example output
    const output = renderSpinner(style, message);
    lines.push(`  Example: ${output}`);
    lines.push("");
  }

  // ==========================================================================
  // Usage Section
  // ==========================================================================
  lines.push(demoSection("Usage"));
  lines.push("");

  if (showCode) {
    lines.push("// Static render (for logs/non-TTY)");
    lines.push(`renderSpinner("dots", "${message}");`);
    lines.push("");
    lines.push("// Get frame at specific time");
    lines.push('getSpinnerFrame("dots", 0);     // First frame');
    lines.push('getSpinnerFrame("dots", 160);   // Third frame');
    lines.push("");
  }

  // Show frame progression
  lines.push("Frame progression (dots style):");
  const dotSpinner = SPINNERS.dots;
  for (let i = 0; i < Math.min(5, dotSpinner.frames.length); i++) {
    const elapsed = i * dotSpinner.interval;
    const frame = getSpinnerFrame("dots", elapsed);
    lines.push(`  ${elapsed}ms → ${frame}`);
  }

  return lines.join("\n");
}
