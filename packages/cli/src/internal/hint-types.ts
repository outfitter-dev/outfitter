/**
 * Shared type definitions for the hint generation system.
 *
 * @internal
 */

import type { CommandMetadata } from "../command.js";

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
// Action Graph Types
// =============================================================================

/**
 * An edge in the action graph representing a relationship between commands.
 */
export interface ActionGraphEdge {
  /** Source command name */
  readonly from: string;
  /** Target command name */
  readonly to: string;
  /** Relationship description (if provided) */
  readonly description?: string;
}

/**
 * An action graph built from `.relatedTo()` declarations on registered commands.
 *
 * Nodes are command names, edges are relationship declarations.
 * Used for tier-4 hint generation — success hints include next-actions
 * from graph neighbors, error hints include remediation paths.
 */
export interface ActionGraph {
  /** All registered command names */
  readonly nodes: readonly string[];
  /** Relationship edges between commands */
  readonly edges: readonly ActionGraphEdge[];
  /** Warnings for invalid references (e.g., unknown targets) */
  readonly warnings?: readonly string[];
}
