/**
 * Schema introspection for CLI commands.
 *
 * Generates machine-readable manifests from the ActionRegistry,
 * enabling agents to discover CLI capabilities without scraping --help.
 *
 * @packageDocumentation
 */

import {
  ACTION_SURFACES,
  type ActionRegistry,
  type ActionSurface,
  type AnyActionSpec,
  DEFAULT_REGISTRY_SURFACES,
  type ErrorCategory,
  exitCodeMap,
  type JsonSchema,
  statusCodeMap,
  zodToJsonSchema,
} from "@outfitter/contracts";
import { Command } from "commander";

// =============================================================================
// Types
// =============================================================================

export interface ActionManifest {
  readonly version: string;
  readonly generatedAt: string;
  readonly surfaces: ActionSurface[];
  readonly actions: ActionManifestEntry[];
  readonly errors: Record<ErrorCategory, { exit: number; http: number }>;
  readonly outputModes: string[];
}

export interface ActionManifestEntry {
  readonly id: string;
  readonly description?: string | undefined;
  readonly surfaces: ActionSurface[];
  readonly input: JsonSchema;
  readonly output?: JsonSchema | undefined;
  readonly cli?: ManifestCliSpec | undefined;
  readonly mcp?: ManifestMcpSpec | undefined;
  readonly api?: ManifestApiSpec | undefined;
}

interface ManifestCliSpec {
  readonly group?: string | undefined;
  readonly command?: string | undefined;
  readonly description?: string | undefined;
  readonly aliases?: readonly string[] | undefined;
  readonly options?: readonly ManifestCliOption[] | undefined;
}

interface ManifestCliOption {
  readonly flags: string;
  readonly description: string;
  readonly defaultValue?: string | boolean | string[] | undefined;
  readonly required?: boolean | undefined;
}

interface ManifestMcpSpec {
  readonly tool?: string | undefined;
  readonly description?: string | undefined;
  readonly deferLoading?: boolean | undefined;
}

interface ManifestApiSpec {
  readonly method?: string | undefined;
  readonly path?: string | undefined;
  readonly tags?: readonly string[] | undefined;
}

export interface GenerateManifestOptions {
  readonly surface?: ActionSurface;
  readonly version?: string;
}

export interface SchemaCommandOptions {
  readonly programName?: string;
}

// =============================================================================
// Manifest Generation
// =============================================================================

type ActionSource = ActionRegistry | readonly AnyActionSpec[];

function isActionRegistry(source: ActionSource): source is ActionRegistry {
  return (
    "list" in source && typeof (source as ActionRegistry).list === "function"
  );
}

const OUTPUT_MODES = ["human", "json", "jsonl", "tree", "table"] as const;

function buildErrorTaxonomy(): Record<
  ErrorCategory,
  { exit: number; http: number }
> {
  const taxonomy = {} as Record<ErrorCategory, { exit: number; http: number }>;
  for (const category of Object.keys(exitCodeMap) as ErrorCategory[]) {
    taxonomy[category] = {
      exit: exitCodeMap[category],
      http: statusCodeMap[category],
    };
  }
  return taxonomy;
}

function actionToManifestEntry(action: AnyActionSpec): ActionManifestEntry {
  const surfaces = [
    ...(action.surfaces ?? DEFAULT_REGISTRY_SURFACES),
  ] as ActionSurface[];

  return {
    id: action.id,
    description: action.description,
    surfaces,
    input: zodToJsonSchema(action.input),
    output: action.output ? zodToJsonSchema(action.output) : undefined,
    cli: action.cli
      ? {
          group: action.cli.group,
          command: action.cli.command,
          description: action.cli.description,
          aliases:
            action.cli.aliases && action.cli.aliases.length > 0
              ? action.cli.aliases
              : undefined,
          options:
            action.cli.options && action.cli.options.length > 0
              ? action.cli.options.map((o) => ({
                  flags: o.flags,
                  description: o.description,
                  defaultValue: o.defaultValue,
                  required: o.required,
                }))
              : undefined,
        }
      : undefined,
    mcp: action.mcp
      ? {
          tool: action.mcp.tool,
          description: action.mcp.description,
          deferLoading: action.mcp.deferLoading,
        }
      : undefined,
    api: action.api
      ? {
          method: action.api.method,
          path: action.api.path,
          tags: action.api.tags,
        }
      : undefined,
  };
}

/**
 * Generate a manifest from an action registry or action array.
 *
 * @param source - ActionRegistry or array of ActionSpec
 * @param options - Filtering and version options
 * @returns The manifest object
 */
export function generateManifest(
  source: ActionSource,
  options?: GenerateManifestOptions
): ActionManifest {
  let actions = isActionRegistry(source) ? source.list() : [...source];

  if (options?.surface) {
    const surface = options.surface;
    actions = actions.filter((action) => {
      const surfaces = action.surfaces ?? DEFAULT_REGISTRY_SURFACES;
      return surfaces.includes(surface);
    });
  }

  const surfaceSet = new Set<ActionSurface>();
  for (const action of actions) {
    for (const s of action.surfaces ?? DEFAULT_REGISTRY_SURFACES) {
      if (ACTION_SURFACES.includes(s)) {
        surfaceSet.add(s);
      }
    }
  }

  return {
    version: options?.version ?? "1.0.0",
    generatedAt: new Date().toISOString(),
    surfaces: [...surfaceSet].sort(),
    actions: actions.map(actionToManifestEntry),
    errors: buildErrorTaxonomy(),
    outputModes: [...OUTPUT_MODES],
  };
}

// =============================================================================
// Human Formatting
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
      const commandPart = action.cli?.command ?? action.id;
      const isBase =
        !commandPart ||
        commandPart.startsWith("[") ||
        commandPart.startsWith("<");
      const displayCommand = isBase
        ? `  ${groupName} ${commandPart ?? ""}`.trimEnd()
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
    const commandPart = entry.cli.command ?? entry.id;
    const fullCommand = group ? `${group} ${commandPart}` : commandPart;
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

// =============================================================================
// Commander Command
// =============================================================================

/**
 * Create a `schema` command for CLI introspection.
 *
 * @param source - ActionRegistry or array of ActionSpec
 * @param options - Command configuration
 * @returns A Commander command instance
 */
export function createSchemaCommand(
  source: ActionSource,
  options?: SchemaCommandOptions
): Command {
  const cmd = new Command("schema")
    .description("Show CLI schema for machine or human consumption")
    .argument("[action]", "Show detail for a specific action")
    .option("--output <mode>", "Output mode (human, json)", "human")
    .option("--surface <name>", "Filter by surface (cli, mcp, api, server)")
    .option("--pretty", "Pretty-print JSON output")
    .action(
      (
        actionArg: string | undefined,
        cmdOptions: {
          output?: string;
          surface?: string;
          pretty?: boolean;
        }
      ) => {
        const manifestOptions: GenerateManifestOptions = {};

        if (cmdOptions.surface) {
          (manifestOptions as { surface?: ActionSurface }).surface =
            cmdOptions.surface as ActionSurface;
        }

        const manifest = generateManifest(source, manifestOptions);

        if (cmdOptions.output === "json") {
          const indent = cmdOptions.pretty ? 2 : undefined;
          process.stdout.write(`${JSON.stringify(manifest, null, indent)}\n`);
          return;
        }

        // Human output
        const programName =
          options?.programName ?? cmd.parent?.name() ?? undefined;
        const output = formatManifestHuman(manifest, programName, actionArg);
        process.stdout.write(`${output}\n`);
      }
    );

  return cmd;
}
