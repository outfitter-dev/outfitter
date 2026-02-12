/**
 * Tests for MCP Tool Annotations (OS-52)
 *
 * Verifies that tools can declare behavioral hints:
 * readOnlyHint, destructiveHint, idempotentHint, openWorldHint
 */
import { describe, expect, it } from "bun:test";
import { type HandlerContext, Result } from "@outfitter/contracts";
import { z } from "zod";
import {
  adaptHandler,
  createMcpServer,
  defineTool,
  TOOL_ANNOTATIONS,
  type ToolAnnotations,
} from "../index.js";

describe("Tool Annotations", () => {
  it("tool with annotations serializes correctly", () => {
    const server = createMcpServer({
      name: "test-server",
      version: "1.0.0",
    });

    server.registerTool(
      defineTool({
        name: "read-file",
        description: "Read a file from the filesystem",
        inputSchema: z.object({ path: z.string() }),
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
        handler: async (input) => Result.ok({ content: `file: ${input.path}` }),
      })
    );

    const tools = server.getTools();
    expect(tools).toHaveLength(1);
    expect(tools[0].annotations).toEqual({
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    });
  });

  it("tool without annotations omits the field", () => {
    const server = createMcpServer({
      name: "test-server",
      version: "1.0.0",
    });

    server.registerTool(
      defineTool({
        name: "echo",
        description: "Echo the input message",
        inputSchema: z.object({ message: z.string() }),
        handler: async (input) => Result.ok({ echo: input.message }),
      })
    );

    const tools = server.getTools();
    expect(tools).toHaveLength(1);
    expect(tools[0].annotations).toBeUndefined();
  });

  it("readOnlyHint works independently", () => {
    const server = createMcpServer({
      name: "test-server",
      version: "1.0.0",
    });

    server.registerTool(
      defineTool({
        name: "reader",
        description: "A read-only tool for reading data",
        inputSchema: z.object({}),
        annotations: { readOnlyHint: true },
        handler: async () => Result.ok({ data: "read" }),
      })
    );

    const tools = server.getTools();
    expect(tools[0].annotations).toEqual({ readOnlyHint: true });
  });

  it("destructiveHint works independently", () => {
    const server = createMcpServer({
      name: "test-server",
      version: "1.0.0",
    });

    server.registerTool(
      defineTool({
        name: "deleter",
        description: "A destructive tool for deleting data",
        inputSchema: z.object({}),
        annotations: { destructiveHint: true },
        handler: async () => Result.ok({ deleted: true }),
      })
    );

    const tools = server.getTools();
    expect(tools[0].annotations).toEqual({ destructiveHint: true });
  });

  it("idempotentHint works independently", () => {
    const server = createMcpServer({
      name: "test-server",
      version: "1.0.0",
    });

    server.registerTool(
      defineTool({
        name: "setter",
        description: "An idempotent tool for setting data",
        inputSchema: z.object({}),
        annotations: { idempotentHint: true },
        handler: async () => Result.ok({ set: true }),
      })
    );

    const tools = server.getTools();
    expect(tools[0].annotations).toEqual({ idempotentHint: true });
  });

  it("openWorldHint works independently", () => {
    const server = createMcpServer({
      name: "test-server",
      version: "1.0.0",
    });

    server.registerTool(
      defineTool({
        name: "searcher",
        description: "A tool that searches external data sources",
        inputSchema: z.object({}),
        annotations: { openWorldHint: true },
        handler: async () => Result.ok({ results: [] }),
      })
    );

    const tools = server.getTools();
    expect(tools[0].annotations).toEqual({ openWorldHint: true });
  });

  it("ToolAnnotations type allows partial specification", () => {
    const partial: ToolAnnotations = {
      readOnlyHint: true,
      idempotentHint: false,
    };
    expect(partial.readOnlyHint).toBe(true);
    expect(partial.destructiveHint).toBeUndefined();
  });
});

describe("TOOL_ANNOTATIONS presets", () => {
  it("readOnly preset marks tool as read-only and idempotent", () => {
    expect(TOOL_ANNOTATIONS.readOnly).toEqual({
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    });
  });

  it("write preset marks tool as non-read-only, non-destructive", () => {
    expect(TOOL_ANNOTATIONS.write).toEqual({
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    });
  });

  it("writeIdempotent preset marks tool as idempotent write", () => {
    expect(TOOL_ANNOTATIONS.writeIdempotent).toEqual({
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    });
  });

  it("destructive preset marks tool as destructive and idempotent", () => {
    expect(TOOL_ANNOTATIONS.destructive).toEqual({
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: false,
    });
  });

  it("openWorld preset marks tool as open-world", () => {
    expect(TOOL_ANNOTATIONS.openWorld).toEqual({
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    });
  });

  it("presets can be spread and overridden", () => {
    const custom = { ...TOOL_ANNOTATIONS.readOnly, openWorldHint: true };
    expect(custom).toEqual({
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    });
  });

  it("presets work with defineTool", () => {
    const server = createMcpServer({
      name: "test-server",
      version: "1.0.0",
    });

    server.registerTool(
      defineTool({
        name: "list-items",
        description: "List items from the database",
        inputSchema: z.object({}),
        annotations: TOOL_ANNOTATIONS.readOnly,
        handler: async () => Result.ok({ items: [] }),
      })
    );

    const tools = server.getTools();
    expect(tools[0].annotations).toEqual(TOOL_ANNOTATIONS.readOnly);
  });
});

describe("adaptHandler()", () => {
  it("adapts a domain handler for use with defineTool", async () => {
    class DomainError extends Error {
      readonly code = "DOMAIN_ERROR";
    }

    const domainHandler = async (
      input: { id: string },
      _ctx: HandlerContext
    ) => {
      if (input.id === "missing") {
        return Result.err(new DomainError("not found"));
      }
      return Result.ok({ name: "test" });
    };

    const adapted = adaptHandler(domainHandler);

    // biome-ignore lint/suspicious/noEmptyBlockStatements: noop logger stubs
    const noop = () => {};
    const ctx = {
      requestId: "test-123",
      logger: { info: noop, warn: noop, error: noop, debug: noop },
    } as unknown as HandlerContext;

    const okResult = await adapted({ id: "abc" }, ctx);
    expect(okResult.isOk()).toBe(true);
    if (okResult.isOk()) {
      expect(okResult.value).toEqual({ name: "test" });
    }

    const errResult = await adapted({ id: "missing" }, ctx);
    expect(errResult.isErr()).toBe(true);
  });
});
