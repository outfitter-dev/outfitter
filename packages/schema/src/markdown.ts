/**
 * Markdown documentation generation from action manifests.
 *
 * Pure formatter: ActionManifest -> markdown string. Transport-agnostic,
 * usable from CLI, build scripts, or CI pipelines. Supports MCP and CLI
 * surfaces with appropriate metadata for each.
 *
 * @packageDocumentation
 */

import type { JsonSchema } from "@outfitter/contracts";
import type {
  ActionManifest,
  ActionManifestEntry,
  ManifestCliSpec,
} from "./manifest.js";

// =============================================================================
// Types
// =============================================================================

type DocSurface = "mcp" | "cli";

const DEFAULT_TITLES: Record<DocSurface, string> = {
  mcp: "MCP Tools Reference",
  cli: "CLI Reference",
};

export interface MarkdownFormatOptions {
  /** Which surface to document. Default: "mcp" */
  readonly surface?: DocSurface;
  /** Document title. Default: surface-specific (e.g., "MCP Tools Reference") */
  readonly title?: string;
  /** Include table of contents. Default: true when 2+ entries */
  readonly toc?: boolean;
  /** Include generated timestamp. Default: true */
  readonly timestamp?: boolean;
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Format an action manifest as a markdown reference document.
 *
 * @param manifest - The manifest to format
 * @param options - Formatting options
 * @returns Formatted markdown string
 */
export function formatManifestMarkdown(
  manifest: ActionManifest,
  options?: MarkdownFormatOptions
): string {
  const surface = options?.surface ?? "mcp";
  const title = options?.title ?? DEFAULT_TITLES[surface];
  const showTimestamp = options?.timestamp ?? true;

  const sections: string[] = [];

  sections.push(
    renderHeader(
      title,
      manifest.version,
      showTimestamp ? manifest.generatedAt : undefined
    )
  );

  // Sort actions alphabetically by display name
  const sorted = [...manifest.actions].sort((a, b) => {
    const nameA = displayName(a, surface);
    const nameB = displayName(b, surface);
    return nameA.localeCompare(nameB);
  });

  if (sorted.length === 0) {
    sections.push("_No tools registered._");
    return sections.join("\n\n");
  }

  // TOC: show by default when 2+ entries, respect explicit option
  const showToc = options?.toc ?? sorted.length >= 2;
  if (showToc) {
    sections.push(renderToc(sorted, surface));
  }

  for (const action of sorted) {
    sections.push(
      surface === "cli" ? renderCliCommand(action) : renderMcpTool(action)
    );
  }

  return `${sections.join("\n\n---\n\n")}\n`;
}

// =============================================================================
// Internal Renderers
// =============================================================================

function renderHeader(
  title: string,
  version: string,
  generatedAt: string | undefined
): string {
  const lines: string[] = [];
  lines.push(`# ${title}`);

  const meta: string[] = [];
  meta.push(`schema v${version}`);
  if (generatedAt) {
    meta.push(generatedAt);
  }
  lines.push("");
  lines.push(`> Generated from ${meta.join(" | ")}`);

  return lines.join("\n");
}

function renderToc(
  actions: ActionManifestEntry[],
  surface: DocSurface
): string {
  const lines: string[] = [];
  lines.push("## Table of Contents");
  lines.push("");
  for (const action of actions) {
    const name = displayName(action, surface);
    lines.push(`- [${name}](#${slugify(name)})`);
  }
  return lines.join("\n");
}

// — MCP rendering —

function renderMcpTool(action: ActionManifestEntry): string {
  const name = displayName(action, "mcp");
  const desc = action.mcp?.description ?? action.description;
  const lines: string[] = [];

  lines.push(`## ${name}`);
  lines.push("");
  if (desc) {
    lines.push(desc);
  }

  if (action.mcp?.deferLoading) {
    lines.push("");
    lines.push("> Deferred loading: must be explicitly loaded before use.");
  }

  lines.push("");
  lines.push("### Parameters");
  lines.push("");
  lines.push(renderSchemaTable(action.input));

  return lines.join("\n");
}

// — CLI rendering —

function renderCliCommand(action: ActionManifestEntry): string {
  const name = displayName(action, "cli");
  const desc = action.cli?.description ?? action.description;
  const lines: string[] = [];

  lines.push(`## ${name}`);
  lines.push("");
  if (desc) {
    lines.push(desc);
  }

  if (action.cli?.aliases && action.cli.aliases.length > 0) {
    lines.push("");
    const aliasStr = action.cli.aliases.map((a) => `\`${a}\``).join(", ");
    lines.push(`**Aliases:** ${aliasStr}`);
  }

  lines.push("");
  lines.push("### Options");
  lines.push("");
  lines.push(renderCliOptionsTable(action.cli));

  return lines.join("\n");
}

function renderCliOptionsTable(cli: ManifestCliSpec | undefined): string {
  const options = cli?.options;
  if (!options || options.length === 0) {
    return "_No options._";
  }

  const lines: string[] = [];
  lines.push("| Flag | Description | Default |");
  lines.push("|------|-------------|---------|");

  for (const opt of options) {
    const defaultStr =
      opt.defaultValue !== undefined
        ? `\`${JSON.stringify(opt.defaultValue)}\``
        : "\u2014";
    lines.push(
      `| \`${escapeMarkdown(opt.flags)}\` | ${escapeMarkdown(opt.description)} | ${defaultStr} |`
    );
  }

  return lines.join("\n");
}

// — Shared rendering —

function renderSchemaTable(schema: JsonSchema): string {
  const properties = schema.properties;
  if (!properties || Object.keys(properties).length === 0) {
    return "_No parameters._";
  }

  const required = new Set(schema.required ?? []);
  const lines: string[] = [];

  lines.push("| Property | Type | Required | Description |");
  lines.push("|----------|------|----------|-------------|");

  for (const [key, prop] of Object.entries(properties)) {
    const typeStr = formatType(prop);
    const isRequired = required.has(key) ? "Yes" : "No";
    const descParts: string[] = [];
    if (prop.description) {
      descParts.push(escapeMarkdown(prop.description));
    }
    if (prop.default !== undefined) {
      descParts.push(`(default: \`${JSON.stringify(prop.default)}\`)`);
    }
    const desc = descParts.join(" ");
    lines.push(`| \`${key}\` | ${typeStr} | ${isRequired} | ${desc} |`);
  }

  return lines.join("\n");
}

// =============================================================================
// Formatting Helpers
// =============================================================================

function formatType(schema: JsonSchema): string {
  if (schema.enum) {
    return schema.enum.map((v) => `\`${JSON.stringify(v)}\``).join(" \\| ");
  }

  if (schema.anyOf) {
    return schema.anyOf.map(formatType).join(" \\| ");
  }

  if (schema.type === "array") {
    const items = schema.items;
    if (items && !Array.isArray(items) && items.type) {
      return `array of ${items.type}`;
    }
    return "array";
  }

  return schema.type ?? "unknown";
}

function escapeMarkdown(text: string): string {
  return text.replace(/\|/g, "\\|");
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-");
}

/** Resolve the display name for an action based on surface. */
function displayName(action: ActionManifestEntry, surface: DocSurface): string {
  if (surface === "cli") {
    const cli = action.cli;
    if (!cli) return action.id;
    const group = cli.group;
    const command = cli.command ?? action.id;
    return group ? `${group} ${command}` : command;
  }

  return action.mcp?.tool ?? action.id;
}
