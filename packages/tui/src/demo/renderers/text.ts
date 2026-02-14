/**
 * Text utilities demo renderer.
 *
 * @packageDocumentation
 */

import type { Theme } from "@outfitter/cli/colors";
import {
  getStringWidth,
  padText,
  pluralize,
  slugify,
  truncateText,
  wrapText,
} from "@outfitter/cli/text";
import { demoSection } from "../section.js";
import type { DemoConfig } from "../types.js";

/**
 * Renders the text utilities demo section.
 */
export function renderTextDemo(config: DemoConfig, theme: Theme): string {
  const showCode = config.showCode ?? true;

  const lines: string[] = [];

  // ==========================================================================
  // String Width Section
  // ==========================================================================
  lines.push(demoSection("String Width"));
  lines.push("");

  if (showCode) {
    lines.push('import { getStringWidth } from "@outfitter/cli/render";');
    lines.push("");
  }

  const widthExamples = [
    { text: "Hello", expected: 5 },
    { text: "你好", expected: 4 },
    { text: "🎉", expected: 2 },
    { text: "\x1b[32mGreen\x1b[0m", expected: 5 },
  ];

  for (const ex of widthExamples) {
    const width = getStringWidth(ex.text);
    const display = ex.text.includes("\x1b")
      ? '"\\x1b[32mGreen\\x1b[0m"'
      : `"${ex.text}"`;
    lines.push(`getStringWidth(${display.padEnd(24)}) → ${width}`);
  }
  lines.push("");
  lines.push(theme.muted("Correctly handles CJK, emoji, and ANSI codes."));
  lines.push("");

  // ==========================================================================
  // Text Wrapping Section
  // ==========================================================================
  lines.push(demoSection("Text Wrapping"));
  lines.push("");

  if (showCode) {
    lines.push('import { wrapText } from "@outfitter/cli/render";');
    lines.push("");
  }

  const longText =
    "This is a long sentence that should be wrapped at the specified width.";

  if (showCode) {
    lines.push(`wrapText("${longText}", 30)`);
    lines.push("");
  }

  lines.push("Result:");
  const wrapped = wrapText(longText, 30);
  for (const line of wrapped.split("\n")) {
    lines.push(`  │${line}│`);
  }
  lines.push("");

  // ==========================================================================
  // Truncation Section
  // ==========================================================================
  lines.push(demoSection("Truncation"));
  lines.push("");

  if (showCode) {
    lines.push('import { truncateText } from "@outfitter/cli/render";');
    lines.push("");
  }

  const truncExamples = [
    { text: "Hello World", width: 8 },
    { text: "Short", width: 10 },
    { text: "Very long text that will be truncated", width: 15 },
  ];

  for (const ex of truncExamples) {
    const result = truncateText(ex.text, ex.width);
    lines.push(`truncateText("${ex.text}", ${ex.width})`);
    lines.push(`  → "${result}"`);
    lines.push("");
  }

  // ==========================================================================
  // Padding Section
  // ==========================================================================
  lines.push(demoSection("Padding"));
  lines.push("");

  if (showCode) {
    lines.push('import { padText } from "@outfitter/cli/render";');
    lines.push("");
  }

  const padExamples = ["Hi", "Hello", "Greetings"];
  for (const text of padExamples) {
    const padded = padText(text, 15);
    lines.push(`padText("${text}", 15) → "${padded}"`);
  }
  lines.push("");

  // ==========================================================================
  // Pluralize Section
  // ==========================================================================
  lines.push(demoSection("Pluralize"));
  lines.push("");

  if (showCode) {
    lines.push('import { pluralize } from "@outfitter/cli/render";');
    lines.push("");
  }

  const pluralExamples = [
    { count: 0, word: "item" },
    { count: 1, word: "item" },
    { count: 5, word: "item" },
    { count: 1, word: "child", plural: "children" },
    { count: 3, word: "child", plural: "children" },
  ];

  for (const ex of pluralExamples) {
    const result = pluralize(ex.count, ex.word, ex.plural);
    const code = ex.plural
      ? `pluralize(${ex.count}, "${ex.word}", "${ex.plural}")`
      : `pluralize(${ex.count}, "${ex.word}")`;
    lines.push(`${code.padEnd(40)} → "${result}"`);
  }
  lines.push("");

  // ==========================================================================
  // Slugify Section
  // ==========================================================================
  lines.push(demoSection("Slugify"));
  lines.push("");

  if (showCode) {
    lines.push('import { slugify } from "@outfitter/cli/render";');
    lines.push("");
  }

  const slugExamples = [
    "Hello World!",
    "This & That",
    "  Multiple   Spaces  ",
    "CamelCase",
  ];

  for (const text of slugExamples) {
    const result = slugify(text);
    lines.push(`slugify("${text}")`);
    lines.push(`  → "${result}"`);
    lines.push("");
  }

  return lines.join("\n");
}
