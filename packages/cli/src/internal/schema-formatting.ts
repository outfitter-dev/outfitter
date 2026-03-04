/**
 * Human-readable formatting for schema manifests.
 *
 * @internal
 */

import type { ActionManifest, ActionManifestEntry } from "@outfitter/schema";

// =============================================================================
// Public API
// =============================================================================

/**
 * Format a manifest for human-readable terminal output.
 *
 * @param manifest - The manifest to format
 * @param programName - CLI program name (for header)
 * @param actionId - If provided, show detail for this single action
 * @returns Formatted string
 */
export function formatManifestHuman(
  manifest: ActionManifest,
  programName?: string,
  actionId?: string
): string {
  if (actionId) {
    return formatActionDetail(manifest, actionId);
  }
  return formatSummary(manifest, programName);
}

// =============================================================================
// Internal Helpers
// =============================================================================

function formatSummary(manifest: ActionManifest, programName?: string): string {
  const lines: string[] = [];
  const name = programName ?? "cli";
  const actionCount = manifest.actions.length;
  const surfaceCount = manifest.surfaces.length;
  const surfaceLabel =
    surfaceCount === 1 ? `${surfaceCount} surface` : `${surfaceCount} surfaces`;

  lines.push(`${name} — ${actionCount} actions across ${surfaceLabel}`);
  lines.push("");

  // Group actions by CLI group
  const grouped = new Map<string, ActionManifestEntry[]>();
  const ungrouped: ActionManifestEntry[] = [];

  for (const action of manifest.actions) {
    const group = action.cli?.group;
    if (group) {
      const existing = grouped.get(group) ?? [];
      existing.push(action);
      grouped.set(group, existing);
    } else {
      ungrouped.push(action);
    }
  }

  // Render grouped commands
  for (const [groupName, groupActions] of grouped.entries()) {
    lines.push(groupName);

    for (const action of groupActions) {
      const commandPart = action.cli?.command ?? "";
      const isBase =
        !commandPart ||
        commandPart.startsWith("[") ||
        commandPart.startsWith("<");
      const displayCommand = isBase
        ? `  ${groupName} ${commandPart}`.trimEnd()
        : `  ${groupName} ${commandPart}`;
      const desc = action.cli?.description ?? action.description ?? "";
      lines.push(padCommand(displayCommand, desc));
    }

    lines.push("");
  }

  // Render ungrouped commands
  for (const action of ungrouped) {
    const commandPart = action.cli?.command ?? action.id;
    const desc = action.cli?.description ?? action.description ?? "";
    lines.push(padCommand(`${commandPart}`, desc));
  }

  lines.push("");
  lines.push("Use --output json for machine-readable format.");
  lines.push("Use --surface <name> to filter (cli, mcp, api, server).");

  return lines.join("\n");
}

function padCommand(command: string, description: string): string {
  const padding = Math.max(1, 32 - command.length);
  return `${command}${" ".repeat(padding)}${description}`;
}

function formatActionDetail(
  manifest: ActionManifest,
  actionId: string
): string {
  const entry = manifest.actions.find((a) => a.id === actionId);
  if (!entry) {
    return `Unknown action: ${actionId}`;
  }

  const lines: string[] = [];
  const desc = entry.cli?.description ?? entry.description ?? "";

  lines.push(`${entry.id} — ${desc}`);
  lines.push("");

  if (entry.cli) {
    const group = entry.cli.group;
    const commandPart = entry.cli.command ?? (group ? "" : entry.id);
    const fullCommand = group
      ? `${group} ${commandPart}`.trimEnd()
      : commandPart;
    lines.push(`  Command:  ${fullCommand}`);
  }

  lines.push(`  Surfaces: ${entry.surfaces.join(", ")}`);

  if (entry.cli?.group) {
    lines.push(`  Group:    ${entry.cli.group}`);
  }

  if (entry.cli?.aliases && entry.cli.aliases.length > 0) {
    lines.push(`  Aliases:  ${entry.cli.aliases.join(", ")}`);
  }

  if (entry.cli?.options && entry.cli.options.length > 0) {
    lines.push("");
    lines.push("  Options:");
    for (const opt of entry.cli.options) {
      const defaultStr =
        opt.defaultValue !== undefined ? ` [${String(opt.defaultValue)}]` : "";
      lines.push(
        padCommand(`    ${opt.flags}`, `${opt.description}${defaultStr}`)
      );
    }
  }

  if (entry.mcp) {
    lines.push("");
    lines.push("  MCP:");
    if (entry.mcp.tool) {
      lines.push(`    Tool: ${entry.mcp.tool}`);
    }
    if (entry.mcp.description) {
      lines.push(`    Description: ${entry.mcp.description}`);
    }
  }

  return lines.join("\n");
}
