/**
 * Borders demo renderer.
 *
 * @packageDocumentation
 */

import { BORDERS, drawHorizontalLine } from "../../render/borders.js";
import type { Theme } from "../../render/colors.js";
import { BORDER_STYLE_META, getBorderStyles } from "../registry.js";
import { demoSection } from "../section.js";
import type { DemoConfig } from "../types.js";

/**
 * Renders the borders demo section.
 */
export function renderBordersDemo(config: DemoConfig, theme: Theme): string {
  const showCode = config.showCode ?? true;
  const showDescriptions = config.showDescriptions ?? true;

  const lines: string[] = [];

  // ==========================================================================
  // Border Styles Section
  // ==========================================================================
  lines.push(demoSection("Border Styles"));
  lines.push("");

  if (showCode) {
    lines.push(
      'import { BORDERS, getBorderCharacters } from "@outfitter/cli/render";'
    );
    lines.push("");
  }

  const styles = getBorderStyles().filter((s) => s !== "none");

  for (const style of styles) {
    const meta = BORDER_STYLE_META[style];
    const chars = BORDERS[style];

    lines.push(`${meta.label.toUpperCase()} (${style})`);
    if (showDescriptions) {
      lines.push(theme.muted(meta.description));
    }
    lines.push("");

    // Draw a small example box
    const width = 20;
    lines.push(drawHorizontalLine(width, chars, "top"));
    lines.push(`${chars.vertical}${" ".repeat(width)}${chars.vertical}`);
    lines.push(
      `${chars.vertical}${"  Content here".padEnd(width)}${chars.vertical}`
    );
    lines.push(`${chars.vertical}${" ".repeat(width)}${chars.vertical}`);
    lines.push(drawHorizontalLine(width, chars, "bottom"));
    lines.push("");
  }

  // ==========================================================================
  // Characters Reference Section
  // ==========================================================================
  lines.push(demoSection("Characters Reference"));
  lines.push("");

  for (const style of styles) {
    const chars = BORDERS[style];
    const meta = BORDER_STYLE_META[style];

    lines.push(`${meta.label}:`);
    const charDisplay = [
      `  Corners: ${chars.topLeft} ${chars.topRight} ${chars.bottomLeft} ${chars.bottomRight}`,
      `  Lines: ${chars.horizontal} ${chars.vertical}`,
      `  T's: ${chars.topT} ${chars.bottomT} ${chars.leftT} ${chars.rightT} Cross: ${chars.cross}`,
    ];
    lines.push(...charDisplay);
    lines.push("");
  }

  return lines.join("\n");
}
