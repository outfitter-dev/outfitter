/**
 * Hint types for agent-navigable responses.
 *
 * Hints are transport-local suggestions attached to command/tool responses.
 * They guide agents (and humans) toward next actions without coupling
 * handler logic to any specific transport.
 *
 * - {@link ActionHint} — Base hint with description and optional params
 * - {@link CLIHint} — CLI-specific hint with a runnable command
 * - {@link MCPHint} — MCP-specific hint with tool name and optional input
 *
 * @packageDocumentation
 */

/**
 * Base hint type for action responses.
 *
 * Describes a suggested next action with optional structured parameters.
 * Transport-specific hints ({@link CLIHint}, {@link MCPHint}) extend this
 * with transport-appropriate fields.
 *
 * @example
 * ```typescript
 * const hint: ActionHint = {
 *   description: "Retry the operation with a longer timeout",
 *   params: { timeoutMs: 10_000 },
 * };
 * ```
 */
export interface ActionHint {
  /** Human-readable description of the suggested action. */
  description: string;

  /** Optional structured parameters for the suggested action. */
  params?: Record<string, unknown>;
}

/**
 * CLI-specific hint with a runnable command string.
 *
 * Extends {@link ActionHint} with a `command` field that agents or users
 * can execute directly in the terminal.
 *
 * @example
 * ```typescript
 * const hint: CLIHint = {
 *   description: "Fix lint issues automatically",
 *   command: "outfitter lint --fix",
 * };
 * ```
 */
export interface CLIHint extends ActionHint {
  /** CLI command string that can be executed to perform the suggested action. */
  command: string;
}

/**
 * MCP-specific hint with a tool name and optional input.
 *
 * Extends {@link ActionHint} with a `tool` field identifying the MCP tool
 * to invoke, and an optional `input` payload for that tool.
 *
 * @example
 * ```typescript
 * const hint: MCPHint = {
 *   description: "Search for related notes",
 *   tool: "search-notes",
 *   input: { query: "architecture patterns", limit: 5 },
 * };
 * ```
 */
export interface MCPHint extends ActionHint {
  /** MCP tool name to invoke for the suggested action. */
  tool: string;

  /** Optional input payload for the MCP tool. */
  input?: unknown;
}
