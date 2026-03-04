/**
 * Tier 4: Action graph — builds relationship graphs from `.relatedTo()`
 * declarations and generates success/error hints from graph neighbors.
 *
 * @internal
 */

import type { CLIHint } from "@outfitter/contracts";
import type { Command } from "commander";

import type { RelatedToDeclaration } from "../types.js";
import type { ActionGraph, ActionGraphEdge } from "./hint-types.js";

// =============================================================================
// Graph Construction
// =============================================================================

/**
 * Build an action graph from a Commander program's registered commands.
 *
 * Walks all commands, collecting `.relatedTo()` declarations as edges.
 * Unknown targets produce warnings (not crashes). Self-links and cycles
 * are preserved in the graph — callers handle them during traversal.
 *
 * @param program - The Commander program (root command)
 * @returns An action graph with nodes, edges, and optional warnings
 *
 * @example
 * ```typescript
 * const graph = buildActionGraph(program);
 * // graph.nodes: ["deploy", "status", "rollback"]
 * // graph.edges: [{ from: "deploy", to: "status", description: "Check status" }]
 * ```
 */
export function buildActionGraph(program: Command): ActionGraph {
  const nodes: string[] = [];
  const edges: ActionGraphEdge[] = [];
  const warnings: string[] = [];

  // Collect all command names (recursively) as a set for target validation.
  // Uses full paths (e.g., "check tsdoc") so nested subcommands produce
  // runnable node IDs and valid edge targets.
  const commandNames = new Set<string>();

  function collectCommandNames(cmds: readonly Command[], prefix = ""): void {
    for (const cmd of cmds) {
      const leaf = (cmd as Command).name();
      const fullName = prefix ? `${prefix} ${leaf}` : leaf;
      commandNames.add(fullName);
      // Recurse into subcommands (for group commands like "check tsdoc")
      if (cmd.commands.length > 0) {
        collectCommandNames(cmd.commands, fullName);
      }
    }
  }

  collectCommandNames(program.commands);

  // Walk commands recursively and extract relationship declarations
  function walkCommands(cmds: readonly Command[], prefix = ""): void {
    for (const cmd of cmds) {
      const leaf = (cmd as Command).name();
      const fullName = prefix ? `${prefix} ${leaf}` : leaf;
      nodes.push(fullName);

      const relatedTo = (
        cmd as Command & { __relatedTo?: RelatedToDeclaration[] }
      ).__relatedTo;
      if (relatedTo) {
        for (const decl of relatedTo) {
          const edge: ActionGraphEdge = {
            from: fullName,
            to: decl.target,
            ...(decl.description ? { description: decl.description } : {}),
          };
          edges.push(edge);

          // Warn about unknown targets (but still add the edge)
          if (!commandNames.has(decl.target)) {
            warnings.push(
              `Unknown relationship target "${decl.target}" from command "${fullName}"`
            );
          }
        }
      }

      // Recurse into subcommands (for group commands like "check tsdoc")
      if (cmd.commands.length > 0) {
        walkCommands(cmd.commands, fullName);
      }
    }
  }

  walkCommands(program.commands);

  return {
    nodes,
    edges,
    ...(warnings.length > 0 ? { warnings } : {}),
  };
}

// =============================================================================
// Hint Generation
// =============================================================================

/**
 * Generate tier-4 success hints from action graph neighbors (Tier 4).
 *
 * For a given command, returns CLIHint[] for all outgoing edges in the
 * action graph. Self-links are excluded (they would be confusing as
 * "next action" suggestions).
 *
 * @param graph - The action graph
 * @param commandName - The command that just succeeded
 * @param cliName - CLI name for hint command prefix
 * @returns Array of CLI hints for related next-actions
 *
 * @example
 * ```typescript
 * const hints = graphSuccessHints(graph, "deploy", "my-cli");
 * // [{ description: "Check deployment status", command: "my-cli status" }]
 * ```
 */
export function graphSuccessHints(
  graph: ActionGraph,
  commandName: string,
  cliName?: string
): CLIHint[] {
  const hints: CLIHint[] = [];

  for (const edge of graph.edges) {
    // Only outgoing edges from this command, excluding self-links
    if (edge.from === commandName && edge.to !== commandName) {
      const prefix = cliName ? `${cliName} ` : "";
      const description = edge.description ?? `Run ${edge.to}`;

      hints.push({
        description,
        command: `${prefix}${edge.to}`,
      });
    }
  }

  return hints;
}

/**
 * Generate tier-4 error hints from action graph neighbors (Tier 4).
 *
 * For a given command that failed, returns CLIHint[] for related
 * remediation paths. Self-links are excluded. Error hints use the
 * relationship description as remediation context.
 *
 * @param graph - The action graph
 * @param commandName - The command that failed
 * @param cliName - CLI name for hint command prefix
 * @returns Array of CLI hints for remediation paths
 *
 * @example
 * ```typescript
 * const hints = graphErrorHints(graph, "deploy", "my-cli");
 * // [{ description: "Try: Rollback deployment", command: "my-cli rollback" }]
 * ```
 */
export function graphErrorHints(
  graph: ActionGraph,
  commandName: string,
  cliName?: string
): CLIHint[] {
  const hints: CLIHint[] = [];

  for (const edge of graph.edges) {
    // Only outgoing edges from this command, excluding self-links
    if (edge.from === commandName && edge.to !== commandName) {
      const prefix = cliName ? `${cliName} ` : "";
      const description = edge.description
        ? `Try: ${edge.description}`
        : `Try: ${edge.to}`;

      hints.push({
        description,
        command: `${prefix}${edge.to}`,
      });
    }
  }

  return hints;
}
