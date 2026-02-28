/**
 * @outfitter/testing - testTool()
 *
 * High-level helper for testing MCP tool definitions. Validates input
 * against the tool's schema and invokes the handler with a test context.
 *
 * Enhanced in v0.5 to support full context injection and hints assertion.
 *
 * @packageDocumentation
 */

import {
  type HandlerContext,
  type MCPHint,
  type OutfitterError,
  formatZodIssues,
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
   * @deprecated Use `context.cwd` instead.
   */
  readonly cwd?: string;

  /**
   * Custom environment variables for the handler context.
   * @deprecated Use `context.env` instead.
   */
  readonly env?: Record<string, string | undefined>;

  /**
   * Custom request ID for the handler context.
   * @deprecated Use `context.requestId` instead.
   */
  readonly requestId?: string;

  /**
   * Full HandlerContext overrides.
   *
   * When provided, these values are merged with the default test context.
   * Takes priority over the individual `cwd`, `env`, and `requestId` options.
   *
   * @example
   * ```typescript
   * await testTool(tool, input, {
   *   context: {
   *     requestId: "test-req-001",
   *     cwd: "/test/dir",
   *     logger: createTestLogger(),
   *   },
   * });
   * ```
   */
  readonly context?: Partial<HandlerContext>;

  /**
   * Hint generation function for asserting on hints.
   *
   * When provided, called with the handler's success result and the result
   * is attached to the returned `TestToolResult.hints` for assertion.
   * Returns `MCPHint[]` for MCP tool testing.
   *
   * @example
   * ```typescript
   * const result = await testTool(tool, input, {
   *   hints: (result) => [{
   *     description: "View details",
   *     tool: "get-details",
   *     input: { id: result.id },
   *   }],
   * });
   * expect(result.hints).toHaveLength(1);
   * ```
   */
  readonly hints?: (result: unknown) => MCPHint[];
}

/**
 * Enhanced result from testTool() with optional hints.
 *
 * Extends the base `Result` with a `hints` field that contains
 * generated hints when a `hints` function was provided in options.
 */
export type TestToolResult<TOutput, TError extends OutfitterError> = Result<
  TOutput,
  TError | InstanceType<typeof ValidationError>
> & {
  /**
   * Generated hints from the `hints` option function.
   *
   * Present when `hints` option is provided and the handler succeeds.
   * Undefined when no hints option was given or when hints array is empty.
   */
  readonly hints?: MCPHint[] | undefined;
};

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
 * ### v0.5 Enhancements
 *
 * - **`context`**: Full `HandlerContext` overrides (not just cwd/env/requestId).
 *   Takes priority over individual options.
 * - **`hints`**: Hint generation function for asserting on hints.
 *   When provided, the function is called with the handler's success result
 *   and the generated hints are attached to `result.hints`.
 *
 * @param tool - An MCP tool definition with inputSchema and handler
 * @param input - Raw input to validate and pass to the handler
 * @param options - Optional context overrides and hint function
 * @returns The handler's Result with optional hints, or Err<ValidationError> on schema failure
 *
 * @example
 * ```typescript
 * // Basic usage (backward compatible)
 * const result = await testTool(myTool, { a: 2, b: 3 });
 * expect(result.unwrap().sum).toBe(5);
 *
 * // With full context injection
 * const result = await testTool(myTool, input, {
 *   context: { requestId: "test-001", logger: testLogger },
 * });
 *
 * // With hints assertion
 * const result = await testTool(myTool, input, {
 *   hints: (r) => [{ description: "Next step", tool: "other" }],
 * });
 * expect(result.hints).toHaveLength(1);
 * ```
 */
export async function testTool<TInput, TOutput, TError extends OutfitterError>(
  tool: ToolDefinition<TInput, TOutput, TError>,
  input: unknown,
  options?: TestToolOptions
): Promise<TestToolResult<TOutput, TError>> {
  // Validate input against tool schema
  const parseResult = tool.inputSchema.safeParse(input);

  if (!parseResult.success) {
    const errorMessages = formatZodIssues(parseResult.error.issues);

    return Result.err(
      new ValidationError({
        message: `Invalid input: ${errorMessages}`,
      })
    ) as TestToolResult<TOutput, TError>;
  }

  // Build handler context: context option takes priority over individual options
  const ctxOverrides: Partial<HandlerContext> = {};

  // Apply individual options first (deprecated path)
  if (options?.requestId !== undefined) {
    ctxOverrides.requestId = options.requestId;
  }
  if (options?.cwd !== undefined) {
    ctxOverrides.cwd = options.cwd;
  }
  if (options?.env !== undefined) {
    ctxOverrides.env = options.env;
  }

  // Apply full context overrides (takes priority)
  if (options?.context) {
    Object.assign(ctxOverrides, options.context);
  }

  const ctx = createTestContext(ctxOverrides);

  // Invoke handler exactly once
  const result = await tool.handler(parseResult.data, ctx);

  // Generate hints if a hints function was provided and the result is Ok
  if (options?.hints && result.isOk()) {
    const hints = options.hints(result.value);
    if (hints.length > 0) {
      const enhanced = result as TestToolResult<TOutput, TError>;
      Object.defineProperty(enhanced, "hints", {
        value: hints,
        enumerable: true,
        configurable: true,
        writable: false,
      });
      return enhanced;
    }
  }

  return result as TestToolResult<TOutput, TError>;
}
