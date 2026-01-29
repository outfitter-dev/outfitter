/**
 * Default example texts for demos.
 *
 * Provides sensible defaults that CLIs can override via DemoConfig.
 *
 * @packageDocumentation
 */

import type { ExampleTexts } from "./types.js";

/**
 * Default example texts used when no custom examples are provided.
 *
 * These defaults are generic enough to work for any CLI while still
 * being meaningful and demonstrative.
 */
export const DEFAULT_EXAMPLES: ExampleTexts = {
  // Theme semantic colors
  success: "Operation completed",
  warning: "Proceed with caution",
  error: "Something went wrong",
  info: "For your information",
  primary: "Main content",
  secondary: "Supporting text",
  muted: "(optional)",
  accent: "Highlighted item",
  highlight: "Important",
  link: "https://example.com",
  destructive: "Delete forever",
  subtle: "Fine print",

  // Theme utility methods
  bold: "Strong emphasis",
  italic: "Subtle emphasis",
  underline: "Underlined text",
  dim: "De-emphasized",

  // General examples
  boxContent: "Hello, world!",
  boxTitle: "Status",
  spinnerMessage: "Loading...",
  progressLabel: "Progress",
  listItems: ["First item", "Second item", "Third item"],
  tableData: [
    { id: 1, name: "Alice", status: "Active" },
    { id: 2, name: "Bob", status: "Pending" },
  ],
  treeData: {
    src: {
      components: {
        Button: null,
        Input: null,
      },
      utils: null,
    },
    tests: null,
  },
  markdownSample: `# Heading

Some **bold** and *italic* text.

Use \`npm install\` to install.`,
};

/**
 * Resolves example text with custom overrides.
 *
 * @param key - The example text key
 * @param custom - Optional custom examples
 * @returns The example text (custom if provided, default otherwise)
 */
export function getExample<K extends keyof ExampleTexts>(
  key: K,
  custom?: Partial<ExampleTexts>
): ExampleTexts[K] {
  if (custom?.[key] !== undefined) {
    return custom[key] as ExampleTexts[K];
  }
  return DEFAULT_EXAMPLES[key];
}
