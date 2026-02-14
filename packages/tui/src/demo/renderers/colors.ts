/**
 * Colors demo renderer.
 *
 * @packageDocumentation
 */

import {
  ANSI,
  applyColor,
  type ColorName,
  createTokens,
  resolveTokenColorEnabled,
  type Theme,
} from "@outfitter/cli/colors";
import { hasNoColorEnv, resolveForceColorEnv } from "@outfitter/cli/terminal";
import { getThemeMethodsByCategory } from "../registry.js";
import { demoSection } from "../section.js";
import { getExample } from "../templates.js";
import type { DemoConfig } from "../types.js";

/**
 * Renders the colors demo section.
 */
export function renderColorsDemo(config: DemoConfig, theme: Theme): string {
  const showCode = config.showCode ?? true;
  const tokens = createTokens();
  const colorEnabled = resolveTokenColorEnabled();

  const lines: string[] = [];

  // ==========================================================================
  // Theme Colors Section
  // ==========================================================================
  lines.push(demoSection("Theme Colors (createTheme)", { case: "none" }));
  lines.push("");

  if (showCode) {
    lines.push('import { createTheme } from "@outfitter/cli/render";');
    lines.push("const theme = createTheme();");
    lines.push("");
  }

  const { semantic } = getThemeMethodsByCategory();

  for (const method of semantic) {
    const text = getExample(method as keyof typeof getExample, config.examples);
    const fn = theme[method];
    const output = fn(text as string);
    const code = `theme.${method}("${text}")`;
    lines.push(`${code.padEnd(42)} → ${output}`);
  }

  // ==========================================================================
  // Utility Methods Section
  // ==========================================================================
  lines.push("");
  lines.push(demoSection("Utility Methods"));
  lines.push("");

  const { utility } = getThemeMethodsByCategory();

  for (const method of utility) {
    const text = getExample(method as keyof typeof getExample, config.examples);
    const fn = theme[method];
    const output = fn(text as string);
    const code = `theme.${method}("${text}")`;
    lines.push(`${code.padEnd(42)} → ${output}`);
  }

  // ==========================================================================
  // Direct Colors Section
  // ==========================================================================
  lines.push("");
  lines.push(demoSection("Direct Colors (applyColor)", { case: "none" }));
  lines.push("");

  if (showCode) {
    lines.push('import { applyColor } from "@outfitter/cli/render";');
    lines.push("");
  }

  const colors: ColorName[] = [
    "green",
    "yellow",
    "red",
    "blue",
    "cyan",
    "magenta",
    "gray",
  ];

  for (const color of colors) {
    const code = `applyColor("text", "${color}")`;
    const output = applyColor("text", color);
    lines.push(`${code.padEnd(32)} → ${output}`);
  }

  // ==========================================================================
  // Raw Tokens Section
  // ==========================================================================
  lines.push("");
  lines.push(demoSection("Raw Tokens (createTokens)", { case: "none" }));
  lines.push("");

  if (showCode) {
    lines.push('import { createTokens, ANSI } from "@outfitter/cli/render";');
    lines.push("const t = createTokens();");
    lines.push("");
  }

  // Use string concat to avoid noTemplateCurlyInString lint rule
  const d = "$";
  const tokenExamples: Array<{ code: string; token: string; text: string }> = [
    {
      code: `\`${d}{t.success}Done${d}{ANSI.reset}\``,
      token: tokens.success,
      text: "Done",
    },
    {
      code: `\`${d}{t.error}Fail${d}{ANSI.reset}\``,
      token: tokens.error,
      text: "Fail",
    },
    {
      code: `\`${d}{t.warning}Warn${d}{ANSI.reset}\``,
      token: tokens.warning,
      text: "Warn",
    },
    {
      code: `\`${d}{t.info}Info${d}{ANSI.reset}\``,
      token: tokens.info,
      text: "Info",
    },
  ];

  for (const example of tokenExamples) {
    const reset = example.token ? ANSI.reset : "";
    const output = `${example.token}${example.text}${reset}`;
    lines.push(`${example.code.padEnd(36)} → ${output}`);
  }

  // ==========================================================================
  // Environment Section
  // ==========================================================================
  lines.push("");
  lines.push(demoSection("Environment"));

  const noColor = hasNoColorEnv();
  const forceColor = resolveForceColorEnv();

  let forceColorDisplay: string;
  if (forceColor === true) {
    forceColorDisplay = theme.success("enabled");
  } else if (forceColor === false) {
    forceColorDisplay = theme.error("disabled");
  } else {
    forceColorDisplay = theme.muted("not set");
  }

  lines.push(
    `Colors: ${colorEnabled ? theme.success("enabled") : theme.muted("disabled")} ${theme.muted(colorEnabled ? "(TTY detected)" : "(non-TTY or NO_COLOR set)")}`
  );
  lines.push(
    `NO_COLOR: ${noColor ? theme.warning("set") : theme.muted("not set")}`
  );
  lines.push(`FORCE_COLOR: ${forceColorDisplay}`);

  return lines.join("\n");
}
