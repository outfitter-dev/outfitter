/**
 * Tests for MCP Tool Annotations (OS-52)
 *
 * Verifies that tools can declare behavioral hints:
 * readOnlyHint, destructiveHint, idempotentHint, openWorldHint
 */
import { describe, expect, it } from "bun:test";
import { Result } from "@outfitter/contracts";
import { z } from "zod";
import { createMcpServer, defineTool, type ToolAnnotations } from "../index.js";

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
