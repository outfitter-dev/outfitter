/**
 * Hint generation tiers for agent-navigable CLI responses.
 *
 * Four tiers of hint generation:
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
 * - **Tier 4 (Action Graph)**: Generates success/error hints from `.relatedTo()`
 *   declarations on registered commands.
 *
 * @packageDocumentation
 */

import { unwrapZodField } from "./schema-input.js";

// =============================================================================
// Tier 1: Command Tree Introspection (re-exports)
// =============================================================================

export type {
  CommandTree,
  CommandTreeNode,
  CommandTreeOption,
} from "./internal/hint-types.js";

export {
  buildCommandTree,
  commandTreeHints,
} from "./internal/hint-command-tree.js";

// =============================================================================
// Tier 2: Error Category Mapping (re-exports)
// =============================================================================

export { errorRecoveryHints } from "./internal/hint-error-recovery.js";

// =============================================================================
// Tier 3: Schema-Derived Params (inline — short enough for barrel)
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

// =============================================================================
// Tier 4: Action Graph (re-exports)
// =============================================================================

export type { ActionGraph, ActionGraphEdge } from "./internal/hint-types.js";

export {
  buildActionGraph,
  graphErrorHints,
  graphSuccessHints,
} from "./internal/hint-action-graph.js";
