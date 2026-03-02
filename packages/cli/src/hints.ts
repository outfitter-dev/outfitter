/**
 * Hint generation tiers for agent-navigable CLI responses.
 *
 * Three tiers of hint generation:
 *
 * - **Tier 1 (Command Tree Introspection)**: Auto-generates CLIHint[] from the
 *   Commander program's registered commands. Useful for "what can I do?" scenarios.
 *
 * - **Tier 2 (Error Category Mapping)**: Produces standard recovery actions per
 *   error type using the enriched ErrorCategory (retryable, jsonRpcCode).
 *
 * - **Tier 3 (Schema-Derived Params)**: Populates hint params from Zod input
 *   schemas, enabling agents to understand expected parameter shapes.
 *
 * @packageDocumentation
 */

import type { CLIHint, ErrorCategory } from "@outfitter/contracts";
import type { Command } from "commander";

import type { CommandMetadata } from "./command.js";
import { unwrapZodField } from "./schema-input.js";

// =============================================================================
// Command Tree Types
// =============================================================================

/**
 * Option metadata in the command tree.
 */
export interface CommandTreeOption {
  /** Commander flag string (e.g., "--limit <n>") */
  readonly flags: string;
  /** Option description */
  readonly description: string;
  /** Default value (absent when no default) */
  readonly defaultValue?: unknown;
  /** Whether the option is required */
  readonly required?: boolean;
}

/**
 * A node in the command tree representing a single command or subcommand.
 */
export interface CommandTreeNode {
  /** Command name */
  readonly name: string;
  /** Command description */
  readonly description?: string;
  /** Safety metadata signals (readOnly, idempotent) */
  readonly metadata?: CommandMetadata;
  /** Available options/flags */
  readonly options?: readonly CommandTreeOption[];
  /** Nested subcommands */
  readonly subcommands?: readonly CommandTreeNode[];
}

/**
 * Full command tree for a CLI application.
 *
 * Used for self-documenting root command output in JSON mode.
 */
export interface CommandTree {
  /** CLI name */
  readonly name: string;
  /** CLI version */
  readonly version: string;
  /** CLI description */
  readonly description?: string;
  /** Top-level commands */
  readonly commands: readonly CommandTreeNode[];
}

// =============================================================================
// Tier 1: Command Tree Introspection
// =============================================================================

/**
 * Build a command tree node from a Commander command.
 */
function buildCommandNode(cmd: Command): CommandTreeNode {
  const options: CommandTreeOption[] = cmd.options
    .filter((opt) => !opt.hidden)
    .map((opt) => {
      const entry: CommandTreeOption = {
        flags: opt.flags,
        description: opt.description,
      };

      if (opt.defaultValue !== undefined) {
        return { ...entry, defaultValue: opt.defaultValue };
      }

      if (opt.required) {
        return { ...entry, required: true };
      }

      return entry;
    });

  const subcommands: CommandTreeNode[] = cmd.commands
    .filter((sub: Command) => !(sub as Command & { _hidden?: boolean })._hidden)
    .map((sub: Command) => buildCommandNode(sub));

  // Read safety metadata from the Commander command (set by CommandBuilder.build())
  const metadata = (cmd as Command & { __metadata?: CommandMetadata })
    .__metadata;

  const node: CommandTreeNode = {
    name: cmd.name(),
  };

  const description = cmd.description();
  if (description) {
    return {
      ...node,
      description,
      ...(metadata ? { metadata } : {}),
      ...(options.length > 0 ? { options } : {}),
      ...(subcommands.length > 0 ? { subcommands } : {}),
    };
  }

  return {
    ...node,
    ...(metadata ? { metadata } : {}),
    ...(options.length > 0 ? { options } : {}),
    ...(subcommands.length > 0 ? { subcommands } : {}),
  };
}

/**
 * Build a structured command tree from a Commander program instance.
 *
 * Recursively walks the program's registered commands, extracting
 * names, descriptions, options, and nested subcommands.
 *
 * @param program - The Commander program (root command)
 * @returns A structured command tree
 *
 * @example
 * ```typescript
 * import { Command } from "commander";
 * import { buildCommandTree } from "@outfitter/cli/hints";
 *
 * const program = new Command("my-cli").version("1.0.0");
 * program.command("list").description("List items");
 *
 * const tree = buildCommandTree(program);
 * // { name: "my-cli", version: "1.0.0", commands: [{ name: "list", description: "List items" }] }
 * ```
 */
export function buildCommandTree(program: Command): CommandTree {
  const version =
    (program as Command & { _version?: string })._version ?? "0.0.0";

  const commands: CommandTreeNode[] = program.commands
    .filter((cmd: Command) => !(cmd as Command & { _hidden?: boolean })._hidden)
    .map((cmd: Command) => buildCommandNode(cmd));

  const description = program.description();

  const tree: CommandTree = {
    name: program.name(),
    version,
    ...(description ? { description } : {}),
    commands,
  };

  return tree;
}

/**
 * Auto-generate CLIHint[] from a command tree (Tier 1).
 *
 * Produces one hint per registered command, including nested subcommands
 * with their full command path.
 *
 * @param tree - The command tree from buildCommandTree()
 * @returns Array of CLI hints for available commands
 *
 * @example
 * ```typescript
 * const tree = buildCommandTree(program);
 * const hints = commandTreeHints(tree);
 * // [{ description: "List items", command: "my-cli list" }, ...]
 * ```
 */
export function commandTreeHints(tree: CommandTree): CLIHint[] {
  const hints: CLIHint[] = [];

  function walkCommands(
    nodes: readonly CommandTreeNode[],
    pathPrefix: string
  ): void {
    for (const node of nodes) {
      const fullCommand = `${pathPrefix} ${node.name}`.trim();
      const description = node.description ?? `Run ${node.name} command`;

      hints.push({ description, command: fullCommand });

      if (node.subcommands && node.subcommands.length > 0) {
        walkCommands(node.subcommands, fullCommand);
      }
    }
  }

  walkCommands(tree.commands, tree.name);

  return hints;
}

// =============================================================================
// Tier 2: Error Category Mapping
// =============================================================================

/**
 * Standard recovery hints for each error category.
 *
 * Maps each ErrorCategory to standard recovery CLIHints using the enriched
 * metadata from OS-347 (retryable flags, JSON-RPC codes).
 */
const CATEGORY_RECOVERY_MAP: Record<
  ErrorCategory,
  (cliName?: string) => CLIHint[]
> = {
  validation: (cliName) => [
    {
      description: "Check input parameters and try again",
      command: cliName ? `${cliName} --help` : "--help",
      params: { retryable: false },
    },
  ],
  not_found: (cliName) => [
    {
      description: "Verify the resource identifier exists",
      command: cliName ? `${cliName} list` : "list",
      params: { retryable: false },
    },
  ],
  conflict: () => [
    {
      description: "Resolve the conflict and retry",
      command: "--force",
      params: { retryable: false },
    },
  ],
  permission: (cliName) => [
    {
      description: "Check your permissions or request access",
      command: cliName ? `${cliName} auth status` : "auth status",
      params: { retryable: false },
    },
  ],
  timeout: (cliName) => [
    {
      description: "Retry the operation — transient timeout may resolve",
      command: cliName ? `${cliName} <previous-command>` : "<previous-command>",
      params: { retryable: true },
    },
  ],
  rate_limit: () => [
    {
      description: "Wait and retry — rate limit will reset",
      command: "<previous-command>",
      params: { retryable: true },
    },
  ],
  network: (cliName) => [
    {
      description: "Retry the operation — network issue may be transient",
      command: cliName ? `${cliName} <previous-command>` : "<previous-command>",
      params: { retryable: true },
    },
  ],
  internal: (cliName) => [
    {
      description: "Report this error — unexpected internal failure",
      command: cliName ? `${cliName} --help` : "--help",
      params: { retryable: false },
    },
  ],
  auth: (cliName) => [
    {
      description: "Authenticate or refresh your credentials",
      command: cliName ? `${cliName} auth login` : "auth login",
      params: { retryable: false },
    },
  ],
  cancelled: () => [
    {
      description: "Operation was cancelled — re-run to try again",
      command: "<previous-command>",
      params: { retryable: false },
    },
  ],
};

/**
 * Produce standard recovery CLIHints for an error category (Tier 2).
 *
 * Uses the enriched ErrorCategory metadata (retryable flags from OS-347)
 * to generate appropriate recovery actions. Retryable categories include
 * retry hints; non-retryable categories guide toward root cause resolution.
 *
 * @param category - The error category
 * @param cliName - Optional CLI name for command hints
 * @returns Array of recovery hints
 *
 * @example
 * ```typescript
 * const hints = errorRecoveryHints("timeout", "my-cli");
 * // [{ description: "Retry the operation — transient timeout may resolve",
 * //    command: "my-cli <previous-command>",
 * //    params: { retryable: true } }]
 * ```
 */
export function errorRecoveryHints(
  category: ErrorCategory,
  cliName?: string
): CLIHint[] {
  const factory = CATEGORY_RECOVERY_MAP[category];
  return factory(cliName);
}

// =============================================================================
// Tier 3: Schema-Derived Params
// =============================================================================

/**
 * Populate hint params from a Zod input schema (Tier 3).
 *
 * Introspects the schema fields and produces a params record where each
 * key is a field name and each value is the field's description (or type
 * name as fallback).
 *
 * Enables agents to understand the expected parameter shapes for a command
 * without needing to parse the schema definition themselves.
 *
 * @param schema - A Zod object schema (or ZodObjectLike)
 * @returns A params record mapping field names to their descriptions/types
 *
 * @example
 * ```typescript
 * const schema = z.object({
 *   env: z.string().describe("Target environment"),
 *   force: z.boolean().describe("Force deployment"),
 * });
 *
 * const params = schemaHintParams(schema);
 * // { env: "Target environment", force: "Force deployment" }
 * ```
 */
export function schemaHintParams(schema: {
  shape: Record<string, unknown>;
}): Record<string, unknown> {
  const params: Record<string, unknown> = {};

  for (const [fieldName, field] of Object.entries(schema.shape)) {
    const info = unwrapZodField(field);
    params[fieldName] = info.description ?? info.baseType;
  }

  return params;
}
