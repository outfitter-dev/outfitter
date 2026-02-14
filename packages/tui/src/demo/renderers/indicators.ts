/**
 * Indicators demo renderer.
 *
 * @packageDocumentation
 */

import type { Theme } from "@outfitter/cli/colors";
import {
  getIndicator,
  getProgressIndicator,
  INDICATORS,
} from "../../render/indicators.js";
import { demoSection, demoSubsection } from "../section.js";
import type { DemoConfig } from "../types.js";

/**
 * Renders the indicators demo section.
 */
export function renderIndicatorsDemo(
  config: DemoConfig,
  _theme: Theme
): string {
  const showCode = config.showCode ?? true;

  const lines: string[] = [];

  // ==========================================================================
  // Overview Section
  // ==========================================================================
  lines.push(demoSection("Indicators"));
  lines.push("");

  if (showCode) {
    lines.push(
      'import { getIndicator, getProgressIndicator, INDICATORS } from "@outfitter/cli/render";'
    );
    lines.push("");
  }

  lines.push("Semantic indicators with Unicode and ASCII fallback support.");
  lines.push("");

  // ==========================================================================
  // Status Indicators
  // ==========================================================================
  lines.push(demoSubsection("Status"));
  lines.push("");

  for (const [name, indicator] of Object.entries(INDICATORS.status)) {
    const colorInfo = indicator.color ? ` (${indicator.color})` : "";
    lines.push(
      `  ${indicator.unicode}  ${name.padEnd(10)} → ${indicator.fallback}${colorInfo}`
    );
  }
  lines.push("");

  if (showCode) {
    lines.push(
      'getIndicator("status", "success")  // ' +
        getIndicator("status", "success", true)
    );
    lines.push(
      'getIndicator("status", "error")    // ' +
        getIndicator("status", "error", true)
    );
    lines.push("");
  }

  // ==========================================================================
  // Marker Indicators
  // ==========================================================================
  lines.push(demoSubsection("Markers"));
  lines.push("");

  // Group markers by type for better display
  const markerGroups = {
    Circles: [
      "circle",
      "circleOutline",
      "circleDotted",
      "circleSmall",
      "circleDot",
      "circleDotOutline",
    ],
    Squares: ["square", "squareOutline", "squareSmall", "squareSmallOutline"],
    Lozenges: ["lozenge", "lozengeOutline"],
    Checkboxes: ["checkbox", "checkboxChecked", "checkboxCross"],
    Pointers: ["pointer", "pointerSmall", "dash"],
  };

  for (const [groupName, names] of Object.entries(markerGroups)) {
    lines.push(`  ${groupName}:`);
    for (const name of names) {
      const indicator = INDICATORS.marker[name];
      if (indicator) {
        lines.push(
          `    ${indicator.unicode}  ${name.padEnd(18)} → ${indicator.fallback}`
        );
      }
    }
    lines.push("");
  }

  // ==========================================================================
  // Progress Indicators
  // ==========================================================================
  lines.push(demoSubsection("Progress"));
  lines.push("");

  // Show progress styles visually
  lines.push("  Circle:     ○ ◔ ◑ ◕ ●");
  lines.push("  Vertical:   ▁ ▂ ▃ ▄ ▅ ▆ ▇ █");
  lines.push("  Horizontal: ▏ ▎ ▍ ▌ ▋ ▊ ▉ █");
  lines.push("  Shade:      ░ ▒ ▓");
  lines.push("");

  if (showCode) {
    lines.push("// Get progress indicator by percentage:");
    lines.push(
      'getProgressIndicator("circle", 50, 100)      // ' +
        getProgressIndicator("circle", 50, 100, true)
    );
    lines.push(
      'getProgressIndicator("vertical", 6, 8)      // ' +
        getProgressIndicator("vertical", 6, 8, true)
    );
    lines.push(
      'getProgressIndicator("horizontal", 4, 8)    // ' +
        getProgressIndicator("horizontal", 4, 8, true)
    );
    lines.push(
      'getProgressIndicator("shade", 100, 100)     // ' +
        getProgressIndicator("shade", 100, 100, true)
    );
    lines.push("");
  }

  // ==========================================================================
  // Triangle Indicators
  // ==========================================================================
  lines.push(demoSubsection("Triangles"));
  lines.push("");

  const triangleGroups = {
    Up: ["up", "upSmall", "upOutline"],
    Down: ["down", "downSmall", "downOutline"],
    Left: ["left", "leftSmall", "leftOutline"],
    Right: ["right", "rightSmall", "rightOutline"],
  };

  for (const [groupName, names] of Object.entries(triangleGroups)) {
    const indicators = names
      .map((n) => INDICATORS.triangle[n]?.unicode ?? "")
      .join("  ");
    lines.push(`  ${groupName.padEnd(6)} ${indicators}`);
  }
  lines.push("");

  // ==========================================================================
  // Special Indicators
  // ==========================================================================
  lines.push(demoSubsection("Special"));
  lines.push("");

  for (const [name, indicator] of Object.entries(INDICATORS.special)) {
    lines.push(
      `  ${indicator.unicode}  ${name.padEnd(14)} → ${indicator.fallback}`
    );
  }
  lines.push("");

  // ==========================================================================
  // Directional Indicators
  // ==========================================================================
  lines.push(demoSubsection("Directional"));
  lines.push("");

  for (const [name, indicator] of Object.entries(INDICATORS.directional)) {
    lines.push(
      `  ${indicator.unicode}  ${name.padEnd(16)} → ${indicator.fallback}`
    );
  }
  lines.push("");

  // ==========================================================================
  // Math Indicators
  // ==========================================================================
  lines.push(demoSubsection("Math"));
  lines.push("");

  for (const [name, indicator] of Object.entries(INDICATORS.math)) {
    lines.push(
      `  ${indicator.unicode}  ${name.padEnd(16)} → ${indicator.fallback}`
    );
  }
  lines.push("");

  // ==========================================================================
  // Usage Notes
  // ==========================================================================
  lines.push(demoSubsection("Usage"));
  lines.push("");
  lines.push("• getIndicator(category, name) — auto-detects Unicode support");
  lines.push(
    "• getProgressIndicator(style, current, max) — maps value to step"
  );
  lines.push(
    "• INDICATORS[category][name] — direct access to unicode/fallback"
  );
  lines.push("• Status indicators include semantic color hints");

  return lines.join("\n");
}
