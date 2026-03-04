/**
 * Tier 1: Command tree introspection — auto-generates CLIHint[] from
 * the Commander program's registered commands.
 *
 * @internal
 */

import type { CLIHint } from "@outfitter/contracts";
import type { Command } from "commander";

import type { CommandMetadata } from "../command.js";
import type {
  CommandTree,
  CommandTreeNode,
  CommandTreeOption,
} from "./hint-types.js";

// =============================================================================
// Helpers
// =============================================================================

function isHiddenCommand(cmd: Command): boolean {
  return (cmd as Command & { hidden?: boolean }).hidden === true;
}

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
    .filter((sub: Command) => !isHiddenCommand(sub))
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

// =============================================================================
// Public API
// =============================================================================

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
  const version = program.version() ?? "0.0.0";

  const commands: CommandTreeNode[] = program.commands
    .filter((cmd: Command) => !isHiddenCommand(cmd))
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
