/**
 * Colors demo section.
 *
 * Showcases the color system from @outfitter/cli with copy-pasteable examples.
 *
 * @packageDocumentation
 */

import {
  ANSI,
  applyColor,
  createTheme,
  createTokens,
  resolveTokenColorEnabled,
} from "@outfitter/cli/render";
import {
  hasNoColorEnv,
  resolveForceColorEnv,
} from "@outfitter/cli/terminal/detection";
import type { DemoSection } from "./index.js";
import { registerSection } from "./index.js";

/**
 * Renders the colors demo section.
 */
function runColorsDemo(): string {
  const theme = createTheme();
  const tokens = createTokens();
  const colorEnabled = resolveTokenColorEnabled();

  const lines: string[] = [];

  // ==========================================================================
  // Theme Colors Section
  // ==========================================================================
  lines.push("THEME COLORS (createTheme)");
  lines.push("==========================");
  lines.push("");
  lines.push('import { createTheme } from "@outfitter/cli/render";');
  lines.push("const theme = createTheme();");
  lines.push("");

  // Show each theme method with its output
  const themeExamples: Array<{
    code: string;
    fn: (text: string) => string;
    text: string;
  }> = [
    {
      code: 'theme.success("Operation completed")',
      fn: theme.success,
      text: "Operation completed",
    },
    {
      code: 'theme.warning("Proceed with caution")',
      fn: theme.warning,
      text: "Proceed with caution",
    },
    {
      code: 'theme.error("Something went wrong")',
      fn: theme.error,
      text: "Something went wrong",
    },
    {
      code: 'theme.info("For your information")',
      fn: theme.info,
      text: "For your information",
    },
    {
      code: 'theme.muted("(optional)")',
      fn: theme.muted,
      text: "(optional)",
    },
    {
      code: 'theme.primary("Main content")',
      fn: theme.primary,
      text: "Main content",
    },
    {
      code: 'theme.secondary("Supporting text")',
      fn: theme.secondary,
      text: "Supporting text",
    },
  ];

  for (const example of themeExamples) {
    const output = example.fn(example.text);
    lines.push(`${example.code.padEnd(42)} → ${output}`);
  }

  // ==========================================================================
  // Direct Colors Section
  // ==========================================================================
  lines.push("");
  lines.push("DIRECT COLORS (applyColor)");
  lines.push("==========================");
  lines.push("");
  lines.push('import { applyColor } from "@outfitter/cli/render";');
  lines.push("");

  const colors: Array<{
    name: string;
    color: Parameters<typeof applyColor>[1];
  }> = [
    { name: "green", color: "green" },
    { name: "yellow", color: "yellow" },
    { name: "red", color: "red" },
    { name: "blue", color: "blue" },
    { name: "cyan", color: "cyan" },
    { name: "magenta", color: "magenta" },
    { name: "gray", color: "gray" },
  ];

  for (const { name, color } of colors) {
    const code = `applyColor("text", "${name}")`;
    const output = applyColor("text", color);
    lines.push(`${code.padEnd(32)} → ${output}`);
  }

  // ==========================================================================
  // Raw Tokens Section
  // ==========================================================================
  lines.push("");
  lines.push("RAW TOKENS (createTokens)");
  lines.push("=========================");
  lines.push("");
  lines.push('import { createTokens, ANSI } from "@outfitter/cli/render";');
  lines.push("const t = createTokens();");
  lines.push("");

  // Show raw token usage
  // Note: Using string concat to avoid noTemplateCurlyInString lint rule
  const d = "$"; // dollar sign for template literal examples
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
    // Only include reset if colors are enabled (token is non-empty)
    const reset = example.token ? ANSI.reset : "";
    const output = `${example.token}${example.text}${reset}`;
    lines.push(`${example.code.padEnd(36)} → ${output}`);
  }

  // ==========================================================================
  // Environment Section
  // ==========================================================================
  lines.push("");
  lines.push("ENVIRONMENT");
  lines.push("===========");

  const noColor = hasNoColorEnv();
  const forceColor = resolveForceColorEnv();

  // Format FORCE_COLOR display (avoid nested ternary)
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

// Register the colors section
registerSection({
  id: "colors",
  description: "Color palette and theme demonstration",
  run: runColorsDemo,
} satisfies DemoSection);

export { runColorsDemo };
