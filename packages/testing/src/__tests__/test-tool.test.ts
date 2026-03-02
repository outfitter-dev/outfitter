/**
 * @outfitter/testing - testTool() Test Suite
 *
 * Verifies testTool() executes MCP tool definitions with schema
 * validation: invalid input returns error without invoking handler,
 * valid input invokes handler exactly once.
 */

import { describe, expect, it } from "bun:test";

import { Result, type OutfitterError } from "@outfitter/contracts";
import { defineTool } from "@outfitter/mcp";
import { z } from "zod";

import { testTool } from "../test-tool.js";

// ============================================================================
// Test Tools
// ============================================================================

const echoTool = defineTool({
  name: "echo",
  description: "Echo the input message back",
  inputSchema: z.object({ message: z.string() }),
  handler: async (input) => Result.ok({ echo: input.message }),
});

const failTool = defineTool({
  name: "fail",
  description: "Always fails with an error",
  inputSchema: z.object({ reason: z.string() }),
  handler: async (input) => {
    const err = {
      _tag: "NotFoundError" as const,
      message: input.reason,
      category: "not_found" as const,
      name: "NotFoundError",
    } satisfies OutfitterError;
    return Result.err(err);
  },
});

// ============================================================================
// Tests
// ============================================================================

describe("testTool()", () => {
  it("returns Ok result for valid input", async () => {
    const result = await testTool(echoTool, { message: "hello" });

    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toEqual({ echo: "hello" });
  });

  it("returns error for invalid input without calling handler", async () => {
    let handlerCalled = false;
    const tool = defineTool({
      name: "tracked",
      description: "Tracks handler invocations",
      inputSchema: z.object({ count: z.number().min(0) }),
      handler: async (input) => {
        handlerCalled = true;
        return Result.ok({ doubled: input.count * 2 });
      },
    });

    const result = await testTool(tool, { count: "not-a-number" });

    expect(result.isErr()).toBe(true);
    expect(handlerCalled).toBe(false);
  });

  it("returns error with validation details for schema mismatch", async () => {
    const result = await testTool(echoTool, { message: 123 });

    expect(result.isErr()).toBe(true);
    expect(result.error.category).toBe("validation");
  });

  it("returns error for missing required fields", async () => {
    const result = await testTool(echoTool, {});

    expect(result.isErr()).toBe(true);
    expect(result.error.category).toBe("validation");
  });

  it("calls handler exactly once for valid input", async () => {
    let callCount = 0;
    const tool = defineTool({
      name: "counter",
      description: "Counts invocations",
      inputSchema: z.object({ value: z.string() }),
      handler: async (input) => {
        callCount++;
        return Result.ok({ received: input.value });
      },
    });

    await testTool(tool, { value: "test" });

    expect(callCount).toBe(1);
  });

  it("returns handler error for error results", async () => {
    const result = await testTool(failTool, { reason: "missing data" });

    expect(result.isErr()).toBe(true);
    expect(result.error.category).toBe("not_found");
    expect(result.error.message).toBe("missing data");
  });

  it("provides a HandlerContext to the handler", async () => {
    let receivedCtx: unknown = null;
    const tool = defineTool({
      name: "ctx-check",
      description: "Checks handler context",
      inputSchema: z.object({}),
      handler: async (_input, ctx) => {
        receivedCtx = ctx;
        return Result.ok({ ok: true });
      },
    });

    await testTool(tool, {});

    expect(receivedCtx).not.toBeNull();
    const ctx = receivedCtx as {
      requestId: string;
      logger: unknown;
      cwd: string;
    };
    expect(ctx.requestId).toBeDefined();
    expect(ctx.logger).toBeDefined();
    expect(ctx.cwd).toBeDefined();
  });

  it("accepts custom context overrides via options", async () => {
    let receivedRequestId = "";
    const tool = defineTool({
      name: "ctx-override",
      description: "Checks context overrides",
      inputSchema: z.object({}),
      handler: async (_input, ctx) => {
        receivedRequestId = ctx.requestId;
        return Result.ok({});
      },
    });

    await testTool(tool, {}, { requestId: "custom-req-123" });

    expect(receivedRequestId).toBe("custom-req-123");
  });

  it("handles extra properties gracefully (Zod strip by default)", async () => {
    const result = await testTool(echoTool, {
      message: "hello",
      extra: "ignored",
    });

    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toEqual({ echo: "hello" });
  });
});
