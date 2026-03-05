/**
 * Tool-related type definitions for MCP servers.
 *
 * @packageDocumentation
 */

import type { Handler, OutfitterError } from "@outfitter/contracts";
import type { z } from "zod";

// ============================================================================
// Tool Annotations
// ============================================================================

/**
 * Behavioral hints for MCP tools.
 *
 * Annotations help clients understand tool behavior without invoking them.
 * All fields are optional — only include hints that apply.
 *
 * @see https://spec.modelcontextprotocol.io/specification/2025-03-26/server/tools/#annotations
 */
export interface ToolAnnotations {
  /** When true, the tool may perform destructive operations (e.g., deleting data). */
  destructiveHint?: boolean;

  /** When true, calling the tool multiple times with the same input has the same effect. */
  idempotentHint?: boolean;

  /** When true, the tool may interact with external systems beyond the server. */
  openWorldHint?: boolean;
  /** When true, the tool does not modify any state. */
  readOnlyHint?: boolean;
}

/**
 * Common annotation presets for MCP tools.
 *
 * Use these as a starting point and spread-override individual hints:
 *
 * ```typescript
 * annotations: { ...TOOL_ANNOTATIONS.readOnly, openWorldHint: true }
 * ```
 *
 * For multi-action tools (e.g., a single tool with read and write actions),
 * use the most conservative union of hints — if any action is destructive,
 * mark the whole tool as destructive. Per-action annotations are an MCP spec
 * limitation; presets + spread cover most edge cases.
 */
export const TOOL_ANNOTATIONS: {
  readonly destructive: ToolAnnotations;
  readonly openWorld: ToolAnnotations;
  readonly readOnly: ToolAnnotations;
  readonly write: ToolAnnotations;
  readonly writeIdempotent: ToolAnnotations;
} = {
  /** Read-only, safe to call repeatedly. */
  readOnly: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
  /** Creates or updates state, not destructive. */
  write: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
  },
  /** Idempotent write (PUT-like). */
  writeIdempotent: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
  /** Deletes or permanently modifies data. */
  destructive: {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: true,
    openWorldHint: false,
  },
  /** Interacts with external systems (APIs, network). */
  openWorld: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  },
};

// ============================================================================
// Tool Definition
// ============================================================================

/**
 * Definition of an MCP tool that can be invoked by clients.
 *
 * Tools are the primary way clients interact with MCP servers.
 * Each tool has a name, description, input schema (for validation),
 * and a handler function that processes requests.
 *
 * @typeParam TInput - The validated input type (inferred from Zod schema)
 * @typeParam TOutput - The success output type
 * @typeParam TError - The error type (must extend OutfitterError)
 *
 * @example
 * ```typescript
 * const getUserTool: ToolDefinition<
 *   { userId: string },
 *   { name: string; email: string },
 *   NotFoundError
 * > = {
 *   name: "get-user",
 *   description: "Retrieve a user by ID",
 *   inputSchema: z.object({ userId: z.string().uuid() }),
 *   handler: async (input, ctx) => {
 *     ctx.logger.debug("Fetching user", { userId: input.userId });
 *     const user = await db.users.find(input.userId);
 *     if (!user) {
 *       return Result.err(new NotFoundError({
 *         message: `User ${input.userId} not found`,
 *         resourceType: "user",
 *         resourceId: input.userId,
 *       }));
 *     }
 *     return Result.ok({ name: user.name, email: user.email });
 *   },
 * };
 * ```
 */
export interface ToolDefinition<
  TInput,
  TOutput,
  TError extends OutfitterError = OutfitterError,
> {
  /**
   * Optional behavioral annotations for the tool.
   * Helps clients understand tool behavior without invoking it.
   */
  annotations?: ToolAnnotations;

  /**
   * Whether the tool should be deferred for tool search.
   * Defaults to true for domain tools; core tools set this to false.
   */
  deferLoading?: boolean;

  /**
   * Human-readable description of what the tool does.
   * Shown to clients and used by LLMs to understand tool capabilities.
   */
  description: string;

  /**
   * Handler function that processes the tool invocation.
   * Receives validated input and HandlerContext, returns Result.
   */
  handler: Handler<TInput, TOutput, TError>;

  /**
   * Zod schema for validating and parsing input.
   * The schema defines the expected input structure.
   */
  inputSchema: z.ZodType<TInput>;
  /**
   * Unique tool name (kebab-case recommended).
   * Used by clients to invoke the tool.
   */
  name: string;
}

/**
 * Serialized tool information for MCP protocol.
 * This is the format sent to clients during tool listing.
 */
export interface SerializedTool {
  /** Behavioral annotations for the tool */
  annotations?: ToolAnnotations;

  /** MCP tool-search hint: whether tool is deferred */
  defer_loading?: boolean;

  /** Tool description */
  description: string;

  /** JSON Schema representation of the input schema */
  inputSchema: Record<string, unknown>;
  /** Tool name */
  name: string;
}
