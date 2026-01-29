/**
 * Markdown demo renderer.
 *
 * @packageDocumentation
 */

import type { Theme } from "../../render/colors.js";
import { renderMarkdown } from "../../render/markdown.js";
import { demoSection } from "../section.js";
import { getExample } from "../templates.js";
import type { DemoConfig } from "../types.js";

/**
 * Renders the markdown demo section.
 */
export function renderMarkdownDemo(config: DemoConfig, theme: Theme): string {
  const showCode = config.showCode ?? true;

  const lines: string[] = [];

  // ==========================================================================
  // Basic Markdown Section
  // ==========================================================================
  lines.push(demoSection("Markdown Rendering"));
  lines.push("");

  if (showCode) {
    lines.push('import { renderMarkdown } from "@outfitter/cli/render";');
    lines.push("");
  }

  const sample = getExample("markdownSample", config.examples);

  lines.push("Input:");
  lines.push(theme.muted("─".repeat(40)));
  for (const line of sample.split("\n")) {
    lines.push(theme.muted(line));
  }
  lines.push(theme.muted("─".repeat(40)));
  lines.push("");

  lines.push("Output:");
  lines.push("─".repeat(40));
  lines.push(renderMarkdown(sample));
  lines.push("─".repeat(40));
  lines.push("");

  // ==========================================================================
  // Supported Elements Section
  // ==========================================================================
  lines.push(demoSection("Supported Elements"));
  lines.push("");

  const elements = [
    {
      name: "Headings",
      markdown: "# Heading 1\n## Heading 2",
      desc: "Rendered bold",
    },
    { name: "Bold", markdown: "**bold text**", desc: "Rendered bold" },
    { name: "Italic", markdown: "*italic text*", desc: "Rendered italic" },
    { name: "Inline code", markdown: "`code`", desc: "Rendered cyan" },
    {
      name: "Code block",
      markdown: "```\ncode block\n```",
      desc: "Rendered dim",
    },
  ];

  for (const el of elements) {
    lines.push(`${el.name}:`);
    lines.push(theme.muted(`  ${el.desc}`));
    lines.push(`  Input: ${el.markdown.replace(/\n/g, "\\n")}`);
    lines.push(`  Output: ${renderMarkdown(el.markdown).replace(/\n/g, " ")}`);
    lines.push("");
  }

  // ==========================================================================
  // Color Support Section
  // ==========================================================================
  lines.push(demoSection("Color Support"));
  lines.push("");
  lines.push("• Colors applied when terminal supports ANSI");
  lines.push("• Respects NO_COLOR environment variable");
  lines.push("• Markdown syntax stripped when colors disabled");

  return lines.join("\n");
}
