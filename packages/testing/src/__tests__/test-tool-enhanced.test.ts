/**
 * @outfitter/testing - Enhanced testTool() Test Suite
 *
 * Verifies testTool() enhancements for v0.5:
 * - Full HandlerContext injection via context option
 * - Hints in the response for assertion
 * - Schema validation with richer error details
 * - Backward compatible with existing tests
 */

import { describe, expect, it } from "bun:test";

import type { HandlerContext } from "@outfitter/contracts";
import { Result, type OutfitterError } from "@outfitter/contracts";
import type { MCPHint } from "@outfitter/contracts";
import { defineTool } from "@outfitter/mcp";
import { z } from "zod";

import { createTestLogger } from "../mock-factories.js";
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

// ============================================================================
// Full Context Injection Tests
// ============================================================================

describe("testTool() — context injection", () => {
  it("accepts full HandlerContext overrides", async () => {
    let receivedCtx: HandlerContext | null = null;
    const tool = defineTool({
      name: "ctx-full",
      description: "Full context check",
      inputSchema: z.object({}),
      handler: async (_input, ctx) => {
        receivedCtx = ctx;
        return Result.ok({ ok: true });
      },
    });

    const logger = createTestLogger();
    await testTool(
      tool,
      {},
      {
        context: {
          requestId: "test-req-001",
          cwd: "/test/dir",
          logger,
        },
      }
    );

    expect(receivedCtx).not.toBeNull();
    expect(receivedCtx!.requestId).toBe("test-req-001");
    expect(receivedCtx!.cwd).toBe("/test/dir");
    expect(receivedCtx!.logger).toBe(logger);
  });

  it("merges context overrides with defaults", async () => {
    let receivedCtx: HandlerContext | null = null;
    const tool = defineTool({
      name: "ctx-merge",
      description: "Context merge check",
      inputSchema: z.object({}),
      handler: async (_input, ctx) => {
        receivedCtx = ctx;
        return Result.ok({ ok: true });
      },
    });

    await testTool(
      tool,
      {},
      {
        context: {
          requestId: "custom-id",
        },
      }
    );

    expect(receivedCtx).not.toBeNull();
    expect(receivedCtx!.requestId).toBe("custom-id");
    // cwd and logger should have defaults
    expect(receivedCtx!.cwd).toBeDefined();
    expect(receivedCtx!.logger).toBeDefined();
  });

  it("context option takes priority over individual cwd/env/requestId", async () => {
    let receivedCtx: HandlerContext | null = null;
    const tool = defineTool({
      name: "ctx-priority",
      description: "Context priority check",
      inputSchema: z.object({}),
      handler: async (_input, ctx) => {
        receivedCtx = ctx;
        return Result.ok({ ok: true });
      },
    });

    await testTool(
      tool,
      {},
      {
        requestId: "old-id",
        cwd: "/old/dir",
        context: {
          requestId: "new-id",
          cwd: "/new/dir",
        },
      }
    );

    // context option should win
    expect(receivedCtx!.requestId).toBe("new-id");
    expect(receivedCtx!.cwd).toBe("/new/dir");
  });
});

// ============================================================================
// Hints Tests
// ============================================================================

describe("testTool() — hints support", () => {
  it("returns hints from the tool result when present", async () => {
    const tool = defineTool({
      name: "hinted",
      description: "Tool with hints",
      inputSchema: z.object({ query: z.string() }),
      handler: async (input) =>
        Result.ok({
          results: [input.query],
          hints: [
            {
              description: "Try narrowing your search",
              tool: "hinted",
              input: { query: `${input.query} --exact` },
            },
          ] satisfies MCPHint[],
        }),
    });

    const result = await testTool(tool, { query: "test" });

    expect(result.isOk()).toBe(true);
    const value = result.unwrap() as {
      results: string[];
      hints: MCPHint[];
    };
    expect(value.hints).toBeDefined();
    expect(value.hints).toHaveLength(1);
    expect(value.hints[0]?.tool).toBe("hinted");
  });

  it("supports hints option for asserting hints on results", async () => {
    const tool = defineTool({
      name: "with-hints",
      description: "Tool returning data",
      inputSchema: z.object({ id: z.string() }),
      handler: async (input) => Result.ok({ id: input.id, found: true }),
    });

    const result = await testTool(
      tool,
      { id: "123" },
      {
        hints: (result) => [
          {
            description: `View details for ${(result as { id: string }).id}`,
            tool: "get-details",
          },
        ],
      }
    );

    // The hints function result should be available
    expect(result.isOk()).toBe(true);
    expect(result.hints).toBeDefined();
    expect(result.hints).toHaveLength(1);
    expect(result.hints![0]?.tool).toBe("get-details");
  });

  it("does not include hints when no hints option provided", async () => {
    const result = await testTool(echoTool, { message: "hello" });

    expect(result.isOk()).toBe(true);
    expect(result.hints).toBeUndefined();
  });

  it("returns empty hints when hints function returns empty array", async () => {
    const tool = defineTool({
      name: "no-hints",
      description: "No hints",
      inputSchema: z.object({}),
      handler: async () => Result.ok({ ok: true }),
    });

    const result = await testTool(
      tool,
      {},
      {
        hints: () => [],
      }
    );

    expect(result.isOk()).toBe(true);
    expect(result.hints).toBeUndefined();
  });
});

// ============================================================================
// Backward Compatibility
// ============================================================================

describe("testTool() — backward compatibility", () => {
  it("existing cwd/env/requestId options still work", async () => {
    let receivedCtx: HandlerContext | null = null;
    const tool = defineTool({
      name: "compat",
      description: "Compat check",
      inputSchema: z.object({}),
      handler: async (_input, ctx) => {
        receivedCtx = ctx;
        return Result.ok({ ok: true });
      },
    });

    await testTool(
      tool,
      {},
      {
        cwd: "/compat/dir",
        requestId: "compat-req",
      }
    );

    expect(receivedCtx!.cwd).toBe("/compat/dir");
    expect(receivedCtx!.requestId).toBe("compat-req");
  });

  it("works without any options (fully backward compatible)", async () => {
    const result = await testTool(echoTool, { message: "hello" });

    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toEqual({ echo: "hello" });
  });

  it("schema validation still works", async () => {
    const result = await testTool(echoTool, { message: 123 });

    expect(result.isErr()).toBe(true);
    expect(result.error.category).toBe("validation");
  });
});
