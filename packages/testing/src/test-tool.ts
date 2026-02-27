/**
 * @outfitter/testing - testTool()
 *
 * High-level helper for testing MCP tool definitions. Validates input
 * against the tool's schema and invokes the handler with a test context.
 *
 * @packageDocumentation
 */

import {
  type HandlerContext,
  type OutfitterError,
  Result,
  ValidationError,
} from "@outfitter/contracts";
import type { ToolDefinition } from "@outfitter/mcp";

import { createTestContext } from "./mock-factories.js";

// ============================================================================
// Types
// ============================================================================

/**
 * Options for testTool().
 */
export interface TestToolOptions {
  /**
   * Custom working directory for the handler context.
   */
  readonly cwd?: string;

  /**
   * Custom environment variables for the handler context.
   */
  readonly env?: Record<string, string | undefined>;

  /**
   * Custom request ID for the handler context.
   */
  readonly requestId?: string;
}

// ============================================================================
// Implementation
// ============================================================================

/**
 * Execute an MCP tool definition with given input.
 *
 * Validates input against the tool's Zod schema. If validation fails,
 * returns an `Err<ValidationError>` without invoking the handler.
 * If validation succeeds, invokes the handler exactly once with a
 * test `HandlerContext` and returns the handler's `Result`.
 *
 * @param tool - An MCP tool definition with inputSchema and handler
 * @param input - Raw input to validate and pass to the handler
 * @param options - Optional context overrides for the handler
 * @returns The handler's Result, or Err<ValidationError> on schema failure
 *
 * @example
 * ```typescript
 * import { defineTool } from "@outfitter/mcp";
 * import { testTool } from "@outfitter/testing";
 * import { z } from "zod";
 * import { Result } from "@outfitter/contracts";
 *
 * const myTool = defineTool({
 *   name: "add",
 *   description: "Add two numbers",
 *   inputSchema: z.object({ a: z.number(), b: z.number() }),
 *   handler: async (input) => Result.ok({ sum: input.a + input.b }),
 * });
 *
 * // Valid input
 * const ok = await testTool(myTool, { a: 2, b: 3 });
 * expect(ok.unwrap().sum).toBe(5);
 *
 * // Invalid input — handler not called
 * const err = await testTool(myTool, { a: "bad" });
 * expect(err.isErr()).toBe(true);
 * ```
 */
export async function testTool<TInput, TOutput, TError extends OutfitterError>(
  tool: ToolDefinition<TInput, TOutput, TError>,
  input: unknown,
  options?: TestToolOptions
): Promise<Result<TOutput, TError | InstanceType<typeof ValidationError>>> {
  // Validate input against tool schema
  const parseResult = tool.inputSchema.safeParse(input);

  if (!parseResult.success) {
    const errorMessages = parseResult.error.issues
      .map(
        (issue: { path: PropertyKey[]; message: string }) =>
          `${issue.path.join(".")}: ${issue.message}`
      )
      .join("; ");

    return Result.err(
      new ValidationError({
        message: `Invalid input: ${errorMessages}`,
      })
    ) as Result<TOutput, TError | InstanceType<typeof ValidationError>>;
  }

  // Build handler context from options
  const ctxOverrides: Partial<HandlerContext> = {};
  if (options?.requestId !== undefined) {
    ctxOverrides.requestId = options.requestId;
  }
  if (options?.cwd !== undefined) {
    ctxOverrides.cwd = options.cwd;
  }
  if (options?.env !== undefined) {
    ctxOverrides.env = options.env;
  }

  const ctx = createTestContext(ctxOverrides);

  // Invoke handler exactly once
  return tool.handler(parseResult.data, ctx);
}
